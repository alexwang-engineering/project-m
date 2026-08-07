# ADR-013: Parent/Guardian Access Scope

Status: Accepted
Date: 2026-08-07

## Context

Phase 5E (`R1-01`..`R1-05`) requires parent/guardian identity, a verified pupil relationship, consent, field-release, revocation, and multi-child support, contract-owned jointly by an engineering agent and a privacy/safeguarding owner — a lighter gate than messaging's `C1-05` (which names a human owner exclusively), but still one this project has never resolved. ADR-002 already deferred parent identity as "design separately" from Entra SSO, and no design work has happened since. PM-04's threat model classifies parent links, marks, and feedback as **Highly sensitive**, names "parent sees wrong pupil" as a named risk, and requires "DPIA/retention approval" before this data is processed in production — the same kind of pre-launch human sign-off already tracked for the Entra tenant (ADR-002) and the safeguarding owner (ADR-012), not a reason to avoid building the mechanism now.

Two product-level questions were put to the product owner directly rather than assumed, since both are genuine tradeoffs this session's precedent doesn't already resolve: (1) parent sign-in — build a real one now, or keep relying on `dev-login` and defer it like Entra itself; (2) whether v1's read scope should include grades/feedback, the most sensitive data category named in the threat model, or start narrower. Both were answered in favor of building the fuller version: **real email magic-link sign-in**, and **all three of deadlines, grades/feedback, and announcements**.

## Decision

### Identity and admission (new, not previously designed)

`profiles.kind = 'guardian'` already exists in the schema's `principal_kind` enum from the very first migration — anticipated, never used. Guardians sign in via Supabase Auth's plain email magic-link (`provider = 'email'`), entirely separate from the Entra/`azure` institutional path, needing no new infrastructure.

Admission is **admin-attested and fail-closed**, the same trust model this project already uses for every other admin-gated relationship (tag creation, role assignment, tag membership) — not MIS/SIS-verified, since no MIS/SIS integration exists yet:

1. `institution_admin` creates a `guardian_links` row: `pupil_id` (references `profiles`), `guardian_email` (normalized, not yet a profile — the guardian may not have signed up), a required `reason` (audited attestation, matching `assign_system_role`'s pattern), `created_by`. Multiple guardians per pupil and multiple pupils per guardian email are both allowed (real families, real multi-child households).
2. A new `provision_admitted_guardian` trigger (`after insert on auth.users`) fires on every new signup. For a non-`azure` provider, it checks for a matching unactivated `guardian_links` row by email; if found, it creates the `profiles` row (`kind = 'guardian'`) and marks every matching link `activated_at`. If no match exists, it **rejects the signup outright** (`42501`) — there is no legitimate reason for an unauthorized email to create an account in this closed-admission system, the same fail-closed posture as every other admission path here.
3. **Bug found while designing this, not yet exercised since Entra remains disabled**: the existing `provision_admitted_institutional_user` trigger, once `institutional_auth_config.enabled = true`, unconditionally rejects *any* non-`azure` signup — including a legitimate guardian magic-link — before `provision_admitted_guardian` ever runs. This package must ship a small fix (`create or replace function`, a new migration per the append-only convention) so the institutional trigger defers to the guardian trigger for non-`azure` providers instead of rejecting them itself. Worth recording precisely because it was found by reasoning through the admission design, not by running anything — this is exactly the class of bug this project's live-verification discipline exists to catch, caught early for once.

### Read access (new SECURITY DEFINER functions, not modified RLS policies)

Rather than widening the four existing `can_read_*` policy functions (calendar events, announcements, assignments, quizzes) to add a guardian branch, this package adds three narrow, self-contained `SECURITY DEFINER` RPCs that a guardian's browser client calls directly:

- `guardian_view_calendar(target_pupil_id)` — deadlines + events the pupil would see, re-deriving tag membership via the pupil's own id (`has_tag_membership`'s existing optional `target_id` parameter already supports this).
- `guardian_view_announcements(target_pupil_id)` — same shape, for announcements.
- `guardian_view_grades(target_pupil_id)` — the pupil's graded assignment submissions (title, grade, feedback, graded date). No new "release" gate to build: confirmed in `grade_assignment_submission` that a grade is already visible to the student the instant a teacher enters it, so "parent sees released grades" is just extending that same existing authorization to a verified-linked guardian, not new gating logic.

Each function's first action is an explicit `exists (select 1 from guardian_links where guardian_profile_id = auth.uid() and pupil_id = target_pupil_id and revoked_at is null)` check, raising `42501` if absent. This keeps the entire guardian read surface additive — zero edits to the tested RLS policies every other role already depends on, and a guardian never gets a raw RLS grant on `calendar_events`/`announcements`/`assignments` at all.

`revoke_guardian_link(target_link_id)` (`institution_admin`-only) sets `revoked_at`; a revoked guardian's next call to any `guardian_view_*` function fails closed immediately, no session invalidation needed since the check runs per-call.

### UI surface

- Admin: a "Link a guardian" form next to `/admin`'s existing `CreateTagForm`, and a revoke action added to `AdminRoster`'s existing per-user expandable controls (same place role/tag grants already live).
- Guardian: one `/parent` page — a pupil switcher if linked to more than one child, and three simple lists (deadlines, announcements, grades) for the selected pupil, reusing the visual patterns already established for `/calendar`, `/announcements`, and the gradebook.

## Consequences

This is the first admission path in the project that is genuinely new (not a variant of an existing pattern) and the first read surface built as isolated SECURITY DEFINER functions rather than RLS-gated table access — a deliberate containment choice given how sensitive this data category is, not a stylistic one. Tests must cover: an unauthorized email rejected outright at signup, a guardian seeing exactly one pupil's data (never another's, never teacher-only or safeguarding-flagged data — none of which exists yet, but the isolation should hold structurally), a revoked link failing closed immediately, and the institutional-trigger fix not regressing existing Entra-path tests.

Two things remain explicitly outside this package's scope and must not be treated as resolved by it: a **DPIA and named privacy/safeguarding sign-off** before any real guardian data is processed in production (same pre-launch-gate treatment as the Entra tenant), and a **real verification policy** for what evidence an admin should require before attesting a guardian-pupil relationship — today that attestation is trusted and audited but not independently checked, acceptable for building and testing, not a substitute for a school-defined policy before go-live.
