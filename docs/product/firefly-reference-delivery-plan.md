# Project M — Firefly Reference Delivery Plan

Status: Guidance baseline  
Date: 2026-08-11  
Authority: Supplements the master delivery plan and ADRs; it does not override security, privacy, or release gates.

## 1. First-principles outcome

The screenshots are workflow references, not a visual specification. Project M should let:

1. a teacher set work for an authorized tag;
2. a student understand and submit that work before its deadline;
3. a teacher review, mark, and release feedback;
4. the student and guardian see only released outcomes; and
5. the school audit every sensitive transition.

Anything that does not improve one of those outcomes is out of scope for this stream.

## 2. Non-negotiable invariants

- Postgres RLS and audited RPCs remain the authorization boundary.
- Teachers may target and manage only tags they currently own.
- Students may read assigned work and mutate only their own submissions.
- Submission receipts are immutable; resubmission creates history rather than overwriting it.
- Marks and feedback remain private until an explicit release action.
- Files remain private, scanned, and served through short-lived signed URLs.
- Demo data is synthetic. Real pupil data is prohibited until external release blockers are closed.
- WCAG 2.2 AA, keyboard operation, responsive layouts, and low-bandwidth behavior are acceptance requirements.

## 3. Reference-to-product gap map

| Reference workflow | Project M state | Decision |
|---|---|---|
| Select classes/students | Tag targeting exists | Keep tag-first; do not add a second class model |
| Task title, deadline, resubmission | Implemented | Retain |
| Student comment with submission | Implemented 2026-08-11 | Retain and test |
| Student file submission | Implemented locally | Production blocked on malware scanner deployment |
| Teacher submission review | Implemented | Improve presentation only after workflow tests |
| Save mark and release feedback | Implemented as separate audited actions | Retain; safer than Firefly's combined menu |
| Gradebook/markbook | Implemented | Add filters/export only when stakeholder need is confirmed |
| Announcements | Implemented one-way | Bidirectional messaging remains blocked by safeguarding approval |
| Calendar/deadlines | Implemented | Integrate assignment deadlines into journey testing |
| Rich task instructions | Partial: schema supports an instructions page, creation UI does not select one | Build next |
| Draft/scheduled assignment lifecycle | Missing | Build after instructions, using the shared lifecycle model |
| Inline PDF annotation | Missing | Later package; requires an explicit annotation data model and mobile/accessibility proof |
| Individual-student exceptions | Missing | Later package; requires policy for extensions, withdrawals, and audit |
| Timetable/lesson panel | Calendar exists, live timetable integration does not | Integrate externally after MIS contract exists |
| Bookmarks/themes/apps promotion | Not required for the learning loop | Skip |

## 4. Delivery order

### F0 — Workflow evidence and contracts

Goal: freeze the real behavior before adding UI.

- Confirm assignment state vocabulary: `draft → published → closed → archived`; grading/release remains submission-level.
- Confirm whether an instructions page is required or optional.
- Confirm late-work, extension, withdrawal, and resubmission policies with school stakeholders.
- Add a role matrix for teacher, student, admin, and guardian operations.
- Record representative desktop, tablet, and mobile acceptance devices.

Exit gate: decisions are recorded in an ADR and no database/UI work depends on an unanswered policy.

### F1 — Assignment instructions

Goal: a student can understand the task without a separate message.

Backend — Codex:

- Reuse `assignments.instructions_page_id`; do not add duplicate description HTML.
- Add an authorized query for pages a teacher may attach.
- Verify the selected page is readable by every target tag at creation time.
- Return the instruction-page summary in assignment projections.
- Add RLS/RPC and unit tests for cross-tag spoofing.

Frontend — Claude, after contract merge:

- Add an instruction-page picker to assignment creation.
- Show the instructions, attachments, due date, and submission state in one student task view.
- Keep the default list compact; avoid a long dashboard feed.

Acceptance:

- A `Y9MA1` teacher cannot attach or target an unauthorized `L6CH2` page/tag.
- A student sees the same canonical instruction page regardless of entry point.
- Missing/archived instructions fail safely without exposing metadata.

### F2 — Draft, publish, close, archive

Goal: teachers can prepare work without exposing it early.

Backend — Codex:

