'use server';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import { isInstitutionAdmin } from '@/lib/content/admin';
import {
  getAuditLog,
  getContentSummary,
  getRosterSummary,
  type AuditLogEntry,
  type AuditLogFilters,
  type ContentSummary,
  type RosterSummary,
} from '@/lib/content/reports';
import { createServerClient } from '@/lib/supabase/server';

async function adminClient(): Promise<SupabaseClient<Database> | null> {
  const client = (await createServerClient()) as SupabaseClient<Database>;
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return (await isInstitutionAdmin(client)) ? client : null;
}

export type ReportResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly message: string };

const forbidden = {
  ok: false as const,
  message: 'Institution administrator role required to view reports.',
};

export async function getAuditLogAction(
  filters: AuditLogFilters,
): Promise<ReportResult<readonly AuditLogEntry[]>> {
  const client = await adminClient();
  if (!client) return forbidden;
  return { ok: true, data: await getAuditLog(client, filters) };
}

export async function getRosterSummaryAction(): Promise<
  ReportResult<RosterSummary>
> {
  const client = await adminClient();
  if (!client) return forbidden;
  return { ok: true, data: await getRosterSummary(client) };
}

export async function getContentSummaryAction(): Promise<
  ReportResult<ContentSummary>
> {
  const client = await adminClient();
  if (!client) return forbidden;
  return { ok: true, data: await getContentSummary(client) };
}
