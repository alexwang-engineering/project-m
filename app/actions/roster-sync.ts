'use server';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import { MAX_ROSTER_FILE_BYTES } from '@/lib/content/roster-csv';
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
  rows: unknown,
  dryRun: boolean,
): Promise<SyncRosterResult> {
  const client = await authenticatedClient();
  if (!client) return signedOut;
  if (!Array.isArray(rows) || typeof dryRun !== 'boolean')
    return {
      ok: false,
      code: 'invalid_input',
      message: 'Invalid roster data.',
    };
  let serialized: string;
  try {
    serialized = JSON.stringify(rows);
  } catch {
    return {
      ok: false,
      code: 'invalid_input',
      message: 'Invalid roster data.',
    };
  }
  if (new TextEncoder().encode(serialized).byteLength > MAX_ROSTER_FILE_BYTES)
    return {
      ok: false,
      code: 'invalid_input',
      message: 'The roster data must be 5 MB or smaller.',
    };
  return syncRoster(client, rows as readonly RosterRow[], dryRun);
}
