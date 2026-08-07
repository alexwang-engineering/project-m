begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-000000000201', 'teacher-b@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000202', 'student-quiz-in@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000203', 'student-quiz-out@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000204', 'student-quiz-in-two@merchanttaylors.com', 'authenticated', 'authenticated');

insert into public.profiles (id, email, kind, state) values
  ('00000000-0000-0000-0000-000000000201', 'teacher-b@merchanttaylors.com', 'institutional', 'active'),
  ('00000000-0000-0000-0000-000000000202', 'student-quiz-in@merchanttaylors.com', 'institutional', 'active'),
  ('00000000-0000-0000-0000-000000000203', 'student-quiz-out@merchanttaylors.com', 'institutional', 'active'),
  ('00000000-0000-0000-0000-000000000204', 'student-quiz-in-two@merchanttaylors.com', 'institutional', 'active');

insert into public.role_assignments (profile_id, role, reason) values
  ('00000000-0000-0000-0000-000000000201', 'teacher', 'test fixture'),
  ('00000000-0000-0000-0000-000000000202', 'student', 'test fixture'),
  ('00000000-0000-0000-0000-000000000203', 'student', 'test fixture'),
  ('00000000-0000-0000-0000-000000000204', 'student', 'test fixture');

insert into public.tags (id, tag_name, display_name, created_by) values
  ('20000000-0000-0000-0000-000000000002', 'Y10SC1', 'Year 10 Science Set 1', '00000000-0000-0000-0000-000000000201');

insert into public.tag_memberships (profile_id, tag_id, membership_role, source) values
  ('00000000-0000-0000-0000-000000000201', '20000000-0000-0000-0000-000000000002', 'teacher', 'test'),
  ('00000000-0000-0000-0000-000000000202', '20000000-0000-0000-0000-000000000002', 'member', 'test'),
  ('00000000-0000-0000-0000-000000000204', '20000000-0000-0000-0000-000000000002', 'member', 'test');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', true);
