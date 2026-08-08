begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email, aud, role) values
  ('25000000-0000-4000-8000-000000000001', 'delegate-admin@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('25000000-0000-4000-8000-000000000002', 'delegate-teacher@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('25000000-0000-4000-8000-000000000003', 'delegate-student@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('25000000-0000-4000-8000-000000000004', 'former-page-author@merchanttaylors.com', 'authenticated', 'authenticated');
insert into public.profiles (id, email, kind, state) values
  ('25000000-0000-4000-8000-000000000001', 'delegate-admin@merchanttaylors.com', 'institutional', 'active'),
  ('25000000-0000-4000-8000-000000000002', 'delegate-teacher@merchanttaylors.com', 'institutional', 'active'),
  ('25000000-0000-4000-8000-000000000003', 'delegate-student@merchanttaylors.com', 'institutional', 'active'),
  ('25000000-0000-4000-8000-000000000004', 'former-page-author@merchanttaylors.com', 'institutional', 'active');
insert into public.role_assignments (profile_id, role, reason) values
  ('25000000-0000-4000-8000-000000000001', 'institution_admin', 'test fixture'),
  ('25000000-0000-4000-8000-000000000002', 'teacher', 'test fixture'),
  ('25000000-0000-4000-8000-000000000003', 'student', 'test fixture'),
  ('25000000-0000-4000-8000-000000000004', 'student', 'former teacher fixture');
insert into public.tags (id, tag_name, display_name, created_by) values
  ('25000000-0000-4000-8000-000000000011', 'Y9DELA', 'Delegated A', '25000000-0000-4000-8000-000000000001'),
  ('25000000-0000-4000-8000-000000000012', 'Y9DELB', 'Delegated B', '25000000-0000-4000-8000-000000000001');
insert into public.pages (id, slug, canonical_url, title, content_json, author_id, lifecycle) values
  ('25000000-0000-4000-8000-000000000021', 'delegated-page', '/delegated-page', 'Delegated page', '{"schemaVersion":1,"blocks":[]}', '25000000-0000-4000-8000-000000000004', 'draft');
insert into public.page_tags (page_id, tag_id, added_by) values
  ('25000000-0000-4000-8000-000000000021', '25000000-0000-4000-8000-000000000011', '25000000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '25000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$ select public.grant_page_editor('25000000-0000-4000-8000-000000000021', '25000000-0000-4000-8000-000000000003', 'invalid student delegation') $$,
  '22023', 'page editors must be active teachers', 'student cannot receive page-editor authority');

reset role;
insert into public.page_editors (page_id, profile_id, granted_by, reason) values
  ('25000000-0000-4000-8000-000000000021', '25000000-0000-4000-8000-000000000003', '25000000-0000-4000-8000-000000000001', 'legacy invalid grant');
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '25000000-0000-4000-8000-000000000003', true);
select is(public.can_edit_page('25000000-0000-4000-8000-000000000021'), false, 'legacy student grant cannot authorize editing');
select set_config('request.jwt.claim.sub', '25000000-0000-4000-8000-000000000004', true);
select is(public.can_read_page('25000000-0000-4000-8000-000000000021'), false, 'former teacher author cannot read private draft');

select set_config('request.jwt.claim.sub', '25000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$ select public.grant_page_editor('25000000-0000-4000-8000-000000000021', '25000000-0000-4000-8000-000000000002', 'approved cover') $$,
  'admin can delegate a page to a current teacher');
select set_config('request.jwt.claim.sub', '25000000-0000-4000-8000-000000000002', true);
select is(public.can_edit_page('25000000-0000-4000-8000-000000000021'), true, 'teacher delegation authorizes editing');
select lives_ok(
  $$ select public.update_page('25000000-0000-4000-8000-000000000021', 1, 'Covered edit', 'delegated-page', null,
    '{"schemaVersion":1,"blocks":[]}'::jsonb, 1, array['25000000-0000-4000-8000-000000000011']::uuid[]) $$,
  'delegate can edit while preserving the page audience');
select throws_ok(
  $$ select public.update_page('25000000-0000-4000-8000-000000000021', 2, 'Retag attempt', 'delegated-page', null,
    '{"schemaVersion":1,"blocks":[]}'::jsonb, 1, array['25000000-0000-4000-8000-000000000012']::uuid[]) $$,
  '42501', 'actor does not manage every audience tag', 'delegate cannot retag outside their authority');
select throws_ok(
  $$ select public.revoke_page_editor('25000000-0000-4000-8000-000000000021', '25000000-0000-4000-8000-000000000002', 'self revoke attempt') $$,
  '42501', 'institution administrator role required', 'non-admin cannot revoke a delegation');

select set_config('request.jwt.claim.sub', '25000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$ select public.revoke_page_editor('25000000-0000-4000-8000-000000000021', '25000000-0000-4000-8000-000000000002', 'cover ended') $$,
  'admin can revoke a delegation immediately');
select set_config('request.jwt.claim.sub', '25000000-0000-4000-8000-000000000002', true);
select is(public.can_edit_page('25000000-0000-4000-8000-000000000021'), false, 'revoked delegation no longer authorizes editing');

select * from finish();
rollback;
