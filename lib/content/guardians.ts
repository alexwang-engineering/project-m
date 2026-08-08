import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';

type Client = SupabaseClient<Database>;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// -----------------------------------------------------------------------
// Admin side: manage which guardians are linked to which pupils.
// -----------------------------------------------------------------------

export interface GuardianLink {
  readonly id: string;
  readonly pupilId: string;
  readonly pupilEmail: string;
  readonly guardianEmail: string;
  readonly reason: string;
  readonly createdAt: string;
  readonly activatedAt: string | null;
  readonly revokedAt: string | null;
}

/** Lists all guardian links for admin management. RLS scopes this to institution_admin. */
export async function listGuardianLinks(
  client: Client,
): Promise<readonly GuardianLink[]> {
  const { data, error } = await client
    .from('guardian_links')
    .select(
      'id, pupil_id, guardian_email, reason, created_at, activated_at, revoked_at, profiles!guardian_links_pupil_id_fkey(email)',
    )
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (data ?? [])
    .filter(
      (
        row,
      ): row is typeof row & { profiles: NonNullable<typeof row.profiles> } =>
        row.profiles !== null,
    )
    .map((row) => ({
      id: row.id,
      pupilId: row.pupil_id,
      pupilEmail: row.profiles.email,
      guardianEmail: row.guardian_email,
      reason: row.reason,
      createdAt: row.created_at,
      activatedAt: row.activated_at,
      revokedAt: row.revoked_at,
    }));
}

export type LinkGuardianResult =
  | { readonly ok: true; readonly link: { readonly id: string } }
  | {
      readonly ok: false;
      readonly code:
        'invalid_input' | 'forbidden' | 'not_found' | 'conflict' | 'failed';
      readonly message: string;
    };

/** Validates and creates a guardian link via the audited RPC. institution_admin only. */
export async function linkGuardian(
  client: Client,
  input: unknown,
): Promise<LinkGuardianResult> {
  const value =
    input !== null && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : null;
  if (
    !value ||
    typeof value.pupilId !== 'string' ||
    !UUID.test(value.pupilId)
  ) {
    return {
      ok: false,
      code: 'invalid_input',
      message: 'Pupil ID is invalid.',
    };
  }
  const guardianEmail =
    typeof value.guardianEmail === 'string'
      ? value.guardianEmail.trim().toLowerCase()
      : '';
  if (!EMAIL.test(guardianEmail)) {
    return {
      ok: false,
      code: 'invalid_input',
      message: 'A valid guardian email address is required.',
    };
  }
  const reason = typeof value.reason === 'string' ? value.reason.trim() : '';
  if (!reason) {
    return {
      ok: false,
      code: 'invalid_input',
      message: 'A reason is required to link a guardian.',
    };
  }

  const { data, error } = await client.rpc('link_guardian', {
    target_pupil_id: value.pupilId,
    guardian_email: guardianEmail,
    link_reason: reason,
    correlation_id: crypto.randomUUID(),
  });
  if (error || !data) {
    const code =
      error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      typeof error.code === 'string'
        ? error.code
        : undefined;
    if (code === '42501')
      return {
        ok: false,
        code: 'forbidden',
        message: 'You must be an institution administrator to do this.',
      };
    if (code === 'P0002')
      return { ok: false, code: 'not_found', message: 'Pupil not found.' };
    if (code === '23505')
      return {
        ok: false,
        code: 'conflict',
        message: 'This guardian is already linked to this pupil.',
      };
    if (code === '22023') {
      return {
        ok: false,
        code: 'invalid_input',
        message:
          error !== null && typeof error === 'object' && 'message' in error
            ? String((error as { message: unknown }).message)
            : 'Invalid guardian link details.',
      };
    }
    return {
      ok: false,
      code: 'failed',
      message: 'The guardian link could not be created.',
    };
  }
  return { ok: true, link: { id: data.id } };
}

