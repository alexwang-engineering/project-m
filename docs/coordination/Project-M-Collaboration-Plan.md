# Project M — Master Delivery and Collaboration Plan

Version: 1.1 — first-principles audit  
Product: Merchant Taylors' Learning Management System  
Stack: Next.js App Router, React, TypeScript, Tailwind CSS, Supabase/Postgres  
Purpose: Deliver the smallest safe, useful school product while giving Claude and Codex independent, conflict-free work packages with explicit handoff boundaries.

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

| Capability | Decision required |
|---|---|
| Tagged pages and PDFs | Expected launch scope |
| Assignments and student submissions | Undecided |
| Quizzes and question banks | Undecided |
| Gradebook, marking, and feedback | Undecided |
| Deadlines, timetable, and calendar | Undecided |
| Announcements and messaging | Undecided |
| SCORM/LTI/external learning tools | Undecided |
| Parent/guardian access | Undecided |
| MIS/SIS roster synchronization | Undecided |
| Legacy Moodle content/user migration | Undecided |
| Reporting and compliance exports | Undecided |

No agent should invent an undecided capability. Architecture should retain extension points without building speculative subsystems.

### Measurable launch outcomes

Before Phase 1, the human owner must approve targets for: median page-load time on school hardware, maximum acceptable interaction latency, availability/support hours, maximum recovery time and data loss, expected user/content/storage scale, accessibility conformance, pilot success criteria, and the top five student/teacher/admin journeys.

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

### Identity contract

An email suffix alone is not sufficient proof of the intended Microsoft Entra tenant. Production authentication must restrict enabled providers, validate the Entra tenant/issuer and verified email claims, and retain the database trigger as defence in depth. The exact tenant identifier belongs in protected environment configuration, not source code.

### Canonical hierarchy contract

Tags answer **who/what grouping applies**; they do not inherently define an ordered parent hierarchy. Canonical URLs require an explicit deterministic model, such as `parent_page_id` plus slug, or an independently managed canonical path. The product owner must decide whether pages can have multiple navigational parents. One page must still resolve to exactly one canonical URL; alternate contexts link or redirect to it.

## 5. Delivery Roadmap

Roadmap status values are `PLANNED`, `READY`, `ACTIVE`, `BLOCKED`, `REVIEW`, `MERGED`, and `DONE`. Dependencies name tasks that must be merged or explicitly approved first.

### Phase -1 — Scope, Risk, and Architecture Decisions

| ID | Work package | Owner | Dependencies | Status |
|---|---|---|---|---|
| PM-01 | Classify Moodle capabilities as Launch/Later/External/Out and define the first release boundary | Human product owner; agents facilitate | None | READY |
| PM-02 | Document primary user journeys, scale assumptions, service targets, and pilot success measures | Human product owner with school stakeholders | PM-01 | PLANNED |
| PM-03 | Decide write authorization semantics, canonical hierarchy model, Entra tenant policy, and page lifecycle | Human product owner advised by Codex | PM-01 | PLANNED |
| PM-04 | Produce an initial threat model and data classification before schema/API stabilization | Codex; human review | PM-01 | PLANNED |
| PM-05 | Record architecture decisions as version-controlled ADRs | Codex/integration | PM-02, PM-03, PM-04 | PLANNED |

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

### Phase 6 — Quality, Security, Compliance, and Performance

| ID | Work package | Owner | Dependencies | Status |
|---|---|---|---|---|
| P6-01 | Re-audit and update the initial threat model after authentication, uploads, editor content, and Supabase configuration are implemented | Codex | PM-04, Phases 1–5 | PLANNED |
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
| P7-03 | Prepare seeded UAT scenarios for admin, teacher, and student roles | Split by layer | Phases 1–6 | PLANNED |
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
  → P2-01 Canonical URL rules
  → P3-03 Secure write path
  → P6-01 Security review
  → P7-03 UAT
  → P7-07 Launch
```

`P2-03` may proceed from `P1-06` in parallel with canonical routing. `P3-04` may proceed from `P1-05` in parallel with the editor write path. UI work may proceed in parallel only after its relevant executable contract has been committed.

## 7. Immediate Work Queue

Only Package 0 should be assigned now. Packages A–D remain queued until its decisions are recorded.

### Package 0 — Product boundary and irreversible decisions

Owner: Human product owner, with Claude facilitating user journeys/UI scope and Codex facilitating security/data/architecture choices  
Branch: none until decisions are ready; final ADR writing occurs in a dedicated integration worktree  
Owned files: this planning document initially; later `docs/product/**` and `docs/adr/**` in a serial documentation package  
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
