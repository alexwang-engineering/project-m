'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  Bell,
  ChevronDown,
  MoreVertical,
  FileText,
  FilePlus,
  Plus,
  Upload,
  Pencil,
  X,
} from 'lucide-react';

import { EmptyState } from '@/components/ui/EmptyState';
import { SkipToContentLink } from '@/components/ui/SkipToContentLink';
import { formatRelativeTime } from '@/lib/relative-time';
import { useClickOutside } from '@/lib/use-click-outside';
import { SearchBox } from '@/components/search/SearchBox';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Role = 'admin' | 'teacher' | 'student';

/** Matches `PageSummary` from lib/content/dashboard.ts (Codex's typed loader). */
export interface DashboardPage {
  id: string;
  title: string;
  canonicalUrl: string;
  updatedAt: string;
  tags: readonly { name: string; displayName: string }[];
}

interface PageCard {
  id: string;
  title: string;
  kind: 'page' | 'file';
  fileType: 'page' | 'pdf' | 'doc';
  breadcrumb: string[];
  tags: string[];
  authorInitials?: string;
  updatedRelative: string;
}

interface UrgentNotification {
  id: string;
  tag: string;
  message: string;
  timeRelative: string;
  urgent: boolean;
}

export interface CurrentUser {
  readonly email: string;
  readonly role: 'admin' | 'teacher' | 'student';
}

