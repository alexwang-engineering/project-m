import JSZip, { type JSZipObject } from 'jszip';

const MEBIBYTE = 1024 * 1024;
const MAX_ATTACHMENT_BYTES = 25 * MEBIBYTE;
const MAX_ATTACHMENT_COUNT = 100;
const MAX_PAGE_JSON_BYTES = 5 * MEBIBYTE;
const MAX_MANIFEST_BYTES = 1 * MEBIBYTE;
const MAX_EXTRACTED_BYTES = 500 * MEBIBYTE;
const MAX_ARCHIVE_BYTES = 500 * MEBIBYTE;
const MPX_FORMAT = 'project-m.mpx';
const MPX_VERSION = 1;
const MANIFEST_FILE_NAME = 'manifest.json';
const PAGE_FILE_NAME = 'page.json';
const ATTACHMENTS_DIRECTORY = 'attachments/';
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface MpxManifestFile {
  readonly path: string;
  readonly size: number;
  readonly sha256: string;
}

export interface MpxManifestAttachment extends MpxManifestFile {
  /** Content-addressed stable identifier. */
  readonly id: `sha256:${string}`;
  readonly name: string;
  readonly mediaType: 'application/pdf';
}

export interface MpxManifestV1 {
  readonly format: typeof MPX_FORMAT;
  readonly version: typeof MPX_VERSION;
  readonly page: MpxManifestFile;
  readonly attachments: readonly MpxManifestAttachment[];
}

export interface UnpackedMpx<TPage extends JsonValue = JsonValue> {
  readonly page: TPage;
  readonly attachments: readonly File[];
  readonly manifest: MpxManifestV1;
}

export class MpxFormatError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'MpxFormatError';
  }
}

function assertBrowserFileApi(): void {
  if (typeof File === 'undefined' || typeof Blob === 'undefined' || !globalThis.crypto?.subtle) {
    throw new Error('MPX packaging requires browser File, Blob, and Web Crypto APIs.');
  }
}

function safeAttachmentName(name: string): string {
  const normalized = name.normalize('NFC').replaceAll('\\', '/');
  const basename = normalized.split('/').pop()?.trim();
  if (
    !basename ||
    basename === '.' ||
    basename === '..' ||
    basename.includes('\0') ||
    /[\u0000-\u001f\u007f]/.test(basename) ||
    basename.length > 255
  ) {
    throw new MpxFormatError(`Invalid attachment name: ${JSON.stringify(name)}`);
  }
  return basename;
}

function uniqueName(name: string, usedNames: Set<string>): string {
  const dotIndex = name.lastIndexOf('.');
  const stem = dotIndex > 0 ? name.slice(0, dotIndex) : name;
  const extension = dotIndex > 0 ? name.slice(dotIndex) : '';
  let candidate = name;
  for (let suffix = 2; usedNames.has(candidate.toLocaleLowerCase('en-GB')); suffix += 1) {
    candidate = `${stem} (${suffix})${extension}`;
  }
  usedNames.add(candidate.toLocaleLowerCase('en-GB'));
  return candidate;
}

function assertPdfMetadata(file: File): void {
  if (!file.name.toLocaleLowerCase('en-GB').endsWith('.pdf')) {
    throw new MpxFormatError(`Attachment ${JSON.stringify(file.name)} must use the .pdf extension.`);
  }
  if (file.type !== '' && file.type !== 'application/pdf') {
    throw new MpxFormatError(`Attachment ${JSON.stringify(file.name)} must use the PDF media type.`);
  }
  if (file.size < 5 || file.size > MAX_ATTACHMENT_BYTES) {
    throw new MpxFormatError(`Attachment ${JSON.stringify(file.name)} must be between 5 bytes and 25 MiB.`);
  }
}

