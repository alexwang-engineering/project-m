-- P0 remediation: completeFileUpload previously ran in response to an
-- ordinary browser Server Action call (app/actions/files.ts) and only
-- checked the uploaded object's size against what was declared - no
-- checksum recomputation, no signature check, no malware scan. That
-- function and its browser-callable action are removed in this same
-- commit; this migration adds the schema the real trusted worker
-- (lib/files/verification-worker.ts, run via scripts/verify-uploads.ts,
-- never imported by any browser-reachable route or action) needs to record
-- a genuine pending -> scanning -> ready | quarantined | failed outcome.

alter table public.files
  add column scanned_at timestamptz,
  add column quarantine_reason text;

alter table public.files
  add constraint files_quarantine_reason_consistent check (
    (state = 'quarantined') = (quarantine_reason is not null)
  );

-- Deliberately no NOT NULL/check constraint tying scanned_at to a terminal
-- state: it's observability metadata the real worker always sets, not a
-- security invariant, and several existing pgTAP fixtures across this
-- suite legitimately hand-insert a `ready` file directly (bypassing the
-- worker entirely) to set up read-authorization tests that have nothing to
-- do with the verification pipeline. Forcing every one of those fixtures
-- to also fabricate a scan timestamp would be test churn with no real
-- safety benefit - the actual trust boundary this migration closes is that
-- no browser-reachable code can write files.state at all (see the note at
-- the bottom of this file), which this column doesn't affect either way.

-- The worker polls for state = 'pending' in creation order; index it the
-- same way pages/tag_memberships already have authorization-lookup indexes
-- per 002_security_invariants.sql's own asserted convention.
create index files_pending_queue_idx on public.files (created_at) where state = 'pending';

-- No RLS/grant change is needed here: files already has zero UPDATE policy
-- for authenticated/anon (files_read_owner is SELECT-only), and service_role
-- already holds blanket table grants from 20260806050000_grant_service_role_
-- privileges.sql. The trust boundary this migration closes is architectural,
-- not a database grant that was missing - completeFileUploadAction is
-- deleted so no browser-reachable code path can trigger a state transition
-- at all, genuine or not.
