# ADR-010: Reliability, Audit, and Operations

Status: Accepted; school targets pending
Date: 2026-08-04

## Decision

Treat auditability, backups, restore, monitoring, incident response, accessibility, and performance budgets as release requirements. Start with the PM-02 targets and replace assumptions with school-approved figures before production.

## Consequences

Sensitive actions emit immutable structured audit events. CI, staged environments, operational alerts, backup/restore rehearsal, rollback, support ownership, and pilot evidence are required before general launch.
