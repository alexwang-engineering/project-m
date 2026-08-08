import 'server-only';

import DOMPurify, { type Config } from 'isomorphic-dompurify';

const SANITIZE_OPTIONS: Config = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'u', 's', 'blockquote', 'pre', 'code',
    'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'a', 'table', 'thead',
    'tbody', 'tr', 'th', 'td', 'hr', 'span', 'sub', 'sup',
  ],
  ALLOWED_ATTR: ['href', 'title', 'colspan', 'rowspan', 'scope'],
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  FORBID_TAGS: ['script', 'style', 'svg', 'math', 'iframe', 'object', 'embed'],
  FORBID_ATTR: ['style', 'srcset', 'formaction', 'target'],
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
  RETURN_TRUSTED_TYPE: false,
};

/** Sanitises an HTML fragment using Project M's WYSIWYG allow-list. */
export function sanitizeEditorHtml(html: string): string {
  if (typeof html !== 'string') {
    throw new TypeError('Editor HTML must be a string.');
  }

  return DOMPurify.sanitize(html, SANITIZE_OPTIONS);
}

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

/** Throws a generic authorization error suitable for an API 403 response. */
export function assertTagAccess(
  userTags: readonly string[],
  requiredTags: readonly string[],
): void {
  if (!verifyTagAccess(userTags, requiredTags)) {
    throw new TagAccessDeniedError();
  }
}

export class TagAccessDeniedError extends Error {
  readonly statusCode = 403;

  constructor() {
    super('You do not have permission to edit this page.');
    this.name = 'TagAccessDeniedError';
  }
}
