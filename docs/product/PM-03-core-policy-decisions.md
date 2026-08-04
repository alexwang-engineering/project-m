# PM-03 — Core Policy and Architecture Decisions

Status: Recommended defaults approved by the product owner's instruction to continue; factual tenant and school-policy inputs remain required before staging/production.

## Authorization

- Read: a non-public resource is readable when the caller owns at least one required audience tag, subject to resource-specific release state.
- Content write: a teacher must own every existing and proposed tag; cross-department editors require an explicit editor grant.
- Assessment write/read: teachers require explicit class/assessment permission, not merely a broad content tag.
- Student: read-only for learning content but may create their own permitted submission, attempt, message, and acknowledgement records through constrained operations.
- Parent/guardian: read-only projections for explicitly linked pupils and released fields only.
- Admin: privileged access is never inferred from the client and every sensitive action is audited.
- Multi-table mutations use transactional database functions so intermediate unauthorized states are impossible.

## Identity

- Microsoft Entra is the only production workforce/student provider unless a later ADR approves another.
- Validate tenant/issuer and verified institutional email; the domain trigger remains defence in depth.
- New institutional users default to student; promotion and tag assignment are admin/MIS-controlled.
- Parent/guardian identity must use a separate verified linking design; email-domain membership is neither expected nor sufficient.
- Tenant ID, client credentials, service keys, and LTI secrets remain in managed secret storage.

## Navigation

- Authorization tags and navigation hierarchy are separate concepts.
- A page has one optional parent, one slug, and one canonical path.
- Tags may surface one page in multiple feeds but do not create multiple canonical parents.
- Old canonical paths are retained as redirects; hierarchy cycles and duplicate sibling slugs are rejected.

## Lifecycle and integrity

- Core states are draft, published, and archived; assessments add scheduled, open, closed, marking, and released states.
- Material content and grading changes create immutable revisions/audit events.
- Optimistic concurrency prevents silent last-write-wins loss.
- Ordinary users archive rather than hard-delete; retention jobs perform approved deletion.
- Grade release is explicit and separate from saving marks.

## Interoperability

- LTI 1.3 is preferred for external learning tools; tools are allow-listed and configured by admins.
- SCORM packages are untrusted active content and require isolated delivery, strict CSP/sandboxing, package limits, and explicit vendor review.
- MIS/SIS sync is idempotent, observable, dry-runnable, and never silently deletes access/content.
- Moodle migration is staged, resumable, checksummed, mapped, and report-driven; legacy remains read-only until acceptance.
