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
