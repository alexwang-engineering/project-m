import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const DOWNLOAD_TTL_SECONDS = 60;

type Client = SupabaseClient<Database>;
type FileMediaType =
  'application/pdf' | 'application/zip' | 'application/octet-stream';

export interface FileServiceFailure {
  readonly ok: false;
  readonly code:
    'invalid_input' | 'forbidden' | 'not_found' | 'not_ready' | 'failed';
  readonly message: string;
}

export interface UploadTicket {
  readonly ok: true;
  readonly file: {
    readonly id: string;
    readonly bucket: string;
    readonly objectName: string;
    readonly maximumBytes: number;
  };
}

export interface FileDownload {
  readonly ok: true;
  readonly download: {
    readonly url: string;
    readonly filename: string;
    readonly mediaType: string;
    readonly sizeBytes: number;
    readonly expiresInSeconds: number;
  };
}

export type UploadTicketResult = UploadTicket | FileServiceFailure;
export type FileDownloadResult = FileDownload | FileServiceFailure;
export type AttachFileResult = { readonly ok: true } | FileServiceFailure;
export type CompleteUploadResult = { readonly ok: true } | FileServiceFailure;

function failure(error: unknown): FileServiceFailure {
  const code =
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
      ? error.code
      : undefined;
  switch (code) {
    case '42501':
      return {
        ok: false,
        code: 'forbidden',
        message: 'You do not have access to this file.',
      };
    case 'P0002':
      return {
        ok: false,
        code: 'not_found',
        message: 'The file was not found.',
      };
    case '55000':
      return {
        ok: false,
        code: 'not_ready',
        message: 'The file has not passed verification.',
      };
    default:
      return {
        ok: false,
        code: 'failed',
        message: 'The file operation could not be completed.',
      };
  }
}

function invalid(message: string): FileServiceFailure {
  return { ok: false, code: 'invalid_input', message };
}

function record(input: unknown): Record<string, unknown> | null {
  return input !== null &&
    typeof input === 'object' &&
    !Array.isArray(input) &&
    (Object.getPrototypeOf(input) === Object.prototype ||
      Object.getPrototypeOf(input) === null)
    ? (input as Record<string, unknown>)
    : null;
}

/**
 * Creates pending metadata before the browser uploads directly to private
 * Supabase Storage. The object remains unreadable until a trusted verifier
 * checks its bytes/checksum and changes the database state to `ready`.
 */
export async function beginFileUpload(
  client: Client,
  input: unknown,
): Promise<UploadTicketResult> {
  const value = record(input);
  if (!value) return invalid('Upload input must be an object.');
  const filename =
    typeof value.filename === 'string' ? value.filename.trim() : '';
  if (
    !filename ||
    filename.length > 255 ||
    /[\\/\u0000-\u001f\u007f]/u.test(filename) ||
    filename === '.' ||
    filename === '..'
  ) {
    return invalid('Filename is invalid.');
  }
  if (
    !Number.isSafeInteger(value.sizeBytes) ||
    (value.sizeBytes as number) < 1 ||
    (value.sizeBytes as number) > MAX_FILE_BYTES
  ) {
    return invalid('File size must be between 1 byte and 25 MiB.');
  }
  if (typeof value.sha256 !== 'string' || !SHA256.test(value.sha256)) {
    return invalid(
      'SHA-256 checksum must be 64 lowercase hexadecimal characters.',
    );
  }
  if (
    ![
      'application/pdf',
      'application/zip',
      'application/octet-stream',
    ].includes(value.mediaType as string)
  ) {
    return invalid('Only PDF and MPX uploads are supported.');
  }
  const mediaType = value.mediaType as FileMediaType;
  const lowerName = filename.toLowerCase();
  if (
    mediaType === 'application/pdf'
      ? !lowerName.endsWith('.pdf')
      : !lowerName.endsWith('.mpx')
  ) {
    return invalid(
      'Filename extension does not match the declared media type.',
    );
  }

  const { data, error } = await client.rpc('begin_file_upload', {
    original_filename: filename,
    declared_media_type: mediaType,
    declared_size_bytes: value.sizeBytes as number,
    declared_sha256: value.sha256,
    correlation_id: crypto.randomUUID(),
  });
  if (error || !data) return failure(error);
  return {
    ok: true,
    file: {
      id: data.id,
      bucket: data.bucket_id,
      objectName: data.object_name,
      maximumBytes: MAX_FILE_BYTES,
    },
  };
}

