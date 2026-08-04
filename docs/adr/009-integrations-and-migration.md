# ADR-009: External Integrations and Migration

Status: Accepted  
Date: 2026-08-04

## Decision

Prefer LTI 1.3 for learning tools. MIS/SIS synchronization is idempotent, dry-runnable, reconciled, observable, and reversible. Moodle migration is staged, resumable, checksummed, mapped, and report-driven; the legacy service remains read-only until acceptance.

## Consequences

Each connector requires its own credential boundary, threat model, rate/retry behavior, audit events, failure quarantine, and contract tests. No connector may silently delete users, memberships, grades, or content.
