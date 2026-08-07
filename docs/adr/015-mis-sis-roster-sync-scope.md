# ADR-015: MIS/SIS Roster Sync Scope

Status: Accepted
Date: 2026-08-07

## Context

PM-01 named MIS/SIS synchronization as Launch scope. ADR-009 already fixed its required properties (idempotent, dry-runnable, reconciled, observable, reversible) and PM-03/PM-04 already established supporting policy (new institutional users default to `student`; promotion and tag assignment are admin/MIS-controlled; a sync must never silently delete users, memberships, grades, or content). None of that has been built.

This environment has no real MIS/SIS system, credentials, or API to integrate against - `PACKAGE-B-PREFLIGHT.md` deliberately deferred adding MIS/SIS credentials until "their packages own a concrete connector contract." That constraint splits this work in two:

1. **A reconciliation engine** - parsing a roster snapshot, diffing it against current state, and applying the diff idempotently. This needs no external credentials at all; it operates on an uploaded file. Fully buildable and testable now.
2. **A live connector** - polling or receiving webhooks from a real MIS API. Genuinely cannot be built or tested without a real system to point at. Out of scope for this ADR; deferred until a real MIS is available, at which point it becomes a thin adapter that produces the same roster-snapshot shape the engine (1) already consumes.

This ADR scopes (1) only, and treats it as real, useful, shippable work in its own right - a school admin can already export a CSV roster from virtually any MIS today, so a file-upload sync is not a placeholder for the real feature, it is a legitimate first version of it.

## Decision

### Input shape

A roster snapshot is a CSV, parsed client-side (not in the database) into `{ email, kind: 'student' | 'teacher', memberships: [{ tagName, role: 'member' | 'teacher' | 'manager' }] }[]`. No display-name field - `profiles` has no name column anywhere in this schema today (email is the only identifying string persisted, matching how every existing admin/roster UI already shows people by email); adding one is a separate, unrelated schema change, not something this sync should introduce as a side effect. No MIS-specific `external_id` field either - this project has no real MIS to define one against, and every other admission path here already keys on email (Entra domain validation, `profiles.email` uniqueness, guardian linking). Inventing either now would be guessing at shape before it's needed; add when a real connector or a real name requirement shows up.

### Authorization and blast-radius limits

`institution_admin` only, matching every other bulk/admin-tier operation in this project. **The sync can never grant `institution_admin`** - `kind` is restricted to `student`/`teacher`; promoting someone to institution_admin stays a deliberate, individually-attested action through the existing `assign_system_role` RPC. Row count is capped (5,000) to bound worst-case work per call, comfortably above this project's stated 800-2,500 user scale (PM-02) even counting historical staff.

### Reconciliation semantics (the ADR-009 properties, made concrete)

- **Additive for roles**: if a roster row's `kind` isn't already an active role for that person, it's granted. A role the sync didn't mention is never revoked by the sync - role reduction stays a deliberate admin action, not a side effect of a CSV upload. (Matches "never silently deletes access.")
- **Reconciled for tag memberships**: `tag_memberships.source` already exists and is used to mark sync-owned rows (`mis_sync:<run_id>`). A membership the sync previously granted that's no longer in the new snapshot is closed (`valid_until = now()`, not deleted). A membership with any other source (`admin`, manual grants) is **never** touched by the sync, regardless of what the roster says - this is the boundary that keeps manual overrides safe from being silently clobbered by the next sync run.
- **Leavers are disabled, not deleted**: per explicit product decision, a person previously provisioned by a sync run who no longer appears in any snapshot has `profiles.state` set to `disabled` (existing mechanism - no schema change, no data loss, reversible by re-appearing in a future roster). This only ever applies to accounts the sync itself provisioned or manages (tracked the same way as memberships, via the `mis_sync:` provenance marker) - an account a sync never touched can never be disabled by one.
- **Idempotent**: running the identical snapshot twice produces an empty diff the second time, because every write is "only if it differs from current state," not "always overwrite."
- **Dry-runnable**: `sync_roster(rows, dry_run boolean default true)` computes and returns the full diff (creates, membership grants/closes, disables, queued intents, per-row validation errors) without writing anything when `dry_run = true`. The admin reviews the report, then re-calls with `dry_run = false` to apply the identical diff.
- **Observable**: every apply run writes one `audit_events` row summarizing the diff actually applied.
- **Partial-success reporting, not all-or-nothing**: a row referencing a tag that doesn't exist is reported as a per-row error and skipped, not a reason to fail the whole upload - matches "observable" better than an opaque bulk failure would, and tags are never auto-created by the sync (a nonexistent tag is exactly the kind of thing an admin should see and fix, not have silently invented).

### Not-yet-logged-in people

`profiles.id` is FK'd to `auth.users.id` - a profile cannot exist before someone has a real account. For a roster row naming someone who has never signed in, the diff is staged in a new `mis_roster_intents` table (email, kind, memberships jsonb, sync_run_id) rather than applied immediately. A new `apply_mis_roster_intents` trigger on `auth.users` (same shape as Package S's `provision_admitted_guardian`) applies any pending intent for that email the moment they first sign in - identical precedent to how `guardian_links` stages an admin-attested grant before the guardian's first login. `provision_admitted_institutional_user`'s own profile insert gains `on conflict (id) do nothing` so the two triggers can never race into a duplicate-key error regardless of firing order, whenever Entra is eventually enabled.

### UI

A "Roster sync" panel on `/admin`: upload a CSV, see client-side parse errors immediately, dry-run and review the diff, then apply. No scheduling, no automatic/recurring sync, no email-notification-of-changes - all deliberately out of scope for a first version with no real MIS to schedule against.

## Consequences

This ships a genuinely useful, if manual, MIS/SIS sync capability without needing any external credentials, while leaving the live-connector half honestly unbuilt rather than faked. Tests must cover: role grants are additive-only (a role never mentioned again is never revoked), tag memberships with a non-sync source are never touched, re-running an identical snapshot is a true no-op, a leaver is disabled only if the sync previously provisioned them, dry-run never writes, and a nonexistent-tag row is reported as an error without failing the rest of the batch.