function assertPdfSignature(bytes: Uint8Array, name: string): void {
  if (
    bytes[0] !== 0x25 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x44 ||
    bytes[3] !== 0x46 ||
    bytes[4] !== 0x2d
  ) {
    throw new MpxFormatError(`Attachment ${JSON.stringify(name)} does not contain a PDF signature.`);
  }
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', Uint8Array.from(bytes).buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function exactObject(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new MpxFormatError(`${path} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], path: string): void {
  const expected = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) throw new MpxFormatError(`${path} contains unknown field ${JSON.stringify(key)}.`);
  }
}

function manifestFile(value: unknown, path: string): MpxManifestFile {
  const object = exactObject(value, path);
  exactKeys(object, ['path', 'size', 'sha256'], path);
  if (typeof object.path !== 'string' || typeof object.sha256 !== 'string') {
    throw new MpxFormatError(`${path} has invalid path or checksum fields.`);
  }
  if (!Number.isSafeInteger(object.size) || (object.size as number) < 0) {
    throw new MpxFormatError(`${path}.size must be a non-negative safe integer.`);
  }
  if (!SHA256_PATTERN.test(object.sha256)) throw new MpxFormatError(`${path}.sha256 is invalid.`);
  return { path: object.path, size: object.size as number, sha256: object.sha256 };
}

function parseManifest(input: unknown): MpxManifestV1 {
  const object = exactObject(input, 'manifest');
  exactKeys(object, ['format', 'version', 'page', 'attachments'], 'manifest');
  if (object.format !== MPX_FORMAT || object.version !== MPX_VERSION) {
    throw new MpxFormatError('This MPX format or version is not supported.');
  }
  const page = manifestFile(object.page, 'manifest.page');
  if (page.path !== PAGE_FILE_NAME || page.size > MAX_PAGE_JSON_BYTES) {
    throw new MpxFormatError('The manifest contains an invalid page entry.');
  }
  if (!Array.isArray(object.attachments) || object.attachments.length > MAX_ATTACHMENT_COUNT) {
    throw new MpxFormatError('The manifest contains too many attachments.');
  }
  const seenPaths = new Set([MANIFEST_FILE_NAME, PAGE_FILE_NAME]);
  const attachments = object.attachments.map((inputAttachment, index): MpxManifestAttachment => {
    const raw = exactObject(inputAttachment, `manifest.attachments[${index}]`);
    exactKeys(raw, ['id', 'path', 'name', 'mediaType', 'size', 'sha256'], `manifest.attachments[${index}]`);
    const file = manifestFile(
      { path: raw.path, size: raw.size, sha256: raw.sha256 },
      `manifest.attachments[${index}]`,
    );
    if (typeof raw.id !== 'string' || raw.id !== `sha256:${file.sha256}`) {
      throw new MpxFormatError(`manifest.attachments[${index}].id does not match its checksum.`);
    }
    if (typeof raw.name !== 'string' || raw.mediaType !== 'application/pdf') {
      throw new MpxFormatError(`manifest.attachments[${index}] is not a PDF attachment.`);
    }
    const name = safeAttachmentName(raw.name);
    const expectedPath = `${ATTACHMENTS_DIRECTORY}${name}`;
    if (file.path !== expectedPath || seenPaths.has(file.path) || file.size < 5 || file.size > MAX_ATTACHMENT_BYTES) {
      throw new MpxFormatError(`manifest.attachments[${index}] has an invalid or duplicate path/size.`);
    }
    seenPaths.add(file.path);
    return { ...file, id: raw.id as `sha256:${string}`, name, mediaType: 'application/pdf' };
  });
  const extractedSize = page.size + attachments.reduce((total, attachment) => total + attachment.size, 0);
  if (extractedSize > MAX_EXTRACTED_BYTES) throw new MpxFormatError('The MPX extracted size exceeds 500 MiB.');
  return { format: MPX_FORMAT, version: MPX_VERSION, page, attachments };
}

