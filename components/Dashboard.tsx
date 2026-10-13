'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bell,
  CalendarDays,
  ClipboardCheck,
  ExternalLink,
  FileText,
  FilePlus,
  GraduationCap,
  Megaphone,
  Plus,
  X,
} from 'lucide-react';

import { SchoolBrand } from '@/components/ui/SchoolBrand';
import { SubjectIcon } from '@/components/ui/SubjectIcon';
import { labelsFromTag } from '@/lib/resource-metadata';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkipToContentLink } from '@/components/ui/SkipToContentLink';
import { formatRelativeTime } from '@/lib/relative-time';
import { useClickOutside } from '@/lib/use-click-outside';
import { clearAllPageRecoveries } from '@/components/pages/page-recovery';
import { PrimaryNavigation } from '@/components/ui/PrimaryNavigation';
import { PageBlocks } from '@/components/page-renderer';
import type { EditorDocumentV1 } from '@/lib/content/schema';
import type { CalendarItem } from '@/lib/content/calendar';
import type { AssignmentSummary } from '@/lib/content/assignments';
import {
  addCalendarDays,
  calendarDateFromKey,
  keyFromCalendarDate,
  schoolDayKey,
  SCHOOL_TIME_ZONE,
} from '@/lib/school-time';

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
  classes?: readonly { name: string; displayName: string }[] | null;
  updates: readonly DashboardUpdate[];
  timetable?: readonly CalendarItem[] | null;
  tasks?: readonly AssignmentSummary[];
  /** Both formatted server-side - a client-side `new Date()` would hydrate-mismatch. */
  todayLabel: string;
  todayIso: string;
  currentUser: CurrentUser | null;
  demoMode?: boolean;
}

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
  demoMode,
}: {
  identity: { name: string; role: Role; initials: string };
  currentUser: CurrentUser | null;
  updates: readonly DashboardUpdate[];
  demoMode: boolean;
}) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notifRef = useClickOutside<HTMLDivElement>(() => setNotifOpen(false));
  const profileRef = useClickOutside<HTMLDivElement>(() =>
    setProfileOpen(false),
  );
  return (
    <header className="border-brand-700 bg-brand-600 sticky top-0 z-40 border-b">
      <div className="text-white">
        <div className="mx-auto flex min-h-[58px] max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-8">
          <SchoolBrand />
          {currentUser && (
            <div className="hidden xl:flex xl:items-center xl:justify-center xl:flex-1">
              <PrimaryNavigation isAdmin={currentUser.role === 'admin'} />
            </div>
          )}
          <div className="flex items-center gap-2">
            {currentUser && (
              <div ref={notifRef} className="relative">
                <button
                  type="button"
                  aria-label="Notifications"
                  aria-expanded={notifOpen}
                  onClick={() => {
                    setNotifOpen(!notifOpen);
                    setProfileOpen(false);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-blue-100 transition hover:bg-white/15 hover:text-white focus-visible:outline-white"
                >
                  <Bell size={15} aria-hidden="true" />
                </button>
                {notifOpen && (
                  <div
                    role="region"
                    aria-label="Class updates"
                    className="fixed top-20 right-4 left-4 overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xl sm:absolute sm:top-12 sm:right-0 sm:left-auto sm:w-80"
                  >
                    <p className="border-b border-slate-100 px-5 py-4 text-sm font-semibold">
                      Class updates
                    </p>
                    {updates.length ? (
                      updates.map((update) => (
                        <Link
                          key={update.id}
                          href="/announcements"
                          className="block border-b border-slate-100 px-5 py-4 last:border-0 hover:bg-slate-50"
                        >
                          <span className="block text-sm font-medium">
                            {update.title}
                          </span>
                          <span className="mt-1 block text-xs text-slate-500">
                            {update.tags.join(' · ') || 'Whole school'}
                          </span>
                        </Link>
                      ))
                    ) : (
                      <p className="px-5 py-5 text-sm text-slate-500">
                        No new tag updates.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            {currentUser ? (
              <div ref={profileRef} className="relative">
                <button
                  type="button"
                  aria-label={`Account for ${identity.name}`}
                  aria-expanded={profileOpen}
                  onClick={() => {
                    setProfileOpen(!profileOpen);
                    setNotifOpen(false);
                  }}
                  className="flex items-center gap-2 rounded-full bg-white/10 px-1.5 py-1 text-left hover:bg-white/15 focus-visible:outline-white"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[11px] font-bold text-[#1b2d43]">
                    {identity.initials}
                  </span>
                </button>
                {profileOpen && (
                  <div className="absolute top-14 right-0 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xl">
                    <p className="px-4 pt-4 text-sm font-semibold">
                      {identity.name}
                    </p>
                    <p className="px-4 pt-1 pb-4 text-xs break-all text-slate-500">
                      {currentUser.email}
                    </p>
                    {demoMode && (
                      <Link
                        className="text-brand-600 block border-t border-slate-100 px-4 py-3 text-sm font-medium hover:bg-slate-50"
                        href="/demo"
                      >
                        Switch demo view
                      </Link>
                    )}
                    <form
                      action="/auth/logout"
                      method="post"
                      onSubmit={clearAllPageRecoveries}
                    >
                      <button className="w-full border-t border-slate-100 px-4 py-3 text-left text-sm font-medium hover:bg-slate-50">
                        Sign out
                      </button>
                    </form>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/auth/login"
                className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#1b2d43] hover:bg-slate-100"
              >
                Sign in with Microsoft
              </Link>
            )}
          </div>
        </div>
      </div>
      {currentUser && (
        <div className="mx-auto hidden max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-8 xl:flex" />
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
  displayName: string;
}

function TagRail({
  tags,
  activeTag,
  onSelect,
  role,
  unavailable,
}: {
  tags: readonly TagSummary[];
  activeTag: string;
  onSelect: (id: string) => void;
  role: CurrentUser['role'];
  unavailable: boolean;
}) {
  return (
    <section
      aria-labelledby="classes-heading"
      className="min-w-0 lg:sticky lg:top-40"
    >
      <h2
        id="classes-heading"
        className="text-brand-700 text-xs font-semibold tracking-[0.12em] uppercase"
      >
        Your classes
      </h2>
      <p className="mt-1 text-xs leading-5 text-slate-600">
        {role === 'student'
          ? 'Your enrolled groups'
          : role === 'teacher'
            ? 'Your teaching groups'
            : 'School groups'}
      </p>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2 lg:grid lg:gap-1 lg:overflow-visible">
        {tags.map((tag) => {
          const active = tag.id === activeTag;
          const subject = labelsFromTag(tag.name).subject;
          return (
            <button
              key={tag.id}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(tag.id)}
              className={`flex min-h-12 shrink-0 items-center gap-3 rounded-lg border px-3 py-2 text-left transition lg:w-full ${active ? 'border-brand-200 bg-brand-50 text-brand-700' : 'hover:text-brand-700 border-transparent text-slate-600 hover:bg-white'}`}
            >
              <SubjectIcon subject={subject} size={18} className="shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">
                  {tag.id === 'all'
                    ? tag.name
                    : subject === 'Other'
                      ? tag.name
                      : subject}
                </span>
                {tag.id !== 'all' && (
                  <span className="mt-0.5 block text-[11px] text-slate-600">
                    {tag.displayName} · {tag.name}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      {tags.length === 1 && (
        <p className="mt-2 text-xs leading-5 text-slate-600">
          {unavailable
            ? 'Your classes could not be loaded. Please refresh to try again.'
            : 'No classes are assigned to your account yet.'}
        </p>
      )}
      <Link
        href="/resources"
        className="text-brand-600 mt-4 hidden items-center gap-2 border-t border-slate-200 pt-4 text-xs font-semibold lg:flex"
      >
        Browse all resources
        <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </section>
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
  const subject = labelsFromTag(page.tags[0] ?? '');
  return (
    <Link
      href={page.canonicalUrl}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
          return;
        event.preventDefault();
        onPreview(page);
      }}
      className="group hover:border-brand-200 flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-[0_2px_6px_-4px_rgba(37,72,137,0.12)] transition-[border-color,box-shadow,transform] duration-200 hover:shadow-[0_10px_24px_-16px_rgba(37,72,137,0.4)] focus-visible:outline-offset-4 motion-safe:hover:-translate-y-0.5"
    >
      <div className="border-brand-100 bg-brand-50 relative flex h-24 flex-col justify-center gap-1.5 overflow-hidden border-b px-5 pr-24">
        <SubjectIcon
          subject={subject.subject}
          size={86}
          strokeWidth={0.8}
          className="text-brand-200 pointer-events-none absolute -right-2 -bottom-3 -rotate-12 transition-transform duration-300 motion-safe:group-hover:rotate-0"
        />
        {subject.year !== 'Other' && (
          <span className="relative text-[10px] font-medium tracking-[0.12em] text-slate-600 uppercase">
            {subject.year}
          </span>
        )}
        <span className="font-school text-brand-700 relative text-xl leading-tight">
          {subject.subject === 'Other' ? 'Learning resource' : subject.subject}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="group-hover:text-brand-700 text-lg leading-snug font-semibold tracking-tight text-slate-900">
          {page.title}
        </h3>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          {page.breadcrumb.join(' / ')}
        </p>
        <div className="my-4 flex flex-wrap gap-1.5">
          {page.tags.map((tag) => (
            <span
              key={tag}
              className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600"
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-4 text-xs">
          <span className="text-slate-500" suppressHydrationWarning>
            {page.updatedRelative}
          </span>
          <span className="text-brand-600 flex items-center gap-1.5 font-semibold">
            View lesson
            <ArrowRight size={14} aria-hidden="true" />
          </span>
        </div>
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
      onClose={(event) => {
        if (!event.currentTarget.open) onClose();
      }}
      aria-modal="true"
      aria-label={`Preview ${page.title}`}
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-transparent p-0 backdrop:bg-slate-950/30"
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
              ref={closeRef}
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
    </dialog>
  );
}

const timetableDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: SCHOOL_TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

const timetableTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: SCHOOL_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
});

function ClassConnection({ role }: { role: CurrentUser['role'] }) {
  const actions =
    role === 'student'
      ? [
        {
          href: '/assignments',
          title: 'My assignments',
          description: 'Submit your work with a message for your teacher.',
          icon: ClipboardCheck,
        },
        {
          href: '/gradebook',
          title: 'Marks & feedback',
          description: 'See released marks and guidance on your work.',
          icon: GraduationCap,
        },
        {
          href: '/announcements',
          title: 'Class updates',
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
    <section className="mb-8" aria-labelledby="connection-heading">
      <h2 id="connection-heading" className="sr-only">
        Learning shortcuts
      </h2>
      <div className="grid grid-cols-3 divide-x divide-slate-200 rounded-xl border border-slate-200 bg-white py-1 shadow-[0_2px_6px_-4px_rgba(37,72,137,0.12)] sm:py-2">
        {actions.map(({ href, title, description, icon: Icon }) => (
          <Link
            key={title}
            href={href}
            className="group hover:bg-brand-50/60 flex min-w-0 flex-col items-start gap-3 px-3 py-3 transition-colors sm:flex-row sm:items-center sm:px-5 sm:py-4"
          >
            <span className="bg-brand-50 text-brand-600 group-hover:bg-brand-600 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors group-hover:text-white">
              <Icon size={19} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="group-hover:text-brand-700 block text-xs leading-5 font-semibold text-slate-950 sm:text-sm">
                {title}
              </span>
              <span className="mt-1 hidden text-xs leading-5 text-slate-600 md:block">
                {description}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function LearningActivity({
  items,
  updates,
}: {
  items: readonly CalendarItem[] | null;
  updates: readonly DashboardUpdate[];
}) {
  return (
    <aside
      className="grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-1"
      aria-label="Learning activity"
    >
      <section
        className="overflow-hidden rounded-xl border border-slate-200 bg-white"
        aria-labelledby="deadlines-heading"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 id="deadlines-heading" className="text-sm font-semibold">
            Deadlines &amp; events
          </h2>
          <CalendarDays
            size={17}
            className="text-brand-600"
            aria-hidden="true"
          />
        </div>
        {items?.length ? (
          <div className="divide-y divide-slate-100">
            {items.map((item) => (
              <Link
                key={`${item.kind}:${item.id}`}
                href={
                  item.kind === 'assignment'
                    ? `/assignments/${item.id}`
                    : item.kind === 'quiz'
                      ? `/quizzes/${item.id}`
                      : '/calendar'
                }
                className="block px-5 py-4 hover:bg-slate-50"
              >
                <p className="text-brand-600 text-[11px] font-semibold">
                  {timetableDate.format(new Date(item.at))} ·{' '}
                  {timetableTime.format(new Date(item.at))}
                </p>
                <h3 className="mt-1.5 text-sm leading-5 font-medium text-slate-900">
                  {item.title}
                </h3>
                <span className="mt-1 block text-[11px] text-slate-500 capitalize">
                  {item.kind}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="px-5 py-6 text-sm leading-6 text-slate-500">
            {items === null
              ? 'The calendar is temporarily unavailable. You can still open your assignments.'
              : 'No deadlines or events to show. Check your assignments for work without a due date.'}
          </p>
        )}
        <Link
          href="/calendar"
          className="text-brand-600 flex items-center justify-between border-t border-slate-100 px-5 py-4 text-xs font-semibold hover:bg-slate-50"
        >
          Open calendar
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </section>
      <section
        className="overflow-hidden rounded-xl border border-slate-200 bg-white"
        aria-labelledby="updates-heading"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 id="updates-heading" className="text-sm font-semibold">
            Noticeboard
          </h2>
          <Megaphone size={17} className="text-brand-600" aria-hidden="true" />
        </div>
        {updates.length ? (
          updates.map((update) => (
            <Link
              key={update.id}
              href="/announcements"
              className="block border-b border-slate-100 px-5 py-4 hover:bg-slate-50"
            >
              <h3 className="text-sm leading-5 font-medium">{update.title}</h3>
              <p className="mt-2 text-[11px] text-slate-500">
                {update.tags.join(' · ') || 'Whole school'}
              </p>
            </Link>
          ))
        ) : (
          <p className="px-5 py-6 text-sm leading-6 text-slate-500">
            Class announcements will appear here when they are shared with you.
          </p>
        )}
        <Link
          href="/announcements"
          className="text-brand-600 flex items-center justify-between px-5 py-4 text-xs font-semibold hover:bg-slate-50"
        >
          All announcements
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </section>
    </aside>
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

// ---------------------------------------------------------------------------
// Student overview widgets (reference: landing-page-dashboard.png)
// ---------------------------------------------------------------------------

/** Subject colour coding used across tasks, timetable and calendar keys. */
const SUBJECT_COLORS: Readonly<Record<string, string>> = {
  CS: '#2f7a6b',
  PH: '#d65f5f',
  MA: '#e2a63b',
  EL: '#7a5fd1',
  EN: '#4b2389',
  CH: '#2f8286',
  BI: '#2f7a6b',
  GE: '#2f8286',
  HI: '#d65f5f',
  FR: '#7a5fd1',
};

function subjectColor(tag: string | undefined): string {
  if (!tag) return '#766a8c';
  const match = /^(?:Y\d{1,2}|L6|U6)([A-Z]{2})/.exec(tag.toUpperCase());
  return SUBJECT_COLORS[match?.[1] ?? ''] ?? '#766a8c';
}

/**
 * Foreground paired with each accent so text clears WCAG AA (4.5:1). White is
 * only 2.15:1 on the amber and 3.74:1 on the coral, so those take dark ink.
 */
const ON_ACCENT: Readonly<Record<string, string>> = {
  '#2f7a6b': '#ffffff',
  '#e2a63b': '#150c3d',
  '#d65f5f': '#150c3d',
};

function onAccent(background: string): string {
  return ON_ACCENT[background] ?? '#ffffff';
}

type TaskStatus = 'completed' | 'dueSoon' | 'dueLater';

interface DashboardTask {
  readonly id: string;
  readonly title: string;
  readonly tag: string | undefined;
  readonly status: TaskStatus;
  readonly dueLabel: string;
}

const TASK_STATUS_COLOR: Readonly<Record<TaskStatus, string>> = {
  completed: '#2f7a6b',
  dueSoon: '#e2a63b',
  dueLater: '#9c8fb3',
};

const TASK_STATUS_LABEL: Readonly<Record<TaskStatus, string>> = {
  completed: 'completed',
  dueSoon: 'due soon',
  dueLater: 'due later',
};

/** Classifies an assignment for the tasks donut: submitted, due within 48h, or later. */
function toDashboardTask(task: AssignmentSummary, now: Date): DashboardTask {
  const due = task.dueAt ? new Date(task.dueAt) : null;
  const hoursUntilDue = due
    ? (due.getTime() - now.getTime()) / (1000 * 60 * 60)
    : Number.POSITIVE_INFINITY;
  const status: TaskStatus = task.hasSubmitted
    ? 'completed'
    : hoursUntilDue <= 48
      ? 'dueSoon'
      : 'dueLater';
  const dueLabel = task.hasSubmitted
    ? 'Completed'
    : !due
      ? 'No due date'
      : hoursUntilDue < 0
        ? 'Overdue'
        : hoursUntilDue <= 24
          ? 'Due today'
          : hoursUntilDue <= 48
            ? 'Due tomorrow'
            : hoursUntilDue <= 24 * 7
              ? 'Due this week'
              : // Anything further out states its date rather than claiming
                // "this week", which was wrong for work months away.
                `Due ${new Intl.DateTimeFormat('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  timeZone: SCHOOL_TIME_ZONE,
                }).format(due)}`;
  return {
    id: task.id,
    title: task.title,
    tag: task.tags[0]?.name,
    status,
    dueLabel,
  };
}

function StatPill({
  count,
  label,
  color,
}: {
  count: number;
  label: string;
  color: string;
}) {
  return (
    <span className="inline-flex items-center gap-2.5 rounded-full border border-slate-200 bg-white py-1.5 pr-5 pl-1.5 shadow-[0_1px_3px_rgba(30,18,88,0.05)]">
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full text-[12.5px] font-bold"
        style={{ backgroundColor: color, color: onAccent(color) }}
      >
        {count}
      </span>
      <span className="text-[13px] font-medium text-slate-700">{label}</span>
    </span>
  );
}

function TasksCard({ tasks }: { tasks: readonly DashboardTask[] }) {
  const counts = {
    completed: tasks.filter((t) => t.status === 'completed').length,
    dueSoon: tasks.filter((t) => t.status === 'dueSoon').length,
    dueLater: tasks.filter((t) => t.status === 'dueLater').length,
  };
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  // Precomputed rather than mutating a counter while mapping over JSX, so the
  // arcs don't depend on render order.
  const segments = (['completed', 'dueSoon', 'dueLater'] as const).reduce<
    { status: TaskStatus; length: number; offset: number }[]
  >((acc, status) => {
    const value = counts[status];
    if (value === 0 || tasks.length === 0) return acc;
    const previous = acc[acc.length - 1];
    const offset = previous ? previous.offset + previous.length : 0;
    return [
      ...acc,
      { status, length: (value / tasks.length) * circumference, offset },
    ];
  }, []);

  return (
    <section
      aria-labelledby="tasks-heading"
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_rgba(30,18,88,0.05)]"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="tasks-heading" className="font-display text-[19px] font-extrabold text-slate-900">
          Tasks
        </h2>
        <Link
          href="/assignments"
          className="text-accent-purple text-[12px] font-semibold hover:underline"
        >
          + New task
        </Link>
      </div>

      <div className="mb-4 flex items-center gap-6 rounded-xl bg-slate-100 px-5 py-4">
        <div className="relative shrink-0">
          <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r={radius} fill="none" stroke="#dcd5ea" strokeWidth="7" />
            {segments.map(({ status, length, offset }) => (
              <circle
                key={status}
                cx="32"
                cy="32"
                r={radius}
                fill="none"
                stroke={TASK_STATUS_COLOR[status]}
                strokeWidth="7"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 32 32)"
              />
            ))}
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[15px] font-bold text-slate-900">
            {tasks.length}
          </span>
        </div>
        <ul className="grid gap-1.5">
          {(['completed', 'dueSoon', 'dueLater'] as const).map((status) => (
            <li key={status} className="flex items-center gap-2 text-[12px] text-slate-600">
              <span
                className="h-2.5 w-2.5 rounded-[3px]"
                style={{ backgroundColor: TASK_STATUS_COLOR[status] }}
                aria-hidden="true"
              />
              {counts[status]} {TASK_STATUS_LABEL[status]}
            </li>
          ))}
        </ul>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck size={20} />}
          title="No tasks yet"
          description="Work set by your teachers will appear here."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tasks.slice(0, 6).map((task) => (
            <li key={task.id}>
              <Link
                href={`/assignments/${task.id}`}
                className="relative block h-full rounded-lg border border-slate-200 bg-white py-3 pr-6 pl-3.5 transition hover:border-slate-300 hover:shadow-sm"
                style={{ borderLeft: `3px solid ${subjectColor(task.tag)}` }}
              >
                <span
                  className="absolute top-3.5 right-3 h-2 w-2 rounded-full"
                  style={{ backgroundColor: TASK_STATUS_COLOR[task.status] }}
                  aria-hidden="true"
                />
                {task.tag && (
                  <span className="block text-[9.5px] font-bold tracking-[0.1em] text-slate-500 uppercase">
                    {labelsFromTag(task.tag).subject} ({task.tag})
                  </span>
                )}
                <span className="mt-1 block text-[13px] leading-snug font-bold text-slate-900">
                  {task.title}
                </span>
                <span className="mt-1 block text-[11px] text-slate-500">{task.dueLabel}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CalendarCard({
  items,
  todayIso,
}: {
  items: readonly CalendarItem[];
  todayIso: string;
}) {
  // Calendar arithmetic runs on UTC-midnight calendar dates so adding days and
  // reading weekdays can't drift; instants are mapped to school days for
  // comparison. See lib/school-time.ts.
  const todayKey = schoolDayKey(new Date(todayIso));
  const today = calendarDateFromKey(todayKey);
  const month = today.getUTCMonth();
  const firstOfMonth = new Date(
    Date.UTC(today.getUTCFullYear(), month, 1),
  );
  const gridStart = addCalendarDays(firstOfMonth, -firstOfMonth.getUTCDay());

  const days = Array.from({ length: 42 }, (_, index) =>
    addCalendarDays(gridStart, index),
  );
  const lastDay = days.findLastIndex((d) => d.getUTCMonth() === month);
  const visibleDays = days.slice(0, Math.ceil((lastDay + 1) / 7) * 7);

  const markedDays = new Set(items.map((item) => schoolDayKey(new Date(item.at))));

  return (
    <section
      aria-labelledby="calendar-heading"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(30,18,88,0.05)]"
    >
      <h2
        id="calendar-heading"
        className="font-display mb-3 text-[19px] font-extrabold text-slate-900"
      >
        Calendar
      </h2>
      <p className="mb-2 text-[12px] font-medium text-slate-600">
        {/* `today` is already a UTC-midnight calendar date, so format it as UTC. */}
        {new Intl.DateTimeFormat('en-GB', {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        }).format(today)}
      </p>

      <div className="grid grid-cols-7 gap-y-1 text-center">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
          <span
            key={`${day}-${index}`}
            className="text-[10px] font-semibold text-slate-400"
          >
            {day}
          </span>
        ))}
        {visibleDays.map((date) => {
          const dateKey = keyFromCalendarDate(date);
          const isThisMonth = date.getUTCMonth() === month;
          const isToday = dateKey === todayKey;
          return (
            <span key={dateKey} className="relative py-[3px]">
              <span
                className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
                  isToday
                    ? 'bg-brand-600 font-bold text-white'
                    : isThisMonth
                      ? 'text-slate-700'
                      : 'text-slate-500'
                }`}
              >
                {date.getUTCDate()}
              </span>
              {markedDays.has(dateKey) && !isToday && (
                <span
                  className="bg-accent-amber absolute bottom-0 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full"
                  aria-hidden="true"
                />
              )}
            </span>
          );
        })}
      </div>

      {items.length > 0 && (
        <ul className="mt-4 grid gap-2 border-t border-slate-200 pt-3">
          {items.slice(0, 3).map((item) => (
            <li key={item.id} className="flex gap-2 text-[11.5px]">
              <span className="text-accent-purple shrink-0 font-bold">
                {new Intl.DateTimeFormat('en-GB', {
                  month: 'short',
                  day: 'numeric',
                  timeZone: SCHOOL_TIME_ZONE,
                }).format(new Date(item.at))}
              </span>
              <span className="truncate text-slate-600">{item.title}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TodayTimetableCard({ items }: { items: readonly CalendarItem[] }) {
  return (
    <section
      aria-labelledby="today-timetable-heading"
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_rgba(30,18,88,0.05)]"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2
          id="today-timetable-heading"
          className="font-display text-[19px] font-extrabold text-slate-900"
        >
          Today&rsquo;s timetable
        </h2>
        <Link
          href="/calendar"
          className="text-accent-purple text-[12px] font-semibold hover:underline"
        >
          Full timetable &rarr;
        </Link>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<CalendarDays size={20} />}
          title="Nothing scheduled today"
          description="Lessons and deadlines for today will appear here."
        />
      ) : (
        <ol className="grid gap-4">
          {items.map((item) => {
            const color = subjectColor(item.tags[0]?.name);
            const start = new Date(item.at);
            const end = item.endsAt ? new Date(item.endsAt) : null;
            const time = (value: Date) =>
              new Intl.DateTimeFormat('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
                timeZone: SCHOOL_TIME_ZONE,
              }).format(value);
            return (
              <li key={item.id} className="flex gap-3">
                <span
                  className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full border-2"
                  style={{ borderColor: color, backgroundColor: color }}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-slate-500">
                    {time(start)}
                    {end ? ` – ${time(end)}` : ''}
                  </p>
                  <p className="text-[13.5px] font-bold text-slate-900">{item.title}</p>
                  {item.tags[0] && (
                    <p className="text-[11.5px] text-slate-500">
                      {labelsFromTag(item.tags[0].name).subject} · {item.tags[0].name}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function AnnouncementsCard({ updates }: { updates: readonly DashboardUpdate[] }) {
  return (
    <section
      aria-labelledby="announcements-heading"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(30,18,88,0.05)]"
    >
      <h2
        id="announcements-heading"
        className="font-display text-[19px] font-extrabold text-slate-900"
      >
        Announcements
      </h2>
      <Link
        href="/announcements"
        className="text-accent-purple mt-0.5 mb-3 inline-block text-[12px] font-semibold hover:underline"
      >
        View all &rarr;
      </Link>

      {updates.length === 0 ? (
        <p className="text-[12px] text-slate-500">No announcements yet.</p>
      ) : (
        <ul className="grid">
          {updates.slice(0, 3).map((update) => (
            <li
              key={update.id}
              className="border-t border-slate-200 py-3 first:border-t-0 first:pt-0"
            >
              <p className="text-[9.5px] font-bold tracking-[0.1em] text-slate-500 uppercase">
                {update.tags[0] ?? 'School'} ·{' '}
                {formatRelativeTime(update.createdAt)}
              </p>
              <p className="mt-1 text-[13px] font-bold text-slate-900">
                {update.title}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function Dashboard({
  pages,
  classes = [],
  updates,
  timetable = [],
  tasks = [],
  todayLabel,
  todayIso,
  currentUser,
  demoMode = false,
}: DashboardProps) {
  const [activeTag, setActiveTag] = useState('all');
  const [previewPage, setPreviewPage] = useState<PageCard | null>(null);

  const identity = useMemo(
    () => deriveDisplayIdentity(currentUser),
    [currentUser],
  );

  const cards = useMemo(() => pages.map(toPageCard), [pages]);

  const tags = useMemo<TagSummary[]>(() => {
    return [
      { id: 'all', name: 'All my classes', displayName: 'All my classes' },
      ...(classes ?? [])
        .map((tag) => ({
          id: tag.name,
          name: tag.name,
          displayName: tag.displayName,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    ];
  }, [classes]);

  const visiblePages = cards.filter(
    (p) => activeTag === 'all' || p.tags.includes(activeTag),
  );

  const isStudent = currentUser?.role === 'student';
  /** Memoised: `timetable ?? []` would be a new array each render and churn the memos below. */
  const timetableItems = useMemo(() => timetable ?? [], [timetable]);

  /**
   * RLS lets a tag member read an assignment that is still a draft or not yet
   * open (can_read_assignment gates on archived_at + membership only), and
   * AssignmentsView handles that by showing it as unavailable. This overview
   * instead answers "what do I actually have to do", so unpublished and
   * not-yet-open work is excluded rather than counted as due.
   */
  const dashboardTasks = useMemo(() => {
    const now = new Date(todayIso);
    return tasks
      .filter(
        (task) =>
          task.lifecycle === 'published' &&
          (task.availableFrom === null ||
            new Date(task.availableFrom).getTime() <= now.getTime()) &&
          // Closed submissions are no longer work the student can act on, so
          // they must not inflate the "tasks due" count either.
          (task.closedAt === null ||
            new Date(task.closedAt).getTime() > now.getTime()),
      )
      .map((task) => toDashboardTask(task, now));
  }, [tasks, todayIso]);

  const todayItems = useMemo(() => {
    const today = schoolDayKey(new Date(todayIso));
    return timetableItems.filter(
      (item) => schoolDayKey(new Date(item.at)) === today,
    );
  }, [timetableItems, todayIso]);

  /**
   * The reference mock shows an "exams" count, but the schema has no exam kind
   * (CalendarItemKind is assignment | quiz | event) - quizzes within 7 days is
   * the closest real signal rather than an invented one.
   */
  const quizzesThisWeek = useMemo(() => {
    const now = new Date(todayIso).getTime();
    const weekOut = now + 7 * 24 * 60 * 60 * 1000;
    return timetableItems.filter((item) => {
      const at = new Date(item.at).getTime();
      return item.kind === 'quiz' && at >= now && at <= weekOut;
    }).length;
  }, [timetableItems, todayIso]);

  const classCount = classes?.length;
  const tasksDue = dashboardTasks.filter((t) => t.status !== 'completed').length;

  return (
    <div className="min-h-[100dvh] bg-slate-50">
      <SkipToContentLink />
      <TopNav
        identity={identity}
        currentUser={currentUser}
        updates={updates}
        demoMode={demoMode}
      />

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-[1040px] px-4 pt-8 pb-24 sm:px-8"
      >
        <div className="mb-7 flex flex-wrap items-end justify-between gap-5 pb-2">
          <div className="max-w-2xl">
            <p className="text-accent-purple mb-3 text-[11px] font-semibold tracking-[0.18em] uppercase">
              {currentUser ? todayLabel : 'Merchant Taylors’ School'}
            </p>
            <h1 className="font-display text-[38px] leading-none font-extrabold tracking-[-0.03em] text-slate-900 sm:text-[48px]">
              {currentUser
                ? currentUser.role === 'student'
                  ? 'Dashboard'
                  : 'Your teaching workspace'
                : 'Welcome to Project M'}
            </h1>
            <p className="mt-3 text-sm leading-6 font-medium text-slate-600">
              {currentUser
                ? currentUser.role === 'student'
                  ? `Welcome, ${identity.name.split(' ')[0]}`
                  : 'Plan lessons, share resources and keep your classes moving forward.'
                : 'Sign in with your school Microsoft account to access your pages and files.'}
            </p>
          </div>
          {currentUser && (
            <Link
              href="/calendar"
              className="text-brand-700 hover:border-brand-200 flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium shadow-[0_2px_10px_rgba(29,45,73,0.04)]"
            >
              <CalendarDays size={16} aria-hidden="true" />
              School calendar
            </Link>
          )}
          {!currentUser && demoMode && (
            <Link
              href="/demo"
              className="bg-brand-600 hover:bg-brand-700 rounded-lg px-5 py-3 text-sm font-semibold text-white"
            >
              Choose demo view
            </Link>
          )}
        </div>
        {isStudent && (
          <>
            <div className="mb-6 flex flex-wrap items-center gap-3">
              {classCount !== undefined && (
                <StatPill count={classCount} label="Classes" color="#2f7a6b" />
              )}
              <StatPill count={tasksDue} label="Tasks due" color="#e2a63b" />
              <StatPill
                count={quizzesThisWeek}
                label="Quizzes this week"
                color="#d65f5f"
              />
            </div>
            <div className="grid gap-5 border-t border-slate-200 pt-7 lg:grid-cols-[minmax(0,1fr)_300px]">
              <TasksCard tasks={dashboardTasks} />
              <CalendarCard items={timetableItems} todayIso={todayIso} />
              <TodayTimetableCard items={todayItems} />
              <AnnouncementsCard updates={updates} />
            </div>
            <p className="mt-8 text-center text-[12px] text-slate-600">
              {classCount === undefined
                ? 'Classes unavailable'
                : `${classCount} classes`}{' '}
              · {tasksDue} tasks ·{' '}
              {quizzesThisWeek} quizzes this week
            </p>
          </>
        )}

        {currentUser && !isStudent && (
          <ClassConnection role={currentUser.role} />
        )}
        <div
          className={
            isStudent
              ? 'mt-8 grid items-start gap-6 border-t border-slate-200 pt-7 lg:grid-cols-[190px_minmax(0,1fr)]'
              : currentUser
                ? 'grid items-start gap-6 lg:grid-cols-[190px_minmax(0,1fr)] xl:grid-cols-[190px_minmax(0,1fr)_270px]'
                : ''
          }
        >
          {currentUser && (
            <TagRail
              tags={tags}
              activeTag={activeTag}
              onSelect={setActiveTag}
              role={currentUser.role}
              unavailable={classes === null}
            />
          )}
          <section className="min-w-0" aria-labelledby="lessons-heading">
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <h2
                  id="lessons-heading"
                  className="font-school text-brand-700 text-[26px] leading-tight font-normal tracking-tight"
                >
                  {activeTag === 'all'
                    ? 'Your lessons'
                    : `${classes?.find((tag) => tag.name === activeTag)?.displayName || activeTag} lessons`}
                </h2>
                <p className="mt-1 text-xs text-slate-600">
                  Recent lessons for your assigned classes
                </p>
              </div>
              {currentUser && (
                <Link
                  href="/resources"
                  className="text-brand-600 shrink-0 text-xs font-semibold hover:underline"
                >
                  View all resources
                </Link>
              )}
            </div>
            {visiblePages.length === 0 ? (
              <EmptyState
                icon={<FileText size={20} />}
                title={
                  classes === null
                    ? 'Lessons unavailable'
                    : cards.length === 0
                      ? 'No lessons yet'
                      : 'No lessons for this class'
                }
                description={
                  classes === null
                    ? 'Please refresh to load your classes and lessons.'
                    : cards.length === 0
                      ? 'Published lessons for your classes will appear here.'
                      : 'No recent lessons for this class. Browse your learning library for more resources.'
                }
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
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
          {currentUser && !isStudent && (
            <div className="lg:col-start-2 xl:col-start-auto">
              <LearningActivity items={timetable} updates={updates} />
            </div>
          )}
        </div>
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
