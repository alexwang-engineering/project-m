'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import {
  gradeSubmission,
  submitAssignment,
  type GradeSubmissionResult,
  type SubmitAssignmentResult,
} from '@/lib/content/assignments';
import { createServerClient } from '@/lib/supabase/server';

async function authenticatedClient(): Promise<SupabaseClient<Database> | null> {
  const client = (await createServerClient()) as SupabaseClient<Database>;
  const { data, error } = await client.auth.getUser();
  return error || !data.user ? null : client;
}

const signedOut: SubmitAssignmentResult = {
  ok: false,
  code: 'forbidden',
  message: 'You must sign in to submit an assignment.',
};

const signedOutGrade: GradeSubmissionResult = {
  ok: false,
  code: 'forbidden',
  message: 'You must sign in to grade a submission.',
};

/** Submits a verified upload against an assignment and refreshes the assignments list. */
export async function submitAssignmentAction(
  input: unknown,
): Promise<SubmitAssignmentResult> {
  const client = await authenticatedClient();
  if (!client) return signedOut;
  const result = await submitAssignment(client, input);
  if (result.ok) revalidatePath('/assignments');
  return result;
}

/** Records a grade for a submission and refreshes the assignment detail page. */
export async function gradeSubmissionAction(
  assignmentId: string,
  input: unknown,
): Promise<GradeSubmissionResult> {
  const client = await authenticatedClient();
  if (!client) return signedOutGrade;
  const result = await gradeSubmission(client, input);
  if (result.ok) revalidatePath(`/assignments/${assignmentId}`);
  return result;
}
