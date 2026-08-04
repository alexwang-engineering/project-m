import { webcrypto } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { Database } from '@/lib/database.types';
import { restorePageRevision } from '@/lib/content/revisions';

beforeAll(() =>
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: webcrypto,
  }),
);

const input = {
  pageId: '10000000-0000-4000-8000-000000000001',
  revisionId: '20000000-0000-4000-8000-000000000001',
  expectedVersion: 4,
};

describe('page revision restore', () => {
  it('uses the optimistic audited RPC and returns the new version', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { id: input.pageId, canonical_url: '/lesson', version: 5 },
      error: null,
    });
    const client = { rpc } as unknown as SupabaseClient<Database>;
    await expect(restorePageRevision(client, input)).resolves.toMatchObject({
      ok: true,
      page: { version: 5 },
    });
    expect(rpc).toHaveBeenCalledWith(
      'restore_page_revision',
      expect.objectContaining({ expected_version: 4 }),
    );
  });

  it('does not call the database for malformed identifiers', async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as SupabaseClient<Database>;
    await expect(
      restorePageRevision(client, { ...input, revisionId: '../revision' }),
    ).resolves.toMatchObject({ ok: false, code: 'invalid_input' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps concurrent edits without exposing database details', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { code: '40001' } }),
    } as unknown as SupabaseClient<Database>;
    await expect(restorePageRevision(client, input)).resolves.toEqual({
      ok: false,
      code: 'conflict',
      message: 'The page changed before it could be restored.',
    });
  });
});
