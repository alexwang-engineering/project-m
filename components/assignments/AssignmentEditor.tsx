'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import { createAssignmentAction } from '@/app/actions/assignments';
import { SkipToContentLink } from '@/components/ui/SkipToContentLink';
import { SubPageHeader } from '@/components/ui/SubPageHeader';
import type { AttachableInstructionPage } from '@/lib/content/assignments';

interface EditorTag {
  readonly id: string;
  readonly name: string;
  readonly displayName: string;
}

interface AssignmentEditorProps {
  writableTags: readonly EditorTag[];
  instructionPages: readonly AttachableInstructionPage[];
}

function coversTags(
  page: AttachableInstructionPage,
  tagIds: ReadonlySet<string>,
): boolean {
  return (
    page.isPublic || Array.from(tagIds).every((id) => page.tagIds.includes(id))
  );
}

export function AssignmentEditor({
  writableTags,
  instructionPages,
}: AssignmentEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [availableFrom, setAvailableFrom] = useState('');
  const [allowResubmission, setAllowResubmission] = useState(false);
  const [tagIds, setTagIds] = useState<Set<string>>(new Set());
  const [instructionsPageId, setInstructionsPageId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = title.trim() !== '' && tagIds.size > 0 && !saving;
  const selectedInstructionPage = instructionPages.find(
    (page) => page.id === instructionsPageId,
  );

  async function handleCreate() {
    setSaving(true);
    setError(null);
    const result = await createAssignmentAction({
      title: title.trim(),
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      availableFrom: availableFrom
        ? new Date(availableFrom).toISOString()
        : null,
      allowResubmission,
      tagIds: Array.from(tagIds),
      instructionsPageId: instructionsPageId || null,
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
            {error && (
              <p className="max-w-[280px] truncate text-[12px] text-red-600">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={handleCreate}
              disabled={!canSave}
              className="bg-brand-600 hover:bg-brand-700 flex h-9 items-center gap-1.5 rounded-lg px-4 text-[12.5px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              Save draft
            </button>
          </>
        }
      />

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-[760px] px-8 pt-9 pb-32"
      >
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <input
            aria-label="Assignment title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Assignment title"
            className="w-full border-none text-[22px] font-semibold tracking-tight text-slate-950 outline-none placeholder:text-slate-300"
          />
          <div className="flex items-center gap-2">
            <label
              htmlFor="assignment-available-from"
              className="text-[12.5px] font-medium text-slate-500"
            >
              Available (optional)
            </label>
            <input
              id="assignment-available-from"
              type="datetime-local"
              value={availableFrom}
              onChange={(e) => setAvailableFrom(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1 text-[12.5px] text-slate-700"
            />
          </div>
          <div className="flex items-center gap-2">
            <label
              htmlFor="assignment-due-at"
              className="text-[12.5px] font-medium text-slate-500"
            >
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
          <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-3">
            <label
              htmlFor="assignment-instructions"
              className="text-[12.5px] font-medium text-slate-600"
            >
              Instructions page (optional)
            </label>
            <div className="flex items-center gap-2">
              <select
                id="assignment-instructions"
                value={instructionsPageId}
                onChange={(event) => setInstructionsPageId(event.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-2 text-[12.5px] text-slate-700"
              >
                <option value="">No instructions page</option>
                {instructionPages
                  .filter((page) => coversTags(page, tagIds))
                  .map((page) => (
                    <option key={page.id} value={page.id}>
                      {page.title} — {page.canonicalUrl}
                    </option>
                  ))}
              </select>
              {selectedInstructionPage && (
                <a
                  href={selectedInstructionPage.canonicalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:border-brand-500 hover:text-brand-600 rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-600 transition"
                >
                  Preview
                </a>
              )}
            </div>
            <p className="text-[11.5px] text-slate-400">
              Only published pages available to every selected tag are shown.
            </p>
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
                      const selectedPage = instructionPages.find(
                        (page) => page.id === instructionsPageId,
                      );
                      if (selectedPage && !coversTags(selectedPage, next)) {
                        setInstructionsPageId('');
                      }
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
