'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';

import { EmptyState } from '@/components/ui/EmptyState';
import { SkipToContentLink } from '@/components/ui/SkipToContentLink';
import { SubPageHeader } from '@/components/ui/SubPageHeader';
import { formatRelativeTime } from '@/lib/relative-time';
import { submitQuizAttemptAction } from '@/app/actions/quizzes';
import type { QuizDetail } from '@/lib/content/quizzes';

interface QuizDetailViewProps {
  quiz: QuizDetail;
}

function AttemptsList({ attempts }: { attempts: QuizDetail['attempts'] }) {
  if (attempts.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircle2 size={20} strokeWidth={2} />}
        title="No attempts yet"
        description="Nobody in the audience has taken this quiz yet."
      />
    );
  }
  return (
    <div className="flex flex-col gap-2.5">
      {attempts.map((attempt) => (
        <div
          key={attempt.id}
          className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4"
        >
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-semibold text-slate-900">
              {attempt.studentEmail ?? 'Unknown student'}
            </p>
            <p
              className="text-[11.5px] text-slate-500"
              suppressHydrationWarning
            >
              Submitted {formatRelativeTime(attempt.submittedAt)}
            </p>
          </div>
          <span className="bg-brand-50 text-brand-700 flex-shrink-0 rounded-full px-3 py-1 text-[12.5px] font-bold">
            {attempt.score}/{attempt.maxScore}
          </span>
        </div>
      ))}
    </div>
  );
}

function TakeQuizForm({ quiz }: { quiz: QuizDetail }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = quiz.questions.every((q) => answers[q.id]) && !submitting;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const result = await submitQuizAttemptAction({ quizId: quiz.id, answers });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <EmptyState
        icon={<CheckCircle2 size={20} strokeWidth={2} />}
        title="Attempt submitted"
        description="Your answers have been recorded and graded."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {quiz.questions.map((question, index) => (
        <div
          key={question.id}
          className="rounded-xl border border-slate-200 bg-white p-4"
        >
          <p className="mb-3 text-[14px] font-medium text-slate-900">
            {index + 1}. {question.prompt}
          </p>
          <div className="flex flex-col gap-2">
            {question.choices.map((choice) => (
              <label
                key={choice.id}
                className="hover:border-brand-300 flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2 text-[13.5px] text-slate-700"
              >
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  checked={answers[question.id] === choice.id}
                  onChange={() =>
                    setAnswers((prev) => ({
                      ...prev,
                      [question.id]: choice.id,
                    }))
                  }
                />
                {choice.label}
              </label>
            ))}
          </div>
        </div>
      ))}

      {error && <p className="text-[12.5px] text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="bg-brand-600 hover:bg-brand-700 flex h-10 items-center justify-center gap-2 self-start rounded-xl px-5 text-[13px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting && <Loader2 size={14} className="animate-spin" />}
        Submit answers
      </button>
    </div>
  );
}

export default function QuizDetailView({ quiz }: QuizDetailViewProps) {
  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <SkipToContentLink />
      <SubPageHeader
        backHref="/quizzes"
        backLabel="Quizzes"
        title={quiz.title}
      />

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-[720px] px-8 pt-9 pb-24"
      >
        <div className="mb-6">
          <h1 className="text-[20px] font-bold tracking-tight text-slate-900">
            {quiz.canManage
              ? 'Attempts'
              : quiz.myAttempt
                ? 'Your result'
                : 'Take the quiz'}
          </h1>
          {quiz.dueAt && (
            <p
              className="mt-0.5 text-[13px] text-slate-500"
              suppressHydrationWarning
            >
              Due {formatRelativeTime(quiz.dueAt)}
            </p>
          )}
        </div>

        {quiz.canManage ? (
          <AttemptsList attempts={quiz.attempts} />
        ) : quiz.myAttempt ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center">
            <span className="bg-brand-50 text-brand-700 rounded-full px-4 py-2 text-[20px] font-bold">
              {quiz.myAttempt.score}/{quiz.myAttempt.maxScore}
            </span>
            <p className="text-[13px] text-slate-500" suppressHydrationWarning>
              Submitted {formatRelativeTime(quiz.myAttempt.submittedAt)}
            </p>
          </div>
        ) : (
          <TakeQuizForm quiz={quiz} />
        )}
      </main>
    </div>
  );
}
