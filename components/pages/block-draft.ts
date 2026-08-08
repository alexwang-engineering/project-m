/** Client-side mirror of lib/content/schema.ts's EditorBlock union - kept separate since that module is server-only. */

export interface ParagraphDraft {
  id: string;
  type: 'paragraph';
  html: string;
}
export interface HeadingDraft {
  id: string;
  type: 'heading';
  level: 2 | 3 | 4;
  html: string;
}
export interface ListDraft {
  id: string;
  type: 'list';
  ordered: boolean;
  items: string[];
}
export interface QuoteDraft {
  id: string;
  type: 'quote';
  html: string;
  attribution: string;
}
export interface CodeDraft {
  id: string;
  type: 'code';
  code: string;
  language: string;
}
export interface CalloutDraft {
  id: string;
  type: 'callout';
  tone: 'neutral' | 'info' | 'warning';
  title: string;
  html: string;
}
export interface FileDraft {
  id: string;
  type: 'file';
  fileId: string;
  label: string;
  uploading: boolean;
}
export interface ImageDraft {
  id: string;
  type: 'image';
  fileId: string;
  alt: string;
  captionHtml: string;
  previewUrl: string;
  uploading: boolean;
}

export type BlockDraft =
  | ParagraphDraft
  | HeadingDraft
  | ListDraft
  | QuoteDraft
  | CodeDraft
  | CalloutDraft
  | FileDraft
  | ImageDraft;

export const BLOCK_LABEL: Record<BlockDraft['type'], string> = {
  paragraph: 'Paragraph',
  heading: 'Heading',
  list: 'List',
  quote: 'Quote',
  code: 'Code',
  callout: 'Callout',
  file: 'File (PDF/MPX)',
  image: 'Image',
};

function newId(): string {
  return `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function newBlock(type: BlockDraft['type']): BlockDraft {
  const id = newId();
  switch (type) {
    case 'paragraph':
      return { id, type, html: '' };
    case 'heading':
      return { id, type, level: 2, html: '' };
    case 'list':
      return { id, type, ordered: false, items: [''] };
    case 'quote':
      return { id, type, html: '', attribution: '' };
    case 'code':
      return { id, type, code: '', language: '' };
    case 'callout':
      return { id, type, tone: 'neutral', title: '', html: '' };
    case 'file':
      return { id, type, fileId: '', label: '', uploading: false };
    case 'image':
      return {
        id,
        type,
        fileId: '',
        alt: '',
        captionHtml: '',
        previewUrl: '',
        uploading: false,
      };
  }
}

/** Converts a draft to the wire shape lib/content/schema.ts's parseEditorDocument expects. */
export function serializeBlock(block: BlockDraft): Record<string, unknown> {
  switch (block.type) {
    case 'paragraph':
      return { id: block.id, type: block.type, html: block.html };
    case 'heading':
      return {
        id: block.id,
        type: block.type,
        level: block.level,
        html: block.html,
      };
    case 'list':
      return {
        id: block.id,
        type: block.type,
        ordered: block.ordered,
        items: block.items.filter((item) => item.trim() !== ''),
      };
    case 'quote':
      return {
        id: block.id,
        type: block.type,
        html: block.html,
        ...(block.attribution.trim()
          ? { attribution: block.attribution.trim() }
          : {}),
      };
    case 'code':
      return {
        id: block.id,
        type: block.type,
        code: block.code,
        ...(block.language.trim() ? { language: block.language.trim() } : {}),
      };
    case 'callout':
      return {
        id: block.id,
        type: block.type,
        tone: block.tone,
        ...(block.title.trim() ? { title: block.title.trim() } : {}),
        html: block.html,
      };
    case 'file':
      return {
        id: block.id,
        type: block.type,
        fileId: block.fileId,
        label: block.label,
      };
    case 'image':
      return {
        id: block.id,
        type: block.type,
        fileId: block.fileId,
        alt: block.alt,
        ...(block.captionHtml.trim() ? { captionHtml: block.captionHtml } : {}),
      };
  }
}

export function isBlockReady(block: BlockDraft): boolean {
  switch (block.type) {
    case 'paragraph':
    case 'quote':
    case 'callout':
      return block.html.trim() !== '';
    case 'heading':
      return block.html.trim() !== '';
    case 'list':
      return block.items.some((item) => item.trim() !== '');
    case 'code':
      return block.code.trim() !== '';
    case 'file':
      return (
        block.fileId !== '' && !block.uploading && block.label.trim() !== ''
      );
    case 'image':
      return block.fileId !== '' && !block.uploading && block.alt.trim() !== '';
  }
}
