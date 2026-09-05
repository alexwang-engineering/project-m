import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import { labelsFromTag } from '@/lib/resource-metadata';

type Client = SupabaseClient<Database>;

export interface ResourceSummary {
  readonly id: string;
  readonly type: 'page' | 'quiz';
  readonly title: string;
  readonly href: string;
  readonly manageHref: string | null;
  readonly lifecycle: 'draft' | 'published';
  readonly updatedAt: string;
  readonly tags: readonly { name: string; displayName: string }[];
  readonly subject: string;
  readonly year: string;
}

/** Returns one bounded RLS-filtered projection used by both resource layouts. */
export async function listResources(
  client: Client,
  role: 'admin' | 'teacher' | 'student',
  managedTagIds: ReadonlySet<string>,
): Promise<readonly ResourceSummary[]> {
  const [
    { data: pages, error: pageError },
    { data: quizzes, error: quizError },
  ] = await Promise.all([
    client
      .from('pages')
      .select(
        'id,title,canonical_url,lifecycle,updated_at,page_tags(tag_id,tags!inner(tag_name,display_name))',
      )
      .neq('lifecycle', 'archived')
      .order('updated_at', { ascending: false })
      .limit(100),
    client
      .from('quizzes')
      .select(
        'id,title,created_at,quiz_tags(tag_id,tags!inner(tag_name,display_name))',
      )
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);
  if (pageError) throw pageError;
  if (quizError) throw quizError;

  const canManage = (tagIds: readonly string[]) =>
    role === 'admin' ||
    (role === 'teacher' &&
      tagIds.length > 0 &&
      tagIds.every((id) => managedTagIds.has(id)));
  const tagData = (
    rows: readonly {
      tag_id: string;
      tags: { tag_name: string; display_name: string } | null;
    }[],
  ) =>
    rows.flatMap((row) =>
      row.tags
        ? [{ name: row.tags.tag_name, displayName: row.tags.display_name }]
        : [],
    );
  const metadata = (tags: readonly { name: string }[]) =>
    labelsFromTag(tags[0]?.name ?? '');

  return [
    ...(pages ?? []).map((page): ResourceSummary => {
      const tags = tagData(page.page_tags);
      return {
        id: page.id,
        type: 'page',
        title: page.title,
        href: page.canonical_url,
        manageHref: canManage(page.page_tags.map((row) => row.tag_id))
          ? `/pages/${page.id}/edit`
          : null,
        lifecycle: page.lifecycle === 'draft' ? 'draft' : 'published',
        updatedAt: page.updated_at,
        tags,
        ...metadata(tags),
      };
    }),
    ...(quizzes ?? []).map((quiz): ResourceSummary => {
      const tags = tagData(quiz.quiz_tags);
      return {
        id: quiz.id,
        type: 'quiz',
        title: quiz.title,
        href: `/quizzes/${quiz.id}`,
        manageHref: canManage(quiz.quiz_tags.map((row) => row.tag_id))
          ? `/quizzes/${quiz.id}`
          : null,
        lifecycle: 'published',
        updatedAt: quiz.created_at,
        tags,
        ...metadata(tags),
      };
    }),
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
