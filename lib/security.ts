import 'server-only';

export { sanitizeEditorHtml } from '@/lib/html-sanitizer';

function normaliseTag(tag: string): string | null {
  if (typeof tag !== 'string') return null;
  const normalised = tag.normalize('NFKC').trim().toLocaleUpperCase('en-GB');
  return normalised.length > 0 && normalised.length <= 64 ? normalised : null;
}

/**
 * Returns true only when the user owns every required page tag.
 *
 * Denies empty/invalid tag sets by default. Fetch `userTags` from trusted
 * server-side data (never the request body), and retain Supabase RLS as the
 * authoritative database boundary. Admin bypasses should occur explicitly at
 * the call site after checking the authenticated user's database role.
 */
export function verifyTagAccess(
  userTags: readonly string[],
  requiredTags: readonly string[],
): boolean {
  if (!Array.isArray(userTags) || !Array.isArray(requiredTags)) return false;

  const owned = new Set(userTags.map(normaliseTag).filter((tag): tag is string => tag !== null));
  const required = requiredTags.map(normaliseTag);

  return (
    owned.size > 0 &&
    required.length > 0 &&
    required.every((tag): tag is string => tag !== null && owned.has(tag))
  );
}
