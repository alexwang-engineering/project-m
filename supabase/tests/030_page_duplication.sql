begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email, aud, role) values
  ('30000000-0000-4000-8000-000000000001', 'copy-admin@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('30000000-0000-4000-8000-000000000002', 'copy-teacher@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('30000000-0000-4000-8000-000000000003', 'copy-student@merchanttaylors.com', 'authenticated', 'authenticated');
insert into public.profiles (id, email, kind, state) values
  ('30000000-0000-4000-8000-000000000001', 'copy-admin@merchanttaylors.com', 'institutional', 'active'),
  ('30000000-0000-4000-8000-000000000002', 'copy-teacher@merchanttaylors.com', 'institutional', 'active'),
  ('30000000-0000-4000-8000-000000000003', 'copy-student@merchanttaylors.com', 'institutional', 'active');
insert into public.role_assignments (profile_id, role, reason) values
  ('30000000-0000-4000-8000-000000000001', 'institution_admin', 'test fixture'),
  ('30000000-0000-4000-8000-000000000002', 'teacher', 'test fixture'),
  ('30000000-0000-4000-8000-000000000003', 'student', 'test fixture');
insert into public.tags (id, tag_name, display_name, created_by) values
  ('30000000-0000-4000-8000-000000000011', 'COPYA', 'Copy A', '30000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000012', 'COPYB', 'Copy B', '30000000-0000-4000-8000-000000000001');
insert into public.tag_memberships (profile_id, tag_id, membership_role, source) values
  ('30000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000011', 'teacher', 'test');
insert into public.pages (id, slug, canonical_url, title, content_json, author_id) values
  ('30000000-0000-4000-8000-000000000021', 'source', '/source', 'Source',
    '{"schemaVersion":1,"blocks":[{"id":"p1","type":"paragraph","html":"<p>Copy me</p>"}]}'::jsonb,
    '30000000-0000-4000-8000-000000000001');
insert into public.page_tags (page_id, tag_id, added_by) values
  ('30000000-0000-4000-8000-000000000021', '30000000-0000-4000-8000-000000000011', '30000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000021', '30000000-0000-4000-8000-000000000012', '30000000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000003', true);
select throws_ok(
  $$ select public.duplicate_page('30000000-0000-4000-8000-000000000021', 'Student copy', 'student-copy') $$,
  '42501', 'page edit not permitted', 'student cannot duplicate a page');

select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$ select public.duplicate_page('30000000-0000-4000-8000-000000000021', 'Partial copy', 'partial-copy') $$,
  '42501', 'page edit not permitted', 'teacher missing an audience tag cannot duplicate the page');

reset role;
insert into public.tag_memberships (profile_id, tag_id, membership_role, source) values
  ('30000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000012', 'teacher', 'test');
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000002', true);
select lives_ok(
  $$ select public.duplicate_page('30000000-0000-4000-8000-000000000021', 'Source copy', 'source-copy') $$,
  'teacher managing every audience tag can duplicate the page');
reset role;
select is((select lifecycle::text from public.pages where slug = 'source-copy'), 'draft', 'copy is a draft');
select is((select content_json from public.pages where slug = 'source-copy'),
  (select content_json from public.pages where slug = 'source'), 'copy has the current content snapshot');
select is((select count(*) from public.page_tags where page_id = (select id from public.pages where slug = 'source-copy'))::bigint,
  2::bigint, 'copy has both audience tags');
select is((select count(*) from public.page_revisions where page_id = (select id from public.pages where slug = 'source-copy'))::bigint,
  1::bigint, 'copy starts with one independent revision');
select is((select count(*) from public.page_editors where page_id = (select id from public.pages where slug = 'source-copy'))::bigint,
  0::bigint, 'copy does not inherit editor grants');
select is((select count(*) from public.audit_events where action = 'page.duplicated'
  and target_id = (select id from public.pages where slug = 'source-copy'))::bigint,
  1::bigint, 'duplication is specifically audited');
select is((select canonical_url from public.pages where slug = 'source-copy'), '/source-copy', 'copy has its own canonical path');

select * from finish();
rollback;
