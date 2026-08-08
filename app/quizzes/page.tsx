import QuizzesView from '@/components/quizzes/QuizzesView';
import { createServerClient } from '@/lib/supabase/server';
import { listQuizzes, type QuizSummary } from '@/lib/content/quizzes';
import { getCurrentUserSummary } from '@/lib/content/dashboard';

/** Fails closed to an empty list when Supabase isn't configured, same as the assignments list. */
async function loadQuizzes(): Promise<{
  quizzes: readonly QuizSummary[];
  canCreate: boolean;
}> {
  try {
    const supabase = await createServerClient();
    const [quizzes, user] = await Promise.all([
      listQuizzes(supabase),
      getCurrentUserSummary(supabase),
    ]);
    return {
      quizzes,
      canCreate: user?.role === 'teacher' || user?.role === 'admin',
    };
  } catch {
    return { quizzes: [], canCreate: false };
  }
}

export default async function QuizzesPage() {
  const { quizzes, canCreate } = await loadQuizzes();
  return <QuizzesView quizzes={quizzes} canCreate={canCreate} />;
}
