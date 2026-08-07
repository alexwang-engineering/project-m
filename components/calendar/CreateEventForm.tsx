'use client';

import { useState } from 'react';
import { Loader2, Plus } from 'lucide-react';

import { createCalendarEventAction } from '@/app/actions/calendar';

interface EditorTag {
  readonly id: string;
  readonly name: string;
}

interface CreateEventFormProps {
  readonly writableTags: readonly EditorTag[];
  readonly isAdmin: boolean;
}

const fieldClass =
  'rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12.5px] text-slate-800 outline-none focus:border-brand-400';

export function CreateEventForm({ writableTags, isAdmin }: CreateEventFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [broadcast, setBroadcast] = useState(false);
  const [tagIds, setTagIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const canSave = title.trim() !== '' && startsAt !== '' && (broadcast || tagIds.size > 0) && !saving;

  async function handleCreate() {
    setSaving(true);
    setError(null);
    setMessage(null);
    const result = await createCalendarEventAction({
      title: title.trim(),
      description: description.trim() || undefined,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: endsAt ? new Date(endsAt).toISOString() : null,
      broadcast,
      tagIds: broadcast ? [] : Array.from(tagIds),
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMessage(`Created "${title.trim()}".`);
    setTitle('');
    setDescription('');
    setStartsAt('');
    setEndsAt('');
    setBroadcast(false);
    setTagIds(new Set());
  }

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
      <p className="mb-3 text-[13px] font-semibold text-slate-900">Create an event</p>
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Event title"
            className={`${fieldClass} flex-1 min-w-[180px]`}
          />
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className={fieldClass}
          />
          <span className="text-[12px] text-slate-400">to</span>
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className={fieldClass}
          />
        </div>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className={`${fieldClass} w-full`}
        />

        {isAdmin && (
          <label className="flex items-center gap-2 text-[12.5px] font-medium text-slate-600">
            <input
              type="checkbox"
              checked={broadcast}
              onChange={(e) => {
                setBroadcast(e.target.checked);
                if (e.target.checked) setTagIds(new Set());
              }}
            />
            Whole-school event (visible to everyone)
          </label>
        )}

        {!broadcast && (
          <div className="flex flex-wrap gap-1.5">
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
        )}

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
      {message && <p className="mt-2 text-[12px] text-emerald-700">{message}</p>}
    </div>
  );
}
