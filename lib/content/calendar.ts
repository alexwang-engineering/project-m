import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';

type Client = SupabaseClient<Database>;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CalendarItemKind = 'assignment' | 'quiz' | 'event';

/**
 * A single row in the unified upcoming list. Assignment/quiz rows are a
 * free read of due_at, already RLS-scoped by can_read_assignment/can_read_quiz
 * - no new table needed for those two kinds, per ADR-011.
 */
export interface CalendarItemTag {
  readonly id: string;
  readonly name: string;
}

export interface CalendarItem {
  readonly id: string;
  readonly kind: CalendarItemKind;
  readonly title: string;
  readonly at: string;
  readonly endsAt: string | null;
  readonly isBroadcast: boolean;
  readonly tags: readonly CalendarItemTag[];
  readonly createdBy: string | null;
}

/** Lists upcoming deadlines and calendar events the caller is authorized to see, soonest first. */
export async function listUpcoming(
  client: Client,
  limit = 50,
): Promise<readonly CalendarItem[]> {
  const [assignments, quizzes, events] = await Promise.all([
    client
      .from('assignments')
      .select('id, title, due_at')
      .not('due_at', 'is', null)
      .order('due_at', { ascending: true })
      .limit(limit),
    client
      .from('quizzes')
      .select('id, title, due_at')
      .not('due_at', 'is', null)
      .order('due_at', { ascending: true })
      .limit(limit),
    client
      .from('calendar_events')
      .select(
        'id, title, starts_at, ends_at, is_broadcast, created_by, calendar_event_tags(tag_id, tags!inner(tag_name))',
      )
      .order('starts_at', { ascending: true })
      .limit(limit),
  ]);
  if (assignments.error) throw assignments.error;
  if (quizzes.error) throw quizzes.error;
  if (events.error) throw events.error;

  const items: CalendarItem[] = [
    ...(assignments.data ?? []).map((a) => ({
      id: a.id,
      kind: 'assignment' as const,
      title: a.title,
      at: a.due_at as string,
      endsAt: null,
      isBroadcast: false,
      tags: [],
      createdBy: null,
    })),
    ...(quizzes.data ?? []).map((q) => ({
      id: q.id,
      kind: 'quiz' as const,
      title: q.title,
      at: q.due_at as string,
      endsAt: null,
      isBroadcast: false,
      tags: [],
      createdBy: null,
    })),
    ...(events.data ?? []).map((e) => ({
      id: e.id,
      kind: 'event' as const,
      title: e.title,
      at: e.starts_at,
      endsAt: e.ends_at,
      isBroadcast: e.is_broadcast,
      tags: e.calendar_event_tags
        .filter(
          (t): t is typeof t & { tags: NonNullable<(typeof t)['tags']> } =>
            t.tags !== null,
        )
        .map((t) => ({ id: t.tag_id, name: t.tags.tag_name })),
      createdBy: e.created_by,
    })),
  ];
  return items.sort((x, y) => x.at.localeCompare(y.at)).slice(0, limit);
}

export type CreateCalendarEventResult =
  | { readonly ok: true; readonly event: { readonly id: string } }
  | {
      readonly ok: false;
      readonly code: 'invalid_input' | 'forbidden' | 'failed';
      readonly message: string;
    };

/** Validates and creates a calendar event via the audited RPC. Tag-scoped events need teacher/manager on every tag; broadcast events need institution_admin. */
export async function createCalendarEvent(
  client: Client,
  input: unknown,
): Promise<CreateCalendarEventResult> {
  const value =
    input !== null && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : null;
  if (!value)
    return {
      ok: false,
      code: 'invalid_input',
      message: 'Event input must be an object.',
    };
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  if (!title || title.length > 240) {
    return {
      ok: false,
      code: 'invalid_input',
      message: 'Title must be between 1 and 240 characters.',
    };
  }
  if (
    value.description !== undefined &&
    value.description !== null &&
    (typeof value.description !== 'string' || value.description.length > 2000)
  ) {
    return {
      ok: false,
      code: 'invalid_input',
      message: 'Description must be at most 2000 characters.',
    };
  }
  if (typeof value.startsAt !== 'string') {
    return {
      ok: false,
      code: 'invalid_input',
      message: 'A start time is required.',
    };
  }
  const endsAt =
    value.endsAt === null || value.endsAt === undefined ? null : value.endsAt;
  if (endsAt !== null && typeof endsAt !== 'string') {
    return {
      ok: false,
      code: 'invalid_input',
      message: 'End time must be a string or null.',
    };
  }
  if (typeof value.broadcast !== 'boolean') {
    return {
      ok: false,
      code: 'invalid_input',
      message: 'Broadcast must be a boolean.',
    };
  }
  if (!Array.isArray(value.tagIds)) {
    return {
      ok: false,
      code: 'invalid_input',
      message: 'Audience tags must be an array.',
    };
  }
  const tagIds = value.tagIds.filter(
    (tag): tag is string => typeof tag === 'string' && UUID.test(tag),
  );
  if (tagIds.length !== value.tagIds.length) {
    return {
      ok: false,
      code: 'invalid_input',
      message: 'Every audience tag ID must be a UUID.',
    };
  }
  if (!value.broadcast && tagIds.length < 1) {
    return {
      ok: false,
      code: 'invalid_input',
      message:
        'At least one audience tag is required for a non-broadcast event.',
    };
  }
  if (value.broadcast && tagIds.length > 0) {
    return {
      ok: false,
      code: 'invalid_input',
      message: 'A whole-school event must not list audience tags.',
    };
  }

  const { data, error } = await client.rpc('create_calendar_event', {
    event_title: title,
    event_starts_at: value.startsAt,
    broadcast: value.broadcast,
    audience_tag_ids: tagIds,
    event_description: (value.description as string | undefined) ?? null,
    event_ends_at: endsAt,
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
        message: 'You are not authorized to create this event.',
      };
    if (code === '22023') {
      return {
        ok: false,
        code: 'invalid_input',
        message:
          error !== null && typeof error === 'object' && 'message' in error
            ? String((error as { message: unknown }).message)
            : 'Invalid event details.',
      };
    }
    return {
      ok: false,
      code: 'failed',
      message: 'The event could not be created.',
    };
  }
  return { ok: true, event: { id: data.id } };
}

export type CancelCalendarEventResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly code: 'invalid_input' | 'forbidden' | 'not_found' | 'failed';
      readonly message: string;
    };

/** Cancels (soft-archives) a calendar event via the audited RPC. */
export async function cancelCalendarEvent(
  client: Client,
  input: unknown,
): Promise<CancelCalendarEventResult> {
  const value =
    input !== null && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : null;
  if (
    !value ||
    typeof value.eventId !== 'string' ||
    !UUID.test(value.eventId)
  ) {
    return {
      ok: false,
      code: 'invalid_input',
      message: 'Event ID is invalid.',
    };
  }

  const { error } = await client.rpc('cancel_calendar_event', {
    target_event_id: value.eventId,
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
      message: 'You do not manage this event.',
    };
  if (code === 'P0002')
    return {
      ok: false,
      code: 'not_found',
      message: 'The event was not found.',
    };
  return {
    ok: false,
    code: 'failed',
    message: 'The event could not be cancelled.',
  };
}
