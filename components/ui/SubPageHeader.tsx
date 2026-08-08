import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

interface SubPageHeaderProps {
  /** Omit for the logo-brand variant (entry-point pages with no dashboard to return to, e.g. ParentView). */
  backHref?: string;
  backLabel?: string;
  title: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
}

/** Shared sticky header shell for every non-dashboard page - back link, title, optional badge/actions. */
export function SubPageHeader({
  backHref,
  backLabel,
  title,
  badge,
  actions,
}: SubPageHeaderProps) {
  return (
    <header className="sticky top-0 z-40 flex h-[68px] items-center justify-between gap-4 border-b border-slate-200 bg-white/85 px-8 backdrop-blur">
      <div className="flex items-center gap-4">
        {backHref ? (
          <Link
            href={backHref}
            className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 transition hover:text-slate-900"
          >
            <ArrowLeft size={15} strokeWidth={2.4} />
            {backLabel}
          </Link>
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[#254889] text-[15px] font-bold text-white">
            M
          </div>
        )}
        <span className="text-[15.5px] font-semibold tracking-tight text-slate-900">
          {title}
        </span>
        {badge}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
