-- Package K: adversarial coverage for the four audited admin RPCs from
-- 20260804192000_audited_administration.sql (existed since Package D but
-- had only two incidental negative-path spot checks in
-- 001_content_authorization.sql - this is the first dedicated,
-- comprehensive pass covering the happy path, the self-disable guard, and
-- audit logging for all four) plus create_tag, added in the same package's
-- follow-up work (20260807020000_create_tag.sql).
begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-000000000401', 'admin.verify@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000402', 'teacher-nonadmin@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000403', 'target-user@merchanttaylors.com', 'authenticated', 'authenticated');

insert into public.profiles (id, email, kind, state) values
  ('00000000-0000-0000-0000-000000000401', 'admin.verify@merchanttaylors.com', 'institutional', 'active'),
  ('00000000-0000-0000-0000-000000000402', 'teacher-nonadmin@merchanttaylors.com', 'institutional', 'active'),
  ('00000000-0000-0000-0000-000000000403', 'target-user@merchanttaylors.com', 'institutional', 'active');

insert into public.role_assignments (profile_id, role, reason) values
  ('00000000-0000-0000-0000-000000000401', 'institution_admin', 'test fixture'),
  ('00000000-0000-0000-0000-000000000402', 'teacher', 'test fixture');

insert into public.tags (id, tag_name, display_name, created_by) values
  ('50000000-0000-0000-0000-000000000001', 'Y12AD1', 'Year 12 Admin Test', '00000000-0000-0000-0000-000000000401');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Non-admin rejected on all four RPCs.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000402', true);
select throws_ok(
  $$ select public.assign_system_role('00000000-0000-0000-0000-000000000403', 'teacher', 'spoof attempt') $$,
  '42501', 'institution administrator role required',
  'a non-admin teacher cannot assign a system role'
);
select throws_ok(
  $$ select public.assign_tag_membership('00000000-0000-0000-0000-000000000403',
    '50000000-0000-0000-0000-000000000001', 'member', 'spoof') $$,
  '42501', 'institution administrator role required',
  'a non-admin teacher cannot assign a tag membership'
);
select throws_ok(
  $$ select public.set_profile_state('00000000-0000-0000-0000-000000000403', 'disabled', 'spoof') $$,
  '42501', 'institution administrator role required',
  'a non-admin teacher cannot change a profile''s state'
);
select throws_ok(
  $$ select public.revoke_system_role('00000000-0000-0000-0000-000000000403', 'teacher', 'spoof') $$,
  '42501', 'institution administrator role required',
  'a non-admin teacher cannot revoke a system role'
);
select throws_ok(
  $$ select public.revoke_tag_membership('00000000-0000-0000-0000-000000000403',
    '50000000-0000-0000-0000-000000000001', 'member', 'spoof') $$,
  '42501', 'institution administrator role required',
  'a non-admin teacher cannot revoke a tag membership'
);

-- Admin happy path: assign a system role.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000401', true);
select throws_ok(
  $$ select public.assign_system_role('00000000-0000-0000-0000-000000000403', 'teacher', '') $$,
  '22023', 'assignment reason required',
  'assigning a role with a blank reason is rejected'
);
select lives_ok(
  $$ select public.assign_system_role('00000000-0000-0000-0000-000000000403', 'teacher', 'promoted to teacher') $$,
  'admin can assign a system role with a reason'
);
select is(
  (select count(*) from public.role_assignments
   where profile_id = '00000000-0000-0000-0000-000000000403' and role = 'teacher')::bigint,
  1::bigint, 'the role assignment row was created'
);
select is(
  (select count(*) from public.audit_events where action = 'role.assigned'
   and target_id = '00000000-0000-0000-0000-000000000403')::bigint,
  1::bigint, 'assigning a role writes an audit event'
);

-- Admin happy path: assign a tag membership.
select lives_ok(
  $$ select public.assign_tag_membership('00000000-0000-0000-0000-000000000403',
    '50000000-0000-0000-0000-000000000001', 'member', 'admin_console') $$,
  'admin can assign a tag membership'
);
select is(
  (select membership_role::text from public.tag_memberships
   where profile_id = '00000000-0000-0000-0000-000000000403'
     and tag_id = '50000000-0000-0000-0000-000000000001'),
  'member', 'the tag membership was created with the requested role'
);
select is(
  (select count(*) from public.audit_events where action = 'tag_membership.assigned'
   and target_id = '00000000-0000-0000-0000-000000000403')::bigint,
  1::bigint, 'assigning a tag membership writes an audit event'
);

