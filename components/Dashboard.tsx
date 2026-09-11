'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Bell,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  FileText,
  FilePlus,
  GraduationCap,
  Megaphone,
  Plus,
  X,
} from 'lucide-react';

import { EmptyState } from '@/components/ui/EmptyState';
import { SkipToContentLink } from '@/components/ui/SkipToContentLink';
import { formatRelativeTime } from '@/lib/relative-time';
import { useClickOutside } from '@/lib/use-click-outside';
import { SearchBox } from '@/components/search/SearchBox';
import { clearAllPageRecoveries } from '@/components/pages/page-recovery';
import { PrimaryNavigation } from '@/components/ui/PrimaryNavigation';
import { PageBlocks } from '@/components/page-renderer';
import type { EditorDocumentV1 } from '@/lib/content/schema';
import type { CalendarItem } from '@/lib/content/calendar';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Role = 'admin' | 'teacher' | 'student' | 'guest';

/** Matches `PageSummary` from lib/content/dashboard.ts (Codex's typed loader). */
export interface DashboardPage {
  id: string;
  title: string;
  canonicalUrl: string;
  updatedAt: string;
  content?: EditorDocumentV1;
  tags: readonly { name: string; displayName: string }[];
}

interface PageCard {
  id: string;
  title: string;
  canonicalUrl: string;
  breadcrumb: string[];
  tags: string[];
  updatedRelative: string;
  content: EditorDocumentV1;
}

export interface CurrentUser {
  readonly email: string;
  readonly role: 'admin' | 'teacher' | 'student';
}

export interface DashboardUpdate {
  readonly id: string;
  readonly title: string;
  readonly createdAt: string;
  readonly tags: readonly string[];
}

interface DashboardProps {
  pages: readonly DashboardPage[];
  updates: readonly DashboardUpdate[];
  timetable?: readonly CalendarItem[];
  currentUser: CurrentUser | null;
}

// ---------------------------------------------------------------------------
// Pending contract — no loader exists yet for tag-targeted notifications
// (Phase 5). Kept as an explicit placeholder rather than an invented query,
// same pattern as components/page-renderer.tsx. The signed-in user chip
// below now reads the real session (see lib/content/dashboard.ts) instead
// of being a placeholder like this.
// ---------------------------------------------------------------------------

/** There's no display-name field in the schema (profiles only has email) - derives a readable name/initials from the email local-part. */
function deriveDisplayIdentity(user: CurrentUser | null): {
  name: string;
  role: Role;
  initials: string;
} {
  if (!user) return { name: 'Guest', role: 'guest', initials: '?' };
  const localPart = user.email.split('@')[0] ?? user.email;
  const words = localPart.split(/[.\-_]+/).filter(Boolean);
  const name = words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  const initials =
    words
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join('') || '?';
  return { name: name || user.email, role: user.role, initials };
}

/** Derives the breadcrumb from the one authoritative canonical path (ADR-004). */
function breadcrumbFromCanonicalUrl(canonicalUrl: string): string[] {
  return canonicalUrl
    .split('/')
    .filter(Boolean)
    .map((segment) =>
      segment
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
    );
}

function toPageCard(page: DashboardPage): PageCard {
  return {
    id: page.id,
    title: page.title,
    canonicalUrl: page.canonicalUrl,
    breadcrumb: breadcrumbFromCanonicalUrl(page.canonicalUrl),
    tags: page.tags.map((tag) => tag.name),
    updatedRelative: formatRelativeTime(page.updatedAt),
    content: page.content ?? { schemaVersion: 1, blocks: [] },
  };
}

// ---------------------------------------------------------------------------
// Shared: click-outside hook for dropdowns / FAB menu
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Top navigation
// ---------------------------------------------------------------------------

