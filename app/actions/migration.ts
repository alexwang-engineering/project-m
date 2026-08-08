'use server';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import {
  importMigrationManifest,
  type MigrationReportEntry,
} from '@/lib/content/migration';
import { parseMigrationManifest } from '@/lib/content/migration-parse';
import { createServerClient } from '@/lib/supabase/server';

async function authenticatedClient(): Promise<SupabaseClient<Database> | null> {
  const client = (await createServerClient()) as SupabaseClient<Database>;
  const { data, error } = await client.auth.getUser();
  return error || !data.user ? null : client;
}

/** Imports a staged migration manifest (dry-run or apply). Institution-admin only, enforced server-side by every underlying RPC. */
export async function importMigrationManifestAction(
  manifest: unknown,
  runId: string,
  dryRun: boolean,
): Promise<readonly MigrationReportEntry[] | { readonly error: string }> {
  const client = await authenticatedClient();
  if (!client) return { error: 'You must sign in to run a migration import.' };
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      runId,
    )
  )
    return { error: 'The migration run ID is invalid.' };
  if (typeof dryRun !== 'boolean')
    return { error: 'The migration mode is invalid.' };

  let serialized: string;
  try {
    serialized = JSON.stringify(manifest);
  } catch {
    return { error: 'The migration manifest is not valid JSON.' };
  }
  const parsed = parseMigrationManifest(serialized);
  if (!parsed.manifest || parsed.errors.length > 0)
    return { error: parsed.errors[0] ?? 'The migration manifest is invalid.' };

  return importMigrationManifest(client, parsed.manifest, runId, dryRun);
}
