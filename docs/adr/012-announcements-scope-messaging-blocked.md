# ADR-012: Announcements Scope; Threaded Messaging Blocked on a Safeguarding Owner

Status: Accepted (Announcements) / Blocked (Messaging)
Date: 2026-08-07

## Context

Phase 5D of the collaboration plan bundles "Calendar, Announcements, and Messaging" into one contract. ADR-011 already split calendar out on its own. This ADR does the same split between the two remaining halves, because they have genuinely different risk profiles:

- **Announcements**: staff/admin post a one-way broadcast to a tag audience (or the whole school). Recipients read; they cannot reply, and there is no channel between recipients at all. The only people who can ever post are already teacher/manager-tier tag holders or `institution_admin` — the same trust boundary every other content type in this project already relies on (pages, assignments, quizzes, calendar events).
- **Messaging**: threaded, bidirectional communication — potentially student-to-student or student-to-staff. This opens a real safeguarding surface (harassment, grooming, unsafe disclosure) that announcements structurally cannot, because announcements have no reply path for anyone to abuse.

The plan itself already names this distinction implicitly: `C1-05` ("Define and implement safeguarding report/escalation boundary with named school stakeholders") is explicitly owned by "Human safeguarding owner with Codex support," not by an engineering agent alone, and PM-04's threat model states plainly: *"Project M must not become a general safeguarding or medical-record system. Any such workflow requires separate human policy, data model, access, incident, and retention approval."* Asked directly, the product owner confirmed the same split rather than asking an AI agent to invent a safeguarding policy for a school application involving minors.

## Decision

**Announcements are in scope now**, built the same "smallest correct thing" way as every other package:

- A one-way broadcast: `title` + plain-text `body` (bounded length, no rich text, no attachments — same minimalism precedent as calendar event descriptions), authored by a teacher/manager-tier tag holder (audience-scoped, all-tags-owned via the existing `assert_can_assign_tags`) or an `institution_admin` (whole-school broadcast, same `is_broadcast` pattern Package Q already established for calendar events).
- No reply, no thread, no per-recipient state. **No read/unread tracking in v1** — an authorized list, newest first, matching the precedent already set for assignments/quizzes/calendar's "smallest correct thing" scope.
- Surfaces as a dedicated `/announcements` list page, the same pattern as `/assignments`, `/quizzes`, and `/calendar`. The dashboard's notification bell remains the placeholder it already is (per Package C's notes) — wiring it to real data is separate, later work, not bundled into this package.
- No rate limiting: posting is already restricted to pre-vetted staff/admin roles, the same trust level every other write in this system requires. Rate limits matter for open messaging surfaces where many users can post to each other; they are not a meaningful control here and would be defending against a threat model announcements do not have.
- No moderation/reporting machinery: since there is no reply path, there is nothing for a recipient to report *back through the system* — the abuse surface PM-04 names for messaging (harassment via reply, unsafe disclosure via reply) does not exist for a channel with no reply.

**Threaded/bidirectional messaging is explicitly BLOCKED**, not scoped, not designed, not given a data model — pending a real, named human safeguarding owner at the school, exactly as the collaboration plan's own `C1-05` line item requires. This project will not invent a moderation policy, an escalation destination, or a definition of reportable content on its own. This blocker is recorded the same way the Entra tenant configuration is recorded elsewhere in this project (ADR-002, "Accepted with factual inputs pending") — a known, named gap, not a silently skipped requirement.

## Consequences

Announcements reuse every audited-mutation and RLS pattern already proven across this project — no new authorization shape beyond what Package Q's `is_broadcast` flag already introduced. Tests must cover: tag-scoped vs. broadcast create authorization (mirroring `012_calendar.sql` almost exactly), read visibility across tag-membership tiers, and that a non-teacher/non-admin cannot post.

Messaging stays a named, tracked gap. Before it can be scoped: a real safeguarding owner must be identified at the school, and that person (not this project's engineering agents) must define what content is reportable, where reports go, what retention applies to flagged content, and what the escalation workflow looks like. Until then, no `messages`/`threads` table, RPC, or UI should be built — doing so without that policy in place would be building a safety-critical feature on top of a policy nobody has actually approved.
