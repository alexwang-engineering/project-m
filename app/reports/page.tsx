import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createServerClient } from '@/lib/supabase/server';
import { isInstitutionAdmin } from '@/lib/content/admin';
import { getContentSummary, getRosterSummary } from '@/lib/content/reports';
import { ReportsView } from '@/components/reports/ReportsView';
import type { Database } from '@/lib/database.types';

export default async function ReportsPage() {
  const supabase = (await createServerClient()) as SupabaseClient<Database>;
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/');

  const admin = await isInstitutionAdmin(supabase);
  if (!admin) redirect('/');

  const [rosterSummary, contentSummary] = await Promise.all([
    getRosterSummary(supabase),
    getContentSummary(supabase),
  ]);

  return <ReportsView rosterSummary={rosterSummary} contentSummary={contentSummary} />;
}
