import QuizzesView from '@/components/quizzes/QuizzesView';
import { createServerClient } from '@/lib/supabase/server';
import { listQuizzes, type QuizSummary } from '@/lib/content/quizzes';

/** Fails closed to an empty list when Supabase isn't configured, same as the assignments list. */
async function loadQuizzes(): Promise<readonly QuizSummary[]> {
  try {
    const supabase = await createServerClient();
    return await listQuizzes(supabase);
  } catch {
    return [];
  }
}

export default async function QuizzesPage() {
  const quizzes = await loadQuizzes();
  return <QuizzesView quizzes={quizzes} />;
}
