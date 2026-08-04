# Package A Preflight — Phase 3 Integration Review

Status: Complete, read-only review; Package A remains blocked by independent Package 0 review/merge.
Reviewed source: `codex/phase1` at `a920262` against `integration/package-0` architecture decisions.
Purpose: Define how to reconcile the existing Phase 3 commits without treating prototype controls as production-ready full-LMS infrastructure.

## Executive disposition

Do not cherry-pick `06dfd5e` and `a920262` wholesale into `main`.

When Package A is unblocked, integrate with `git cherry-pick --no-commit` or file-level restoration and apply these dispositions:

| File | Disposition | Reason |
|---|---|---|
| `lib/mpx-packager.ts` | Integrate as experimental/internal utility, not a trusted import boundary | Useful PDF/path/count checks, but no ADR-007 manifest/checksums and no true bounded streaming extraction |
| `lib/security.ts` | Integrate only as a temporary primitive behind schema validation; do not call on arbitrary editor JSON | Deep sanitization currently treats every string as HTML and can corrupt identifiers, URLs, filenames, code, and metadata |
| `supabase/migrations/auth_trigger.sql` | Do not apply unchanged; retain for redesign in Package D | It blocks all non-school `auth.users`, including the approved release-1 parent/guardian population |
| `package.json` | Do not integrate as the application manifest | It contains only three utility dependencies and would falsely represent an incomplete Next.js application |
| `package-lock.json` | Regenerate in Package B from the complete approved manifest | Current lock describes the incomplete utility-only package |

## Blocking findings

### A-P0-01 — Domain trigger conflicts with parent access

ADR-001 includes parent/guardian access in release 1. The proposed `BEFORE INSERT` trigger rejects every email outside `@merchanttaylors.com`, so legitimate parents cannot exist in the same Supabase Auth project.

Required resolution before applying an auth trigger:

- Institutional users: Entra tenant/issuer plus verified school email.
- Parent identities: separately approved provider/invite/relationship flow.
- The database admission control must distinguish trusted identity routes using server-verifiable evidence; request metadata controlled by a browser is not sufficient.
- Default parent accounts must not receive institutional tags or roles.
- Negative tests must cover self-asserted parent status, forged metadata, expired invites, removed pupil relationships, and wrong-tenant institutional users.

### A-P0-02 — MPX is not yet the accepted interchange format

ADR-007 requires a versioned manifest, page-schema version, normalized file list, byte sizes, media types, and SHA-256 checksums. The prototype stores only `page.json` and attachments.

Additional risks:

- JSZip buffers input/output and decompressed entries in memory. A nominal 500 MB limit is unsafe for many pupil devices and is checked after individual decompression allocation.
- Attachment-name collisions are silently renamed, but page JSON references are not rewritten and no manifest maps original IDs to archive paths.
- Runtime page content is cast to generic JSON without block-schema validation.
- A `%PDF-` prefix is useful triage, not full content validation or malware scanning.
- CRC32 detects accidental corruption but is not a security integrity check.

Required resolution in P3-06:

- Use stable attachment IDs and a manifest mapping IDs to sanitized paths.
- Validate the manifest before extraction and reject duplicates/unlisted entries.
- Verify SHA-256 for page JSON and every attachment.
- Use a streaming/bounded archive implementation or reduce device-side limits based on measured hardware memory.
- Enforce compressed, declared-uncompressed, per-entry, entry-count, ratio, and total limits before/during extraction where the library permits.
- Validate `PageContent` with the versioned runtime schema before returning it.
- Keep server-side import validation authoritative even when a client preview passes.

### A-P0-03 — Generic deep sanitization corrupts structured data

`sanitizeEditorPayload` applies an HTML sanitizer to every string. Structured editor payloads will contain strings that are not HTML: IDs, block discriminators, filenames, language/code content, URLs, captions, quiz data, and future integration identifiers. Sanitizing all strings can change semantics while still returning the original generic TypeScript type.

Required resolution in P1-04/P3-03:

