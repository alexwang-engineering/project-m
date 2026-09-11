import Dashboard from '@/components/Dashboard';
import { createServerClient } from '@/lib/supabase/server';
import {
  getCurrentUserSummary,
  listDashboardPages,
  type CurrentUserSummary,
} from '@/lib/content/dashboard';
import type { DashboardPage, DashboardUpdate } from '@/components/Dashboard';
import { listAnnouncements } from '@/lib/content/announcements';
import { listUpcoming, type CalendarItem } from '@/lib/content/calendar';

/**
 * The dashboard shell must render even when Supabase isn't configured yet
 * (see README "Local development") — the page feed just fails closed to
 * empty rather than crashing the route.
 */
async function loadDashboardData(): Promise<{
  pages: readonly DashboardPage[];
  updates: readonly DashboardUpdate[];
  timetable: readonly CalendarItem[];
  currentUser: CurrentUserSummary | null;
}> {
  try {
    const supabase = await createServerClient();
    const currentUser = await getCurrentUserSummary(supabase);
    if (!currentUser)
      return { pages: [], updates: [], timetable: [], currentUser: null };
    const [pages, announcements, timetable] = await Promise.all([
      listDashboardPages(supabase),
      listAnnouncements(supabase, 5),
      currentUser.role === 'student' ? listUpcoming(supabase, 6) : [],
    ]);
    const updates = announcements.map((announcement) => ({
      id: announcement.id,
      title: announcement.title,
      createdAt: announcement.createdAt,
      tags: announcement.tags.map((tag) => tag.name),
    }));
    return { pages, updates, timetable, currentUser };
  } catch {
    return { pages: [], updates: [], timetable: [], currentUser: null };
  }
}

export default async function HomePage() {
  const { pages, updates, timetable, currentUser } = await loadDashboardData();
  return (
    <Dashboard
      pages={pages}
      updates={updates}
      timetable={timetable}
      currentUser={currentUser}
    />
  );
}
