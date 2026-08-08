import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';

import { AdminRoster } from '@/components/admin/AdminRoster';
import { CreateTagForm } from '@/components/admin/CreateTagForm';
import { MigrationImportPanel } from '@/components/admin/MigrationImportPanel';
import { RosterSyncPanel } from '@/components/admin/RosterSyncPanel';
import { SkipToContentLink } from '@/components/ui/SkipToContentLink';
import { SubPageHeader } from '@/components/ui/SubPageHeader';
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
      <SkipToContentLink />
      <SubPageHeader
        backHref="/"
        backLabel="Dashboard"
        title="Admin"
        actions={
          <Link
            href="/reports"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12.5px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
          >
            Reports
          </Link>
        }
      />

      <main id="main-content" className="mx-auto max-w-[900px] px-8 pt-9 pb-24">
        <CreateTagForm />
        <RosterSyncPanel />
        <MigrationImportPanel />

        <div className="mb-6">
          <h1 className="text-[20px] font-bold tracking-tight text-slate-900">
            Roster
          </h1>
          <p className="mt-0.5 text-[13px] text-slate-500">
            {users.length} {users.length === 1 ? 'account' : 'accounts'}. Every
            grant, membership, and state change here is audited.
          </p>
        </div>
        <AdminRoster users={users} tags={tags} guardianLinks={guardianLinks} />
      </main>
    </div>
  );
}
