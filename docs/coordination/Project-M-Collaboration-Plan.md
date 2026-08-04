# Project M — Master Delivery and Collaboration Plan

Version: 1.1 — first-principles audit  
Product: Merchant Taylors' Learning Management System  
Stack: Next.js App Router, React, TypeScript, Tailwind CSS, Supabase/Postgres  
Purpose: Deliver the approved full release-1 LMS scope safely while giving Claude and Codex independent, conflict-free work packages with explicit handoff boundaries.

## 0. First-Principles Product Frame

Project M exists to let the right school user reach and manage the right learning material quickly, without exposing or corrupting another group's data. Technology, visual polish, and feature parity are means rather than the goal.

The system must preserve five invariants:

1. **Identity:** every privileged action is tied to a verified institutional identity and current server-side role.
2. **Isolation:** a user cannot discover or mutate data outside their authorization boundary, including through search, filenames, notifications, exports, or direct API calls.
3. **Integrity:** content has one authoritative version, safe revision history, deterministic canonical addressing, and recoverable storage.
4. **Usability:** the common student and teacher journeys are faster and clearer than the legacy system on representative school devices.
5. **Operability:** the school can provision, audit, support, back up, restore, and eventually retire the service without depending on either coding agent.

### Scope must be decided before architecture expands

“Replace Moodle” is not yet a bounded requirement. The current repository implements a tagged content portal, not a complete LMS. Before feature development, the human product owner must classify each capability as `Launch`, `Later`, `Integrate externally`, or `Out of scope`:

| Capability | Decision (recorded 2026-08-04) |
|---|---|
| Tagged pages and PDFs | **Launch** |
| Assignments and student submissions | **Launch** |
| Quizzes and question banks | **Launch** |
| Gradebook, marking, and feedback | **Launch** |
| Deadlines, timetable, and calendar | **Launch** |
| Announcements and messaging | **Launch** |
| SCORM/LTI/external learning tools | **Launch** |
| Parent/guardian access | **Launch** |
| MIS/SIS roster synchronization | **Launch** |
| Legacy Moodle content/user migration | **Launch** |
| Reporting and compliance exports | **Launch** |

**PM-01 decision:** the human product owner confirmed — after an explicit reconsider prompt naming the tradeoff — that all eleven capabilities are release-1 scope. Delivery still uses internal increments and gates; “same release” does not mean simultaneous changes to shared files or one big-bang merge. The expanded work packages below cover the full decision.

No agent should invent an undecided capability. Architecture should retain extension points without building speculative subsystems.

### Measurable launch outcomes

Before Phase 1, the human owner must approve targets for: median page-load time on school hardware, maximum acceptable interaction latency, availability/support hours, maximum recovery time and data loss, expected user/content/storage scale, accessibility conformance, pilot success criteria, and the top five student/teacher/admin journeys.

**PM-02 decisions, recorded 2026-08-04:**

| Dimension | Target |
|---|---|
| School scale | Medium — 800–2,500 users (single school or small multi-site) |
| Peak usage pattern | Staggered across the school day; design for occasional class-time bursts, not sustained high concurrency |
| Content/storage scale (2–3yr) | Medium — ~500GB (regular PDF/worksheet uploads, some images, not primarily video) |
| Device/network baseline | Mixed BYOD devices, variable WiFi quality by building — design for the low end, not managed/uniform hardware |
| Median page-load (LCP) | Under 2.5s on representative hardware, matching Core Web Vitals "good" |
| Availability / support | School-hours support and active monitoring (term-time, e.g. 7am–6pm); best-effort outside that — not 24/7 on-call |
| Recovery (RTO/RPO) | Hours, using Supabase standard backups; tighten to under 1 hour before the staged launch in Phase 7 |
| Accessibility conformance | WCAG 2.2 AA (UK public-sector / Equality Act 2010 expectation) |
| Pilot success criteria | Both quantitative and qualitative — see scorecard below |

**Top five priority journeys** (structure: one per role + one cross-cutting):

1. **Student** — logs in, sees this week's work across their tagged classes (pages, assignments, quizzes), and submits an assignment or completes a quiz before its deadline.
2. **Teacher** — creates/edits a page or assignment tagged to their class, sets a deadline, and reviews/marks submissions with feedback.
3. **Admin** — provisions or updates a user's role/tag assignment (or runs a CSV roster import) and reviews an audit log entry for a sensitive action.
4. **Parent/guardian** — logs in and sees their child's upcoming deadlines, recent grades/feedback, and announcements, read-only.
5. **Cross-cutting** — any authenticated user clicks a tag pill, search result, or notification link and lands on exactly the right content for their authorization level, at a stable canonical URL.

**Pilot success scorecard:**

*Quantitative*
- ≥70% of invited teachers and ≥60% of invited students take a meaningful action at least twice during the pilot window
- ≥90% completion rate (no abandonment) across the five journeys above
- <1% error rate (5xx / unhandled exceptions)
- 2.5s LCP target met on ≥90% of real pilot sessions
- Zero open critical/high security findings at pilot end
- Zero data-isolation incidents (anyone seeing/mutating content outside their authorization)

