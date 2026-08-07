# ADR-018: Accessibility Scope (Launch v1)

Status: Accepted
Date: 2026-08-07

## Context

PM-02 sets WCAG 2.2 AA as an explicit launch target, and a prior first-principles audit against it found the app essentially unaudited: 14 icon-button `aria-label`s existed, zero `role=` attributes, no `axe`/`jest-axe` in the toolchain, no systematic pass ever run. This ADR scopes what a first real accessibility pass covers versus what stays named and deferred, matching the same "smallest correct thing, honestly bounded" treatment every other package this session has had.

Real constraint on what's verifiable right now: this environment has no working local Postgres (Colima's VM cannot reach any container registry this session, confirmed across five separate attempts) - so no page requiring a real authenticated session can be exercised live. Every deep-authenticated surface (the actual `PageEditor`, `QuizEditor`, `AdminRoster`, gradebook, submissions review, etc.) can only be reviewed by reading source, the same limitation every unverified package since the gap-fixes has had. What's genuinely different here: unlike a database RPC, a **static** accessibility issue (a missing `aria-label`, a missing landmark, a focus trap) is visible directly in JSX without needing data behind it - so source-level fixes to these components are lower-risk than the SQL written blind this session, even though "click through with a screen reader on real seeded data" still isn't possible.

## Decision

**In scope for this pass:**
- Wire `@axe-core/playwright` into the existing Playwright e2e setup (`e2e/dashboard.spec.ts` already established the pattern) as a real, lasting automated regression check - not a one-off manual pass that rots the moment someone adds a new unlabeled icon button.
- Run it live against every page reachable without a real Supabase session (the dashboard's unconfigured-Supabase empty state, `/auth/login`, `/parent/login`) - genuinely exercised in a running dev server via the browser, not just read from source, since none of these need Postgres.
- Fix real violations found, live or by source review: icon-only buttons missing `aria-label`, missing semantic landmarks (`<header>`/`<nav>`/`<main>`), missing skip-to-content link, missing `:focus-visible` styling, form inputs without an associated `<label>` or `aria-label`.
- Source-review pass (not live-exercised) across every authenticated component already built this session for the same violation classes, since these are static JSX defects independent of what data is behind them.

**Explicitly deferred, named rather than silently skipped:**
- A real screen-reader walkthrough (VoiceOver/NVDA) of any authenticated flow - needs a live session, which needs Colima.
- Color-contrast verification against every custom hex value in `app/globals.css` beyond the primary MTBS Navy tokens - a real design-system pass, not a code-review-shaped task.
- `prefers-reduced-motion` audit of the animation work in `components/pages`/`components/quizzes` - motion review is its own pass, not folded into this one.
- A `role=`/landmark audit of third-party-rendered content (nothing currently applies, but noted for when SCORM/LTI embedding is eventually built).

## Consequences

Automated axe coverage on the reachable pages becomes permanent CI-shaped protection against new violations landing unnoticed, which is worth more long-term than a single manual pass that immediately goes stale. The deferred items remain a named, tracked gap - not implied as covered - until either Colima recovers in this environment or a staging deployment gives a place to run a live authenticated audit.