function declaredUncompressedSize(entry: JSZipObject): number | null {
  const data = (entry as JSZipObject & { _data?: { uncompressedSize?: unknown } })._data;
  return typeof data?.uncompressedSize === 'number' ? data.uncompressedSize : null;
}

async function checkedEntryBytes(entry: JSZipObject, expected: MpxManifestFile, maximum: number): Promise<Uint8Array> {
  const declaredSize = declaredUncompressedSize(entry);
  if (declaredSize !== null && (declaredSize !== expected.size || declaredSize > maximum)) {
    throw new MpxFormatError(`Archive size metadata does not match ${JSON.stringify(expected.path)}.`);
  }
  const bytes = await entry.async('uint8array');
  if (bytes.byteLength !== expected.size || bytes.byteLength > maximum) {
    throw new MpxFormatError(`Extracted size does not match ${JSON.stringify(expected.path)}.`);
  }
  if ((await sha256(bytes)) !== expected.sha256) {
    throw new MpxFormatError(`SHA-256 verification failed for ${JSON.stringify(expected.path)}.`);
  }
  return bytes;
}

/** Packages page JSON and PDF attachments into a versioned ZIP-compatible MPX blob. */
export async function packageMpx<TPage extends JsonValue>(
  page: TPage,
  attachments: readonly File[],
): Promise<Blob> {
  assertBrowserFileApi();
  if (attachments.length > MAX_ATTACHMENT_COUNT) {
    throw new MpxFormatError(`An MPX file can contain at most ${MAX_ATTACHMENT_COUNT} attachments.`);
  }
  let pageJson: string;
  try {
    pageJson = JSON.stringify(page);
  } catch (error) {
    throw new MpxFormatError('Page data must be JSON-serializable.', { cause: error });
  }
  if (pageJson === undefined) throw new MpxFormatError('Page data must be a JSON value.');
  const pageBytes = new TextEncoder().encode(pageJson);
  if (pageBytes.byteLength > MAX_PAGE_JSON_BYTES) throw new MpxFormatError('Page JSON exceeds 5 MiB.');

  const zip = new JSZip();
  const usedNames = new Set<string>();
  const manifestAttachments: MpxManifestAttachment[] = [];
  let extractedSize = pageBytes.byteLength;
  zip.file(PAGE_FILE_NAME, Uint8Array.from(pageBytes).buffer, {
    binary: true,
    createFolders: false,
  });

  for (const attachment of attachments) {
    assertPdfMetadata(attachment);
    const name = uniqueName(safeAttachmentName(attachment.name), usedNames);
    const bytes = new Uint8Array(await attachment.arrayBuffer());
    assertPdfSignature(bytes, name);
    const checksum = await sha256(bytes);
    const path = `${ATTACHMENTS_DIRECTORY}${name}`;
    extractedSize += bytes.byteLength;
    if (extractedSize > MAX_EXTRACTED_BYTES) throw new MpxFormatError('Combined MPX content exceeds 500 MiB.');
    manifestAttachments.push({
      id: `sha256:${checksum}`,
      path,
      name,
      mediaType: 'application/pdf',
      size: bytes.byteLength,
      sha256: checksum,
    });
    zip.file(path, Uint8Array.from(bytes).buffer, { binary: true, createFolders: false });
  }

  const manifest: MpxManifestV1 = {
    format: MPX_FORMAT,
    version: MPX_VERSION,
    page: { path: PAGE_FILE_NAME, size: pageBytes.byteLength, sha256: await sha256(pageBytes) },
    attachments: manifestAttachments,
  };
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
  if (manifestBytes.byteLength > MAX_MANIFEST_BYTES) throw new MpxFormatError('MPX manifest exceeds 1 MiB.');
  zip.file(MANIFEST_FILE_NAME, Uint8Array.from(manifestBytes).buffer, {
    binary: true,
    createFolders: false,
  });

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.project-m.mpx+zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    platform: 'DOS',
  });
}

