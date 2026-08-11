import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database, Json } from '@/lib/database.types';
import {
  parseEditorDocument,
  type EditorDocumentV1,
} from '@/lib/content/schema';

type Client = SupabaseClient<Database>;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface AssignmentTag {
  readonly name: string;
  readonly displayName: string;
}

export interface AssignmentInstructions {
  readonly id: string;
  readonly title: string;
  readonly canonicalUrl: string;
}

export interface AttachableInstructionPage extends AssignmentInstructions {
  readonly isPublic: boolean;
  readonly tagIds: readonly string[];
}

/** Stable server-to-UI contract for an authorized assignment card. */
export interface AssignmentSummary {
  readonly id: string;
  readonly title: string;
  readonly dueAt: string | null;
  readonly allowResubmission: boolean;
  readonly tags: readonly AssignmentTag[];
  readonly hasSubmitted: boolean;
  readonly instructions: AssignmentInstructions | null;
  readonly lifecycle: 'draft' | 'published' | 'archived';
  readonly availableFrom: string | null;
  readonly closedAt: string | null;
}

/** Published canonical pages visible to the teacher; creation RPC remains authoritative for audience coverage. */
export async function listAttachableInstructionPages(
  client: Client,
): Promise<readonly AttachableInstructionPage[]> {
  const { data, error } = await client
    .from('pages')
    .select('id, title, canonical_url, is_public, page_tags(tag_id)')
    .eq('lifecycle', 'published')
    .order('title')
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((page) => ({
    id: page.id,
    title: page.title,
    canonicalUrl: page.canonical_url,
    isPublic: page.is_public,
    tagIds: page.page_tags.map(({ tag_id }) => tag_id),
  }));
}

/**
 * Lists assignments the current principal is authorized to see. Supabase
 * RLS is authoritative, so out-of-audience assignments never enter the
 * projection. `hasSubmitted` reflects only the caller's own submission rows
 * - RLS on assignment_submissions already restricts a student to their own.
 */
export async function listAssignments(
  client: Client,
): Promise<readonly AssignmentSummary[]> {
  const {
    data: { user },
  } = await client.auth.getUser();

  const { data, error } = await client
    .from('assignments')
    .select(
      'id, title, due_at, available_from, closed_at, lifecycle, allow_resubmission, instructions:pages!assignments_instructions_page_id_fkey(id, title, canonical_url), assignment_tags(tags!inner(tag_name, display_name)), assignment_submissions(student_id), assignment_exceptions(student_id, extended_due_at)',
    )
    .order('due_at', { ascending: true, nullsFirst: false })
    .limit(24);
  if (error) throw error;

  return (data ?? []).map((assignment) => ({
    id: assignment.id,
    title: assignment.title,
    dueAt:
      assignment.assignment_exceptions.find(
        (exception) => exception.student_id === user?.id,
      )?.extended_due_at ?? assignment.due_at,
    allowResubmission: assignment.allow_resubmission,
    tags: assignment.assignment_tags
      .map(({ tags }) => tags)
      .filter((tag): tag is NonNullable<typeof tag> => tag !== null)
      .map((tag) => ({ name: tag.tag_name, displayName: tag.display_name })),
    hasSubmitted: user
      ? assignment.assignment_submissions.some((s) => s.student_id === user.id)
      : false,
    instructions: assignment.instructions
      ? {
          id: assignment.instructions.id,
          title: assignment.instructions.title,
          canonicalUrl: assignment.instructions.canonical_url,
        }
      : null,
    lifecycle: assignment.lifecycle,
    availableFrom: assignment.available_from,
    closedAt: assignment.closed_at,
  }));
}

export interface SubmissionSummary {
  readonly id: string;
  readonly submittedAt: string;
  readonly note: string | null;
  readonly studentEmail: string | null;
  readonly fileId: string;
  readonly grade: number | null;
  readonly gradeFeedback: string | null;
  readonly gradeReleasedAt: string | null;
  readonly timeline?: readonly {
    readonly occurredAt: string;
    readonly action: string;
    readonly actorEmail: string | null;
  }[];
}

export interface AssignmentRosterEntry {
  readonly studentId: string;
  readonly studentEmail: string;
  readonly status:
    'not_submitted' | 'submitted' | 'marked' | 'released' | 'withdrawn';
  readonly submissionId: string | null;
  readonly effectiveDueAt: string | null;
  readonly withdrawnAt: string | null;
}

