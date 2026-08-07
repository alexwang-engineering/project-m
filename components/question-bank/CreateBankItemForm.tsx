'use client';

import { useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';

import { createBankItemAction } from '@/app/actions/question-bank';

interface EditorTag {
  readonly id: string;
  readonly name: string;
}

interface CreateBankItemFormProps {
  readonly writableTags: readonly EditorTag[];
  readonly onCreated: () => void;
}

interface ChoiceDraft {
  id: string;
  label: string;
}

const CHOICE_IDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const fieldClass =
  'rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12.5px] text-slate-800 outline-none focus:border-brand-400';

export function CreateBankItemForm({ writableTags, onCreated }: CreateBankItemFormProps) {
  const [prompt, setPrompt] = useState('');
  const [choices, setChoices] = useState<ChoiceDraft[]>([
    { id: 'a', label: '' },
    { id: 'b', label: '' },
  ]);
  const [correctChoiceId, setCorrectChoiceId] = useState('a');
  const [tagIds, setTagIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave =
    prompt.trim() !== '' && choices.every((c) => c.label.trim() !== '') && tagIds.size > 0 && !saving;

  async function handleCreate() {
    setSaving(true);
    setError(null);
    const result = await createBankItemAction({
      prompt: prompt.trim(),
      choices: choices.map((c) => ({ id: c.id, label: c.label.trim() })),
      correctChoiceId,
      tagIds: Array.from(tagIds),
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setPrompt('');
    setChoices([
      { id: 'a', label: '' },
      { id: 'b', label: '' },
    ]);
    setCorrectChoiceId('a');
    setTagIds(new Set());
    onCreated();
  }

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
      <p className="mb-3 text-[13px] font-semibold text-slate-900">Create a bank item</p>
      <div className="flex flex-col gap-2.5">
        <input
          aria-label="Question prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Question prompt"
          className={`${fieldClass} w-full`}
        />

        <div className="flex flex-col gap-2">
          {choices.map((choice, cIndex) => (
            <div key={choice.id} className="flex items-center gap-2">
              <input
                type="radio"
                name="bank-item-correct-choice"
                checked={correctChoiceId === choice.id}
                onChange={() => setCorrectChoiceId(choice.id)}
                aria-label={`Mark choice ${cIndex + 1} as correct`}
              />
              <input
                aria-label={`Choice ${cIndex + 1} text`}
                value={choice.label}
                onChange={(e) =>
                  setChoices((prev) => prev.map((c) => (c.id === choice.id ? { ...c, label: e.target.value } : c)))
                }
                placeholder={`Choice ${cIndex + 1}`}
                className={`${fieldClass} flex-1`}
              />
              <button
                type="button"
                onClick={() =>
                  setChoices((prev) => {
                    const next = prev.filter((c) => c.id !== choice.id);
                    if (correctChoiceId === choice.id) setCorrectChoiceId(next[0]?.id ?? 'a');
                    return next;
                  })
                }
                disabled={choices.length <= 2}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                aria-label="Remove choice"
              >
                <Trash2 size={13} strokeWidth={2.4} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setChoices((prev) => {
                const nextId = CHOICE_IDS[prev.length];
                return nextId ? [...prev, { id: nextId, label: '' }] : prev;
              })
            }
            disabled={choices.length >= CHOICE_IDS.length}
            className="self-start text-[12.5px] font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-40"
          >
            + Add choice
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
          {writableTags.length === 0 && (
            <p className="text-[12px] text-slate-400">You have no tags you can publish to.</p>
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

        <div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!canSave}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-[12px] font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} strokeWidth={2.4} />}
            Create
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}
    </div>
  );
}
