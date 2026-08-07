'use client';

import { useRouter } from 'next/navigation';
import { useId, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react';

import { createQuizAction } from '@/app/actions/quizzes';

interface EditorTag {
  readonly id: string;
  readonly name: string;
  readonly displayName: string;
}

interface BankItemOption {
  readonly id: string;
  readonly prompt: string;
  readonly choices: readonly { readonly id: string; readonly label: string }[];
  readonly correctChoiceId: string;
}

interface QuizEditorProps {
  writableTags: readonly EditorTag[];
  bankItems: readonly BankItemOption[];
}

interface ChoiceDraft {
  id: string;
  label: string;
}

interface QuestionDraft {
  key: string;
  prompt: string;
  choices: ChoiceDraft[];
  correctChoiceId: string;
  /** Set when this question was added via "add from bank" (ADR-014) - its content is read-only here and resolved server-side from the bank item's current row, not from what's displayed. */
  bankItemId: string | null;
}

const CHOICE_IDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

function newQuestionDraft(key: string): QuestionDraft {
  return {
    key,
    prompt: '',
    choices: [
      { id: 'a', label: '' },
      { id: 'b', label: '' },
    ],
    correctChoiceId: 'a',
    bankItemId: null,
  };
}

function bankQuestionDraft(key: string, item: BankItemOption): QuestionDraft {
  return {
    key,
    prompt: item.prompt,
    choices: item.choices.map((c) => ({ id: c.id, label: c.label })),
    correctChoiceId: item.correctChoiceId,
    bankItemId: item.id,
  };
}

const fieldClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px] text-slate-800 outline-none focus:border-brand-400';

