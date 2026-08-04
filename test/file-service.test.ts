import { webcrypto } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { Database } from '@/lib/database.types';
import {
  attachFileToPage,
  beginFileUpload,
  createFileDownload,
} from '@/lib/files/service';

beforeAll(() =>
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: webcrypto,
  }),
);

function clientWith(
  rpcResult: { data: unknown; error: { code?: string } | null },
  signedUrl = 'https://example.test/file',
) {
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  const createSignedUrl = vi
    .fn()
    .mockResolvedValue({ data: { signedUrl }, error: null });
  const client = {
    rpc,
    storage: { from: vi.fn(() => ({ createSignedUrl })) },
  } as unknown as SupabaseClient<Database>;
  return { client, rpc, createSignedUrl };
}

const checksum = 'a'.repeat(64);

describe('private file service', () => {
  it('creates bounded pending upload metadata', async () => {
    const { client, rpc } = clientWith({
      data: {
        id: 'file',
        bucket_id: 'learning-content',
        object_name: 'owner/file.pdf',
      },
      error: null,
    });
    await expect(
      beginFileUpload(client, {
        filename: 'lesson.pdf',
        mediaType: 'application/pdf',
        sizeBytes: 1024,
        sha256: checksum,
      }),
    ).resolves.toMatchObject({
      ok: true,
      file: { id: 'file', maximumBytes: 25 * 1024 * 1024 },
    });
    expect(rpc).toHaveBeenCalledWith(
      'begin_file_upload',
      expect.objectContaining({ declared_size_bytes: 1024 }),
    );
  });

  it('rejects traversal names and oversized files without an RPC', async () => {
    const { client, rpc } = clientWith({ data: null, error: null });
    await expect(
      beginFileUpload(client, {
        filename: '../lesson.pdf',
        mediaType: 'application/pdf',
        sizeBytes: 26 * 1024 * 1024,
        sha256: checksum,
      }),
    ).resolves.toMatchObject({ ok: false, code: 'invalid_input' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps unverified attachment attempts to a safe state', async () => {
    const { client } = clientWith({ data: null, error: { code: '55000' } });
    await expect(
      attachFileToPage(client, {
        pageId: '10000000-0000-4000-8000-000000000001',
        fileId: '20000000-0000-4000-8000-000000000001',
      }),
    ).resolves.toMatchObject({ ok: false, code: 'not_ready' });
  });

  it('signs only the database-authorized internal object target', async () => {
    const { client, createSignedUrl } = clientWith({
      data: [
        {
          bucket_id: 'learning-content',
          object_name: 'owner/file.pdf',
          original_name: 'Lesson.pdf',
          media_type: 'application/pdf',
          size_bytes: 1024,
        },
      ],
      error: null,
    });
    await expect(
      createFileDownload(client, '20000000-0000-4000-8000-000000000001'),
    ).resolves.toMatchObject({
      ok: true,
      download: { filename: 'Lesson.pdf', expiresInSeconds: 60 },
    });
    expect(createSignedUrl).toHaveBeenCalledWith('owner/file.pdf', 60, {
      download: 'Lesson.pdf',
    });
  });

  it('does not sign a missing or unauthorized file target', async () => {
    const { client, createSignedUrl } = clientWith({ data: [], error: null });
    await expect(
      createFileDownload(client, '20000000-0000-4000-8000-000000000001'),
    ).resolves.toMatchObject({
      ok: false,
      code: 'not_found',
    });
    expect(createSignedUrl).not.toHaveBeenCalled();
  });
});
