import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import type { RosterRow } from '@/lib/content/roster-csv';

type Client = SupabaseClient<Database>;

export type { RosterMembership, RosterRow } from '@/lib/content/roster-csv';

export interface RosterSyncReport {
  readonly runId: string;
  readonly dryRun: boolean;
  readonly rowsProcessed: number;
  readonly peopleValidated: number;
  readonly errors: readonly {
    readonly email: string;
    readonly error: string;
  }[];
  readonly roleGrants: readonly {
    readonly email: string;
    readonly role: string;
  }[];
  readonly membershipGrants: readonly {
    readonly email: string;
    readonly tag: string;
    readonly role: string;
  }[];
  readonly membershipClosures: readonly {
    readonly email: string;
    readonly tag: string;
    readonly role: string;
  }[];
  readonly accountsToDisable: readonly { readonly email: string }[];
  readonly intentsQueued: readonly {
    readonly email: string;
    readonly role: string;
  }[];
}

export type SyncRosterResult =
  | { readonly ok: true; readonly report: RosterSyncReport }
  | {
      readonly ok: false;
      readonly code: 'invalid_input' | 'forbidden' | 'failed';
      readonly message: string;
    };

function failureCode(error: unknown): string | undefined {
  return error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
    ? error.code
    : undefined;
}

function errorMessage(error: unknown, fallback: string): string {
  return error !== null &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
    ? error.message
    : fallback;
}

/** Runs sync_roster (dry-run or apply) and returns the reconciliation report. Institution-admin only, enforced server-side. */
export async function syncRoster(
  client: Client,
  rows: readonly RosterRow[],
  dryRun: boolean,
): Promise<SyncRosterResult> {
  if (rows.length < 1 || rows.length > 5000) {
    return {
      ok: false,
      code: 'invalid_input',
      message: 'Between 1 and 5000 roster rows are required.',
    };
  }

  const { data, error } = await client.rpc('sync_roster', {
    rows: JSON.parse(
      JSON.stringify(rows),
    ) as Database['public']['Functions']['sync_roster']['Args']['rows'],
    dry_run: dryRun,
    correlation_id: crypto.randomUUID(),
  });
  if (error || !data) {
    const code = failureCode(error);
    if (code === '42501')
      return {
        ok: false,
        code: 'forbidden',
        message: 'You are not authorized to run a roster sync.',
      };
    if (code === '22023')
      return {
        ok: false,
        code: 'invalid_input',
        message: errorMessage(error, 'Invalid roster data.'),
      };
    return {
      ok: false,
      code: 'failed',
      message: errorMessage(error, 'The roster sync could not be run.'),
    };
  }
  return { ok: true, report: data as unknown as RosterSyncReport };
}