export interface AssignmentDetail {
  readonly id: string;
  readonly title: string;
  readonly dueAt: string | null;
  readonly canManage: boolean;
  readonly lifecycle: 'draft' | 'published' | 'archived';
  readonly version: number;
  readonly availableFrom: string | null;
  readonly closedAt: string | null;
  readonly instructions:
    (AssignmentInstructions & { readonly content: EditorDocumentV1 }) | null;
  readonly submissions: readonly SubmissionSummary[];
  readonly roster?: readonly AssignmentRosterEntry[];
}

/**
 * Loads one assignment plus whatever submissions RLS permits the caller to
 * see - a student sees only their own row, a teacher/manager who can manage
 * the assignment sees every submission against it. No role check happens
 * here; the query result itself is already the authorized answer.
 */
export async function getAssignmentDetail(
  client: Client,
  assignmentId: string,
): Promise<AssignmentDetail | null> {
  const {
    data: { user },
  } = await client.auth.getUser();
  const { data: assignment, error: assignmentError } = await client
    .from('assignments')
    .select(
      'id, title, due_at, available_from, closed_at, lifecycle, version, assignment_exceptions(student_id, extended_due_at), instructions:pages!assignments_instructions_page_id_fkey(id, title, canonical_url, content_json)',
    )
    .eq('id', assignmentId)
    .maybeSingle();
  if (assignmentError) throw assignmentError;
  if (!assignment) return null;

  const [
    { data: submissions, error: submissionsError },
    { data: canManage, error: canManageError },
  ] = await Promise.all([
    client
      .from('assignment_submissions')
      .select(
        'id, submitted_at, note, file_id, profiles!assignment_submissions_student_id_fkey(email), assignment_grades(grade, feedback, released_at)',
      )
      .eq('assignment_id', assignmentId)
      .order('submitted_at', { ascending: false })
      .limit(200),
    client.rpc('can_manage_assignment', { target_assignment: assignmentId }),
  ]);
  if (submissionsError) throw submissionsError;
  if (canManageError) throw canManageError;

  const { data: roster, error: rosterError } = canManage
    ? await client.rpc('assignment_review_roster', {
        target_assignment_id: assignmentId,
      })
    : { data: [], error: null };
  if (rosterError) throw rosterError;
  const timelines = canManage
    ? await Promise.all(
        (submissions ?? []).map((submission) =>
          client.rpc('assignment_submission_timeline', {
            target_submission_id: submission.id,
          }),
        ),
      )
    : [];
  const timelineBySubmission = new Map(
    timelines.map((result, index) => {
      if (result.error) throw result.error;
      return [(submissions ?? [])[index]?.id, result.data ?? []] as const;
    }),
  );

  return {
    id: assignment.id,
    title: assignment.title,
    dueAt:
      assignment.assignment_exceptions.find(
        (exception) => exception.student_id === user?.id,
      )?.extended_due_at ?? assignment.due_at,
    canManage: canManage ?? false,
    lifecycle: assignment.lifecycle,
    version: assignment.version,
    availableFrom: assignment.available_from,
    closedAt: assignment.closed_at,
    instructions: assignment.instructions
      ? {
          id: assignment.instructions.id,
          title: assignment.instructions.title,
          canonicalUrl: assignment.instructions.canonical_url,
          content: parseEditorDocument(
            assignment.instructions.content_json as Json,
          ),
        }
      : null,
    submissions: (submissions ?? []).map((submission) => {
      const grade = submission.assignment_grades;
      return {
        id: submission.id,
        submittedAt: submission.submitted_at,
        note: submission.note,
        studentEmail: submission.profiles?.email ?? null,
        fileId: submission.file_id,
        grade: grade?.grade ?? null,
        gradeFeedback: grade?.feedback ?? null,
        gradeReleasedAt: grade?.released_at ?? null,
        timeline: timelineBySubmission.get(submission.id)?.map((event) => ({
          occurredAt: event.occurred_at,
          action: event.action,
          actorEmail: event.actor_email,
        })),
      };
    }),
    roster: (roster ?? []).map((entry) => ({
      studentId: entry.student_id,
      studentEmail: entry.student_email,
      status: entry.status as AssignmentRosterEntry['status'],
      submissionId: entry.submission_id,
      effectiveDueAt: entry.effective_due_at,
      withdrawnAt: entry.withdrawn_at,
    })),
  };
}

