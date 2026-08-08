import 'server-only';

import { sanitizeEditorHtml } from '@/lib/html-sanitizer';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BLOCK_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const LANGUAGE_PATTERN = /^[a-z0-9_+#.-]{1,32}$/i;
const MAX_BLOCKS = 200;
const MAX_HTML_LENGTH = 100_000;
const MAX_TEXT_LENGTH = 10_000;

interface BaseBlock {
  readonly id: string;
}

export interface ParagraphBlock extends BaseBlock {
  readonly type: 'paragraph';
  readonly html: string;
}

export interface HeadingBlock extends BaseBlock {
  readonly type: 'heading';
  readonly level: 2 | 3 | 4;
  readonly html: string;
}

export interface ListBlock extends BaseBlock {
  readonly type: 'list';
  readonly ordered: boolean;
  readonly items: readonly string[];
}

export interface QuoteBlock extends BaseBlock {
  readonly type: 'quote';
  readonly html: string;
  readonly attribution?: string;
}

export interface CodeBlock extends BaseBlock {
  readonly type: 'code';
  readonly code: string;
  readonly language?: string;
}

export interface CalloutBlock extends BaseBlock {
  readonly type: 'callout';
  readonly tone: 'neutral' | 'info' | 'warning';
  readonly title?: string;
  readonly html: string;
}

export interface FileBlock extends BaseBlock {
  readonly type: 'file';
  readonly fileId: string;
  readonly label: string;
}

export interface ImageBlock extends BaseBlock {
  readonly type: 'image';
  readonly fileId: string;
  readonly alt: string;
  readonly captionHtml?: string;
}

export type EditorBlock =
  | ParagraphBlock
  | HeadingBlock
  | ListBlock
  | QuoteBlock
  | CodeBlock
  | CalloutBlock
  | FileBlock
  | ImageBlock;

export interface EditorDocumentV1 {
  readonly schemaVersion: 1;
  readonly blocks: readonly EditorBlock[];
}

export class InvalidEditorDocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidEditorDocumentError';
  }
}

function fail(path: string, message: string): never {
  throw new InvalidEditorDocumentError(`${path}: ${message}`);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return fail(path, 'expected an object');
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return fail(path, 'expected a plain object');
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
) {
  const allowedKeys = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key))
      fail(path, `unknown field ${JSON.stringify(key)}`);
  }
}

function string(
  value: unknown,
  path: string,
  maximum = MAX_TEXT_LENGTH,
): string {
  if (typeof value !== 'string') return fail(path, 'expected a string');
  if (value.length > maximum)
    return fail(path, `must not exceed ${maximum} characters`);
  if (/\u0000/.test(value))
    return fail(path, 'must not contain null characters');
  return value;
}

function requiredPlainText(
  value: unknown,
  path: string,
  maximum = 500,
): string {
  const result = string(value, path, maximum).trim();
  if (!result) return fail(path, 'must not be empty');
  return result;
}

function optionalPlainText(
  value: unknown,
  path: string,
  maximum = 500,
): string | undefined {
  if (value === undefined) return undefined;
  return requiredPlainText(value, path, maximum);
}

function richHtml(value: unknown, path: string): string {
  return sanitizeEditorHtml(string(value, path, MAX_HTML_LENGTH));
}

function base(value: Record<string, unknown>, path: string): string {
  const id = string(value.id, `${path}.id`, 64);
  if (!BLOCK_ID_PATTERN.test(id))
    return fail(`${path}.id`, 'has an invalid format');
  return id;
}

function fileId(value: unknown, path: string): string {
  const id = string(value, path, 36);
  if (!UUID_PATTERN.test(id)) return fail(path, 'expected a UUID');
  return id.toLowerCase();
}

