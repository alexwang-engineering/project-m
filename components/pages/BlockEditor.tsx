'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, FileUp, ImageUp, Loader2, Trash2 } from 'lucide-react';

import { beginFileUploadAction, completeFileUploadAction, attachFileToPageAction } from '@/app/actions/files';
import { createClient } from '@/lib/supabase/client';
import { sha256Hex } from '@/lib/files/client-hash';
import { RichTextField } from '@/components/pages/RichTextField';
import type { BlockDraft } from '@/components/pages/block-draft';

interface BlockEditorProps {
  block: BlockDraft;
  pageId: string | null;
  /** An MPX-imported PDF still awaiting upload for this block, if any - see the auto-upload effect below. */
  pendingImportFile?: File;
  onChange: (block: BlockDraft) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

const fieldClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px] text-slate-800 outline-none focus:border-brand-400';

async function uploadFile(
  file: File,
  mediaType: 'application/pdf' | 'application/zip' | 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif',
  pageId: string,
): Promise<{ ok: true; fileId: string } | { ok: false; message: string }> {
  const sha256 = await sha256Hex(file).catch(() => null);
  if (!sha256) return { ok: false, message: 'Could not read this file.' };

  const ticket = await beginFileUploadAction({ filename: file.name, sizeBytes: file.size, sha256, mediaType });
  if (!ticket.ok) return { ok: false, message: ticket.message };

  const { error: uploadError } = await createClient()
    .storage.from(ticket.file.bucket)
    .upload(ticket.file.objectName, file, { contentType: mediaType, upsert: false });
  if (uploadError) return { ok: false, message: uploadError.message };

  const verified = await completeFileUploadAction(ticket.file.id);
  if (!verified.ok) return { ok: false, message: verified.message };

  const attached = await attachFileToPageAction({ pageId, fileId: ticket.file.id });
  if (!attached.ok) return { ok: false, message: attached.message };

  return { ok: true, fileId: ticket.file.id };
}

function BlockShell({
  canMoveUp,
  canMoveDown,
  onMove,
  onRemove,
  children,
}: {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="group relative rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="mb-2 flex items-center justify-end gap-1 opacity-0 transition group-hover:opacity-100">
        <button
          type="button"
          disabled={!canMoveUp}
          onClick={() => onMove(-1)}
          className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-30"
          aria-label="Move up"
        >
          <ArrowUp size={13} strokeWidth={2.4} />
        </button>
        <button
          type="button"
          disabled={!canMoveDown}
          onClick={() => onMove(1)}
          className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-30"
          aria-label="Move down"
        >
          <ArrowDown size={13} strokeWidth={2.4} />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
          aria-label="Remove block"
        >
          <Trash2 size={13} strokeWidth={2.4} />
        </button>
      </div>
      {children}
    </div>
  );
}

