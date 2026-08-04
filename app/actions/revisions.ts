'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { revalidatePath, updateTag } from 'next/cache';

import type { PageMutationResult } from '@/lib/content/mutations';
import { restorePageRevision } from '@/lib/content/revisions';
import type { Database } from '@/lib/database.types';
import { createServerClient } from '@/lib/supabase/server';

/** Restores a revision and invalidates both dashboard and canonical page caches. */
export async function restorePageRevisionAction(
  input: unknown,
): Promise<PageMutationResult> {
  const client = (await createServerClient()) as SupabaseClient<Database>;
  const { data, error } = await client.auth.getUser();
  if (error || !data.user)
    return {
      ok: false,
      code: 'forbidden',
      message: 'You must sign in to restore pages.',
    };
  const result = await restorePageRevision(client, input);
  if (result.ok) {
    updateTag('pages');
    revalidatePath('/');
    revalidatePath(result.page.canonicalUrl);
  }
  return result;
}
