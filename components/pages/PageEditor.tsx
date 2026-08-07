'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronDown, Download, Loader2, Plus, Upload } from 'lucide-react';

import { createPageAction, updatePageAction, setPageLifecycleAction } from '@/app/actions/pages';
import { createFileDownloadAction } from '@/app/actions/files';
import { BlockEditor } from '@/components/pages/BlockEditor';
import { BLOCK_LABEL, isBlockReady, newBlock, serializeBlock, type BlockDraft } from '@/components/pages/block-draft';
import { exportPageAsMpx, importMpxFile } from '@/components/pages/mpx-transfer';

export interface EditorTag {
  readonly id: string;
  readonly name: string;
  readonly displayName: string;
}

export interface PageEditorProps {
  writableTags: readonly EditorTag[];
  initial: {
    id: string | null;
    title: string;
    slug: string;
    version: number | null;
    lifecycle: 'draft' | 'published' | 'archived';
    tagIds: readonly string[];
    blocks: readonly BlockDraft[];
  };
}

function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || 'page';
}

const BLOCK_TYPES = Object.keys(BLOCK_LABEL) as BlockDraft['type'][];

export function PageEditor({ writableTags, initial }: PageEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [slug, setSlug] = useState(initial.slug);
  const [slugTouched, setSlugTouched] = useState(initial.id !== null);
  const [tagIds, setTagIds] = useState<Set<string>>(new Set(initial.tagIds));
  const [blocks, setBlocks] = useState<BlockDraft[]>([...initial.blocks]);
  const [pageId, setPageId] = useState(initial.id);
  const [version, setVersion] = useState(initial.version);
  const [lifecycle, setLifecycle] = useState(initial.lifecycle);
  const [makePublic, setMakePublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [pendingImportFiles, setPendingImportFiles] = useState<Map<string, File>>(new Map());
  const [mpxBusy, setMpxBusy] = useState(false);
  const [mpxError, setMpxError] = useState<string | null>(null);

  const canSave = title.trim() !== '' && slug.trim() !== '' && tagIds.size > 0 && !saving;

  function updateBlock(index: number, block: BlockDraft) {
    setBlocks((prev) => prev.map((b, i) => (i === index ? block : b)));
  }

  function removeBlock(index: number) {
    setBlocks((prev) => prev.filter((_, i) => i !== index));
  }

  function moveBlock(index: number, direction: -1 | 1) {
    setBlocks((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const moved = next[index];
      const displaced = next[target];
      if (!moved || !displaced) return prev;
      next[index] = displaced;
      next[target] = moved;
      return next;
    });
  }

  async function resolveBlockFile(
    fileId: string,
  ): Promise<{ ok: true; file: File } | { ok: false; message: string }> {
    const download = await createFileDownloadAction(fileId);
    if (!download.ok) return { ok: false, message: download.message };
    const response = await fetch(download.download.url);
    if (!response.ok) return { ok: false, message: 'Could not download this file for export.' };
    const bytes = await response.arrayBuffer();
    return {
      ok: true,
      file: new File([bytes], download.download.filename, { type: download.download.mediaType }),
    };
  }

  async function handleExport() {
    setMpxBusy(true);
    setMpxError(null);
    const result = await exportPageAsMpx({ title, blocks, resolveFile: resolveBlockFile });
    setMpxBusy(false);
    if (!result.ok) setMpxError(result.message);
  }

  async function handleImportFile(file: File) {
    setMpxBusy(true);
    setMpxError(null);
    const result = await importMpxFile(file);
    setMpxBusy(false);
    if (!result.ok) {
      setMpxError(result.message);
      return;
    }
    setTitle(result.title);
    if (!slugTouched) setSlug(slugify(result.title));
    setBlocks([...result.blocks]);
    setPendingImportFiles(new Map(result.pendingFiles));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    // Blocks still mid-upload (e.g. an image with no file chosen yet) have
    // nothing valid to persist - the server would reject an empty fileId
    // outright, and silently blocking that would make the two-phase
    // create-then-attach flow impossible to get out of.
    const content = { schemaVersion: 1 as const, blocks: blocks.filter(isBlockReady).map(serializeBlock) };
    const input = { title: title.trim(), slug, parentId: null, tagIds: Array.from(tagIds), content };

    if (pageId === null) {
      const result = await createPageAction(input);
      if (!result.ok) {
        setError({ code: result.code, message: result.message });
        setSaving(false);
        return;
      }
      setPageId(result.page.id);
      setVersion(result.page.version);
      router.replace(`/pages/${result.page.id}/edit`);
    } else {
      const result = await updatePageAction({ pageId, expectedVersion: version, ...input });
      if (!result.ok) {
        setError({ code: result.code, message: result.message });
        setSaving(false);
        return;
      }
      setVersion(result.page.version);
    }
    setSaving(false);
  }

  async function handlePublishToggle() {
    if (pageId === null || version === null) return;
    setSaving(true);
    setError(null);
    const nextState = lifecycle === 'published' ? 'draft' : 'published';
    const result = await setPageLifecycleAction({
      pageId,
      expectedVersion: version,
      nextState,
      makePublic: nextState === 'published' && makePublic,
    });
    if (!result.ok) {
      setError({ code: result.code, message: result.message });
      setSaving(false);
      return;
    }
    setVersion(result.page.version);
    setLifecycle(nextState);
    setSaving(false);
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <header className="sticky top-0 z-40 flex h-[68px] items-center justify-between gap-4 border-b border-slate-200 bg-white/85 px-8 backdrop-blur">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 hover:text-slate-900">
            <ArrowLeft size={15} strokeWidth={2.4} />
            Dashboard
          </Link>
          <span className="text-[15.5px] font-semibold tracking-tight text-slate-900">
            {pageId === null ? 'New page' : 'Edit page'}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
            {lifecycle}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {error &&
            (error.code === 'conflict' ? (
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-1.5 text-[12px] text-amber-800">
                <span>Someone else changed this page since you started editing.</span>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="font-semibold underline underline-offset-2 hover:text-amber-900"
                >
                  Reload latest version
                </button>
              </div>
            ) : (
              <p className="max-w-[280px] truncate text-[12px] text-red-600">{error.message}</p>
            ))}
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-[12.5px] font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            {pageId === null ? 'Create draft' : 'Save'}
          </button>
          {pageId !== null && lifecycle !== 'published' && (
            <label className="flex items-center gap-1.5 text-[12px] text-slate-500">
              <input type="checkbox" checked={makePublic} onChange={(e) => setMakePublic(e.target.checked)} />
              Public (visible to everyone, not just your tags)
            </label>
          )}
          {pageId !== null && (
            <button
              type="button"
              onClick={handlePublishToggle}
              disabled={saving}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-4 text-[12.5px] font-semibold text-slate-700 transition hover:border-brand-400 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {lifecycle === 'published' ? 'Unpublish' : 'Publish'}
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[760px] px-8 pb-32 pt-9">
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <input
            aria-label="Page title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            placeholder="Page title"
            className="w-full border-none text-[22px] font-semibold tracking-tight text-slate-950 outline-none placeholder:text-slate-300"
          />
          <div className="flex items-center gap-2 text-[12.5px] text-slate-500">
            <span>/</span>
            <input
              aria-label="Page URL slug"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              className="flex-1 rounded border-none bg-slate-50 px-2 py-1 font-mono outline-none focus:bg-slate-100"
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

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {pageId !== null && (
            <button
              type="button"
              onClick={handleExport}
              disabled={mpxBusy}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[12px] font-semibold text-slate-600 hover:border-brand-400 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {mpxBusy ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} strokeWidth={2.4} />}
              Export MPX
            </button>
          )}
          {pageId === null && (
            <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 text-[12px] font-semibold text-slate-600 hover:border-brand-400 hover:text-brand-700">
              {mpxBusy ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} strokeWidth={2.4} />}
              Import MPX
              <input
                type="file"
                accept=".mpx"
                className="hidden"
                disabled={mpxBusy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImportFile(file);
                  e.target.value = '';
                }}
              />
            </label>
          )}
          {mpxError && <p className="text-[12px] text-red-600">{mpxError}</p>}
        </div>

        <div className="flex flex-col gap-3">
          {blocks.map((block, index) => (
            <BlockEditor
              key={block.id}
              block={block}
              pageId={pageId}
              pendingImportFile={pendingImportFiles.get(block.id)}
              onChange={(updated) => updateBlock(index, updated)}
              onRemove={() => removeBlock(index)}
              onMove={(direction) => moveBlock(index, direction)}
              canMoveUp={index > 0}
              canMoveDown={index < blocks.length - 1}
            />
          ))}
        </div>

        <div className="relative mt-4">
          <button
            type="button"
            onClick={() => setAddMenuOpen((v) => !v)}
            className="flex h-10 items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 text-[12.5px] font-semibold text-slate-500 hover:border-brand-400 hover:text-brand-700"
          >
            <Plus size={14} strokeWidth={2.4} />
            Add block
            <ChevronDown size={13} strokeWidth={2.4} />
          </button>
          {addMenuOpen && (
            <div className="absolute left-0 top-11 z-10 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
              {BLOCK_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setBlocks((prev) => [...prev, newBlock(type)]);
                    setAddMenuOpen(false);
                  }}
                  className="block w-full px-3.5 py-2.5 text-left text-[13px] text-slate-700 hover:bg-slate-50"
                >
                  {BLOCK_LABEL[type]}
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
