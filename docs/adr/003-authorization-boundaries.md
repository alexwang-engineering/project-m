# ADR-003: Authorization Boundaries

Status: Accepted
Date: 2026-08-04

## Decision

Reads may use any matching audience tag plus lifecycle rules. Teacher content writes require every existing and proposed tag or an explicit editor grant. Assessment access uses explicit class/assessment membership. Parent views use verified pupil links and released-field projections. RLS and constrained transactional database functions are authoritative.

## Consequences

Client helpers cannot grant authority. Multi-row content/tag/assessment changes must be atomic. Tests must cover partial-tag teachers, cross-class users, unrelated parents, unreleased grades, and disabled accounts.
