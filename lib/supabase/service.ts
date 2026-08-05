import 'server-only';

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getServiceRoleSupabaseEnvironment } from '@/lib/env';
import type { Database } from '@/lib/database.types';

let serviceClient: SupabaseClient<Database> | undefined;

/**
 * Creates the one Supabase client in this codebase that bypasses RLS.
 *
 * Reserved for lib/files/service.ts's completeFileUpload, which verifies a
 * direct-to-storage upload actually landed before marking it ready — a step
 * users must not be able to self-approve. Never import this from a route
 * that hasn't first authenticated and authorized the caller with a normal,
 * cookie-scoped client.
 */
export function createServiceRoleClient(): SupabaseClient<Database> {
  if (serviceClient) return serviceClient;

  const { url, serviceRoleKey } = getServiceRoleSupabaseEnvironment();
  serviceClient = createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return serviceClient;
}