/** Returns the student-facing projection only; no submission or grading rows are queried. */
export async function getAssignmentStudentPreview(
  client: Client,
  assignmentId: string,
): Promise<AssignmentDetail | null> {
  const { data: allowed, error: accessError } = await client.rpc(
    'can_manage_assignment',
    { target_assignment: assignmentId },
  );
  if (accessError) throw accessError;
  if (!allowed) return null;
  const { data: assignment, error } = await client
    .from('assignments')
    .select(
      'id, title, due_at, available_from, closed_at, lifecycle, version, instructions:pages!assignments_instructions_page_id_fkey(id, title, canonical_url, content_json)',
    )
    .eq('id', assignmentId)
    .maybeSingle();
  if (error) throw error;
  if (!assignment) return null;
  return {
    id: assignment.id,
    title: assignment.title,
    dueAt: assignment.due_at,
    availableFrom: assignment.available_from,
    closedAt: assignment.closed_at,
    lifecycle: assignment.lifecycle,
    version: assignment.version,
    canManage: false,
    submissions: [],
    roster: [],
    instructions: assignment.instructions
      ? {
          id: assignment.instructions.id,
          title: assignment.instructions.title,
          canonicalUrl: assignment.instructions.canonical_url,
          content: parseEditorDocument(
            assignment.instructions.content_json as Json,
          ),
        }
      : null,
  };
}

export type SubmitAssignmentResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly code:
        'invalid_input' | 'forbidden' | 'not_found' | 'not_ready' | 'failed';
      readonly message: string;
    };

function failure(error: unknown): SubmitAssignmentResult {
  const code =
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
      ? error.code
      : undefined;
  switch (code) {
    case '42501':
      return {
        ok: false,
        code: 'forbidden',
        message: 'You are not authorized to submit this assignment.',
      };
    case 'P0002':
      return {
        ok: false,
        code: 'not_found',
        message: 'The assignment or file was not found.',
      };
    case '55000':
      return {
        ok: false,
        code: 'not_ready',
        message:
          error !== null && typeof error === 'object' && 'message' in error
            ? String((error as { message: unknown }).message)
            : 'This submission could not be accepted.',
      };
    default:
      return {
        ok: false,
        code: 'failed',
        message: 'The submission could not be completed.',
      };
  }
}

/** Submits a verified, actor-owned file against an assignment via the audited RPC. */
export async function submitAssignment(
  client: Client,
  input: unknown,
): Promise<SubmitAssignmentResult> {
  const value =
    input !== null && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : null;
  if (!value)
    return {
      ok: false,
      code: 'invalid_input',
      message: 'Submission input must be an object.',
    };
  if (
    typeof value.assignmentId !== 'string' ||
    !UUID.test(value.assignmentId)
  ) {
    return {
      ok: false,
      code: 'invalid_input',
      message: 'Assignment ID is invalid.',
    };
  }
  if (typeof value.fileId !== 'string' || !UUID.test(value.fileId)) {
    return { ok: false, code: 'invalid_input', message: 'File ID is invalid.' };
  }
  if (
    value.note !== undefined &&
    (typeof value.note !== 'string' || value.note.length > 2000)
  ) {
    return {
      ok: false,
      code: 'invalid_input',
      message: 'Note must be at most 2000 characters.',
    };
  }

  const { error } = await client.rpc('submit_assignment', {
    target_assignment_id: value.assignmentId,
    target_file_id: value.fileId,
    submission_note: (value.note as string | undefined) ?? undefined,
    correlation_id: crypto.randomUUID(),
  });
  return error ? failure(error) : { ok: true };
}

export type GradeSubmissionResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly code: 'invalid_input' | 'forbidden' | 'not_found' | 'failed';
      readonly message: string;
    };

function gradeFailure(error: unknown): GradeSubmissionResult {
  const code =
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
      ? error.code
      : undefined;
  switch (code) {
    case '42501':
      return {
        ok: false,
        code: 'forbidden',
        message: 'You do not manage this assignment.',
      };
    case 'P0002':
      return {
        ok: false,
        code: 'not_found',
        message: 'The submission was not found.',
      };
    default:
      return {
        ok: false,
        code: 'failed',
        message: 'The grade could not be saved.',
      };
  }
}

