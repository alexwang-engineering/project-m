import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';

type Client = SupabaseClient<Database>;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SystemRole = Database['public']['Enums']['system_role'];
type MembershipRole = Database['public']['Enums']['membership_role'];
type PrincipalState = Database['public']['Enums']['principal_state'];

export interface AdminTagMembership {
  readonly tagId: string;
  readonly tagName: string;
  readonly role: MembershipRole;
}

/**
 * Not itself a security boundary - the admin RPCs (and, in Package Q,
 * create_calendar_event's broadcast path) enforce institution_admin
 * server-side regardless of what this check shows. This only avoids
 * presenting a confusing UI to a non-admin (RLS would otherwise just
 * filter the underlying query down to their own row).
 */
export async function isInstitutionAdmin(client: Client): Promise<boolean> {
  const { data } = await client
    .from('role_assignments')
    .select('role')
    .eq('role', 'institution_admin');
  return (data ?? []).length > 0;
}

export interface AdminUser {
  readonly id: string;
  readonly email: string;
  readonly state: PrincipalState;
  readonly systemRoles: readonly SystemRole[];
  readonly tagMemberships: readonly AdminTagMembership[];
}

function isCurrentlyValid(validFrom: string, validUntil: string | null): boolean {
  const now = Date.now();
  return new Date(validFrom).getTime() <= now && (validUntil === null || new Date(validUntil).getTime() > now);
}

/**
 * Lists the institution's roster for admin management. RLS already scopes
 * this to institution_admin (or self) via `profiles_read_self_admin` and
 * its counterparts on role_assignments/tag_memberships - a non-admin caller
 * would just see themselves, not an error, so this is safe to call
 * unconditionally from the admin page (which itself gates on system role
 * before rendering).
 */
export async function listUsers(client: Client, limit = 200): Promise<readonly AdminUser[]> {
  const { data, error } = await client
    .from('profiles')
    .select(
      'id, email, state, role_assignments!role_assignments_profile_id_fkey(role, valid_from, valid_until), tag_memberships!tag_memberships_profile_id_fkey(membership_role, valid_from, valid_until, tags(id, tag_name))',
    )
    .order('email', { ascending: true })
    .limit(limit);
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    state: row.state,
    systemRoles: row.role_assignments
      .filter((r) => isCurrentlyValid(r.valid_from, r.valid_until))
      .map((r) => r.role),
    tagMemberships: row.tag_memberships
      .filter((m) => isCurrentlyValid(m.valid_from, m.valid_until) && m.tags !== null)
      .map((m) => ({
        tagId: (m.tags as NonNullable<typeof m.tags>).id,
        tagName: (m.tags as NonNullable<typeof m.tags>).tag_name,
        role: m.membership_role,
      })),
  }));
}

export interface AdminTag {
  readonly id: string;
  readonly name: string;
  readonly displayName: string;
}

/** Lists active tags for the assignment pickers. Readable by any active principal, not just admins. */
export async function listTags(client: Client): Promise<readonly AdminTag[]> {
  const { data, error } = await client
    .from('tags')
    .select('id, tag_name, display_name')
    .order('tag_name', { ascending: true })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((tag) => ({ id: tag.id, name: tag.tag_name, displayName: tag.display_name }));
}

export type AdminActionResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly code: 'invalid_input' | 'forbidden' | 'not_found' | 'failed';
      readonly message: string;
    };

function record(input: unknown): Record<string, unknown> | null {
  return input !== null && typeof input === 'object' && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : null;
}

function failure(error: unknown): AdminActionResult {
  const code =
    error !== null && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
      ? error.code
      : undefined;
  switch (code) {
    case '42501':
      return { ok: false, code: 'forbidden', message: 'You must be an institution administrator to do this.' };
    case 'P0002':
      return { ok: false, code: 'not_found', message: 'The target was not found.' };
    case '22023':
      return {
        ok: false,
        code: 'invalid_input',
        message:
          error !== null && typeof error === 'object' && 'message' in error
            ? String((error as { message: unknown }).message)
            : 'Invalid input.',
      };
    default:
      return { ok: false, code: 'failed', message: 'The operation could not be completed.' };
  }
}

const SYSTEM_ROLES: readonly SystemRole[] = ['institution_admin', 'teacher', 'student'];
const MEMBERSHIP_ROLES: readonly MembershipRole[] = ['member', 'teacher', 'manager'];

