import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';

import { AdminRoster } from '@/components/admin/AdminRoster';
import { CreateTagForm } from '@/components/admin/CreateTagForm';
import { createServerClient } from '@/lib/supabase/server';
import { isInstitutionAdmin, listTags, listUsers } from '@/lib/content/admin';
import { listGuardianLinks } from '@/lib/content/guardians';
import type { Database } from '@/lib/database.types';

export default async function AdminPage() {
  const supabase = (await createServerClient()) as SupabaseClient<Database>;
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/');

  const admin = await isInstitutionAdmin(supabase);
  if (!admin) redirect('/');

  const [users, tags, guardianLinks] = await Promise.all([
    listUsers(supabase),
    listTags(supabase),
    listGuardianLinks(supabase),
  ]);

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <header className="sticky top-0 z-40 flex h-[68px] items-center gap-4 border-b border-slate-200 bg-white/85 px-8 backdrop-blur">
        <Link href="/" className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 transition hover:text-slate-900">
          Dashboard
        </Link>
        <span className="text-[15.5px] font-semibold tracking-tight text-slate-900">Admin</span>
      </header>

      <main className="mx-auto max-w-[900px] px-8 pb-24 pt-9">
        <CreateTagForm />

        <div className="mb-6">
          <h1 className="text-[20px] font-bold tracking-tight text-slate-900">Roster</h1>
          <p className="mt-0.5 text-[13px] text-slate-500">
            {users.length} {users.length === 1 ? 'account' : 'accounts'}. Every grant, membership, and state
            change here is audited.
          </p>
        </div>
        <AdminRoster users={users} tags={tags} guardianLinks={guardianLinks} />
      </main>
    </div>
  );
}
