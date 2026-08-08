# Project M

Modern LMS replacing a legacy Moodle platform for Merchant Taylors' School.

**Stack:** Next.js (App Router) + React + Tailwind CSS + Supabase (Postgres).
**Core model:** content is addressed by **tags**, not nested folders (e.g. `Y9MA1` = Year 9 Maths Set 1). A page can carry multiple tags; a user's assigned tags determine what they can see/edit.

## Status: release-1 implementation in progress, not yet production-deployable

The implemented features below have RLS-backed authorization and automated coverage. Core dashboard journeys work, but production integrations and operational gates remain open. See `docs/coordination/ACTIVE_WORK.md` for package-level history and verification evidence.

- **Content**: tag-scoped pages with a block editor (paragraph/heading/list/quote/code/callout/file/image blocks), page revisions with restore, MPX (`.mpx`) export/import for offline transfer, canonical tag-hierarchy routing.
- **Assessment**: quizzes with a shared, tag-scoped question bank; assignments with student submission and teacher review; a gradebook aggregating both.
- **Scheduling & comms**: calendar (deadline aggregation + standalone events), one-way announcements (not threaded messaging — see below).
- **Access**: role-based auth admission (student/teacher/institution admin), read-only parent/guardian access via admin-attested links and email magic-link sign-in (not Entra — see below).
- **Admin**: roster management, tag creation, CSV-based MIS/SIS roster reconciliation, staged Moodle-migration import, operational reporting (audit log, roster/content summaries).
- **Search**: RLS-scoped full-text search (Postgres `tsvector`/GIN, not `ILIKE`) across pages/assignments/quizzes/announcements/calendar events.
- **File handling**: uploads go through a two-phase flow — the browser only ever creates a `pending` record and uploads bytes to private Storage; a separate out-of-band worker (`npm run verify-uploads`) is the *only* process that can recompute checksums, validate real file signatures, run malware scanning, and mark a file `ready`. Verification work uses recoverable leases, and terminal state plus audit evidence commit atomically. No browser-reachable code path can self-approve an upload.
- **Platform**: strict TypeScript, RLS as the sole authorization layer (no app-level access checks duplicating it), nonce-based CSP with no `unsafe-inline`/`unsafe-eval` in production, automated accessibility coverage (jsx-a11y + axe-core) on every page reachable without a session, GitHub Actions CI (format/lint/typecheck/unit tests/build/e2e/audit + a fresh-database pgTAP run + secret scanning).

## Local development

Requirements: Node.js 22.22.2 or a compatible version in the range declared in `package.json`, npm 10.9.8, and Docker (for the local Supabase stack).

```bash
cp .env.example .env.local
npm ci
npx supabase start   # local Postgres/Auth/Storage; fills in the Supabase values below
npm run dev
```

Set the Supabase values in `.env.local` (from `supabase start`'s output) to exercise authenticated or database-backed routes. The dashboard shell renders without them; database-backed pages fail closed until configured.

Run the complete fast verification gate with `npm run check` (format, lint, typecheck, unit tests, production build). Run the browser smoke test separately with `npm run test:e2e` (install its browser once with `npx playwright install chromium`). Run the database test suite with `npx supabase test db`. `npm run verify-uploads` runs the trusted file-verification worker against whatever is currently `pending` — see `lib/files/README.md`.

## Not yet built / deliberately deferred

Everything here is a named decision (usually an ADR under `docs/adr/`), not an oversight:

- **Real Microsoft Entra SSO.** Auth admission logic exists and is tested, but no real tenant is registered — local development signs in via a temporary, gitignored, never-committed `app/dev-login` bridge that is hard-blocked (real HTTP 404) outside development.
- **Production malware scanning.** The verification worker's scanner is a pluggable interface; only a development no-op adapter exists, and it refuses to run when `NODE_ENV=production`. A real scanner (e.g. ClamAV, a cloud AV API) needs to be wired in and deployed before real uploads go live.
- **Threaded/bidirectional messaging** (ADR-012) — blocked pending a named human safeguarding owner, not a technical gap.
- **SCORM/LTI** (ADR-020) — LTI is fully deferred (no real third-party tool to integrate against in this environment); SCORM playback is *designed* but its build is deliberately deferred because it means running arbitrary third-party JavaScript inside the app, the highest security-stakes surface in this project, and this environment cannot live-verify sandbox isolation.
- **Live MIS/SIS connector** — only CSV-upload reconciliation exists; no live API/webhook integration (ADR-015).
- **Real Moodle `.mbz` reader** — the staged import engine works against structured input; a real Moodle backup-format parser is separate future work (ADR-019).
- **Compliance reporting** (GDPR data-subject/erasure exports, safeguarding audit evidence) — operational reporting exists; compliance exports need a named human privacy reviewer first (ADR-017).
- **Pre-launch operational gates**, none of which are code: a DPIA and safeguarding/privacy sign-off for guardian data, monitoring/alerting, a rehearsed backup/PITR restore, an authenticated WCAG 2.2 AA walkthrough (only unauthenticated pages have automated coverage today), and representative-device performance testing.

## Design constraints (Dashboard)

- Light mode only. `rounded-xl`, high whitespace, no dense "scroll of death."
- Primary/accent: MTBS Navy `#254889`. Neutrals: slate/gray, no other accent color.
- `lucide-react` for icons, Tailwind utility classes — no CSS modules.

## Working with Claude + Codex on this repo

- Claude and Codex should not write to the same working tree at the same time.
- Before Codex touches code here, create a dedicated git worktree + branch for it (`git worktree add ../project-m-codex <branch>`), so Claude's edits and Codex's edits never race on the same files.
- Treat commits/diffs as the handoff boundary — review a branch's diff before merging it back, whichever tool produced it.
