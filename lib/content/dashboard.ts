import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';

type Client = SupabaseClient<Database>;

export interface PageSummaryTag {
  readonly name: string;
  readonly displayName: string;
}

export interface CurrentUserSummary {
  readonly email: string;
  readonly role: 'admin' | 'teacher' | 'student';
}

/**
 * The dashboard shell (name/role chip) needs to show who is actually signed
 * in, not a placeholder - it previously never reflected the real session at
 * all. Reads auth.getUser() for the email and role_assignments for the
 * highest currently-valid role (admin > teacher > student); returns null
 * when signed out, which the caller renders as a generic guest state.
 */
export async function getCurrentUserSummary(
  client: Client,
): Promise<CurrentUserSummary | null> {
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user?.email) return null;

  const nowIso = new Date().toISOString();
  const { data } = await client
    .from('role_assignments')
    .select('role')
    .lte('valid_from', nowIso)
    .or(`valid_until.is.null,valid_until.gt.${nowIso}`);
  const roles = new Set((data ?? []).map((row) => row.role));
  const role = roles.has('institution_admin')
    ? 'admin'
    : roles.has('teacher')
      ? 'teacher'
      : 'student';

  return { email: user.email, role };
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
