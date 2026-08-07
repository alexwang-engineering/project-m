import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';

type Client = SupabaseClient<Database>;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface AssignmentTag {
  readonly name: string;
  readonly displayName: string;
}

/** Stable server-to-UI contract for an authorized assignment card. */
export interface AssignmentSummary {
  readonly id: string;
  readonly title: string;
  readonly dueAt: string | null;
  readonly allowResubmission: boolean;
  readonly tags: readonly AssignmentTag[];
  readonly hasSubmitted: boolean;
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
      'id, title, due_at, allow_resubmission, assignment_tags(tags!inner(tag_name, display_name)), assignment_submissions(student_id)',
    )
    .order('due_at', { ascending: true, nullsFirst: false })
    .limit(24);
  if (error) throw error;

  return (data ?? []).map((assignment) => ({
    id: assignment.id,
    title: assignment.title,
    dueAt: assignment.due_at,
    allowResubmission: assignment.allow_resubmission,
    tags: assignment.assignment_tags
      .map(({ tags }) => tags)
      .filter((tag): tag is NonNullable<typeof tag> => tag !== null)
      .map((tag) => ({ name: tag.tag_name, displayName: tag.display_name })),
    hasSubmitted: user
      ? assignment.assignment_submissions.some((s) => s.student_id === user.id)
      : false,
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
}

export interface AssignmentDetail {
  readonly id: string;
  readonly title: string;
  readonly dueAt: string | null;
  readonly submissions: readonly SubmissionSummary[];
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
  const { data: assignment, error: assignmentError } = await client
    .from('assignments')
    .select('id, title, due_at')
    .eq('id', assignmentId)
    .maybeSingle();
  if (assignmentError) throw assignmentError;
  if (!assignment) return null;

  const { data: submissions, error: submissionsError } = await client
    .from('assignment_submissions')
    .select(
      'id, submitted_at, note, file_id, grade, grade_feedback, profiles!assignment_submissions_student_id_fkey(email)',
    )
    .eq('assignment_id', assignmentId)
    .order('submitted_at', { ascending: false });
  if (submissionsError) throw submissionsError;

  return {
    id: assignment.id,
    title: assignment.title,
    dueAt: assignment.due_at,
    submissions: (submissions ?? []).map((submission) => ({
      id: submission.id,
      submittedAt: submission.submitted_at,
      note: submission.note,
      studentEmail: submission.profiles?.email ?? null,
      fileId: submission.file_id,
      grade: submission.grade,
      gradeFeedback: submission.grade_feedback,
    })),
  };
}

export type SubmitAssignmentResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly code: 'invalid_input' | 'forbidden' | 'not_found' | 'not_ready' | 'failed';
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
      return { ok: false, code: 'forbidden', message: 'You are not authorized to submit this assignment.' };
    case 'P0002':
      return { ok: false, code: 'not_found', message: 'The assignment or file was not found.' };
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
      return { ok: false, code: 'failed', message: 'The submission could not be completed.' };
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
  if (!value) return { ok: false, code: 'invalid_input', message: 'Submission input must be an object.' };
  if (typeof value.assignmentId !== 'string' || !UUID.test(value.assignmentId)) {
    return { ok: false, code: 'invalid_input', message: 'Assignment ID is invalid.' };
  }
  if (typeof value.fileId !== 'string' || !UUID.test(value.fileId)) {
    return { ok: false, code: 'invalid_input', message: 'File ID is invalid.' };
  }
  if (value.note !== undefined && (typeof value.note !== 'string' || value.note.length > 2000)) {
    return { ok: false, code: 'invalid_input', message: 'Note must be at most 2000 characters.' };
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
    error !== null && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
      ? error.code
      : undefined;
  switch (code) {
    case '42501':
      return { ok: false, code: 'forbidden', message: 'You do not manage this assignment.' };
    case 'P0002':
      return { ok: false, code: 'not_found', message: 'The submission was not found.' };
    default:
      return { ok: false, code: 'failed', message: 'The grade could not be saved.' };
  }
}

/** Records a percentage grade (0-100) and optional feedback via the audited RPC. */
export async function gradeSubmission(client: Client, input: unknown): Promise<GradeSubmissionResult> {
  const value =
    input !== null && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : null;
  if (!value) return { ok: false, code: 'invalid_input', message: 'Grade input must be an object.' };
  if (typeof value.submissionId !== 'string' || !UUID.test(value.submissionId)) {
    return { ok: false, code: 'invalid_input', message: 'Submission ID is invalid.' };
  }
  if (typeof value.grade !== 'number' || !Number.isFinite(value.grade) || value.grade < 0 || value.grade > 100) {
    return { ok: false, code: 'invalid_input', message: 'Grade must be a number between 0 and 100.' };
  }
  if (value.feedback !== undefined && (typeof value.feedback !== 'string' || value.feedback.length > 2000)) {
    return { ok: false, code: 'invalid_input', message: 'Feedback must be at most 2000 characters.' };
  }

  const { error } = await client.rpc('grade_assignment_submission', {
    target_submission_id: value.submissionId,
    grade_value: value.grade,
    feedback_text: (value.feedback as string | undefined) ?? undefined,
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
  'assignment_due_at' | 'instructions_page'
> & {
  assignment_due_at: string | null;
  instructions_page: string | null;
};

async function createAssignmentRpc(client: Client, args: NullableDueDateArgs) {
  return client.rpc(
    'create_assignment',
    args as Database['public']['Functions']['create_assignment']['Args'],
  );
}

/** Validates and creates an assignment via the audited RPC. Teacher/manager on every audience tag, enforced server-side. */
export async function createAssignment(client: Client, input: unknown): Promise<CreateAssignmentResult> {
  const value =
    input !== null && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : null;
  if (!value) return { ok: false, code: 'invalid_input', message: 'Assignment input must be an object.' };
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  if (!title || title.length > 240) {
    return { ok: false, code: 'invalid_input', message: 'Title must be between 1 and 240 characters.' };
  }
  const dueAt = value.dueAt === null || value.dueAt === undefined ? null : value.dueAt;
  if (dueAt !== null && typeof dueAt !== 'string') {
    return { ok: false, code: 'invalid_input', message: 'Due date must be a string or null.' };
  }
  if (typeof value.allowResubmission !== 'boolean') {
    return { ok: false, code: 'invalid_input', message: 'Resubmission setting must be a boolean.' };
  }
  if (!Array.isArray(value.tagIds) || value.tagIds.length < 1 || value.tagIds.length > 100) {
    return { ok: false, code: 'invalid_input', message: 'Between 1 and 100 audience tags are required.' };
  }
  const tagIds = value.tagIds.filter((tag): tag is string => typeof tag === 'string' && UUID.test(tag));
  if (tagIds.length !== value.tagIds.length) {
    return { ok: false, code: 'invalid_input', message: 'Every audience tag ID must be a UUID.' };
  }

  const { data, error } = await createAssignmentRpc(client, {
    assignment_title: title,
    instructions_page: null,
    assignment_due_at: dueAt,
    resubmission_allowed: value.allowResubmission,
    audience_tag_ids: tagIds,
    correlation_id: crypto.randomUUID(),
  });
  if (error || !data) {
    const code =
      error !== null && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
        ? error.code
        : undefined;
    if (code === '42501') return { ok: false, code: 'forbidden', message: 'You do not manage every selected tag.' };
    return { ok: false, code: 'failed', message: 'The assignment could not be created.' };
  }
  return { ok: true, assignment: { id: data.id } };
}
