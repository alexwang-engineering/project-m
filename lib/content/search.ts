import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';

type Client = SupabaseClient<Database>;

export type SearchResultKind =
  'page' | 'assignment' | 'quiz' | 'announcement' | 'event';

export interface SearchResult {
  readonly id: string;
  readonly kind: SearchResultKind;
  readonly title: string;
  readonly snippet: string | null;
  readonly href: string;
}

const PER_TABLE_LIMIT = 8;

/**
 * Full-text search across every content type with a search_vector column
 * (ADR-016). Each query is an ordinary select against an already
 * RLS-protected table via .textSearch() - there is no SECURITY DEFINER
 * function here, so authorization is exactly whatever each table's own
 * read policy already grants the caller, no new logic to get right twice.
 * Announcements/calendar events have no individual detail route, so their
 * results link to the list page rather than a specific item.
 */
export async function search(
  client: Client,
  query: string,
): Promise<readonly SearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const [pages, assignments, quizzes, announcements, events] =
    await Promise.all([
      client
        .from('pages')
        .select('id, title, canonical_url')
        .textSearch('search_vector', trimmed, {
          type: 'websearch',
          config: 'english',
        })
        .limit(PER_TABLE_LIMIT),
      client
        .from('assignments')
        .select('id, title')
        .textSearch('search_vector', trimmed, {
          type: 'websearch',
          config: 'english',
        })
        .limit(PER_TABLE_LIMIT),
      client
        .from('quizzes')
        .select('id, title')
        .textSearch('search_vector', trimmed, {
          type: 'websearch',
          config: 'english',
        })
        .limit(PER_TABLE_LIMIT),
      client
        .from('announcements')
        .select('id, title, body')
        .textSearch('search_vector', trimmed, {
          type: 'websearch',
          config: 'english',
        })
        .limit(PER_TABLE_LIMIT),
      client
        .from('calendar_events')
        .select('id, title, description')
        .textSearch('search_vector', trimmed, {
          type: 'websearch',
          config: 'english',
        })
        .limit(PER_TABLE_LIMIT),
    ]);
  if (pages.error) throw pages.error;
  if (assignments.error) throw assignments.error;
  if (quizzes.error) throw quizzes.error;
  if (announcements.error) throw announcements.error;
  if (events.error) throw events.error;

  const results: SearchResult[] = [
    ...(pages.data ?? []).map((p) => ({
      id: p.id,
      kind: 'page' as const,
      title: p.title,
      snippet: null,
      href: p.canonical_url,
    })),
    ...(assignments.data ?? []).map((a) => ({
      id: a.id,
      kind: 'assignment' as const,
      title: a.title,
      snippet: null,
      href: `/assignments/${a.id}`,
    })),
    ...(quizzes.data ?? []).map((q) => ({
      id: q.id,
      kind: 'quiz' as const,
      title: q.title,
      snippet: null,
      href: `/quizzes/${q.id}`,
    })),
    ...(announcements.data ?? []).map((a) => ({
      id: a.id,
      kind: 'announcement' as const,
      title: a.title,
      snippet: a.body,
      href: '/announcements',
    })),
    ...(events.data ?? []).map((e) => ({
      id: e.id,
      kind: 'event' as const,
      title: e.title,
      snippet: e.description,
      href: '/calendar',
    })),
  ];
  return results;
}
