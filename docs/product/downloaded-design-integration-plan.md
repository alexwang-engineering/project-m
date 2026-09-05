# Project M Downloaded Design Integration Plan

Status: proposed local implementation sequence  
Source: `/Users/wjl/Downloads/Project M/`  
Rule: the downloaded HTML and guides are design references, not executable source or authority over existing ADRs.

## 1. Fixed principles

- RLS remains authoritative; tags govern content audiences while assessments retain their explicit membership rules.
- Folders, collections and breadcrumbs may organize content but never grant access.
- Direct and indirect navigation receive identical authorization decisions.
- Existing JSON block documents and versioned `.mpx` packages remain canonical; CSV-in-ZIP formats are not introduced.
- Quiz answers remain server-side and are never included in student projections.
- Existing integer revisions remain canonical.
- MTBS navy `#254889` remains the primary brand colour.
- Every mutation is permission-checked, recoverable where practical and audited.
- No real pupil data is used during local development.

## 2. Collaboration boundary

For each package:

1. Codex owns schema, RLS, server actions, data contracts and automated tests.
2. Claude may own the visual implementation only after the server/data contract is committed.
3. Each writer uses a separate Git worktree and branch.
4. File ownership is declared before work starts; no file is edited by both writers concurrently.
5. Integration happens through reviewed commits, never by copying an entire generated project over the current repository.

## 3. Delivery order

### P1 — Page duplication

Goal: let an authorized teacher create an independent draft from an existing page.

- Add one audited database operation that copies the current page content and tags into a new draft.
- Require authority over every copied tag.
- Generate a unique sibling slug and canonical URL or require the teacher to provide one.
- Do not copy revision history, editor grants or publication state.
- Add `Duplicate` to the existing page editor actions.

Acceptance:

- The duplicate is a new draft with version 1 and its own ID.
- Editing the duplicate cannot change the source.
- Students cannot duplicate pages.
- A teacher missing any source tag cannot duplicate it.
- Database, service and browser tests pass.

### P2 — Quiz question improvements

Goal: add the two highest-value missing question capabilities without replacing the existing quiz engine.

#### P2A — Multiple-answer questions

- Add a `multiple_answer` question kind with two to eight options.
- Store correct option IDs only in the protected answer-key relation.
- Grade only an exact set match: all correct selections and no incorrect selections.
- Use native checkboxes with a fieldset and legend.

#### P2B — Question weights

- Add a positive bounded integer weight, defaulting existing questions to 1.
- Calculate `score` and `max_score` from weights on the server.
- Do not support fractional weights until the school identifies a real marking need.

Acceptance:

- Student payloads never contain answer keys.
- Malformed, duplicate or unknown option IDs are rejected.
- Existing multiple-choice quizzes retain identical behaviour.
- Keyboard and screen-reader interaction passes.
- Database and application regression suites pass.

### P3 — Controlled quiz retakes

Goal: allow a teacher to choose one, two, three or unlimited attempts while retaining history.

- Add an attempt policy to quizzes.
- Replace the current one-attempt uniqueness rule with append-only numbered attempts.
- Enforce the limit transactionally in the database.
- Show students their attempt count before submission.
- Keep every attempt immutable; gradebook policy must explicitly choose latest or highest score before implementation.

Blocked decision:

- Product owner must choose `latest attempt` or `highest attempt` for gradebook aggregation.

Acceptance:

- Concurrent submissions cannot exceed the limit.
- Every attempt is independently auditable.
- Changing a future policy cannot rewrite historical attempts.

### P4 — Assignment audience picker

Goal: let teachers assign work to authorized classes and selected pupils without weakening tag boundaries.

- Keep tags as the default class audience.
- Add pupil exceptions only for pupils belonging to a selected authorized tag.
- Reuse existing assignment exceptions where their semantics fit.
- Provide search/filter over authorized classes and pupils.
- Display an exact audience summary before publication.

Blocked decisions:

- Define whether an individually added pupil keeps access after leaving the source class.
- Define notification and guardian visibility rules.

Acceptance:

- Teachers cannot enumerate or assign pupils outside owned tags.
- Modified requests cannot expand the audience.
- Student, calendar and guardian projections agree on the effective audience.

### P5 — Resources browsing

Goal: provide the useful explorer/card experiences from the mockups without building a second authorization hierarchy.

- Add `/resources` as a projection over existing pages, quizzes and tags.
- Student view: searchable cards grouped by subject/year metadata derived from tags.
- Teacher view: compact management table with lifecycle, tags, type and last update.
- Reuse canonical URLs and existing edit routes.
- If navigation collections are needed later, store them as presentation metadata only.
- Do not add `Hidden` folders or path-dependent authorization.

Acceptance:

- The same RLS-filtered query determines visible records in every layout.
- Typed URLs and clicked links produce the same result.
- Teacher controls appear only for content the teacher can manage.
- Empty, loading, error, keyboard and mobile states pass.

### P6 — Autosave and draft recovery

Goal: protect teachers from browser crashes and accidental navigation.

