import { redirect } from 'next/navigation';

import { RecentlyDeletedView } from '@/components/resources/RecentlyDeletedView';
import { getCurrentUserSummary } from '@/lib/content/dashboard';
import { listRecentlyDeleted } from '@/lib/content/recently-deleted';
import { createServerClient } from '@/lib/supabase/server';

export default async function RecentlyDeletedPage() {
  const client = await createServerClient();
  const user = await getCurrentUserSummary(client);
  if (!user) redirect('/auth/login');
  if (user.role === 'student') redirect('/resources');
  return <RecentlyDeletedView items={await listRecentlyDeleted(client)} />;
}
