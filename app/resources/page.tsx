import { redirect } from 'next/navigation';

import { ResourcesView } from '@/components/resources/ResourcesView';
import { getCurrentUserSummary } from '@/lib/content/dashboard';
import { listWritableTags } from '@/lib/content/pages-editor';
import { listResources } from '@/lib/content/resources';
import { createServerClient } from '@/lib/supabase/server';

export default async function ResourcesPage() {
  const client = await createServerClient();
  const user = await getCurrentUserSummary(client);
  if (!user) redirect('/auth/login');
  const writableTags =
    user.role === 'student' ? [] : await listWritableTags(client);
  const resources = await listResources(
    client,
    user.role,
    new Set(writableTags.map((item) => item.id)),
  );
  return <ResourcesView resources={resources} role={user.role} />;
}
