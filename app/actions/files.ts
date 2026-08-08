'use server';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import {
  attachFileToPage,
  beginFileUpload,
  createFileDownload,
  getFileStatus,
  type AttachFileResult,
  type FileDownloadResult,
  type FileStatusResult,
  type UploadTicketResult,
} from '@/lib/files/service';
import { createServerClient } from '@/lib/supabase/server';

async function authenticatedClient(): Promise<SupabaseClient<Database> | null> {
  const client = (await createServerClient()) as SupabaseClient<Database>;
  const { data, error } = await client.auth.getUser();
  return error || !data.user ? null : client;
}

const signedOut = {
  ok: false,
  code: 'forbidden',
  message: 'You must sign in to access files.',
} as const;

/** Starts a private direct-to-storage upload; it does not approve the file. */
export async function beginFileUploadAction(
  input: unknown,
): Promise<UploadTicketResult> {
  const client = await authenticatedClient();
  return client ? beginFileUpload(client, input) : signedOut;
}

/**
 * Read-only poll for a file's verification state. There is no action that
 * lets the browser move a file to `ready` itself - only the out-of-band
 * verification worker (scripts/verify-uploads.ts) can do that.
 */
export async function getFileStatusAction(
  fileId: unknown,
): Promise<FileStatusResult> {
  const client = await authenticatedClient();
  return client ? getFileStatus(client, fileId) : signedOut;
}

/** Attaches a trusted-verifier-approved upload to an editable page. */
export async function attachFileToPageAction(
  input: unknown,
): Promise<AttachFileResult> {
  const client = await authenticatedClient();
  return client ? attachFileToPage(client, input) : signedOut;
}

/** Returns a one-minute download URL after both database and Storage RLS checks. */
export async function createFileDownloadAction(
  fileId: unknown,
): Promise<FileDownloadResult> {
  const client = await authenticatedClient();
  return client ? createFileDownload(client, fileId) : signedOut;
}
