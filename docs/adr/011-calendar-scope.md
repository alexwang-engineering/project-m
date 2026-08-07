# ADR-011: Calendar Scope (Launch Slice)

Status: Accepted
Date: 2026-08-07

## Context

Phase 5D of the collaboration plan originally bundled calendar together with announcements, messaging, and a safeguarding escalation boundary (`C1-01`..`C1-07`) into one contract requiring a human safeguarding owner. Following the same "smallest correct thing" narrowing already applied to assignments (ADR-008 addendum) and quizzes, the product owner was asked directly to scope calendar on its own, split cleanly from messaging/announcements, which remain out of scope for this package and still require the safeguarding review Phase 5D calls for.

## Decision

Launch calendar is two aggregated views, not a new authoring surface for most of its content:

1. **Deadline aggregation (read-only, free)**: existing `assignments.due_at` and `quizzes.due_at` rows, already tag-scoped and already RLS-authorized via `can_read_assignment`/quiz read policy, surfaced as a single chronological upcoming list. No new table, no new RPC — a query composing two existing sources.
2. **Standalone calendar events (new)**: a `calendar_events` table for things with no other home — trips, parents' evenings, exam periods, INSET days. `title`, `description`, `starts_at`, `ends_at`, `created_by`, standard audit trail. Audience is either one or more tags (any-tag-read, matching `can_read_page`/`can_read_assignment`) **or** a whole-school broadcast flag, gated `institution_admin`-only — the same authorization tier as tag creation (ADR-003 precedent for admin-only operations), not a new tier. Managing a tag-scoped event requires teacher/manager on every selected tag, matching `create_assignment`'s existing pattern exactly.

Explicitly deferred to later, separate work (not blocking launch):

- **Recurrence.** No RRULE, no timezone-aware recurrence expansion, no exception handling. A recurring event is entered as N separate one-off rows. Revisit if teachers report this is a real friction point in the pilot.
- **Announcements and messaging.** Stay in Phase 5D's original scope, gated on a human safeguarding owner per the collaboration plan — not part of this ADR.
- **Full month/week/day calendar grid UI.** Launch UI is a simple upcoming-list view (same visual pattern as `/assignments` and `/quizzes`), directly satisfying PM-02's student journey #3 ("view deadlines and calendar items") without the added layout complexity of a real date grid. A grid view can be layered on top of the same data later without a schema change.

## Consequences

`calendar_events` reuses every pattern already proven for assignments: audited `SECURITY DEFINER` mutation functions, all-tag-required writes, any-tag reads, an `audit_events` row per create/update/cancel. The one genuinely new authorization shape is the whole-school broadcast flag — it must be checked explicitly wherever event audience is evaluated (read policy and any future notification fan-out), not left as an implicit "no tags means everyone" default, since that would be easy to hit by accident with an empty tag array. Tests must cover: tag-scoped read/write exactly like assignments, broadcast events visible to all authenticated users regardless of tag membership, and a non-admin attempting to set the broadcast flag being rejected.
