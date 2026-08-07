import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';

import { AdminRoster } from '@/components/admin/AdminRoster';
import { createServerClient } from '@/lib/supabase/server';
import { listTags, listUsers } from '@/lib/content/admin';
import type { Database } from '@/lib/database.types';

/**
 * Not itself a security boundary - the four RPCs behind this page enforce
 * institution_admin server-side regardless of what this check shows. This
 * only avoids presenting a confusing near-empty roster to a non-admin
 * (RLS would otherwise just filter `listUsers` down to their own row).
 */
async function isInstitutionAdmin(client: SupabaseClient<Database>): Promise<boolean> {
  const { data } = await client
    .from('role_assignments')
    .select('role')
    .eq('role', 'institution_admin');
  return (data ?? []).length > 0;
}

export default async function AdminPage() {
  const supabase = (await createServerClient()) as SupabaseClient<Database>;
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/');

  const admin = await isInstitutionAdmin(supabase);
  if (!admin) redirect('/');

  const [users, tags] = await Promise.all([listUsers(supabase), listTags(supabase)]);

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <header className="sticky top-0 z-40 flex h-[68px] items-center gap-4 border-b border-slate-200 bg-white/85 px-8 backdrop-blur">
        <Link href="/" className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 transition hover:text-slate-900">
          Dashboard
        </Link>
        <span className="text-[15.5px] font-semibold tracking-tight text-slate-900">Admin</span>
      </header>

      <main className="mx-auto max-w-[900px] px-8 pb-24 pt-9">
        <div className="mb-6">
          <h1 className="text-[20px] font-bold tracking-tight text-slate-900">Roster</h1>
          <p className="mt-0.5 text-[13px] text-slate-500">
            {users.length} {users.length === 1 ? 'account' : 'accounts'}. Every grant, membership, and state
            change here is audited.
          </p>
        </div>
        <AdminRoster users={users} tags={tags} />
      </main>
    </div>
  );
}
