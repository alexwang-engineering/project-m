'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Bell,
  ChevronDown,
  MoreVertical,
  FileText,
  Plus,
  Upload,
  Pencil,
  X,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Role = 'admin' | 'teacher' | 'student';

interface TagSummary {
  id: string;
  name: string;
  pageCount: number;
}

interface PageCard {
  id: string;
  title: string;
  kind: 'page' | 'file';
  fileType: 'page' | 'pdf' | 'doc';
  breadcrumb: string[];
  tags: string[];
  authorInitials: string;
  updatedRelative: string;
}

interface UrgentNotification {
  id: string;
  tag: string;
  message: string;
  timeRelative: string;
  urgent: boolean;
}

// ---------------------------------------------------------------------------
// Placeholder data — replace with Supabase queries against
// `pages` / `page_tags` / `user_tags` (see schema, Task 1)
// ---------------------------------------------------------------------------

const CURRENT_USER = {
  name: 'Jonathan Dale',
  email: 'j.dale@merchanttaylors.school.uk',
  role: 'teacher' as Role,
  initials: 'JD',
};

const TAGS: TagSummary[] = [
  { id: 'all', name: 'All pages', pageCount: 32 },
  { id: 'Y9MA1', name: 'Y9MA1', pageCount: 8 },
  { id: 'Y9MA2', name: 'Y9MA2', pageCount: 5 },
  { id: 'L6CH2', name: 'L6CH2', pageCount: 11 },
  { id: 'L6CH3', name: 'L6CH3', pageCount: 4 },
  { id: 'U6PH1', name: 'U6PH1', pageCount: 6 },
  { id: 'U6BI1', name: 'U6BI1', pageCount: 9 },
  { id: 'Y8EN3', name: 'Y8EN3', pageCount: 3 },
];

const NOTIFICATIONS: UrgentNotification[] = [
  { id: '1', tag: 'L6CH2', message: 'Organic Mechanisms homework due tomorrow, 9:00am', timeRelative: '42 minutes ago', urgent: true },
  { id: '2', tag: 'Y9MA1', message: 'New resource added — Trigonometry Revision Pack', timeRelative: '2 hours ago', urgent: false },
  { id: '3', tag: 'U6PH1', message: 'Practical write-up returned with feedback', timeRelative: 'Yesterday', urgent: true },
];

const PAGES: PageCard[] = [
  { id: 'p1', title: 'Organic Mechanisms — Nucleophilic Substitution', kind: 'page', fileType: 'page', breadcrumb: ['Chemistry', 'Organic Chemistry', 'Mechanisms'], tags: ['L6CH2'], authorInitials: 'JD', updatedRelative: '2h ago' },
  { id: 'p2', title: 'Trigonometry Revision Pack.pdf', kind: 'file', fileType: 'pdf', breadcrumb: ['Maths', 'Year 9', 'Set 1', 'Trigonometry'], tags: ['Y9MA1'], authorInitials: 'SK', updatedRelative: '5h ago' },
  { id: 'p3', title: 'Practical Write-Up Guidance', kind: 'page', fileType: 'page', breadcrumb: ['Physics', 'Upper Sixth', 'Coursework'], tags: ['U6PH1'], authorInitials: 'RH', updatedRelative: '1d ago' },
  { id: 'p4', title: 'Cell Respiration — Lecture Notes.docx', kind: 'file', fileType: 'doc', breadcrumb: ['Biology', 'Upper Sixth', 'Unit 1'], tags: ['U6BI1'], authorInitials: 'EM', updatedRelative: '1d ago' },
  { id: 'p5', title: 'Macbeth: Ambition & Guilt — Reading Guide', kind: 'page', fileType: 'page', breadcrumb: ['English', 'Year 8', 'Set 3', 'Macbeth'], tags: ['Y8EN3'], authorInitials: 'CL', updatedRelative: '2d ago' },
  { id: 'p6', title: 'Equilibrium & Le Chatelier’s Principle', kind: 'page', fileType: 'page', breadcrumb: ['Chemistry', 'Organic Chemistry', 'Equilibria'], tags: ['L6CH3'], authorInitials: 'JD', updatedRelative: '2d ago' },
];

// ---------------------------------------------------------------------------
// Shared: click-outside hook for dropdowns / FAB menu
// ---------------------------------------------------------------------------

function useClickOutside<T extends HTMLElement>(onOutside: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onOutside]);
  return ref;
}

// ---------------------------------------------------------------------------
// Top navigation
// ---------------------------------------------------------------------------

function TopNav() {
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
              {CURRENT_USER.initials}
            </span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block text-[12.5px] font-semibold text-slate-900">{CURRENT_USER.name}</span>
              <span className="block text-[10.5px] font-semibold uppercase tracking-wide text-[#254889]">
                {CURRENT_USER.role}
              </span>
            </span>
            <ChevronDown size={13} strokeWidth={2.4} className="text-slate-400" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-[calc(100%+10px)] w-[220px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
              <div className="px-4 pb-1 pt-3 text-[12.5px] font-bold text-slate-900">{CURRENT_USER.name}</div>
              <div className="px-4 pb-3 text-[11.5px] text-slate-500">{CURRENT_USER.email}</div>
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

function TagRail({ activeTag, onSelect }: { activeTag: string; onSelect: (id: string) => void }) {
  return (
    <div className="mb-8">
      <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Your tags</p>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {TAGS.map((tag) => {
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
          <span className="flex h-[17px] w-[17px] items-center justify-center rounded-full bg-[#dfe7f7] text-[8px] font-bold text-[#254889]">
            {page.authorInitials}
          </span>
          {page.updatedRelative}
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
          <button className="flex w-full items-center gap-3 px-[15px] py-3.5 text-left hover:bg-slate-50">
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

export default function Dashboard() {
  const [activeTag, setActiveTag] = useState('all');

  const visiblePages = PAGES.filter((p) => activeTag === 'all' || p.tags.includes(activeTag));

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <TopNav />

      <main className="mx-auto max-w-[1180px] px-8 pb-32 pt-9">
        <div className="mb-6">
          <h1 className="text-[23px] font-bold tracking-tight text-slate-900">
            Good afternoon, {CURRENT_USER.name.split(' ')[0]}
          </h1>
          <p className="mt-0.5 text-[13px] text-slate-500">Here&rsquo;s what&rsquo;s moving across your tags today.</p>
        </div>

        <TagRail activeTag={activeTag} onSelect={setActiveTag} />

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[14.5px] font-bold text-slate-900">Pages &amp; files</h2>
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          {visiblePages.map((page) => (
            <PageCardItem key={page.id} page={page} />
          ))}
        </div>
      </main>

      <FloatingActionButton />
    </div>
  );
}
