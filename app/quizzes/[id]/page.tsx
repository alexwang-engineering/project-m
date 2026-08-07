import { notFound } from 'next/navigation';

import QuizDetailView from '@/components/quizzes/QuizDetailView';
import { createServerClient } from '@/lib/supabase/server';
import { getQuizDetail, type QuizDetail } from '@/lib/content/quizzes';

interface QuizDetailPageProps {
  params: Promise<{ id: string }>;
}

/** Fails closed to not-found when Supabase isn't configured, same as the assignment detail page. */
async function loadQuizDetail(id: string): Promise<QuizDetail | null> {
  try {
    const supabase = await createServerClient();
    return await getQuizDetail(supabase, id);
  } catch {
    return null;
  }
}

export default async function QuizDetailPage({ params }: QuizDetailPageProps) {
  const { id } = await params;
  const quiz = await loadQuizDetail(id);
  if (!quiz) notFound();

  return <QuizDetailView quiz={quiz} />;
}
