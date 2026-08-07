# ADR-017: Operational Reporting Scope

Status: Accepted
Date: 2026-08-07

## Context

PM-01 named "compliance reporting" as Launch scope, and the collaboration plan's own Phase 5G already fixes what a *real* compliance reporting feature requires: a defined report catalogue with owner/definition (X1-01), and an acceptance gate that states plainly *"compliance claims receive human approval."* X1-01 itself requires "human reporting/privacy review" before a report ships. This is the same shape as the messaging/safeguarding-owner split already recorded in ADR-012: the plan itself withholds the "compliance" label from anything this project builds unsupervised, for a school application handling minors' data.

Asked the product owner directly how to proceed. Confirmed: build the part that doesn't need that sign-off - **operational reporting**, not compliance reporting. Anything that would carry a real regulatory/compliance claim (GDPR data-subject exports, safeguarding audit trails, DfE/Ofsted-style evidence packs) stays named and unbuilt, tracked the same way messaging is tracked in ADR-012, pending the same kind of named human reviewer X1-01 already requires.

## Decision

### No new migration, no new RPC, no new authorization logic

Every table this reporting surface reads already has an RLS policy with an `institution_admin` bypass, verified directly rather than assumed: `profiles_read_self_admin`, `roles_read_self_admin`, `memberships_read_self_admin` (`... or current_principal_is_admin()`), and `can_read_page`/`can_manage_assignment`/`can_manage_quiz`-backed policies (`... or has_system_role('institution_admin', ...)`), plus `audit_read_admin` on `audit_events` itself (admin-only, no bypass needed since it's already the narrowest policy in the project). An institution admin can already read every row of every table this feature touches through the exact same RLS this project has relied on since Package D. This mirrors ADR-016's search design taken one step further: not just "no new authorization logic," but no new database object of any kind.

### Report catalogue (v1)

- **Audit log**: a filterable (date range, action, target type) view over `audit_events`, capped at 5,000 rows per query/export - a real row limit (X1-02's own requirement), not unbounded. This is the same audit trail every package this session has already been writing to; this is its first read surface.
- **Roster summary**: counts by system role and account state (active/disabled), and tag membership counts per tag - aggregate `profiles`/`role_assignments`/`tag_memberships`, no per-person detail beyond what `/admin`'s roster already shows.
- **Content summary**: counts of pages by lifecycle, and counts of assignments/quizzes/announcements/calendar events plus submissions/attempts - operational health at a glance, not a gradebook duplicate.

### CSV export must resist formula injection

PM-04 and the plan's own acceptance gate both name this explicitly. Any cell whose value starts with `=`, `+`, `-`, or `@` is prefixed with a leading `'` before being written - the standard OWASP mitigation for spreadsheet formula injection, since a naive export of admin-entered or MIS-synced free text (a tag's display name, an audit action's reason field) into a `.csv` a school later opens in Excel could otherwise execute as a formula. A real RFC4180-shaped writer (proper comma/quote/newline escaping) is used for the export, not the simplified plain-split parser Package U's roster CSV *reader* used - that one got away with simplicity because its input format was entirely this project's own, fixed schema; this one exports admin-entered free text with no such guarantee.

### Explicitly not built, and why

- **No GDPR data-subject access/erasure export.** That is a real DPIA-gated capability, same standing gap ADR-013 already named for guardian data specifically - now generalized. Requires a named privacy reviewer, not an engineering scope decision.
- **No safeguarding-specific reporting.** Same boundary as ADR-012 - no safeguarding data model or escalation reporting exists in this project, and this package does not create one.
- **No scheduled/recurring report delivery, no materialized views, no report builder.** All three name real future infrastructure (X1-02's "materialization," X1-03's "report catalogue... export-progress UI") this v1 doesn't need at Launch scale - live queries against already-indexed tables are fast enough, and a fixed three-report catalogue doesn't need a builder.

## Consequences

Tests must cover: a non-admin cannot read any of the three reports (the existing RLS policies already guarantee this, but the report queries themselves must be confirmed to inherit it, not bypass it via an unexpected `SECURITY DEFINER` path), the audit log respects its row cap and date-range filter, and the CSV export correctly neutralizes a formula-injection payload in at least one exported field. Real compliance reporting (GDPR exports, safeguarding audit evidence) remains a named, tracked gap pending a human reporting/privacy reviewer, exactly as X1-01 and ADR-012 already require.
