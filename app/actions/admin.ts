'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import {
  assignSystemRole,
  assignTagMembership,
  createTag,
  setProfileState,
  type AdminActionResult,
  type CreateTagResult,
} from '@/lib/content/admin';
import { createServerClient } from '@/lib/supabase/server';

async function authenticatedClient(): Promise<SupabaseClient<Database> | null> {
  const client = (await createServerClient()) as SupabaseClient<Database>;
  const { data, error } = await client.auth.getUser();
  return error || !data.user ? null : client;
}

const signedOut: AdminActionResult = {
  ok: false,
  code: 'forbidden',
  message: 'You must sign in to perform this action.',
};

/** Grants a system role and refreshes the admin roster. Institution-admin check happens in the RPC itself. */
export async function assignSystemRoleAction(
  input: unknown,
): Promise<AdminActionResult> {
  const client = await authenticatedClient();
  if (!client) return signedOut;
  const result = await assignSystemRole(client, input);
  if (result.ok) revalidatePath('/admin');
  return result;
}

/** Grants a tag membership and refreshes the admin roster. */
export async function assignTagMembershipAction(
  input: unknown,
): Promise<AdminActionResult> {
  const client = await authenticatedClient();
  if (!client) return signedOut;
  const result = await assignTagMembership(client, input);
  if (result.ok) revalidatePath('/admin');
  return result;
}

/** Enables or disables a profile and refreshes the admin roster. */
export async function setProfileStateAction(
  input: unknown,
): Promise<AdminActionResult> {
  const client = await authenticatedClient();
  if (!client) return signedOut;
  const result = await setProfileState(client, input);
  if (result.ok) revalidatePath('/admin');
  return result;
}

const signedOutTag: CreateTagResult = {
  ok: false,
  code: 'forbidden',
  message: 'You must sign in to perform this action.',
};

/** Creates a tag and refreshes the admin page (and anywhere else tag pickers are rendered). */
export async function createTagAction(
  input: unknown,
): Promise<CreateTagResult> {
  const client = await authenticatedClient();
  if (!client) return signedOutTag;
  const result = await createTag(client, input);
  if (result.ok) revalidatePath('/admin');
  return result;
}
