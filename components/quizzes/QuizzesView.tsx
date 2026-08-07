'use client';

import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Clock, HelpCircle, Plus } from 'lucide-react';

import { EmptyState } from '@/components/ui/EmptyState';
import { formatRelativeTime } from '@/lib/relative-time';
import type { QuizSummary } from '@/lib/content/quizzes';

interface QuizzesViewProps {
  quizzes: readonly QuizSummary[];
}

function isOverdue(dueAt: string | null): boolean {
  return dueAt !== null && new Date(dueAt).getTime() < Date.now();
}

function QuizCard({ quiz }: { quiz: QuizSummary }) {
  const overdue = isOverdue(quiz.dueAt);
  return (
    <Link
      href={`/quizzes/${quiz.id}`}
      className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-[18px] shadow-sm transition hover:border-brand-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[14px] font-semibold leading-snug tracking-tight text-slate-900">{quiz.title}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {quiz.tags.map((tag) => (
              <span
                key={tag.name}
                className="flex h-5 items-center rounded-md border border-slate-200 bg-slate-50 px-2 text-[10.5px] font-bold text-slate-500"
              >
                {tag.name}
              </span>
            ))}
          </div>
        </div>
        {quiz.hasAttempted && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            <CheckCircle2 size={13} strokeWidth={2.4} />
            Attempted
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 text-[12px] text-slate-500">
        <Clock size={13} strokeWidth={2} />
        {quiz.dueAt ? (
          <span
            className={overdue && !quiz.hasAttempted ? 'font-semibold text-[#c2483a]' : ''}
            suppressHydrationWarning
          >
            Due {formatRelativeTime(quiz.dueAt)}
          </span>
        ) : (
          <span>No deadline</span>
        )}
      </div>
    </Link>
  );
}

export default function QuizzesView({ quizzes }: QuizzesViewProps) {
  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <header className="sticky top-0 z-40 flex h-[68px] items-center justify-between gap-4 border-b border-slate-200 bg-white/85 px-8 backdrop-blur">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 transition hover:text-slate-900"
          >
            <ArrowLeft size={15} strokeWidth={2.4} />
            Dashboard
          </Link>
          <span className="text-[15.5px] font-semibold tracking-tight text-slate-900">Quizzes</span>
        </div>
        <Link
          href="/quizzes/new"
          className="flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 text-[12.5px] font-semibold text-white transition hover:bg-brand-700"
        >
          <Plus size={14} strokeWidth={2.4} />
          New quiz
        </Link>
      </header>

      <main className="mx-auto max-w-[900px] px-8 pb-24 pt-9">
        {quizzes.length === 0 ? (
          <EmptyState
            icon={<HelpCircle size={20} strokeWidth={2} />}
            title="No quizzes yet"
            description="Quizzes set for your tags will appear here once a teacher publishes one."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {quizzes.map((quiz) => (
              <QuizCard key={quiz.id} quiz={quiz} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
