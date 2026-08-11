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
| Show who else received the task | Firefly exposes a recipient-list option | Do not expose tag membership or other pupil identities to students |
| Task title, deadline, resubmission | Implemented | Retain |
| Student comment with submission | Implemented 2026-08-11 | Retain and test |
| Student file submission | Code and local verification complete | Disabled for production until the malware scanner and worker are deployed |
| Completion-only/comment-only response | Missing | Decide whether no-file tasks are required before adding another submission mode |
| Teacher submission review | Implemented | Improve presentation only after workflow tests |
| Return/reopen work for correction | Partial: resubmission exists, explicit teacher return does not | Decide the audited return/reopen semantics before adding it |
| Submission activity timeline | Receipts and audit events exist | Project an authorized chronological trail in the review workspace |
| Save mark and release feedback | Implemented as separate audited actions | Retain; safer than Firefly's combined menu |
| Gradebook/markbook | Implemented | Add filters/export only when stakeholder need is confirmed |
| Announcements | Implemented one-way | Bidirectional messaging remains blocked by safeguarding approval |
| Calendar/deadlines | Implemented | Integrate assignment deadlines into journey testing |
| Rich task instructions | Implemented locally 2026-08-11 | Published canonical page picker, audience coverage enforcement, embedded student view, and canonical link |
| Preview before setting work | Instruction-page preview implemented; complete assignment preview awaits drafts | Build the exact authorized student projection in F2 after Save draft |
| Start date/scheduled availability | Missing | Decide policy with lifecycle; do not expose unpublished work |
| Draft assignment lifecycle | Missing | Build after instructions, using the shared content lifecycle |
| Parent/markbook visibility toggles | Guardian access already uses released-only projections | Keep the safer release policy; do not copy per-task visibility checkboxes |
| Inline PDF annotation | Missing | Later package; requires an explicit annotation data model and mobile/accessibility proof |
| Individual-student exceptions | Missing | Later package; requires policy for extensions, withdrawals, and audit |
| Timetable/lesson panel | Calendar exists, live timetable integration does not | Integrate externally after MIS contract exists |
| Target grades/manual completed tasks | No approved source or policy | Defer to the assessment/MIS stream; never invent attainment data |
| Pupil personal tasks/pages/blog | Outside the assigned-work outcome | Defer unless school discovery establishes a separate need |
| Bookmarks/themes/apps promotion | Not required for the learning loop | Skip |

### 3.1 Picture-by-picture evidence

Each picture is evidence for an outcome, not permission to clone every control.

