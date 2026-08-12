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
| Completion-only/comment-only response | Excluded pending school policy | File submission plus an optional student note is the approved local workflow |
| Teacher submission review | Implemented | Improve presentation only after workflow tests |
| Return/reopen work for correction | Excluded pending school policy | Retain immutable resubmission; add a formal return transition only after its deadline and notification semantics are approved |
| Submission activity timeline | Implemented 2026-08-11 | Retain the authorized chronological review projection |
| Save mark and release feedback | Implemented as separate audited actions | Retain; safer than Firefly's combined menu |
| Gradebook/markbook | Implemented | Add filters/export only when stakeholder need is confirmed |
| Announcements | Implemented one-way | Bidirectional messaging remains blocked by safeguarding approval |
| Calendar/deadlines | Implemented | Integrate assignment deadlines into journey testing |
| Rich task instructions | Implemented locally 2026-08-11 | Published canonical page picker, audience coverage enforcement, embedded student view, and canonical link |
| Preview before setting work | Implemented 2026-08-11 | Retain the server-authorized student projection for saved drafts |
| Start date/scheduled availability | Implemented 2026-08-11 | Keep availability separate from publication and submission closure |
| Draft assignment lifecycle | Implemented 2026-08-11 | Retain audited draft, publish, close and archive transitions |
| Parent/markbook visibility toggles | Guardian access already uses released-only projections | Keep the safer release policy; do not copy per-task visibility checkboxes |
| Inline PDF review/replacement | Implemented 2026-08-12 | Page and submitted PDFs use authorized inline preview plus a separate original download; page replacement preserves the prior file record |
| Inline PDF annotation | Deferred — external evidence required | Reopen only with the F5 annotation model, representative-device testing and accessibility ownership |
| Individual-student exceptions | Implemented 2026-08-11 | Retain reasoned, audited extensions and withdrawals without deleting history |
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

### 3.2 Firefly Learning playlist evidence

