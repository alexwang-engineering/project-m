import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';

type Client = SupabaseClient<Database>;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface AnnouncementTag {
  readonly id: string;
  readonly name: string;
}

export interface Announcement {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly isBroadcast: boolean;
  readonly tags: readonly AnnouncementTag[];
  readonly createdBy: string;
  readonly createdAt: string;
}

/** Lists announcements the current principal is authorized to see, newest first. No read/unread tracking - see ADR-012. */
export async function listAnnouncements(client: Client, limit = 50): Promise<readonly Announcement[]> {
  const { data, error } = await client
    .from('announcements')
    .select('id, title, body, is_broadcast, created_by, created_at, announcement_tags(tag_id, tags!inner(tag_name))')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    isBroadcast: row.is_broadcast,
    tags: row.announcement_tags
      .filter((t): t is typeof t & { tags: NonNullable<(typeof t)['tags']> } => t.tags !== null)
      .map((t) => ({ id: t.tag_id, name: t.tags.tag_name })),
    createdBy: row.created_by,
    createdAt: row.created_at,
  }));
}

export type CreateAnnouncementResult =
  | { readonly ok: true; readonly announcement: { readonly id: string } }
  | { readonly ok: false; readonly code: 'invalid_input' | 'forbidden' | 'failed'; readonly message: string };

/** Validates and posts an announcement via the audited RPC. Tag-scoped posts need teacher/manager on every tag; broadcast posts need institution_admin. */
export async function createAnnouncement(client: Client, input: unknown): Promise<CreateAnnouncementResult> {
  const value =
    input !== null && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : null;
  if (!value) return { ok: false, code: 'invalid_input', message: 'Announcement input must be an object.' };
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  if (!title || title.length > 240) {
    return { ok: false, code: 'invalid_input', message: 'Title must be between 1 and 240 characters.' };
  }
  const body = typeof value.body === 'string' ? value.body.trim() : '';
  if (!body || body.length > 4000) {
    return { ok: false, code: 'invalid_input', message: 'Body must be between 1 and 4000 characters.' };
  }
  if (typeof value.broadcast !== 'boolean') {
    return { ok: false, code: 'invalid_input', message: 'Broadcast must be a boolean.' };
  }
  if (!Array.isArray(value.tagIds)) {
    return { ok: false, code: 'invalid_input', message: 'Audience tags must be an array.' };
  }
  const tagIds = value.tagIds.filter((tag): tag is string => typeof tag === 'string' && UUID.test(tag));
  if (tagIds.length !== value.tagIds.length) {
    return { ok: false, code: 'invalid_input', message: 'Every audience tag ID must be a UUID.' };
  }
  if (!value.broadcast && tagIds.length < 1) {
    return { ok: false, code: 'invalid_input', message: 'At least one audience tag is required for a non-broadcast announcement.' };
  }
  if (value.broadcast && tagIds.length > 0) {
    return { ok: false, code: 'invalid_input', message: 'A whole-school announcement must not list audience tags.' };
  }

  const { data, error } = await client.rpc('create_announcement', {
    announcement_title: title,
    announcement_body: body,
    broadcast: value.broadcast,
    audience_tag_ids: tagIds,
    correlation_id: crypto.randomUUID(),
  });
  if (error || !data) {
    const code =
      error !== null && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
        ? error.code
        : undefined;
    if (code === '42501') {
      return { ok: false, code: 'forbidden', message: 'You are not authorized to post this announcement.' };
    }
    if (code === '22023') {
      return {
        ok: false,
        code: 'invalid_input',
        message:
          error !== null && typeof error === 'object' && 'message' in error
            ? String((error as { message: unknown }).message)
            : 'Invalid announcement details.',
      };
    }
    return { ok: false, code: 'failed', message: 'The announcement could not be posted.' };
  }
  return { ok: true, announcement: { id: data.id } };
}

export type CancelAnnouncementResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: 'invalid_input' | 'forbidden' | 'not_found' | 'failed'; readonly message: string };

/** Retracts (soft-archives) an announcement via the audited RPC. */
export async function cancelAnnouncement(client: Client, input: unknown): Promise<CancelAnnouncementResult> {
  const value =
    input !== null && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : null;
  if (!value || typeof value.announcementId !== 'string' || !UUID.test(value.announcementId)) {
    return { ok: false, code: 'invalid_input', message: 'Announcement ID is invalid.' };
  }

  const { error } = await client.rpc('cancel_announcement', {
    target_announcement_id: value.announcementId,
    correlation_id: crypto.randomUUID(),
  });
  if (!error) return { ok: true };
  const code =
    error !== null && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
      ? error.code
      : undefined;
  if (code === '42501') return { ok: false, code: 'forbidden', message: 'You do not manage this announcement.' };
  if (code === 'P0002') return { ok: false, code: 'not_found', message: 'The announcement was not found.' };
  return { ok: false, code: 'failed', message: 'The announcement could not be cancelled.' };
}
