# PM-02 — Service Targets, Scale, and Launch Journeys

Status: Proposed for product-owner and school-stakeholder approval.

## Initial capacity envelope

The first release will be designed and load-tested for 800–2,500 active accounts with staggered school-day use and occasional class-time bursts, 100,000 pages/files, approximately 500 GB of private objects over two to three years, 50,000 active assignments per academic year, and 1,000,000 submission/attempt/grade records per academic year. Concurrency assumptions must be measured during pilot rather than inferred from total accounts. These are engineering assumptions, not procurement promises; actual school figures must replace them before production sizing.

## Service objectives

| Measure | Initial target |
|---|---|
| Authenticated page/dashboard response | p95 under 500 ms in-region, excluding file transfer |
| Main journey usable | p75 under 2.5 s on representative school Wi-Fi/device |
| Immediate interaction feedback | under 100 ms; progress indicator after 300 ms |
| Search response | p95 under 750 ms at the capacity envelope |
| Availability/support | Active monitoring and school-hours support (target window 07:00–18:00 term time); best effort outside it |
| Recovery point/time | Hours initially using approved backup capability; both tightened to under one hour before Phase 7 launch |
| Accessibility | WCAG 2.2 AA for all launch journeys |
| Browser support | Current and previous Chrome, Edge, and Safari major versions |
| Individual PDF | 25 MB maximum by default |
| MPX extraction | 500 MB hard maximum with lower environment quotas permitted |

## Required launch journeys

### Student

1. Use Entra SSO and see only assigned courses/tags.
2. Find and read a canonical page or private file.
3. View deadlines and calendar items.
4. Start, save, submit, and confirm an assignment.
5. Complete an allowed quiz attempt and receive policy-appropriate feedback.
6. Review released grades and teacher feedback.
7. Receive an authorized announcement/message without metadata leakage.
8. Launch an approved LTI/SCORM activity.

### Teacher

1. Create, revise, publish, archive, import, and export tagged content.
2. Create an assignment with audience, deadline, rubric, and submission policy.
3. Review submissions, annotate/mark, moderate where required, and release feedback.
4. Create a question bank and quiz with deterministic grading rules.
5. Manage calendar entries and announcements for authorized groups.
6. Review gradebook data only for authorized cohorts.
7. Resolve concurrent edits without silently losing work.

### Parent or guardian

1. Use a separately approved identity/linking mechanism.
2. View only information explicitly released for linked pupils.
3. Never gain access to teacher-only material, another child, safeguarding notes, or unreleased grades.

### Admin and operations

1. Provision roles/tags and reconcile MIS/SIS roster changes.
2. Configure approved LTI tools and migration jobs.
3. Audit privileged/content/grade actions.
4. Run academic-year rollover without deleting history.
5. Export approved compliance/operational reports.
6. Restore data and execute emergency access using documented procedures.

## Pilot success criteria

- No critical or high-severity unresolved security issue.
- Zero known cross-user, cross-tag, cross-pupil, or unreleased-grade disclosure.
- At least 95% successful completion of the top launch journeys without support intervention.
- WCAG 2.2 AA audit passes launch journeys, with any exception explicitly accepted by a named owner.
- Performance targets pass on representative managed and pupil devices.
- Backup restore, rollback, and incident escalation are rehearsed.
- Teachers and students rate the core content, assignment, and submission flows measurably easier than the legacy baseline.

## Human confirmations still required

Actual enrolment/staff counts, school service hours, existing storage and annual growth, exam/marking blackout periods, browser/device estate, pilot departments and dates, retention periods, and named product/privacy/safeguarding/operations approvers.
