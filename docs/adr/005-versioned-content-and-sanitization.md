# ADR-005: Versioned Content and Sanitization

Status: Accepted  
Date: 2026-08-04

## Decision

Persist versioned allow-listed editor blocks. Validate structure and sanitize rich-text fragments on the server; render only known blocks. Store file references as controlled IDs. Unknown blocks fail closed on writes and render a safe unsupported state on older readers.

## Consequences

Arbitrary HTML is not a content model. Schema upgrades require explicit migrations/compatibility behavior and security regression tests.