- Validate the discriminated block union first.
- Sanitize only fields explicitly typed as rich HTML.
- Validate URLs with field-specific scheme/host rules.
- Preserve plain text as plain text and escape at render time.
- Enforce payload byte size, collection counts, string lengths, and nesting in the runtime schema.
- Return a validated output type rather than casting a generic clone to `T`.
- Retain prototype-pollution, cycle, non-finite number, and depth protections where relevant.

## High-priority baseline issues discovered outside Phase 3

These are not to be fixed during Package A; they belong to Package D or the named package.

### A-P1-01 — Initial teacher page/tag write path is internally deadlocked

The draft schema permits teachers to insert an untagged page, but teacher insertion into `page_tags` requires `user_matches_page(page_id)` to already be true. A new page has no tag, so a teacher cannot attach the first tag. At the same time, the draft page `UPDATE` policy uses any shared tag, which conflicts with ADR-003's all-tags write rule.

Package D must replace this with an atomic create/update operation that validates every proposed tag against server-derived membership and writes the page plus tags in one transaction. Direct table policies must not offer a bypass.

### A-P1-02 — Existing schema cannot represent accepted navigation decisions

The page table stores `canonical_url` directly but has no `parent_page_id`, slug, redirect history, cycle constraint, or sibling collision model. P2-01 must introduce the ADR-004 hierarchy rather than extending the current string-only assumption.

### A-P1-03 — Existing role model cannot represent release-1 identities

The enum contains only admin, teacher, and student. Parent/guardian and integration-service behavior should not be added casually as broad roles. Package D must determine whether parent and service principals use separate profile/permission structures while preserving least privilege and generated database types.

## Medium-priority findings

- `verifyTagAccess` correctly uses an all-required-tags subset test, but it is defence in depth only and accepts caller-supplied arrays. Server code must populate both sets from trusted queries inside the authorization transaction.
- The sanitizer disallows new-window targets, inline styles, embedded media, images, and accessibility attributes. That is safe for now but the editor contract must explicitly decide supported rich content rather than relaxing attributes ad hoc.
- The MPX client checks the filename extension and browser-reported MIME type during packing. Both are untrusted hints; authoritative import checks remain necessary.
- The custom MPX MIME type is not a registered standard. Downloads should also use a conservative binary fallback where browser/platform behavior requires it.
- `auth_trigger.sql` is not timestamp-named as a normal Supabase migration. Package D must create ordered migrations and never modify an applied production migration.
- Dependency versions are broad caret ranges in the manifest; Package B must establish the real application manifest, supported Node version, automated audit/update policy, and reproducible build.

## Future Package A integration sequence

1. Start only after Package 0 is independently reviewed and merged.
2. Create `integration/baseline` from the then-current `main`; record branch, worktree, base commit, and owned paths in the ledger.
3. Inspect `git range-diff main...codex/phase1` and verify both source worktrees are clean.
4. Restore `lib/mpx-packager.ts` and `lib/security.ts` without restoring the utility-only manifests.
5. Place explicit experimental/status documentation beside the utilities; ensure no production route imports them yet.
6. Preserve the auth-trigger proposal as design input, but do not place it in an automatically applied migration path until parent identity admission is resolved.
7. Build the complete Next.js manifest and lockfile only in Package B.
8. Run diff checks, TypeScript checks with the complete project, focused utility tests, build, dependency audit, and secret scan.
9. Update README/current baseline truthfully; do not mark ADR-007 or auth admission complete.
10. Commit, provide the standard handoff, and request independent review before `main` merge.

## Package A acceptance additions

In addition to the master plan criteria, Package A is acceptable only when:

- No incomplete utility manifest overwrites the application foundation.
- No migration blocks the approved parent identity population.
- No UI/API treats the current client MPX checks as authoritative.
- No write route applies generic HTML sanitization to an entire structured payload.
- Known schema/RLS incompatibilities are tracked to Package D with tests specified.
- The repository remains runnable or explicitly remains a documented scaffold; it must not claim build readiness before Package B.
