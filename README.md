# Project M

Modern LMS replacing a legacy Moodle platform for Merchant Taylors' School.

**Stack:** Next.js (App Router) + React + Tailwind CSS + Supabase (Postgres).
**Core model:** content is addressed by **tags**, not nested folders (e.g. `Y9MA1` = Year 9 Maths Set 1). A page can carry multiple tags; a user's assigned tags determine what they can see/edit.

## Status: Runnable foundation (Packages 0/A/B)

- [x] `supabase/schema.sql` — tables (`users`, `tags`, `user_tags`, `pages`, `page_tags`) + RLS. Students are read-only by policy omission; teachers can only `UPDATE` pages sharing a tag with them (enforced via `user_matches_page()`).
- [x] `app/[...slug]/page.tsx` — canonical routing engine. Resolves purely against `pages.canonical_url`; any other path (id-based deep links from notifications, old bookmarks) 307-redirects to the canonical hierarchy path instead of rendering in place.
- [x] `components/Dashboard.tsx` — main dashboard: top nav (logo, notifications dropdown, Outlook-style role chip), horizontal tag-pill rail, page/file card grid with breadcrumbs, FAB with an "Upload page" / "Edit current page" menu.
- [x] `dashboard-preview.html` — static HTML/CSS/JS mirror of `Dashboard.tsx` for previewing the interaction design without spinning up Next.js. Open it directly in a browser.
- [x] `docs/adr/` and `docs/product/` — approved/provisional release-1 architecture, service targets, data classification, and full-LMS roadmap.
- [x] `lib/mpx-packager.ts` / `lib/security.ts` — reconciled experimental utilities with explicit production limitations; see `lib/README.md`.
- [x] Phase 3 auth-domain trigger reviewed but intentionally withheld from executable migrations because parent access and tenant validation require a combined admission design.
- [x] Next.js 16 application foundation, Supabase SSR browser/server clients, auth-cookie proxy, Tailwind CSS, strict TypeScript, ESLint, Prettier, Vitest, and Playwright.

## Local development

Requirements: Node.js 22.22.2 or a compatible version in the range declared in `package.json`, and npm 10.9.8.

```bash
cp .env.example .env.local
npm ci
npm run dev
```

Set the two public Supabase values in `.env.local` when exercising authenticated or database-backed routes. The dashboard shell remains available without them; database-backed canonical pages fail closed until they are configured.

Run the complete fast verification gate with `npm run check`. Run the browser smoke test separately with `npm run test:e2e`; install its browser once with `npx playwright install chromium` if needed.

## Not yet built

- A production block renderer/editor. `components/page-renderer.tsx` is deliberately a safe temporary JSON adapter for compilation and must be replaced by Claude's presentation package.
- Auth flow, guardian admission, `content_json` block schema, tag admin UI, and authoritative upload handling for `.mpx`/PDF.
- The trigger/job that (re)computes `canonical_url` when a page's tags or parent change — `page.tsx` assumes this is already correct in the DB.
- Assignments/submissions, quizzes, gradebook, calendar/messaging, parent projections, LTI/SCORM, MIS/SIS sync, migration, and reporting listed in the release-1 roadmap.

## Design constraints (Dashboard)

- Light mode only. `rounded-xl`, high whitespace, no dense "scroll of death."
- Primary/accent: MTBS Navy `#254889`. Neutrals: slate/gray, no other accent color.
- `lucide-react` for icons, Tailwind utility classes — no CSS modules.

## Working with Claude + Codex on this repo

- Claude and Codex should not write to the same working tree at the same time.
- Before Codex touches code here, create a dedicated git worktree + branch for it (`git worktree add ../project-m-codex <branch>`), so Claude's edits and Codex's edits never race on the same files.
- Treat commits/diffs as the handoff boundary — review a branch's diff before merging it back, whichever tool produced it.
