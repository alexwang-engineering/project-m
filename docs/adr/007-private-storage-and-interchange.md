# ADR-007: Private Storage and Bounded Interchange

Status: Accepted  
Date: 2026-08-04

## Decision

Use private object storage with authorization-checked short-lived access. MPX is a versioned untrusted interchange format with manifest, sizes, media types, and SHA-256 checksums. Imports enforce path/count/size/decompression limits and preview before persistence. SCORM runs isolated with strict sandbox/CSP controls.

## Consequences

Public object URLs are prohibited for confidential content. Upload authorization, metadata, and object persistence must be coordinated transactionally and cleaned up on failure.
