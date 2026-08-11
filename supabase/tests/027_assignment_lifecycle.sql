begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email, aud, role) values
  ('27000000-0000-4000-8000-000000000001', 'lifecycle-teacher@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('27000000-0000-4000-8000-000000000002', 'lifecycle-student@merchanttaylors.com', 'authenticated', 'authenticated');
insert into public.profiles (id, email, kind, state) values
  ('27000000-0000-4000-8000-000000000001', 'lifecycle-teacher@merchanttaylors.com', 'institutional', 'active'),
  ('27000000-0000-4000-8000-000000000002', 'lifecycle-student@merchanttaylors.com', 'institutional', 'active');
insert into public.role_assignments (profile_id, role, reason) values
  ('27000000-0000-4000-8000-000000000001', 'teacher', 'test'),
  ('27000000-0000-4000-8000-000000000002', 'student', 'test');
insert into public.tags (id, tag_name, display_name, created_by) values
  ('27000000-0000-4000-8000-000000000011', 'Y9LIFE', 'Lifecycle', '27000000-0000-4000-8000-000000000001');
insert into public.tag_memberships (profile_id, tag_id, membership_role, source) values
  ('27000000-0000-4000-8000-000000000001', '27000000-0000-4000-8000-000000000011', 'teacher', 'test'),
  ('27000000-0000-4000-8000-000000000002', '27000000-0000-4000-8000-000000000011', 'member', 'test');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '27000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$ select public.create_assignment('Lifecycle test', null, now() + interval '2 days', false,
    array['27000000-0000-4000-8000-000000000011']::uuid[], null, now() - interval '1 hour') $$,
  'teacher can save a valid draft');
select is((select lifecycle from public.assignments where title = 'Lifecycle test'), 'draft'::public.content_state,
  'new assignment is a draft');
select throws_ok(
  $$ select public.submit_assignment((select id from public.assignments where title = 'Lifecycle test'), '27000000-0000-4000-8000-000000000099') $$,
  '42501', 'active student required',
  'teacher cannot submit student work');

select set_config('request.jwt.claim.sub', '27000000-0000-4000-8000-000000000002', true);
select is((select count(*) from public.assignments where title = 'Lifecycle test')::bigint, 0::bigint,
  'student cannot discover a draft');

select set_config('request.jwt.claim.sub', '27000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$ select public.transition_assignment((select id from public.assignments where title = 'Lifecycle test'), 1, 'published') $$,
  'teacher can publish the draft');
select throws_ok(
  $$ select public.transition_assignment((select id from public.assignments where title = 'Lifecycle test'), 1, 'archived') $$,
  '40001', 'assignment changed; reload and try again',
  'stale lifecycle writes are rejected');
select throws_ok(
  $$ select public.transition_assignment((select id from public.assignments where title = 'Lifecycle test'), 2, 'published') $$,
  '22023', 'invalid assignment lifecycle transition',
  'published assignment cannot be published twice');

select set_config('request.jwt.claim.sub', '27000000-0000-4000-8000-000000000002', true);
select is((select count(*) from public.assignments where title = 'Lifecycle test')::bigint, 1::bigint,
  'student can discover an available published assignment');

select set_config('request.jwt.claim.sub', '27000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$ select public.set_assignment_closed((select id from public.assignments where title = 'Lifecycle test'), 2, true) $$,
  'teacher can close submissions');
select ok((select closed_at is not null from public.assignments where title = 'Lifecycle test'),
  'closure timestamp is recorded');
select throws_ok(
  $$ select public.create_assignment('Invalid schedule', null, now(), false,
    array['27000000-0000-4000-8000-000000000011']::uuid[], null, now() + interval '1 hour') $$,
  '22023', 'availability must not be after the due date',
  'invalid schedule is rejected at the trust boundary');

select * from finish();
rollback;
