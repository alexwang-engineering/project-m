// Deliberately no `import 'server-only'` here - see the same note in
// lib/files/scanner.ts. This module is imported by scripts/verify-uploads.ts
// (a plain Node/tsx CLI, outside Next's bundler) and is never imported by
// anything under app/ or components/; that non-import is what actually
// keeps it unreachable from the browser, not this marker package.
import { createHash, timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import { unpackMpx, MpxFormatError } from '@/lib/mpx-packager';
import type { MalwareScanner } from '@/lib/files/scanner';

type Client = SupabaseClient<Database>;

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export interface ClaimedFile {
  readonly id: string;
  readonly bucketId: string;
  readonly objectName: string;
  readonly originalName: string;
  readonly mediaType: string;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly ownerId: string;
}

export interface VerificationOutcome {
  readonly fileId: string;
  readonly result: 'ready' | 'quarantined' | 'failed';
  readonly reason?: string;
}

function matchesBytes(
  bytes: Uint8Array,
  offset: number,
  expected: readonly number[],
): boolean {
  if (bytes.length < offset + expected.length) return false;
  return expected.every((byte, i) => bytes[offset + i] === byte);
}

function matchesAscii(
  bytes: Uint8Array,
  offset: number,
  expected: string,
): boolean {
  return matchesBytes(
    bytes,
    offset,
    Array.from(expected, (c) => c.charCodeAt(0)),
  );
}

function isZipSignature(bytes: Uint8Array): boolean {
  return (
    matchesBytes(bytes, 0, [0x50, 0x4b, 0x03, 0x04]) ||
    matchesBytes(bytes, 0, [0x50, 0x4b, 0x05, 0x06])
  );
}

/**
 * Real magic-byte signature checks, never the filename/extension or the
 * browser's declared MIME type. `.mpx`/zip is handled separately below
 * since it needs the existing bounded MPX validator, not just a signature.
 */
const SIGNATURE_CHECKS: Readonly<
  Record<string, (bytes: Uint8Array) => boolean>
> = {
  'application/pdf': (b) => matchesAscii(b, 0, '%PDF-'),
  'image/png': (b) =>
    matchesBytes(b, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  'image/jpeg': (b) => matchesBytes(b, 0, [0xff, 0xd8, 0xff]),
  'image/gif': (b) =>
    matchesAscii(b, 0, 'GIF87a') || matchesAscii(b, 0, 'GIF89a'),
  'image/webp': (b) => matchesAscii(b, 0, 'RIFF') && matchesAscii(b, 8, 'WEBP'),
};

const MPX_MEDIA_TYPES: readonly string[] = [
  'application/zip',
  'application/octet-stream',
];

/**
 * Atomically claims one pending file for scanning. The conditional UPDATE
 * (`eq('state', 'pending')`) is what makes this race-safe: if two worker
 * runs overlap, only one's UPDATE affects the row - the other's affects
 * zero rows and this returns null, exactly like a normal SQL row lock
 * without needing one.
 */
export async function claimNextPendingFile(
  serviceClient: Client,
): Promise<ClaimedFile | null> {
  const { data: candidates, error: listError } = await serviceClient
    .from('files')
    .select('id')
    .eq('state', 'pending')
    .order('created_at', { ascending: true })
    .limit(1);
  if (listError) throw listError;
  const candidate = candidates?.[0];
  if (!candidate) return null;

  const { data: claimed, error: claimError } = await serviceClient
    .from('files')
    .update({ state: 'scanning' })
    .eq('id', candidate.id)
    .eq('state', 'pending')
    .select(
      'id, bucket_id, object_name, original_name, media_type, size_bytes, sha256, owner_id',
    )
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return null;

  return {
    id: claimed.id,
    bucketId: claimed.bucket_id,
    objectName: claimed.object_name,
    originalName: claimed.original_name,
    mediaType: claimed.media_type,
    sizeBytes: claimed.size_bytes,
    sha256: claimed.sha256,
    ownerId: claimed.owner_id,
  };
}

async function transitionTo(
  serviceClient: Client,
  fileId: string,
  state: 'ready' | 'quarantined' | 'failed',
  quarantineReason: string | null,
): Promise<void> {
  const { error } = await serviceClient
    .from('files')
    .update({
      state,
      scanned_at: new Date().toISOString(),
      quarantine_reason: state === 'quarantined' ? quarantineReason : null,
    })
    .eq('id', fileId)
    .eq('state', 'scanning');
  if (error) throw error;
}

async function writeAudit(
  serviceClient: Client,
  claimed: ClaimedFile,
  outcome: 'ready' | 'quarantined' | 'failed',
  reason: string | null,
): Promise<void> {
  const { error } = await serviceClient.from('audit_events').insert({
    actor_id: null,
    action: `file.verification.${outcome}`,
    target_type: 'file',
    target_id: claimed.id,
    correlation_id: crypto.randomUUID(),
    source: 'verification-worker',
    before_data: { state: 'scanning' },
    after_data: reason ? { state: outcome, reason } : { state: outcome },
  });
  if (error) throw error;
}

/**
 * Runs the real verification a claimed file needs before anything may
 * treat it as safe to serve: re-download the bytes, recompute the
 * checksum, validate a real signature (never the declared filename/MIME),
 * and run a malware scan. Every negative path transitions to `failed` or
 * `quarantined` and writes an audit event - nothing is left silently
 * `scanning` forever.
 */
export async function verifyClaimedFile(
  serviceClient: Client,
  claimed: ClaimedFile,
  scanner: MalwareScanner,
): Promise<VerificationOutcome> {
  const fail = async (reason: string): Promise<VerificationOutcome> => {
    await transitionTo(serviceClient, claimed.id, 'failed', null);
    await writeAudit(serviceClient, claimed, 'failed', reason);
    return { fileId: claimed.id, result: 'failed', reason };
  };
  const quarantine = async (reason: string): Promise<VerificationOutcome> => {
    await transitionTo(serviceClient, claimed.id, 'quarantined', reason);
    await writeAudit(serviceClient, claimed, 'quarantined', reason);
    return { fileId: claimed.id, result: 'quarantined', reason };
  };

  if (claimed.sizeBytes > MAX_FILE_BYTES) {
    return fail('Declared size exceeds the 25 MiB limit.');
  }

  const { data: blob, error: downloadError } = await serviceClient.storage
    .from(claimed.bucketId)
    .download(claimed.objectName);
  if (downloadError || !blob) {
    return fail(
      'The stored object could not be downloaded (missing or inaccessible).',
    );
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.byteLength > MAX_FILE_BYTES) {
    return fail('The stored object exceeds the 25 MiB limit.');
  }
  if (bytes.byteLength !== claimed.sizeBytes) {
    return fail(
      'The stored object size does not match what was declared at upload time.',
    );
  }

  const digest = createHash('sha256').update(bytes).digest();
  const declared = Buffer.from(claimed.sha256, 'hex');
  if (digest.length !== declared.length || !timingSafeEqual(digest, declared)) {
    return fail(
      'The stored object does not match the declared SHA-256 checksum.',
    );
  }

  if (MPX_MEDIA_TYPES.includes(claimed.mediaType)) {
    if (!isZipSignature(bytes)) {
      return fail('File does not have a valid ZIP/MPX signature.');
    }
    try {
      const archive = new File([bytes], claimed.originalName, {
        type: claimed.mediaType,
      });
      await unpackMpx(archive);
    } catch (error) {
      return fail(
        error instanceof MpxFormatError
          ? error.message
          : 'MPX archive failed validation.',
      );
    }
  } else {
    const checkSignature = SIGNATURE_CHECKS[claimed.mediaType];
    if (!checkSignature) {
      return fail(
        `No signature check is defined for media type "${claimed.mediaType}".`,
      );
    }
    if (!checkSignature(bytes)) {
      return fail('File signature does not match the declared media type.');
    }
  }

  const scanResult = await scanner.scan(bytes, claimed.mediaType);
  if (!scanResult.clean) {
    return quarantine(scanResult.reason ?? 'Failed malware scan.');
  }

  await transitionTo(serviceClient, claimed.id, 'ready', null);
  await writeAudit(serviceClient, claimed, 'ready', null);
  return { fileId: claimed.id, result: 'ready' };
}
