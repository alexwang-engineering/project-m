# PM-04 — Initial Threat Model and Data Classification

Status: Initial model. Re-audit at each subsystem design and before pilot.

## Trust boundaries

Untrusted boundaries include browsers, uploaded files, rich text, MPX/SCORM packages, LTI tools, email/webhook input, MIS/SIS feeds, migration exports, client-supplied IDs/tags/roles, and all cross-user identifiers. Supabase service-role credentials and administrative database functions are highly privileged boundaries.

## Data classes

| Class | Examples | Baseline controls |
|---|---|---|
| Public | Deliberately public learning pages | Explicit publication, integrity/audit controls |
| Internal | General learning resources and non-sensitive announcements | Authenticated access and private storage by default |
| Confidential | Identity, memberships, private content, messages, audit data | RLS, encryption, least privilege, access logging |
| Highly sensitive | Submissions, marks, feedback, parent links, SEND/health or safeguarding references | Field-level minimization, strict cohort/link policies, release controls, DPIA/retention approval |
| Secret | Service keys, Entra/LTI/MIS credentials, signing secrets | Managed secret store, rotation, no client/log/source exposure |

Project M must not become a general safeguarding or medical-record system. Any such workflow requires separate human policy, data model, access, incident, and retention approval.

## Priority threats and mandatory controls

| Threat | Control required before pilot |
|---|---|
| Wrong-tenant/account admission | Entra tenant/issuer restriction, verified email, provider restriction, negative tests |
| Role/tag/class spoofing | Server-derived identity, RLS, constrained transactional functions, adversarial tests |
| Cross-cohort content or grade access | All-tag writes, explicit assessment membership, release-state checks in every query |
| Parent sees wrong pupil | Verified relationship source, unique active links, deny-by-default projections, unlink/revocation workflow |
| Search/notification/file metadata leakage | Authorization inside source query, generic denial, private storage, leakage tests |
| XSS/rich-content injection | Versioned block validation, server sanitization, safe renderer, CSP, regression corpus |
| Malicious MPX/SCORM/PDF | Path/count/size/decompression limits, signatures/checksums, isolated SCORM, preview |
| LTI impersonation/replay | LTI 1.3 OIDC, issuer/deployment allow-list, nonce/state validation, key rotation |
| Submission tampering | Ownership checks, immutable receipt, server timestamp, hash/version, deadline policy |
| Quiz answer disclosure | Separate authoring/delivery projections, server-side grading, attempt-state enforcement |
| Grade tampering or premature release | Explicit permissions, immutable audit, moderation/release workflow, no client authority |
| Message abuse or unsafe disclosure | Audience controls, reporting/moderation, retention, rate limits, safeguarding escalation |
| MIS sync corruption | Signed/secured channel, dry run, idempotency, reconciliation report, reversible changes |
| Migration corruption | Staging, checksums, mapping report, quarantined failures, sampled human verification |
| Service-key exposure | Server-only imports, environment separation, bundle/secret scans, log redaction |
| Data loss | PITR/backups, revisions, restore rehearsal, archive-first deletion, migration rollback |
| Availability abuse | Rate/request/job quotas, timeouts, indexed queries, backpressure, monitoring |
| Dependency compromise | Lockfile, minimal packages, audits, update policy, CI provenance checks |

## Required security test identities

Anonymous; student A and B in same class; student C in another class; teacher owning all page tags; teacher owning only one of several tags; teacher from another class; parent linked to one pupil; unrelated parent; content admin; assessment admin; integration service; disabled/leaver account.

Every sensitive feature must include positive and negative tests across relevant identities before its package can be merged.
