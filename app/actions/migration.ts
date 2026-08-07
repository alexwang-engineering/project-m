'use server';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import { importMigrationManifest, type MigrationManifest, type MigrationReportEntry } from '@/lib/content/migration';
import { createServerClient } from '@/lib/supabase/server';

async function authenticatedClient(): Promise<SupabaseClient<Database> | null> {
  const client = (await createServerClient()) as SupabaseClient<Database>;
  const { data, error } = await client.auth.getUser();
  return error || !data.user ? null : client;
}

/** Imports a staged migration manifest (dry-run or apply). Institution-admin only, enforced server-side by every underlying RPC. */
export async function importMigrationManifestAction(
  manifest: MigrationManifest,
  runId: string,
  dryRun: boolean,
): Promise<readonly MigrationReportEntry[] | { readonly error: string }> {
  const client = await authenticatedClient();
  if (!client) return { error: 'You must sign in to run a migration import.' };
  return importMigrationManifest(client, manifest, runId, dryRun);
}
