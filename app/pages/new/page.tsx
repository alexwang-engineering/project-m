import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createServerClient } from '@/lib/supabase/server';
import { listWritableTags } from '@/lib/content/pages-editor';
import { PageEditor } from '@/components/pages/PageEditor';
import type { Database } from '@/lib/database.types';

export default async function NewPagePage() {
  const supabase = (await createServerClient()) as SupabaseClient<Database>;
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/');

  const writableTags = await listWritableTags(supabase);
  return (
    <PageEditor
      writableTags={writableTags}
      initial={{
        id: null,
        title: '',
        slug: '',
        version: null,
        lifecycle: 'draft',
        tagIds: [],
        blocks: [],
      }}
    />
  );
}