function TopNav({
  identity,
  currentUser,
  updates,
}: {
  identity: { name: string; role: Role; initials: string };
  currentUser: CurrentUser | null;
  updates: readonly DashboardUpdate[];
}) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const notifRef = useClickOutside<HTMLDivElement>(() => setNotifOpen(false));
  const profileRef = useClickOutside<HTMLDivElement>(() =>
    setProfileOpen(false),
  );

  const signedIn = currentUser !== null;

  return (
    <header className="border-brand-700 bg-brand-700 sticky top-0 z-40 border-b text-white">
      <div className="mx-auto flex min-h-20 max-w-[1280px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-8">
        <div className="flex items-center gap-2.5">
          <div className="text-brand-700 flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[15px] font-bold shadow-sm">
            M
          </div>
          <span className="text-[15.5px] font-semibold tracking-tight whitespace-nowrap text-white">
            Project M
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => {
                setNotifOpen((v) => !v);
                setProfileOpen(false);
              }}
              aria-label="Notifications"
              aria-expanded={notifOpen}
              className="relative flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-transparent text-blue-100 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
            >
              <Bell size={18} strokeWidth={2} />
            </button>

            {notifOpen && (
              <div className="fixed top-20 right-4 left-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl sm:absolute sm:top-[calc(100%+10px)] sm:right-0 sm:left-auto sm:w-[340px]">
                <div className="border-b border-slate-200 px-4 py-3 text-[12.5px] font-bold text-slate-900">
                  Tag updates
                </div>
                {updates.length === 0 ? (
                  <p className="px-4 py-5 text-[12.5px] text-slate-500">
                    No new tag updates.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {updates.map((update) => (
                      <Link
                        key={update.id}
                        href="/announcements"
                        className="block px-4 py-3 hover:bg-slate-50"
                      >
                        <span className="block text-[12.5px] font-semibold text-slate-900">
                          {update.title}
                        </span>
                        <span className="mt-1 block text-[11px] text-slate-400">
                          {update.tags.length > 0
                            ? update.tags.join(', ')
                            : 'Whole school'}{' '}
                          · {formatRelativeTime(update.createdAt)}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Profile — Outlook-style role chip */}
          {signedIn ? (
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => {
                  setProfileOpen((v) => !v);
                  setNotifOpen(false);
                }}
                aria-label={`Account for ${identity.name}`}
                aria-expanded={profileOpen}
                className="flex items-center gap-2.5 rounded-full border border-slate-200 bg-white py-1 pr-3 pl-1 transition hover:border-slate-300"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#eef3fb] text-[11.5px] font-bold text-[#254889]">
                  {identity.initials}
                </span>
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block text-[12.5px] font-semibold text-slate-900">
                    {identity.name}
                  </span>
                  <span className="block text-[10.5px] font-semibold tracking-wide text-[#254889] uppercase">
                    {identity.role}
                  </span>
                </span>
                <ChevronDown
                  size={13}
                  strokeWidth={2.4}
                  className="text-slate-400"
                />
              </button>

              {profileOpen && (
                <div className="absolute top-[calc(100%+10px)] right-0 w-[220px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
                  <div className="px-4 pt-3 pb-1 text-[12.5px] font-bold text-slate-900">
                    {identity.name}
                  </div>
                  <div className="px-4 pb-3 text-[11.5px] text-slate-500">
                    {currentUser.email}
                  </div>
                  <form
                    action="/auth/logout"
                    method="post"
                    onSubmit={clearAllPageRecoveries}
                    className="border-t border-slate-200"
                  >
                    <button className="w-full px-4 py-2.5 text-left text-[12.5px] font-medium text-[#a8402f] hover:bg-slate-50">
                      Sign out
                    </button>
                  </form>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/auth/login"
              className="rounded-lg bg-[#254889] px-4 py-2 text-[12.5px] font-semibold text-white transition hover:bg-[#1d386c]"
            >
              Sign in with Microsoft
            </Link>
          )}
        </div>
      </div>
      {signedIn && (
        <div className="border-t border-white/15">
          <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-3 px-4 py-3 sm:px-8">
            <PrimaryNavigation
              isAdmin={currentUser.role === 'admin'}
              align="left"
            />
            <SearchBox />
          </div>
        </div>
      )}
    </header>
  );
}

// ---------------------------------------------------------------------------
// Tag rail
// ---------------------------------------------------------------------------

interface TagSummary {
  id: string;
  name: string;
  pageCount: number;
}

function TagRail({
  tags,
  activeTag,
  onSelect,
}: {
  tags: readonly TagSummary[];
  activeTag: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="mb-6">
      <p className="mb-2.5 text-[11px] font-bold tracking-wider text-slate-600 uppercase">
        Filter by tag
      </p>
      <div className="flex [scrollbar-width:thin] gap-2 overflow-x-auto pb-1">
        {tags.map((tag) => {
          const active = tag.id === activeTag;
          return (
            <button
              key={tag.id}
              onClick={() => onSelect(tag.id)}
              aria-pressed={active}
              className={`flex min-h-10 flex-shrink-0 items-center gap-1.5 rounded-lg border px-3.5 text-[12.5px] font-semibold whitespace-nowrap transition ${
                active
                  ? 'border-[#254889] bg-[#254889] text-white'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              {tag.name}
              <span className={active ? 'opacity-70' : 'text-slate-500'}>
                {tag.pageCount}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page / file card
// ---------------------------------------------------------------------------

function PageCardItem({
  page,
  onPreview,
}: {
  page: PageCard;
  onPreview: (page: PageCard) => void;
}) {
  return (
    <Link
      href={page.canonicalUrl}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
          return;
        event.preventDefault();
        onPreview(page);
      }}
      className="group hover:border-brand-200 flex min-w-0 flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 text-left transition duration-200 hover:shadow-[0_8px_24px_-12px_rgba(37,72,137,0.22)]"
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="bg-brand-100 text-brand-700 flex h-9 w-9 items-center justify-center rounded-lg">
          <FileText size={17} strokeWidth={2} />
        </div>
        <ArrowUpRight
          size={18}
          aria-hidden="true"
          className="group-hover:text-brand-600 text-slate-400 transition"
        />
      </div>

      <div>
        <p className="text-base leading-snug font-semibold tracking-tight text-slate-900">
          {page.title}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1 text-xs text-slate-500">
          {page.breadcrumb.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span className="opacity-60">/</span>}
              <span
                className={
                  i === page.breadcrumb.length - 1
                    ? 'font-semibold text-slate-500'
                    : ''
                }
              >
                {crumb}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {page.tags.map((t) => (
          <span
            key={t}
            className="flex h-6 items-center rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-bold text-slate-600"
          >
            {t}
          </span>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-slate-200 pt-3 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span suppressHydrationWarning>{page.updatedRelative}</span>
        </span>
        <span className="text-brand-600 font-medium">Preview page</span>
      </div>
    </Link>
  );
}

function PagePreview({
  page,
  onClose,
}: {
  page: PageCard;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    closeRef.current?.focus();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-modal="true"
      onClose={(event) => {
        if (!event.currentTarget.open) onClose();
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-transparent p-0 backdrop:bg-slate-950/30"
      aria-label={`Preview ${page.title}`}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        tabIndex={-1}
        aria-hidden="true"
      />
      <section className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-slate-200 bg-white shadow-2xl md:w-1/2">
        <header className="flex min-h-16 items-center justify-between gap-4 border-b border-slate-200 px-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-brand-600 text-xs font-semibold">Page preview</p>
            <h2 className="truncate text-base font-semibold text-slate-950">
              {page.title}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={page.canonicalUrl}
              aria-label="Open full page"
              className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:border-slate-300"
            >
              <ExternalLink size={16} aria-hidden="true" />
              <span className="hidden sm:inline">Open full page</span>
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-950"
              ref={closeRef}
              aria-label="Close page preview"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-8">
          <article className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
            <h1 className="mb-8 text-3xl font-semibold tracking-tight text-slate-950">
              {page.title}
            </h1>
            <PageBlocks content={page.content} files={{}} />
          </article>
        </div>
      </section>
    </dialog>
  );
}

const timetableDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

const timetableTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  hour: '2-digit',
  minute: '2-digit',
});

const lessonPeriods = [
  '08:45–09:35',
  '09:40–10:30',
  '10:50–11:40',
  '11:45–12:35',
  '13:35–14:25',
  '14:30–15:20',
] as const;

const schoolDays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
] as const;

const lessonDetails = {
  MA: {
    subject: 'Mathematics',
    room: 'M12',
    href: '/maths-quadratic-equations',
    tone: 'bg-brand-50 hover:bg-brand-100',
  },
  EN: {
    subject: 'English',
    room: 'E4',
    href: '/english-persuasive-writing',
    tone: 'bg-brand-50 hover:bg-brand-100',
  },
  CH: {
    subject: 'Chemistry',
    room: 'Lab 3',
    href: '/chemistry-atomic-structure',
    tone: 'bg-brand-50 hover:bg-brand-100',
  },
  HI: {
    subject: 'History',
    room: 'H7',
    href: '/history-industrial-revolution',
    tone: 'bg-brand-50 hover:bg-brand-100',
  },
  GE: {
    subject: 'Geography',
    room: 'G5',
    href: '/geography-river-landscapes',
    tone: 'bg-brand-50 hover:bg-brand-100',
  },
  PH: {
    subject: 'Physics',
    room: 'Lab 1',
    href: '/physics-forces-motion',
    tone: 'bg-brand-50 hover:bg-brand-100',
  },
  BI: {
    subject: 'Biology',
    room: 'Lab 5',
    href: '/biology-cell-division',
    tone: 'bg-brand-50 hover:bg-brand-100',
  },
  FR: {
    subject: 'French',
    room: 'L8',
    href: '/french-perfect-tense',
    tone: 'bg-brand-50 hover:bg-brand-100',
  },
  CS: {
    subject: 'Computer Science',
    room: 'ICT 2',
    href: '/computer-science-algorithms',
    tone: 'bg-brand-50 hover:bg-brand-100',
  },
  PE: {
    subject: 'PE',
    room: 'Sports Hall',
    href: '/calendar',
    tone: 'bg-slate-100 hover:bg-slate-200',
  },
  AR: {
    subject: 'Art',
    room: 'Art 2',
    href: '/calendar',
    tone: 'bg-slate-100 hover:bg-slate-200',
  },
  PS: {
    subject: 'PSHE',
    room: 'Form room',
    href: '/calendar',
    tone: 'bg-slate-100 hover:bg-slate-200',
  },
} as const;

type LessonCode = keyof typeof lessonDetails;
type TimetableWeek = 'A' | 'B';
type WeekSchedule = readonly [
  readonly LessonCode[],
  readonly LessonCode[],
  readonly LessonCode[],
  readonly LessonCode[],
  readonly LessonCode[],
];

const fixedTimetable: Record<TimetableWeek, WeekSchedule> = {
  A: [
    ['MA', 'EN', 'CH', 'HI', 'FR', 'PE'],
    ['BI', 'MA', 'GE', 'EN', 'CS', 'AR'],
    ['PH', 'FR', 'MA', 'CH', 'EN', 'PS'],
    ['HI', 'CS', 'BI', 'MA', 'GE', 'PE'],
    ['EN', 'PH', 'FR', 'HI', 'MA', 'CH'],
  ],
  B: [
    ['EN', 'MA', 'BI', 'GE', 'CS', 'AR'],
    ['CH', 'FR', 'HI', 'MA', 'PE', 'EN'],
    ['MA', 'PH', 'CS', 'FR', 'BI', 'PS'],
    ['GE', 'EN', 'MA', 'CH', 'HI', 'PE'],
    ['FR', 'BI', 'PH', 'EN', 'CS', 'MA'],
  ],
};

function StudentTimetable({ items }: { items: readonly CalendarItem[] }) {
  const [week, setWeek] = useState<TimetableWeek>('A');

  return (
    <section
      className="mt-12 border-t border-slate-200 pt-8"
      aria-labelledby="timetable-heading"
    >
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-brand-600 text-xs font-bold tracking-wide uppercase">
            Plan your week
          </p>
          <h2
            id="timetable-heading"
            className="mt-1 text-xl font-bold tracking-tight text-slate-950"
          >
            Example timetable
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="flex rounded-lg border border-slate-200 bg-white p-1"
            aria-label="Timetable week"
          >
            {(['A', 'B'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setWeek(value)}
                aria-pressed={week === value}
                className={`min-h-9 rounded-md px-4 text-sm font-semibold ${week === value ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                Week {value}
              </button>
            ))}
          </div>
          <Link
            href="/calendar"
            className="text-brand-600 hover:text-brand-700 text-sm font-semibold"
          >
            View calendar
          </Link>
        </div>
      </div>

      <div
        className="overflow-x-auto rounded-xl border border-slate-200 bg-white"
        role="region"
        aria-label={`Week ${week} timetable, scrollable horizontally`}
        tabIndex={0}
      >
        <table className="w-full min-w-[1050px] table-fixed border-collapse text-left">
          <caption className="sr-only">
            Week {week} timetable with weekdays as rows and lesson times as
            columns
          </caption>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100">
              <th
                scope="col"
                className="w-28 px-4 py-3 text-xs font-bold tracking-wide text-slate-600 uppercase"
              >
                Day
              </th>
              {lessonPeriods.map((period, index) => (
                <th
                  key={period}
                  scope="col"
                  className="border-l border-slate-200 px-3 py-3 text-xs font-semibold text-slate-600"
                >
                  <span className="block text-slate-950">
                    Period {index + 1}
                  </span>
                  <span className="mt-0.5 block font-medium">{period}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {schoolDays.map((day, dayIndex) => (
              <tr key={day}>
                <th
                  scope="row"
                  className="bg-slate-50 px-4 py-4 text-sm font-bold text-slate-950"
                >
                  {day}
                </th>
                {fixedTimetable[week][dayIndex]!.map((code, periodIndex) => {
                  const lesson = lessonDetails[code];
                  return (
                    <td
                      key={`${day}-${periodIndex}`}
                      className="border-l border-slate-200 p-1.5 align-top"
                    >
                      <Link
                        href={lesson.href}
                        className={`block min-h-20 rounded-lg p-2.5 transition ${lesson.tone}`}
                      >
                        <span className="block text-sm font-semibold text-slate-950">
                          {lesson.subject}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {lesson.room}
                        </span>
                      </Link>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 flex items-center justify-between gap-4">
        <h3 className="text-base font-bold text-slate-950">
          Upcoming deadlines
        </h3>
        <Link
          href="/calendar"
          className="text-brand-600 hover:text-brand-700 text-sm font-semibold"
        >
          View all
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white px-5 py-6 text-sm text-slate-600">
          No deadlines are scheduled yet.
        </div>
      ) : (
        <div className="mt-3 grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const href =
              item.kind === 'assignment'
                ? `/assignments/${item.id}`
                : item.kind === 'quiz'
                  ? `/quizzes/${item.id}`
                  : '/calendar';
            const starts = new Date(item.at);
            return (
              <Link
                key={`${item.kind}:${item.id}`}
                href={href}
                className="group hover:bg-brand-50/40 bg-white p-5"
              >
                <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays size={15} aria-hidden="true" />
                    {timetableDate.format(starts)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock3 size={15} aria-hidden="true" />
                    {timetableTime.format(starts)}
                  </span>
                </div>
                <h3 className="group-hover:text-brand-700 mt-4 font-semibold text-slate-950">
                  {item.title}
                </h3>
                <p className="mt-1 text-xs font-semibold text-slate-500 capitalize">
                  {item.kind === 'event' ? 'Lesson or event' : item.kind}
                  {item.tags.length > 0
                    ? ` · ${item.tags.map((tag) => tag.name).join(', ')}`
                    : ''}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ClassConnection({ role }: { role: CurrentUser['role'] }) {
  const actions =
    role === 'student'
      ? [
          {
            href: '/assignments',
            title: 'Send work and a note',
            description: 'Submit your work with a message for your teacher.',
            icon: ClipboardCheck,
          },
          {
            href: '/gradebook',
            title: 'Review teacher feedback',
            description: 'See released marks and guidance on your work.',
            icon: GraduationCap,
          },
          {
            href: '/announcements',
            title: 'Read class updates',
            description: 'Keep up with announcements for your tags.',
            icon: Megaphone,
          },
        ]
      : [
          {
            href: '/assignments',
            title: 'Review student work',
            description: 'Open submissions and respond with clear feedback.',
            icon: ClipboardCheck,
          },
          {
            href: '/gradebook',
            title: 'Give marks and feedback',
            description: 'Track progress and release feedback to pupils.',
            icon: GraduationCap,
          },
          {
            href: '/announcements',
            title: 'Post a class update',
            description: 'Share a tag-scoped update with the right pupils.',
            icon: Megaphone,
          },
        ];

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-6"
      aria-labelledby="connection-heading"
    >
      <p className="text-brand-600 text-xs font-bold tracking-wide uppercase">
        Your workspace
      </p>
      <h2
        id="connection-heading"
        className="mt-1 text-xl font-bold tracking-tight text-slate-950"
      >
        Class tools
      </h2>
      <div className="mt-5 grid divide-y divide-slate-100">
        {actions.map(({ href, title, description, icon: Icon }) => (
          <Link
            key={title}
            href={href}
            className="group flex items-start gap-3 py-5 first:pt-0 last:pb-0"
          >
            <span className="bg-brand-50 text-brand-600 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
              <Icon size={19} aria-hidden="true" />
            </span>
            <span>
              <span className="group-hover:text-brand-700 block font-semibold text-slate-950">
                {title}
              </span>
              <span className="mt-1 block text-sm leading-5 text-slate-600">
                {description}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Floating action button
// ---------------------------------------------------------------------------

function FloatingActionButton() {
  const [open, setOpen] = useState(false);
  const menuRef = useClickOutside<HTMLDivElement>(() => setOpen(false));

  return (
    <div
      className="fixed right-8 bottom-8 z-50 flex flex-col items-end gap-3"
      ref={menuRef}
    >
      {open && (
        <div className="w-[240px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
          <Link
            href="/pages/new"
            className="flex w-full items-center gap-3 px-[15px] py-3.5 text-left hover:bg-slate-50"
          >
            <span className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-lg bg-[#eef3fb] text-[#254889]">
              <FilePlus size={16} strokeWidth={2} />
            </span>
            <span className="flex flex-col">
              <span className="text-[12.5px] font-semibold text-slate-900">
                New page
              </span>
              <span className="text-[10.5px] text-slate-400">Block editor</span>
            </span>
          </Link>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Create"
        aria-expanded={open}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[#254889] text-white shadow-[0_10px_24px_rgba(37,72,137,0.28)] transition hover:bg-[#1d386c] active:scale-95"
      >
        {open ? (
          <X size={22} strokeWidth={2.4} />
        ) : (
          <Plus size={22} strokeWidth={2.4} />
        )}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export default function Dashboard({
  pages,
  updates,
  timetable = [],
  currentUser,
}: DashboardProps) {
  const [activeTag, setActiveTag] = useState('all');
  const [previewPage, setPreviewPage] = useState<PageCard | null>(null);

  const identity = useMemo(
    () => deriveDisplayIdentity(currentUser),
    [currentUser],
  );

  const cards = useMemo(() => pages.map(toPageCard), [pages]);

  const tags = useMemo<TagSummary[]>(() => {
    const counts = new Map<string, number>();
    for (const card of cards) {
      for (const tag of card.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [
      { id: 'all', name: 'All pages', pageCount: cards.length },
      ...Array.from(counts, ([name, pageCount]) => ({
        id: name,
        name,
        pageCount,
      })).sort((a, b) => a.name.localeCompare(b.name)),
    ];
  }, [cards]);

  const visiblePages = cards.filter(
    (p) => activeTag === 'all' || p.tags.includes(activeTag),
  );

  return (
    <div className="min-h-[100dvh] bg-slate-50">
      <SkipToContentLink />
      <TopNav identity={identity} currentUser={currentUser} updates={updates} />

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-[1280px] px-4 pt-10 pb-32 sm:px-8"
      >
        <div className="mb-9 flex flex-col justify-between gap-6 border-b border-slate-200 pb-8 sm:flex-row sm:items-end">
          <div>
            <p className="text-brand-600 mb-3 text-xs font-semibold tracking-[0.16em] uppercase">
              Merchant Taylors’ School
            </p>
            <h1 className="text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">
              {currentUser
                ? `Welcome back, ${identity.name.split(' ')[0]}`
                : 'Welcome to Project M'}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {currentUser
                ? 'Pick up where you left off. Your learning starts here.'
                : 'Sign in with your school Microsoft account to access your pages and files.'}
            </p>
          </div>
          {currentUser && (
            <Link
              href="/calendar"
              className="hover:border-brand-200 hover:text-brand-700 flex min-h-11 shrink-0 items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition sm:self-auto"
            >
              <CalendarDays size={17} aria-hidden="true" />
              View calendar
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          )}
        </div>

        {!currentUser ? (
          <section
            className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white md:grid-cols-[1.2fr_1fr]"
            aria-labelledby="welcome-heading"
          >
            <div className="p-8 sm:p-12">
              <div className="bg-brand-50 text-brand-600 mb-8 flex h-12 w-12 items-center justify-center rounded-xl">
                <GraduationCap size={25} aria-hidden="true" />
              </div>
              <h2
                id="welcome-heading"
                className="max-w-sm text-3xl leading-tight font-semibold tracking-tight text-slate-950 sm:text-4xl"
              >
                A little more focus.
                <br />A lot more learning.
              </h2>
              <p className="mt-5 max-w-md text-base leading-7 text-slate-600">
                Your lessons, coursework and class updates, together in one
                place.
              </p>
              <Link
                href="/auth/login"
                className="bg-brand-600 hover:bg-brand-700 mt-8 inline-flex min-h-12 items-center gap-6 rounded-lg px-5 text-sm font-semibold text-white transition"
              >
                Access your workspace
                <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
              <p className="mt-4 text-xs leading-5 text-slate-500">
                Use your school Microsoft account to get started.
              </p>
            </div>
            <div className="flex flex-col justify-center border-t border-slate-200 bg-slate-50 p-8 sm:p-12 md:border-t-0 md:border-l">
              <p className="text-brand-600 mb-6 text-xs font-semibold tracking-[0.16em] uppercase">
                One place for your school day
              </p>
              <div className="divide-y divide-slate-200">
                <div className="py-5">
                  <FileText
                    size={20}
                    className="text-brand-600 mb-3"
                    aria-hidden="true"
                  />
                  <h3 className="font-semibold">Find your next lesson</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Pages and resources organised around your class tags.
                  </p>
                </div>
                <div className="py-5">
                  <ClipboardCheck
                    size={20}
                    className="text-brand-600 mb-3"
                    aria-hidden="true"
                  />
                  <h3 className="font-semibold">Keep your work moving</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Assignments, deadlines and feedback in your workspace.
                  </p>
                </div>
                <div className="pt-5">
                  <Megaphone
                    size={20}
                    className="text-brand-600 mb-3"
                    aria-hidden="true"
                  />
                  <h3 className="font-semibold">Stay in the loop</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Read the latest updates shared with your classes.
                  </p>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
            <section className="min-w-0" aria-labelledby="pages-heading">
              <div className="mb-5 flex items-end justify-between gap-3">
                <div>
                  <h2
                    id="pages-heading"
                    className="text-xl font-semibold tracking-tight text-slate-950"
                  >
                    Pages &amp; files
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Recently updated in your tags
                  </p>
                </div>
                {currentUser && (
                  <Link
                    href="/resources"
                    className="text-brand-600 shrink-0 text-sm font-semibold hover:underline"
                  >
                    View all <span aria-hidden="true">→</span>
                  </Link>
                )}
              </div>
              <TagRail
                tags={tags}
                activeTag={activeTag}
                onSelect={setActiveTag}
              />

              {visiblePages.length === 0 ? (
                <EmptyState
                  icon={<FileText size={20} strokeWidth={2} />}
                  title={
                    cards.length === 0
                      ? 'No pages yet'
                      : 'No pages match this tag'
                  }
                  description={
                    cards.length === 0
                      ? 'Published pages you can access will appear here once teachers start publishing content.'
                      : 'Try a different tag, or select "All pages" to see everything you have access to.'
                  }
                />
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {visiblePages.map((page) => (
                    <PageCardItem
                      key={page.id}
                      page={page}
                      onPreview={setPreviewPage}
                    />
                  ))}
                </div>
              )}
            </section>
            {currentUser && <ClassConnection role={currentUser.role} />}
          </div>
        )}

        {currentUser?.role === 'student' && (
          <StudentTimetable items={timetable} />
        )}
      </main>

      {(currentUser?.role === 'teacher' || currentUser?.role === 'admin') && (
        <FloatingActionButton />
      )}
      {previewPage && (
        <PagePreview page={previewPage} onClose={() => setPreviewPage(null)} />
      )}
    </div>
  );
}
