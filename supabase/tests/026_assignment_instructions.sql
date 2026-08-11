begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email, aud, role) values
  ('26000000-0000-4000-8000-000000000001', 'instructions-teacher@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('26000000-0000-4000-8000-000000000002', 'instructions-a@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('26000000-0000-4000-8000-000000000003', 'instructions-b@merchanttaylors.com', 'authenticated', 'authenticated');
insert into public.profiles (id, email, kind, state) values
  ('26000000-0000-4000-8000-000000000001', 'instructions-teacher@merchanttaylors.com', 'institutional', 'active'),
  ('26000000-0000-4000-8000-000000000002', 'instructions-a@merchanttaylors.com', 'institutional', 'active'),
  ('26000000-0000-4000-8000-000000000003', 'instructions-b@merchanttaylors.com', 'institutional', 'active');
insert into public.role_assignments (profile_id, role, reason) values
  ('26000000-0000-4000-8000-000000000001', 'teacher', 'test fixture'),
  ('26000000-0000-4000-8000-000000000002', 'student', 'test fixture'),
  ('26000000-0000-4000-8000-000000000003', 'student', 'test fixture');
insert into public.tags (id, tag_name, display_name, created_by) values
  ('26000000-0000-4000-8000-000000000011', 'Y9INSA', 'Instructions A', '26000000-0000-4000-8000-000000000001'),
  ('26000000-0000-4000-8000-000000000012', 'Y9INSB', 'Instructions B', '26000000-0000-4000-8000-000000000001');
insert into public.tag_memberships (profile_id, tag_id, membership_role, source) values
  ('26000000-0000-4000-8000-000000000001', '26000000-0000-4000-8000-000000000011', 'teacher', 'test'),
  ('26000000-0000-4000-8000-000000000001', '26000000-0000-4000-8000-000000000012', 'teacher', 'test'),
  ('26000000-0000-4000-8000-000000000002', '26000000-0000-4000-8000-000000000011', 'member', 'test'),
  ('26000000-0000-4000-8000-000000000003', '26000000-0000-4000-8000-000000000012', 'member', 'test');
insert into public.pages (id, slug, canonical_url, title, content_json, author_id, lifecycle, published_at) values
  ('26000000-0000-4000-8000-000000000021', 'only-a', '/only-a', 'Only A', '{"schemaVersion":1,"blocks":[]}', '26000000-0000-4000-8000-000000000001', 'published', now()),
  ('26000000-0000-4000-8000-000000000022', 'both', '/both', 'Both cohorts', '{"schemaVersion":1,"blocks":[]}', '26000000-0000-4000-8000-000000000001', 'published', now()),
  ('26000000-0000-4000-8000-000000000023', 'draft', '/draft', 'Draft page', '{"schemaVersion":1,"blocks":[]}', '26000000-0000-4000-8000-000000000001', 'draft', null);
insert into public.page_tags (page_id, tag_id, added_by) values
  ('26000000-0000-4000-8000-000000000021', '26000000-0000-4000-8000-000000000011', '26000000-0000-4000-8000-000000000001'),
  ('26000000-0000-4000-8000-000000000022', '26000000-0000-4000-8000-000000000011', '26000000-0000-4000-8000-000000000001'),
  ('26000000-0000-4000-8000-000000000022', '26000000-0000-4000-8000-000000000012', '26000000-0000-4000-8000-000000000001'),
  ('26000000-0000-4000-8000-000000000023', '26000000-0000-4000-8000-000000000011', '26000000-0000-4000-8000-000000000001'),
  ('26000000-0000-4000-8000-000000000023', '26000000-0000-4000-8000-000000000012', '26000000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '26000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$ select public.create_assignment('Coverage rejected', '26000000-0000-4000-8000-000000000021', null, false,
    array['26000000-0000-4000-8000-000000000011','26000000-0000-4000-8000-000000000012']::uuid[]) $$,
  '42501', 'instructions page must be published and cover every audience tag',
  'teacher cannot attach instructions that exclude one target cohort');
select throws_ok(
  $$ select public.create_assignment('Draft rejected', '26000000-0000-4000-8000-000000000023', null, false,
    array['26000000-0000-4000-8000-000000000011','26000000-0000-4000-8000-000000000012']::uuid[]) $$,
  '42501', 'instructions page must be published and cover every audience tag',
  'teacher cannot attach draft instructions');
select lives_ok(
  $$ select public.create_assignment('Covered assignment', '26000000-0000-4000-8000-000000000022', null, false,
    array['26000000-0000-4000-8000-000000000011','26000000-0000-4000-8000-000000000012']::uuid[]) $$,
  'teacher can attach a published page covering every target cohort');
select lives_ok(
  $$ select public.create_assignment('Optional instructions', null, null, false,
    array['26000000-0000-4000-8000-000000000011']::uuid[]) $$,
  'instructions remain optional');
select is(
  (select instructions_page_id from public.assignments where title = 'Covered assignment'),
  '26000000-0000-4000-8000-000000000022'::uuid,
  'assignment stores the canonical instructions page');

select public.transition_assignment(
  (select id from public.assignments where title = 'Covered assignment'),
  1,
  'published',
  null
);

select set_config('request.jwt.claim.sub', '26000000-0000-4000-8000-000000000002', true);
select is((select count(*) from public.assignments where title = 'Covered assignment')::bigint, 1::bigint,
  'student in first cohort can read the assignment');
select set_config('request.jwt.claim.sub', '26000000-0000-4000-8000-000000000003', true);
select is((select count(*) from public.assignments where title = 'Covered assignment')::bigint, 1::bigint,
  'student in second cohort can read the assignment');

select * from finish();
rollback;
