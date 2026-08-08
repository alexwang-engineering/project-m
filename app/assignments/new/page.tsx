import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createServerClient } from '@/lib/supabase/server';
import { listWritableTags } from '@/lib/content/pages-editor';
import { AssignmentEditor } from '@/components/assignments/AssignmentEditor';
import type { Database } from '@/lib/database.types';

export default async function NewAssignmentPage() {
  const supabase = (await createServerClient()) as SupabaseClient<Database>;
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/');

  const writableTags = await listWritableTags(supabase);
  if (writableTags.length === 0) redirect('/assignments');
  return <AssignmentEditor writableTags={writableTags} />;
}
