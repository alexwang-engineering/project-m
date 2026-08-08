import Link from 'next/link';
import { Download, FileText, ImageOff, Pencil } from 'lucide-react';

import type { EditorBlock, EditorDocumentV1 } from '@/lib/content/schema';

interface RenderablePage {
  readonly id: string;
  readonly title: string;
  readonly content: EditorDocumentV1;
}

export interface BlockFileInfo {
  readonly url: string;
  readonly filename: string;
  readonly mediaType: string;
  readonly sizeBytes: number;
}

interface PageRendererProps {
  readonly page: RenderablePage;
  /** Pre-fetched short-lived signed URLs, keyed by fileId, for file/image blocks. */
  readonly files: Readonly<Record<string, BlockFileInfo>>;
  /** Shown when the current principal manages every audience tag on this page. */
  readonly editHref?: string;
}

const CALLOUT_TONE = {
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
} as const;

const HEADING_SIZE = {
  2: 'text-2xl',
  3: 'text-xl',
  4: 'text-lg',
} as const;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Block({
  block,
  files,
}: {
  block: EditorBlock;
  files: Readonly<Record<string, BlockFileInfo>>;
}) {
  switch (block.type) {
    case 'paragraph':
      return (
        <p
          className="text-[15px] leading-relaxed text-slate-700"
          dangerouslySetInnerHTML={{ __html: block.html }}
        />
      );
    case 'heading': {
      const Tag = `h${block.level}` as 'h2' | 'h3' | 'h4';
      return (
        <Tag
          className={`${HEADING_SIZE[block.level]} font-semibold tracking-tight text-slate-950`}
          dangerouslySetInnerHTML={{ __html: block.html }}
        />
      );
    }
    case 'list': {
      const ListTag = block.ordered ? 'ol' : 'ul';
      return (
        <ListTag
          className={`ml-5 space-y-1 text-[15px] leading-relaxed text-slate-700 ${block.ordered ? 'list-decimal' : 'list-disc'}`}
        >
          {block.items.map((item, index) => (
            <li key={index} dangerouslySetInnerHTML={{ __html: item }} />
          ))}
        </ListTag>
      );
    }
    case 'quote':
      return (
        <blockquote className="border-brand-500 border-l-2 pl-4 text-[15px] leading-relaxed text-slate-600 italic">
          <div dangerouslySetInnerHTML={{ __html: block.html }} />
          {block.attribution && (
            <cite className="mt-1 block text-[12.5px] text-slate-400 not-italic">
              — {block.attribution}
            </cite>
          )}
        </blockquote>
      );
    case 'code':
      return (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
          {block.language && (
            <div className="border-b border-slate-800 px-4 py-1.5 text-[10.5px] font-semibold tracking-wide text-slate-400 uppercase">
              {block.language}
            </div>
          )}
          <pre className="overflow-auto p-4 text-[13px] leading-relaxed text-slate-100">
            <code>{block.code}</code>
          </pre>
        </div>
      );
    case 'callout':
      return (
        <div className={`rounded-xl border p-4 ${CALLOUT_TONE[block.tone]}`}>
          {block.title && (
            <p className="mb-1 text-[13px] font-semibold">{block.title}</p>
          )}
          <div
            className="text-[14px] leading-relaxed"
            dangerouslySetInnerHTML={{ __html: block.html }}
          />
        </div>
      );
    case 'file': {
      const file = files[block.fileId];
      if (!file) {
        return (
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-[13px] text-slate-400">
            <FileText size={16} strokeWidth={2} />
            {block.label} (unavailable)
          </div>
        );
      }
      return (
        <a
          href={file.url}
          download={file.filename}
          className="hover:border-brand-400 hover:text-brand-700 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13.5px] font-medium text-slate-800 shadow-sm transition"
        >
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#eef2fa] text-[#254889]">
            <FileText size={16} strokeWidth={2} />
          </span>
          <span className="flex flex-1 flex-col">
            <span>{block.label}</span>
            <span className="text-[11px] font-normal text-slate-400">
              {formatBytes(file.sizeBytes)}
            </span>
          </span>
          <Download size={15} strokeWidth={2} className="text-slate-400" />
        </a>
      );
    }
    case 'image': {
      const file = files[block.fileId];
      if (!file) {
        return (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-10 text-[13px] text-slate-400">
            <ImageOff size={20} strokeWidth={2} />
            Image unavailable
          </div>
        );
      }
      return (
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed Supabase Storage URL, not a static asset */}
          <img
            src={file.url}
            alt={block.alt}
            className="w-full rounded-xl border border-slate-200 object-cover"
          />
          {block.captionHtml && (
            <figcaption
              className="mt-2 text-center text-[12.5px] text-slate-400"
              dangerouslySetInnerHTML={{ __html: block.captionHtml }}
            />
          )}
        </figure>
      );
    }
  }
}

/** Renders a versioned block-editor document (lib/content/schema.ts). */
export function PageRenderer({ page, files, editHref }: PageRendererProps) {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-12">
      <article className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 flex items-start justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            {page.title}
          </h1>
          {editHref && (
            <Link
              href={editHref}
              className="hover:border-brand-400 hover:text-brand-700 flex h-9 flex-shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[12.5px] font-semibold text-slate-600 transition"
            >
              <Pencil size={14} strokeWidth={2.2} />
              Edit
            </Link>
          )}
        </div>
        <div className="flex flex-col gap-5">
          {page.content.blocks.length === 0 ? (
            <p className="text-[14px] text-slate-400">
              This page has no content yet.
            </p>
          ) : (
            page.content.blocks.map((block) => (
              <Block key={block.id} block={block} files={files} />
            ))
          )}
        </div>
      </article>
    </main>
  );
}
