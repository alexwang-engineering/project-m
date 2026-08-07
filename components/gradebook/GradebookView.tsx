'use client';

import Link from 'next/link';
import { ArrowLeft, ClipboardList } from 'lucide-react';

import { EmptyState } from '@/components/ui/EmptyState';
import { formatRelativeTime } from '@/lib/relative-time';
import type { GradebookData } from '@/lib/content/gradebook';

interface GradebookViewProps {
  data: GradebookData;
}

function detailHref(kind: 'assignment' | 'quiz', id: string): string {
  return kind === 'assignment' ? `/assignments/${id}` : `/quizzes/${id}`;
}

export default function GradebookView({ data }: GradebookViewProps) {
  const isEmpty = data.studentRows.length === 0 && data.teacherRows.length === 0;

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <header className="sticky top-0 z-40 flex h-[68px] items-center gap-4 border-b border-slate-200 bg-white/85 px-8 backdrop-blur">
        <Link href="/" className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 transition hover:text-slate-900">
          <ArrowLeft size={15} strokeWidth={2.4} />
          Dashboard
        </Link>
        <span className="text-[15.5px] font-semibold tracking-tight text-slate-900">Gradebook</span>
      </header>

      <main className="mx-auto max-w-[820px] px-8 pb-24 pt-9">
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
                <h2 className="mb-3 text-[14.5px] font-bold text-slate-900">What you manage</h2>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {data.teacherRows.map((row, index) => (
                    <Link
                      key={`${row.kind}-${row.id}`}
                      href={detailHref(row.kind, row.id)}
                      className={`flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50 ${index > 0 ? 'border-t border-slate-100' : ''}`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-semibold text-slate-900">{row.title}</p>
                        <p className="text-[11.5px] capitalize text-slate-500">
                          {row.kind} — {row.count} {row.kind === 'assignment' ? 'submission' : 'attempt'}
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
                <h2 className="mb-3 text-[14.5px] font-bold text-slate-900">Your grades</h2>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {data.studentRows.map((row, index) => (
                    <Link
                      key={`${row.kind}-${row.id}`}
                      href={detailHref(row.kind, row.id)}
                      className={`flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50 ${index > 0 ? 'border-t border-slate-100' : ''}`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-semibold text-slate-900">{row.title}</p>
                        <p className="text-[11.5px] capitalize text-slate-500" suppressHydrationWarning>
                          {row.kind} — {formatRelativeTime(row.recordedAt)}
                        </p>
                      </div>
                      <span className="flex-shrink-0 rounded-full bg-brand-50 px-3 py-1 text-[12px] font-bold text-brand-700">
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
