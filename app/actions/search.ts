'use server';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import { search, type SearchResult } from '@/lib/content/search';
import { createServerClient } from '@/lib/supabase/server';

/** Runs a full-text search across every content type the caller can currently read. Returns an empty list when signed out, rather than an error - a search box degrading to "no results" is expected, not exceptional. */
export async function searchAction(
  query: string,
): Promise<readonly SearchResult[]> {
  const client = (await createServerClient()) as SupabaseClient<Database>;
  const { data } = await client.auth.getUser();
  if (!data.user) return [];
  return search(client, query);
}
