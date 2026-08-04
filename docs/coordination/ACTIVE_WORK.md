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
| Package 0 | Product boundary and irreversible decisions (PM-01..PM-05) | Human product owner (wjl); Claude facilitates | — | — | — | This plan doc; later `docs/product/**`, `docs/adr/**` | ACTIVE | None | — |
| Package A | Baseline integration | Codex | `integration/baseline` | TBD | `main`@`648f166` + reconcile `codex/phase1`@`a920262` | entire repo (serial) | BLOCKED | Blocked by Package 0 (PM-05). Also must reconcile the two divergent Codex commits above before producing a clean baseline. | — |
| Package B | Runnable application foundation | Codex | TBD | TBD | Package A handoff | root config, dependency manifests, `lib/supabase/**`, env example, test config | PLANNED | Blocked by Package A | — |
| Package C | App shell and design system | Claude | TBD | TBD | Package B handoff | `app/layout.tsx`, global styles (presentation only), `components/ui/**`, design tokens | PLANNED | Blocked by Package B | — |
| Package D | Database migration and policy hardening | Codex | TBD | TBD | Package B handoff | `supabase/migrations/**`, `supabase/tests/**`, generated DB types | PLANNED | Blocked by Package B | — |

## Change log

- 2026-08-04 — Ledger created. Package 0 marked ACTIVE (the only package the plan permits to start now). Divergence between Codex MCP session and Codex desktop session on `codex/phase1` recorded as a known blocker for Package A rather than silently reconciled.
