-- Accept only a complete set of choices for the quiz. The browser form is
-- not a trust boundary: callers can invoke this RPC directly with arbitrary
-- JSON, which must not be stored in an immutable attempt record.
create or replace function public.submit_quiz_attempt(
  target_quiz_id uuid,
  submitted_answers jsonb,
  correlation_id uuid default null
) returns public.quiz_attempts
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  quiz public.quizzes;
  already_attempted boolean;
  total integer := 0;
  correct integer := 0;
  question record;
  created public.quiz_attempts;
begin
  if not public.is_active_principal(actor) then
    raise exception using errcode = '42501', message = 'active principal required';
  end if;
  select * into quiz from public.quizzes where id = target_quiz_id and archived_at is null;
  if not found then raise exception using errcode = 'P0002', message = 'quiz not found'; end if;
  if not public.can_read_quiz(target_quiz_id) then
    raise exception using errcode = '42501', message = 'quiz is not in your audience';
  end if;
  if quiz.due_at is not null and now() > quiz.due_at then
    raise exception using errcode = '55000', message = 'the quiz deadline has passed';
  end if;

  select exists (
    select 1 from public.quiz_attempts a where a.quiz_id = target_quiz_id and a.student_id = actor
  ) into already_attempted;
  if already_attempted then
    raise exception using errcode = '55000', message = 'you have already submitted this quiz';
  end if;
  if jsonb_typeof(submitted_answers) <> 'object' or pg_column_size(submitted_answers) > 16384 then
    raise exception using errcode = '22023', message = 'answers must be a bounded object keyed by question id';
  end if;
  if (select count(*) from jsonb_object_keys(submitted_answers)) <>
      (select count(*) from public.quiz_questions where quiz_id = target_quiz_id)
    or exists (
      select 1
      from jsonb_each(submitted_answers) answer(key, value)
      left join public.quiz_questions qq
        on qq.quiz_id = target_quiz_id and qq.id::text = answer.key
      where qq.id is null
        or jsonb_typeof(answer.value) <> 'string'
        or not exists (
          select 1 from jsonb_array_elements(qq.choices) choice
          where choice ->> 'id' = answer.value #>> '{}'
        )
    )
  then
    raise exception using errcode = '22023', message = 'every quiz question needs one valid choice';
  end if;

  for question in
    select qq.id, qk.correct_choice_id
    from public.quiz_questions qq
    join public.quiz_answer_keys qk on qk.question_id = qq.id
    where qq.quiz_id = target_quiz_id
  loop
    total := total + 1;
    if submitted_answers->>(question.id::text) = question.correct_choice_id then
      correct := correct + 1;
    end if;
  end loop;

  insert into public.quiz_attempts (quiz_id, student_id, answers, score, max_score)
  values (target_quiz_id, actor, submitted_answers, correct, total)
  returning * into created;

  insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, after_data)
  values (actor, 'quiz.attempted', 'quiz_attempt', created.id, correlation_id, 'app',
    jsonb_build_object('quiz_id', target_quiz_id, 'score', created.score, 'max_score', created.max_score));
  return created;
end;
$$;
revoke all on function public.submit_quiz_attempt(uuid, jsonb, uuid) from public;
grant execute on function public.submit_quiz_attempt(uuid, jsonb, uuid) to authenticated;
