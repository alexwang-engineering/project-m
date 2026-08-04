# Project M — Active Work Ledger

This file is the lock. Per `Project-M-Collaboration-Plan.md` §2: only the integration owner edits this file; chat messages and the desktop copy of the plan are not authoritative because they go stale. An agent may start a package only when it appears here with status `ACTIVE`, one named owner, one branch/worktree (where applicable), and declared owned paths.

State machine: `PLANNED → READY → ACTIVE → REVIEW → MERGED`, with `BLOCKED` reachable from any non-merged state.

## Known state as of ledger creation (2026-08-04)

- `main` is at `648f166` (Phase 1: schema, canonical router, dashboard).
- Branch `codex/phase1`, worktree `../project-m-codex`, is at `a920262` — **two separate Codex sessions wrote to this branch/worktree**: mine (MCP `codex` tool) produced `06dfd5e`; the user's own Codex desktop app produced `a920262` directly afterward, unregistered in any ledger. Landed serially, no conflict, but this is the exact failure mode Rule 1 exists to prevent. `a920262` renames `packPage`/`unpackPage` → `packageMpx`/`unpackMpx`, adds a PDF-only assertion, adds a combined-archive cap, and adds `package-lock.json`/`node_modules` (an `npm install` was run in that worktree).
- This divergence is **not yet reconciled**. It is queued as part of Package A (Baseline integration), which is itself blocked on Package 0. It must not be merged to `main` ad hoc before Package A runs.

## Ledger

| Package ID | Title | Owner | Branch | Worktree | Base commit | Owned paths | Status | Blockers | Handoff commit |
|---|---|---|---|---|---|---|---|---|---|
| Package 0 | Product boundary and irreversible decisions (PM-01..PM-05) | Codex integration; human product owner approves | `integration/package-0` | `../project-m-package-0` | `main`@`bd8cab6` | `docs/coordination/**`, `docs/product/**`, `docs/adr/**` | ACTIVE | PM-01 approved; PM-02..PM-05 in progress | — |
| Package A | Baseline integration | Codex | `integration/baseline` | TBD | `main`@`648f166` + reconcile `codex/phase1`@`a920262` | entire repo (serial) | BLOCKED | Blocked by Package 0 (PM-05). Also must reconcile the two divergent Codex commits above before producing a clean baseline. | — |
| Package B | Runnable application foundation | Codex | TBD | TBD | Package A handoff | root config, dependency manifests, `lib/supabase/**`, env example, test config | PLANNED | Blocked by Package A | — |
| Package C | App shell and design system | Claude | TBD | TBD | Package B handoff | `app/layout.tsx`, global styles (presentation only), `components/ui/**`, design tokens | PLANNED | Blocked by Package B | — |
| Package D | Database migration and policy hardening | Codex | TBD | TBD | Package B handoff | `supabase/migrations/**`, `supabase/tests/**`, generated DB types | PLANNED | Blocked by Package B | — |

## Change log

- 2026-08-04 — Ledger created. Package 0 marked ACTIVE (the only package the plan permits to start now). Divergence between Codex MCP session and Codex desktop session on `codex/phase1` recorded as a known blocker for Package A rather than silently reconciled.
- 2026-08-04 — PM-01 recorded: all eleven Moodle capabilities classified **Launch** (release-1, non-phased), confirmed after explicit reconsider. This is a major scope expansion beyond the plan's existing Phase 0–7 roadmap, which only covers the tagged-content-portal slice. **Package 0 remains ACTIVE, not complete** — PM-02 (user journeys, scale, targets), PM-03 (write authorization / canonical hierarchy / Entra tenant / lifecycle policy), PM-04 (threat model), and PM-05 (ADRs, plus a roadmap rewrite to add work packages for assignments, quizzes, gradebook, calendar, messaging, SCORM/LTI, parent access, MIS/SIS sync, migration, and reporting) are still outstanding.
- 2026-08-04 — PM-02 recorded: scale (medium, 800–2,500 users; staggered usage; ~500GB storage; mixed BYOD/variable WiFi), performance/availability/recovery/accessibility targets (2.5s LCP, school-hours support, hours-scale RTO/RPO tightening to <1hr before Phase 7, WCAG 2.2 AA), the top-5 journeys (student/teacher/admin/parent/cross-cutting), and the pilot success scorecard. **Package 0 remains ACTIVE** — PM-03, PM-04, PM-05 still outstanding.
- 2026-08-04 — **Product owner stepped away and instructed continued autonomous work without further stopping to ask.** From this point, decisions normally requiring human sign-off (PM-03 onward) are made by Claude using the plan's own stated defaults/reasoning, explicitly flagged as **provisional / pending product-owner review** rather than final. PM-03 recorded: tag writes require all-tags-owned (not any-tag — conflicts with the currently committed `schema.sql`, fix deferred to Package D); one canonical parent per page, no true multi-parent; Entra tenant validation staged to Phase 6, domain trigger stands for now; shared base content lifecycle (draft/published/archived) across pages/assignments/quizzes. **Package 0 remains ACTIVE, now PROVISIONAL** — PM-04, PM-05 outstanding.
- 2026-08-04 — Codex assigned PM-02 through PM-05 on `integration/package-0` in isolated worktree `../project-m-package-0`; owned paths restricted to product, ADR, and coordination documentation.
