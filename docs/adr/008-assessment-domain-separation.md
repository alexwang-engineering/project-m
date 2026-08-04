# ADR-008: Assessment-Domain Separation

Status: Accepted  
Date: 2026-08-04

## Decision

Assignments, submissions, quizzes, attempts, gradebook entries, rubrics, feedback, and releases form a dedicated assessment domain. They reference content/users/classes but do not reuse generic page-tag authorization as their only access rule.

## Consequences

Question authoring and delivery use separate projections; answers never reach clients before policy permits. Submissions receive immutable server receipts. Grade calculation, moderation, override, and release are auditable operations with explicit permissions.
