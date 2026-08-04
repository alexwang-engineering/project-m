# Baseline utility status

The files in this directory were reconciled from `codex/phase1` during Package A. They are retained as implementation inputs, not completed production boundaries.

## `mpx-packager.ts`

The browser utility performs useful extension, MIME, PDF-signature, filename, count, and size checks. It remains experimental because JSZip buffers archives in memory and the draft format lacks ADR-007's versioned manifest, stable attachment IDs, SHA-256 checksums, schema validation, and authoritative server import checks. No production route may persist its output until P3-06 is complete.

## `security.ts`

`sanitizeEditorHtml` is a narrow rich-HTML primitive, and tag helpers are defence in depth. `sanitizeEditorPayload` is deprecated because treating every JSON string as HTML changes structured values. P1-04/P3-03 must validate the versioned block schema first and sanitize only fields declared as rich HTML. Supabase RLS and transactional authorization remain authoritative.

## Dependencies

Package A intentionally did not restore the utility-only `package.json` or lockfile from `codex/phase1`. Package B owns the complete Next.js application manifest and reproducible lockfile, including any retained JSZip, DOMPurify, and `server-only` dependencies.
