import Link from 'next/link';
import { Menu } from 'lucide-react';

const primaryLinks = [
  { href: '/resources', label: 'Resources' },
  { href: '/assignments', label: 'Assignments' },
  { href: '/quizzes', label: 'Quizzes' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/announcements', label: 'Announcements' },
  { href: '/gradebook', label: 'Gradebook' },
] as const;

export function PrimaryNavigation({ isAdmin = false }: { isAdmin?: boolean }) {
  const links = isAdmin
    ? [...primaryLinks, { href: '/admin', label: 'Admin' }]
    : primaryLinks;

  return (
    <>
      <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-blue-50 transition hover:bg-white/10 hover:text-white"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <details className="group relative lg:hidden">
        <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-3 text-sm font-semibold text-white transition hover:bg-white/20 [&::-webkit-details-marker]:hidden">
          <Menu size={17} aria-hidden="true" />
          Menu
        </summary>
        <nav
          aria-label="Primary mobile"
          className="absolute top-[calc(100%+0.5rem)] right-0 z-50 grid min-w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-xl"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-label={`${link.label} mobile navigation`}
              className="rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-950"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </details>
    </>
  );
}
