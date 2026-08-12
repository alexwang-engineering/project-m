import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import type { EditorDocumentV1 } from '@/lib/content/schema';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const DOWNLOAD_TTL_SECONDS = 60;

type Client = SupabaseClient<Database>;
type FileMediaType =
  | 'application/pdf'
  | 'application/zip'
  | 'application/octet-stream'
  | 'image/png'
  | 'image/jpeg'
  | 'image/webp'
  | 'image/gif';

const IMAGE_MEDIA_TYPES: readonly FileMediaType[] = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
];

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
    readonly downloadUrl: string;
    readonly filename: string;
    readonly mediaType: string;
    readonly sizeBytes: number;
    readonly expiresInSeconds: number;
  };
}

export type UploadTicketResult = UploadTicket | FileServiceFailure;
export type FileDownloadResult = FileDownload | FileServiceFailure;
export type AttachFileResult = { readonly ok: true } | FileServiceFailure;

export interface FileStatus {
  readonly ok: true;
  readonly state: Database['public']['Enums']['file_state'];
  readonly quarantineReason: string | null;
}
export type FileStatusResult = FileStatus | FileServiceFailure;

/** Resolves only authorized file/image blocks to short-lived download metadata. */
export async function createBlockFileDownloads(
  client: Client,
  content: EditorDocumentV1,
): Promise<Readonly<Record<string, FileDownload['download']>>> {
  const fileIds = content.blocks
    .filter((block) => block.type === 'file' || block.type === 'image')
    .map((block) => block.fileId);
  const entries = await Promise.all(
    fileIds.map(async (fileId) => {
      const result = await createFileDownload(client, fileId);
      return result.ok ? ([fileId, result.download] as const) : null;
    }),
  );
  return Object.fromEntries(entries.filter((entry) => entry !== null));
}

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
      ...IMAGE_MEDIA_TYPES,
    ].includes(value.mediaType as string)
  ) {
    return invalid('Only PDF, MPX, and image uploads are supported.');
  }
  const mediaType = value.mediaType as FileMediaType;
  const lowerName = filename.toLowerCase();
  const expectedExtension: Record<FileMediaType, string> = {
    'application/pdf': '.pdf',
    'application/zip': '.mpx',
    'application/octet-stream': '.mpx',
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif',
  };
  if (!lowerName.endsWith(expectedExtension[mediaType])) {
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
 * Read-only status check for a file the caller owns. There is deliberately
 * no way for a browser-reachable action to transition state at all - only
 * scripts/verify-uploads.ts (run out-of-band with the service-role client,
 * never imported by anything under app/ or components/) can move a file
 * out of `pending`/`scanning`. The UI polls this to learn when an upload
 * has actually been verified, rather than self-approving it.
 */
export async function getFileStatus(
  client: Client,
  fileId: unknown,
): Promise<FileStatusResult> {
  if (typeof fileId !== 'string' || !UUID.test(fileId))
    return invalid('File ID is invalid.');

  const { data: file, error } = await client
    .from('files')
    .select('state, quarantine_reason')
    .eq('id', fileId)
    .maybeSingle();
  if (error) return failure(error);
  if (!file)
    return { ok: false, code: 'not_found', message: 'The file was not found.' };
  return {
    ok: true,
    state: file.state,
    quarantineReason: file.quarantine_reason,
  };
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
    .createSignedUrl(target.object_name, DOWNLOAD_TTL_SECONDS);
  const download = await client.storage
    .from(target.bucket_id)
    .createSignedUrl(target.object_name, DOWNLOAD_TTL_SECONDS, {
      download: target.original_name,
    });
  if (
    signed.error ||
    !signed.data?.signedUrl ||
    download.error ||
    !download.data?.signedUrl
  )
    return failure(signed.error ?? download.error);
  return {
    ok: true,
    download: {
      url: signed.data.signedUrl,
      downloadUrl: download.data.signedUrl,
      filename: target.original_name,
      mediaType: target.media_type,
      sizeBytes: target.size_bytes,
      expiresInSeconds: DOWNLOAD_TTL_SECONDS,
    },
  };
}
