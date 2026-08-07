# ADR-019: Moodle Migration Scope (Launch v1)

Status: Accepted
Date: 2026-08-07

## Context

PM-01 named Moodle migration Launch scope. ADR-009 already fixed its required properties: staged, resumable, checksummed, mapped, and report-driven, with the legacy service staying read-only until acceptance. No real Moodle instance, export, or credentials exist in this environment - the same constraint Package U (MIS/SIS sync, ADR-015) hit, and the same split applies:

1. **A staged import engine** - accepts a migration manifest, maps it onto this app's own content model, tracks what's already been imported (for resumability), and reports exceptions. Needs no real Moodle instance; fully buildable and testable now against synthetic manifests.
2. **A real Moodle `.mbz` backup-format reader** - Moodle's actual course-backup format is a real, documented, but non-trivial XML+ZIP structure with version-specific quirks. Writing a parser for it blind, with no real export file to validate against, would mean guessing at a real-world format's edge cases the same way ADR-015 explicitly declined to invent a speculative MIS `external_id` scheme. Deferred: when a real Moodle export becomes available, that parser becomes a thin adapter producing the same manifest shape the engine below already consumes - the same relationship Package U has to a future live MIS connector.

This ADR scopes (1) only.

## Decision

### Reuse over reinvention

Unlike Package U's roster reconciliation (a genuinely new diff/merge operation with no existing equivalent), migrated content - pages, assignments, quizzes - are things this app already knows how to create correctly, with authorization, sanitization, and validation already built and tested (`createPage`, `createAssignment`, `createQuiz` from Packages G/L/P). The import engine calls these **existing, already-tested functions in a loop** rather than writing a new bulk-SQL path that re-solves authorization and validation a second time, blind. This keeps new, unverified SQL to the absolute minimum: one small tracking table and one thin insert-only RPC, instead of another `sync_roster`-scale function.

### Manifest shape

A JSON manifest, uploaded and parsed client-side (matching Package U's CSV precedent): courses, each with a list of resources (title + sanitized HTML body, matching this project's existing `paragraph` block), assignments (title, due date, resubmission flag), and quizzes (title, due date, multiple-choice questions only). No `external_id` scheme is invented beyond a per-item `externalId` string the manifest author supplies (a real Moodle adapter would populate this from the backup's own numeric IDs) - this project has no real Moodle export to know what that ID actually looks like, so the tracking table treats it as an opaque string, nothing more.

### Content types explicitly excluded, not silently dropped

- **Historical student submissions and grades.** These carry the same compliance weight as guardian data (ADR-013) and reporting exports (ADR-017) - both already got a "named, deferred, pending human privacy review" treatment rather than being built quietly. A bulk import of potentially years of past student work/marks deserves the same gate, not a smaller one just because it arrives as a migration instead of a live feature. Only assignment/quiz **definitions** (the task itself) migrate, matching this project's own existing "accept a submission with a timestamp" MVP scope (ADR-008 addendum) - there is no historical submission model rich enough to migrate into regardless.
- **Moodle content types with no equivalent here** (forums, glossaries, wikis, SCORM packages, non-multiple-choice question types): reported as exceptions per manifest item, never silently dropped and never a reason to fail the whole batch - matching ADR-009's "quarantined failures" requirement and Package U's "partial-success reporting" precedent.

### Course → tag mapping

A course maps to a tag, identical in spirit to how a Moodle "class"/"cohort" would map under MIS/SIS sync. If a tag with the same name doesn't already exist, the importing admin creates it first via the existing tag-creation flow (Package K) rather than the migration silently inventing tags - same "never auto-create what an admin should see and approve" boundary Package U already established for roster tags.

### Lifecycle and authorship

Every migrated page/assignment/quiz is created in **draft** state (this project's own existing default for new content) - a real migration of potentially hundreds of resources should never mass-publish unreviewed, and requiring a teacher to review-then-publish each one is the correct safety default, not an oversight. The importing admin becomes the technical author of record (same as any other `createPage`/`createAssignment`/`createQuiz` call, which reads `auth.uid()`); the original Moodle author, if known, is preserved only as free-text provenance in the migration tracking row, never fabricated as a fake profile.

### Resumability and idempotency

A new `content_migration_imports` table (`external_source`, `external_id`, `run_id`, `internal_type`, `internal_id`, `content_checksum`, `imported_at`) tracks what's already been imported. Re-running the same manifest skips any `(external_source, external_id)` pair whose checksum matches - unchanged items are true no-ops, matching ADR-009's "resumable" requirement and Package U's idempotency precedent. A changed checksum for an already-imported item is reported as requiring manual reconciliation (a second copy is never silently created, and the existing item is never silently overwritten) - conflict handling stays a human decision, the same posture as the concurrent-edit conflict UX fixed earlier this session.

## Consequences

This ships a real, useful staged-import capability - a school could genuinely author a manifest by hand or a future connector could generate one from a real `.mbz` file - while keeping new SQL surface area minimal by routing every actual content write through paths this project has already built, tested, and (for pages/assignments/quizzes) live-verified in earlier packages. Tests must cover: re-importing an unchanged manifest is a true no-op, a changed checksum for an already-imported item is reported rather than silently overwritten or duplicated, an unmappable manifest item is quarantined without failing the batch, and every created item lands in `draft` state regardless of manifest content.
