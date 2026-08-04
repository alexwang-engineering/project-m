import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import type { PageMutationResult } from '@/lib/content/mutations';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Restores an immutable snapshot as a new draft through the audited database boundary. */
export async function restorePageRevision(
  client: SupabaseClient<Database>,
  input: unknown,
): Promise<PageMutationResult> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      ok: false,
      code: 'invalid_input',
      message: 'Restore input must be an object.',
    };
  }
  const value = input as Record<string, unknown>;
  if (typeof value.pageId !== 'string' || !UUID.test(value.pageId)) {
    return { ok: false, code: 'invalid_input', message: 'Page ID is invalid.' };
  }
  if (typeof value.revisionId !== 'string' || !UUID.test(value.revisionId)) {
    return {
      ok: false,
      code: 'invalid_input',
      message: 'Revision ID is invalid.',
    };
  }
  if (
    !Number.isSafeInteger(value.expectedVersion) ||
    (value.expectedVersion as number) < 1
  ) {
    return {
      ok: false,
      code: 'invalid_input',
      message: 'Expected page version is invalid.',
    };
  }
  const { data, error } = await client.rpc('restore_page_revision', {
    target_page_id: value.pageId,
    target_revision_id: value.revisionId,
    expected_version: value.expectedVersion as number,
    correlation_id: crypto.randomUUID(),
  });
  if (error || !data) {
    const code = error?.code;
    if (code === '42501')
      return {
        ok: false,
        code: 'forbidden',
        message: 'You do not have permission to restore this page.',
      };
    if (code === '40001')
      return {
        ok: false,
        code: 'conflict',
        message: 'The page changed before it could be restored.',
      };
    if (code === 'P0002')
      return {
        ok: false,
        code: 'not_found',
        message: 'The page revision was not found.',
      };
    return {
      ok: false,
      code: 'failed',
      message: 'The page revision could not be restored.',
    };
  }
  return {
    ok: true,
    page: {
      id: data.id,
      canonicalUrl: data.canonical_url,
      version: data.version,
    },
  };
}