Reviewed 2026-08-12: the [19-video Firefly Learning playlist](https://www.youtube.com/playlist?list=PLTDRhsdxjbbxiNgEzcLhAmrGk8kXcMYgh) linked by the product owner (approximately 39 minutes). Sixteen videos had usable English spoken transcripts, video 14 had a music-only caption track, and videos 4 and 5 had no accessible transcript. Claims from the final three videos are excerpts from longer talks, so they establish design principles rather than complete research findings. Promotional claims are reference evidence, not independently validated outcomes.

| # | Video | Verified lesson for Project M |
|---|---|---|
| 1 | What is Firefly? | Keep assignments, resources, feedback, progress and parent involvement in one authorized learning loop. |
| 2 | Product Tour | Support rich instructions, multi-device submission, in-site file review, annotation/feedback, private marking and deliberate release. |
| 3 | Firefly Expo Highlights | Treat pupil value, teacher agency and school culture as outcomes; analytics must support rather than replace human judgment. |
| 4 | What's it like to work at Firefly? | No product requirement accepted: no accessible transcript and the title concerns company culture. |
| 5 | How does Firefly empower students? | No detailed requirement accepted without a transcript; the title only corroborates student agency as a discovery topic. |
| 6 | Firefly Learning Roadshow 2018 | Reusable subject-specific practice and staff enablement matter, but the automatic transcript is too weak for detailed requirements. |
| 7 | Born for schools | Provide a school-specific, adaptable gateway supporting homework, timetable/messages, varied media and approved external services. |
| 8 | Liberate your teachers | Prefer reusable pages, embedded tools, cross-department sharing and less reminder/marking administration. |
| 9 | Make it your own | Reflect school structure, identity, policies, programmes and extracurricular areas without weakening authorization. |
| 10 | Curated views for everyone | Give each role a relevant homepage and protect pupil information; do not expose a generic shared dashboard. |
| 11 | 360-degree observability | Authorized profiles should combine progress, targets, homework, attendance and behaviour only when approved source contracts exist. |
| 12 | Encouraging two-way dialogues | Preserve feedback history, clarification and retry workflows; safeguarding approval remains mandatory before pupil messaging. |
| 13 | Quick tour | A guardian view should prioritize announcements, events, linked-pupil reports, attendance, behaviour, outstanding work, released feedback and timetable. |
| 14 | Helping parents support learning | No detailed requirement accepted: the available track contains no substantive narration. |
| 15 | Firefly and Microsoft | Integration is valuable when it consolidates real classroom context and tools; do not add integrations solely for feature parity. |
| 16 | Parent engagement research | Design support around realistic family routines and short, useful prompts rather than assuming time, space or confidence. |
| 17 | Bridging the parent engagement gap | Remove language and access barriers; use plain, translatable formats and avoid labelling families as “hard to reach.” |
| 18 | Engage the whole school community | Identify recipient barriers and coordinate teacher, pupil, parent and leadership communication around student outcomes. |
| 19 | Saving teacher time and engaging parents | Measure whether communications are viewed and acted on; prefer concise, accessible formats and consistent structure over publication volume. |

Playlist-backed priorities and verified implementation status:

| Priority | Status | Repository evidence or gate |
|---|---|---|
| Canonical, tag-authorized content and role-aware dashboards | Implemented | RLS-filtered page feed, real role identity, role-gated actions and tag-scoped announcements; the compact shell is shared rather than a separate dashboard per role. |
| Non-destructive, accessible PDF annotation | Deferred — external evidence required | Authorized inline preview, original download and teacher replacement are implemented; F5 requires representative-device and accessibility ownership before annotation. |
| Private draft feedback with explicit release | Implemented | Draft grades/feedback and audited release use separate database actions and student/guardian projections expose only released results. |
| Authorized submission/feedback history | Implemented | `assignment_submission_timeline` is permission-checked and rendered in the teacher review workspace. Real-time pupil messaging remains blocked by safeguarding policy. |
| Guardian views centred on linked-pupil actions and released data | Partially implemented | Linked-pupil deadlines/events, announcements and released grades/feedback exist. Attendance, behaviour, reports and live timetable data require approved MIS/source contracts and are not implemented. |
| Communication delivery/view analytics | External policy gate | No read/view tracking exists. Privacy, retention, success measures and a named owner are required before implementation. |
| Microsoft classroom/productivity integration | External system gate | Entra sign-in boundary exists; OneDrive, OneNote, Teams and Microsoft Graph classroom integrations do not. A real tenant/tool contract and demonstrated teacher-time benefit are required. |
| Reusable teacher resources across staff/departments | Partially implemented | Canonical pages can serve multiple authorized audiences, but there is no explicit cross-teacher copy/template/share workflow. Its ownership and lifecycle semantics require product approval. |

## 4. Delivery order

### F0 — Workflow evidence and contracts

Goal: resolve each remaining contract gap before its dependent backend or UI package starts.

Status: locally closed for approved workflows on 2026-08-11. Scheduled availability, draft/publish/archive, resubmission, extensions and withdrawals are implemented. Completion-only responses and formal return-for-correction remain deliberately excluded until school policy defines their semantics; representative-device and human UAT remain external gates.

Decision record:

- The shared lifecycle is `draft → published → archived`; the submission window (`not_open`, `open`, `closed`) and grading/release are separate.
- Scheduled availability is included; no-file completion/comment-only responses are excluded pending school policy.
- Formal return-for-correction is excluded pending approved deadline, notification and receipt semantics.
- Canonical instructions pages are optional and must be published and readable by the full audience before assignment publication.
- Immutable resubmission, reasoned extensions and withdrawals are implemented; broader late-work policy remains a school decision.
- Assignment-state and exception authorization is enforced and covered by the database test suite.
- Representative desktop, tablet and mobile evidence remains part of the named human quality gate, not a local engineering claim.

Resolved baseline mismatches:

- Assignment creation is draft-first, with separate audited publication and submission-window state.
- The live assignment model now implements the lifecycle described by the migration ADR.

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

- Fresh migration-chain verification completed in GitHub CI on 2026-08-11.
- Obtain school policy approval before adding completion-only responses, comment-only responses, return-for-correction, bulk grade release, or CSV export.
- Re-open inline PDF annotation only with representative devices and an accessibility test owner.
- Deploy the share demo only after CI and the fresh-database gate pass.