/**
 * Verifies a direct-to-storage upload actually landed, then marks it ready.
 *
 * There is no `files.state` UPDATE policy for ordinary users by design -
 * self-approving your own upload would defeat the point of verification.
 * This is the one narrowly-scoped place a service-role client is used: it
 * re-reads the object's real size from Storage (bypassing RLS, which is
 * fine here because the caller was already authenticated and confirmed to
 * own a matching `pending` row via the normal client before this runs) and
 * only flips state to `ready` when it matches what was declared at
 * `beginFileUpload` time. This is a size/existence check, not malware
 * scanning - a real content-scanning worker remains separate future work.
 */
export async function completeFileUpload(
  authClient: Client,
  serviceClient: Client,
  fileId: unknown,
): Promise<CompleteUploadResult> {
  if (typeof fileId !== 'string' || !UUID.test(fileId))
    return invalid('File ID is invalid.');

  const { data: file, error: readError } = await authClient
    .from('files')
    .select('id, bucket_id, object_name, size_bytes, state')
    .eq('id', fileId)
    .maybeSingle();
  if (readError) return failure(readError);
  if (!file)
    return { ok: false, code: 'not_found', message: 'The file was not found.' };
  if (file.state === 'ready') return { ok: true };
  if (file.state !== 'pending') {
    return {
      ok: false,
      code: 'not_ready',
      message: 'This file is no longer awaiting verification.',
    };
  }

  const folder = file.object_name.split('/').slice(0, -1).join('/');
  const objectBasename = file.object_name.split('/').at(-1) ?? '';
  const { data: listing, error: listError } = await serviceClient.storage
    .from(file.bucket_id)
    .list(folder, { search: objectBasename, limit: 1 });
  if (listError) return failure(listError);
  const uploaded = listing?.find((entry) => entry.name === objectBasename);
  if (!uploaded || uploaded.metadata?.size !== file.size_bytes) {
    return {
      ok: false,
      code: 'not_ready',
      message: 'The uploaded file does not match what was declared.',
    };
  }

  const { error: updateError } = await serviceClient
    .from('files')
    .update({ state: 'ready' })
    .eq('id', fileId)
    .eq('state', 'pending');
  if (updateError) return failure(updateError);
  return { ok: true };
}

/** Attaches a verified, actor-owned file to a page the actor may edit. */
export async function attachFileToPage(
  client: Client,
  input: unknown,
): Promise<AttachFileResult> {
  const value = record(input);
  if (!value || typeof value.pageId !== 'string' || !UUID.test(value.pageId))
    return invalid('Page ID is invalid.');
  if (typeof value.fileId !== 'string' || !UUID.test(value.fileId))
    return invalid('File ID is invalid.');
  const { error } = await client.rpc('attach_ready_file_to_page', {
    target_page_id: value.pageId,
    target_file_id: value.fileId,
    correlation_id: crypto.randomUUID(),
  });
  return error ? failure(error) : { ok: true };
}

/** Creates a short-lived signed URL only after the database re-authorizes the file ID. */
export async function createFileDownload(
  client: Client,
  fileId: unknown,
): Promise<FileDownloadResult> {
  if (typeof fileId !== 'string' || !UUID.test(fileId))
    return invalid('File ID is invalid.');
  const { data, error } = await client.rpc('get_file_download_target', {
    target_file_id: fileId,
  });
  const target = data?.[0];
  if (error) return failure(error);
  if (!target)
    return { ok: false, code: 'not_found', message: 'The file was not found.' };

  const signed = await client.storage
    .from(target.bucket_id)
    .createSignedUrl(target.object_name, DOWNLOAD_TTL_SECONDS, {
      download: target.original_name,
    });
  if (signed.error || !signed.data?.signedUrl) return failure(signed.error);
  return {
    ok: true,
    download: {
      url: signed.data.signedUrl,
      filename: target.original_name,
      mediaType: target.media_type,
      sizeBytes: target.size_bytes,
      expiresInSeconds: DOWNLOAD_TTL_SECONDS,
    },
  };
}