/** Records a percentage grade (0-100) and optional feedback via the audited RPC. */
export async function gradeSubmission(
  client: Client,
  input: unknown,
): Promise<GradeSubmissionResult> {
  const value =
    input !== null && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : null;
  if (!value)
    return {
      ok: false,
      code: 'invalid_input',
      message: 'Grade input must be an object.',
    };
  if (
    typeof value.submissionId !== 'string' ||
    !UUID.test(value.submissionId)
  ) {
    return {
      ok: false,
      code: 'invalid_input',
      message: 'Submission ID is invalid.',
    };
  }
  if (
    typeof value.grade !== 'number' ||
    !Number.isFinite(value.grade) ||
    value.grade < 0 ||
    value.grade > 100
  ) {
    return {
      ok: false,
      code: 'invalid_input',
      message: 'Grade must be a number between 0 and 100.',
    };
  }
  if (
    value.feedback !== undefined &&
    (typeof value.feedback !== 'string' || value.feedback.length > 2000)
  ) {
    return {
      ok: false,
      code: 'invalid_input',
      message: 'Feedback must be at most 2000 characters.',
    };
  }

  const { error } = await client.rpc('grade_assignment_submission', {
    target_submission_id: value.submissionId,
    grade_value: value.grade,
    feedback_text: (value.feedback as string | undefined) ?? undefined,
    correlation_id: crypto.randomUUID(),
  });
  return error ? gradeFailure(error) : { ok: true };
}

/** Publishes a saved assignment grade to the student and linked guardians. */
export async function releaseSubmissionGrade(
  client: Client,
  submissionId: string,
): Promise<GradeSubmissionResult> {
  if (!UUID.test(submissionId)) {
    return {
      ok: false,
      code: 'invalid_input',
      message: 'Submission ID is invalid.',
    };
  }
  const { error } = await client.rpc('release_assignment_grade', {
    target_submission_id: submissionId,
    correlation_id: crypto.randomUUID(),
  });
  return error ? gradeFailure(error) : { ok: true };
}

export type CreateAssignmentResult =
  | { readonly ok: true; readonly assignment: { readonly id: string } }
  | {
      readonly ok: false;
      readonly code: 'invalid_input' | 'forbidden' | 'failed';
      readonly message: string;
    };

// postgres-meta cannot express nullable RPC parameters, although PostgreSQL
// timestamptz/uuid parameters accept NULL - same generator mismatch already
// localized in lib/content/mutations.ts for create_page's nullable parent.
type NullableDueDateArgs = Omit<
  Database['public']['Functions']['create_assignment']['Args'],
  'assignment_due_at' | 'instructions_page' | 'assignment_available_from'
> & {
  assignment_due_at: string | null;
  instructions_page: string | null;
  assignment_available_from: string | null;
};

async function createAssignmentRpc(client: Client, args: NullableDueDateArgs) {
  return client.rpc(
    'create_assignment',
    args as Database['public']['Functions']['create_assignment']['Args'],
  );
}

/** Validates and creates an assignment via the audited RPC. Teacher/manager on every audience tag, enforced server-side. */
export async function createAssignment(
  client: Client,
  input: unknown,
): Promise<CreateAssignmentResult> {
  const value =
    input !== null && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : null;
  if (!value)
    return {
      ok: false,
      code: 'invalid_input',
      message: 'Assignment input must be an object.',
    };
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  if (!title || title.length > 240) {
    return {
      ok: false,
      code: 'invalid_input',
      message: 'Title must be between 1 and 240 characters.',
    };
  }
  const dueAt =
    value.dueAt === null || value.dueAt === undefined ? null : value.dueAt;
  if (
    dueAt !== null &&
    (typeof dueAt !== 'string' || !Number.isFinite(Date.parse(dueAt)))
  ) {
    return {
      ok: false,
      code: 'invalid_input',
      message: 'Due date must be a string or null.',
    };
  }
  const availableFrom = value.availableFrom ?? null;
  if (
    availableFrom !== null &&
    (typeof availableFrom !== 'string' ||
      !Number.isFinite(Date.parse(availableFrom)))
  ) {
    return {
      ok: false,
      code: 'invalid_input',
      message: 'Available date must be a string or null.',
    };
  }
  if (availableFrom && dueAt && new Date(availableFrom) > new Date(dueAt)) {
    return {
      ok: false,
      code: 'invalid_input',
      message: 'Available date must not be after the due date.',
    };
  }
  if (typeof value.allowResubmission !== 'boolean') {
    return {
      ok: false,
      code: 'invalid_input',
      message: 'Resubmission setting must be a boolean.',
    };
  }
  if (
    !Array.isArray(value.tagIds) ||
    value.tagIds.length < 1 ||
    value.tagIds.length > 100
  ) {
    return {
      ok: false,
      code: 'invalid_input',
      message: 'Between 1 and 100 audience tags are required.',
    };
  }
  const tagIds = value.tagIds.filter(
    (tag): tag is string => typeof tag === 'string' && UUID.test(tag),
  );
  if (tagIds.length !== value.tagIds.length) {
    return {
      ok: false,
      code: 'invalid_input',
      message: 'Every audience tag ID must be a UUID.',
    };
  }
  const instructionsPageId = value.instructionsPageId ?? null;
  if (
    instructionsPageId !== null &&
    (typeof instructionsPageId !== 'string' || !UUID.test(instructionsPageId))
  ) {
    return {
      ok: false,
      code: 'invalid_input',
      message: 'Instructions page ID must be a UUID or null.',
    };
  }

  const { data, error } = await createAssignmentRpc(client, {
    assignment_title: title,
    instructions_page: instructionsPageId,
    assignment_due_at: dueAt,
    assignment_available_from: availableFrom,
    resubmission_allowed: value.allowResubmission,
    audience_tag_ids: tagIds,
    correlation_id: crypto.randomUUID(),
  });
  if (error || !data) {
    const code =
      error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      typeof error.code === 'string'
        ? error.code
        : undefined;
    if (code === '42501')
      return {
        ok: false,
        code: 'forbidden',
        message:
          'You do not manage every selected tag, or the instructions are unavailable to the full audience.',
      };
    return {
      ok: false,
      code: 'failed',
      message: 'The assignment could not be created.',
    };
  }
  return { ok: true, assignment: { id: data.id } };
}

