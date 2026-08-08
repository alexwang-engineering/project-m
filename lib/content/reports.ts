import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';

type Client = SupabaseClient<Database>;

const AUDIT_LOG_LIMIT = 5000;

export interface AuditLogEntry {
  readonly id: number;
  readonly actorEmail: string | null;
  readonly action: string;
  readonly targetType: string;
  readonly targetId: string | null;
  readonly createdAt: string;
}

export interface AuditLogFilters {
  readonly action?: string;
  readonly targetType?: string;
  readonly from?: string;
  readonly to?: string;
}

/**
 * Reads audit_events through its existing admin-only RLS policy
 * (audit_read_admin) - no new authorization logic, this is the same
 * table every package this session has already been writing to, just its
 * first read surface. Capped at AUDIT_LOG_LIMIT (a real row limit, not
 * unbounded) - older history needs direct DB access, matching v1's stated
 * scope in ADR-017.
 */
export async function getAuditLog(
  client: Client,
  filters: AuditLogFilters = {},
): Promise<readonly AuditLogEntry[]> {
  let query = client
    .from('audit_events')
    .select('id, action, target_type, target_id, created_at, profiles(email)')
    .order('created_at', { ascending: false })
    .limit(AUDIT_LOG_LIMIT);
  if (filters.action) query = query.eq('action', filters.action);
  if (filters.targetType) query = query.eq('target_type', filters.targetType);
  if (filters.from) query = query.gte('created_at', filters.from);
  if (filters.to) query = query.lte('created_at', filters.to);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    actorEmail: row.profiles?.email ?? null,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    createdAt: row.created_at,
  }));
}

export interface RosterSummary {
  readonly byRole: readonly { readonly role: string; readonly count: number }[];
  readonly byState: readonly {
    readonly state: string;
    readonly count: number;
  }[];
  readonly byTag: readonly {
    readonly tagName: string;
    readonly displayName: string;
    readonly memberCount: number;
  }[];
}

const SYSTEM_ROLES = ['institution_admin', 'teacher', 'student'] as const;
const PROFILE_STATES = ['active', 'disabled'] as const;

function isCurrentWindow(validUntil: string | null): boolean {
  return validUntil === null || new Date(validUntil) > new Date();
}

/** Aggregates roster counts by role, account state, and tag membership - reads through the same admin-bypass RLS policies /admin's roster already relies on, all counting done client-side after a normal authorized select (no GROUP BY RPC needed at this project's stated scale). */
export async function getRosterSummary(client: Client): Promise<RosterSummary> {
  const [rolesRes, statesRes, membershipsRes] = await Promise.all([
    client.from('role_assignments').select('role, valid_until'),
    client.from('profiles').select('state'),
    client
      .from('tag_memberships')
      .select('valid_until, tags!inner(tag_name, display_name)'),
  ]);
  if (rolesRes.error) throw rolesRes.error;
  if (statesRes.error) throw statesRes.error;
  if (membershipsRes.error) throw membershipsRes.error;

  const activeRoles = (rolesRes.data ?? []).filter((r) =>
    isCurrentWindow(r.valid_until),
  );
  const byRole = SYSTEM_ROLES.map((role) => ({
    role,
    count: activeRoles.filter((r) => r.role === role).length,
  }));

  const byState = PROFILE_STATES.map((state) => ({
    state,
    count: (statesRes.data ?? []).filter((p) => p.state === state).length,
  }));

  const activeMemberships = (membershipsRes.data ?? []).filter(
    (m) => isCurrentWindow(m.valid_until) && m.tags !== null,
  );
  const byTagMap = new Map<
    string,
    { tagName: string; displayName: string; memberCount: number }
  >();
  for (const m of activeMemberships) {
    const tag = m.tags as unknown as { tag_name: string; display_name: string };
    const existing = byTagMap.get(tag.tag_name);
    if (existing) existing.memberCount += 1;
    else
      byTagMap.set(tag.tag_name, {
        tagName: tag.tag_name,
        displayName: tag.display_name,
        memberCount: 1,
      });
  }
  const byTag = [...byTagMap.values()].sort((a, b) =>
    a.tagName.localeCompare(b.tagName),
  );

  return { byRole, byState, byTag };
}

export interface ContentSummary {
  readonly pagesByLifecycle: readonly {
    readonly lifecycle: string;
    readonly count: number;
  }[];
  readonly assignments: number;
  readonly quizzes: number;
  readonly announcements: number;
  readonly calendarEvents: number;
  readonly submissions: number;
  readonly quizAttempts: number;
}

const PAGE_LIFECYCLES = ['draft', 'published', 'archived'] as const;

/** Aggregates operational content counts via head-only counted queries (no row data fetched) through each table's existing RLS policy. */
export async function getContentSummary(
  client: Client,
): Promise<ContentSummary> {
  const [
    pageCounts,
    assignments,
    quizzes,
    announcements,
    calendarEvents,
    submissions,
    quizAttempts,
  ] = await Promise.all([
    Promise.all(
      PAGE_LIFECYCLES.map((lifecycle) =>
        client
          .from('pages')
          .select('id', { count: 'exact', head: true })
          .eq('lifecycle', lifecycle),
      ),
    ),
    client.from('assignments').select('id', { count: 'exact', head: true }),
    client.from('quizzes').select('id', { count: 'exact', head: true }),
    client.from('announcements').select('id', { count: 'exact', head: true }),
    client.from('calendar_events').select('id', { count: 'exact', head: true }),
    client
      .from('assignment_submissions')
      .select('id', { count: 'exact', head: true }),
    client.from('quiz_attempts').select('id', { count: 'exact', head: true }),
  ]);
  for (const result of [
    ...pageCounts,
    assignments,
    quizzes,
    announcements,
    calendarEvents,
    submissions,
    quizAttempts,
  ]) {
    if (result.error) throw result.error;
  }

  return {
    pagesByLifecycle: PAGE_LIFECYCLES.map((lifecycle, i) => ({
      lifecycle,
      count: pageCounts[i]!.count ?? 0,
    })),
    assignments: assignments.count ?? 0,
    quizzes: quizzes.count ?? 0,
    announcements: announcements.count ?? 0,
    calendarEvents: calendarEvents.count ?? 0,
    submissions: submissions.count ?? 0,
    quizAttempts: quizAttempts.count ?? 0,
  };
}
