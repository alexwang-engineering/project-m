import { redirect } from 'next/navigation';

import { ResourcesView } from '@/components/resources/ResourcesView';
import { getCurrentUserSummary } from '@/lib/content/dashboard';
import { listClassTags } from '@/lib/content/classes';
import { listResources } from '@/lib/content/resources';
import { createServerClient } from '@/lib/supabase/server';

export default async function ResourcesPage() {
  const client = await createServerClient();
  const user = await getCurrentUserSummary(client);
  if (!user) redirect('/auth/login');
  const classes = await listClassTags(client, user.role);
  const classIds = classes.map((tag) => tag.id);
  const resources = await listResources(
    client,
    user.role,
    new Set(user.role === 'student' ? [] : classIds),
    user.role === 'admin' ? null : classIds,
  );
  return (
    <ResourcesView resources={resources} role={user.role} classes={classes} />
  );
}
