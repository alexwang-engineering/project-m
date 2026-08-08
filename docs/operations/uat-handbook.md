# Project M Role-Based UAT Handbook

Status: scenarios ready; execution requires the staging tenant, representative users/devices, and human sign-off.

Use synthetic data only. Give each tester a separate institutional or guardian account and record browser/device, role, timestamp, result, evidence link, severity, and issue owner. A failed isolation check is a release blocker.

## Student

1. Sign in through Microsoft and confirm the UI identifies the account as Student.
2. Confirm only assigned tags, pages, announcements, calendar entries, assignments, and quizzes are visible.
3. Follow a notification/search link and confirm the canonical URL is used.
4. Submit a PDF, retain the receipt, and verify resubmission/deadline rules.
5. Complete a quiz; confirm answers cannot be resubmitted or forged.
6. Confirm an unreleased mark/feedback is absent, then visible after teacher release.
7. Attempt direct URLs for another class and every create/edit/admin route; access must fail closed.

## Teacher

1. Sign in and confirm Teacher role and owned tags.
2. Create, edit, publish, export/import, and restore a page for an owned tag.
3. Create an assignment and quiz, review a submission, save a draft mark, and release it separately.
4. Confirm a teacher cannot read or mutate another tag by UI, copied URL, or modified request.
5. Verify malformed/oversized PDFs and MPX files fail safely and accessibly.
6. Keyboard-test navigation, dialogs/editor controls, save errors, and focus recovery.

## Institution admin

1. Create a tag; grant/revoke roles and memberships; disable an account; verify matching audit events.
2. Preview and apply a synthetic roster CSV. Confirm manual grants are preserved and leavers are disabled, not deleted.
3. Preview/apply a migration manifest twice; confirm unchanged items are skipped and conflicts are not overwritten.
4. Create and revoke a guardian link using the school-approved evidence policy.
5. Review operational reports and export CSV; confirm non-admin users cannot access them.

## Guardian

1. Sign in through the guardian magic link and switch between authorized children if applicable.
2. Confirm only linked pupils' deadlines, announcements, and released grades/feedback appear.
3. Confirm draft/unreleased grades, teacher-only data, unrelated pupils, expired/revoked links, and write controls are absent.

## Cross-cutting acceptance

- Run on representative low-end school hardware and weak Wi-Fi; capture LCP and interaction latency against PM-02 targets.
- Complete a keyboard-only and screen-reader walkthrough against WCAG 2.2 AA.
- Confirm logout invalidates protected navigation and no private response is cached publicly.
- Confirm errors are understandable and expose no stack trace, SQL, token, or private identifier.
- Record zero critical/high security findings and zero isolation incidents before sign-off.

Required signatories: product owner, technical/release owner, safeguarding/privacy owner, accessibility reviewer, and one representative each for student, teacher, admin, and guardian journeys.
