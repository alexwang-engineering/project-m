'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import {
  archiveBankItem,
  createBankItem,
  type ArchiveBankItemResult,
  type CreateBankItemResult,
} from '@/lib/content/question-bank';
import { createServerClient } from '@/lib/supabase/server';

async function authenticatedClient(): Promise<SupabaseClient<Database> | null> {
  const client = (await createServerClient()) as SupabaseClient<Database>;
  const { data, error } = await client.auth.getUser();
  return error || !data.user ? null : client;
}

const signedOutCreate: CreateBankItemResult = {
  ok: false,
  code: 'forbidden',
  message: 'You must sign in to create a bank item.',
};

const signedOutArchive: ArchiveBankItemResult = {
  ok: false,
  code: 'forbidden',
  message: 'You must sign in to archive a bank item.',
};

/** Creates a question bank item and refreshes the bank page. */
export async function createBankItemAction(input: unknown): Promise<CreateBankItemResult> {
  const client = await authenticatedClient();
  if (!client) return signedOutCreate;
  const result = await createBankItem(client, input);
  if (result.ok) revalidatePath('/question-bank');
  return result;
}

/** Archives a question bank item and refreshes the bank page. */
export async function archiveBankItemAction(input: unknown): Promise<ArchiveBankItemResult> {
  const client = await authenticatedClient();
  if (!client) return signedOutArchive;
  const result = await archiveBankItem(client, input);
  if (result.ok) revalidatePath('/question-bank');
  return result;
}
