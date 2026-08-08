import Dashboard from '@/components/Dashboard';
import { createServerClient } from '@/lib/supabase/server';
import {
  getCurrentUserSummary,
  listDashboardPages,
  type CurrentUserSummary,
} from '@/lib/content/dashboard';
import type { DashboardPage } from '@/components/Dashboard';

/**
 * The dashboard shell must render even when Supabase isn't configured yet
 * (see README "Local development") — the page feed just fails closed to
 * empty rather than crashing the route.
 */
async function loadDashboardData(): Promise<{
  pages: readonly DashboardPage[];
  currentUser: CurrentUserSummary | null;
}> {
  try {
    const supabase = await createServerClient();
    const [pages, currentUser] = await Promise.all([
      listDashboardPages(supabase),
      getCurrentUserSummary(supabase),
    ]);
    return { pages, currentUser };
  } catch {
    return { pages: [], currentUser: null };
  }
}

export default async function HomePage() {
  const { pages, currentUser } = await loadDashboardData();
  return <Dashboard pages={pages} currentUser={currentUser} />;
}
