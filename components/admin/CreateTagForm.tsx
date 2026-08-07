'use client';

import { useState } from 'react';
import { Loader2, Plus } from 'lucide-react';

import { createTagAction } from '@/app/actions/admin';

const fieldClass =
  'rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12.5px] text-slate-800 outline-none focus:border-brand-400';

export function CreateTagForm() {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleCreate() {
    setSaving(true);
    setError(null);
    setMessage(null);
    const result = await createTagAction({ name, displayName, reason: reason.trim() || undefined });
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMessage(`Created ${result.tag.name}.`);
    setName('');
    setDisplayName('');
    setReason('');
  }

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
      <p className="mb-3 text-[13px] font-semibold text-slate-900">Create a tag</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Y9MA1"
          className={`${fieldClass} w-28 font-mono uppercase`}
        />
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Year 9 Maths Set 1"
          className={`${fieldClass} flex-1 min-w-[160px]`}
        />
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (optional)"
          className={`${fieldClass} flex-1 min-w-[140px]`}
        />
        <button
          type="button"
          onClick={handleCreate}
          disabled={saving || !name.trim() || !displayName.trim()}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-[12px] font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} strokeWidth={2.4} />}
          Create
        </button>
      </div>
      {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}
      {message && <p className="mt-2 text-[12px] text-emerald-700">{message}</p>}
    </div>
  );
}
