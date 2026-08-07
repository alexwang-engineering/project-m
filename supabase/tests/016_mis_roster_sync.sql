-- Package U (ADR-015): coverage for sync_roster, the apply_mis_roster_intents
-- trigger, and mis_roster_intents from 20260807070000_mis_roster_sync.sql.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-000000001001', 'roster-admin@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000001002', 'roster-nonadmin@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000001003', 'roster-existing@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000001004', 'roster-untouched@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000001005', 'roster-manual-only@merchanttaylors.com', 'authenticated', 'authenticated');

insert into public.profiles (id, email, kind, state) values
  ('00000000-0000-0000-0000-000000001001', 'roster-admin@merchanttaylors.com', 'institutional', 'active'),
  ('00000000-0000-0000-0000-000000001002', 'roster-nonadmin@merchanttaylors.com', 'institutional', 'active'),
  ('00000000-0000-0000-0000-000000001003', 'roster-existing@merchanttaylors.com', 'institutional', 'active'),
  ('00000000-0000-0000-0000-000000001004', 'roster-untouched@merchanttaylors.com', 'institutional', 'active'),
  ('00000000-0000-0000-0000-000000001005', 'roster-manual-only@merchanttaylors.com', 'institutional', 'active');

insert into public.role_assignments (profile_id, role, reason) values
  ('00000000-0000-0000-0000-000000001001', 'institution_admin', 'test fixture'),
  ('00000000-0000-0000-0000-000000001002', 'teacher', 'test fixture'),
  ('00000000-0000-0000-0000-000000001004', 'student', 'test fixture'),
  -- Manually granted, never touched by any sync in this file - proves a
  -- sync run never disables someone it did not itself provision.
  ('00000000-0000-0000-0000-000000001005', 'teacher', 'test fixture, not sync');

insert into public.tags (id, tag_name, display_name, created_by) values
  ('90100000-0000-0000-0000-000000000001', 'Y10ROSTER', 'Year 10 Roster Test', '00000000-0000-0000-0000-000000001001'),
  ('90100000-0000-0000-0000-000000000002', 'Y10ROSTER2', 'Year 10 Roster Test 2', '00000000-0000-0000-0000-000000001001');

-- A manually admin-granted membership, source='admin' - must never be
-- touched by a sync run that omits it, per the ADR's provenance boundary.
insert into public.tag_memberships (profile_id, tag_id, membership_role, source, granted_by) values
  ('00000000-0000-0000-0000-000000001004', '90100000-0000-0000-0000-000000000002', 'member', 'admin', '00000000-0000-0000-0000-000000001001');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- A non-admin cannot run a roster sync at all.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000001002', true);
select throws_ok(
  $$ select public.sync_roster('[{"email":"roster-existing@merchanttaylors.com","systemRole":"teacher","memberships":[]}]'::jsonb, true) $$,
  '42501', 'institution administrator role required',
  'a non-admin cannot run a roster sync'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000001001', true);

-- Dry run computes the diff but writes nothing.
select lives_ok(
  $$ select public.sync_roster('[{"email":"roster-existing@merchanttaylors.com","systemRole":"teacher","memberships":[{"tagName":"Y10ROSTER","membershipRole":"member"}]}]'::jsonb, true) $$,
  'a dry run against an existing profile succeeds'
);
select is(
  (select count(*) from public.tag_memberships where profile_id = '00000000-0000-0000-0000-000000001003')::bigint,
  0::bigint,
  'a dry run writes no membership'
);

-- Applying grants the role and membership, with mis_sync provenance.
select lives_ok(
  $$ select public.sync_roster('[{"email":"roster-existing@merchanttaylors.com","systemRole":"teacher","memberships":[{"tagName":"Y10ROSTER","membershipRole":"member"}]}]'::jsonb, false) $$,
  'applying the sync grants the role and membership'
);
select ok(
  exists (
    select 1 from public.role_assignments
    where profile_id = '00000000-0000-0000-0000-000000001003' and role = 'teacher' and reason like 'mis_sync:%'
  ),
  'the role grant is recorded with mis_sync provenance'
);
select ok(
  exists (
    select 1 from public.tag_memberships
    where profile_id = '00000000-0000-0000-0000-000000001003' and tag_id = '90100000-0000-0000-0000-000000000001'
      and source like 'mis_sync:%' and valid_until is null
  ),
  'the membership grant is recorded with mis_sync provenance'
);

-- Re-running the identical snapshot is a true no-op.
select is(
  (public.sync_roster(
    '[{"email":"roster-existing@merchanttaylors.com","systemRole":"teacher","memberships":[{"tagName":"Y10ROSTER","membershipRole":"member"}]}]'::jsonb, false
  ) -> 'roleGrants'),
  '[]'::jsonb,
  'a re-run of the identical snapshot grants no additional role (idempotent)'
);

-- An unknown tag is reported as a per-row error, not a batch failure.
select is(
  jsonb_array_length(public.sync_roster(
    '[{"email":"roster-existing@merchanttaylors.com","systemRole":"teacher","memberships":[{"tagName":"NONEXISTENT","membershipRole":"member"}]}]'::jsonb, true
  ) -> 'errors'),
  1,
  'an unknown tag is reported as a row error, not a batch failure'
);

-- A duplicate email within the same upload is reported as an error.
select is(
  jsonb_array_length(public.sync_roster(
    '[{"email":"roster-untouched@merchanttaylors.com","systemRole":"student","memberships":[]},
      {"email":"roster-untouched@merchanttaylors.com","systemRole":"student","memberships":[]}]'::jsonb, true
  ) -> 'errors'),
  1,
  'a duplicate email in the same upload is reported as an error'
);

