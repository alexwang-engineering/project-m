# ADR-008: Assessment-Domain Separation

Status: Accepted
Date: 2026-08-04

## Decision

Assignments, submissions, quizzes, attempts, gradebook entries, rubrics, feedback, and releases form a dedicated assessment domain. They reference content/users/classes but do not reuse generic page-tag authorization as their only access rule.

## Consequences

Question authoring and delivery use separate projections; answers never reach clients before policy permits. Submissions receive immutable server receipts. Grade calculation, moderation, override, and release are auditable operations with explicit permissions.

## 2026-08-05 addendum — MVP scope narrowed by product owner

The decision above describes the eventual full assessment domain (rubrics, moderation, grade calculation, release workflow) and remains the long-term target. The product owner has since clarified, in plain terms, what the *first* release of "assignments" actually needs to do: **accept a submission with a timestamp** — a student attaches a file (or uses the same page/content authoring the rest of the product uses) against an assignment, and the system records who submitted what, and when, immutably. It does not need grading, rubrics, moderation, or a release workflow to be useful at launch.

This means the assessment domain's tables/functions should be built in the same layered way pages were (see ADR-005, ADR-006): a minimal `assignments` + `submissions` slice first (definition, deadline, submission record with an immutable server-set timestamp, one-submission-per-student-per-assignment-unless-resubmission-allowed), reusing the existing audited-mutation-function and page-tag-authorization patterns already proven for pages, with gradebook/rubric/moderation/release layered on top later as genuinely separate, additive work — not blocking the first release.

**Core content clarification, same conversation:** the product owner also confirmed pages are primarily about **hyperlinks, images, and PDFs** — not a generic open-ended block schema. The versioned block contract from ADR-005 should be read with that in mind: the block union needs to cover rich text, links, images, and PDF/file attachments well, rather than trying to anticipate every possible block type up front.