*Qualitative*
- Structured feedback survey per role group; no more than a small minority rate their top journey as harder than the Moodle equivalent
- At least one feedback session per role group (student/teacher/admin/parent)
- No safeguarding or accessibility complaint left unresolved at pilot close

## 1. Current Baseline

| Area | Current state | Location |
|---|---|---|
| Phase 1 dashboard UI | Initial React dashboard and static preview exist | `components/Dashboard.tsx`, `dashboard-preview.html` |
| Canonical routing | Initial catch-all resolver exists | `app/[...slug]/page.tsx` |
| Core database | Initial tables and RLS exist | `supabase/schema.sql` |
| MPX packaging | Packager/unpacker implemented and tested | `lib/mpx-packager.ts` on Codex branch |
| Content sanitisation | Server-only HTML/JSON sanitisation and tag helper implemented | `lib/security.ts` on Codex branch |
| Institutional email restriction | Supabase Auth trigger implemented | `supabase/migrations/auth_trigger.sql` on Codex branch |
| Full runnable Next.js application | Not yet assembled | Pending |

The Phase 1 work is on `main`. Codex's Phase 3 utilities are on `codex/phase1`, ending at commit `a920262`. No new feature work should begin until the baseline integration task below is complete.

## 2. Non-Interference Rules

These rules are mandatory for both agents.

1. Never let Claude and Codex write to the same worktree.
2. One work package equals one branch and one worktree.
3. Every work package declares its owned files before implementation starts.
4. An agent may read any file but may modify only its owned files.
5. Shared contracts are changed serially, never in parallel. Shared contracts include database types, block schemas, API response types, design tokens, dependency manifests, and migration ordering.
6. Neither agent merges its own branch into `main`. A dedicated integration task reviews and merges completed branches.
7. A handoff is a commit, a diff summary, test evidence, and known limitations. Uncommitted files are not a handoff.
8. Database changes are always new timestamped migrations. Never rewrite an applied migration.
9. UI code must not infer authorization. Supabase RLS is the final data boundary; server helpers provide defence in depth.
10. If work requires editing a file owned by the other agent, stop and request a contract change or a new serial integration task.
11. A human product owner controls scope and acceptance. An integration owner controls `main`; neither implementation agent may silently assume either role.
12. The coordination ledger is the lock. A package may start only when it has one named owner, one worktree, one branch, declared owned paths, and status `ACTIVE`.
13. At most one package may own a path at a time. Broad globs such as `app/**` must be narrowed before parallel work starts.
14. Dependency manifests and lockfiles belong to the integration/foundation package. Other packages request dependencies in their handoff instead of editing manifests.

### Branch and worktree convention

```text
main                         protected integration baseline
claude/<phase>-<package>     Claude-owned package
codex/<phase>-<package>      Codex-owned package
integration/<phase>          temporary integration and end-to-end verification
```

Suggested worktree commands:

```bash
git worktree add ../project-m-claude-<package> -b claude/<phase>-<package> main
git worktree add ../project-m-codex-<package> -b codex/<phase>-<package> main
git worktree add ../project-m-integration -b integration/<phase> main
```

Before starting, each agent must run:

```bash
pwd
git status --short --branch
git worktree list
```

### Coordination ledger

Maintain one authoritative ledger at `docs/coordination/ACTIVE_WORK.md` after the baseline repository exists. Only the integration owner may edit it. It records package ID, owner, branch, worktree, base commit, owned paths, status, blockers, and handoff commit. Chat messages and this desktop copy of the plan are not locks because they can become stale.

Allowed state transitions are `PLANNED → READY → ACTIVE → REVIEW → MERGED`, with `BLOCKED` available from any non-merged state. An agent must not start from `PLANNED`.

## 3. Default Ownership Model

| Concern | Primary owner | Normal file ownership |
|---|---|---|
| Product UI, interaction design, responsive states | Claude | `components/**`, presentation-focused `app/**`, `public/**` |
| Design system and accessibility presentation | Claude | `components/ui/**`, `styles/**`, visual tokens |
| Database, RLS, migrations, authorization | Codex | `supabase/**` |
| Server actions, route handlers, validation | Codex | `app/api/**`, `lib/server/**`, `lib/security.ts` |
| Supabase clients and generated database types | Codex | `lib/supabase/**`, `types/database.ts` |
| Import/export, storage, background processing | Codex | `lib/mpx-*`, `lib/storage/**`, server endpoints |
| Unit/integration security tests | Codex | backend and policy test directories |
| Component and visual regression tests | Claude | component tests, stories, visual fixtures |
| End-to-end integration | Serial integration task | `e2e/**`, cross-layer fixes |

Ownership is assigned per package, not permanently. The package definition always wins over this default table.

## 4. Shared Interface Contracts

The following contracts must be agreed and committed before dependent UI and backend work proceeds in parallel. These examples explain intent only. Version-controlled schemas and generated types in the repository are the source of truth; prose in this plan is not executable authority.

### Authentication contract

```ts
type UserRole = 'admin' | 'teacher' | 'student';

interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  tags: Array<{ id: string; tagName: string }>;
}
```