/** Grants a system role via the audited RPC. Every grant requires a reason (enforced by the function itself). */
export async function assignSystemRole(client: Client, input: unknown): Promise<AdminActionResult> {
  const value = record(input);
  if (!value || typeof value.profileId !== 'string' || !UUID.test(value.profileId)) {
    return { ok: false, code: 'invalid_input', message: 'Profile ID is invalid.' };
  }
  if (typeof value.role !== 'string' || !SYSTEM_ROLES.includes(value.role as SystemRole)) {
    return { ok: false, code: 'invalid_input', message: 'Role is invalid.' };
  }
  if (typeof value.reason !== 'string' || !value.reason.trim()) {
    return { ok: false, code: 'invalid_input', message: 'A reason is required.' };
  }

  const { error } = await client.rpc('assign_system_role', {
    target_profile: value.profileId,
    assigned_role: value.role as SystemRole,
    assignment_reason: value.reason.trim(),
    correlation_id: crypto.randomUUID(),
  });
  return error ? failure(error) : { ok: true };
}

/** Grants a tag membership via the audited RPC. */
export async function assignTagMembership(client: Client, input: unknown): Promise<AdminActionResult> {
  const value = record(input);
  if (!value || typeof value.profileId !== 'string' || !UUID.test(value.profileId)) {
    return { ok: false, code: 'invalid_input', message: 'Profile ID is invalid.' };
  }
  if (typeof value.tagId !== 'string' || !UUID.test(value.tagId)) {
    return { ok: false, code: 'invalid_input', message: 'Tag ID is invalid.' };
  }
  if (typeof value.role !== 'string' || !MEMBERSHIP_ROLES.includes(value.role as MembershipRole)) {
    return { ok: false, code: 'invalid_input', message: 'Membership role is invalid.' };
  }

  const { error } = await client.rpc('assign_tag_membership', {
    target_profile: value.profileId,
    target_tag: value.tagId,
    assigned_membership_role: value.role as MembershipRole,
    assignment_source: 'admin_console',
    correlation_id: crypto.randomUUID(),
  });
  return error ? failure(error) : { ok: true };
}

/** Enables or disables a profile via the audited RPC. */
export async function setProfileState(client: Client, input: unknown): Promise<AdminActionResult> {
  const value = record(input);
  if (!value || typeof value.profileId !== 'string' || !UUID.test(value.profileId)) {
    return { ok: false, code: 'invalid_input', message: 'Profile ID is invalid.' };
  }
  if (value.state !== 'active' && value.state !== 'disabled') {
    return { ok: false, code: 'invalid_input', message: 'State must be active or disabled.' };
  }
  if (typeof value.reason !== 'string' || !value.reason.trim()) {
    return { ok: false, code: 'invalid_input', message: 'A reason is required.' };
  }

  const { error } = await client.rpc('set_profile_state', {
    target_profile: value.profileId,
    next_state: value.state,
    change_reason: value.reason.trim(),
    correlation_id: crypto.randomUUID(),
  });
  return error ? failure(error) : { ok: true };
}

export type CreateTagResult =
  | { readonly ok: true; readonly tag: { readonly id: string; readonly name: string } }
  | {
      readonly ok: false;
      readonly code: 'invalid_input' | 'forbidden' | 'conflict' | 'failed';
      readonly message: string;
    };

/** Creates a tag via the audited RPC. Institution-admin only, per explicit product owner decision. */
export async function createTag(client: Client, input: unknown): Promise<CreateTagResult> {
  const value = record(input);
  if (!value || typeof value.name !== 'string' || !value.name.trim()) {
    return { ok: false, code: 'invalid_input', message: 'Tag name is required.' };
  }
  if (typeof value.displayName !== 'string' || !value.displayName.trim()) {
    return { ok: false, code: 'invalid_input', message: 'Display name is required.' };
  }
  const reason = typeof value.reason === 'string' && value.reason.trim() ? value.reason.trim() : undefined;

  const { data, error } = await client.rpc('create_tag', {
    new_tag_name: value.name.trim(),
    new_display_name: value.displayName.trim(),
    creation_reason: reason,
    correlation_id: crypto.randomUUID(),
  });
  if (error || !data) {
    const code =
      error !== null && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
        ? error.code
        : undefined;
    if (code === '23505') return { ok: false, code: 'conflict', message: 'A tag with this name already exists.' };
    if (code === '42501') {
      return { ok: false, code: 'forbidden', message: 'You must be an institution administrator to do this.' };
    }
    if (code === '22023') {
      return {
        ok: false,
        code: 'invalid_input',
        message:
          error !== null && typeof error === 'object' && 'message' in error
            ? String((error as { message: unknown }).message)
            : 'Invalid tag name or display name.',
      };
    }
    return { ok: false, code: 'failed', message: 'The tag could not be created.' };
  }
  return { ok: true, tag: { id: data.id, name: data.tag_name } };
}