export type RevokeGuardianLinkResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly code: 'invalid_input' | 'forbidden' | 'not_found' | 'failed';
      readonly message: string;
    };

/** Revokes a guardian link via the audited RPC. institution_admin only. */
export async function revokeGuardianLink(
  client: Client,
  input: unknown,
): Promise<RevokeGuardianLinkResult> {
  const value =
    input !== null && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : null;
  if (!value || typeof value.linkId !== 'string' || !UUID.test(value.linkId)) {
    return { ok: false, code: 'invalid_input', message: 'Link ID is invalid.' };
  }

  const { error } = await client.rpc('revoke_guardian_link', {
    target_link_id: value.linkId,
    correlation_id: crypto.randomUUID(),
  });
  if (!error) return { ok: true };
  const code =
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
      ? error.code
      : undefined;
  if (code === '42501')
    return {
      ok: false,
      code: 'forbidden',
      message: 'You must be an institution administrator to do this.',
    };
  if (code === 'P0002')
    return {
      ok: false,
      code: 'not_found',
      message: 'Guardian link not found.',
    };
  return {
    ok: false,
    code: 'failed',
    message: 'The guardian link could not be revoked.',
  };
}

// -----------------------------------------------------------------------
// Parent side: a guardian views their own linked pupils' released data.
// -----------------------------------------------------------------------

export interface Pupil {
  readonly id: string;
  readonly email: string;
}

/** Lists the pupils the current guardian is authorized to view. */
export async function listMyPupils(client: Client): Promise<readonly Pupil[]> {
  const { data, error } = await client.rpc('list_my_pupils');
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.pupil_id,
    email: row.pupil_email,
  }));
}

export interface PupilCalendarItem {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly occursAt: string;
  readonly endsAt: string | null;
  readonly isBroadcast: boolean;
}

/** Returns a linked pupil's upcoming deadlines and events. Fails closed if the caller isn't an authorized guardian of this pupil. */
export async function getPupilCalendar(
  client: Client,
  pupilId: string,
): Promise<readonly PupilCalendarItem[]> {
  const { data, error } = await client.rpc('guardian_view_calendar', {
    target_pupil_id: pupilId,
  });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.item_id,
    kind: row.item_kind,
    title: row.title,
    occursAt: row.occurs_at,
    endsAt: row.ends_at,
    isBroadcast: row.is_broadcast,
  }));
}

export interface PupilAnnouncement {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly isBroadcast: boolean;
  readonly createdAt: string;
}

/** Returns a linked pupil's authorized announcements. Fails closed if the caller isn't an authorized guardian of this pupil. */
export async function getPupilAnnouncements(
  client: Client,
  pupilId: string,
): Promise<readonly PupilAnnouncement[]> {
  const { data, error } = await client.rpc('guardian_view_announcements', {
    target_pupil_id: pupilId,
  });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.item_id,
    title: row.title,
    body: row.body,
    isBroadcast: row.is_broadcast,
    createdAt: row.created_at,
  }));
}

export interface PupilGrade {
  readonly submissionId: string;
  readonly assignmentTitle: string;
  readonly grade: number;
  readonly gradeFeedback: string | null;
  readonly gradedAt: string | null;
}

/** Returns a linked pupil's graded assignment submissions. Fails closed if the caller isn't an authorized guardian of this pupil. */
export async function getPupilGrades(
  client: Client,
  pupilId: string,
): Promise<readonly PupilGrade[]> {
  const { data, error } = await client.rpc('guardian_view_grades', {
    target_pupil_id: pupilId,
  });
  if (error) throw error;
  return (data ?? [])
    .filter((row): row is typeof row & { grade: number } => row.grade !== null)
    .map((row) => ({
      submissionId: row.submission_id,
      assignmentTitle: row.assignment_title,
      grade: row.grade,
      gradeFeedback: row.grade_feedback,
      gradedAt: row.graded_at,
    }));
}
