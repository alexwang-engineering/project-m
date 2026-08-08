import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  claimNextPendingFile,
  verifyClaimedFile,
  type ClaimedFile,
} from '@/lib/files/verification-worker';
import type { MalwareScanner } from '@/lib/files/scanner';

const PDF_BYTES = new TextEncoder().encode(
  '%PDF-1.4 fake but signature-valid content for tests',
);

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Minimal fake of the subset of the Supabase client surface the worker uses. */
function makeFakeClient(options: {
  files: Record<string, { state: string }>;
  storageBytes: Record<string, Uint8Array | null>;
}) {
  const rpcCalls: { name: string; args?: Record<string, unknown> }[] = [];

  const client = {
    rpc(name: string, args?: Record<string, unknown>) {
      rpcCalls.push({ name, args });
      return Promise.resolve({ data: undefined, error: null });
    },
    storage: {
      from(bucketId: string) {
        return {
          download(objectName: string) {
            const bytes = options.storageBytes[`${bucketId}/${objectName}`];
            if (!bytes)
              return Promise.resolve({
                data: null,
                error: { message: 'not found' },
              });
            return Promise.resolve({
              data: new Blob([bytes as BlobPart]),
              error: null,
            });
          },
        };
      },
    },
    rpcCalls,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return client;
}

const cleanScanner: MalwareScanner = {
  name: 'clean',
  scan: async () => ({ clean: true }),
};
const dirtyScanner: MalwareScanner = {
  name: 'dirty',
  scan: async () => ({
    clean: false,
    reason: 'Matched test signature EICAR-like-pattern.',
  }),
};

function makeClaimedFile(overrides: Partial<ClaimedFile> = {}): ClaimedFile {
  return {
    id: 'file-1',
    bucketId: 'learning-content',
    objectName: 'pdfs/file-1.pdf',
    originalName: 'test.pdf',
    mediaType: 'application/pdf',
    sizeBytes: PDF_BYTES.byteLength,
    sha256: sha256Hex(PDF_BYTES),
    ownerId: 'owner-1',
    leaseId: '00000000-0000-4000-8000-000000000999',
    ...overrides,
  };
}

describe('verifyClaimedFile', () => {
  it('transitions to ready when bytes match the declared checksum and signature', async () => {
    const claimed = makeClaimedFile();
    const client = makeFakeClient({
      files: {},
      storageBytes: { 'learning-content/pdfs/file-1.pdf': PDF_BYTES },
    });
    const outcome = await verifyClaimedFile(client, claimed, cleanScanner);
    expect(outcome.result).toBe('ready');
    expect(client.rpcCalls[0]).toMatchObject({
      name: 'complete_file_verification',
      args: { target_file_id: 'file-1', outcome: 'ready' },
    });
  });

  it('fails closed on a checksum mismatch (bytes were tampered with after declaration)', async () => {
    const claimed = makeClaimedFile();
    const tampered = new TextEncoder().encode(
      '%PDF-1.4 this is NOT what was declared at upload time',
    );
    const client = makeFakeClient({
      files: {},
      storageBytes: {
        'learning-content/pdfs/file-1.pdf': tampered.slice(
          0,
          claimed.sizeBytes,
        ),
      },
    });
    const outcome = await verifyClaimedFile(client, claimed, cleanScanner);
    expect(outcome.result).toBe('failed');
    expect(outcome.reason).toMatch(/checksum/i);
  });

  it('fails closed when the real bytes do not match the declared signature (renamed .exe as .pdf)', async () => {
    const fakeBytes = new TextEncoder().encode(
      'MZ this is not actually a pdf despite the declared media type',
    );
    const claimed = makeClaimedFile({
      sizeBytes: fakeBytes.byteLength,
      sha256: sha256Hex(fakeBytes),
    });
    const client = makeFakeClient({
      files: {},
      storageBytes: { 'learning-content/pdfs/file-1.pdf': fakeBytes },
    });
    const outcome = await verifyClaimedFile(client, claimed, cleanScanner);
    expect(outcome.result).toBe('failed');
    expect(outcome.reason).toMatch(/signature/i);
  });

  it('fails closed when the declared size exceeds the 25 MiB limit', async () => {
    const claimed = makeClaimedFile({ sizeBytes: 26 * 1024 * 1024 });
    const client = makeFakeClient({ files: {}, storageBytes: {} });
    const outcome = await verifyClaimedFile(client, claimed, cleanScanner);
    expect(outcome.result).toBe('failed');
    expect(outcome.reason).toMatch(/25 MiB/i);
  });

  it('fails closed when the stored object is missing', async () => {
    const claimed = makeClaimedFile();
    const client = makeFakeClient({ files: {}, storageBytes: {} });
    const outcome = await verifyClaimedFile(client, claimed, cleanScanner);
    expect(outcome.result).toBe('failed');
    expect(outcome.reason).toMatch(/downloaded/i);
  });

  it('quarantines a file the scanner rejects, even though checksum and signature are valid', async () => {
    const claimed = makeClaimedFile();
    const client = makeFakeClient({
      files: {},
      storageBytes: { 'learning-content/pdfs/file-1.pdf': PDF_BYTES },
    });
    const outcome = await verifyClaimedFile(client, claimed, dirtyScanner);
    expect(outcome.result).toBe('quarantined');
    expect(outcome.reason).toMatch(/EICAR/i);
  });

  it('never trusts the declared mediaType alone - an unrecognized declared type fails closed rather than skipping the check', async () => {
    const claimed = makeClaimedFile({ mediaType: 'application/x-nonexistent' });
    const client = makeFakeClient({
      files: {},
      storageBytes: { 'learning-content/pdfs/file-1.pdf': PDF_BYTES },
    });
    const outcome = await verifyClaimedFile(client, claimed, cleanScanner);
    expect(outcome.result).toBe('failed');
    expect(outcome.reason).toMatch(/no signature check/i);
  });
});

describe('claimNextPendingFile', () => {
  it('returns the database lease once and then reports an empty queue', async () => {
    let alreadyClaimed = false;
    const client = {
      rpc() {
        if (alreadyClaimed) return Promise.resolve({ data: null, error: null });
        alreadyClaimed = true;
        return Promise.resolve({
          data: {
            id: 'file-1',
            bucket_id: 'learning-content',
            object_name: 'pdfs/file-1.pdf',
            original_name: 'test.pdf',
            media_type: 'application/pdf',
            size_bytes: PDF_BYTES.byteLength,
            sha256: sha256Hex(PDF_BYTES),
            owner_id: 'owner-1',
            verification_lease_id: '00000000-0000-4000-8000-000000000999',
          },
          error: null,
        });
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const first = await claimNextPendingFile(client);
    expect(first?.id).toBe('file-1');
    const second = await claimNextPendingFile(client);
    expect(second).toBeNull();
  });
});
