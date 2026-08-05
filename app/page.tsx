import Dashboard from '@/components/Dashboard';
import { createServerClient } from '@/lib/supabase/server';
import { listDashboardPages } from '@/lib/content/dashboard';
import type { DashboardPage } from '@/components/Dashboard';

/**
 * The dashboard shell must render even when Supabase isn't configured yet
 * (see README "Local development") — the page feed just fails closed to
 * empty rather than crashing the route.
 */
async function loadDashboardPages(): Promise<readonly DashboardPage[]> {
  try {
    const supabase = await createServerClient();
    return await listDashboardPages(supabase);
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const pages = await loadDashboardPages();
  return <Dashboard pages={pages} />;
}