-- A snapshot that includes roster-untouched but omits roster-existing:
-- proves reconciliation (untouched's own admin-sourced membership survives),
-- and that dropping off the roster disables only someone the sync itself
-- provisioned (roster-existing), never someone it never touched
-- (roster-manual-only).
select lives_ok(
  $$ select public.sync_roster('[{"email":"roster-untouched@merchanttaylors.com","systemRole":"student","memberships":[{"tagName":"Y10ROSTER","membershipRole":"member"}]}]'::jsonb, false) $$,
  'a sync run omitting a previously-provisioned person succeeds'
);
select ok(
  exists (
    select 1 from public.tag_memberships
    where profile_id = '00000000-0000-0000-0000-000000001004' and tag_id = '90100000-0000-0000-0000-000000000002'
      and source = 'admin' and valid_until is null
  ),
  'a manually admin-granted membership is never touched by a sync run that omits it'
);
select ok(
  exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-000000001003' and state = 'disabled'),
  'a leaver the sync previously provisioned is disabled, not deleted'
);
select ok(
  exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-000000001005' and state = 'active'),
  'a person the sync never provisioned is never disabled, even absent from every roster'
);

-- A roster row for someone with no existing profile queues an intent
-- instead of failing (profiles.id is FK'd to auth.users.id - it cannot be
-- pre-created).
select lives_ok(
  $$ select public.sync_roster('[{"email":"roster-newcomer@merchanttaylors.com","systemRole":"student","memberships":[{"tagName":"Y10ROSTER","membershipRole":"member"}]}]'::jsonb, false) $$,
  'syncing a not-yet-existing person succeeds and queues an intent'
);
reset role;
select ok(
  exists (select 1 from public.mis_roster_intents where email = 'roster-newcomer@merchanttaylors.com' and applied_at is null),
  'a pending intent is queued for a person with no existing profile'
);
select is(
  (select count(*) from public.mis_roster_intents where email = 'roster-newcomer@merchanttaylors.com')::bigint,
  1::bigint,
  'exactly one pending intent exists for the newcomer'
);

-- Simulate their first real signup - the trigger should apply the intent.
insert into auth.users (id, email, aud, role, raw_app_meta_data, email_confirmed_at)
values ('00000000-0000-0000-0000-000000001006', 'roster-newcomer@merchanttaylors.com',
  'authenticated', 'authenticated', '{"provider":"email"}'::jsonb, now());

select ok(
  exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-000000001006' and kind = 'institutional'),
  'first login provisions the profile from the queued intent'
);
select ok(
  exists (
    select 1 from public.role_assignments
    where profile_id = '00000000-0000-0000-0000-000000001006' and role = 'student' and reason like 'mis_sync:%'
  ),
  'first login grants the queued role'
);
select ok(
  exists (
    select 1 from public.tag_memberships
    where profile_id = '00000000-0000-0000-0000-000000001006' and tag_id = '90100000-0000-0000-0000-000000000001'
      and source like 'mis_sync:%'
  ),
  'first login grants the queued tag membership'
);
select ok(
  exists (select 1 from public.mis_roster_intents where email = 'roster-newcomer@merchanttaylors.com' and applied_at is not null),
  'the applied intent is marked applied_at, not left pending'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000001001', true);

-- mis_roster_intents has no base grant and no RLS policies at all - only
-- the SECURITY DEFINER functions above ever touch it.
select throws_ok(
  $$ select count(*) from public.mis_roster_intents $$,
  '42501', 'permission denied for table mis_roster_intents',
  'no authenticated role can read mis_roster_intents directly'
);

select * from finish();
rollback;
