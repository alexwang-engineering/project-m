'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import {
  linkGuardian,
  revokeGuardianLink,
  type LinkGuardianResult,
  type RevokeGuardianLinkResult,
} from '@/lib/content/guardians';
import { createServerClient } from '@/lib/supabase/server';

async function authenticatedClient(): Promise<SupabaseClient<Database> | null> {
  const client = (await createServerClient()) as SupabaseClient<Database>;
  const { data, error } = await client.auth.getUser();
  return error || !data.user ? null : client;
}

const signedOutLink: LinkGuardianResult = {
  ok: false,
  code: 'forbidden',
  message: 'You must sign in to link a guardian.',
};

const signedOutRevoke: RevokeGuardianLinkResult = {
  ok: false,
  code: 'forbidden',
  message: 'You must sign in to revoke a guardian link.',
};

/** Links a guardian to a pupil and refreshes the admin page. */
export async function linkGuardianAction(
  input: unknown,
): Promise<LinkGuardianResult> {
  const client = await authenticatedClient();
  if (!client) return signedOutLink;
  const result = await linkGuardian(client, input);
  if (result.ok) revalidatePath('/admin');
  return result;
}

/** Revokes a guardian link and refreshes the admin page. */
export async function revokeGuardianLinkAction(
  input: unknown,
): Promise<RevokeGuardianLinkResult> {
  const client = await authenticatedClient();
  if (!client) return signedOutRevoke;
  const result = await revokeGuardianLink(client, input);
  if (result.ok) revalidatePath('/admin');
  return result;
}
