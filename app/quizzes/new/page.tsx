import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createServerClient } from '@/lib/supabase/server';
import { listWritableTags } from '@/lib/content/pages-editor';
import { QuizEditor } from '@/components/quizzes/QuizEditor';
import type { Database } from '@/lib/database.types';

export default async function NewQuizPage() {
  const supabase = (await createServerClient()) as SupabaseClient<Database>;
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/');

  const writableTags = await listWritableTags(supabase);
  return <QuizEditor writableTags={writableTags} />;
}
