begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-000000000001', 'admin@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000002', 'teacher-all@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000003', 'teacher-partial@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000004', 'student@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000005', 'disabled@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000006', 'matching-student@merchanttaylors.com', 'authenticated', 'authenticated');

insert into public.profiles (id, email, kind, state, disabled_at) values
  ('00000000-0000-0000-0000-000000000001', 'admin@merchanttaylors.com', 'institutional', 'active', null),
  ('00000000-0000-0000-0000-000000000002', 'teacher-all@merchanttaylors.com', 'institutional', 'active', null),
  ('00000000-0000-0000-0000-000000000003', 'teacher-partial@merchanttaylors.com', 'institutional', 'active', null),
  ('00000000-0000-0000-0000-000000000004', 'student@merchanttaylors.com', 'institutional', 'active', null),
  ('00000000-0000-0000-0000-000000000005', 'disabled@merchanttaylors.com', 'institutional', 'disabled', now()),
  ('00000000-0000-0000-0000-000000000006', 'matching-student@merchanttaylors.com', 'institutional', 'active', null);

insert into public.role_assignments (profile_id, role, reason) values
  ('00000000-0000-0000-0000-000000000001', 'institution_admin', 'test fixture'),
  ('00000000-0000-0000-0000-000000000002', 'teacher', 'test fixture'),
  ('00000000-0000-0000-0000-000000000003', 'teacher', 'test fixture'),
  ('00000000-0000-0000-0000-000000000004', 'student', 'test fixture'),
  ('00000000-0000-0000-0000-000000000005', 'teacher', 'test fixture'),
  ('00000000-0000-0000-0000-000000000006', 'student', 'test fixture');

insert into public.tags (id, tag_name, display_name, created_by) values
  ('10000000-0000-0000-0000-000000000001', 'Y9MA1', 'Year 9 Maths Set 1', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', 'L6CH2', 'Lower Sixth Chemistry 2', '00000000-0000-0000-0000-000000000001');

insert into public.tag_memberships (profile_id, tag_id, membership_role, source) values
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'teacher', 'test'),
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'teacher', 'test'),
  ('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'teacher', 'test'),
  ('00000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'teacher', 'test'),
  ('00000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'member', 'test');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select lives_ok(
  $$ select public.create_page('Mechanisms', 'mechanisms', null, '{"schemaVersion":1,"blocks":[]}'::jsonb, 1,
    array['10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002']::uuid[]) $$,
  'teacher owning every proposed tag can create atomically'
);

select is((select count(*) from public.pages)::bigint, 1::bigint, 'creator can read the draft');
select is((select count(*) from public.page_tags)::bigint, 2::bigint, 'both page tags are committed');
select lives_ok(
  $$ select public.set_page_lifecycle((select id from public.pages where canonical_url = '/mechanisms'), 1, 'published', false) $$,
  'authorized teacher can publish content'
);
select lives_ok(
  $$ select public.create_page('School news', 'school-news', null, '{"schemaVersion":1,"blocks":[]}'::jsonb, 1,
    array['10000000-0000-0000-0000-000000000001']::uuid[]) $$,
  'teacher can create a second page for public visibility testing'
);
select lives_ok(
  $$ select public.set_page_lifecycle((select id from public.pages where canonical_url = '/school-news'), 1, 'published', true) $$,
  'authorized teacher can explicitly publish a public page'
);
select is((select count(*) from public.page_revisions)::bigint, 4::bigint, 'create and publish revisions are immutable');
select is((select count(*) from public.audit_events)::bigint, 0::bigint, 'ordinary teacher cannot read audit rows');
select lives_ok(
  $$ select public.begin_file_upload('lesson.pdf', 'application/pdf', 1024,
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa') $$,
  'teacher can create bounded pending upload metadata'
);
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id)
    select bucket_id, object_name, owner_id from public.files where original_name = 'lesson.pdf' $$,
  'pending owner can upload only to the metadata-bound object path'
);
select is((select count(*) from storage.objects)::bigint, 0::bigint, 'pending object is not readable before trusted verification');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id)
    values ('learning-content', 'arbitrary/path.pdf', auth.uid()) $$,
  '42501', 'new row violates row-level security policy for table "objects"',
  'object path without pending metadata is rejected'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$ select public.update_page((select id from public.pages where canonical_url = '/mechanisms'), 2, 'Spoofed', 'mechanisms', null,
    '{"schemaVersion":1,"blocks":[]}'::jsonb, 1,
    array['10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002']::uuid[]) $$,
  '42501', 'page edit not permitted',
  'teacher owning only one of two tags cannot update'
);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$ select public.grant_page_editor((select id from public.pages where canonical_url = '/mechanisms'),
    '00000000-0000-0000-0000-000000000003', 'Approved cross-tag collaboration') $$,
  'administrator can grant an audited explicit editor exception'
);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select lives_ok(
  $$ select public.update_page((select id from public.pages where canonical_url = '/mechanisms'), 2, 'Approved edit', 'mechanisms', null,
    '{"schemaVersion":1,"blocks":[]}'::jsonb, 1,
    array['10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002']::uuid[]) $$,
  'explicit editor grant permits the reviewed cross-tag update'
);
select is(
  (with changed as (update public.pages set title = 'Direct bypass' returning 1) select count(*) from changed)::bigint,
  0::bigint,
  'direct table update cannot bypass transactional mutation functions'
);
select throws_ok(
  $$ select public.create_page('Cross-tag', 'cross-tag', null, '{"schemaVersion":1,"blocks":[]}'::jsonb, 1,
    array['10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002']::uuid[]) $$,
  '42501', 'actor does not manage every audience tag',
  'teacher owning only one tag cannot create across both'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
select is(
  (select count(*) from public.pages where canonical_url = '/mechanisms')::bigint,
  0::bigint,
  'student outside the audience cannot read the private page'
);
select throws_ok(
  $$ select public.assign_system_role('00000000-0000-0000-0000-000000000004', 'institution_admin', 'self spoof') $$,
  '42501', 'institution administrator role required',
  'nominal client claim cannot self-assign administrator authority'
);
select throws_ok(
  $$ select public.create_page('Student spoof', 'student-spoof', null, '{"schemaVersion":1,"blocks":[]}'::jsonb, 1,
    array['10000000-0000-0000-0000-000000000001']::uuid[]) $$,
  '42501', 'teacher or administrator role required',
  'student cannot create content through RPC'
);
select throws_ok(
  $$ select public.begin_file_upload('student.pdf', 'application/pdf', 1024,
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb') $$,
  '42501', 'content upload role required',
  'student cannot start a learning-content upload'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000006', true);
select is(
  (select count(*) from public.pages where canonical_url = '/mechanisms')::bigint,
  1::bigint,
  'student with a matching current tag can read the published private page'
);

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select is((select count(*) from public.pages)::bigint, 1::bigint, 'anonymous user sees only explicitly public published content');
reset role;
set local role authenticated;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000005', true);
select is(public.current_principal_is_active(), false, 'disabled principal fails active check');
select throws_ok(
  $$ select public.create_page('Disabled spoof', 'disabled-spoof', null, '{"schemaVersion":1,"blocks":[]}'::jsonb, 1,
    array['10000000-0000-0000-0000-000000000001']::uuid[]) $$,
  '42501', 'active principal required',
  'disabled teacher cannot use stale membership'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select is((select count(*) from public.audit_events)::bigint, 7::bigint, 'administrator can read append-only audit events');

select * from finish();
rollback;
