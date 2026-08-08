'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { HelpCircle, Loader2, X } from 'lucide-react';

import { archiveBankItemAction } from '@/app/actions/question-bank';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkipToContentLink } from '@/components/ui/SkipToContentLink';
import { SubPageHeader } from '@/components/ui/SubPageHeader';
import { CreateBankItemForm } from '@/components/question-bank/CreateBankItemForm';
import type { BankItemSummary } from '@/lib/content/question-bank';

interface EditorTag {
  readonly id: string;
  readonly name: string;
}

interface QuestionBankViewProps {
  readonly items: readonly BankItemSummary[];
  readonly writableTags: readonly EditorTag[];
}

export function QuestionBankView({
  items,
  writableTags,
}: QuestionBankViewProps) {
  const router = useRouter();
  const [archivedIds, setArchivedIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleArchive(itemId: string) {
    setArchivingId(itemId);
    setError(null);
    const result = await archiveBankItemAction({ itemId });
    setArchivingId(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setArchivedIds((prev) => new Set(prev).add(itemId));
  }

  const visibleItems = items.filter((item) => !archivedIds.has(item.id));

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <SkipToContentLink />
      <SubPageHeader
        backHref="/quizzes"
        backLabel="Quizzes"
        title="Question bank"
      />

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-[760px] px-8 pt-9 pb-24"
      >
        <CreateBankItemForm
          writableTags={writableTags}
          onCreated={() => router.refresh()}
        />

        {error && <p className="mb-4 text-[12.5px] text-red-600">{error}</p>}

        {visibleItems.length === 0 ? (
          <EmptyState
            icon={<HelpCircle size={20} strokeWidth={2} />}
            title="No bank items yet"
            description="Create reusable multiple-choice questions here, then add them into any quiz on the same tags."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {visibleItems.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-[18px] shadow-sm"
              >
                <div>
                  <p className="text-[14px] leading-snug font-semibold tracking-tight text-slate-900">
                    {item.prompt}
                  </p>
                  <ul className="mt-2 flex flex-col gap-1">
                    {item.choices.map((choice) => (
                      <li
                        key={choice.id}
                        className={`text-[12.5px] ${
                          choice.id === item.correctChoiceId
                            ? 'font-semibold text-emerald-700'
                            : 'text-slate-500'
                        }`}
                      >
                        {choice.id === item.correctChoiceId ? '✓ ' : ''}
                        {choice.label}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.tags.map((tag) => (
                      <span
                        key={tag.name}
                        className="flex h-5 items-center rounded-md border border-slate-200 bg-slate-50 px-2 text-[10.5px] font-bold text-slate-500"
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleArchive(item.id)}
                  disabled={archivingId === item.id}
                  aria-label="Archive bank item"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {archivingId === item.id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <X size={14} strokeWidth={2.4} />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
