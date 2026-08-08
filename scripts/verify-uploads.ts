/**
 * Trusted file-verification worker CLI. Run out-of-band (cron, a scheduled
 * job, or by hand) - never invoked by any browser-reachable Next.js route
 * or Server Action. This is the only process that ever transitions a
 * file from `pending`/`scanning` to `ready`, `quarantined`, or `failed`.
 *
 * Usage: node --env-file=.env.local --import tsx scripts/verify-uploads.ts
 * (see the "verify-uploads" npm script, which wires this up)
 *
 * Builds its own service-role client directly rather than importing
 * lib/supabase/service.ts, because that module is marked `import
 * 'server-only'` - a marker whose default export unconditionally throws
 * outside Next's own bundler, which is exactly the environment this plain
 * Node/tsx script runs in.
 */
import { createClient } from '@supabase/supabase-js';

import type { Database } from '../lib/database.types';
import {
  claimNextPendingFile,
  verifyClaimedFile,
} from '../lib/files/verification-worker';
import { resolveMalwareScanner } from '../lib/files/scanner';

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function main(): Promise<void> {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const serviceClient = createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const scanner = resolveMalwareScanner();

  let processed = 0;
  for (;;) {
    const claimed = await claimNextPendingFile(serviceClient);
    if (!claimed) break;
    const outcome = await verifyClaimedFile(serviceClient, claimed, scanner);
    processed += 1;
    const reasonSuffix = outcome.reason ? `: ${outcome.reason}` : '';
    process.stdout.write(
      `[verify-uploads] ${outcome.fileId} -> ${outcome.result}${reasonSuffix}\n`,
    );
  }
  process.stdout.write(
    `[verify-uploads] done, processed ${processed} file(s)\n`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(
    `[verify-uploads] fatal: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
