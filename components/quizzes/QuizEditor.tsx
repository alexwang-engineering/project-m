'use client';

import { useRouter } from 'next/navigation';
import { useId, useRef, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';

import { createQuizAction } from '@/app/actions/quizzes';
import { SkipToContentLink } from '@/components/ui/SkipToContentLink';
import { SubPageHeader } from '@/components/ui/SubPageHeader';

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
  kind: 'multiple_choice' | 'multiple_answer';
  correctChoiceIds: string[];
  weight: number;
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
    kind: 'multiple_choice',
    correctChoiceIds: ['a'],
    weight: 1,
    bankItemId: null,
  };
}

function bankQuestionDraft(key: string, item: BankItemOption): QuestionDraft {
  return {
    key,
    prompt: item.prompt,
    choices: item.choices.map((c) => ({ id: c.id, label: c.label })),
    kind: 'multiple_choice',
    correctChoiceIds: [item.correctChoiceId],
    weight: 1,
    bankItemId: item.id,
  };
}

const fieldClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px] text-slate-800 outline-none focus:border-brand-400';

export function QuizEditor({ writableTags, bankItems }: QuizEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [attemptLimit, setAttemptLimit] = useState('1');
  const [gradebookPolicy, setGradebookPolicy] = useState<'highest' | 'latest'>(
    'highest',
  );
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
    questions.every(
      (q) =>
        q.prompt.trim() !== '' &&
        q.choices.every((c) => c.label.trim() !== '') &&
        q.correctChoiceIds.length > 0 &&
        Number.isInteger(q.weight) &&
        q.weight >= 1 &&
        q.weight <= 100,
    ) &&
    !saving;

  function updateQuestion(
    key: string,
    updater: (q: QuestionDraft) => QuestionDraft,
  ) {
    setQuestions((prev) => prev.map((q) => (q.key === key ? updater(q) : q)));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await createQuizAction({
      title: title.trim(),
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      tagIds: Array.from(tagIds),
      attemptLimit: attemptLimit === 'unlimited' ? null : Number(attemptLimit),
      gradebookPolicy,
      questions: questions.map((q) =>
        q.bankItemId
          ? { bankItemId: q.bankItemId, weight: q.weight }
          : {
              prompt: q.prompt.trim(),
              choices: q.choices.map((c) => ({
                id: c.id,
                label: c.label.trim(),
              })),
              kind: q.kind,
              weight: q.weight,
              ...(q.kind === 'multiple_choice'
                ? { correctChoiceId: q.correctChoiceIds[0] }
                : { correctChoiceIds: q.correctChoiceIds }),
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
    <div className="min-h-[100dvh] bg-slate-50">
      <SkipToContentLink />
      <SubPageHeader
        backHref="/quizzes"
        backLabel="Quizzes"
        title="New quiz"
        actions={
          <>
            {error && (
              <p className="max-w-[280px] truncate text-[12px] text-red-600">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="bg-brand-600 hover:bg-brand-700 flex h-9 items-center gap-1.5 rounded-lg px-4 text-[12.5px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              Create quiz
            </button>
          </>
        }
      />

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-[960px] px-4 pt-10 pb-32 sm:px-8"
      >
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <input
            aria-label="Quiz title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Quiz title"
            className="w-full border-none text-[22px] font-semibold tracking-tight text-slate-950 outline-none placeholder:text-slate-300"
          />
          <div className="flex items-center gap-2">
            <label
              htmlFor="quiz-due-at"
              className="text-[12.5px] font-medium text-slate-500"
            >
              Due (optional)
            </label>
            <input
              id="quiz-due-at"
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1 text-[12.5px] text-slate-700"
            />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-[12.5px] font-medium text-slate-500">
              Attempts
              <select
                value={attemptLimit}
                onChange={(e) => setAttemptLimit(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1 text-slate-700"
              >
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="unlimited">Unlimited</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-[12.5px] font-medium text-slate-500">
              Gradebook result
              <select
                value={gradebookPolicy}
                onChange={(e) =>
                  setGradebookPolicy(e.target.value as 'highest' | 'latest')
                }
                className="rounded-lg border border-slate-200 px-2 py-1 text-slate-700"
              >
                <option value="highest">Highest attempt</option>
                <option value="latest">Latest attempt</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
            {writableTags.length === 0 && (
              <p className="text-[12.5px] text-slate-400">
                You have no tags you can publish to.
              </p>
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
              <div
                key={question.key}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex-1">
                    {fromBank && (
                      <p className="text-brand-600 mb-1 text-[10.5px] font-bold tracking-wide uppercase">
                        From question bank
                      </p>
                    )}
                    <input
                      aria-label={`Question ${qIndex + 1} prompt`}
                      value={question.prompt}
                      onChange={(e) =>
                        updateQuestion(question.key, (q) => ({
                          ...q,
                          prompt: e.target.value,
                        }))
                      }
                      placeholder={`Question ${qIndex + 1}`}
                      readOnly={fromBank}
                      className={`${fieldClass} font-medium ${fromBank ? 'bg-slate-50 text-slate-500' : ''}`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setQuestions((prev) =>
                        prev.filter((q) => q.key !== question.key),
                      )
                    }
                    disabled={questions.length <= 1}
                    className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                    aria-label="Remove question"
                  >
                    <Trash2 size={14} strokeWidth={2.4} />
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 px-3 py-2">
                    <label className="flex items-center gap-2 text-[12px] font-medium text-slate-600">
                      Answer type
                      <select
                        value={question.kind}
                        disabled={fromBank}
                        onChange={(event) =>
                          updateQuestion(question.key, (q) => ({
                            ...q,
                            kind: event.target.value as QuestionDraft['kind'],
                            correctChoiceIds: [q.correctChoiceIds[0] ?? 'a'],
                          }))
                        }
                        className="rounded-md border border-slate-200 bg-white px-2 py-1"
                      >
                        <option value="multiple_choice">One answer</option>
                        <option value="multiple_answer">
                          Multiple answers
                        </option>
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-[12px] font-medium text-slate-600">
                      Points
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={question.weight}
                        onChange={(event) =>
                          updateQuestion(question.key, (q) => ({
                            ...q,
                            weight: Number(event.target.value),
                          }))
                        }
                        className="w-16 rounded-md border border-slate-200 bg-white px-2 py-1"
                      />
                    </label>
                  </div>
                  {question.choices.map((choice, cIndex) => (
                    <div key={choice.id} className="flex items-center gap-2">
                      <input
                        type={
                          question.kind === 'multiple_answer'
                            ? 'checkbox'
                            : 'radio'
                        }
                        name={`correct-${question.key}`}
                        checked={question.correctChoiceIds.includes(choice.id)}
                        disabled={fromBank}
                        onChange={() =>
                          updateQuestion(question.key, (q) => ({
                            ...q,
                            correctChoiceIds:
                              q.kind === 'multiple_choice'
                                ? [choice.id]
                                : q.correctChoiceIds.includes(choice.id)
                                  ? q.correctChoiceIds.filter(
                                      (id) => id !== choice.id,
                                    )
                                  : [...q.correctChoiceIds, choice.id],
                          }))
                        }
                        aria-label={`Mark choice ${cIndex + 1} as correct`}
                      />
                      <input
                        aria-label={`Question ${qIndex + 1}, choice ${cIndex + 1} text`}
                        value={choice.label}
                        readOnly={fromBank}
                        onChange={(e) =>
                          updateQuestion(question.key, (q) => ({
                            ...q,
                            choices: q.choices.map((c) =>
                              c.id === choice.id
                                ? { ...c, label: e.target.value }
                                : c,
                            ),
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
                              choices: q.choices.filter(
                                (c) => c.id !== choice.id,
                              ),
                              correctChoiceIds: q.correctChoiceIds.filter(
                                (id) => id !== choice.id,
                              ),
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
                          return nextId
                            ? {
                                ...q,
                                choices: [
                                  ...q.choices,
                                  { id: nextId, label: '' },
                                ],
                              }
                            : q;
                        })
                      }
                      disabled={question.choices.length >= CHOICE_IDS.length}
                      className="text-brand-600 hover:text-brand-700 self-start text-[12.5px] font-semibold disabled:opacity-40"
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
            className="hover:border-brand-400 hover:text-brand-700 flex h-10 items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 text-[12.5px] font-semibold text-slate-500"
          >
            <Plus size={14} strokeWidth={2.4} />
            Add question
          </button>
          <button
            type="button"
            onClick={() => setBankPickerOpen((open) => !open)}
            disabled={bankItems.length === 0}
            className="hover:border-brand-400 hover:text-brand-700 flex h-10 items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 text-[12.5px] font-semibold text-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus size={14} strokeWidth={2.4} />
            Add from bank
          </button>
        </div>

        {bankPickerOpen && (
          <div className="mt-3 flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-white p-3">
            {bankItems.length === 0 ? (
              <p className="text-[12.5px] text-slate-400">
                No bank items available.
              </p>
            ) : (
              bankItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                >
                  <span className="truncate text-[13px] text-slate-700">
                    {item.prompt}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setQuestions((prev) => [
                        ...prev,
                        bankQuestionDraft(nextQuestionKey(), item),
                      ])
                    }
                    className="text-brand-600 hover:text-brand-700 flex-shrink-0 text-[12px] font-semibold"
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