export function QuizEditor({ writableTags, bankItems }: QuizEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [tagIds, setTagIds] = useState<Set<string>>(new Set());
  const [bankPickerOpen, setBankPickerOpen] = useState(false);
  // useId() is stable between the server render and the client hydration
  // pass; a per-question counter built on top of it keeps every generated
  // key deterministic too. A plain Date.now()/Math.random() key (the
  // obvious alternative) would differ between those two passes and
  // mismatch the radio group's `name` attribute - same class of bug as the
  // Date.now()-driven relative-time hydration mismatches fixed elsewhere in
  // this app, but on an attribute rather than text, where
  // suppressHydrationWarning doesn't apply.
  const questionIdPrefix = useId();
  const questionCounter = useRef(1);
  const [questions, setQuestions] = useState<QuestionDraft[]>(() => [
    newQuestionDraft(`${questionIdPrefix}-q0`),
  ]);
  function nextQuestionKey(): string {
    return `${questionIdPrefix}-q${questionCounter.current++}`;
  }
  function newQuestion(): QuestionDraft {
    return newQuestionDraft(nextQuestionKey());
  }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave =
    title.trim() !== '' &&
    tagIds.size > 0 &&
    questions.length > 0 &&
    questions.every((q) => q.prompt.trim() !== '' && q.choices.every((c) => c.label.trim() !== '')) &&
    !saving;

  function updateQuestion(key: string, updater: (q: QuestionDraft) => QuestionDraft) {
    setQuestions((prev) => prev.map((q) => (q.key === key ? updater(q) : q)));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await createQuizAction({
      title: title.trim(),
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      tagIds: Array.from(tagIds),
      questions: questions.map((q) =>
        q.bankItemId
          ? { bankItemId: q.bankItemId }
          : {
              prompt: q.prompt.trim(),
              choices: q.choices.map((c) => ({ id: c.id, label: c.label.trim() })),
              correctChoiceId: q.correctChoiceId,
            },
      ),
    });
    if (!result.ok) {
      setError(result.message);
      setSaving(false);
      return;
    }
    router.push(`/quizzes/${result.quiz.id}`);
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <header className="sticky top-0 z-40 flex h-[68px] items-center justify-between gap-4 border-b border-slate-200 bg-white/85 px-8 backdrop-blur">
        <div className="flex items-center gap-4">
          <Link href="/quizzes" className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 hover:text-slate-900">
            <ArrowLeft size={15} strokeWidth={2.4} />
            Quizzes
          </Link>
          <span className="text-[15.5px] font-semibold tracking-tight text-slate-900">New quiz</span>
        </div>
        <div className="flex items-center gap-2">
          {error && <p className="max-w-[280px] truncate text-[12px] text-red-600">{error}</p>}
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-[12.5px] font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            Create quiz
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[760px] px-8 pb-32 pt-9">
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Quiz title"
            className="w-full border-none text-[22px] font-semibold tracking-tight text-slate-950 outline-none placeholder:text-slate-300"
          />
          <div className="flex items-center gap-2">
            <label className="text-[12.5px] font-medium text-slate-500">Due (optional)</label>
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1 text-[12.5px] text-slate-700"
            />
          </div>
          <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
            {writableTags.length === 0 && (
              <p className="text-[12.5px] text-slate-400">You have no tags you can publish to.</p>
            )}
            {writableTags.map((tag) => {
              const active = tagIds.has(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() =>
                    setTagIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(tag.id)) next.delete(tag.id);
                      else next.add(tag.id);
                      return next;
                    })
                  }
                  className={`rounded-md border px-2.5 py-1 text-[11px] font-bold transition ${
                    active
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {questions.map((question, qIndex) => {
            const fromBank = question.bankItemId !== null;
            return (
              <div key={question.key} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex-1">
                    {fromBank && (
                      <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-brand-600">From question bank</p>
                    )}
                    <input
                      value={question.prompt}
                      onChange={(e) => updateQuestion(question.key, (q) => ({ ...q, prompt: e.target.value }))}
                      placeholder={`Question ${qIndex + 1}`}
                      readOnly={fromBank}
                      className={`${fieldClass} font-medium ${fromBank ? 'bg-slate-50 text-slate-500' : ''}`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setQuestions((prev) => prev.filter((q) => q.key !== question.key))}
                    disabled={questions.length <= 1}
                    className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                    aria-label="Remove question"
                  >
                    <Trash2 size={14} strokeWidth={2.4} />
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {question.choices.map((choice, cIndex) => (
                    <div key={choice.id} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`correct-${question.key}`}
                        checked={question.correctChoiceId === choice.id}
                        disabled={fromBank}
                        onChange={() => updateQuestion(question.key, (q) => ({ ...q, correctChoiceId: choice.id }))}
                        aria-label={`Mark choice ${cIndex + 1} as correct`}
                      />
                      <input
                        value={choice.label}
                        readOnly={fromBank}
                        onChange={(e) =>
                          updateQuestion(question.key, (q) => ({
                            ...q,
                            choices: q.choices.map((c) => (c.id === choice.id ? { ...c, label: e.target.value } : c)),
                          }))
                        }
                        placeholder={`Choice ${cIndex + 1}`}
                        className={`${fieldClass} ${fromBank ? 'bg-slate-50 text-slate-500' : ''}`}
                      />
                      {!fromBank && (
                        <button
                          type="button"
                          onClick={() =>
                            updateQuestion(question.key, (q) => ({
                              ...q,
                              choices: q.choices.filter((c) => c.id !== choice.id),
                              correctChoiceId: q.correctChoiceId === choice.id ? (q.choices[0]?.id ?? 'a') : q.correctChoiceId,
                            }))
                          }
                          disabled={question.choices.length <= 2}
                          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                          aria-label="Remove choice"
                        >
                          <Trash2 size={13} strokeWidth={2.4} />
                        </button>
                      )}
                    </div>
                  ))}
                  {!fromBank && (
                    <button
                      type="button"
                      onClick={() =>
                        updateQuestion(question.key, (q) => {
                          const nextId = CHOICE_IDS[q.choices.length];
                          return nextId ? { ...q, choices: [...q.choices, { id: nextId, label: '' }] } : q;
                        })
                      }
                      disabled={question.choices.length >= CHOICE_IDS.length}
                      className="self-start text-[12.5px] font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-40"
                    >
                      + Add choice
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setQuestions((prev) => [...prev, newQuestion()])}
            className="flex h-10 items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 text-[12.5px] font-semibold text-slate-500 hover:border-brand-400 hover:text-brand-700"
          >
            <Plus size={14} strokeWidth={2.4} />
            Add question
          </button>
          <button
            type="button"
            onClick={() => setBankPickerOpen((open) => !open)}
            disabled={bankItems.length === 0}
            className="flex h-10 items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 text-[12.5px] font-semibold text-slate-500 hover:border-brand-400 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus size={14} strokeWidth={2.4} />
            Add from bank
          </button>
        </div>

        {bankPickerOpen && (
          <div className="mt-3 flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-white p-3">
            {bankItems.length === 0 ? (
              <p className="text-[12.5px] text-slate-400">No bank items available.</p>
            ) : (
              bankItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                  <span className="truncate text-[13px] text-slate-700">{item.prompt}</span>
                  <button
                    type="button"
                    onClick={() => setQuestions((prev) => [...prev, bankQuestionDraft(nextQuestionKey(), item)])}
                    className="flex-shrink-0 text-[12px] font-semibold text-brand-600 hover:text-brand-700"
                  >
                    + Add
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
