'use server';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import {
  attachFileToPage,
  beginFileUpload,
  completeFileUpload,
  createFileDownload,
  type AttachFileResult,
  type CompleteUploadResult,
  type FileDownloadResult,
  type UploadTicketResult,
} from '@/lib/files/service';
import { createServerClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service';

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

/** Verifies a direct-to-storage upload landed and marks it ready for use. */
export async function completeFileUploadAction(
  fileId: unknown,
): Promise<CompleteUploadResult> {
  const client = await authenticatedClient();
  return client
    ? completeFileUpload(client, createServiceRoleClient(), fileId)
    : signedOut;
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