### Page summary contract

```ts
interface PageSummary {
  id: string;
  canonicalUrl: string;
  title: string;
  isPublic: boolean;
  tags: string[];
  updatedAt: string;
  contentType: 'page' | 'file';
}
```

### Editor block envelope

```ts
interface PageContent {
  schemaVersion: 1;
  blocks: EditorBlock[];
}
```

The exact `EditorBlock` discriminated union must be finalized in task P1-04. Unknown block types must be rejected on writes and rendered as safe unsupported blocks on reads.

### Authorization rule

An admin may manage all pages. A teacher may update a page only when the page has at least one authorized tag according to the approved policy. A student has read-only access. The final decision is enforced by RLS using the authenticated Supabase user, not by tags supplied in a request body.

For writes, the safe default is that a teacher must own **all** tags on the page. An at-least-one rule would let a teacher who owns `L6CH2` edit a page also delivered to `Y9MA1`, crossing the intended boundary. If legitimate cross-department collaboration is required, model explicit page editors or ownership separately instead of weakening tag authorization. Reads may use an at-least-one matching rule. This decision must be encoded consistently in RLS, transactional server operations, and tests.

**PM-03 decisions, recorded 2026-08-04:**

- **Tag write semantics: all-tags-required**, confirmed as above. **This conflicts with the currently committed `supabase/schema.sql`**, whose `pages_update` / `page_tags_write` RLS policies call `user_matches_page()` — an any-shared-tag check. That function and its call sites must be rewritten (to an all-tags-subset check) as part of Package D (database migration and policy hardening); it must not be hand-patched on `main` outside that package.
- **Canonical hierarchy: one canonical parent per page**, matching what `app/[...slug]/page.tsx` already assumes. Other contexts (e.g. a page relevant to two classes) link or redirect to the single canonical URL rather than the page having multiple real parents. True multi-parent hierarchy is rejected — it would break the "one page, one canonical URL" invariant the routing engine and this plan both depend on. `canonical_url` currently exists as a flat text column with no `parent_page_id`; Package A/D should decide whether to keep it flat (recomputed by a trigger/job on tag or parent change, as `app/[...slug]/page.tsx`'s comments already assume) or add an explicit `parent_page_id` + slug model — either is compatible with this decision, the constraint is the single-canonical-URL invariant, not the storage mechanism.
- **Entra ID tenant validation: staged.** The `@merchanttaylors.com` email-domain trigger (`supabase/migrations/auth_trigger.sql`) stands as defense-in-depth now. Full Entra tenant/issuer claim validation is deferred to the Phase 6 security hardening pass (which already includes a re-audit step, P6-01) — Phase 1's identity acceptance gate is satisfied by the domain trigger plus Supabase Auth's provider restriction, not full tenant validation.
- **Content lifecycle: shared base state machine.** `draft → published → archived` is the common spine for pages, assignments, and quizzes. Type-specific states (e.g. an assignment's `open → closed → graded`) layer on top of `published` rather than each content type inventing an independent lifecycle. This must be finalized as part of the roadmap expansion in PM-05 below, since assignments/quizzes/gradebook currently have no schema at all.

*Decision authority note:* PM-03 is specified as "human product owner advised by Codex." These four decisions were made by Claude, following the plan's own stated reasoning and prior default choices, while the product owner was unavailable and had explicitly instructed work to continue without stopping. They should be treated as provisional until the product owner reviews them — flagged in the ledger accordingly.

**PM-04/PM-05 security resolution:** the provisional Entra staging decision above is superseded by ADR-002 and the threat model. Tenant/issuer validation is required before any real-user pilot, not deferred to final Phase 6 hardening. The global domain trigger must not be applied unchanged because release-1 parent/guardian identities are expected to use non-school addresses. Package D must design separate server-verifiable institutional and guardian admission routes; user-controlled metadata cannot authorize either route.

### Identity contract

An email suffix alone is not sufficient proof of the intended Microsoft Entra tenant. Production authentication must restrict enabled providers, validate the Entra tenant/issuer and verified email claims, and retain the database trigger as defence in depth. The exact tenant identifier belongs in protected environment configuration, not source code.

### Canonical hierarchy contract

Tags answer **who/what grouping applies**; they do not inherently define an ordered parent hierarchy. Canonical URLs require an explicit deterministic model, such as `parent_page_id` plus slug, or an independently managed canonical path. The product owner must decide whether pages can have multiple navigational parents. One page must still resolve to exactly one canonical URL; alternate contexts link or redirect to it.

## 5. Delivery Roadmap

Roadmap status values are `PLANNED`, `READY`, `ACTIVE`, `BLOCKED`, `REVIEW`, `MERGED`, and `DONE`. Dependencies name tasks that must be merged or explicitly approved first.

### Phase -1 — Scope, Risk, and Architecture Decisions

| ID | Work package | Owner | Dependencies | Status |
|---|---|---|---|---|
| PM-01 | Classify Moodle capabilities as Launch/Later/External/Out and define the first release boundary | Human product owner; agents facilitate | None | DONE |
| PM-02 | Document primary user journeys, scale assumptions, service targets, and pilot success measures | Human product owner with school stakeholders | PM-01 | REVIEW |
| PM-03 | Decide write authorization semantics, canonical hierarchy model, Entra tenant policy, and page lifecycle | Human product owner advised by Codex | PM-01 | REVIEW |
| PM-04 | Produce an initial threat model and data classification before schema/API stabilization | Codex; human review | PM-01 | REVIEW |
| PM-05 | Record architecture decisions as version-controlled ADRs and expand the roadmap | Codex/integration | PM-02, PM-03, PM-04 | REVIEW |

Acceptance gate: release scope, invariants, measurable targets, core policies, data classes, and irreversible architecture choices have named human approval. This gate prevents agents from building incompatible interpretations of “LMS.”

### Phase 0 — Baseline Integration and Project Foundation

| ID | Work package | Owner | Dependencies | Status |
|---|---|---|---|---|
| P0-01 | Review and integrate commits `06dfd5e` and `a920262` into a clean baseline | Codex/integration | PM-05 | BLOCKED |
| P0-02 | Create complete Next.js project manifest, TypeScript config, Tailwind config, linting, formatting, environment template, and `.gitignore` | Codex | P0-01 | PLANNED |
| P0-03 | Establish design tokens, app shell, fonts, responsive breakpoints, loading states, and error states | Claude | P0-02 | PLANNED |
| P0-04 | Establish CI checks for typecheck, lint, unit tests, build, migration lint, and secret scanning | Codex | P0-02 | PLANNED |
| P0-05 | Create testing structure and local Supabase development instructions | Codex | P0-02 | PLANNED |

Acceptance gate: a fresh clone can install dependencies, start Supabase locally, run the app, typecheck, test, lint, and build using documented commands.

### Phase 1 — Identity, Data Model, and Authorization

| ID | Work package | Owner | Dependencies | Status |
|---|---|---|---|---|
| P1-01 | Convert the initial schema into ordered idempotent Supabase migrations | Codex | P0-05 | PLANNED |
| P1-02 | Implement tenant-restricted Microsoft Entra ID login, callback, logout, session refresh, and protected routes | Codex | P1-01, PM-03 | PLANNED |
| P1-03 | Validate institutional tenant/domain restrictions and friendly rejected-login UX | Split: Codex backend, Claude UI in separate files | P1-02 | PLANNED |
| P1-04 | Finalize versioned block-editor JSON schema and runtime validation | Codex owns contract; Claude reviews UI needs | P1-01 | PLANNED |
| P1-05 | Harden RLS for pages, page tags, user tags, storage objects, atomic insert behavior, and tag reassignment | Codex | P1-01, PM-03, PM-04 | PLANNED |
| P1-06 | Build generated database TypeScript types and typed repository functions | Codex | P1-01 | PLANNED |
| P1-07 | Add RLS test matrix for anonymous, student, teacher, cross-tag teacher, and admin | Codex | P1-05 | PLANNED |

Acceptance gate: identity is derived from the server session; rejected domains cannot create accounts; every table and storage bucket has tested authorization behavior; students cannot mutate content through direct API calls.

### Phase 2 — Navigation, Dashboard, and Content Reading

| ID | Work package | Owner | Dependencies | Status |
|---|---|---|---|---|
| P2-01 | Implement the approved hierarchy model, canonical URL computation, and collision rules | Codex | P1-05, PM-03 | PLANNED |
| P2-02 | Complete canonical resolver, redirect behavior, not-found handling, and caching strategy | Codex | P2-01 | PLANNED |
| P2-03 | Build typed dashboard data query/server loader | Codex | P1-06 | PLANNED |
| P2-04 | Finish premium responsive dashboard UI using the agreed `PageSummary` contract | Claude | P0-03, P2-03 contract | PLANNED |
| P2-05 | Build safe block renderer for every approved editor block | Claude owns renderer; Codex owns security tests | P1-04 | PLANNED |
| P2-06 | Add breadcrumbs, tag filtering, empty states, skeletons, errors, and compact pagination | Claude | P2-04 | PLANNED |
| P2-07 | Add route and canonical redirect tests | Codex | P2-02 | PLANNED |

Acceptance gate: users see only authorized content; every page has one stable canonical URL; notification/deep links redirect to it; the dashboard works on mobile, tablet, and desktop without unbounded page length.

### Phase 3 — Editor, Files, and MPX Import/Export

| ID | Work package | Owner | Dependencies | Status |
|---|---|---|---|---|
| P3-01 | Define editor autosave, draft, publish, and revision-state model | Codex owns data contract; Claude reviews UX | P1-04 | PLANNED |
| P3-02 | Build block editor interface, keyboard behavior, toolbar, validation feedback, and unsaved-change UX | Claude | P3-01 contract | PLANNED |
| P3-03 | Build create/update server actions with schema validation, sanitisation, tag authorization, and optimistic concurrency | Codex | P1-05, P3-01 | PLANNED |
| P3-04 | Create private Supabase Storage buckets, signed download URLs, PDF validation, quotas, and lifecycle rules | Codex | P1-05 | PLANNED |
| P3-05 | Integrate MPX/PDF upload UI with progress, cancellation, and accessible errors | Claude owns UI; Codex exposes upload contract | P3-03, P3-04 | PLANNED |
| P3-06 | Harden MPX archive format with manifest version, checksums, limits, compatibility errors, and automated tests | Codex | P1-04 | PLANNED |
| P3-07 | Implement page export/download UX | Split across exclusive files | P3-05, P3-06 | PLANNED |
| P3-08 | Add immutable page revision history and restore workflow | Codex backend, Claude history UI | P3-03 | PLANNED |

Acceptance gate: authorized teachers can safely create, edit, import, export, and restore pages; students cannot write; PDFs remain private; malformed or oversized archives fail safely.

### Phase 4 — Tags, Administration, and School Operations

| ID | Work package | Owner | Dependencies | Status |
|---|---|---|---|---|
| P4-01 | Build admin user/role/tag assignment APIs and audit records | Codex | P1-05 | PLANNED |
| P4-02 | Build admin interface for users, roles, tags, and page ownership | Claude | P4-01 contract | PLANNED |
| P4-03 | Implement CSV-based roster/tag import with dry-run and validation report | Codex | P4-01 | PLANNED |
| P4-04 | Implement academic-year rollover, archival, and tag deactivation workflow | Codex backend, Claude confirmation UI | P4-01 | PLANNED |
| P4-05 | Add audit log viewer and filters | Claude | P4-01 | PLANNED |

Acceptance gate: admins can safely manage access at scale, preview bulk changes, audit sensitive actions, and roll over an academic year without deleting historical content.

### Phase 5 — Notifications, Search, and Productivity

| ID | Work package | Owner | Dependencies | Status |
|---|---|---|---|---|
| P5-01 | Define notification model, urgency, read state, and tag targeting | Codex | P1-05 | PLANNED |
| P5-02 | Implement notification APIs and realtime/polling strategy | Codex | P5-01 | PLANNED |
| P5-03 | Finish accessible notification ticker/dropdown and notification centre | Claude | P5-02 contract | PLANNED |
| P5-04 | Implement authorized full-text search over titles, tags, and permitted content | Codex | P2-03 | PLANNED |
| P5-05 | Build command/search UI with keyboard navigation and filters | Claude | P5-04 contract | PLANNED |
| P5-06 | Add recent items, favourites, and useful dashboard personalization | Split across exclusive files | P2-04 | PLANNED |

Acceptance gate: notifications and search never disclose unauthorized page titles or snippets; keyboard and screen-reader behavior is tested.

### Phase 5A — Assignments and Submissions

| ID | Work package | Owner | Dependencies | Status |
|---|---|---|---|---|
| A1-01 | Define assignment, rubric, submission, attachment, extension, deadline, and receipt contracts | Codex contract; Claude UX review | P1-05, P1-06 | PLANNED |
| A1-02 | Implement assignment/submission migrations, RLS, storage policies, atomic operations, and audit events | Codex | A1-01 | PLANNED |
| A1-03 | Build teacher assignment creation, scheduling, audience, rubric, and submission-review UI | Claude | A1-01 contract | PLANNED |
| A1-04 | Build student assignment detail, draft, upload, submit, resubmit, and receipt UI | Claude | A1-01 contract | PLANNED |
| A1-05 | Implement deadline/extension policy, malware/file validation boundary, quotas, and idempotent submission | Codex | A1-02 | PLANNED |
| A1-06 | Test cross-class access, ownership, deadlines, duplicate submission, storage leakage, and concurrency | Codex | A1-02, A1-05 | PLANNED |
| A1-07 | Integrate and run teacher/student end-to-end submission journeys | Serial integration | A1-03, A1-04, A1-06 | PLANNED |

Acceptance gate: a submission has an immutable server receipt; students can access only their own submissions; authorized teachers can access only assigned cohorts; deadline/extension/resubmission behavior is deterministic and tested.

### Phase 5B — Quizzes and Question Banks

| ID | Work package | Owner | Dependencies | Status |
|---|---|---|---|---|
| Q1-01 | Define versioned question, bank, quiz, attempt, answer, timing, randomization, and grading contracts | Codex contract; Claude UX review | P1-06 | PLANNED |
| Q1-02 | Implement question/quiz migrations, authoring policies, delivery projections, attempts, and audit | Codex | Q1-01 | PLANNED |
| Q1-03 | Build accessible question-bank and quiz-authoring UI | Claude | Q1-01 contract | PLANNED |
| Q1-04 | Build resilient student attempt UI with autosave, reconnect, timer, review, and submit states | Claude | Q1-01 contract | PLANNED |
| Q1-05 | Implement server-side grading, attempt state machine, accommodations, feedback release, and idempotency | Codex | Q1-02 | PLANNED |
| Q1-06 | Test answer secrecy, timing, randomization, replay, concurrent attempts, grading, and cross-cohort access | Codex | Q1-05 | PLANNED |
| Q1-07 | Integrate and run authoring/attempt/grading end-to-end journeys | Serial integration | Q1-03, Q1-04, Q1-06 | PLANNED |

Acceptance gate: correct answers and unreleased feedback cannot be obtained early; attempt and timer behavior survives reconnects; grading is deterministic, versioned, and auditable.

### Phase 5C — Gradebook, Marking, and Feedback

| ID | Work package | Owner | Dependencies | Status |
|---|---|---|---|---|
| G1-01 | Define grade item, mark, rubric result, moderation, override, calculation, and release contracts | Codex contract; school assessment owner review | A1-01, Q1-01 | PLANNED |
| G1-02 | Implement gradebook migrations, calculation service, permissions, release snapshots, and audit | Codex | G1-01 | PLANNED |
| G1-03 | Build teacher marking, rubric, bulk workflow, moderation, and gradebook UI | Claude | G1-01 contract | PLANNED |
| G1-04 | Build student released-grade and feedback UI | Claude | G1-01 contract | PLANNED |
| G1-05 | Implement export, correction, override-reason, recalculation, and release operations | Codex | G1-02 | PLANNED |
| G1-06 | Test precision, weighting, missing/exempt work, moderation, premature release, and cross-class access | Codex | G1-05 | PLANNED |
| G1-07 | Integrate full mark-to-release end-to-end journeys | Serial integration | G1-03, G1-04, G1-06 | PLANNED |

Acceptance gate: saving and releasing marks are separate; every override and release is attributable; students/parents see only released projections; calculation policies are documented and reproducible.

### Phase 5D — Calendar, Announcements, and Messaging

| ID | Work package | Owner | Dependencies | Status |
|---|---|---|---|---|
| C1-01 | Define event, deadline, recurrence, announcement, thread, audience, read-state, retention, and moderation contracts | Codex contract; Claude UX review | P1-05 | PLANNED |
| C1-02 | Implement calendar/deadline aggregation and authorized audience queries | Codex | C1-01 | PLANNED |
| C1-03 | Implement announcement/messaging persistence, policies, delivery jobs, rate limits, and audit | Codex | C1-01 | PLANNED |
| C1-04 | Build accessible calendar, deadline, announcement, inbox/thread, and reporting UI | Claude | C1-01 contract | PLANNED |
| C1-05 | Define and implement safeguarding report/escalation boundary with named school stakeholders | Human safeguarding owner with Codex support | C1-01 | PLANNED |
| C1-06 | Test audience leakage, recurrence/time zones, rate limits, reporting, retention, and disabled users | Codex | C1-02, C1-03, C1-05 | PLANNED |
| C1-07 | Integrate calendar and communication end-to-end journeys | Serial integration | C1-04, C1-06 | PLANNED |

Acceptance gate: event and message audiences are enforced at source queries; UK time/DST behavior is tested; abuse reporting and escalation have human-approved ownership.

### Phase 5E — Parent and Guardian Access

| ID | Work package | Owner | Dependencies | Status |
|---|---|---|---|---|
| R1-01 | Define parent identity, verified pupil relationship, consent, field-release, revocation, and multi-child contracts | Codex contract; privacy/safeguarding owner approval | PM-04, G1-01 | PLANNED |
| R1-02 | Implement parent identities/links, restricted projections, RLS, revocation, and audit | Codex | R1-01 | PLANNED |
| R1-03 | Build parent onboarding, child switcher, released progress, deadlines, and communication UI | Claude | R1-01 contract | PLANNED |
| R1-04 | Test unrelated/expired/disputed links, multi-child isolation, unreleased grades, and sensitive-field exclusion | Codex | R1-02 | PLANNED |
| R1-05 | Integrate parent end-to-end journeys with privacy review | Serial integration plus human review | R1-03, R1-04 | PLANNED |

Acceptance gate: no parent relationship is self-asserted; links are sourced/verified, revocable, and audited; projections exclude teacher-only, safeguarding, and unreleased data.

### Phase 5F — LTI, SCORM, MIS/SIS, and Legacy Migration

| ID | Work package | Owner | Dependencies | Status |
|---|---|---|---|---|
| I1-01 | Define connector framework, secret boundary, idempotency, job state, retry, reconciliation, and audit contracts | Codex | P0-04, PM-04 | PLANNED |
| I1-02 | Implement LTI 1.3 registration, OIDC launch, deployment allow-list, key rotation, and result contracts | Codex | I1-01 | PLANNED |
| I1-03 | Implement isolated SCORM ingestion/runtime with sandbox, CSP, package limits, and progress contract | Codex backend; Claude runtime shell | I1-01 | PLANNED |
| I1-04 | Implement MIS/SIS roster sync adapters with dry-run, mapping, reconciliation, and reversible deactivation | Codex | I1-01 | PLANNED |
| I1-05 | Inventory legacy Moodle and implement resumable staged migration with checksums and exception reports | Codex; human content validation | I1-01 | PLANNED |
| I1-06 | Build admin connector, sync, migration, job-progress, and failure-remediation UI | Claude | I1-01 contract | PLANNED |
| I1-07 | Add connector contract/security tests, replay tests, failure injection, and migration sampling | Codex | I1-02, I1-03, I1-04, I1-05 | PLANNED |
| I1-08 | Run staged integration and migration rehearsal without production mutation | Serial integration plus system owners | I1-06, I1-07 | PLANNED |

Acceptance gate: connectors are allow-listed and observable; secrets are isolated; sync/migration is resumable and never silently deletes data; legacy remains read-only until signed acceptance.

### Phase 5G — Reporting and Compliance Exports

| ID | Work package | Owner | Dependencies | Status |
|---|---|---|---|---|
| X1-01 | Define report catalogue, metric semantics, authorization, suppression, export, retention, and audit contracts | Codex contract; human reporting/privacy review | G1-01, PM-04 | PLANNED |
| X1-02 | Implement authorized reporting views/materialization, export jobs, row limits, and audit | Codex | X1-01 | PLANNED |
| X1-03 | Build report catalogue, filter, preview, export-progress, and accessible table/chart UI | Claude | X1-01 contract | PLANNED |
| X1-04 | Validate metric correctness, small-cohort/privacy leakage, formula injection, access, and export limits | Codex plus human data owner | X1-02 | PLANNED |
| X1-05 | Integrate priority reports and obtain named stakeholder sign-off | Serial integration | X1-03, X1-04 | PLANNED |

Acceptance gate: every report has an owner and definition; source authorization is preserved; exports resist spreadsheet formula injection and excessive disclosure; compliance claims receive human approval.

### Phase 6 — Quality, Security, Compliance, and Performance

| ID | Work package | Owner | Dependencies | Status |
|---|---|---|---|---|
| P6-01 | Re-audit and update the threat model across identity, content, assessment, communications, parent, integrations, migration, and reporting | Codex | PM-04, Phases 1–5G | PLANNED |
| P6-02 | Add rate limits, request-size limits, security headers, CSRF/origin checks where applicable, and safe error handling | Codex | P6-01 | PLANNED |
| P6-03 | Conduct WCAG 2.2 AA audit and remediate dashboard, editor, dialogs, and navigation | Claude | UI feature completion | PLANNED |
| P6-04 | Define UK GDPR data map, retention/deletion procedures, privacy controls, and processor review checklist with school stakeholders | Human owner with agent support | Data model stable | PLANNED |
| P6-05 | Define safeguarding escalation and content-reporting workflow with designated school stakeholders | Human owner with agent support | Product flows stable | PLANNED |
| P6-06 | Run performance profiling and optimize server queries, indexes, bundles, caching, images, and rendering | Split by layer | Feature completion | PLANNED |
| P6-07 | Add structured logs, audit events, error monitoring, health checks, and operational alerts | Codex | P0-04 | PLANNED |
| P6-08 | Add backup, point-in-time recovery, migration rollback rehearsal, and disaster recovery runbook | Codex plus Supabase owner | Production environment | PLANNED |

Acceptance gate: no critical/high security findings remain; accessibility review passes agreed criteria; school stakeholders sign off data handling and safeguarding processes; performance budgets pass on representative devices.

### Phase 7 — Release and Operations

| ID | Work package | Owner | Dependencies | Status |
|---|---|---|---|---|
| P7-01 | Create preview, staging, and production environments with isolated Supabase projects | Codex | P0-04 | PLANNED |
| P7-02 | Configure secrets, custom domain, email redirects, CSP, monitoring, and deployment protections | Codex | P7-01 | PLANNED |
| P7-03 | Prepare seeded UAT scenarios for admin, teacher, student, parent, and integration-service roles | Split by layer | Phases 1–6 | PLANNED |
| P7-04 | Conduct staff/student pilot and record prioritized feedback | Human product owner | P7-03 | PLANNED |
| P7-05 | Fix release blockers and complete regression testing | Claude UI / Codex backend in separate packages | P7-04 | PLANNED |
| P7-06 | Produce admin guide, teacher guide, support runbook, and incident contacts | Claude drafts; humans approve | P7-05 | PLANNED |
| P7-07 | Execute staged launch, monitor, and retain rollback capability | Human release owner with Codex support | All gates | PLANNED |

Acceptance gate: UAT sign-off is recorded, backups and rollback are verified, operational ownership is named, and production monitoring is active before users are migrated.

## 6. Critical Path

```text
PM-01 Release scope
  → PM-03 Core policy decisions
  → PM-04 Initial threat model
  → PM-05 Architecture decisions
  → P0-01 Baseline integration
  → P0-02 Runnable foundation
  → P1-01 Migrations
  → P1-05 RLS hardening
  → P1-07 Authorization tests
  ├→ Content: P2-01 → P3-03 → P3-06
  ├→ Assessment: A1-01 → A1-07 → G1-01 → G1-07
  ├→ Quizzes: Q1-01 → Q1-07 → G1-07
  ├→ Communications: C1-01 → C1-07
  ├→ Parent: G1-01 → R1-01 → R1-05
  ├→ Integrations: I1-01 → I1-08
  └→ Reporting: G1-01 → X1-01 → X1-05
        ↓ all release domains converge
  → P6-01 Security review
  → P7-03 UAT
  → P7-07 Launch
```

`P2-03` may proceed from `P1-06` in parallel with canonical routing. `P3-04` may proceed from `P1-05` in parallel with the editor write path. UI work may proceed in parallel only after its relevant executable contract has been committed.

## 7. Immediate Work Queue

Package 0 is active in its documentation worktree. Packages A–D remain queued until its handoff is reviewed and PM-05 is merged.

### Package 0 — Product boundary and irreversible decisions

Owner: Codex integration, with human product-owner approval and Claude review of future UI scope
Branch: `integration/package-0`
Worktree: `../project-m-package-0`
Owned files: `docs/coordination/**`, `docs/product/**`, and `docs/adr/**`
Objective: Complete PM-01 through PM-05 without implementing features.  
Acceptance: every Moodle capability is classified; launch journeys and measurable targets are approved; all-vs-any tag writes, hierarchy, Entra tenant, lifecycle, scale, data classification, and initial threat model are decided; ADRs are committed.  
Out of scope: production code and visual polish.

### Package A — Baseline integration

Owner: Codex  
Branch: `integration/baseline`  
Blocked by: Package 0 / PM-05  
Owned files: entire repository for this serial integration task only  
Objective: Review the Phase 1 and Phase 3 commits, reconcile dependencies, and produce a clean baseline.  
Acceptance: clean status; commits preserved or cleanly squashed; no lost UI or security work; diff reviewed; README reflects the actual state.  
Out of scope: new product features.

### Package B — Runnable application foundation

Owner: Codex  
Blocked by: Package A  
Owned files: root configuration, dependency manifests, `lib/supabase/**`, environment example, test configuration  
Objective: Make the repository installable, runnable, testable, and buildable as a Next.js application.  
Acceptance: install, typecheck, lint, test, and production build commands pass from a fresh checkout.  
Out of scope: visual redesign.

### Package C — App shell and design system

Owner: Claude  
Blocked by: Package B  
Owned files: `app/layout.tsx`, presentation-only global styles, `components/ui/**`, design-token files, visual stories/fixtures  
Read-only contracts: auth types, page summary types, server utilities  
Objective: Turn the artifact styling into a reusable, responsive, accessible application shell.  
Acceptance: desktop/mobile states, focus styles, loading/error/empty primitives, consistent tokens, and no backend changes.  
Out of scope: database queries, authentication, RLS, server actions.

### Package D — Database migration and policy hardening

Owner: Codex  
Blocked by: Package B  
Owned files: `supabase/migrations/**`, `supabase/tests/**`, generated database types  
Objective: Convert the draft schema into deployable migrations and close authorization gaps.  
Acceptance: local migration reset passes; role-based policy tests cover anonymous/student/teacher/admin and cross-tag attacks.  
Out of scope: dashboard components.

Packages C and D may run in parallel because their owned files do not overlap. Claude must not edit `package.json` or its lockfile in Package C; dependency requests go into the handoff for the integration owner.

## 8. Handoff Template

Every completed package must provide this exact information:

```text
Package ID and title:
Plan version:
Base commit:
Branch:
Worktree:
Commit:
Owned files changed:
Dependency requests (do not edit manifests unless owned):
Contract files changed:
Commands run and results:
Acceptance criteria status:
Known limitations or follow-ups:
Files intentionally not changed:
Recommended integration order:
```

The receiving agent must inspect the commit and run the relevant verification commands independently before integration.

## 9. Prompt Template for Claude or Codex

```text
Work only on Project M package <PACKAGE ID> from the master collaboration plan.

Before editing:
1. Confirm the current directory, branch, worktree list, and clean status.
2. Read the package objective, dependencies, owned files, contracts, acceptance criteria, and out-of-scope section.
3. Stop if another agent owns the same worktree or any required writable file.

Rules:
- Modify only the package's owned files.
- Treat all other files as read-only.
- Do not merge to main.
- Do not rewrite existing migrations.
- Preserve user changes.
- Run verification proportional to the change.
- Commit the completed package and return the standard handoff template.

Package assignment:
<PASTE ONE PACKAGE FROM THE PLAN HERE>
```

## 10. Definition of Done for Project M

Project M is ready for general school use only when all of the following are true:

- A fresh environment can be provisioned from version-controlled configuration and migrations.
- Microsoft Entra authentication and institutional restrictions are validated in staging.
- RLS and storage policies are covered by automated adversarial tests.
- Students are read-only; teachers cannot cross authorized tag boundaries; admins have audited elevated actions.
- Canonical URLs are stable, collision-safe, and tested.
- Editor content is schema-validated, sanitized, revisioned, and recoverable.
- MPX/PDF handling has file, batch, archive, and storage limits with safe failure behavior.
- Search and notifications do not leak unauthorized metadata.
- Core user journeys pass unit, integration, end-to-end, accessibility, and responsive checks.
- Performance budgets pass using representative school devices and network conditions.
- Backup restoration and deployment rollback have been rehearsed.
- UK GDPR, retention, safeguarding, acceptable-use, and accessibility decisions have named human approval.
- Admin, teacher, support, incident, and release documentation is complete.
- A staged pilot has completed and all release-blocking issues are closed.