export type AssignmentStateResult =
  { readonly ok: true } | { readonly ok: false; readonly message: string };

/** Applies an optimistic, audited lifecycle transition. */
export async function transitionAssignment(
  client: Client,
  assignmentId: string,
  version: number,
  lifecycle: 'published' | 'archived',
): Promise<AssignmentStateResult> {
  if (!UUID.test(assignmentId) || !Number.isSafeInteger(version) || version < 1)
    return { ok: false, message: 'Assignment state is invalid.' };
  const { error } = await client.rpc('transition_assignment', {
    target_assignment_id: assignmentId,
    expected_version: version,
    next_lifecycle: lifecycle,
    correlation_id: crypto.randomUUID(),
  });
  return error
    ? {
        ok: false,
        message:
          error.code === '40001'
            ? 'This assignment changed. Reload and try again.'
            : 'The assignment state could not be changed.',
      }
    : { ok: true };
}

/** Opens or closes the immutable submission intake without changing the due date. */
export async function setAssignmentClosed(
  client: Client,
  assignmentId: string,
  version: number,
  closed: boolean,
): Promise<AssignmentStateResult> {
  if (!UUID.test(assignmentId) || !Number.isSafeInteger(version) || version < 1)
    return { ok: false, message: 'Assignment state is invalid.' };
  const { error } = await client.rpc('set_assignment_closed', {
    target_assignment_id: assignmentId,
    expected_version: version,
    is_closed: closed,
    correlation_id: crypto.randomUUID(),
  });
  return error
    ? {
        ok: false,
        message:
          error.code === '40001'
            ? 'This assignment changed. Reload and try again.'
            : 'Submission intake could not be changed.',
      }
    : { ok: true };
}

/** Creates, replaces, or clears one audited pupil-specific assignment exception. */
export async function setAssignmentException(
  client: Client,
  input: unknown,
): Promise<AssignmentStateResult> {
  const value =
    input && typeof input === 'object'
      ? (input as Record<string, unknown>)
      : null;
  const assignmentId = value?.assignmentId;
  const studentId = value?.studentId;
  const reason = typeof value?.reason === 'string' ? value.reason.trim() : '';
  const dueAt = value?.extendedDueAt ?? null;
  if (
    typeof assignmentId !== 'string' ||
    !UUID.test(assignmentId) ||
    typeof studentId !== 'string' ||
    !UUID.test(studentId) ||
    !reason ||
    reason.length > 500 ||
    (dueAt !== null &&
      (typeof dueAt !== 'string' || !Number.isFinite(Date.parse(dueAt))))
  )
    return {
      ok: false,
      message: 'A valid pupil, date, and reason are required.',
    };
  const { error } = await client.rpc('set_assignment_exception', {
    target_assignment_id: assignmentId,
    target_student_id: studentId,
    new_extended_due_at: dueAt as string,
    withdraw_student: value?.withdraw === true,
    exception_reason: reason,
    correlation_id: crypto.randomUUID(),
  });
  return error
    ? {
        ok: false,
        message:
          error.code === '42501'
            ? 'You cannot change this pupil’s assignment access.'
            : 'The exception could not be saved.',
      }
    : { ok: true };
}
