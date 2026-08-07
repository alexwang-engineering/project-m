# ADR-016: Search Scope

Status: Accepted
Date: 2026-08-07

## Context

PM-02's Service Objectives table sets a concrete target - search response p95 under 750ms - but no search feature exists at all today; this was named as a real gap in the first-principles audit against PM-02 (recorded in the ledger, commit `3f48b3b`) and restated when scoping later work, but never itself scoped. PM-04's threat model already fixes the one hard requirement: "Search/notification/file metadata leakage - authorization inside source query, generic denial." A search implementation that queries a separate index outside RLS, or that runs as a privilege-elevated function reimplementing authorization by hand, would risk exactly the leak PM-04 already named.

## Decision

### No new RPC, no new authorization logic

Every searchable table (`pages`, `assignments`, `quizzes`, `announcements`, `calendar_events`) already has its own tested RLS `select` policy (`can_read_page`, `can_read_assignment`, `can_read_quiz`, and the announcement/calendar broadcast-or-tag policies). Search runs as ordinary authenticated `select`/`.textSearch()` queries against those same tables through the normal Supabase client - RLS applies automatically, so "authorization inside source query" is satisfied by construction rather than by writing new authorization code to get right a second time. This mirrors the exact pattern `lib/content/calendar.ts`'s `listUpcoming` already uses: parallel queries against several RLS-protected tables, merged in application code, no `SECURITY DEFINER` involved.

### Postgres full-text search, not `ILIKE`

PM-02's p95 target is a real number, not just an aspiration - a leading-wildcard `ILIKE '%term%'` cannot use a standard index and would not scale toward the stated 100,000-page envelope. Postgres's built-in full-text search (`tsvector`/`to_tsvector`, `@@ websearch_to_tsquery`) is a native platform feature, not a new dependency: each searchable table gets a `search_vector tsvector generated always as (...) stored` column plus a GIN index. `supabase-js`'s `.textSearch()` compiles directly to this via PostgREST - no new function needed on either side.

### Titles only for `pages` in v1; full plain-text fields elsewhere

`pages.content_json` is a structured block document (paragraph/heading/list/quote/code/callout/file/image), not plain text - safely flattening it to a searchable string is real, separate work (stripping HTML per block type, concatenating across shapes) that doesn't belong bundled into standing up search itself. V1 indexes `pages.title` only, same as `assignments.title` and `quizzes.title` (neither has a body field at all). `announcements` and `calendar_events` already have real plain-text `body`/`description` columns, so those are indexed in full. Searching page *content* (not just titles) is explicit, named future work, not a silently dropped requirement.

### Scope boundaries, decided by precedent rather than asked

- **Question bank items are not searchable.** They have no general read path at all (ADR-014 - single read/manage tier, teacher/admin only) and already have their own dedicated browsing page; adding them to a general search surface would be new exposure with no corresponding new authorization work, not a reuse of an existing one.
- **Guardians get no search surface.** Guardian access is deliberately isolated behind three narrow `SECURITY DEFINER` `guardian_view_*` functions (ADR-013), not general RLS-scoped table access - a guardian's search query against `pages`/`assignments`/etc. would correctly return nothing (RLS denies it), matching that isolation rather than needing new plumbing to bypass it.
- **Answer keys, submission bodies, and grades are never indexed.** Only title/body/description columns are ever searched - matches PM-04's data-sensitivity classification directly.
- **No per-item deep link for announcements or calendar events**, since neither has an individual detail route today (both are single-list pages) - a result of either kind links to its list page, not a specific item. Acceptable for v1, named rather than silently broken.

## Consequences

Tests must cover: a search result never appears for content the searching principal could not otherwise read via the underlying table's own RLS policy (the one property this whole design exists to guarantee), and that full-text matching works across a title and, where applicable, a body/description field. Full page-content search, and any actual p95 measurement against a realistic dataset, remain open follow-up work.
