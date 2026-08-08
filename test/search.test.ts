import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import { search } from '@/lib/content/search';
import type { Database } from '@/lib/database.types';

describe('search trust boundary', () => {
  it('rejects malformed and oversized input before touching the database', async () => {
    const unusedClient = {} as SupabaseClient<Database>;

    await expect(search(unusedClient, null)).resolves.toEqual([]);
    await expect(search(unusedClient, { query: 'maths' })).resolves.toEqual([]);
    await expect(search(unusedClient, 'x'.repeat(201))).resolves.toEqual([]);
  });
});
