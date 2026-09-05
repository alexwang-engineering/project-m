begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email, aud, role) values
  ('32000000-0000-4000-8000-000000000001', 'retake-teacher@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('32000000-0000-4000-8000-000000000002', 'retake-student@merchanttaylors.com', 'authenticated', 'authenticated');
insert into public.profiles (id, email, kind, state) values
  ('32000000-0000-4000-8000-000000000001', 'retake-teacher@merchanttaylors.com', 'institutional', 'active'),
  ('32000000-0000-4000-8000-000000000002', 'retake-student@merchanttaylors.com', 'institutional', 'active');
insert into public.role_assignments (profile_id, role, reason) values
  ('32000000-0000-4000-8000-000000000001', 'teacher', 'test'),
  ('32000000-0000-4000-8000-000000000002', 'student', 'test');
insert into public.tags (id, tag_name, display_name, created_by) values
  ('32000000-0000-4000-8000-000000000011', 'RETAKES', 'Retakes', '32000000-0000-4000-8000-000000000001');
insert into public.tag_memberships (profile_id, tag_id, membership_role, source) values
  ('32000000-0000-4000-8000-000000000001', '32000000-0000-4000-8000-000000000011', 'teacher', 'test'),
  ('32000000-0000-4000-8000-000000000002', '32000000-0000-4000-8000-000000000011', 'member', 'test');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '32000000-0000-4000-8000-000000000001', true);
select lives_ok($$ select public.create_quiz_with_policy(
  'Retake quiz', null, array['32000000-0000-4000-8000-000000000011']::uuid[],
  '[{"prompt":"Answer","kind":"multiple_choice","weight":1,"choices":[{"id":"a","label":"Correct"},{"id":"b","label":"Wrong"}],"correctChoiceId":"a"}]'::jsonb,
  2, 'highest') $$, 'teacher can create a two-attempt quiz');
select is((select attempt_limit from public.quizzes where title = 'Retake quiz'), 2::smallint, 'attempt limit is stored');
select is((select gradebook_policy from public.quizzes where title = 'Retake quiz'), 'highest', 'gradebook policy is explicit');

select set_config('request.jwt.claim.sub', '32000000-0000-4000-8000-000000000002', true);
select lives_ok($$ select public.submit_quiz_attempt(
  (select id from public.quizzes where title = 'Retake quiz'),
  jsonb_build_object((select id::text from public.quiz_questions where quiz_id = (select id from public.quizzes where title = 'Retake quiz')), 'a')) $$,
  'student can submit attempt one');
select lives_ok($$ select public.submit_quiz_attempt(
  (select id from public.quizzes where title = 'Retake quiz'),
  jsonb_build_object((select id::text from public.quiz_questions where quiz_id = (select id from public.quizzes where title = 'Retake quiz')), 'b')) $$,
  'student can submit attempt two');
select throws_ok($$ select public.submit_quiz_attempt(
  (select id from public.quizzes where title = 'Retake quiz'),
  jsonb_build_object((select id::text from public.quiz_questions where quiz_id = (select id from public.quizzes where title = 'Retake quiz')), 'a')) $$,
  '55000', 'you have used every allowed attempt', 'student cannot exceed the limit');
reset role;
select is((select array_agg(attempt_number order by attempt_number) from public.quiz_attempts
  where quiz_id = (select id from public.quizzes where title = 'Retake quiz')), array[1,2]::smallint[], 'attempts are append-only and numbered');
select is((select count(*) from public.audit_events where action = 'quiz.attempted'
  and after_data->>'quiz_id' = (select id::text from public.quizzes where title = 'Retake quiz'))::bigint,
  2::bigint, 'each attempt is independently audited');
select throws_ok($$ insert into public.quiz_attempts (quiz_id, student_id, attempt_number, answers, score, max_score)
  values ((select id from public.quizzes where title = 'Retake quiz'), '32000000-0000-4000-8000-000000000002', 2, '{}'::jsonb, 0, 1) $$,
  '23505', null, 'duplicate attempt numbers are rejected');
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '32000000-0000-4000-8000-000000000001', true);
select is((select average_percent from public.teacher_gradebook_rollups() where item_kind = 'quiz'), 100::numeric,
  'highest policy uses one best attempt per student');

select * from finish();
rollback;
