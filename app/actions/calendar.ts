'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import {
  cancelCalendarEvent,
  createCalendarEvent,
  type CancelCalendarEventResult,
  type CreateCalendarEventResult,
} from '@/lib/content/calendar';
import { createServerClient } from '@/lib/supabase/server';

async function authenticatedClient(): Promise<SupabaseClient<Database> | null> {
  const client = (await createServerClient()) as SupabaseClient<Database>;
  const { data, error } = await client.auth.getUser();
  return error || !data.user ? null : client;
}

const signedOutCreate: CreateCalendarEventResult = {
  ok: false,
  code: 'forbidden',
  message: 'You must sign in to create a calendar event.',
};

const signedOutCancel: CancelCalendarEventResult = {
  ok: false,
  code: 'forbidden',
  message: 'You must sign in to cancel a calendar event.',
};

/** Creates a calendar event and refreshes the calendar page. */
export async function createCalendarEventAction(
  input: unknown,
): Promise<CreateCalendarEventResult> {
  const client = await authenticatedClient();
  if (!client) return signedOutCreate;
  const result = await createCalendarEvent(client, input);
  if (result.ok) revalidatePath('/calendar');
  return result;
}

/** Cancels a calendar event and refreshes the calendar page. */
export async function cancelCalendarEventAction(
  input: unknown,
): Promise<CancelCalendarEventResult> {
  const client = await authenticatedClient();
  if (!client) return signedOutCancel;
  const result = await cancelCalendarEvent(client, input);
  if (result.ok) revalidatePath('/calendar');
  return result;
}
