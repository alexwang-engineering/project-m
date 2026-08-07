import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createServerClient } from '@/lib/supabase/server';
import { listAnnouncements } from '@/lib/content/announcements';
import { listWritableTags } from '@/lib/content/pages-editor';
import { isInstitutionAdmin } from '@/lib/content/admin';
import { AnnouncementsView } from '@/components/announcements/AnnouncementsView';
import type { Database } from '@/lib/database.types';

export default async function AnnouncementsPage() {
  const supabase = (await createServerClient()) as SupabaseClient<Database>;
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/');

  const [announcements, writableTags, admin] = await Promise.all([
    listAnnouncements(supabase),
    listWritableTags(supabase),
    isInstitutionAdmin(supabase),
  ]);

  return (
    <AnnouncementsView
      announcements={announcements}
      writableTags={writableTags}
      currentUserId={data.user.id}
      isAdmin={admin}
    />
  );
}
