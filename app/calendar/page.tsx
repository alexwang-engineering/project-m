import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createServerClient } from '@/lib/supabase/server';
import { listUpcoming } from '@/lib/content/calendar';
import { listWritableTags } from '@/lib/content/pages-editor';
import { isInstitutionAdmin } from '@/lib/content/admin';
import { CalendarView } from '@/components/calendar/CalendarView';
import type { Database } from '@/lib/database.types';

export default async function CalendarPage() {
  const supabase = (await createServerClient()) as SupabaseClient<Database>;
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/');

  const [items, writableTags, admin] = await Promise.all([
    listUpcoming(supabase),
    listWritableTags(supabase),
    isInstitutionAdmin(supabase),
  ]);

  return <CalendarView items={items} writableTags={writableTags} currentUserId={data.user.id} isAdmin={admin} />;
}
