/**
 * Glue between the page editor and lib/mpx-packager.ts. MPX v1 supports PDF
 * attachments only (ADR-007) - a page with an image block cannot round-trip
 * through this format, so export rejects that case outright rather than
 * silently dropping content.
 */
import {
  downloadMpx,
  packageMpx,
  unpackMpx,
  MpxFormatError,
  type JsonValue,
} from '@/lib/mpx-packager';
import {
  newBlock,
  serializeBlock,
  isBlockReady,
  type BlockDraft,
} from '@/components/pages/block-draft';

interface MpxPageContent {
  readonly title: string;
  readonly content: {
    readonly schemaVersion: 1;
    readonly blocks: readonly Record<string, unknown>[];
  };
}

export interface MpxExportInput {
  readonly title: string;
  readonly blocks: readonly BlockDraft[];
  readonly resolveFile: (
    fileId: string,
  ) => Promise<
    | { readonly ok: true; readonly file: File }
    | { readonly ok: false; readonly message: string }
  >;
}

export type MpxExportResult =
  { readonly ok: true } | { readonly ok: false; readonly message: string };

/** Packages a page's ready blocks and their PDF attachments into a downloadable .mpx archive. */
export async function exportPageAsMpx({
  title,
  blocks,
  resolveFile,
}: MpxExportInput): Promise<MpxExportResult> {
  const ready = blocks.filter(isBlockReady);
  if (ready.some((block) => block.type === 'image')) {
    return {
      ok: false,
      message:
        'MPX export only supports PDF attachments today - remove any image blocks first.',
    };
  }

  const attachments: File[] = [];
  for (const block of ready) {
    if (block.type !== 'file') continue;
    const resolved = await resolveFile(block.fileId);
    if (!resolved.ok) return { ok: false, message: resolved.message };
    if (resolved.file.type !== 'application/pdf') {
      return {
        ok: false,
        message: `"${block.label || 'A file block'}" is not a PDF - MPX export only supports PDF attachments.`,
      };
    }
    // Prefixed with the block id so import can match each attachment back
    // to the block it belongs to without depending on this environment's
    // (soon meaningless, on the importing side) database file id.
    attachments.push(
      new File([resolved.file], `${block.id}--${resolved.file.name}`, {
        type: resolved.file.type,
      }),
    );
  }

  const page: MpxPageContent = {
    title,
    content: { schemaVersion: 1, blocks: ready.map(serializeBlock) },
  };

  try {
    const blob = await packageMpx(page as unknown as JsonValue, attachments);
    downloadMpx(blob, title);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof MpxFormatError
          ? error.message
          : 'Could not package this page as MPX.',
    };
  }
}

export interface MpxImportResult {
  readonly ok: true;
  readonly title: string;
  readonly blocks: readonly BlockDraft[];
  /** Keyed by block id - each file still needs to be uploaded and attached once the page exists. */
  readonly pendingFiles: ReadonlyMap<string, File>;
}
export type MpxImportOutcome =
  MpxImportResult | { readonly ok: false; readonly message: string };

/** Unpacks an .mpx archive into editor-ready state: a title, blocks, and any PDF attachments awaiting upload. */
export async function importMpxFile(file: File): Promise<MpxImportOutcome> {
  let unpacked;
  try {
    unpacked = await unpackMpx(file);
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof MpxFormatError
          ? error.message
          : 'Could not read this MPX file.',
    };
  }

  const page = unpacked.page;
  if (page === null || typeof page !== 'object' || Array.isArray(page)) {
    return {
      ok: false,
      message: 'This MPX file does not contain a recognizable page.',
    };
  }
  const fields = page as unknown as Record<string, unknown>;
  const rawContent = fields.content as { blocks?: unknown } | undefined;
  if (
    typeof fields.title !== 'string' ||
    typeof rawContent !== 'object' ||
    rawContent === null
  ) {
    return {
      ok: false,
      message: 'This MPX file does not contain a recognizable page.',
    };
  }
  const title = fields.title;
  const rawBlocks = Array.isArray(rawContent.blocks) ? rawContent.blocks : [];

  const filesByName = new Map(
    unpacked.attachments.map((attachment) => [attachment.name, attachment]),
  );
  const blocks: BlockDraft[] = [];
  const pendingFiles = new Map<string, File>();

  for (const raw of rawBlocks) {
    const block = parseImportedBlock(raw);
    if (!block) continue;
    if (block.type === 'file') {
      const match = [...filesByName.entries()].find(([name]) =>
        name.startsWith(`${block.id}--`),
      );
      if (match) {
        const [name, attachedFile] = match;
        pendingFiles.set(
          block.id,
          new File([attachedFile], name.slice(block.id.length + 2), {
            type: attachedFile.type,
          }),
        );
      }
    }
    blocks.push(block);
  }

  return { ok: true, title, blocks, pendingFiles };
}

function parseImportedBlock(raw: unknown): BlockDraft | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw))
    return null;
  const value = raw as Record<string, unknown>;
  const id =
    typeof value.id === 'string' && value.id.trim()
      ? value.id
      : newBlock('paragraph').id;
  switch (value.type) {
    case 'paragraph':
      return {
        id,
        type: 'paragraph',
        html: typeof value.html === 'string' ? value.html : '',
      };
    case 'heading':
      return {
        id,
        type: 'heading',
        level: value.level === 3 || value.level === 4 ? value.level : 2,
        html: typeof value.html === 'string' ? value.html : '',
      };
    case 'list':
      return {
        id,
        type: 'list',
        ordered: value.ordered === true,
        items: Array.isArray(value.items)
          ? value.items.filter(
              (item): item is string => typeof item === 'string',
            )
          : [],
      };
    case 'quote':
      return {
        id,
        type: 'quote',
        html: typeof value.html === 'string' ? value.html : '',
        attribution:
          typeof value.attribution === 'string' ? value.attribution : '',
      };
    case 'code':
      return {
        id,
        type: 'code',
        code: typeof value.code === 'string' ? value.code : '',
        language: typeof value.language === 'string' ? value.language : '',
      };
    case 'callout':
      return {
        id,
        type: 'callout',
        tone:
          value.tone === 'info' || value.tone === 'warning'
            ? value.tone
            : 'neutral',
        title: typeof value.title === 'string' ? value.title : '',
        html: typeof value.html === 'string' ? value.html : '',
      };
    case 'file':
      return {
        id,
        type: 'file',
        fileId: '',
        label: typeof value.label === 'string' ? value.label : '',
        uploading: false,
      };
    default:
      // Unrecognized, or an image block - images aren't part of the MPX
      // format at all, so there's nothing to import; skip rather than
      // fabricate a broken block.
      return null;
  }
}
