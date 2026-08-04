# Package D Preflight — Database Migration and Policy Hardening

Status: Design preflight only; Package D remains blocked by Package B.

## First-principles database boundaries

The database must represent identities, authorization, learning content, assessments, integrations, and audit as distinct domains. Reusing one `role` enum or page-tag test for every domain would create broad accidental authority.

Package D should establish the identity/content foundation and extension boundaries; later domain packages add assignments, quizzes, gradebook, messaging, parents, connectors, and reports through new migrations.

## Migration rules

- Use timestamped, append-only migrations and deterministic local reset.
- Never edit a migration that may have been applied outside a disposable environment.
- Separate schema, helper functions, RLS/policies, storage policies, and seed/test fixtures where that improves reviewability while preserving order.
- Every `SECURITY DEFINER` function uses an empty or explicit safe `search_path`, schema-qualified objects, least privileges, and revoked public execution unless intentionally exposed.
- Generated TypeScript database types are outputs of the merged schema, not hand-maintained substitutes.

## Identity foundation

Replace the single overloaded role model with explicit concepts:

- Auth identity: Supabase `auth.users` record and verified provider facts.
- Profile/principal: institutional user, guardian, or integration-service classification and active/disabled state.
- System role assignment: narrowly scoped administrative roles.
- Tag/course/class membership: audience and teaching relationships with validity dates/source.
- Guardian-pupil relationship: verified, revocable, sourced relationship added only by the parent package.
- Integration principal: isolated credentials/permissions added only by connector packages.

New institutional users default to active student only after trusted admission. A profile row must not be created from unverified browser metadata. Disabled/leaver status must terminate effective access even when stale tags remain.

## Content foundation

Minimum concepts:

- Tags with normalized unique identifiers, display names, active/archive state, and audit provenance.
- Pages with author, slug, parent, lifecycle, optimistic version, timestamps, and soft/archive semantics.
- Page tags as authorization/audience mappings.
- Explicit page editors for approved cross-tag collaboration.
- Page revisions with immutable content/version metadata.
- Canonical redirects for previous paths.
- File metadata separate from private storage objects, including owner, media type, size, checksum, status, and lifecycle.

Hierarchy constraints must prevent self-parenting/cycles and duplicate active sibling slugs. If recursive cycle enforcement cannot be a simple constraint, writes must go through a tested transactional function.

## Required authorization semantics

### Reads

- Public content only after explicit published/public state.
- Institutional content through current active membership and any matching audience tag.
- Drafts only to author, explicit editors, or authorized admins.
- Archived content hidden from ordinary feeds unless a specific restore/history permission applies.

### Writes

- Students cannot mutate pages/tags/files, but later receive constrained ownership policies for their submissions/attempts.
- Teachers can create/publish only with tags they currently teach/manage.
- Teachers can update only when they own every existing/proposed tag or hold an explicit editor grant.
- Page creation plus initial tags is atomic.
- Page content plus tag changes validate expected optimistic version and authorization in one transaction.
- Admin bypass is explicit, narrow, and audited.

### Membership changes

- Users cannot grant themselves roles/tags/classes.
- Teacher/admin membership changes identify actor, source, reason/job, and time.
- MIS synchronization later writes through dedicated constrained functions and reversible reconciliation.

## Parent-compatible admission design

Do not apply a global `@merchanttaylors.com` trigger unchanged. The admission boundary must support:

- Verified single-tenant Entra institutional identities.
- Separately verified/pre-authorized guardian identities.
- No generic self-service email/password route unless explicitly approved.
- No reliance on user-editable metadata to claim guardian/institutional status.
- Idempotent profile provisioning and safe rejection/cleanup.

The exact Supabase Auth Hook/provider design requires tenant and parent-link factual inputs. Until then, Package D may implement schema support and tests but must keep production admission disabled by default.

## Audit foundation

Audit events need actor principal, action, target type/ID, timestamp, request/correlation ID, source, and safe structured before/after metadata. Avoid storing secrets or unnecessary sensitive content in audit payloads. Ordinary application roles cannot update/delete audit records.

At minimum audit role/membership changes, page publish/archive/restore, explicit editor grants, file state changes, privileged reads where required, and later grade/parent/connector operations.

## Storage foundation

- Private buckets only by default.
- Object path does not grant authority.
- Metadata row and object access policies use authenticated principal and resource relation.
- Upload states cover pending, ready, quarantined/failed, and archived.
- Failed multi-step uploads have cleanup/reconciliation jobs.
- Signed access is short-lived and issued only after current authorization.

## RLS test matrix

Every table/function/storage policy must test allowed and denied operations for:

- Anonymous user.
- Student in matching tag and student outside tag.
- Teacher owning all tags, only one of multiple tags, and no tags.
- Explicit page editor without all tags.
- Institutional admin and unauthorized nominal admin claim.
- Disabled/leaver identity with stale memberships.
- Future guardian with linked pupil and unrelated guardian.
- Future integration principal outside assigned connector scope.

Tests must include direct table operations and exposed transactional functions, because passing only application-route tests does not validate RLS.

## Draft-schema defects that must not survive

- Any-shared-tag teacher update conflicts with ADR-003 all-tag writes.
- Teacher cannot attach the first tag to a newly inserted page under the current policy, creating a deadlocked create flow.
- Untagged teacher-authored pages lack an approved lifecycle/visibility contract.
- Canonical URL string lacks parent/slug/redirect/cycle/collision support.
- Three-value role enum cannot safely represent guardian and service-principal boundaries.
- `is_public` alone is insufficient without draft/published/archive lifecycle.
- No immutable revision, optimistic concurrency, file metadata, redirect, or audit foundation exists.

## Package D acceptance additions

- Local reset and ordered migration application succeed repeatedly.
- Generated types match the final local schema with no diff.
- RLS and storage adversarial tests cover every policy and identity class.
- Atomic page/tag creation and versioned updates pass concurrency and partial-tag attacks.
- Auth admission design does not exclude approved guardians or admit self-asserted identities.
- Security-definer and grants review reports no unintended public execution.
- Query plans/indexes are measured for high-frequency membership/page authorization paths at representative scale.
- Rollback/recovery notes exist for every non-trivial migration.
