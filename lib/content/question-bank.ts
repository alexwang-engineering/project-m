import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import type { QuizChoice } from '@/lib/content/quizzes';

type Client = SupabaseClient<Database>;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface BankItemTag {
  readonly name: string;
  readonly displayName: string;
}

/**
 * A bank item as seen by whoever can access it (creator, institution_admin,
 * or teacher/manager on one of its tags) - the same principals who could
 * import it into a quiz, so the correct answer is shown here too. Nobody
 * else can read this row at all; can_access_bank_item's RLS policy is the
 * only gate, there is no separate broader "read" tier like quizzes have.
 */
export interface BankItemSummary {
  readonly id: string;
  readonly prompt: string;
  readonly choices: readonly QuizChoice[];
  readonly correctChoiceId: string;
  readonly tags: readonly BankItemTag[];
}

function isChoiceArray(value: unknown): value is QuizChoice[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item !== null &&
        typeof item === 'object' &&
        typeof (item as { id?: unknown }).id === 'string' &&
        typeof (item as { label?: unknown }).label === 'string',
    )
  );
}

/** Lists bank items the current principal can access, per can_access_bank_item - archived items are already excluded by that same check. */
export async function listBankItems(client: Client): Promise<readonly BankItemSummary[]> {
  const { data, error } = await client
    .from('question_bank_items')
    .select('id, prompt, choices, correct_choice_id, question_bank_item_tags(tags!inner(tag_name, display_name))')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;

  return (data ?? []).map((item) => ({
    id: item.id,
    prompt: item.prompt,
    choices: isChoiceArray(item.choices) ? item.choices : [],
    correctChoiceId: item.correct_choice_id,
    tags: item.question_bank_item_tags
      .map(({ tags }) => tags)
      .filter((tag): tag is NonNullable<typeof tag> => tag !== null)
      .map((tag) => ({ name: tag.tag_name, displayName: tag.display_name })),
  }));
}

function record(input: unknown): Record<string, unknown> | null {
  return input !== null && typeof input === 'object' && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : null;
}

function failureCode(error: unknown): string | undefined {
  return error !== null && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
    ? error.code
    : undefined;
}

function errorMessage(error: unknown, fallback: string): string {
  return error !== null && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
    ? error.message
    : fallback;
}

export type CreateBankItemResult =
  | { readonly ok: true; readonly item: { readonly id: string } }
  | { readonly ok: false; readonly code: 'invalid_input' | 'forbidden' | 'failed'; readonly message: string };

/** Validates and creates a bank item via the audited RPC. Requires teacher/manager on every selected tag, same as quiz/assignment/event creation. */
export async function createBankItem(client: Client, input: unknown): Promise<CreateBankItemResult> {
  const value = record(input);
  if (!value) return { ok: false, code: 'invalid_input', message: 'Bank item input must be an object.' };
  const prompt = typeof value.prompt === 'string' ? value.prompt.trim() : '';
  if (!prompt || prompt.length > 2000) {
    return { ok: false, code: 'invalid_input', message: 'Prompt must be between 1 and 2000 characters.' };
  }
  if (!Array.isArray(value.choices) || value.choices.length < 2 || value.choices.length > 8) {
    return { ok: false, code: 'invalid_input', message: 'Between 2 and 8 choices are required.' };
  }
  if (typeof value.correctChoiceId !== 'string' || !value.correctChoiceId) {
    return { ok: false, code: 'invalid_input', message: 'A correct choice is required.' };
  }
  if (!Array.isArray(value.tagIds) || value.tagIds.length < 1 || value.tagIds.length > 100) {
    return { ok: false, code: 'invalid_input', message: 'Between 1 and 100 audience tags are required.' };
  }
  const tagIds = value.tagIds.filter((tag): tag is string => typeof tag === 'string' && UUID.test(tag));
  if (tagIds.length !== value.tagIds.length) {
    return { ok: false, code: 'invalid_input', message: 'Every audience tag ID must be a UUID.' };
  }

  const { data, error } = await client.rpc('create_bank_item', {
    item_prompt: prompt,
    item_choices: JSON.parse(JSON.stringify(value.choices)) as Database['public']['Functions']['create_bank_item']['Args']['item_choices'],
    item_correct_choice_id: value.correctChoiceId,
    audience_tag_ids: tagIds,
    correlation_id: crypto.randomUUID(),
  });
  if (error || !data) {
    const code = failureCode(error);
    if (code === '42501') return { ok: false, code: 'forbidden', message: 'You do not manage every selected tag.' };
    if (code === '22023') return { ok: false, code: 'invalid_input', message: errorMessage(error, 'Invalid bank item details.') };
    return { ok: false, code: 'failed', message: errorMessage(error, 'The bank item could not be created.') };
  }
  return { ok: true, item: { id: data.id } };
}

export type ArchiveBankItemResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: 'invalid_input' | 'forbidden' | 'not_found' | 'failed'; readonly message: string };

/** Archives a bank item via the audited RPC - create-and-archive only, same as calendar events and announcements. */
export async function archiveBankItem(client: Client, input: unknown): Promise<ArchiveBankItemResult> {
  const value = record(input);
  if (!value || typeof value.itemId !== 'string' || !UUID.test(value.itemId)) {
    return { ok: false, code: 'invalid_input', message: 'Bank item ID is invalid.' };
  }

  const { error } = await client.rpc('archive_bank_item', {
    target_item_id: value.itemId,
    correlation_id: crypto.randomUUID(),
  });
  if (!error) return { ok: true };
  const code = failureCode(error);
  if (code === 'P0002') return { ok: false, code: 'not_found', message: 'The bank item was not found.' };
  return { ok: false, code: 'failed', message: 'The bank item could not be archived.' };
}
