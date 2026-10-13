'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  Megaphone,
  Menu,
  ShieldCheck,
  SquarePen,
} from 'lucide-react';

const primaryLinks = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/resources', label: 'Resources', icon: BookOpen },
  { href: '/assignments', label: 'Assignments', icon: ClipboardCheck },
  { href: '/quizzes', label: 'Quizzes', icon: SquarePen },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/announcements', label: 'Announcements', icon: Megaphone },
  { href: '/gradebook', label: 'Gradebook', icon: GraduationCap },
];

export function PrimaryNavigation({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const links = isAdmin
    ? [...primaryLinks, { href: '/admin', label: 'Admin', icon: ShieldCheck }]
    : primaryLinks;
  const active = (href: string) =>
    pathname === href || (href !== '/' && pathname?.startsWith(`${href}/`));
  return (
    <>
      <nav aria-label="Primary" className="hidden items-center gap-5 xl:flex">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={active(href) ? 'page' : undefined}
            className="flex items-center gap-2 text-[13px] font-medium text-blue-100 transition hover:text-white aria-[current=page]:text-white"
          >
            <Icon size={14} aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>
      <details key={pathname} className="relative py-2 xl:hidden">
        <summary className="text-brand-700 hover:bg-brand-50 flex min-h-10 w-fit cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          <Menu size={18} aria-hidden="true" />
          Menu
        </summary>
        <nav
          aria-label="Primary mobile"
          className="absolute top-full left-0 z-50 grid max-h-[min(28rem,calc(100dvh-16rem))] w-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
        >
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-label={`${label} mobile navigation`}
              aria-current={active(href) ? 'page' : undefined}
              className="aria-[current=page]:bg-brand-50 aria-[current=page]:text-brand-700 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Icon size={17} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
      </details>
    </>
  );
}
