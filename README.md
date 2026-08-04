# Project M

Modern LMS replacing a legacy Moodle platform for Merchant Taylors' School.

**Stack:** Next.js (App Router) + React + Tailwind CSS + Supabase (Postgres).
**Core model:** content is addressed by **tags**, not nested folders (e.g. `Y9MA1` = Year 9 Maths Set 1). A page can carry multiple tags; a user's assigned tags determine what they can see/edit.

## Status: Phase 1

- [x] `supabase/schema.sql` — tables (`users`, `tags`, `user_tags`, `pages`, `page_tags`) + RLS. Students are read-only by policy omission; teachers can only `UPDATE` pages sharing a tag with them (enforced via `user_matches_page()`).
- [x] `app/[...slug]/page.tsx` — canonical routing engine. Resolves purely against `pages.canonical_url`; any other path (id-based deep links from notifications, old bookmarks) 307-redirects to the canonical hierarchy path instead of rendering in place.
- [x] `components/Dashboard.tsx` — main dashboard: top nav (logo, notifications dropdown, Outlook-style role chip), horizontal tag-pill rail, page/file card grid with breadcrumbs, FAB with an "Upload page" / "Edit current page" menu.
- [x] `dashboard-preview.html` — static HTML/CSS/JS mirror of `Dashboard.tsx` for previewing the interaction design without spinning up Next.js. Open it directly in a browser.

## Not yet built

- `lib/supabase/server.ts` / `lib/supabase/client.ts` — Supabase client factories referenced by `page.tsx`.
- `components/page-renderer.tsx` — renders `content_json` for a resolved page.
- Auth flow, `content_json` block schema, tag admin UI, upload handling for `.mpx`/PDF.
- The trigger/job that (re)computes `canonical_url` when a page's tags or parent change — `page.tsx` assumes this is already correct in the DB.

## Design constraints (Dashboard)

- Light mode only. `rounded-xl`, high whitespace, no dense "scroll of death."
- Primary/accent: MTBS Navy `#254889`. Neutrals: slate/gray, no other accent color.
- `lucide-react` for icons, Tailwind utility classes — no CSS modules.

## Working with Claude + Codex on this repo

- Claude and Codex should not write to the same working tree at the same time.
- Before Codex touches code here, create a dedicated git worktree + branch for it (`git worktree add ../project-m-codex <branch>`), so Claude's edits and Codex's edits never race on the same files.
- Treat commits/diffs as the handoff boundary — review a branch's diff before merging it back, whichever tool produced it.
