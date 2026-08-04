# ADR-006: Lifecycle, Revisions, and Release

Status: Accepted  
Date: 2026-08-04

## Decision

Content uses draft/published/archived states. Assessments additionally use scheduled/open/closed/marking/released states. Material content and grade changes are revisioned/audited. Optimistic concurrency prevents silent overwrite. Saving marks and releasing them are separate actions. Ordinary users archive instead of hard-delete.

## Consequences

Every mutation contract includes expected version and lifecycle validation. Retention jobs, not UI actions, perform approved permanent deletion.
