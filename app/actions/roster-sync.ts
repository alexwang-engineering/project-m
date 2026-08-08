'use server';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import {
  syncRoster,
  type RosterRow,
  type SyncRosterResult,
} from '@/lib/content/roster-sync';
import { createServerClient } from '@/lib/supabase/server';

async function authenticatedClient(): Promise<SupabaseClient<Database> | null> {
  const client = (await createServerClient()) as SupabaseClient<Database>;
  const { data, error } = await client.auth.getUser();
  return error || !data.user ? null : client;
}

const signedOut: SyncRosterResult = {
  ok: false,
  code: 'forbidden',
  message: 'You must sign in to run a roster sync.',
};

/** Runs sync_roster (dry-run or apply) for a parsed roster snapshot. */
export async function syncRosterAction(
  rows: readonly RosterRow[],
  dryRun: boolean,
): Promise<SyncRosterResult> {
  const client = await authenticatedClient();
  if (!client) return signedOut;
  return syncRoster(client, rows, dryRun);
}
