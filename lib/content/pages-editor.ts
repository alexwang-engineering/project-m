import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database, Json } from '@/lib/database.types';
import { parseEditorDocument, type EditorDocumentV1 } from '@/lib/content/schema';

type Client = SupabaseClient<Database>;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface WritableTag {
  readonly id: string;
  readonly name: string;
  readonly displayName: string;
}

/**
 * Tags the current principal may author pages into: teacher/manager
 * membership rows valid right now. `create_page`/`update_page` enforce the
 * same rule authoritatively in Postgres - this is only for populating the
 * tag picker, not a security boundary.
 */
export async function listWritableTags(
  client: Client,
): Promise<readonly WritableTag[]> {
  const { data, error } = await client
    .from('tag_memberships')
    .select('tags!inner(id, tag_name, display_name)')
    .in('membership_role', ['teacher', 'manager'])
    .lte('valid_from', new Date().toISOString())
    .or('valid_until.is.null,valid_until.gt.' + new Date().toISOString());
  if (error) throw error;

  const seen = new Map<string, WritableTag>();
  for (const row of data ?? []) {
    const tag = row.tags;
    if (!tag) continue;
    seen.set(tag.id, {
      id: tag.id,
      name: tag.tag_name,
      displayName: tag.display_name,
    });
  }
  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export interface EditablePage {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly parentId: string | null;
  readonly content: EditorDocumentV1;
  readonly version: number;
  readonly lifecycle: Database['public']['Enums']['content_state'];
  readonly tagIds: readonly string[];
}

/**
 * Loads a page for editing. RLS (`pages_read`) governs what is even
 * visible here; whether the caller may actually save changes is decided
 * authoritatively by `update_page` at save time.
 */
export async function getPageForEdit(
  client: Client,
  pageId: string,
): Promise<EditablePage | null> {
  if (!UUID.test(pageId)) return null;
  const { data, error } = await client
    .from('pages')
    .select(
      'id, title, slug, parent_id, content_json, version, lifecycle, page_tags(tag_id)',
    )
    .eq('id', pageId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    title: data.title,
    slug: data.slug,
    parentId: data.parent_id,
    content: parseEditorDocument(data.content_json as Json),
    version: data.version,
    lifecycle: data.lifecycle,
    tagIds: data.page_tags.map((row) => row.tag_id),
  };
}
