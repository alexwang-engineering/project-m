'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
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
  const profileRef = useClickOutside<HTMLDivElement>(() => setProfileOpen(false));

  const signedIn = currentUser !== null;

  return (
    <header className="bg-brand-600 sticky top-0 z-40 border-b border-brand-700 text-white shadow-sm">
      <div className="mx-auto flex min-h-16 max-w-[1280px] items-center justify-between gap-3 px-4 sm:px-8">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[15px] font-bold text-brand-700 shadow-sm">
          M
        </div>
        <span className="whitespace-nowrap text-[15.5px] font-semibold tracking-tight text-white">
          Project M
        </span>
        {signedIn && (
          <div className="ml-4">
            <PrimaryNavigation isAdmin={currentUser?.role === 'admin'} />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {signedIn && <SearchBox />}
        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => {
              setNotifOpen((v) => !v);
              setProfileOpen(false);
            }}
            aria-label="Notifications"
            className="relative flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-transparent text-blue-100 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
          >
            <Bell size={18} strokeWidth={2} />
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-[calc(100%+10px)] w-[340px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
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
            className="flex items-center gap-2.5 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 transition hover:border-slate-300"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#eef3fb] text-[11.5px] font-bold text-[#254889]">
              {identity.initials}
            </span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block text-[12.5px] font-semibold text-slate-900">{identity.name}</span>
              <span className="block text-[10.5px] font-semibold uppercase tracking-wide text-[#254889]">
                {identity.role}
              </span>
            </span>
            <ChevronDown size={13} strokeWidth={2.4} className="text-slate-400" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-[calc(100%+10px)] w-[220px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
              <div className="px-4 pb-1 pt-3 text-[12.5px] font-bold text-slate-900">{identity.name}</div>
              <div className="px-4 pb-3 text-[11.5px] text-slate-500">{currentUser.email}</div>
              <form action="/auth/logout" method="post" onSubmit={clearAllPageRecoveries} className="border-t border-slate-200">
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
    <div className="mb-8">
      <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-600">Your tags</p>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {tags.map((tag) => {
          const active = tag.id === activeTag;
          return (
            <button
              key={tag.id}
              onClick={() => onSelect(tag.id)}
              className={`flex h-[34px] flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[12.5px] font-semibold transition ${
                active
                  ? 'border-[#254889] bg-[#254889] text-white'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              {tag.name}
              <span className={active ? 'opacity-70' : 'text-slate-400'}>{tag.pageCount}</span>
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
        event.preventDefault();
        onPreview(page);
      }}
      className="hover:border-brand-500 hover:bg-brand-50/20 flex flex-col gap-3 rounded-xl border border-t-[3px] border-slate-200 border-t-brand-500 bg-white p-5 text-left transition"
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
          <FileText size={17} strokeWidth={2} />
        </div>
      </div>

      <div>
        <p className="text-[14px] font-semibold leading-snug tracking-tight text-slate-900">{page.title}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[11.5px] text-slate-400">
          {page.breadcrumb.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span className="opacity-60">/</span>}
              <span className={i === page.breadcrumb.length - 1 ? 'font-semibold text-slate-500' : ''}>{crumb}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {page.tags.map((t) => (
          <span key={t} className="flex h-6 items-center rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-bold text-slate-600">
            {t}
          </span>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-slate-200 pt-3 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span suppressHydrationWarning>{page.updatedRelative}</span>
        </span>
        <span>Page</span>
      </div>
    </Link>
  );
}

function PagePreview({ page, onClose }: { page: PageCard; onClose: () => void }) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/20" role="dialog" aria-modal="true" aria-label={`Preview ${page.title}`}>
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
            <p className="text-xs font-semibold text-brand-600">Page preview</p>
            <h2 className="truncate text-base font-semibold text-slate-950">{page.title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={page.canonicalUrl}
              className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:border-slate-300"
            >
              <ExternalLink size={16} aria-hidden="true" />
              <span className="hidden sm:inline">Open full page</span>
            </Link>
            <button
              type="button"
              onClick={onClose}
              autoFocus
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-950"
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
    </div>
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

const schoolDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;

const lessonDetails = {
  MA: { subject: 'Mathematics', room: 'M12', href: '/maths-quadratic-equations', tone: 'bg-brand-50 hover:bg-brand-100' },
  EN: { subject: 'English', room: 'E4', href: '/english-persuasive-writing', tone: 'bg-brand-50 hover:bg-brand-100' },
  CH: { subject: 'Chemistry', room: 'Lab 3', href: '/chemistry-atomic-structure', tone: 'bg-teal-50 hover:bg-teal-100' },
  HI: { subject: 'History', room: 'H7', href: '/history-industrial-revolution', tone: 'bg-amber-50 hover:bg-amber-100' },
  GE: { subject: 'Geography', room: 'G5', href: '/geography-river-landscapes', tone: 'bg-amber-50 hover:bg-amber-100' },
  PH: { subject: 'Physics', room: 'Lab 1', href: '/physics-forces-motion', tone: 'bg-teal-50 hover:bg-teal-100' },
  BI: { subject: 'Biology', room: 'Lab 5', href: '/biology-cell-division', tone: 'bg-teal-50 hover:bg-teal-100' },
  FR: { subject: 'French', room: 'L8', href: '/french-perfect-tense', tone: 'bg-brand-50 hover:bg-brand-100' },
  CS: { subject: 'Computer Science', room: 'ICT 2', href: '/computer-science-algorithms', tone: 'bg-brand-50 hover:bg-brand-100' },
  PE: { subject: 'PE', room: 'Sports Hall', href: '/calendar', tone: 'bg-slate-100 hover:bg-slate-200' },
  AR: { subject: 'Art', room: 'Art 2', href: '/calendar', tone: 'bg-slate-100 hover:bg-slate-200' },
  PS: { subject: 'PSHE', room: 'Form room', href: '/calendar', tone: 'bg-slate-100 hover:bg-slate-200' },
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
    <section className="mt-12 border-t border-slate-200 pt-8" aria-labelledby="timetable-heading">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold tracking-wide text-brand-600 uppercase">Lessons and deadlines</p>
          <h2 id="timetable-heading" className="mt-1 text-xl font-bold tracking-tight text-slate-950">
            Your timetable
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-slate-200 bg-white p-1" aria-label="Timetable week">
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
          <Link href="/calendar" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
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
          <caption className="sr-only">Week {week} timetable with weekdays as rows and lesson times as columns</caption>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100">
              <th scope="col" className="w-28 px-4 py-3 text-xs font-bold tracking-wide text-slate-600 uppercase">
                Day
              </th>
              {lessonPeriods.map((period, index) => (
                <th key={period} scope="col" className="border-l border-slate-200 px-3 py-3 text-xs font-semibold text-slate-600">
                  <span className="block text-slate-950">Period {index + 1}</span>
                  <span className="mt-0.5 block font-medium">{period}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {schoolDays.map((day, dayIndex) => (
              <tr key={day}>
                <th scope="row" className="bg-slate-50 px-4 py-4 text-sm font-bold text-slate-950">
                  {day}
                </th>
                {fixedTimetable[week][dayIndex]!.map((code, periodIndex) => {
                  const lesson = lessonDetails[code];
                  return (
                    <td key={`${day}-${periodIndex}`} className="border-l border-slate-200 p-1.5 align-top">
                      <Link href={lesson.href} className={`block min-h-20 rounded-lg p-2.5 transition ${lesson.tone}`}>
                        <span className="block text-sm font-semibold text-slate-950">{lesson.subject}</span>
                        <span className="mt-1 block text-xs text-slate-500">{lesson.room}</span>
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
        <h3 className="text-base font-bold text-slate-950">Upcoming deadlines</h3>
        <Link href="/calendar" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
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
              <Link key={`${item.kind}:${item.id}`} href={href} className="group bg-white p-5 hover:bg-brand-50/40">
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
                <h3 className="mt-4 font-semibold text-slate-950 group-hover:text-brand-700">{item.title}</h3>
                <p className="mt-1 text-xs font-semibold text-slate-500 capitalize">
                  {item.kind === 'event' ? 'Lesson or event' : item.kind}
                  {item.tags.length > 0 ? ` · ${item.tags.map((tag) => tag.name).join(', ')}` : ''}
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
            tone: 'bg-blue-100 text-blue-700',
          },
          {
            href: '/gradebook',
            title: 'Review teacher feedback',
            description: 'See released marks and guidance on your work.',
            icon: GraduationCap,
            tone: 'bg-emerald-100 text-emerald-700',
          },
          {
            href: '/announcements',
            title: 'Read class updates',
            description: 'Keep up with announcements for your tags.',
            icon: Megaphone,
            tone: 'bg-amber-100 text-amber-800',
          },
        ]
      : [
          {
            href: '/assignments',
            title: 'Review student work',
            description: 'Open submissions and respond with clear feedback.',
            icon: ClipboardCheck,
            tone: 'bg-blue-100 text-blue-700',
          },
          {
            href: '/gradebook',
            title: 'Give marks and feedback',
            description: 'Track progress and release feedback to pupils.',
            icon: GraduationCap,
            tone: 'bg-emerald-100 text-emerald-700',
          },
          {
            href: '/announcements',
            title: 'Post a class update',
            description: 'Share a tag-scoped update with the right pupils.',
            icon: Megaphone,
            tone: 'bg-amber-100 text-amber-800',
          },
        ];

  return (
    <section className="mt-12 border-t border-slate-200 pt-8" aria-labelledby="connection-heading">
      <p className="text-xs font-bold tracking-wide text-brand-600 uppercase">Student and teacher interaction</p>
      <h2 id="connection-heading" className="mt-1 text-xl font-bold tracking-tight text-slate-950">
        Class connection
      </h2>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {actions.map(({ href, title, description, icon: Icon, tone }) => (
          <Link
            key={title}
            href={href}
            className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 transition hover:border-brand-500 hover:bg-brand-50/30"
          >
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>
              <Icon size={19} aria-hidden="true" />
            </span>
            <span>
              <span className="block font-semibold text-slate-950 group-hover:text-brand-700">{title}</span>
              <span className="mt-1 block text-sm leading-5 text-slate-600">{description}</span>
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
    <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-3" ref={menuRef}>
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
              <span className="text-[12.5px] font-semibold text-slate-900">New page</span>
              <span className="text-[10.5px] text-slate-400">Block editor</span>
            </span>
          </Link>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Create"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[#254889] text-white shadow-[0_10px_24px_rgba(37,72,137,0.28)] transition hover:bg-[#1d386c] active:scale-95"
      >
        {open ? <X size={22} strokeWidth={2.4} /> : <Plus size={22} strokeWidth={2.4} />}
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
      ...Array.from(counts, ([name, pageCount]) => ({ id: name, name, pageCount })).sort(
        (a, b) => a.name.localeCompare(b.name),
      ),
    ];
  }, [cards]);

  const visiblePages = cards.filter((p) => activeTag === 'all' || p.tags.includes(activeTag));

  return (
    <div className="min-h-[100dvh] bg-slate-50">
      <SkipToContentLink />
      <TopNav
        identity={identity}
        currentUser={currentUser}
        updates={updates}
      />

      <main id="main-content" tabIndex={-1} className="mx-auto max-w-[1280px] px-4 pt-10 pb-32 sm:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">
            {currentUser
              ? `Good afternoon, ${identity.name.split(' ')[0]}`
              : 'Welcome to Project M'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {currentUser
              ? 'Recent pages, files and assignments from your tags.'
              : 'Sign in with your school Microsoft account to access your pages and files.'}
          </p>
        </div>

        <TagRail tags={tags} activeTag={activeTag} onSelect={setActiveTag} />

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[14.5px] font-bold text-slate-900">Pages &amp; files</h2>
        </div>

        {visiblePages.length === 0 ? (
          <EmptyState
            icon={<FileText size={20} strokeWidth={2} />}
            title={cards.length === 0 ? 'No pages yet' : 'No pages match this tag'}
            description={
              cards.length === 0
                ? 'Published pages you can access will appear here once teachers start publishing content.'
                : 'Try a different tag, or select "All pages" to see everything you have access to.'
            }
          />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
            {visiblePages.map((page) => (
              <PageCardItem key={page.id} page={page} onPreview={setPreviewPage} />
            ))}
          </div>
        )}

        {currentUser && <ClassConnection role={currentUser.role} />}

        {currentUser?.role === 'student' && <StudentTimetable items={timetable} />}
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
