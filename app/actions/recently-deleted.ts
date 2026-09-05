'use server';

import { revalidatePath } from 'next/cache';

import { restoreDeletedItem } from '@/lib/content/recently-deleted';
import { createServerClient } from '@/lib/supabase/server';

export async function restoreDeletedItemAction(input: unknown) {
  const client = await createServerClient();
  const { data } = await client.auth.getUser();
  if (!data.user) return { ok: false as const, message: 'You must sign in.' };
  const result = await restoreDeletedItem(client, input);
  if (result.ok) {
    revalidatePath('/recently-deleted');
    revalidatePath('/resources');
  }
  return result;
}
