'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';

const primaryLinks = [
  { href: '/resources', label: 'Resources' },
  { href: '/assignments', label: 'Assignments' },
  { href: '/quizzes', label: 'Quizzes' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/announcements', label: 'Announcements' },
  { href: '/gradebook', label: 'Gradebook' },
] as const;

export function PrimaryNavigation({
  isAdmin = false,
  align = 'right',
}: {
  isAdmin?: boolean;
  align?: 'left' | 'right';
}) {
  const pathname = usePathname();
  const links = isAdmin
    ? [...primaryLinks, { href: '/admin', label: 'Admin' }]
    : primaryLinks;

  return (
    <>
      <nav aria-label="Primary" className="hidden items-center gap-0.5 xl:flex">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={
              pathname === link.href || pathname?.startsWith(`${link.href}/`)
                ? 'page'
                : undefined
            }
            className="rounded-lg px-2.5 py-2.5 text-sm font-semibold text-blue-50 transition hover:bg-white/10 hover:text-white aria-[current=page]:bg-white/15 aria-[current=page]:text-white aria-[current=page]:shadow-[inset_0_-2px_0_white]"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <details className="group relative xl:hidden">
        <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-3 text-sm font-semibold text-white transition hover:bg-white/20 [&::-webkit-details-marker]:hidden">
          <Menu size={17} aria-hidden="true" />
          Menu
        </summary>
        <nav
          aria-label="Primary mobile"
          className={`absolute top-[calc(100%+0.5rem)] ${align === 'left' ? 'left-0' : 'right-0'} z-50 grid min-w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-xl`}
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={
                pathname === link.href || pathname?.startsWith(`${link.href}/`)
                  ? 'page'
                  : undefined
              }
              aria-label={`${link.label} mobile navigation`}
              className="aria-[current=page]:bg-brand-50 aria-[current=page]:text-brand-700 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-950"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </details>
    </>
  );
}