export function BlockEditor({
  block,
  pageId,
  pendingImportFile,
  onChange,
  onRemove,
  onMove,
  canMoveUp,
  canMoveDown,
}: BlockEditorProps) {
  const [error, setError] = useState<string | null>(null);

  // Auto-uploads an MPX-imported PDF once the page exists (the same
  // two-phase constraint every file/image block already has). Reads
  // block/onChange through refs, not the dependency array, so this only
  // re-runs when pendingImportFile or pageId actually change - the block
  // object itself gets a new reference on every keystroke elsewhere in the
  // editor, which would otherwise re-trigger this on every render.
  const blockRef = useRef(block);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    blockRef.current = block;
    onChangeRef.current = onChange;
  });
  useEffect(() => {
    if (!pendingImportFile || pageId === null) return;
    const initial = blockRef.current;
    if (initial.type !== 'file' || initial.fileId !== '' || initial.uploading) return;
    let cancelled = false;
    (async () => {
      const startingBlock = blockRef.current;
      if (startingBlock.type !== 'file') return;
      onChangeRef.current({ ...startingBlock, uploading: true });
      const mediaType = pendingImportFile.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/zip';
      const result = await uploadFile(pendingImportFile, mediaType, pageId);
      if (cancelled) return;
      const latest = blockRef.current;
      if (latest.type !== 'file') return;
      if (result.ok) {
        onChangeRef.current({
          ...latest,
          uploading: false,
          fileId: result.fileId,
          label: latest.label || pendingImportFile.name,
        });
      } else {
        setError(result.message);
        onChangeRef.current({ ...latest, uploading: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pendingImportFile, pageId]);

  const shell = (content: React.ReactNode) => (
    <BlockShell canMoveUp={canMoveUp} canMoveDown={canMoveDown} onMove={onMove} onRemove={onRemove}>
      {content}
      {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}
    </BlockShell>
  );

  switch (block.type) {
    case 'paragraph':
      return shell(
        <RichTextField
          fieldKey={block.id}
          html={block.html}
          onChange={(html) => onChange({ ...block, html })}
          placeholder="Write a paragraph..."
        />,
      );

    case 'heading':
      return shell(
        <div className="flex flex-col gap-2">
          <select
            value={block.level}
            onChange={(e) => onChange({ ...block, level: Number(e.target.value) as 2 | 3 | 4 })}
            className={`${fieldClass} w-28`}
          >
            <option value={2}>Heading 2</option>
            <option value={3}>Heading 3</option>
            <option value={4}>Heading 4</option>
          </select>
          <RichTextField
            fieldKey={block.id}
            html={block.html}
            onChange={(html) => onChange({ ...block, html })}
            placeholder="Heading text..."
            toolbar={false}
          />
        </div>,
      );

    case 'list':
      return shell(
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-[12.5px] font-medium text-slate-600">
            <input
              type="checkbox"
              checked={block.ordered}
              onChange={(e) => onChange({ ...block, ordered: e.target.checked })}
            />
            Numbered list
          </label>
          {block.items.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                value={item}
                onChange={(e) => {
                  const items = [...block.items];
                  items[index] = e.target.value;
                  onChange({ ...block, items });
                }}
                placeholder={`Item ${index + 1}`}
                className={fieldClass}
              />
              <button
                type="button"
                onClick={() => onChange({ ...block, items: block.items.filter((_, i) => i !== index) })}
                disabled={block.items.length <= 1}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                aria-label="Remove item"
              >
                <Trash2 size={13} strokeWidth={2.4} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange({ ...block, items: [...block.items, ''] })}
            className="self-start text-[12.5px] font-semibold text-brand-600 hover:text-brand-700"
          >
            + Add item
          </button>
        </div>,
      );

    case 'quote':
      return shell(
        <div className="flex flex-col gap-2">
          <RichTextField
            fieldKey={block.id}
            html={block.html}
            onChange={(html) => onChange({ ...block, html })}
            placeholder="Quote text..."
          />
          <input
            value={block.attribution}
            onChange={(e) => onChange({ ...block, attribution: e.target.value })}
            placeholder="Attribution (optional)"
            className={fieldClass}
          />
        </div>,
      );

    case 'code':
      return shell(
        <div className="flex flex-col gap-2">
          <input
            value={block.language}
            onChange={(e) => onChange({ ...block, language: e.target.value })}
            placeholder="Language (optional, e.g. python)"
            className={`${fieldClass} font-mono`}
          />
          <textarea
            value={block.code}
            onChange={(e) => onChange({ ...block, code: e.target.value })}
            placeholder="Code..."
            rows={6}
            className={`${fieldClass} font-mono`}
          />
        </div>,
      );

    case 'callout':
      return shell(
        <div className="flex flex-col gap-2">
          <select
            value={block.tone}
            onChange={(e) => onChange({ ...block, tone: e.target.value as 'neutral' | 'info' | 'warning' })}
            className={`${fieldClass} w-32`}
          >
            <option value="neutral">Neutral</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
          </select>
          <input
            value={block.title}
            onChange={(e) => onChange({ ...block, title: e.target.value })}
            placeholder="Title (optional)"
            className={fieldClass}
          />
          <RichTextField
            fieldKey={block.id}
            html={block.html}
            onChange={(html) => onChange({ ...block, html })}
            placeholder="Callout text..."
          />
        </div>,
      );

    case 'file':
      return shell(
        pageId === null ? (
          <p className="text-[12.5px] text-slate-400">
            {pendingImportFile
              ? `"${pendingImportFile.name}" will upload once you create this page.`
              : 'Save this page first to attach files.'}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="flex h-10 w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 text-[12.5px] font-medium text-slate-600 hover:border-brand-400 hover:text-brand-700">
              <FileUp size={14} strokeWidth={2} />
              {block.uploading ? 'Uploading...' : block.fileId ? 'Replace file' : 'Choose PDF or MPX'}
              <input
                type="file"
                accept=".pdf,.mpx,application/pdf,application/zip"
                className="hidden"
                disabled={block.uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setError(null);
                  onChange({ ...block, uploading: true });
                  const mediaType = file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/zip';
                  const result = await uploadFile(file, mediaType, pageId);
                  if (result.ok) {
                    onChange({
                      ...block,
                      uploading: false,
                      fileId: result.fileId,
                      label: block.label || file.name,
                    });
                  } else {
                    setError(result.message);
                    onChange({ ...block, uploading: false });
                  }
                }}
              />
            </label>
            <input
              value={block.label}
              onChange={(e) => onChange({ ...block, label: e.target.value })}
              placeholder="Link label"
              className={fieldClass}
            />
          </div>
        ),
      );

    case 'image':
      return shell(
        pageId === null ? (
          <p className="text-[12.5px] text-slate-400">Save this page first to attach images.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {block.previewUrl && (
              /* eslint-disable-next-line @next/next/no-img-element -- local object URL preview, not a static asset */
              <img src={block.previewUrl} alt="" className="max-h-48 rounded-lg border border-slate-200 object-contain" />
            )}
            <label className="flex h-10 w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 text-[12.5px] font-medium text-slate-600 hover:border-brand-400 hover:text-brand-700">
              {block.uploading ? <Loader2 size={14} className="animate-spin" /> : <ImageUp size={14} strokeWidth={2} />}
              {block.uploading ? 'Uploading...' : block.fileId ? 'Replace image' : 'Choose image'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                disabled={block.uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setError(null);
                  const previewUrl = URL.createObjectURL(file);
                  onChange({ ...block, uploading: true, previewUrl });
                  const mediaType = (
                    { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' } as const
                  )[file.name.toLowerCase().split('.').pop() ?? ''];
                  if (!mediaType) {
                    setError('Unsupported image type.');
                    onChange({ ...block, uploading: false, previewUrl });
                    return;
                  }
                  const result = await uploadFile(file, mediaType, pageId);
                  if (result.ok) {
                    onChange({ ...block, uploading: false, fileId: result.fileId, previewUrl });
                  } else {
                    setError(result.message);
                    onChange({ ...block, uploading: false, previewUrl });
                  }
                }}
              />
            </label>
            <input
              value={block.alt}
              onChange={(e) => onChange({ ...block, alt: e.target.value })}
              placeholder="Alt text (required)"
              className={fieldClass}
            />
            <input
              value={block.captionHtml}
              onChange={(e) => onChange({ ...block, captionHtml: e.target.value })}
              placeholder="Caption (optional)"
              className={fieldClass}
            />
          </div>
        ),
      );
  }
}
