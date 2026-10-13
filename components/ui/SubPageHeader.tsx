import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

import { SchoolBrand } from '@/components/ui/SchoolBrand';
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
    <header className="border-brand-700 bg-brand-600 sticky top-0 z-40 border-b">
      <div className="mx-auto flex min-h-[58px] max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-8">
        <SchoolBrand />
        {backHref && (
          <div className="hidden items-center gap-5 xl:flex">
            <PrimaryNavigation />
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-[11px] font-semibold text-white"
            aria-label="Profile"
          >
            SI
          </button>
        </div>
      </div>

      <div className="border-t border-white/10 bg-slate-50">
        <div className="mx-auto max-w-[1280px] px-4 py-5 sm:px-8">
          <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              {backHref && (
                <div className="mb-2 flex items-center gap-2 text-[11px] font-medium tracking-[0.18em] text-slate-500 uppercase">
                  <Link
                    href={backHref}
                    className="inline-flex items-center gap-1 text-slate-600"
                  >
                    <ArrowLeft size={12} strokeWidth={2.4} aria-hidden="true" />
                    {backLabel}
                  </Link>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-display text-[32px] font-extrabold tracking-[-0.02em] text-slate-900 sm:text-[40px]">
                  {title}
                </h1>
                {badge}
              </div>
            </div>
            {actions && (
              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                {actions}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
