begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-000000000201', 'teacher-owns@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000202', 'teacher-unrelated@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000203', 'student-reviewed@merchanttaylors.com', 'authenticated', 'authenticated');

insert into public.profiles (id, email, kind, state) values
  ('00000000-0000-0000-0000-000000000201', 'teacher-owns@merchanttaylors.com', 'institutional', 'active'),
  ('00000000-0000-0000-0000-000000000202', 'teacher-unrelated@merchanttaylors.com', 'institutional', 'active'),
  ('00000000-0000-0000-0000-000000000203', 'student-reviewed@merchanttaylors.com', 'institutional', 'active');

insert into public.role_assignments (profile_id, role, reason) values
  ('00000000-0000-0000-0000-000000000201', 'teacher', 'test fixture'),
  ('00000000-0000-0000-0000-000000000202', 'teacher', 'test fixture'),
  ('00000000-0000-0000-0000-000000000203', 'student', 'test fixture');

insert into public.tags (id, tag_name, display_name, created_by) values
  ('30000000-0000-0000-0000-000000000001', 'Y10SC1', 'Year 10 Science Set 1', '00000000-0000-0000-0000-000000000201');

insert into public.tag_memberships (profile_id, tag_id, membership_role, source) values
  ('00000000-0000-0000-0000-000000000201', '30000000-0000-0000-0000-000000000001', 'teacher', 'test'),
  ('00000000-0000-0000-0000-000000000203', '30000000-0000-0000-0000-000000000001', 'member', 'test');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', true);
select lives_ok(
  $$ select public.create_assignment('Ecology write-up', null, null, false,
    array['30000000-0000-0000-0000-000000000001']::uuid[]) $$,
  'owning teacher can create the assignment under test'
);
do $$ begin perform public.transition_assignment((select id from public.assignments where title = 'Ecology write-up'), 1, 'published'); end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000203', true);
select lives_ok(
  $$ select public.begin_file_upload('writeup.pdf', 'application/pdf', 1024,
    'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc') $$,
  'student can begin the upload for their submission'
);
select set_config('test.submission_file_id', (select id::text from public.files order by created_at desc limit 1), false);
reset role;
update public.files set state = 'ready' where id = current_setting('test.submission_file_id')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000203', true);
select lives_ok(
  $$ select public.submit_assignment((select id from public.assignments where title = 'Ecology write-up'),
    current_setting('test.submission_file_id')::uuid) $$,
  'student can submit, setting up the review fixture'
);

-- The owning teacher can now identify and download the submission.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', true);
select is(
  (select count(*) from public.profiles where id = '00000000-0000-0000-0000-000000000203')::bigint,
  1::bigint,
  'owning teacher can read the submitting student''s profile'
);
select is(
  (select count(*) from public.get_file_download_target(current_setting('test.submission_file_id')::uuid))::bigint,
  1::bigint,
  'owning teacher can resolve a download target for the submitted file'
);

-- An unrelated teacher, with no tag overlap, gets neither - RLS silently
-- returns zero rows rather than an error, which is itself the correct,
-- non-leaking behavior (no distinction between "not authorized" and
-- "doesn't exist" is disclosed to the caller).
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000202', true);
select is(
  (select count(*) from public.profiles where id = '00000000-0000-0000-0000-000000000203')::bigint
    + (select count(*) from public.get_file_download_target(current_setting('test.submission_file_id')::uuid))::bigint,
  0::bigint,
  'an unrelated teacher can read neither the student''s profile nor the submitted file'
);

select * from finish();
rollback;
