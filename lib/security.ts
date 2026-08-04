import 'server-only';

import DOMPurify, { type Config } from 'isomorphic-dompurify';

export type SanitizableJson =
  | null
  | boolean
  | number
  | string
  | SanitizableJson[]
  | { [key: string]: SanitizableJson };

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

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

/**
 * Deeply clones and sanitises a JSON-compatible block-editor payload.
 *
 * Every string is treated as potentially renderable HTML. Prototype-pollution
 * keys, non-finite numbers, unsupported values, excessive nesting, and cyclic
 * data are rejected rather than silently persisted.
 *
 * @deprecated Do not use this on structured editor data. It sanitises IDs,
 * URLs, filenames, code, and discriminators as if they were HTML. P1-04 must
 * validate the versioned block union and sanitize only rich-HTML fields before
 * any production write route imports this module.
 */
export function sanitizeEditorPayload<T extends SanitizableJson>(
  payload: T,
  maxDepth = 50,
): T {
  if (!Number.isSafeInteger(maxDepth) || maxDepth < 1) {
    throw new RangeError('maxDepth must be a positive safe integer.');
  }

  const ancestors = new WeakSet<object>();

  const visit = (value: unknown, depth: number): SanitizableJson => {
    if (depth > maxDepth) {
      throw new RangeError(`Editor payload exceeds the maximum depth of ${maxDepth}.`);
    }
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'string') return sanitizeEditorHtml(value);
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new TypeError('Payload numbers must be finite.');
      return value;
    }
    if (typeof value !== 'object') {
      throw new TypeError(`Unsupported editor payload value: ${typeof value}.`);
    }
    if (ancestors.has(value)) throw new TypeError('Editor payload must not be cyclic.');

    ancestors.add(value);
    try {
      if (Array.isArray(value)) {
        return value.map((item) => visit(item, depth + 1));
      }

      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new TypeError('Editor payload objects must be plain objects.');
      }

      const clean: Record<string, SanitizableJson> = Object.create(null);
      for (const [key, child] of Object.entries(value)) {
        if (FORBIDDEN_KEYS.has(key)) {
          throw new TypeError(`Forbidden editor payload key: ${key}.`);
        }
        clean[key] = visit(child, depth + 1);
      }
      return clean;
    } finally {
      ancestors.delete(value);
    }
  };

  return visit(payload, 0) as T;
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