- Add an append-only migration for assignment lifecycle and publication timestamps.
- Update read/manage policies and audited RPCs.
- Define deadline closure separately from publication state.
- Preserve existing assignments through a deterministic migration default.

Frontend — Claude, after contract merge:

- Add Save draft, Publish, Close, and Archive actions with clear confirmation and status labels.
- Show students only published/open work; retain teacher history views.

Acceptance:

- Draft assignments are undiscoverable to students through lists, direct URLs, search, and reports.
- State changes are audited and concurrency-safe.
- Closing prevents new submissions but does not hide existing receipts or released feedback.

### F3 — Submission review workspace

Goal: reduce teacher effort when reviewing a class set.

Backend — Codex:

- Add bounded roster/status projections: not submitted, submitted, marked, released.
- Keep existing save/release RPCs; add bulk release only if policy approval explicitly permits it.
- Add CSV export only from the authorized projection.

Frontend — Claude:

- Create a responsive student list and review pane inspired by the reference workflow, not its appearance.
- Support previous/next submission navigation without losing unsaved work.
- Surface the student's submission note beside the file.

Acceptance:

- Teachers see only pupils in managed tags.
- Navigation never crosses assignment/tag boundaries.
- Unsaved grade/feedback cannot be silently discarded.

### F4 — Individual exceptions

Goal: handle real school exceptions without weakening the class boundary.

- Model per-student due-date extensions and assignment withdrawal as audited grants.
- Never duplicate assignments merely to change one pupil's deadline.
- Require a reason and actor for every exception.
- Show the effective deadline consistently to student, teacher, guardian, calendar, and reports.

Exit gate: policy and safeguarding owner approve semantics and audit retention.

### F5 — PDF annotation

Goal: permit accessible feedback on submitted PDFs only if it is materially better than downloadable feedback.

- Store annotations as separate versioned JSON referencing immutable file coordinates; never modify the submitted original.
- Define supported operations before implementation: highlight, freehand, text note, shape, undo/redo.
- Separate private draft annotations from released feedback.
- Validate bounds, page numbers, payload size, authorship, and release state server-side.
- Provide a non-canvas accessible feedback representation and keyboard workflow.
- Test Safari/iPad, Chrome/Chromebook, touch, stylus, zoom, rotation, and large PDFs.

Exit gate: prototype passes accessibility and representative-device testing. Otherwise retain download plus textual feedback.

## 5. Work ownership and non-interference

| Area | Owner | Paths |
|---|---|---|
| Product decisions/acceptance | Human product owner | ADR approval and UAT sign-off |
| Database, RLS, RPCs, server validation | Codex | `supabase/**`, `lib/content/**`, `app/actions/**`, generated DB types |
| Interaction and responsive presentation | Claude | assigned `components/**` and presentation-only route files |
| Shared contracts and integration | Serial integration task | one owner at a time; merge backend contract before UI work |
| End-to-end role tests | Serial integration task | `e2e/**` |

Before either agent starts a package, record its branch, worktree, exact owned files, dependencies, and acceptance gate in `docs/coordination/ACTIVE_WORK.md`. Never let both agents edit the same checkout or shared contract concurrently.

## 6. Definition of done for every package

- Acceptance criteria demonstrated for student and teacher roles in a real browser.
- Direct URL and forged-request authorization tests pass.
- Format, lint, typecheck, unit tests, production build, E2E, dependency audit, secret scan, and fresh-database pgTAP are green.
- No production-only no-op or demo bypass is introduced.
- Documentation, UAT steps, rollback, and known limitations are updated.
- The package is deployed to the share demo only after CI passes.

## 7. Explicitly deferred

- Firefly visual cloning, themes, promotional app panels, and decorative dashboard modules.
- Bidirectional pupil messaging until safeguarding/moderation ownership is approved.
- Production file submission until a real malware scanner and worker are deployed.
- Inline PDF annotation until F1–F4 are stable and its accessibility/device gate passes.
- Live timetable/MIS integration until the school supplies a real contract and staging credentials.

## 8. Next authorized action

Do not start F1 implementation until the product owner confirms:

1. assignment instructions should reuse a canonical Project M page;
2. instructions may be optional; and
3. late work is rejected by default unless an audited individual extension exists.

