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
import { listClassTags } from '@/lib/content/classes';
import type { WritableTag } from '@/lib/content/pages-editor';
import {
  listAssignments,
  type AssignmentSummary,
} from '@/lib/content/assignments';

/**
 * The dashboard shell must render even when Supabase isn't configured yet
 * (see README "Local development") — the page feed just fails closed to
 * empty rather than crashing the route.
 */
async function loadDashboardData(): Promise<{
  pages: readonly DashboardPage[];
  updates: readonly DashboardUpdate[];
  timetable: readonly CalendarItem[] | null;
  tasks: readonly AssignmentSummary[];
  currentUser: CurrentUserSummary | null;
  classes: readonly WritableTag[] | null;
}> {
  try {
    const supabase = await createServerClient();
    const currentUser = await getCurrentUserSummary(supabase);
    if (!currentUser)
      return {
        pages: [],
        updates: [],
        timetable: [],
        tasks: [],
        currentUser: null,
        classes: [],
      };
    const classes = await listClassTags(supabase, currentUser.role).catch(
      () => null,
    );
    const classNames = new Set(classes?.map((tag) => tag.name));
    const belongsToClass = (tag: { name: string }) =>
      currentUser.role === 'admin' || classNames.has(tag.name);
    const [pages, announcements, timetable, tasks] = await Promise.all([
      listDashboardPages(
        supabase,
        currentUser.role === 'admin'
          ? null
          : (classes ?? []).map((tag) => tag.id),
      ).catch(() => []),
      listAnnouncements(supabase, 5).catch(() => []),
      listUpcoming(supabase, 30).catch(() => null),
      listAssignments(supabase).catch(() => []),
    ]);
    const updates = announcements.map((announcement) => ({
      id: announcement.id,
      title: announcement.title,
      createdAt: announcement.createdAt,
      tags: announcement.tags.filter(belongsToClass).map((tag) => tag.name),
    }));
    return {
      pages,
      updates,
      timetable:
        timetable?.map((item) => ({
          ...item,
          tags: item.tags.filter(belongsToClass),
        })) ?? null,
      tasks: tasks.map((task) => ({
        ...task,
        tags: task.tags.filter(belongsToClass),
      })),
      currentUser,
      classes,
    };
  } catch {
    return {
      pages: [],
      updates: [],
      timetable: [],
      tasks: [],
      currentUser: null,
      classes: [],
    };
  }
}

/**
 * Formatted server-side so the dashboard's date line can't hydrate-mismatch:
 * a client-side `new Date()` renders differently on server and client.
 */
function formatTodayLabel(now: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'Europe/London',
  }).format(now);
}

export default async function HomePage() {
  const { pages, updates, timetable, tasks, currentUser, classes } =
    await loadDashboardData();
  const now = new Date();
  return (
    <Dashboard
      pages={pages}
      updates={updates}
      timetable={timetable}
      tasks={tasks}
      todayLabel={formatTodayLabel(now)}
      todayIso={now.toISOString()}
      currentUser={currentUser}
      classes={classes}
      demoMode={process.env.DEMO_MODE === 'true'}
    />
  );
}
