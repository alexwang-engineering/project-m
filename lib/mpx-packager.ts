import JSZip from 'jszip';

/**
 * @experimental Client-side preview utility only.
 *
 * This module is not the authoritative MPX import boundary. It buffers ZIP
 * data in browser memory and predates ADR-007's manifest, SHA-256, and bounded
 * extraction contract. Server-side validation must reject untrusted imports
 * until P3-06 replaces the draft format.
 */

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const MAX_ATTACHMENT_COUNT = 100;
const MAX_PAGE_JSON_BYTES = 5 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 500 * 1024 * 1024;
const PAGE_FILE_NAME = 'page.json';
const ATTACHMENTS_DIRECTORY = 'attachments/';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface UnpackedMpx<TPage extends JsonValue = JsonValue> {
  page: TPage;
  attachments: File[];
}

function assertBrowserFileApi(): void {
  if (typeof File === 'undefined' || typeof Blob === 'undefined') {
    throw new Error('MPX packaging is only available in a browser.');
  }
}

function safeAttachmentName(name: string): string {
  const normalised = name.normalize('NFC').replaceAll('\\', '/');
  const basename = normalised.split('/').pop()?.trim();

  if (!basename || basename === '.' || basename === '..' || basename.includes('\0')) {
    throw new Error(`Invalid attachment name: ${name}`);
  }

  return basename;
}

function assertPdf(file: File): void {
  const extensionIsPdf = file.name.toLocaleLowerCase('en-GB').endsWith('.pdf');
  const mimeIsPdf = file.type === 'application/pdf' || file.type === '';

  if (!extensionIsPdf || !mimeIsPdf) {
    throw new Error(`Attachment "${file.name}" must be a PDF.`);
  }

  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`Attachment "${file.name}" exceeds the 25 MB limit.`);
  }
}

function uniqueName(name: string, usedNames: Set<string>): string {
  const dotIndex = name.lastIndexOf('.');
  const stem = dotIndex > 0 ? name.slice(0, dotIndex) : name;
  const extension = dotIndex > 0 ? name.slice(dotIndex) : '';
  let candidate = name;
  let suffix = 2;

  while (usedNames.has(candidate.toLocaleLowerCase('en-GB'))) {
    candidate = `${stem} (${suffix})${extension}`;
    suffix += 1;
  }

  usedNames.add(candidate.toLocaleLowerCase('en-GB'));
  return candidate;
}

/**
 * Packages page data and PDF attachments into a ZIP-compatible MPX blob.
 *
 * The returned Blob should be downloaded with a filename ending in `.mpx`.
 * JSZip performs asynchronous compression but holds the resulting archive in
 * browser memory, so callers should avoid packaging very large batches at once.
 */
export async function packageMpx<TPage extends JsonValue>(
  page: TPage,
  attachments: readonly File[],
): Promise<Blob> {
  assertBrowserFileApi();

  if (attachments.length > MAX_ATTACHMENT_COUNT) {
    throw new Error(`An MPX file can contain at most ${MAX_ATTACHMENT_COUNT} attachments.`);
  }

  const totalAttachmentBytes = attachments.reduce((total, file) => total + file.size, 0);
  if (totalAttachmentBytes > MAX_ARCHIVE_BYTES - MAX_PAGE_JSON_BYTES) {
    throw new Error('The combined attachments exceed the 500 MB archive limit.');
  }

  let pageJson: string;
  try {
    pageJson = JSON.stringify(page);
  } catch (error) {
    throw new Error('Page data must be JSON-serialisable.', { cause: error });
  }

  if (pageJson === undefined) {
    throw new Error('Page data must be a JSON value.');
  }

  if (new Blob([pageJson]).size > MAX_PAGE_JSON_BYTES) {
    throw new Error('Page JSON exceeds the 5 MB limit.');
  }

  const zip = new JSZip();
  const usedNames = new Set<string>();
  zip.file(PAGE_FILE_NAME, pageJson);

  for (const attachment of attachments) {
    assertPdf(attachment);
    const name = uniqueName(safeAttachmentName(attachment.name), usedNames);
    zip.file(`${ATTACHMENTS_DIRECTORY}${name}`, await attachment.arrayBuffer(), {
      binary: true,
      createFolders: false,
    });
  }

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.project-m.mpx+zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    platform: 'DOS',
  });
}

