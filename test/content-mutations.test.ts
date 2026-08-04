import { webcrypto } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { Database } from '@/lib/database.types';
import {
  createPage,
  setPageLifecycle,
  updatePage,
} from '@/lib/content/mutations';

beforeAll(() => {
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: webcrypto,
  });
});

function clientReturning(data: unknown, error: { code: string } | null = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  return { client: { rpc } as unknown as SupabaseClient<Database>, rpc };
}

const valid = {
  title: 'Mechanisms',
  slug: 'mechanisms',
  parentId: null,
  tagIds: ['10000000-0000-4000-8000-000000000001'],
  content: {
    schemaVersion: 1,
    blocks: [
      { id: 'p1', type: 'paragraph', html: '<p>Safe<script>x</script></p>' },
    ],
  },
};

describe('content mutations', () => {
  it('sanitizes rich HTML before invoking the atomic create RPC', async () => {
    const { client, rpc } = clientReturning({
      id: 'page',
      canonical_url: '/mechanisms',
      version: 1,
    });
    await expect(createPage(client, valid)).resolves.toMatchObject({
      ok: true,
    });
    expect(rpc).toHaveBeenCalledWith(
      'create_page',
      expect.objectContaining({
        page_content: expect.objectContaining({
          blocks: [expect.objectContaining({ html: '<p>Safe</p>' })],
        }),
      }),
    );
  });

  it('rejects malformed inputs without touching the database', async () => {
    const { client, rpc } = clientReturning(null);
    await expect(
      createPage(client, { ...valid, tagIds: [] }),
    ).resolves.toMatchObject({
      ok: false,
      code: 'invalid_input',
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps optimistic conflicts to a safe result', async () => {
    const { client } = clientReturning(null, { code: '40001' });
    await expect(
      updatePage(client, {
        ...valid,
        pageId: '20000000-0000-4000-8000-000000000001',
        expectedVersion: 3,
      }),
    ).resolves.toEqual({
      ok: false,
      code: 'conflict',
      message: 'The page changed or its URL is already in use.',
    });
  });

  it('delegates lifecycle authorization and auditing to the database RPC', async () => {
    const { client, rpc } = clientReturning({
      id: 'page',
      canonical_url: '/mechanisms',
      version: 4,
    });
    await expect(
      setPageLifecycle(client, {
        pageId: '20000000-0000-4000-8000-000000000001',
        expectedVersion: 3,
        nextState: 'published',
        makePublic: false,
      }),
    ).resolves.toMatchObject({ ok: true, page: { version: 4 } });
    expect(rpc).toHaveBeenCalledWith(
      'set_page_lifecycle',
      expect.objectContaining({ next_state: 'published', make_public: false }),
    );
  });

  it('rejects malformed lifecycle requests before invoking the database', async () => {
    const { client, rpc } = clientReturning(null);
    await expect(
      setPageLifecycle(client, {
        pageId: '20000000-0000-4000-8000-000000000001',
        expectedVersion: 3,
        nextState: 'deleted',
        makePublic: false,
      }),
    ).resolves.toMatchObject({ ok: false, code: 'invalid_input' });
    expect(rpc).not.toHaveBeenCalled();
  });
});
