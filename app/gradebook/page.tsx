import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';

import GradebookView from '@/components/gradebook/GradebookView';
import { createServerClient } from '@/lib/supabase/server';
import { getGradebook } from '@/lib/content/gradebook';
import type { Database } from '@/lib/database.types';

export default async function GradebookPage() {
  const supabase = (await createServerClient()) as SupabaseClient<Database>;
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/');

  const gradebook = await getGradebook(supabase);
  return <GradebookView data={gradebook} />;
}
