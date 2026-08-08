# Baseline utility status

The files in this directory were reconciled from `codex/phase1` during Package A. They are retained as implementation inputs, not completed production boundaries.

## `mpx-packager.ts`

The browser utility implements MPX v1 with an exact-entry manifest, content-addressed attachment IDs, SHA-256 checksums, PDF signatures, normalized flat filenames, CRC validation, and compressed/uncompressed size and count limits. JSZip still buffers archives in browser memory, so authoritative server import must repeat these checks and validate the page block contract before persistence.

## `security.ts`

`sanitizeEditorHtml` is a narrow rich-HTML primitive, and tag helpers are defence in depth. Structured editor data is validated by `lib/content/schema.ts`, which sanitizes only fields declared as rich HTML. Supabase RLS and transactional authorization remain authoritative.

## Dependencies

Package A intentionally did not restore the utility-only `package.json` or lockfile from `codex/phase1`. Package B owns the complete Next.js application manifest and reproducible lockfile, including any retained JSZip, DOMPurify, and `server-only` dependencies.