interface DashboardProps {
  pages: readonly DashboardPage[];
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
  if (!user) return { name: 'Signed out', role: 'student', initials: '?' };
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

const NOTIFICATIONS: UrgentNotification[] = [
  { id: '1', tag: 'L6CH2', message: 'Organic Mechanisms homework due tomorrow, 9:00am', timeRelative: '42 minutes ago', urgent: true },
  { id: '2', tag: 'Y9MA1', message: 'New resource added — Trigonometry Revision Pack', timeRelative: '2 hours ago', urgent: false },
  { id: '3', tag: 'U6PH1', message: 'Practical write-up returned with feedback', timeRelative: 'Yesterday', urgent: true },
];

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
    kind: 'page',
    fileType: 'page',
    breadcrumb: breadcrumbFromCanonicalUrl(page.canonicalUrl),
    tags: page.tags.map((tag) => tag.name),
    updatedRelative: formatRelativeTime(page.updatedAt),
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
}: {
  identity: { name: string; role: Role; initials: string };
  currentUser: CurrentUser | null;
}) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const notifRef = useClickOutside<HTMLDivElement>(() => setNotifOpen(false));
  const profileRef = useClickOutside<HTMLDivElement>(() => setProfileOpen(false));

  const hasUrgent = NOTIFICATIONS.some((n) => n.urgent);

  return (
    <header className="sticky top-0 z-40 flex h-[68px] items-center justify-between gap-6 border-b border-slate-200 bg-white/85 px-8 backdrop-blur">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[#254889] text-[15px] font-bold text-white">
          M
        </div>
        <span className="text-[15.5px] font-semibold tracking-tight text-slate-900">
          Project <span className="text-[#254889]">M</span>
        </span>
        <nav className="ml-6 hidden items-center gap-1 sm:flex">
          <Link
            href="/assignments"
            className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            Assignments
          </Link>
          <Link
            href="/quizzes"
            className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            Quizzes
          </Link>
          <Link
            href="/calendar"
            className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            Calendar
          </Link>
          <Link
            href="/announcements"
            className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            Announcements
          </Link>
          <Link
            href="/gradebook"
            className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            Gradebook
          </Link>
          <Link
            href="/admin"
            className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            Admin
          </Link>
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <SearchBox />
        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => {
              setNotifOpen((v) => !v);
              setProfileOpen(false);
            }}
            aria-label="Notifications"
            className="relative flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-transparent text-slate-500 transition hover:border-slate-200 hover:bg-white hover:text-slate-900"
          >
            <Bell size={18} strokeWidth={2} />
            {hasUrgent && (
              <span className="absolute right-2 top-2 h-[7px] w-[7px] rounded-full border-[1.5px] border-[#f7f8fa] bg-[#d0483c]" />
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-[calc(100%+10px)] w-[340px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
              <div className="border-b border-slate-200 px-4 py-3 text-[12.5px] font-bold text-slate-900">
                Tag updates
              </div>
              {NOTIFICATIONS.map((n) => (
                <div
                  key={n.id}
                  className="flex cursor-pointer gap-3 border-b border-slate-200 px-4 py-3 last:border-b-0 hover:bg-slate-50"
                >
                  <span
                    className={`flex h-5 flex-shrink-0 items-center rounded-md px-1.5 text-[10.5px] font-bold ${
                      n.urgent ? 'bg-red-50 text-[#d0483c]' : 'bg-[#eef2fa] text-[#254889]'
                    }`}
                  >
                    {n.tag}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[12.5px] leading-snug text-slate-900">{n.message}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{n.timeRelative}</p>
                  </div>
                </div>
              ))}
              <button className="w-full bg-slate-50 py-2.5 text-[12px] font-semibold text-[#254889]">
                View all notifications
              </button>
            </div>
          )}
        </div>

        {/* Profile — Outlook-style role chip */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => {
              setProfileOpen((v) => !v);
              setNotifOpen(false);
            }}
            className="flex items-center gap-2.5 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 transition hover:border-slate-300"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#dfe7f7] text-[11.5px] font-bold text-[#254889]">
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
              <div className="px-4 pb-3 text-[11.5px] text-slate-500">{currentUser?.email ?? 'Not signed in'}</div>
              <button className="w-full border-t border-slate-200 px-4 py-2.5 text-left text-[12.5px] text-slate-900 hover:bg-slate-50">
                Switch role view
              </button>
              <button className="w-full px-4 py-2.5 text-left text-[12.5px] text-slate-900 hover:bg-slate-50">
                Account settings
              </button>
              <button className="w-full px-4 py-2.5 text-left text-[12.5px] font-medium text-[#d0483c] hover:bg-slate-50">
                Sign out
              </button>
            </div>
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

const ICON_STYLES: Record<PageCard['fileType'], string> = {
  page: 'bg-[#eef2fa] text-[#254889]',
  pdf: 'bg-red-50 text-[#c2483a]',
  doc: 'bg-blue-50 text-[#2f6fd6]',
};

function PageCardItem({ page }: { page: PageCard }) {
  return (
    <button className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-[18px] text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-2.5">
        <div className={`flex h-9 w-9 items-center justify-center rounded-[10px] ${ICON_STYLES[page.fileType]}`}>
          <FileText size={17} strokeWidth={2} />
        </div>
        <span className="flex h-[26px] w-[26px] items-center justify-center rounded-md text-slate-400 hover:bg-slate-50 hover:text-slate-600">
          <MoreVertical size={15} strokeWidth={2.4} />
        </span>
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
          <span key={t} className="flex h-5 items-center rounded-md border border-slate-200 bg-slate-50 px-2 text-[10.5px] font-bold text-slate-500">
            {t}
          </span>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-slate-200 pt-2.5 text-[11.5px] text-slate-400">
        <span className="flex items-center gap-1.5">
          {page.authorInitials && (
            <span className="flex h-[17px] w-[17px] items-center justify-center rounded-full bg-[#dfe7f7] text-[8px] font-bold text-[#254889]">
              {page.authorInitials}
            </span>
          )}
          <span suppressHydrationWarning>{page.updatedRelative}</span>
        </span>
        <span className="capitalize">{page.kind}</span>
      </div>
    </button>
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
            <span className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-lg bg-[#eef2fa] text-[#254889]">
              <FilePlus size={16} strokeWidth={2} />
            </span>
            <span className="flex flex-col">
              <span className="text-[12.5px] font-semibold text-slate-900">New page</span>
              <span className="text-[10.5px] text-slate-400">Block editor</span>
            </span>
          </Link>
          <button className="flex w-full items-center gap-3 border-t border-slate-200 px-[15px] py-3.5 text-left hover:bg-slate-50">
            <span className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-lg bg-[#eef2fa] text-[#254889]">
              <Upload size={16} strokeWidth={2} />
            </span>
            <span className="flex flex-col">
              <span className="text-[12.5px] font-semibold text-slate-900">Upload page</span>
              <span className="text-[10.5px] text-slate-400">.mpx or PDF</span>
            </span>
          </button>
          <button className="flex w-full items-center gap-3 border-t border-slate-200 px-[15px] py-3.5 text-left hover:bg-slate-50">
            <span className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-lg bg-[#eef2fa] text-[#254889]">
              <Pencil size={16} strokeWidth={2} />
            </span>
            <span className="flex flex-col">
              <span className="text-[12.5px] font-semibold text-slate-900">Edit current page</span>
              <span className="text-[10.5px] text-slate-400">Opens block editor</span>
            </span>
          </button>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Create"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[#254889] text-white shadow-[0_10px_24px_rgba(37,72,137,0.38)] transition hover:bg-[#1c3a70] active:scale-95"
      >
        {open ? <X size={22} strokeWidth={2.4} /> : <Plus size={22} strokeWidth={2.4} />}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export default function Dashboard({ pages, currentUser }: DashboardProps) {
  const [activeTag, setActiveTag] = useState('all');

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
    <div className="min-h-screen bg-[#f7f8fa]">
      <SkipToContentLink />
      <TopNav identity={identity} currentUser={currentUser} />

      <main id="main-content" className="mx-auto max-w-[1180px] px-8 pb-32 pt-9">
        <div className="mb-6">
          <h1 className="text-[23px] font-bold tracking-tight text-slate-900">
            Good afternoon, {identity.name.split(' ')[0]}
          </h1>
          <p className="mt-0.5 text-[13px] text-slate-600">Here&rsquo;s what&rsquo;s moving across your tags today.</p>
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
              <PageCardItem key={page.id} page={page} />
            ))}
          </div>
        )}
      </main>

      <FloatingActionButton />
    </div>
  );
}
