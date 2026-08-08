import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createServerClient } from '@/lib/supabase/server';
import { listWritableTags } from '@/lib/content/pages-editor';
import { listBankItems } from '@/lib/content/question-bank';
import { isInstitutionAdmin } from '@/lib/content/admin';
import { QuestionBankView } from '@/components/question-bank/QuestionBankView';
import type { Database } from '@/lib/database.types';

export default async function QuestionBankPage() {
  const supabase = (await createServerClient()) as SupabaseClient<Database>;
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/');

  const [items, writableTags, admin] = await Promise.all([
    listBankItems(supabase),
    listWritableTags(supabase),
    isInstitutionAdmin(supabase),
  ]);
  if (!admin && writableTags.length === 0) redirect('/quizzes');
  return <QuestionBankView items={items} writableTags={writableTags} />;
}
