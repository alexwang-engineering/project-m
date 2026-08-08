begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

insert into auth.users (id, email, aud, role) values
  ('25000000-0000-4000-8000-000000000001', 'delegate-admin@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('25000000-0000-4000-8000-000000000002', 'delegate-teacher@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('25000000-0000-4000-8000-000000000003', 'delegate-student@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('25000000-0000-4000-8000-000000000004', 'former-page-author@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('25000000-0000-4000-8000-000000000005', 'creating-teacher@merchanttaylors.com', 'authenticated', 'authenticated');
insert into public.profiles (id, email, kind, state) values
  ('25000000-0000-4000-8000-000000000001', 'delegate-admin@merchanttaylors.com', 'institutional', 'active'),
  ('25000000-0000-4000-8000-000000000002', 'delegate-teacher@merchanttaylors.com', 'institutional', 'active'),
  ('25000000-0000-4000-8000-000000000003', 'delegate-student@merchanttaylors.com', 'institutional', 'active'),
  ('25000000-0000-4000-8000-000000000004', 'former-page-author@merchanttaylors.com', 'institutional', 'active'),
  ('25000000-0000-4000-8000-000000000005', 'creating-teacher@merchanttaylors.com', 'institutional', 'active');
insert into public.role_assignments (profile_id, role, reason, valid_from) values
  ('25000000-0000-4000-8000-000000000001', 'institution_admin', 'test fixture', now() - interval '1 hour'),
  ('25000000-0000-4000-8000-000000000002', 'teacher', 'test fixture', now() - interval '1 hour'),
  ('25000000-0000-4000-8000-000000000003', 'student', 'test fixture', now() - interval '1 hour'),
  ('25000000-0000-4000-8000-000000000004', 'student', 'former teacher fixture', now() - interval '1 hour'),
  ('25000000-0000-4000-8000-000000000005', 'teacher', 'test fixture', now() - interval '1 hour');
insert into public.tags (id, tag_name, display_name, created_by) values
  ('25000000-0000-4000-8000-000000000011', 'Y9DELA', 'Delegated A', '25000000-0000-4000-8000-000000000001'),
  ('25000000-0000-4000-8000-000000000012', 'Y9DELB', 'Delegated B', '25000000-0000-4000-8000-000000000001');
insert into public.tags (id, tag_name, display_name, is_active, archived_at, created_by) values
  ('25000000-0000-4000-8000-000000000013', 'Y9DELC', 'Archived tag', false, now(), '25000000-0000-4000-8000-000000000001');
insert into public.pages (id, parent_id, slug, canonical_url, title, content_json, author_id, lifecycle) values
  ('25000000-0000-4000-8000-000000000021', null, 'delegated-page', '/delegated-page', 'Delegated page', '{"schemaVersion":1,"blocks":[]}', '25000000-0000-4000-8000-000000000004', 'draft'),
  ('25000000-0000-4000-8000-000000000022', '25000000-0000-4000-8000-000000000021', 'protected-child', '/delegated-page/protected-child', 'Protected child', '{"schemaVersion":1,"blocks":[]}', '25000000-0000-4000-8000-000000000001', 'draft'),
  ('25000000-0000-4000-8000-000000000023', null, 'protected-parent', '/protected-parent', 'Protected parent', '{"schemaVersion":1,"blocks":[]}', '25000000-0000-4000-8000-000000000001', 'draft');
insert into public.page_tags (page_id, tag_id, added_by) values
  ('25000000-0000-4000-8000-000000000021', '25000000-0000-4000-8000-000000000011', '25000000-0000-4000-8000-000000000001'),
  ('25000000-0000-4000-8000-000000000022', '25000000-0000-4000-8000-000000000012', '25000000-0000-4000-8000-000000000001'),
  ('25000000-0000-4000-8000-000000000023', '25000000-0000-4000-8000-000000000012', '25000000-0000-4000-8000-000000000001');
insert into public.tag_memberships (profile_id, tag_id, membership_role, source) values
  ('25000000-0000-4000-8000-000000000005', '25000000-0000-4000-8000-000000000011', 'teacher', 'test');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '25000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$ select public.create_assignment('Archived audience', null, null, false, array['25000000-0000-4000-8000-000000000013']::uuid[]) $$,
  '22023', 'audience tags must exist and be active', 'admin cannot assign content to an archived tag');
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
select set_config('request.jwt.claim.sub', '25000000-0000-4000-8000-000000000005', true);
select throws_ok(
  $$ select public.create_page('Injected child', 'injected-child', '25000000-0000-4000-8000-000000000023',
    '{"schemaVersion":1,"blocks":[]}'::jsonb, 1, array['25000000-0000-4000-8000-000000000011']::uuid[]) $$,
  '42501', 'parent page edit permission required', 'teacher cannot create content beneath an unauthorized parent');
select set_config('request.jwt.claim.sub', '25000000-0000-4000-8000-000000000002', true);
select lives_ok(
  $$ select public.update_page('25000000-0000-4000-8000-000000000021', 1, 'Covered edit', 'delegated-page', null,
    '{"schemaVersion":1,"blocks":[]}'::jsonb, 1, array['25000000-0000-4000-8000-000000000011']::uuid[]) $$,
  'delegate can edit while preserving the page audience');
select throws_ok(
  $$ select public.update_page('25000000-0000-4000-8000-000000000021', 2, 'Retag attempt', 'delegated-page', null,
    '{"schemaVersion":1,"blocks":[]}'::jsonb, 1, array['25000000-0000-4000-8000-000000000012']::uuid[]) $$,
  '42501', 'actor does not manage every audience tag', 'delegate cannot retag outside their authority');
select throws_ok(
  $$ select public.update_page('25000000-0000-4000-8000-000000000021', 2, 'Move attempt', 'delegated-page', '25000000-0000-4000-8000-000000000023',
    '{"schemaVersion":1,"blocks":[]}'::jsonb, 1, array['25000000-0000-4000-8000-000000000011']::uuid[]) $$,
  '42501', 'new parent page edit permission required', 'delegate cannot move a page under an unauthorized parent');
select throws_ok(
  $$ select public.update_page('25000000-0000-4000-8000-000000000021', 2, 'Rename attempt', 'renamed-page', null,
    '{"schemaVersion":1,"blocks":[]}'::jsonb, 1, array['25000000-0000-4000-8000-000000000011']::uuid[]) $$,
  '42501', 'page move requires edit permission for every descendant', 'delegate cannot rewrite an unauthorized descendant path');
reset role;
select is(
  (select canonical_url from public.pages where id = '25000000-0000-4000-8000-000000000022'),
  '/delegated-page/protected-child', 'rejected move preserves descendant path');
select is(
  (select version from public.pages where id = '25000000-0000-4000-8000-000000000022'),
  1::bigint, 'rejected move preserves descendant version');
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '25000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$ select public.revoke_page_editor('25000000-0000-4000-8000-000000000021', '25000000-0000-4000-8000-000000000002', 'self revoke attempt') $$,
  '42501', 'institution administrator role required', 'non-admin cannot revoke a delegation');

