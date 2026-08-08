import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createServerClient } from '@/lib/supabase/server';
import { listWritableTags } from '@/lib/content/pages-editor';
import { listBankItems } from '@/lib/content/question-bank';
import { QuestionBankView } from '@/components/question-bank/QuestionBankView';
import type { Database } from '@/lib/database.types';

export default async function QuestionBankPage() {
  const supabase = (await createServerClient()) as SupabaseClient<Database>;
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/');

  const [items, writableTags] = await Promise.all([
    listBankItems(supabase),
    listWritableTags(supabase),
  ]);
  return <QuestionBankView items={items} writableTags={writableTags} />;
}
