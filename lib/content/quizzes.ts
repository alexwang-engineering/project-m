import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';

type Client = SupabaseClient<Database>;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface QuizTag {
  readonly name: string;
  readonly displayName: string;
}

/** Stable server-to-UI contract for an authorized quiz card. */
export interface QuizSummary {
  readonly id: string;
  readonly title: string;
  readonly dueAt: string | null;
  readonly tags: readonly QuizTag[];
  readonly hasAttempted: boolean;
}

/** Lists quizzes the current principal is authorized to see, per can_read_quiz. */
export async function listQuizzes(
  client: Client,
): Promise<readonly QuizSummary[]> {
  const {
    data: { user },
  } = await client.auth.getUser();

  const { data, error } = await client
    .from('quizzes')
    .select(
      'id, title, due_at, quiz_tags(tags!inner(tag_name, display_name)), quiz_attempts(student_id)',
    )
    .order('due_at', { ascending: true, nullsFirst: false })
    .limit(24);
  if (error) throw error;

  return (data ?? []).map((quiz) => ({
    id: quiz.id,
    title: quiz.title,
    dueAt: quiz.due_at,
    tags: quiz.quiz_tags
      .map(({ tags }) => tags)
      .filter((tag): tag is NonNullable<typeof tag> => tag !== null)
      .map((tag) => ({ name: tag.tag_name, displayName: tag.display_name })),
    hasAttempted: user
      ? quiz.quiz_attempts.some((a) => a.student_id === user.id)
      : false,
  }));
}

export interface QuizChoice {
  readonly id: string;
  readonly label: string;
}

export interface QuizQuestion {
  readonly id: string;
  readonly prompt: string;
  readonly choices: readonly QuizChoice[];
}

export interface QuizAttemptSummary {
  readonly id: string;
  readonly studentEmail: string | null;
  readonly score: number;
  readonly maxScore: number;
  readonly submittedAt: string;
}

export interface QuizDetail {
  readonly id: string;
  readonly title: string;
  readonly dueAt: string | null;
  readonly canManage: boolean;
  readonly questions: readonly QuizQuestion[];
  readonly myAttempt: QuizAttemptSummary | null;
  /** All attempts against this quiz, populated only when canManage is true (RLS already enforces this). */
  readonly attempts: readonly QuizAttemptSummary[];
}

function isChoiceArray(value: unknown): value is QuizChoice[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item !== null &&
        typeof item === 'object' &&
        typeof (item as { id?: unknown }).id === 'string' &&
        typeof (item as { label?: unknown }).label === 'string',
    )
  );
}

/** Loads one quiz plus whatever questions/attempts RLS permits the caller to see. */
export async function getQuizDetail(
  client: Client,
  quizId: string,
): Promise<QuizDetail | null> {
  if (!UUID.test(quizId)) return null;
  const {
    data: { user },
  } = await client.auth.getUser();

  const [
    { data: quiz, error: quizError },
    { data: canManage, error: manageError },
  ] = await Promise.all([
    client
      .from('quizzes')
      .select('id, title, due_at')
      .eq('id', quizId)
      .maybeSingle(),
    client.rpc('can_manage_quiz', { target_quiz: quizId }),
  ]);
  if (quizError) throw quizError;
  if (manageError) throw manageError;
  if (!quiz) return null;

  const { data: questions, error: questionsError } = await client
    .from('quiz_questions')
    .select('id, prompt, choices')
    .eq('quiz_id', quizId)
    .order('position', { ascending: true });
  if (questionsError) throw questionsError;

  const { data: attempts, error: attemptsError } = await client
    .from('quiz_attempts')
    .select('id, student_id, score, max_score, submitted_at, profiles(email)')
    .eq('quiz_id', quizId)
    .order('submitted_at', { ascending: false });
  if (attemptsError) throw attemptsError;

  function toSummary(
    attempt: NonNullable<typeof attempts>[number],
  ): QuizAttemptSummary {
    return {
      id: attempt.id,
      studentEmail: attempt.profiles?.email ?? null,
      score: attempt.score,
      maxScore: attempt.max_score,
      submittedAt: attempt.submitted_at,
    };
  }
  const myAttemptRow = user
    ? (attempts ?? []).find((a) => a.student_id === user.id)
    : undefined;

  return {
    id: quiz.id,
    title: quiz.title,
    dueAt: quiz.due_at,
    canManage: canManage ?? false,
    questions: (questions ?? []).map((q) => ({
      id: q.id,
      prompt: q.prompt,
      choices: isChoiceArray(q.choices) ? q.choices : [],
    })),
    myAttempt: myAttemptRow ? toSummary(myAttemptRow) : null,
    attempts: (attempts ?? []).map(toSummary),
  };
}

export type QuizActionResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly code:
        'invalid_input' | 'forbidden' | 'not_found' | 'not_ready' | 'failed';
      readonly message: string;
    };

