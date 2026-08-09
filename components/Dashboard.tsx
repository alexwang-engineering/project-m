'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  Bell,
  ChevronDown,
  FileText,
  FilePlus,
  Plus,
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

type Role = 'admin' | 'teacher' | 'student' | 'guest';

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
  canonicalUrl: string;
  breadcrumb: string[];
  tags: string[];
  updatedRelative: string;
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
    <header className="sticky top-0 z-40 flex h-[68px] items-center justify-between gap-6 border-b border-slate-200 bg-white/85 px-8 backdrop-blur">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[#9c4f43] text-[15px] font-bold text-white">
          M
        </div>
        <span className="text-[15.5px] font-semibold tracking-tight text-slate-900">
          Project <span className="text-[#9c4f43]">M</span>
        </span>
        {signedIn && (
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
            {currentUser?.role === 'admin' && (
              <Link
                href="/admin"
                className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                Admin
              </Link>
            )}
          </nav>
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
            className="relative flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-transparent text-slate-500 transition hover:border-slate-200 hover:bg-white hover:text-slate-900"
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
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f1ded9] text-[11.5px] font-bold text-[#9c4f43]">
              {identity.initials}
            </span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block text-[12.5px] font-semibold text-slate-900">{identity.name}</span>
              <span className="block text-[10.5px] font-semibold uppercase tracking-wide text-[#9c4f43]">
                {identity.role}
              </span>
            </span>
            <ChevronDown size={13} strokeWidth={2.4} className="text-slate-400" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-[calc(100%+10px)] w-[220px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
              <div className="px-4 pb-1 pt-3 text-[12.5px] font-bold text-slate-900">{identity.name}</div>
              <div className="px-4 pb-3 text-[11.5px] text-slate-500">{currentUser.email}</div>
              <form action="/auth/logout" method="post" className="border-t border-slate-200">
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
            className="rounded-lg bg-[#9c4f43] px-4 py-2 text-[12.5px] font-semibold text-white transition hover:bg-[#7c3c33]"
          >
            Sign in with Microsoft
          </Link>
        )}
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
                  ? 'border-[#9c4f43] bg-[#9c4f43] text-white'
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

function PageCardItem({ page }: { page: PageCard }) {
  return (
    <Link
      href={page.canonicalUrl}
      className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-[18px] text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#f7ece8] text-[#9c4f43]">
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
          <span key={t} className="flex h-5 items-center rounded-md border border-slate-200 bg-slate-50 px-2 text-[10.5px] font-bold text-slate-500">
            {t}
          </span>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-slate-200 pt-2.5 text-[11.5px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span suppressHydrationWarning>{page.updatedRelative}</span>
        </span>
        <span>Page</span>
      </div>
    </Link>
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
            <span className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-lg bg-[#f7ece8] text-[#9c4f43]">
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
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[#9c4f43] text-white shadow-[0_10px_24px_rgba(37,72,137,0.38)] transition hover:bg-[#7c3c33] active:scale-95"
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
  currentUser,
}: DashboardProps) {
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
    <div className="min-h-screen bg-[#f3ecd8]">
      <SkipToContentLink />
      <TopNav
        identity={identity}
        currentUser={currentUser}
        updates={updates}
      />

      <main id="main-content" tabIndex={-1} className="mx-auto max-w-[1180px] px-8 pb-32 pt-9">
        <div className="mb-6">
          <h1 className="text-[23px] font-bold tracking-tight text-slate-900">
            {currentUser
              ? `Good afternoon, ${identity.name.split(' ')[0]}`
              : 'Welcome to Project M'}
          </h1>
          <p className="mt-0.5 text-[13px] text-slate-600">
            {currentUser
              ? 'Here’s what’s moving across your tags today.'
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
              <PageCardItem key={page.id} page={page} />
            ))}
          </div>
        )}
      </main>

      {(currentUser?.role === 'teacher' || currentUser?.role === 'admin') && (
        <FloatingActionButton />
      )}
    </div>
  );
}
