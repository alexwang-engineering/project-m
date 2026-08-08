'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import {
  cancelAnnouncement,
  createAnnouncement,
  type CancelAnnouncementResult,
  type CreateAnnouncementResult,
} from '@/lib/content/announcements';
import { createServerClient } from '@/lib/supabase/server';

async function authenticatedClient(): Promise<SupabaseClient<Database> | null> {
  const client = (await createServerClient()) as SupabaseClient<Database>;
  const { data, error } = await client.auth.getUser();
  return error || !data.user ? null : client;
}

const signedOutCreate: CreateAnnouncementResult = {
  ok: false,
  code: 'forbidden',
  message: 'You must sign in to post an announcement.',
};

const signedOutCancel: CancelAnnouncementResult = {
  ok: false,
  code: 'forbidden',
  message: 'You must sign in to cancel an announcement.',
};

/** Posts an announcement and refreshes the announcements page. */
export async function createAnnouncementAction(
  input: unknown,
): Promise<CreateAnnouncementResult> {
  const client = await authenticatedClient();
  if (!client) return signedOutCreate;
  const result = await createAnnouncement(client, input);
  if (result.ok) revalidatePath('/announcements');
  return result;
}

/** Cancels an announcement and refreshes the announcements page. */
export async function cancelAnnouncementAction(
  input: unknown,
): Promise<CancelAnnouncementResult> {
  const client = await authenticatedClient();
  if (!client) return signedOutCancel;
  const result = await cancelAnnouncement(client, input);
  if (result.ok) revalidatePath('/announcements');
  return result;
}
