'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { revalidatePath, updateTag } from 'next/cache';

import type { Database } from '@/lib/database.types';
import {
  createPage,
  setPageLifecycle,
  updatePage,
  type PageMutationResult,
} from '@/lib/content/mutations';
import { createServerClient } from '@/lib/supabase/server';

async function authenticatedClient(): Promise<SupabaseClient<Database> | null> {
  const client = (await createServerClient()) as SupabaseClient<Database>;
  const { data, error } = await client.auth.getUser();
  return error || !data.user ? null : client;
}

function unauthenticated(): PageMutationResult {
  return {
    ok: false,
    code: 'forbidden',
    message: 'You must sign in to change pages.',
  };
}

function refreshPage(result: PageMutationResult): void {
  if (!result.ok) return;
  updateTag('pages');
  revalidatePath('/');
  revalidatePath(result.page.canonicalUrl);
}

/** Server Action for creating a sanitized, tag-authorized draft page. */
export async function createPageAction(
  input: unknown,
): Promise<PageMutationResult> {
  const client = await authenticatedClient();
  if (!client) return unauthenticated();
  const result = await createPage(client, input);
  refreshPage(result);
  return result;
}

/** Server Action for optimistic, sanitized, tag-authorized page updates. */
export async function updatePageAction(
  input: unknown,
): Promise<PageMutationResult> {
  const client = await authenticatedClient();
  if (!client) return unauthenticated();
  const result = await updatePage(client, input);
  refreshPage(result);
  return result;
}

/** Server Action for audited publish, unpublish, and archive transitions. */
export async function setPageLifecycleAction(
  input: unknown,
): Promise<PageMutationResult> {
  const client = await authenticatedClient();
  if (!client) return unauthenticated();
  const result = await setPageLifecycle(client, input);
  refreshPage(result);
  return result;
}
