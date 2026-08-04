import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database, Json } from '@/lib/database.types';
import { parseEditorDocument } from '@/lib/content/schema';

type Client = SupabaseClient<Database>;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface PageMutationSuccess {
  readonly ok: true;
  readonly page: {
    readonly id: string;
    readonly canonicalUrl: string;
    readonly version: number;
  };
}

export interface PageMutationFailure {
  readonly ok: false;
  readonly code:
    'invalid_input' | 'forbidden' | 'conflict' | 'not_found' | 'failed';
  readonly message: string;
}

export type PageMutationResult = PageMutationSuccess | PageMutationFailure;

export type PageLifecycleState = Database['public']['Enums']['content_state'];

interface ValidatedPageInput {
  title: string;
  slug: string;
  parentId: string | null;
  content: Json;
  tagIds: string[];
}

function invalid(message: string): PageMutationFailure {
  return { ok: false, code: 'invalid_input', message };
}

function object(input: unknown): Record<string, unknown> | null {
  return input !== null &&
    typeof input === 'object' &&
    !Array.isArray(input) &&
    (Object.getPrototypeOf(input) === Object.prototype ||
      Object.getPrototypeOf(input) === null)
    ? (input as Record<string, unknown>)
    : null;
}

function validatePageInput(
  input: unknown,
): ValidatedPageInput | PageMutationFailure {
  const value = object(input);
  if (!value) return invalid('Page input must be an object.');
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  if (!title || title.length > 240)
    return invalid('Title must be between 1 and 240 characters.');
  if (typeof value.slug !== 'string' || !SLUG.test(value.slug))
    return invalid('Slug has an invalid format.');
  const parentId =
    value.parentId === null || value.parentId === undefined
      ? null
      : value.parentId;
  if (
    parentId !== null &&
    (typeof parentId !== 'string' || !UUID.test(parentId))
  ) {
    return invalid('Parent page ID must be a UUID or null.');
  }
  if (
    !Array.isArray(value.tagIds) ||
    value.tagIds.length < 1 ||
    value.tagIds.length > 100
  ) {
    return invalid('Between 1 and 100 audience tags are required.');
  }
  const tagIds = value.tagIds.filter(
    (tag): tag is string => typeof tag === 'string',
  );
  if (
    tagIds.length !== value.tagIds.length ||
    tagIds.some((tag) => !UUID.test(tag))
  ) {
    return invalid('Every audience tag ID must be a UUID.');
  }
  if (new Set(tagIds.map((tag) => tag.toLowerCase())).size !== tagIds.length) {
    return invalid('Audience tag IDs must be unique.');
  }
  try {
    const document = parseEditorDocument(value.content);
    return {
      title,
      slug: value.slug,
      parentId,
      content: JSON.parse(JSON.stringify(document)) as Json,
      tagIds,
    };
  } catch {
    return invalid('Page content is invalid.');
  }
}

function databaseFailure(error: { code?: string } | null): PageMutationFailure {
  switch (error?.code) {
    case '42501':
      return {
        ok: false,
        code: 'forbidden',
        message: 'You do not have permission to change this page.',
      };
    case '40001':
    case '23505':
      return {
        ok: false,
        code: 'conflict',
        message: 'The page changed or its URL is already in use.',
      };
    case 'P0002':
      return {
        ok: false,
        code: 'not_found',
        message: 'The page was not found.',
      };
    default:
      return {
        ok: false,
        code: 'failed',
        message: 'The page could not be saved.',
      };
  }
}

type NullableParentArgs = Omit<
  Database['public']['Functions']['create_page']['Args'],
  'page_parent_id'
> & {
  page_parent_id: string | null;
};

async function createPageRpc(client: Client, args: NullableParentArgs) {
  // postgres-meta cannot express nullable RPC parameters, although PostgreSQL
  // UUID parameters accept NULL. Keep this one generator mismatch localized.
  return client.rpc(
    'create_page',
    args as Database['public']['Functions']['create_page']['Args'],
  );
}

/** Validates, sanitizes, and atomically creates a draft page under database authorization. */
export async function createPage(
  client: Client,
  input: unknown,
): Promise<PageMutationResult> {
  const parsed = validatePageInput(input);
  if ('ok' in parsed) return parsed;
  const { data, error } = await createPageRpc(client, {
    page_title: parsed.title,
    page_slug: parsed.slug,
    page_parent_id: parsed.parentId,
    page_content: parsed.content,
    page_content_schema_version: 1,
    audience_tag_ids: parsed.tagIds,
    correlation_id: crypto.randomUUID(),
  });
  if (error || !data) return databaseFailure(error);
  return {
    ok: true,
    page: {
      id: data.id,
      canonicalUrl: data.canonical_url,
      version: data.version,
    },
  };
}

/** Validates, sanitizes, and updates a page using optimistic concurrency. */
export async function updatePage(
  client: Client,
  input: unknown,
): Promise<PageMutationResult> {
  const value = object(input);
  if (!value || typeof value.pageId !== 'string' || !UUID.test(value.pageId))
    return invalid('Page ID is invalid.');
  if (
    !Number.isSafeInteger(value.expectedVersion) ||
    (value.expectedVersion as number) < 1
  ) {
    return invalid('Expected page version is invalid.');
  }
  const parsed = validatePageInput(value);
  if ('ok' in parsed) return parsed;
  const args = {
    target_page_id: value.pageId,
    expected_version: value.expectedVersion as number,
    page_title: parsed.title,
    page_slug: parsed.slug,
    page_parent_id: parsed.parentId,
    page_content: parsed.content,
    page_content_schema_version: 1,
    audience_tag_ids: parsed.tagIds,
    correlation_id: crypto.randomUUID(),
  };
  const { data, error } = await client.rpc(
    'update_page',
    args as Database['public']['Functions']['update_page']['Args'],
  );
  if (error || !data) return databaseFailure(error);
  return {
    ok: true,
    page: {
      id: data.id,
      canonicalUrl: data.canonical_url,
      version: data.version,
    },
  };
}

/**
 * Moves a page through the shared draft/published/archived lifecycle.
 *
 * Authorization, transition concurrency, revision creation, and audit logging
 * remain authoritative in PostgreSQL. Public visibility is meaningful only for
 * published pages and is forced off by the database for every other state.
 */
export async function setPageLifecycle(
  client: Client,
  input: unknown,
): Promise<PageMutationResult> {
  const value = object(input);
  if (!value || typeof value.pageId !== 'string' || !UUID.test(value.pageId)) {
    return invalid('Page ID is invalid.');
  }
  if (
    !Number.isSafeInteger(value.expectedVersion) ||
    (value.expectedVersion as number) < 1
  ) {
    return invalid('Expected page version is invalid.');
  }
  if (!['draft', 'published', 'archived'].includes(value.nextState as string)) {
    return invalid('Page lifecycle state is invalid.');
  }
  if (typeof value.makePublic !== 'boolean') {
    return invalid('Public visibility must be explicitly true or false.');
  }

  const { data, error } = await client.rpc('set_page_lifecycle', {
    target_page_id: value.pageId,
    expected_version: value.expectedVersion as number,
    next_state: value.nextState as PageLifecycleState,
    make_public: value.makePublic,
    correlation_id: crypto.randomUUID(),
  });
  if (error || !data) return databaseFailure(error);
  return {
    ok: true,
    page: {
      id: data.id,
      canonicalUrl: data.canonical_url,
      version: data.version,
    },
  };
}