select lives_ok(
  $$ select public.create_quiz('Photosynthesis basics', now() + interval '7 days',
    array['20000000-0000-0000-0000-000000000002']::uuid[],
    '[
      {"prompt": "What gas do plants absorb?", "choices": [{"id":"a","label":"Oxygen"},{"id":"b","label":"Carbon dioxide"}], "correctChoiceId": "b"},
      {"prompt": "Where does photosynthesis mainly occur?", "choices": [{"id":"a","label":"Roots"},{"id":"b","label":"Chloroplasts"}], "correctChoiceId": "b"}
    ]'::jsonb) $$,
  'teacher owning the tag can create a quiz with two questions'
);
select is(
  (select count(*) from public.quiz_questions
   where quiz_id = (select id from public.quizzes where title = 'Photosynthesis basics'))::bigint,
  2::bigint, 'both questions were inserted'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000202', true);
select is(
  (select count(*) from public.quiz_questions
   where quiz_id = (select id from public.quizzes where title = 'Photosynthesis basics'))::bigint,
  2::bigint, 'in-audience student can read the questions'
);
select is(
  (select count(*) from public.quiz_answer_keys)::bigint, 0::bigint,
  'in-audience student cannot read the answer key directly'
);

select lives_ok(
  $$ select public.submit_quiz_attempt(
    (select id from public.quizzes where title = 'Photosynthesis basics'),
    jsonb_build_object(
      (select id::text from public.quiz_questions where position = 1 and quiz_id = (select id from public.quizzes where title = 'Photosynthesis basics')), 'b',
      (select id::text from public.quiz_questions where position = 2 and quiz_id = (select id from public.quizzes where title = 'Photosynthesis basics')), 'a'
    )) $$,
  'in-audience student can submit one attempt (one correct, one wrong)'
);
select is(
  (select score from public.quiz_attempts where student_id = '00000000-0000-0000-0000-000000000202')::int,
  1, 'score reflects exactly one correct answer'
);
select is(
  (select max_score from public.quiz_attempts where student_id = '00000000-0000-0000-0000-000000000202')::int,
  2, 'max_score reflects both questions'
);

select throws_ok(
  $$ select public.submit_quiz_attempt(
    (select id from public.quizzes where title = 'Photosynthesis basics'), '{}'::jsonb) $$,
  '55000', 'you have already submitted this quiz',
  'a second attempt by the same student is rejected'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000203', true);
select throws_ok(
  $$ select public.submit_quiz_attempt(
    (select id from public.quizzes where title = 'Photosynthesis basics'), '{}'::jsonb) $$,
  'P0002', 'quiz not found',
  'student outside the audience cannot resolve, let alone attempt, the quiz'
);
select is(
  (select count(*) from public.quizzes)::bigint, 0::bigint,
  'student outside the audience cannot even read the quiz'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000204', true);
select is(
  (select count(*) from public.quiz_attempts)::bigint, 0::bigint,
  'a different in-audience student (not managing the quiz) cannot see another student''s attempt'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', true);
select is(
  (select count(*) from public.quiz_attempts)::bigint, 1::bigint,
  'owning teacher can read every attempt against their quiz'
);
select is(
  (select correct_choice_id from public.quiz_answer_keys
   where question_id = (select id from public.quiz_questions where position = 1
     and quiz_id = (select id from public.quizzes where title = 'Photosynthesis basics')))::text,
  'b', 'owning teacher can read the answer key'
);

select throws_ok(
  $$ update public.quiz_attempts set score = 999 $$,
  '42501', 'permission denied for table quiz_attempts',
  'direct table update cannot bypass the immutable attempt record'
);

-- Grading extension, reusing the assignments fixture pattern in a fresh scope.
-- Direct table INSERT is not an option here (authenticated has no INSERT
-- grant on assignments, by design - all writes go through the audited
-- RPCs), so this goes through create_assignment like every other fixture.
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', true);
select lives_ok(
  $$ select public.create_assignment('Lab report', null, null, false,
    array['20000000-0000-0000-0000-000000000002']::uuid[]) $$,
  'teacher can create the lab report assignment for grading fixtures'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000202', true);
select lives_ok(
  $$ select public.begin_file_upload('lab-report.pdf', 'application/pdf', 2048,
    'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc') $$,
  'student can begin an upload for the lab report'
);
reset role;
update public.files set state = 'ready'
where owner_id = '00000000-0000-0000-0000-000000000202' and original_name = 'lab-report.pdf';
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000202', true);
select lives_ok(
  $$ select public.submit_assignment((select id from public.assignments where title = 'Lab report'),
    (select id from public.files where owner_id = '00000000-0000-0000-0000-000000000202' and original_name = 'lab-report.pdf')) $$,
  'student submits the lab report'
);

-- Same subquery-resolution gotcha documented in 007_assignments.sql: the
-- submission id subquery evaluates under student 204's own RLS-restricted
-- context before grade_assignment_submission is even called. RLS on
-- assignment_submissions already hides another student's row from a
-- non-managing tag member, so the subquery itself returns null and the
-- function reports "not found" rather than ever reaching its own
-- can_manage_assignment check.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000204', true);
select throws_ok(
  $$ select public.grade_assignment_submission(
    (select id from public.assignment_submissions where assignment_id = (select id from public.assignments where title = 'Lab report')), 85) $$,
  'P0002', 'submission not found',
  'a non-managing tag member cannot even resolve, let alone grade, another student''s submission'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', true);
select throws_ok(
  $$ select public.grade_assignment_submission(
    (select id from public.assignment_submissions where assignment_id = (select id from public.assignments where title = 'Lab report')), 150) $$,
  '22023', 'grade must be between 0 and 100',
  'a grade outside 0-100 is rejected'
);
select lives_ok(
  $$ select public.grade_assignment_submission(
    (select id from public.assignment_submissions where assignment_id = (select id from public.assignments where title = 'Lab report')), 85, 'Good structure') $$,
  'owning teacher can grade a submission with feedback'
);

select * from finish();
rollback;
