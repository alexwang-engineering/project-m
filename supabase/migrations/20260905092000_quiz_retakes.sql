alter table public.quizzes
  add column attempt_limit smallint default 1 check (attempt_limit is null or attempt_limit between 1 and 3),
  add column gradebook_policy text not null default 'highest'
    check (gradebook_policy in ('highest', 'latest'));

alter table public.quiz_attempts drop constraint quiz_attempts_one_per_student;
alter table public.quiz_attempts
  add column attempt_number smallint not null default 1 check (attempt_number > 0),
  add constraint quiz_attempts_number_unique unique (quiz_id, student_id, attempt_number);

create or replace function public.create_quiz_with_policy(
  quiz_title text,
  quiz_due_at timestamptz,
  audience_tag_ids uuid[],
  quiz_questions jsonb,
  quiz_attempt_limit integer,
  quiz_gradebook_policy text,
  correlation_id uuid default null
) returns public.quizzes
language plpgsql security definer set search_path = '' as $$
declare created public.quizzes;
begin
  if quiz_attempt_limit is not null and quiz_attempt_limit not between 1 and 3 then
    raise exception using errcode = '22023', message = 'attempt limit must be one, two, three, or unlimited';
  end if;
  if quiz_gradebook_policy not in ('highest', 'latest') then
    raise exception using errcode = '22023', message = 'invalid gradebook policy';
  end if;
  created := public.create_quiz(
    quiz_title, quiz_due_at, audience_tag_ids, quiz_questions, correlation_id
  );
  update public.quizzes set
    attempt_limit = quiz_attempt_limit,
    gradebook_policy = quiz_gradebook_policy
  where id = created.id returning * into created;
  return created;
end;
$$;
revoke all on function public.create_quiz_with_policy(text, timestamptz, uuid[], jsonb, integer, text, uuid) from public;
grant execute on function public.create_quiz_with_policy(text, timestamptz, uuid[], jsonb, integer, text, uuid) to authenticated;

-- Replace only the attempt-limit and insertion portion while preserving P2's
-- bounded payload validation and weighted exact-set grading.
create or replace function public.submit_quiz_attempt(
  target_quiz_id uuid,
  submitted_answers jsonb,
  correlation_id uuid default null
) returns public.quiz_attempts
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid(); quiz public.quizzes; attempt_count integer;
  total integer := 0; correct integer := 0; question record;
  selected_ids text[]; created public.quiz_attempts;
begin
  if not public.is_active_principal(actor) then raise exception using errcode = '42501', message = 'active principal required'; end if;
  -- ponytail: locking one quiz serializes its submissions briefly; use a
  -- per-student advisory lock only if real concurrent volume warrants it.
  select * into quiz from public.quizzes where id = target_quiz_id and archived_at is null for update;
  if not found then raise exception using errcode = 'P0002', message = 'quiz not found'; end if;
  if not public.can_read_quiz(target_quiz_id) then raise exception using errcode = '42501', message = 'quiz is not in your audience'; end if;
  if quiz.due_at is not null and now() > quiz.due_at then raise exception using errcode = '55000', message = 'the quiz deadline has passed'; end if;
  select count(*) into attempt_count from public.quiz_attempts where quiz_id = target_quiz_id and student_id = actor;
  if quiz.attempt_limit is not null and attempt_count >= quiz.attempt_limit then
    if quiz.attempt_limit = 1 then
      raise exception using errcode = '55000', message = 'you have already submitted this quiz';
    end if;
    raise exception using errcode = '55000', message = 'you have used every allowed attempt';
  end if;
  if jsonb_typeof(submitted_answers) <> 'object' or pg_column_size(submitted_answers) > 16384 then
    raise exception using errcode = '22023', message = 'answers must be a bounded object keyed by question id';
  end if;
  if (select count(*) from jsonb_object_keys(submitted_answers)) <> (select count(*) from public.quiz_questions where quiz_id = target_quiz_id)
    or exists (
      select 1 from jsonb_each(submitted_answers) answer(key, value)
      left join public.quiz_questions qq on qq.quiz_id = target_quiz_id and qq.id::text = answer.key
      where qq.id is null or not coalesce(public.valid_quiz_answer(qq.question_kind, qq.choices, answer.value), false)
    ) then raise exception using errcode = '22023', message = 'every quiz question needs one valid choice'; end if;
  for question in
    select qq.id, qq.question_kind, qq.weight, qk.correct_choice_ids
    from public.quiz_questions qq join public.quiz_answer_keys qk on qk.question_id = qq.id
    where qq.quiz_id = target_quiz_id
  loop
    total := total + question.weight;
    if question.question_kind = 'multiple_choice' then selected_ids := array[submitted_answers->>(question.id::text)];
    else select array_agg(value #>> '{}' order by value #>> '{}') into selected_ids from jsonb_array_elements(submitted_answers->(question.id::text)) value; end if;
    if selected_ids = (select array_agg(value order by value) from unnest(question.correct_choice_ids) value) then correct := correct + question.weight; end if;
  end loop;
  insert into public.quiz_attempts (quiz_id, student_id, attempt_number, answers, score, max_score)
  values (target_quiz_id, actor, attempt_count + 1, submitted_answers, correct, total) returning * into created;
  insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, after_data)
  values (actor, 'quiz.attempted', 'quiz_attempt', created.id, correlation_id, 'app',
    jsonb_build_object('quiz_id', target_quiz_id, 'attempt_number', created.attempt_number, 'score', created.score, 'max_score', created.max_score));
  return created;
end;
$$;

create or replace function public.teacher_gradebook_rollups(row_limit integer default 200)
returns table (item_kind text, item_id uuid, item_title text, submission_count bigint, average_percent numeric)
language sql stable security definer set search_path = '' as $$
  with managed_assignments as (
    select a.id, a.title, a.created_at from public.assignments a where public.can_manage_assignment(a.id)
    order by a.created_at desc limit least(greatest(coalesce(row_limit, 200), 1), 200)
  ), managed_quizzes as (
    select q.id, q.title, q.created_at, q.gradebook_policy from public.quizzes q where public.can_manage_quiz(q.id)
    order by q.created_at desc limit least(greatest(coalesce(row_limit, 200), 1), 200)
  ), effective_attempts as (
    select distinct on (qa.quiz_id, qa.student_id) qa.*
    from public.quiz_attempts qa join managed_quizzes q on q.id = qa.quiz_id
    order by qa.quiz_id, qa.student_id,
      case when q.gradebook_policy = 'highest' then 100.0 * qa.score / nullif(qa.max_score, 0) end desc nulls last,
      qa.attempt_number desc
  )
  select 'assignment', a.id, a.title, count(s.id), avg(g.grade)
  from managed_assignments a left join public.assignment_submissions s on s.assignment_id = a.id
  left join public.assignment_grades g on g.submission_id = s.id group by a.id, a.title, a.created_at
  union all
  select 'quiz', q.id, q.title, count(e.id), avg(100.0 * e.score / nullif(e.max_score, 0))
  from managed_quizzes q left join effective_attempts e on e.quiz_id = q.id group by q.id, q.title, q.created_at;
$$;
