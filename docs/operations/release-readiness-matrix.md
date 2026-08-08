# Project M Release Readiness Matrix

Last engineering verification: 2026-08-08. This is the handbook's completion ledger; historical package state remains in `docs/coordination/ACTIVE_WORK.md`.

## Locally complete and verified

| Area | Evidence |
|---|---|
| Identity boundary | Fail-closed institutional admission, role-aware login flow, protected routes, guardian admission separated from Entra; auth pgTAP tests |
| Authorization | RLS-backed anonymous/student/teacher/admin/guardian isolation, all-tags-required teacher writes, disabled-user handling; 309 total pgTAP assertions |
| Content | Canonical pages, block validation/sanitization, drafts/publishing, optimistic concurrency, revisions/restore, MPX/PDF transfer and bounded imports |
| Assessment | Assignment submission/receipts/review, quizzes/question bank/deterministic grading, separate save/release grade workflow, released-only student/guardian projections |
| School workflows | Tags/admin audit, roster dry-run/apply, calendar, announcements, search, operational reports, staged migration manifests |
| File security | Private Storage, bounded metadata and signatures, checksum verification, recoverable worker leases, audited ready/quarantine/failure outcomes; production no-op scanner prohibited |
| Web security | Nonce CSP in production, security headers, origin/session protections, bounded search/migration/roster/uploads, safe errors, dependency and secret scanning |
| Accessibility baseline | Skip links/focus targets, lint rules, automated WCAG 2.2 axe checks on public routes, keyboard-aware controls |
| Delivery | CI, fresh-database migration tests, production build, browser smoke tests, readiness endpoint, release/incident/restore/UAT procedures |

Latest clean local gate:

- `npm run check`: 72 tests, lint/typecheck/format/build passed.
- `npx supabase test db`: 24 files, 309 assertions passed.
- `npm run test:e2e`: 4 Playwright tests passed.
- `npm audit --omit=dev`: zero vulnerabilities.
- Live `GET /api/health`: HTTP 200 with local Supabase.

## External release blockers

These cannot be completed truthfully from this repository. Each requires the named real system, accountable human, or representative user/device.

| Blocker | Completion evidence required |
|---|---|
| Microsoft Entra production SSO | Tenant ID/app registration, exact issuer/provider configuration, redirect URLs, guest/emergency-access policy, accepted- and rejected-tenant tests |
| Malware protection | Production scanner adapter/service, deployed verification worker, clean/malicious sample evidence, alert owner |
| Guardian/privacy governance | Approved DPIA, guardian-link evidence and retention policy, named privacy/safeguarding owner |
| Bidirectional messaging | Named safeguarding/moderation/escalation owner and approved workflow; one-way announcements remain the safe shipped boundary |
| SCORM/LTI | Real allow-listed tool/package and staging security validation; no unverified third-party JavaScript runtime is shipped |
| Live MIS and Moodle backup adapters | API contract/credentials and representative `.mbz` backups plus content-owner validation; bounded CSV/manifest engines are shipped |
| Compliance exports | Named privacy/report owner, approved catalogue/semantics/retention; current reports are operational only |
| Production operations | Isolated environments, secret manager, monitoring/alerts, verified backups and isolated PITR restore rehearsal, named incident/release owners |
| Human quality gates | Authenticated WCAG 2.2 AA walkthrough, representative-device performance results, role-based staging UAT/pilot and recorded sign-off |

Project M therefore has a **locally verified release-1 MVP, but is neither feature-complete against every PM-02 launch journey nor authorized for production use**. Remaining repository work and external enablement must be tracked separately; neither category is complete until its evidence is recorded.
