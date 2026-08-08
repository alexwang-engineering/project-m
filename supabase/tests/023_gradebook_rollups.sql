begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email, aud, role) values
  ('23000000-0000-4000-8000-000000000001', 'rollup-teacher@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('23000000-0000-4000-8000-000000000002', 'rollup-student@merchanttaylors.com', 'authenticated', 'authenticated');
insert into public.profiles (id, email, kind, state) values
  ('23000000-0000-4000-8000-000000000001', 'rollup-teacher@merchanttaylors.com', 'institutional', 'active'),
  ('23000000-0000-4000-8000-000000000002', 'rollup-student@merchanttaylors.com', 'institutional', 'active');
insert into public.role_assignments (profile_id, role, reason) values
  ('23000000-0000-4000-8000-000000000001', 'teacher', 'test fixture'),
  ('23000000-0000-4000-8000-000000000002', 'student', 'test fixture');
insert into public.tags (id, tag_name, display_name, created_by) values
  ('23000000-0000-4000-8000-000000000003', 'Y9ROLLUP', 'Rollup test', '23000000-0000-4000-8000-000000000001');
insert into public.tag_memberships (profile_id, tag_id, membership_role, source) values
  ('23000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000003', 'teacher', 'test'),
  ('23000000-0000-4000-8000-000000000002', '23000000-0000-4000-8000-000000000003', 'member', 'test');
insert into public.assignments (id, title, created_by) values
  ('23000000-0000-4000-8000-000000000004', 'Rollup assignment', '23000000-0000-4000-8000-000000000001');
insert into public.assignment_tags (assignment_id, tag_id, added_by) values
  ('23000000-0000-4000-8000-000000000004', '23000000-0000-4000-8000-000000000003', '23000000-0000-4000-8000-000000000001');
insert into public.files (id, owner_id, object_name, original_name, media_type, size_bytes, sha256, state, scanned_at) values
  ('23000000-0000-4000-8000-000000000005', '23000000-0000-4000-8000-000000000002', 'rollup/work.pdf', 'work.pdf', 'application/pdf', 100, repeat('a', 64), 'ready', now());
insert into public.assignment_submissions (id, assignment_id, student_id, file_id) values
  ('23000000-0000-4000-8000-000000000006', '23000000-0000-4000-8000-000000000004', '23000000-0000-4000-8000-000000000002', '23000000-0000-4000-8000-000000000005');
insert into public.assignment_grades (submission_id, grade, graded_by) values
  ('23000000-0000-4000-8000-000000000006', 80, '23000000-0000-4000-8000-000000000001');
insert into public.quizzes (id, title, author_id) values
  ('23000000-0000-4000-8000-000000000007', 'Rollup quiz', '23000000-0000-4000-8000-000000000001');
insert into public.quiz_tags (quiz_id, tag_id, added_by) values
  ('23000000-0000-4000-8000-000000000007', '23000000-0000-4000-8000-000000000003', '23000000-0000-4000-8000-000000000001');
insert into public.quiz_attempts (quiz_id, student_id, answers, score, max_score) values
  ('23000000-0000-4000-8000-000000000007', '23000000-0000-4000-8000-000000000002', '{}'::jsonb, 1, 2);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '23000000-0000-4000-8000-000000000001', true);

select is((select count(*) from public.teacher_gradebook_rollups())::bigint, 2::bigint,
  'teacher receives one bounded aggregate row per managed assessment');
select is((select submission_count from public.teacher_gradebook_rollups() where item_kind = 'assignment'), 1::bigint,
  'assignment submission count is aggregated in Postgres');
select is((select average_percent from public.teacher_gradebook_rollups() where item_kind = 'assignment'), 80::numeric,
  'assignment average is aggregated in Postgres');
select is((select average_percent from public.teacher_gradebook_rollups() where item_kind = 'quiz'), 50::numeric,
  'quiz percentage is aggregated in Postgres');
select is((select count(*) from public.teacher_gradebook_rollups(0))::bigint, 2::bigint,
  'caller cannot request an unbounded or zero-sized result');

select set_config('request.jwt.claim.sub', '23000000-0000-4000-8000-000000000002', true);
select is((select count(*) from public.teacher_gradebook_rollups())::bigint, 0::bigint,
  'student receives no teacher gradebook aggregates');

select * from finish();
rollback;
