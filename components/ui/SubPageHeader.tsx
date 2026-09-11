import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

import { PrimaryNavigation } from '@/components/ui/PrimaryNavigation';

interface SubPageHeaderProps {
  /** Omit for entry-point pages with no dashboard to return to, such as ParentView. */
  backHref?: string;
  backLabel?: string;
  title: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
}

/** Shared responsive application shell for every non-dashboard page. */
export function SubPageHeader({
  backHref,
  backLabel,
  title,
  badge,
  actions,
}: SubPageHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="bg-brand-600 border-brand-700 border-b">
        <div className="mx-auto flex min-h-16 max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-8">
          <Link
            href="/"
            className="flex items-center gap-2.5"
            aria-label="Project M dashboard"
          >
            <span className="text-brand-700 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-base font-bold shadow-sm">
              M
            </span>
            <span className="text-base font-semibold tracking-tight whitespace-nowrap text-white">
              Project M
            </span>
          </Link>
          {backHref && <PrimaryNavigation />}
        </div>
      </div>

      <div className="mx-auto flex min-h-16 max-w-[1280px] flex-col justify-center gap-3 px-4 py-3 sm:px-8 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {backHref && (
            <Link
              href={backHref}
              className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-950"
            >
              <ArrowLeft size={16} strokeWidth={2.4} aria-hidden="true" />
              <span className="hidden sm:inline">{backLabel}</span>
            </Link>
          )}
          {backHref && (
            <span className="h-5 w-px bg-slate-200" aria-hidden="true" />
          )}
          <h1 className="truncate text-lg font-semibold tracking-tight text-slate-950">
            {title}
          </h1>
          {badge}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
