import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import { listWritableTags, type WritableTag } from '@/lib/content/pages-editor';

/** Class navigation follows current enrolment; authoring and RLS stay authoritative. */
export async function listClassTags(
  client: SupabaseClient<Database>,
  role: 'admin' | 'teacher' | 'student',
): Promise<readonly WritableTag[]> {
  if (role !== 'student') return listWritableTags(client);
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();
  if (authError || !user) return [];
  const now = new Date().toISOString();
  const { data, error } = await client
    .from('tag_memberships')
    .select('tags!inner(id,tag_name,display_name)')
    .eq('profile_id', user.id)
    .eq('membership_role', 'member')
    .eq('tags.is_active', true)
    .lte('valid_from', now)
    .or(`valid_until.is.null,valid_until.gt.${now}`);
  if (error) throw error;
  const classes = new Map<string, WritableTag>();
  for (const { tags: tag } of data ?? []) {
    if (tag)
      classes.set(tag.id, {
        id: tag.id,
        name: tag.tag_name,
        displayName: tag.display_name,
      });
  }
  return [...classes.values()].sort((a, b) => a.name.localeCompare(b.name));
}
