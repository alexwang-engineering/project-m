'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import {
  createQuiz,
  submitQuizAttempt,
  type CreateQuizResult,
  type QuizActionResult,
} from '@/lib/content/quizzes';
import { createServerClient } from '@/lib/supabase/server';

async function authenticatedClient(): Promise<SupabaseClient<Database> | null> {
  const client = (await createServerClient()) as SupabaseClient<Database>;
  const { data, error } = await client.auth.getUser();
  return error || !data.user ? null : client;
}

const signedOutCreate: CreateQuizResult = {
  ok: false,
  code: 'forbidden',
  message: 'You must sign in to create a quiz.',
};

const signedOutAttempt: QuizActionResult = {
  ok: false,
  code: 'forbidden',
  message: 'You must sign in to take a quiz.',
};

/** Creates a quiz + its questions and refreshes the quizzes list. */
export async function createQuizAction(
  input: unknown,
): Promise<CreateQuizResult> {
  const client = await authenticatedClient();
  if (!client) return signedOutCreate;
  const result = await createQuiz(client, input);
  if (result.ok) revalidatePath('/quizzes');
  return result;
}

/** Submits a graded attempt and refreshes the quiz detail page. */
export async function submitQuizAttemptAction(
  input: unknown,
): Promise<QuizActionResult> {
  const client = await authenticatedClient();
  if (!client) return signedOutAttempt;
  const result = await submitQuizAttempt(client, input);
  if (
    result.ok &&
    typeof input === 'object' &&
    input !== null &&
    'quizId' in input
  ) {
    revalidatePath(`/quizzes/${(input as { quizId: string }).quizId}`);
  }
  return result;
}
