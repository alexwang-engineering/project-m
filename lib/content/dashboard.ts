import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';

type Client = SupabaseClient<Database>;

export interface PageSummaryTag {
  readonly name: string;
  readonly displayName: string;
}

/** Stable server-to-UI contract for an authorized dashboard page card. */
export interface PageSummary {
  readonly kind: 'page';
  readonly id: string;
  readonly title: string;
  readonly canonicalUrl: string;
  readonly updatedAt: string;
  readonly tags: readonly PageSummaryTag[];
}

/**
 * Lists a compact, bounded page feed. Supabase RLS is authoritative, so pages
 * outside the current principal's audience never enter the projection.
 */
export async function listDashboardPages(
  client: Client,
  requestedLimit = 12,
): Promise<readonly PageSummary[]> {
  if (
    !Number.isSafeInteger(requestedLimit) ||
    requestedLimit < 1 ||
    requestedLimit > 24
  ) {
    throw new RangeError('Dashboard page limit must be between 1 and 24.');
  }

  const { data, error } = await client
    .from('pages')
    .select(
      'id, title, canonical_url, updated_at, page_tags(tags!inner(tag_name, display_name))',
    )
    .eq('lifecycle', 'published')
    .order('updated_at', { ascending: false })
    .limit(requestedLimit);
  if (error) throw error;

  return (data ?? []).map((page) => ({
    kind: 'page',
    id: page.id,
    title: page.title,
    canonicalUrl: page.canonical_url,
    updatedAt: page.updated_at,
    tags: page.page_tags
      .map(({ tags }) => tags)
      .filter((tag): tag is NonNullable<typeof tag> => tag !== null)
      .map((tag) => ({ name: tag.tag_name, displayName: tag.display_name })),
  }));
}
