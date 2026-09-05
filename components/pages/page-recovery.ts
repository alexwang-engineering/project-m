import type { BlockDraft } from '@/components/pages/block-draft';

const PREFIX = 'project-m:page-recovery:';
const MAX_BYTES = 500_000;

export interface PageRecovery {
  readonly pageId: string | null;
  readonly baseVersion: number | null;
  readonly savedAt: string;
  readonly title: string;
  readonly slug: string;
  readonly tagIds: readonly string[];
  readonly blocks: readonly BlockDraft[];
}

export function recoveryPrefix(pageId: string | null): string {
  return `${PREFIX}${pageId ?? 'new'}:`;
}

export function recoveryKey(
  pageId: string | null,
  baseVersion: number | null,
): string {
  return `${recoveryPrefix(pageId)}${baseVersion ?? 'new'}`;
}

function validBlock(block: unknown): block is BlockDraft {
  if (!block || typeof block !== 'object' || Array.isArray(block)) return false;
  const value = block as Record<string, unknown>;
  if (typeof value.id !== 'string' || value.id.length > 100) return false;
  switch (value.type) {
    case 'paragraph':
      return typeof value.html === 'string';
    case 'heading':
      return (
        typeof value.html === 'string' &&
        (value.level === 2 || value.level === 3 || value.level === 4)
      );
    case 'list':
      return (
        typeof value.ordered === 'boolean' &&
        Array.isArray(value.items) &&
        value.items.length <= 100 &&
        value.items.every((item) => typeof item === 'string')
      );
    case 'quote':
      return (
        typeof value.html === 'string' && typeof value.attribution === 'string'
      );
    case 'code':
      return (
        typeof value.code === 'string' && typeof value.language === 'string'
      );
    case 'callout':
      return (
        typeof value.html === 'string' &&
        typeof value.title === 'string' &&
        ['neutral', 'info', 'warning'].includes(String(value.tone))
      );
    case 'file':
      return (
        typeof value.fileId === 'string' && typeof value.label === 'string'
      );
    case 'image':
      return (
        typeof value.fileId === 'string' &&
        typeof value.alt === 'string' &&
        typeof value.captionHtml === 'string'
      );
    case 'table':
      return (
        typeof value.caption === 'string' &&
        Array.isArray(value.headers) &&
        value.headers.length >= 1 &&
        value.headers.length <= 12 &&
        value.headers.every((cell) => typeof cell === 'string') &&
        Array.isArray(value.rows) &&
        value.rows.length >= 1 &&
        value.rows.length <= 100 &&
        value.rows.every(
          (row) =>
            Array.isArray(row) &&
            row.length === (value.headers as unknown[]).length &&
            row.every((cell) => typeof cell === 'string'),
        )
      );
    default:
      return false;
  }
}

/** Parses only bounded editor state written by this app; malformed local data is ignored. */
export function parsePageRecovery(raw: string): PageRecovery | null {
  if (raw.length > MAX_BYTES) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (
      (value.pageId !== null && typeof value.pageId !== 'string') ||
      (value.baseVersion !== null &&
        (!Number.isSafeInteger(value.baseVersion) ||
          Number(value.baseVersion) < 1)) ||
      typeof value.savedAt !== 'string' ||
      !Number.isFinite(Date.parse(value.savedAt)) ||
      typeof value.title !== 'string' ||
      value.title.length > 1_000 ||
      typeof value.slug !== 'string' ||
      value.slug.length > 200 ||
      !Array.isArray(value.tagIds) ||
      value.tagIds.length > 100 ||
      !value.tagIds.every((id) => typeof id === 'string') ||
      !Array.isArray(value.blocks) ||
      value.blocks.length > 200 ||
      !value.blocks.every(validBlock)
    )
      return null;
    return value as unknown as PageRecovery;
  } catch {
    return null;
  }
}

/** Removes transient upload state and refuses drafts beyond the storage budget. */
export function serializePageRecovery(
  recovery: Omit<PageRecovery, 'savedAt'>,
): string | null {
  const value: PageRecovery = {
    ...recovery,
    savedAt: new Date().toISOString(),
    blocks: recovery.blocks.map((block) =>
      block.type === 'image'
        ? { ...block, previewUrl: '', uploading: false }
        : block.type === 'file'
          ? { ...block, uploading: false }
          : block,
    ),
  };
  const serialized = JSON.stringify(value);
  return serialized.length <= MAX_BYTES ? serialized : null;
}

export function clearPageRecoveries(pageId: string | null): void {
  try {
    const prefix = recoveryPrefix(pageId);
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(prefix)) localStorage.removeItem(key);
    }
  } catch {
    // Storage can be unavailable in hardened browser modes; server saves remain authoritative.
  }
}

export function clearAllPageRecoveries(): void {
  try {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // Storage can be unavailable in hardened browser modes.
  }
}