/** Validates and extracts a versioned MPX archive without trusting its manifest. */
export async function unpackMpx<TPage extends JsonValue = JsonValue>(archive: File): Promise<UnpackedMpx<TPage>> {
  assertBrowserFileApi();
  if (!archive.name.toLocaleLowerCase('en-GB').endsWith('.mpx')) {
    throw new MpxFormatError('The selected file must use the .mpx extension.');
  }
  if (archive.size < 1 || archive.size > MAX_ARCHIVE_BYTES) {
    throw new MpxFormatError('The MPX archive has an invalid compressed size.');
  }
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(await archive.arrayBuffer(), { checkCRC32: true, createFolders: false });
  } catch (error) {
    throw new MpxFormatError('The MPX file is corrupt or is not a valid ZIP archive.', { cause: error });
  }
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  if (entries.length > MAX_ATTACHMENT_COUNT + 2) throw new MpxFormatError('The MPX archive contains too many files.');
  for (const entry of entries) {
    if ((entry.unsafeOriginalName && entry.unsafeOriginalName !== entry.name) || entry.name.includes('\\')) {
      throw new MpxFormatError(`Unsafe archive path: ${JSON.stringify(entry.name)}.`);
    }
  }

  const manifestEntry = zip.file(MANIFEST_FILE_NAME);
  if (!manifestEntry) throw new MpxFormatError(`The MPX archive is missing ${MANIFEST_FILE_NAME}.`);
  const declaredManifestSize = declaredUncompressedSize(manifestEntry);
  if (declaredManifestSize !== null && declaredManifestSize > MAX_MANIFEST_BYTES) {
    throw new MpxFormatError('The MPX manifest exceeds 1 MiB.');
  }
  const manifestBytes = await manifestEntry.async('uint8array');
  if (manifestBytes.byteLength > MAX_MANIFEST_BYTES) throw new MpxFormatError('The MPX manifest exceeds 1 MiB.');
  let manifest: MpxManifestV1;
  try {
    manifest = parseManifest(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(manifestBytes)));
  } catch (error) {
    if (error instanceof MpxFormatError) throw error;
    throw new MpxFormatError('The MPX manifest is not valid UTF-8 JSON.', { cause: error });
  }

  const expectedPaths = new Set([MANIFEST_FILE_NAME, PAGE_FILE_NAME, ...manifest.attachments.map(({ path }) => path)]);
  if (entries.length !== expectedPaths.size || entries.some(({ name }) => !expectedPaths.has(name))) {
    throw new MpxFormatError('The MPX archive entries do not exactly match its manifest.');
  }
  const pageEntry = zip.file(PAGE_FILE_NAME);
  if (!pageEntry) throw new MpxFormatError(`The MPX archive is missing ${PAGE_FILE_NAME}.`);
  const pageBytes = await checkedEntryBytes(pageEntry, manifest.page, MAX_PAGE_JSON_BYTES);
  let page: TPage;
  try {
    page = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(pageBytes)) as TPage;
  } catch (error) {
    throw new MpxFormatError('The MPX page data is not valid UTF-8 JSON.', { cause: error });
  }

  const files: File[] = [];
  for (const attachment of manifest.attachments) {
    const entry = zip.file(attachment.path);
    if (!entry) throw new MpxFormatError(`The MPX archive is missing ${JSON.stringify(attachment.path)}.`);
    const bytes = await checkedEntryBytes(entry, attachment, MAX_ATTACHMENT_BYTES);
    assertPdfSignature(bytes, attachment.name);
    files.push(
      new File([Uint8Array.from(bytes).buffer], attachment.name, {
        type: attachment.mediaType,
      }),
    );
  }
  return { page, attachments: files, manifest };
}

/** Starts a browser download and always applies the custom `.mpx` extension. */
export function downloadMpx(blob: Blob, filename: string): void {
  const safeFilename = safeAttachmentName(filename).replace(/\.mpx$/i, '') || 'page';
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeFilename}.mpx`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
