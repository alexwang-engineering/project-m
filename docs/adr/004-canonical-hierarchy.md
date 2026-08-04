# ADR-004: Canonical Hierarchy Separate from Tags

Status: Accepted
Date: 2026-08-04

## Decision

Pages use one optional parent, one slug, and one canonical path. Tags control audience/feed placement but do not form the hierarchy. Moves/renames create redirects; cycles and duplicate sibling slugs are rejected.

## Consequences

A page can surface in many tag feeds while retaining one authoritative URL. Schema and routing work must introduce explicit hierarchy and redirect records.