select set_config('request.jwt.claim.sub', '25000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$ select public.revoke_page_editor('25000000-0000-4000-8000-000000000021', '25000000-0000-4000-8000-000000000002', 'cover ended') $$,
  'admin can revoke a delegation immediately');
select set_config('request.jwt.claim.sub', '25000000-0000-4000-8000-000000000002', true);
select is(public.can_edit_page('25000000-0000-4000-8000-000000000021'), false, 'revoked delegation no longer authorizes editing');

select set_config('request.jwt.claim.sub', '25000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$ select public.grant_page_editor('25000000-0000-4000-8000-000000000021', '25000000-0000-4000-8000-000000000002', 'new cover period') $$,
  'admin can create a new delegation');
select lives_ok(
  $$ select public.revoke_system_role('25000000-0000-4000-8000-000000000002', 'teacher', 'teacher duties ended') $$,
  'admin can revoke the delegated teacher role');
select lives_ok(
  $$ select public.assign_system_role('25000000-0000-4000-8000-000000000002', 'teacher', 'teacher duties resumed') $$,
  'admin can later assign a new teacher role');
select set_config('request.jwt.claim.sub', '25000000-0000-4000-8000-000000000002', true);
select is(public.can_edit_page('25000000-0000-4000-8000-000000000021'), false, 'new teacher role does not revive an old page delegation');

select set_config('request.jwt.claim.sub', '25000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$ select public.update_page('25000000-0000-4000-8000-000000000021', 2, 'Admin rename', 'renamed-page', null,
    '{"schemaVersion":1,"blocks":[]}'::jsonb, 1, array['25000000-0000-4000-8000-000000000011']::uuid[]) $$,
  'admin can move an authorized subtree');
select is(
  (select canonical_url from public.pages where id = '25000000-0000-4000-8000-000000000022'),
  '/renamed-page/protected-child', 'authorized move updates descendant path');
select is(
  (select version from public.pages where id = '25000000-0000-4000-8000-000000000022'),
  2::bigint, 'authorized move advances descendant version');
select is(
  (select count(*) from public.audit_events where action = 'page.path_changed'
    and target_id = '25000000-0000-4000-8000-000000000022')::bigint,
  1::bigint, 'authorized descendant path change is audited');
select throws_ok(
  $$ select public.set_page_lifecycle('25000000-0000-4000-8000-000000000022', 2, 'published', false) $$,
  '55000', 'all parent pages must be published first', 'child cannot publish beneath a draft parent');
select lives_ok(
  $$ select public.set_page_lifecycle('25000000-0000-4000-8000-000000000021', 3, 'published', false) $$,
  'parent can be published first');
select lives_ok(
  $$ select public.set_page_lifecycle('25000000-0000-4000-8000-000000000022', 2, 'published', false) $$,
  'child can publish after its parent');
select throws_ok(
  $$ select public.set_page_lifecycle('25000000-0000-4000-8000-000000000021', 4, 'draft', false) $$,
  '55000', 'published descendants must be unpublished first', 'parent cannot leave published state above a published child');
select throws_ok(
  $$ select public.restore_page_revision('25000000-0000-4000-8000-000000000021',
    (select id from public.page_revisions where page_id = '25000000-0000-4000-8000-000000000021' and version = 3), 4) $$,
  '55000', 'published descendants must be unpublished first', 'revision restore cannot bypass lifecycle hierarchy');
select is(
  (select count(*) from pg_catalog.pg_locks where pid = pg_backend_pid()
    and locktype = 'advisory' and classid = 1347241037::oid and objid = 1::oid and granted)::bigint,
  1::bigint, 'page mutations retain the hierarchy advisory lock for the transaction');

select * from finish();
rollback;
