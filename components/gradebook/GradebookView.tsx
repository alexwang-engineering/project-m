'use client';

import Link from 'next/link';
import { ClipboardList } from 'lucide-react';

import { EmptyState } from '@/components/ui/EmptyState';
import { SkipToContentLink } from '@/components/ui/SkipToContentLink';
import { SubPageHeader } from '@/components/ui/SubPageHeader';
import { formatRelativeTime } from '@/lib/relative-time';
import type { GradebookData } from '@/lib/content/gradebook';

interface GradebookViewProps {
  data: GradebookData;
}

function detailHref(kind: 'assignment' | 'quiz', id: string): string {
  return kind === 'assignment' ? `/assignments/${id}` : `/quizzes/${id}`;
}

export default function GradebookView({ data }: GradebookViewProps) {
  const isEmpty =
    data.studentRows.length === 0 && data.teacherRows.length === 0;

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <SkipToContentLink />
      <SubPageHeader backHref="/" backLabel="Dashboard" title="Gradebook" />

      <main id="main-content" className="mx-auto max-w-[820px] px-8 pt-9 pb-24">
        {isEmpty ? (
          <EmptyState
            icon={<ClipboardList size={20} strokeWidth={2} />}
            title="Nothing graded yet"
            description="Grades from assignments and quizzes will appear here as they're recorded."
          />
        ) : (
          <div className="flex flex-col gap-8">
            {data.teacherRows.length > 0 && (
              <section>
                <h2 className="mb-3 text-[14.5px] font-bold text-slate-900">
                  What you manage
                </h2>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {data.teacherRows.map((row, index) => (
                    <Link
                      key={`${row.kind}-${row.id}`}
                      href={detailHref(row.kind, row.id)}
                      className={`flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50 ${index > 0 ? 'border-t border-slate-100' : ''}`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-semibold text-slate-900">
                          {row.title}
                        </p>
                        <p className="text-[11.5px] text-slate-500 capitalize">
                          {row.kind} — {row.count}{' '}
                          {row.kind === 'assignment' ? 'submission' : 'attempt'}
                          {row.count === 1 ? '' : 's'}
                        </p>
                      </div>
                      <span className="flex-shrink-0 rounded-full bg-slate-100 px-3 py-1 text-[12px] font-bold text-slate-700">
                        {row.averageLabel ?? '—'}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {data.studentRows.length > 0 && (
              <section>
                <h2 className="mb-3 text-[14.5px] font-bold text-slate-900">
                  Your grades
                </h2>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {data.studentRows.map((row, index) => (
                    <Link
                      key={`${row.kind}-${row.id}`}
                      href={detailHref(row.kind, row.id)}
                      className={`flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50 ${index > 0 ? 'border-t border-slate-100' : ''}`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-semibold text-slate-900">
                          {row.title}
                        </p>
                        <p
                          className="text-[11.5px] text-slate-500 capitalize"
                          suppressHydrationWarning
                        >
                          {row.kind} — {formatRelativeTime(row.recordedAt)}
                        </p>
                      </div>
                      <span className="bg-brand-50 text-brand-700 flex-shrink-0 rounded-full px-3 py-1 text-[12px] font-bold">
                        {row.scoreLabel}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
