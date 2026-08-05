import type { ReactNode } from 'react';

type Props = {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
};

/** Shared empty-state layout for any dashboard section with zero items. */
export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        {icon}
      </div>
      <p className="text-[14px] font-semibold text-slate-900">{title}</p>
      <p className="max-w-sm text-[13px] leading-relaxed text-slate-500">
        {description}
      </p>
      {action}
    </div>
  );
}