/**
 * Validates and extracts a ZIP-compatible `.mpx` file.
 *
 * Archive entry paths, entry counts, declared sizes, PDF types, and total
 * extracted size are bounded to reduce path-traversal and ZIP-bomb risk.
 */
export async function unpackMpx<TPage extends JsonValue = JsonValue>(
  archive: File,
): Promise<UnpackedMpx<TPage>> {
  assertBrowserFileApi();

  if (!archive.name.toLocaleLowerCase('en-GB').endsWith('.mpx')) {
    throw new Error('The selected file must use the .mpx extension.');
  }
  if (archive.size > MAX_ARCHIVE_BYTES) {
    throw new Error('The MPX archive exceeds the permitted size.');
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(await archive.arrayBuffer(), {
      checkCRC32: true,
      createFolders: false,
    });
  } catch (error) {
    throw new Error('The MPX file is corrupt or is not a valid archive.', { cause: error });
  }

  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  if (entries.length > MAX_ATTACHMENT_COUNT + 1) {
    throw new Error('The MPX archive contains too many files.');
  }

  for (const entry of entries) {
    if (
      (entry.unsafeOriginalName !== undefined && entry.unsafeOriginalName !== entry.name) ||
      entry.name.includes('\\')
    ) {
      throw new Error(`Unsafe archive path: ${entry.name}`);
    }
  }

  const pageEntry = zip.file(PAGE_FILE_NAME);
  if (!pageEntry) {
    throw new Error(`The MPX archive is missing ${PAGE_FILE_NAME}.`);
  }

  const pageBytes = await pageEntry.async('uint8array');
  if (pageBytes.byteLength > MAX_PAGE_JSON_BYTES) {
    throw new Error('Page JSON exceeds the 5 MB limit.');
  }

  let page: TPage;
  try {
    page = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(pageBytes)) as TPage;
  } catch (error) {
    throw new Error('The MPX page data is not valid UTF-8 JSON.', { cause: error });
  }

  const attachmentEntries = entries.filter((entry) => entry.name !== PAGE_FILE_NAME);
  const attachments: File[] = [];
  let extractedBytes = pageBytes.byteLength;

  for (const entry of attachmentEntries) {
    if (!entry.name.startsWith(ATTACHMENTS_DIRECTORY)) {
      throw new Error(`Unexpected file in MPX archive: ${entry.name}`);
    }

    const name = safeAttachmentName(entry.name.slice(ATTACHMENTS_DIRECTORY.length));
    if (entry.name !== `${ATTACHMENTS_DIRECTORY}${name}`) {
      throw new Error(`Nested attachment paths are not permitted: ${entry.name}`);
    }
    if (!name.toLocaleLowerCase('en-GB').endsWith('.pdf')) {
      throw new Error(`Non-PDF attachment in MPX archive: ${name}`);
    }

    const bytes = await entry.async('uint8array');
    extractedBytes += bytes.byteLength;
    if (bytes.byteLength > MAX_ATTACHMENT_BYTES || extractedBytes > MAX_ARCHIVE_BYTES) {
      throw new Error(`Attachment "${name}" exceeds the permitted size.`);
    }
    if (
      bytes.byteLength < 5 ||
      bytes[0] !== 0x25 ||
      bytes[1] !== 0x50 ||
      bytes[2] !== 0x44 ||
      bytes[3] !== 0x46 ||
      bytes[4] !== 0x2d
    ) {
      throw new Error(`Attachment "${name}" does not contain a valid PDF signature.`);
    }

    const file = new File([new Uint8Array(bytes).buffer], name, {
      type: 'application/pdf',
    });
    assertPdf(file);
    attachments.push(file);
  }

  return { page, attachments };
}

/** Starts a browser download for a packaged MPX blob. */
export function downloadMpx(blob: Blob, filename: string): void {
  const safeFilename = safeAttachmentName(filename).replace(/\.mpx$/i, '') || 'page';
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeFilename}.mpx`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