| Picture | Observable workflow | Essential Project M requirement | Explicit non-requirement or guardrail |
|---|---|---|---|
| 1 — task details | Teacher enters a title, start/due dates, visibility choices, rich instructions, then previews, drafts, or sets the task | Authorized tag audience, title, availability/deadline, canonical instructions and attachments, exact student-view preview, draft/publish split | Do not store a second unsafe HTML description or copy per-task guardian visibility; guardian results remain release-controlled |
| 2 — recipient selection | Teacher searches people/groups, selects a class, and may reveal co-recipients | Teacher can select only currently managed tags; the server revalidates every target on save | No unrestricted pupil directory, arbitrary individual targeting, or disclosure of tag membership to students |
| 3 — student file upload | Student chooses or drops a file and sends it | Private upload, validation, scanning, progress/error feedback, immutable receipt, idempotent submission | Drag-and-drop is optional convenience; native file selection must remain complete and accessible |
| 4 — clean PDF annotation | Teacher marks a submitted PDF and moves between pupils | Preserve the original, version annotation data, support keyboard/textual feedback, save safely before navigation | Canvas-only feedback and destructive PDF rewriting are prohibited |
| 5 — instruction editor | Teacher adds questions, images, files, galleries, links and formatted text, then previews | Reuse the existing block/page editor and sanitized canonical page rather than building another editor | Do not copy every toolbar item; add blocks only when a learning need and safe renderer exist |
| 6 — response workspace | Teacher sees roster status, submission events, files, marking actions, return-to-do, release, and previous/next navigation | Authorized roster projection, chronological receipt/audit trail, separate private save and explicit release, safe previous/next, optional audited return-for-correction | No combined action may accidentally publish a draft mark; no navigation outside the managed assignment audience |
| 7 — markbook | Teacher selects a class, compares pupils across tasks, views targets, exports, and can add completed work | Tag-scoped gradebook with released/authorized assessment data; export only if stakeholder testing confirms it | Target grades and manually injected completed tasks require an assessment/MIS contract and are not inferred from this picture |
| 8 — teacher dashboard | Teacher sees announcements, current/next lessons, bookmarks, search, role identity, and quick task creation | Compact role-aware dashboard, urgent one-way announcements, upcoming deadlines/calendar, existing search, clear teacher identity | No visual clone, theme marketplace, app promotion, or unmoderated messaging |
| 9 — annotation transition frame | The PDF view shows overlapping content while switching or rendering | Treat navigation/rendering as a data-integrity risk: cancel stale renders, isolate annotations by submission/page, and test rapid previous/next actions | The overlap is not a desired feature and must not be copied as visual behavior |
| 10 — student task | Student reads set-by/due information and instructions, then sends a file, marks done, or comments | One canonical task view with teacher, deadline, instructions, attachments, submission state, and the approved response modes | Do not implement completion-only or comment-only state until F0 confirms their semantics |
| 11 — duplicate dashboard evidence | A second frame confirms the same navigation and modular dashboard priorities | Use it as corroboration for picture 8, not as a separate feature source | Duplicate evidence does not justify duplicate widgets or scope |

## 4. Delivery order

### F0 — Workflow evidence and contracts

Goal: resolve each remaining contract gap before its dependent backend or UI package starts.

- Confirm the shared content lifecycle `draft → published → archived` and keep the submission window (`not_open`, `open`, `closed`) separate; grading/release remains submission-level.
- Confirm whether assignments need a scheduled start time and whether a no-file completion/comment response is required.
- Confirm whether teachers may formally return a submission for correction and what that does to its immutable receipt and deadline.
- Confirm whether an instructions page is required or optional.
- Confirm late-work, extension, withdrawal, and resubmission policies with school stakeholders.
- Extend the existing PM-04 role matrix with assignment-state and exception cases.
- Complete the representative desktop, tablet, and mobile evidence already required by PM-02/UAT.

Known baseline mismatches to resolve here:

- Current assignment creation publishes immediately, while the admin guide and migration ADR describe draft-first behavior.
- The Moodle migration ADR describes assignment lifecycle states that the live `assignments` table does not yet have.

Gate: each decision is recorded in an ADR before its dependent package starts; unanswered later-phase policy must not block earlier independent work.

### F1 — Assignment instructions

Goal: a student can understand the task without a separate message.

Status: implemented and locally verified 2026-08-11.

Backend — Codex:

- Reuse `assignments.instructions_page_id`; do not add duplicate description HTML.
- Add an authorized query for pages a teacher may attach.
- Verify the teacher owns every target tag and the selected page's audience covers every target tag (or the page is public) at creation time.
- Return the instruction-page summary in assignment projections.
- Add RLS/RPC and unit tests for cross-tag spoofing.

Frontend — Claude, after contract merge:

- Add an instruction-page picker to assignment creation.
- Show the instructions, attachments, due date, and submission state in one student task view.
- Preview the selected canonical instructions page before creation.
- Keep the default list compact; avoid a long dashboard feed.

Acceptance:

- A `Y9MA1` teacher cannot attach or target an unauthorized `L6CH2` page/tag.
- A student sees the same canonical instruction page regardless of entry point.
- A student never sees other recipients or tag membership through the task view or its metadata.
- Missing/archived instructions fail safely without exposing metadata.

### F2 — Draft, publish, and archive

Status: implemented and locally verified 2026-08-11.

Goal: teachers can prepare work without exposing it early.

Backend — Codex:

