'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import { createAssignmentAction } from '@/app/actions/assignments';
import { SkipToContentLink } from '@/components/ui/SkipToContentLink';
import { SubPageHeader } from '@/components/ui/SubPageHeader';

interface EditorTag {
  readonly id: string;
  readonly name: string;
  readonly displayName: string;
}

interface AssignmentEditorProps {
  writableTags: readonly EditorTag[];
}

export function AssignmentEditor({ writableTags }: AssignmentEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [allowResubmission, setAllowResubmission] = useState(false);
  const [tagIds, setTagIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = title.trim() !== '' && tagIds.size > 0 && !saving;

  async function handleCreate() {
    setSaving(true);
    setError(null);
    const result = await createAssignmentAction({
      title: title.trim(),
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      allowResubmission,
      tagIds: Array.from(tagIds),
    });
    if (!result.ok) {
      setError(result.message);
      setSaving(false);
      return;
    }
    router.push(`/assignments/${result.assignment.id}`);
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <SkipToContentLink />
      <SubPageHeader
        backHref="/assignments"
        backLabel="Assignments"
        title="New assignment"
        actions={
          <>
            {error && <p className="max-w-[280px] truncate text-[12px] text-red-600">{error}</p>}
            <button
              type="button"
              onClick={handleCreate}
              disabled={!canSave}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-[12.5px] font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              Create assignment
            </button>
          </>
        }
      />

      <main id="main-content" className="mx-auto max-w-[760px] px-8 pb-32 pt-9">
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <input
            aria-label="Assignment title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Assignment title"
            className="w-full border-none text-[22px] font-semibold tracking-tight text-slate-950 outline-none placeholder:text-slate-300"
          />
          <div className="flex items-center gap-2">
            <label htmlFor="assignment-due-at" className="text-[12.5px] font-medium text-slate-500">
              Due (optional)
            </label>
            <input
              id="assignment-due-at"
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1 text-[12.5px] text-slate-700"
            />
          </div>
          <label className="flex items-center gap-2 text-[12.5px] font-medium text-slate-600">
            <input
              type="checkbox"
              checked={allowResubmission}
              onChange={(e) => setAllowResubmission(e.target.checked)}
            />
            Allow resubmission
          </label>
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
      </main>
    </div>
  );
}
