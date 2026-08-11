'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import {
  createAssignment,
  gradeSubmission,
  releaseSubmissionGrade,
  submitAssignment,
  setAssignmentClosed,
  setAssignmentException,
  transitionAssignment,
  type CreateAssignmentResult,
  type GradeSubmissionResult,
  type SubmitAssignmentResult,
  type AssignmentStateResult,
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

/** Releases a previously saved grade and refreshes the assignment detail page. */
export async function releaseSubmissionGradeAction(
  assignmentId: string,
  submissionId: string,
): Promise<GradeSubmissionResult> {
  const client = await authenticatedClient();
  if (!client) return signedOutGrade;
  const result = await releaseSubmissionGrade(client, submissionId);
  if (result.ok) revalidatePath(`/assignments/${assignmentId}`);
  return result;
}

const signedOutCreate: CreateAssignmentResult = {
  ok: false,
  code: 'forbidden',
  message: 'You must sign in to create an assignment.',
};

/** Creates an assignment and refreshes the assignments list. */
export async function createAssignmentAction(
  input: unknown,
): Promise<CreateAssignmentResult> {
  const client = await authenticatedClient();
  if (!client) return signedOutCreate;
  const result = await createAssignment(client, input);
  if (result.ok) revalidatePath('/assignments');
  return result;
}

const signedOutState: AssignmentStateResult = {
  ok: false,
  message: 'You must sign in to manage an assignment.',
};

export async function transitionAssignmentAction(
  assignmentId: string,
  version: number,
  lifecycle: 'published' | 'archived',
): Promise<AssignmentStateResult> {
  const client = await authenticatedClient();
  if (!client) return signedOutState;
  const result = await transitionAssignment(
    client,
    assignmentId,
    version,
    lifecycle,
  );
  if (result.ok) {
    revalidatePath('/assignments');
    revalidatePath(`/assignments/${assignmentId}`);
  }
  return result;
}

export async function setAssignmentClosedAction(
  assignmentId: string,
  version: number,
  closed: boolean,
): Promise<AssignmentStateResult> {
  const client = await authenticatedClient();
  if (!client) return signedOutState;
  const result = await setAssignmentClosed(
    client,
    assignmentId,
    version,
    closed,
  );
  if (result.ok) revalidatePath(`/assignments/${assignmentId}`);
  return result;
}

export async function setAssignmentExceptionAction(
  assignmentId: string,
  input: unknown,
): Promise<AssignmentStateResult> {
  const client = await authenticatedClient();
  if (!client) return signedOutState;
  const result = await setAssignmentException(client, input);
  if (result.ok) revalidatePath(`/assignments/${assignmentId}`);
  return result;
}