- Add an append-only migration for assignment lifecycle and publication timestamps.
- Update read/manage policies and audited RPCs.
- Derive or record scheduled/open/closed submission availability separately from publication state.
- Preserve existing assignments through a deterministic migration default.
- Provide a server-authorized preview projection for a saved draft that is identical to the eventual student-visible assignment and never exposes teacher-only data.

Frontend — Claude, after contract merge:

- Add Save draft, exact student-view preview, Publish, Close submissions, and Archive actions with clear confirmation and status labels.
- Show students only published/open work; retain teacher history views.

Acceptance:

- Draft assignments are undiscoverable to students through lists, direct URLs, search, and reports.
- State changes are audited and concurrency-safe.
- Closing prevents new submissions but does not hide existing receipts or released feedback.

### F3 — Submission review workspace

Status: implemented and locally verified 2026-08-11. Unapproved completion-only, comment-only, return-for-correction, bulk release, and CSV workflows remain excluded.

Goal: reduce teacher effort when reviewing a class set.

Backend — Codex:

- Add bounded roster/status projections: not submitted, submitted, marked, released.
- Project the immutable receipt and authorized audit events as a chronological submission trail.
- Keep existing save/release RPCs; add bulk release only if policy approval explicitly permits it.
- Add completion-only or comment-only submission transitions only if F0 confirms they are required; preserve the same receipt, authorization, deadline, and audit guarantees as file submissions.
- Add a return-for-correction transition only if F0 defines its deadline, resubmission, notification, and audit behavior.
- Add CSV export from the authorized projection only if stakeholder testing confirms it is needed.

Frontend — Claude:

- Create a responsive student list and review pane inspired by the reference workflow, not its appearance.
- Support previous/next submission navigation without losing unsaved work.
- Surface the student's submission note beside the file.
- Show only the response modes approved in F0 and make their resulting state explicit to the student.
- Show the authorized activity trail and, if approved, a clear Return for correction action.

Acceptance:

- Teachers see only pupils in managed tags.
- Navigation never crosses assignment/tag boundaries.
- Unsaved grade/feedback cannot be silently discarded.
- Returning work never edits or deletes the original submission receipt.

### F4 — Individual exceptions

Status: implemented and locally verified 2026-08-11. Extensions and withdrawals are per-pupil, reasoned, audited, and reflected in student, guardian, calendar, and teacher projections.

Goal: handle real school exceptions without weakening the class boundary.

- Model per-student due-date extensions and audience withdrawal as audited grants; withdrawal changes access but never deletes the assignment, receipt, or audit history.
- Never duplicate assignments merely to change one pupil's deadline.
- Require a reason and actor for every exception.
- Show the effective deadline consistently to student, teacher, guardian, calendar, and reports.

Exit gate: policy and safeguarding owner approve semantics and audit retention.

### F5 — PDF annotation

Status: closed on 2026-08-11 with the defined safe fallback. Project M retains immutable original-file download plus accessible textual feedback because the required representative-device and accessibility gate cannot be completed locally. Inline annotation remains deferred until that evidence exists.

Goal: permit accessible feedback on submitted PDFs only if it is materially better than downloadable feedback.

- Store annotations as separate versioned JSON referencing immutable file coordinates; never modify the submitted original.
- Key render and annotation state by submission, file version, and page; cancel or ignore stale renders when switching pupils.
- Define supported operations before implementation: highlight, freehand, text note, shape, undo/redo.
- Separate private draft annotations from released feedback.
- Validate bounds, page numbers, payload size, authorship, and release state server-side.
- Provide a non-canvas accessible feedback representation and keyboard workflow.
- Test Safari/iPad, Chrome/Chromebook, touch, stylus, zoom, rotation, large PDFs, and rapid previous/next navigation.

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

## 6. Definition of done for every integrated package

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

## 8. Remaining external gates

- Run the complete migration chain against a disposable fresh Supabase project; the local demo database is intentionally not reset because its seed is disabled.
- Obtain school policy approval before adding completion-only responses, comment-only responses, return-for-correction, bulk grade release, or CSV export.
- Re-open inline PDF annotation only with representative devices and an accessibility test owner.
- Deploy the share demo only after CI and the fresh-database gate pass.
