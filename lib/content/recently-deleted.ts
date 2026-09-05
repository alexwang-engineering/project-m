import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';

type Client = SupabaseClient<Database>;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type DeletedItemKind = 'page' | 'quiz' | 'assignment';

export interface DeletedItem {
  readonly id: string;
  readonly kind: DeletedItemKind;
  readonly title: string;
  readonly deletedAt: string;
  readonly restoreUntil: string;
}

export async function listRecentlyDeleted(
  client: Client,
): Promise<readonly DeletedItem[]> {
  const { data, error } = await client.rpc('recently_deleted');
  if (error) throw error;
  return (data ?? []).flatMap((row) =>
    row.item_kind === 'page' ||
    row.item_kind === 'quiz' ||
    row.item_kind === 'assignment'
      ? [
          {
            id: row.item_id,
            kind: row.item_kind,
            title: row.title,
            deletedAt: row.deleted_at,
            restoreUntil: row.restore_until,
          },
        ]
      : [],
  );
}

export async function restoreDeletedItem(
  client: Client,
  input: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return { ok: false, message: 'Restore request is invalid.' };
  const { id, kind } = input as Record<string, unknown>;
  if (
    typeof id !== 'string' ||
    !UUID.test(id) ||
    (kind !== 'page' && kind !== 'quiz' && kind !== 'assignment')
  )
    return { ok: false, message: 'Restore request is invalid.' };
  const { error } = await client.rpc('restore_deleted_item', {
    item_id: id,
    item_kind: kind,
    correlation_id: crypto.randomUUID(),
  });
  return error
    ? {
        ok: false,
        message:
          'This item could not be restored. Refresh and check your access.',
      }
    : { ok: true };
}