function parseBlock(input: unknown, index: number): EditorBlock {
  const path = `blocks[${index}]`;
  const value = record(input, path);
  const type = string(value.type, `${path}.type`, 32);
  const id = base(value, path);

  switch (type) {
    case 'paragraph':
      exactKeys(value, ['id', 'type', 'html'], path);
      return { id, type, html: richHtml(value.html, `${path}.html`) };
    case 'heading': {
      exactKeys(value, ['id', 'type', 'level', 'html'], path);
      if (value.level !== 2 && value.level !== 3 && value.level !== 4) {
        return fail(`${path}.level`, 'expected 2, 3, or 4');
      }
      return {
        id,
        type,
        level: value.level,
        html: richHtml(value.html, `${path}.html`),
      };
    }
    case 'list': {
      exactKeys(value, ['id', 'type', 'ordered', 'items'], path);
      if (typeof value.ordered !== 'boolean')
        return fail(`${path}.ordered`, 'expected a boolean');
      if (
        !Array.isArray(value.items) ||
        value.items.length < 1 ||
        value.items.length > 100
      ) {
        return fail(`${path}.items`, 'expected between 1 and 100 items');
      }
      return {
        id,
        type,
        ordered: value.ordered,
        items: value.items.map((item, itemIndex) =>
          richHtml(item, `${path}.items[${itemIndex}]`),
        ),
      };
    }
    case 'quote':
      exactKeys(value, ['id', 'type', 'html', 'attribution'], path);
      return {
        id,
        type,
        html: richHtml(value.html, `${path}.html`),
        ...(optionalPlainText(value.attribution, `${path}.attribution`) ===
        undefined
          ? {}
          : {
              attribution: optionalPlainText(
                value.attribution,
                `${path}.attribution`,
              ),
            }),
      };
    case 'code': {
      exactKeys(value, ['id', 'type', 'code', 'language'], path);
      const language = optionalPlainText(
        value.language,
        `${path}.language`,
        32,
      );
      if (language && !LANGUAGE_PATTERN.test(language))
        return fail(`${path}.language`, 'has an invalid format');
      return {
        id,
        type,
        code: string(value.code, `${path}.code`, MAX_HTML_LENGTH),
        ...(language ? { language } : {}),
      };
    }
    case 'callout': {
      exactKeys(value, ['id', 'type', 'tone', 'title', 'html'], path);
      if (
        value.tone !== 'neutral' &&
        value.tone !== 'info' &&
        value.tone !== 'warning'
      ) {
        return fail(`${path}.tone`, 'has an unsupported value');
      }
      const title = optionalPlainText(value.title, `${path}.title`);
      return {
        id,
        type,
        tone: value.tone,
        ...(title ? { title } : {}),
        html: richHtml(value.html, `${path}.html`),
      };
    }
    case 'file':
      exactKeys(value, ['id', 'type', 'fileId', 'label'], path);
      return {
        id,
        type,
        fileId: fileId(value.fileId, `${path}.fileId`),
        label: requiredPlainText(value.label, `${path}.label`),
      };
    case 'image': {
      exactKeys(value, ['id', 'type', 'fileId', 'alt', 'captionHtml'], path);
      const captionHtml =
        value.captionHtml === undefined
          ? undefined
          : richHtml(value.captionHtml, `${path}.captionHtml`);
      return {
        id,
        type,
        fileId: fileId(value.fileId, `${path}.fileId`),
        alt: requiredPlainText(value.alt, `${path}.alt`, 1_000),
        ...(captionHtml === undefined ? {} : { captionHtml }),
      };
    }
    default:
      return fail(
        `${path}.type`,
        `unsupported block type ${JSON.stringify(type)}`,
      );
  }
}

/** Validates and sanitizes a versioned block-editor document. */
export function parseEditorDocument(input: unknown): EditorDocumentV1 {
  const value = record(input, 'document');
  exactKeys(value, ['schemaVersion', 'blocks'], 'document');
  if (value.schemaVersion !== 1)
    fail('document.schemaVersion', 'unsupported schema version');
  if (!Array.isArray(value.blocks) || value.blocks.length > MAX_BLOCKS) {
    fail(
      'document.blocks',
      `expected an array with at most ${MAX_BLOCKS} blocks`,
    );
  }
  const blocks = value.blocks.map(parseBlock);
  if (new Set(blocks.map(({ id }) => id)).size !== blocks.length) {
    fail('document.blocks', 'block IDs must be unique');
  }
  return { schemaVersion: 1, blocks };
}