-- Narrow revocation closes grants without deleting their history.
select lives_ok(
  $$ select public.revoke_system_role('00000000-0000-0000-0000-000000000403', 'teacher', 'role no longer required') $$,
  'admin can revoke a system role'
);
reset role;
select ok(
  not public.has_system_role('teacher', '00000000-0000-0000-0000-000000000403'),
  'the revoked system role is no longer effective'
);
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000401', true);
select is(
  (select count(*) from public.audit_events where action = 'role.revoked'
   and target_id = '00000000-0000-0000-0000-000000000403')::bigint,
  1::bigint, 'revoking a role writes an audit event'
);
select lives_ok(
  $$ select public.revoke_tag_membership('00000000-0000-0000-0000-000000000403',
    '50000000-0000-0000-0000-000000000001', 'member', 'class changed') $$,
  'admin can revoke a tag membership'
);
reset role;
select ok(
  not public.has_tag_membership('50000000-0000-0000-0000-000000000001',
    array['member']::public.membership_role[], '00000000-0000-0000-0000-000000000403'),
  'the revoked tag membership is no longer effective'
);
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000401', true);
select is(
  (select count(*) from public.audit_events where action = 'tag_membership.revoked'
   and target_id = '00000000-0000-0000-0000-000000000403')::bigint,
  1::bigint, 'revoking a tag membership writes an audit event'
);
select throws_ok(
  $$ select public.revoke_system_role('00000000-0000-0000-0000-000000000401',
    'institution_admin', 'self-lock attempt') $$,
  '22023', 'administrator cannot revoke own admin role',
  'an administrator cannot revoke their own admin role'
);

-- Admin happy path: disable, then re-enable, a profile.
select lives_ok(
  $$ select public.set_profile_state('00000000-0000-0000-0000-000000000403', 'disabled', 'left the school') $$,
  'admin can disable a profile'
);
select is(
  (select state::text from public.profiles where id = '00000000-0000-0000-0000-000000000403'),
  'disabled', 'the profile state was updated'
);
select isnt(
  (select disabled_at from public.profiles where id = '00000000-0000-0000-0000-000000000403'),
  null, 'disabled_at was stamped'
);
select lives_ok(
  $$ select public.set_profile_state('00000000-0000-0000-0000-000000000403', 'active', 're-admitted') $$,
  'admin can re-enable a disabled profile'
);
select is(
  (select disabled_at from public.profiles where id = '00000000-0000-0000-0000-000000000403'),
  null, 'disabled_at was cleared on re-enable'
);

-- Guard: an admin cannot disable their own account (would lock the
-- institution out if it were the only admin).
select throws_ok(
  $$ select public.set_profile_state('00000000-0000-0000-0000-000000000401', 'disabled', 'testing self-lock') $$,
  '22023', 'administrator cannot disable own profile',
  'an admin cannot disable their own account'
);

-- Admin happy path: grant a page-editor delegation. authenticated has no
-- direct INSERT grant on pages (all writes route through create_page's
-- audited RPC) - reset to superuser for this one fixture row, matching the
-- pattern already established for pending-file fixtures elsewhere.
reset role;
insert into public.pages (id, slug, canonical_url, title, content_json, author_id, lifecycle) values
  ('50000000-0000-0000-0000-000000000002', 'admin-test-page', '/admin-test-page', 'Admin test page',
   '{"schemaVersion":1,"blocks":[]}'::jsonb, '00000000-0000-0000-0000-000000000401', 'draft');
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000401', true);
select lives_ok(
  $$ select public.grant_page_editor('50000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000403', 'covering for absence') $$,
  'admin can grant a page-editor delegation'
);
select is(
  (select count(*) from public.page_editors
   where page_id = '50000000-0000-0000-0000-000000000002'
     and profile_id = '00000000-0000-0000-0000-000000000403')::bigint,
  1::bigint, 'the page-editor grant row was created'
);

-- create_tag: institution-admin only, per explicit product owner decision.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000402', true);
select throws_ok(
  $$ select public.create_tag('Y99XX1', 'Bogus Tag', 'spoof attempt') $$,
  '42501', 'institution administrator role required',
  'a non-admin teacher cannot create a tag'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000401', true);
select throws_ok(
  $$ select public.create_tag('bad name!', 'Bad Tag') $$,
  '22023', null,
  'a malformed tag name is rejected'
);
select lives_ok(
  $$ select public.create_tag('y12ad2', 'Year 12 Admin Test 2', 'new class group') $$,
  'admin can create a tag (lowercase input is normalized to uppercase)'
);
select is(
  (select tag_name from public.tags where tag_name = 'Y12AD2'),
  'Y12AD2', 'the tag name was stored upper-cased'
);
select is(
  (select count(*) from public.audit_events where action = 'tag.created'
   and after_data->>'tag_name' = 'Y12AD2')::bigint,
  1::bigint, 'creating a tag writes an audit event'
);
select throws_ok(
  $$ select public.create_tag('Y12AD2', 'Duplicate') $$,
  '23505', 'a tag with this name already exists',
  'creating a tag with a name that already exists (case-insensitively) is rejected'
);

select * from finish();
rollback;
