# Project M Release and Incident Runbook

Status: engineering procedure complete; named school owners and production services pending.

## Release gate

Do not admit real users until every item is evidenced, not merely asserted:

- Microsoft Entra tenant/app registration, issuer restriction, redirect URIs, guest policy, emergency owner, and a real rejected-tenant test.
- A production malware scanner configured for the upload-verification worker. The development no-op scanner is prohibited in production.
- DPIA plus named privacy/safeguarding approval for guardian data and the guardian-link evidence policy.
- Named safeguarding owner before bidirectional messaging is reconsidered.
- Isolated preview, staging, and production Supabase projects; production secrets stored only in the host secret manager.
- Monitoring of `GET /api/health`, HTTP 5xx/error rate, authentication failures, file-verification queue age/failures, database/storage capacity, and backup status. Alerts must name a recipient and escalation path.
- A successful restore rehearsal into an isolated project, authenticated WCAG 2.2 AA walkthrough, representative-device performance run, and role-based UAT sign-off.
- `npm ci`, `npm run check`, `npm run test:e2e`, `npx supabase test db`, and `npm audit --omit=dev` pass from the release commit. GitHub Actions must be green.

## Deploy and rollback

1. Record release commit, migration list, approver, start time, and rollback owner.
2. Back up production and confirm the provider reports the backup healthy.
3. Deploy database migrations before the compatible application build. Migrations are append-only and must remain backward-compatible during rollout.
4. Smoke-test `/api/health`, login/logout, student dashboard/read/submission, teacher create/edit/mark/release, admin roster/audit, and guardian released projection.
5. Watch alerts and application/database logs through the agreed observation window.
6. For an application regression, redeploy the last known-good build. Do not reverse an applied migration destructively; ship a forward repair migration.
7. If integrity or isolation is uncertain, disable admission/writes, preserve audit evidence, and escalate before attempting repair.

## Incident priorities

| Priority | Examples | Immediate action |
|---|---|---|
| P0 | Cross-user data exposure, compromised privileged account, destructive corruption | Contain immediately; disable affected access/write path, preserve evidence, notify safeguarding/privacy and technical owners |
| P1 | Login unavailable school-wide, submissions/marking unavailable, malware pipeline stopped | Page the school-hours technical owner, declare incident, restore service or invoke rollback |
| P2 | Degraded single feature with safe fallback | Record, assign owner, communicate workaround, repair in normal release flow |

Never include access tokens, cookies, student content, marks, or full email addresses in tickets or chat. Record UTC timestamps, correlation IDs, affected routes/roles, release commit, containment actions, and decisions. Only the designated privacy/safeguarding owner decides external notification duties.

## Backup and restore rehearsal

The Supabase owner must document the actual plan/tier, backup frequency, retention, PITR window, RPO/RTO, and emergency contacts. At least once before launch and on the agreed recurring schedule:

1. Select a timestamp and create an isolated restore target; never rehearse over production.
2. Restore Postgres and private Storage according to the provider procedure.
3. Deploy the matching application commit and secrets to the isolated target.
4. Verify row counts and representative page, assignment, attempt, released-grade, guardian, audit, and file records.
5. Run authorization smoke tests for anonymous, student, teacher, admin, and guardian users.
6. Record start/end time, achieved RPO/RTO, discrepancies, owner, and corrective actions.
7. Destroy the rehearsal environment through the approved retention process after evidence is accepted.

## Routine operations

- Daily on school days: review availability/error alerts and old `pending`/`scanning` uploads.
- Weekly: review privileged audit events, failed/quarantined files, capacity trend, and disabled/leaver accounts.
- Each term: review role/tag grants, emergency access, dependencies, restore evidence, retention actions, and incident contacts.
- Each release: keep the prior application build deployable and record migration compatibility.
