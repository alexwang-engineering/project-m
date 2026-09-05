begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email, aud, role) values
  ('31000000-0000-4000-8000-000000000001', 'quiz-weight-teacher@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('31000000-0000-4000-8000-000000000002', 'quiz-weight-student-a@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('31000000-0000-4000-8000-000000000003', 'quiz-weight-student-b@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('31000000-0000-4000-8000-000000000004', 'quiz-weight-student-c@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('31000000-0000-4000-8000-000000000005', 'quiz-weight-student-d@merchanttaylors.com', 'authenticated', 'authenticated');
insert into public.profiles (id, email, kind, state) values
  ('31000000-0000-4000-8000-000000000001', 'quiz-weight-teacher@merchanttaylors.com', 'institutional', 'active'),
  ('31000000-0000-4000-8000-000000000002', 'quiz-weight-student-a@merchanttaylors.com', 'institutional', 'active'),
  ('31000000-0000-4000-8000-000000000003', 'quiz-weight-student-b@merchanttaylors.com', 'institutional', 'active'),
  ('31000000-0000-4000-8000-000000000004', 'quiz-weight-student-c@merchanttaylors.com', 'institutional', 'active'),
  ('31000000-0000-4000-8000-000000000005', 'quiz-weight-student-d@merchanttaylors.com', 'institutional', 'active');
insert into public.role_assignments (profile_id, role, reason) values
  ('31000000-0000-4000-8000-000000000001', 'teacher', 'test fixture'),
  ('31000000-0000-4000-8000-000000000002', 'student', 'test fixture'),
  ('31000000-0000-4000-8000-000000000003', 'student', 'test fixture'),
  ('31000000-0000-4000-8000-000000000004', 'student', 'test fixture'),
  ('31000000-0000-4000-8000-000000000005', 'student', 'test fixture');
insert into public.tags (id, tag_name, display_name, created_by) values
  ('31000000-0000-4000-8000-000000000011', 'MULTIANSWER', 'Multiple Answer', '31000000-0000-4000-8000-000000000001');
insert into public.tag_memberships (profile_id, tag_id, membership_role, source) values
  ('31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000011', 'teacher', 'test'),
  ('31000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000011', 'member', 'test'),
  ('31000000-0000-4000-8000-000000000003', '31000000-0000-4000-8000-000000000011', 'member', 'test'),
  ('31000000-0000-4000-8000-000000000004', '31000000-0000-4000-8000-000000000011', 'member', 'test'),
  ('31000000-0000-4000-8000-000000000005', '31000000-0000-4000-8000-000000000011', 'member', 'test');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$ select public.create_quiz('Weighted quiz', null, array['31000000-0000-4000-8000-000000000011']::uuid[],
    '[{"prompt":"One","kind":"multiple_choice","weight":2,"choices":[{"id":"a","label":"No"},{"id":"b","label":"Yes"}],"correctChoiceId":"b"},{"prompt":"Many","kind":"multiple_answer","weight":3,"choices":[{"id":"a","label":"A"},{"id":"b","label":"B"},{"id":"c","label":"C"}],"correctChoiceIds":["a","c"]}]'::jsonb) $$,
  'teacher can create a weighted mixed-type quiz');
select is((select sum(weight) from public.quiz_questions where quiz_id = (select id from public.quizzes where title = 'Weighted quiz'))::bigint,
  5::bigint, 'question weights are stored');
select is((select question_kind from public.quiz_questions where prompt = 'Many'), 'multiple_answer', 'multiple-answer kind is stored');

select set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000002', true);
select is((select count(*) from public.quiz_answer_keys)::bigint, 0::bigint, 'student cannot read answer keys');
select lives_ok(
  $$ select public.submit_quiz_attempt(
    (select id from public.quizzes where title = 'Weighted quiz'),
    jsonb_build_object(
      (select id::text from public.quiz_questions where prompt = 'One'), 'b',
      (select id::text from public.quiz_questions where prompt = 'Many'), jsonb_build_array('c','a')
    )) $$, 'correct selections are accepted regardless of order');
select is((select score from public.quiz_attempts where student_id = '31000000-0000-4000-8000-000000000002'), 5, 'exact answers earn weighted score');
select is((select max_score from public.quiz_attempts where student_id = '31000000-0000-4000-8000-000000000002'), 5, 'max score is the sum of weights');

select set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000003', true);
select throws_ok(
  $$ select public.submit_quiz_attempt(
    (select id from public.quizzes where title = 'Weighted quiz'),
    jsonb_build_object(
      (select id::text from public.quiz_questions where prompt = 'One'), 'b',
      (select id::text from public.quiz_questions where prompt = 'Many'), jsonb_build_array('a','a')
    )) $$, '22023', 'every quiz question needs one valid choice', 'duplicate selections are rejected');
select set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000004', true);
select throws_ok(
  $$ select public.submit_quiz_attempt(
    (select id from public.quizzes where title = 'Weighted quiz'),
    jsonb_build_object(
      (select id::text from public.quiz_questions where prompt = 'One'), 'b',
      (select id::text from public.quiz_questions where prompt = 'Many'), jsonb_build_array('a','unknown')
    )) $$, '22023', 'every quiz question needs one valid choice', 'unknown selections are rejected');
select set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000005', true);
select lives_ok(
  $$ select public.submit_quiz_attempt(
    (select id from public.quizzes where title = 'Weighted quiz'),
    jsonb_build_object(
      (select id::text from public.quiz_questions where prompt = 'One'), 'b',
      (select id::text from public.quiz_questions where prompt = 'Many'), jsonb_build_array('a')
    )) $$, 'a valid partial set is accepted as an incorrect answer');
select is((select score from public.quiz_attempts where student_id = '31000000-0000-4000-8000-000000000005'), 2, 'partial set earns no multiple-answer points');

select set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$ select public.create_quiz('Bad key', null, array['31000000-0000-4000-8000-000000000011']::uuid[],
    '[{"prompt":"Bad","kind":"multiple_answer","weight":1,"choices":[{"id":"a","label":"A"},{"id":"b","label":"B"}],"correctChoiceIds":["a","a"]}]'::jsonb) $$,
  '22023', 'answer key must contain unique known choice IDs', 'duplicate answer-key IDs are rejected');
select throws_ok(
  $$ select public.create_quiz('Bad weight', null, array['31000000-0000-4000-8000-000000000011']::uuid[],
    '[{"prompt":"Bad","kind":"multiple_choice","weight":0,"choices":[{"id":"a","label":"A"},{"id":"b","label":"B"}],"correctChoiceId":"a"}]'::jsonb) $$,
  '22023', 'question weight must be between 1 and 100', 'non-positive weights are rejected');
select is((select count(*) from public.quiz_questions where quiz_id = (select id from public.quizzes where title = 'Weighted quiz'))::bigint,
  2::bigint, 'failed quiz creations are atomic');

select * from finish();
rollback;