- Start with browser-local recovery for unsaved editor state, keyed by page ID and base version.
- Restore only after showing the teacher the saved timestamp and source version.
- Clear recovery data after a confirmed server save.
- Keep explicit server save/publish and optimistic concurrency as the authoritative workflow.
- Add server-side autosave only if local recovery proves insufficient in teacher testing.

Acceptance:

- A refresh can recover unsaved blocks.
- Recovery never overwrites a newer server version silently.
- Publishing remains explicit.
- Sensitive data is cleared on logout and recovery size is bounded.

### P7 — Recently Deleted

Goal: make ordinary deletion recoverable using existing archive states.

- Present archived pages, quizzes and assignments in an authorized Recently Deleted view.
- Reuse existing archive/restore operations where available; add only missing restore operations.
- Allow the original authorized owner or administrator to restore during the configured recovery window.
- Keep permanent deletion admin-only and outside the first implementation.
- Add a confirmation dialog; do not add artificial countdowns unless user testing shows accidental deletion remains common.

Acceptance:

- Restore rechecks tag authority and canonical-path conflicts.
- Archive and restore events are immutable in the audit log.
- Students never see archived records or recovery controls.

### P8 — Table block

Goal: support accessible structured lesson content.

- Extend the existing editor document schema with a bounded table block.
- Require a caption, header row and rectangular cell matrix.
- Store cell content as sanitized inline HTML using the existing sanitizer.
- Render with semantic `<table>`, `<caption>`, `<th>` and `<td>` elements.
- Include the block in MPX validation and round-trip tests.

Acceptance:

- Invalid dimensions and oversized tables are rejected.
- Keyboard, zoom and narrow-screen rendering remain usable.
- XSS and MPX round-trip tests pass.

### P9 — YouTube block

Goal: embed approved instructional videos with a safe fallback link.

- Accept only canonical YouTube video IDs/URLs and normalize them server-side.
- Render `youtube-nocookie.com` in a sandboxed iframe with a descriptive title.
- Update CSP narrowly for that origin.
- Always provide a normal HTTPS link as a fallback.
- Do not perform live network validation during every page save.

Acceptance:

- Non-YouTube hosts, playlists where unsupported and malformed IDs fail closed.
- No arbitrary iframe URL reaches the renderer.
- Consent/privacy, keyboard, fullscreen and CSP behaviour are tested.

## 4. Deferred until evidence exists

### Short-answer automatic grading

Do not implement word-overlap grading. First choose one of:

- exact normalized answers for objectively constrained responses; or
- teacher marking for open responses.

### Timetable and room changes

Implement only after a real MIS contract supplies stable lesson, room, staff, pupil and change identifiers. Continue using Calendar for synthetic demonstrations.

### Additional Office, audio and video uploads

Implement only after the production malware scanner, preview strategy, storage budget and retention policy are operational.

### Page templates

Measure page duplication usage first. Add templates only when teachers need centrally maintained layouts rather than independent copies.

### Multi-page quizzes and galleries

Add only after representative content demonstrates that long quizzes or image collections are common.

## 5. Explicitly rejected

- Authorization based on arriving through a link, referrer or browser history.
- A universal teacher permission to change every resource.
- Replacing tags with folders.
- Replacing `.mpx` JSON manifests with `main.csv` packages.
- Decimal `major.minor` revision arithmetic.
- Making redirects or public-domain DNS checks a synchronous dependency of page saving.
- Copying the purple/lavender prototype theme over the approved MTBS design system.

## 6. Verification loop for every package

Repeat until a complete pass produces no new finding:

1. **Purpose:** does the change solve the named teacher/student problem?
2. **Identity:** which role is acting, and is the session genuine?
3. **Authorization:** can UI hiding, copied URLs or modified requests bypass RLS?
4. **Integrity:** are writes atomic, bounded, conflict-safe, recoverable and audited?
5. **Confidentiality:** does any student response expose private data or answer keys?
6. **Rendering:** do loading, empty, error, mobile, keyboard and assistive states work?
7. **Regression:** run formatting, lint, TypeScript, focused tests and production build.
8. **Database:** run fresh-migration pgTAP tests for any schema/RLS change.
9. **Browser:** exercise teacher and student journeys in the real local app.
10. **Documentation:** update the readiness matrix with only evidence actually obtained.

A package is complete only when its code, migration, tests, live local journey and documentation agree.

## 7. Recommended milestones

| Milestone | Packages | Outcome |
|---|---|---|
| M1 — Teacher efficiency | P1 | Independent page duplication |
| M2 — Better assessment | P2, P3 | Multiple answers, weights and controlled retakes |
| M3 — Audience and discovery | P4, P5 | Safer assignment targeting and Resources browsing |
| M4 — Reliability and recovery | P6, P7 | Draft recovery and Recently Deleted |
| M5 — Richer content | P8, P9 | Accessible tables and safe video embeds |

Do not begin a later milestone merely because visual mockups exist. Start it when the prior milestone is verified and the next package's blocked decisions are resolved.