export type CreateQuizResult =
  | { readonly ok: true; readonly quiz: { readonly id: string } }
  | {
      readonly ok: false;
      readonly code: 'invalid_input' | 'forbidden' | 'failed';
      readonly message: string;
    };

function failureCode(error: unknown): string | undefined {
  return error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
    ? error.code
    : undefined;
}

function errorMessage(error: unknown, fallback: string): string {
  return error !== null &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
    ? error.message
    : fallback;
}

function record(input: unknown): Record<string, unknown> | null {
  return input !== null && typeof input === 'object' && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : null;
}

/** Validates and creates a quiz + its questions atomically via the audited RPC. */
export async function createQuiz(
  client: Client,
  input: unknown,
): Promise<CreateQuizResult> {
  const value = record(input);
  if (!value)
    return {
      ok: false,
      code: 'invalid_input',
      message: 'Quiz input must be an object.',
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
  if (dueAt !== null && typeof dueAt !== 'string') {
    return {
      ok: false,
      code: 'invalid_input',
      message: 'Due date must be a string or null.',
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
  if (
    !Array.isArray(value.questions) ||
    value.questions.length < 1 ||
    value.questions.length > 100
  ) {
    return {
      ok: false,
      code: 'invalid_input',
      message: 'A quiz needs between 1 and 100 questions.',
    };
  }
  for (const question of value.questions) {
    const q = record(question);
    if (!q)
      return {
        ok: false,
        code: 'invalid_input',
        message: 'Every question must be an object.',
      };
    // A bank-sourced question (ADR-014) carries only a bankItemId - its
    // prompt/choices/correct answer are resolved server-side from the bank
    // item's current row, not from anything sent here.
    if (typeof q.bankItemId === 'string') {
      if (!UUID.test(q.bankItemId)) {
        return {
          ok: false,
          code: 'invalid_input',
          message: 'bankItemId must be a UUID.',
        };
      }
      continue;
    }
    if (typeof q.prompt !== 'string' || !q.prompt.trim()) {
      return {
        ok: false,
        code: 'invalid_input',
        message: 'Every question needs a prompt.',
      };
    }
    if (
      !Array.isArray(q.choices) ||
      q.choices.length < 2 ||
      q.choices.length > 8
    ) {
      return {
        ok: false,
        code: 'invalid_input',
        message: 'Every question needs between 2 and 8 choices.',
      };
    }
    if (typeof q.correctChoiceId !== 'string' || !q.correctChoiceId) {
      return {
        ok: false,
        code: 'invalid_input',
        message: 'Every question needs a correct choice.',
      };
    }
  }

  const { data, error } = await client.rpc('create_quiz', {
    quiz_title: title,
    quiz_due_at: dueAt,
    audience_tag_ids: tagIds,
    quiz_questions: JSON.parse(
      JSON.stringify(value.questions),
    ) as Database['public']['Functions']['create_quiz']['Args']['quiz_questions'],
    correlation_id: crypto.randomUUID(),
  });
  if (error || !data) {
    const code = failureCode(error);
    if (code === '42501')
      return {
        ok: false,
        code: 'forbidden',
        message: 'You do not manage every selected tag.',
      };
    return {
      ok: false,
      code: 'failed',
      message: errorMessage(error, 'The quiz could not be created.'),
    };
  }
  return { ok: true, quiz: { id: data.id } };
}

/** Submits answers against a quiz via the audited, server-graded RPC. */
export async function submitQuizAttempt(
  client: Client,
  input: unknown,
): Promise<QuizActionResult> {
  const value = record(input);
  if (!value || typeof value.quizId !== 'string' || !UUID.test(value.quizId)) {
    return { ok: false, code: 'invalid_input', message: 'Quiz ID is invalid.' };
  }
  const answers = record(value.answers);
  if (!answers)
    return {
      ok: false,
      code: 'invalid_input',
      message: 'Answers must be an object.',
    };

  const { error } = await client.rpc('submit_quiz_attempt', {
    target_quiz_id: value.quizId,
    submitted_answers: JSON.parse(
      JSON.stringify(answers),
    ) as Database['public']['Functions']['submit_quiz_attempt']['Args']['submitted_answers'],
    correlation_id: crypto.randomUUID(),
  });
  if (!error) return { ok: true };
  const code = failureCode(error);
  switch (code) {
    case '42501':
      return {
        ok: false,
        code: 'forbidden',
        message: 'You are not authorized to take this quiz.',
      };
    case 'P0002':
      return {
        ok: false,
        code: 'not_found',
        message: 'The quiz was not found.',
      };
    case '55000':
      return {
        ok: false,
        code: 'not_ready',
        message: errorMessage(error, 'This attempt could not be accepted.'),
      };
    default:
      return {
        ok: false,
        code: 'failed',
        message: 'The attempt could not be submitted.',
      };
  }
}
