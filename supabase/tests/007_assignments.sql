begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-000000000101', 'teacher-a@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000102', 'student-in@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000103', 'student-out@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000104', 'student-in-two@merchanttaylors.com', 'authenticated', 'authenticated');

insert into public.profiles (id, email, kind, state) values
  ('00000000-0000-0000-0000-000000000101', 'teacher-a@merchanttaylors.com', 'institutional', 'active'),
  ('00000000-0000-0000-0000-000000000102', 'student-in@merchanttaylors.com', 'institutional', 'active'),
  ('00000000-0000-0000-0000-000000000103', 'student-out@merchanttaylors.com', 'institutional', 'active'),
  ('00000000-0000-0000-0000-000000000104', 'student-in-two@merchanttaylors.com', 'institutional', 'active');

insert into public.role_assignments (profile_id, role, reason) values
  ('00000000-0000-0000-0000-000000000101', 'teacher', 'test fixture'),
  ('00000000-0000-0000-0000-000000000102', 'student', 'test fixture'),
  ('00000000-0000-0000-0000-000000000103', 'student', 'test fixture'),
  ('00000000-0000-0000-0000-000000000104', 'student', 'test fixture');

insert into public.tags (id, tag_name, display_name, created_by) values
  ('20000000-0000-0000-0000-000000000001', 'TST9MA1B', 'Test Year 9 Maths Set 1', '00000000-0000-0000-0000-000000000101');

insert into public.tag_memberships (profile_id, tag_id, membership_role, source) values
  ('00000000-0000-0000-0000-000000000101', '20000000-0000-0000-0000-000000000001', 'teacher', 'test'),
  ('00000000-0000-0000-0000-000000000102', '20000000-0000-0000-0000-000000000001', 'member', 'test'),
  ('00000000-0000-0000-0000-000000000104', '20000000-0000-0000-0000-000000000001', 'member', 'test');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select lives_ok(
  $$ select public.create_assignment('Trig worksheet', null, now() + interval '7 days', false,
    array['20000000-0000-0000-0000-000000000001']::uuid[]) $$,
  'teacher owning the tag can create an assignment'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', true);
select lives_ok(
  $$ select public.begin_file_upload('homework.pdf', 'application/pdf', 1024,
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb') $$,
  'in-audience student can create pending upload metadata for their own submission'
);
select set_config('test.student_in_file_id', (select id::text from public.files order by created_at desc limit 1), false);

select throws_ok(
  $$ select public.submit_assignment((select id from public.assignments where title = 'Trig worksheet'),
    current_setting('test.student_in_file_id')::uuid) $$,
  'P0002', 'file not found or not yet ready',
  'submission is rejected while the file has not yet passed verification'
);

reset role;
update public.files set state = 'ready' where id = current_setting('test.student_in_file_id')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', true);

select lives_ok(
  $$ select public.submit_assignment((select id from public.assignments where title = 'Trig worksheet'),
    current_setting('test.student_in_file_id')::uuid, 'first attempt') $$,
  'in-audience student can submit against a ready, owned file'
);
select is(
  (select count(*) from public.assignment_submissions)::bigint, 1::bigint,
  'exactly one submission row exists'
);
select throws_ok(
  $$ select public.submit_assignment((select id from public.assignments where title = 'Trig worksheet'),
    current_setting('test.student_in_file_id')::uuid) $$,
  '55000', 'this assignment does not accept resubmission',
  'resubmission is rejected when the assignment does not allow it'
);

-- A second in-audience student attempts to submit using the first
-- student's file: this isolates the file-ownership check specifically,
-- since both students can read the assignment (the audience check alone
-- would not catch this). The files SELECT inside submit_assignment runs
-- under the function-owner's elevated context, not RLS-filtered by caller,
-- so it is submit_assignment's own explicit ownership check - not RLS - that
-- rejects this, which is exactly the intended defence-in-depth.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000104', true);
select throws_ok(
  $$ select public.submit_assignment((select id from public.assignments where title = 'Trig worksheet'),
    current_setting('test.student_in_file_id')::uuid) $$,
  '42501', 'submission file must belong to the submitting student',
  'a different in-audience student cannot submit using a file they do not own'
);

-- The assignment id here is resolved by a subquery evaluated in the
-- caller's own (non-elevated, RLS-restricted) context before
-- submit_assignment is even invoked, so an out-of-audience student's
-- subquery already returns null - the function then correctly reports "not
-- found" rather than ever reaching the audience check inside its body.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000103', true);
select throws_ok(
  $$ select public.submit_assignment((select id from public.assignments where title = 'Trig worksheet'),
    current_setting('test.student_in_file_id')::uuid) $$,
  'P0002', 'assignment not found',
  'student outside the audience cannot resolve, let alone submit against, the assignment'
);
select is(
  (select count(*) from public.assignments)::bigint, 0::bigint,
  'student outside the audience cannot even read the assignment'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', true);
select is(
  (select count(*) from public.assignment_submissions where student_id = '00000000-0000-0000-0000-000000000102')::bigint,
  1::bigint,
  'submitting student can read their own submission'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select is(
  (select count(*) from public.assignment_submissions)::bigint, 1::bigint,
  'owning teacher can read submissions against their assignment'
);

select throws_ok(
  $$ update public.assignment_submissions set note = 'tampered' $$,
  '42501', 'permission denied for table assignment_submissions',
  'direct table update cannot bypass the immutable submission record'
);

select * from finish();
rollback;
