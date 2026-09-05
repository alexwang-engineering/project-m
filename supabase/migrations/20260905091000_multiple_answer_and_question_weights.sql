alter table public.quiz_questions
  add column question_kind text not null default 'multiple_choice'
    check (question_kind in ('multiple_choice', 'multiple_answer')),
  add column weight smallint not null default 1 check (weight between 1 and 100);

alter table public.quiz_answer_keys
  alter column correct_choice_id drop not null,
  add column correct_choice_ids text[];
update public.quiz_answer_keys set correct_choice_ids = array[correct_choice_id];
alter table public.quiz_answer_keys
  alter column correct_choice_ids set not null,
  add constraint quiz_answer_keys_choice_count
    check (cardinality(correct_choice_ids) between 1 and 8);

create or replace function public.valid_quiz_answer(
  question_kind text,
  choices jsonb,
  answer jsonb
) returns boolean language sql immutable set search_path = '' as $$
  select case question_kind
    when 'multiple_choice' then
      jsonb_typeof(answer) = 'string'
      and exists (
        select 1 from jsonb_array_elements(choices) choice
        where choice->>'id' = answer #>> '{}'
      )
    when 'multiple_answer' then
      jsonb_typeof(answer) = 'array'
      and jsonb_array_length(answer) between 1 and jsonb_array_length(choices)
      and (select count(*) from jsonb_array_elements(answer) selected
           where jsonb_typeof(selected) = 'string') = jsonb_array_length(answer)
      and (select count(distinct selected #>> '{}') from jsonb_array_elements(answer) selected)
          = jsonb_array_length(answer)
      and not exists (
        select 1 from jsonb_array_elements(answer) selected
        where not exists (
          select 1 from jsonb_array_elements(choices) choice
          where choice->>'id' = selected #>> '{}'
        )
      )
    else false
  end;
$$;

create or replace function public.create_quiz(
  quiz_title text,
  quiz_due_at timestamptz,
  audience_tag_ids uuid[],
  quiz_questions jsonb,
  correlation_id uuid default null
) returns public.quizzes
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  created public.quizzes;
  tag_id uuid;
  question jsonb;
  question_index integer := 0;
  new_question_id uuid;
  bank_item_id uuid;
  bank_item public.question_bank_items;
  resolved_prompt text;
  resolved_choices jsonb;
  resolved_kind text;
  resolved_weight integer;
  resolved_correct_choice_ids text[];
begin
  if nullif(btrim(quiz_title), '') is null or length(quiz_title) > 240 then
    raise exception using errcode = '22023', message = 'quiz title is required and must not exceed 240 characters';
  end if;
  perform public.assert_can_assign_tags(audience_tag_ids, actor);
  if jsonb_typeof(quiz_questions) <> 'array' or jsonb_array_length(quiz_questions) < 1 or jsonb_array_length(quiz_questions) > 100 then
    raise exception using errcode = '22023', message = 'a quiz needs between 1 and 100 questions';
  end if;

  insert into public.quizzes (title, due_at, author_id)
  values (btrim(quiz_title), quiz_due_at, actor) returning * into created;
  foreach tag_id in array audience_tag_ids loop
    insert into public.quiz_tags (quiz_id, tag_id, added_by) values (created.id, tag_id, actor);
  end loop;

  for question in select * from jsonb_array_elements(quiz_questions) loop
    bank_item_id := nullif(question->>'bankItemId', '')::uuid;
    resolved_weight := coalesce((question->>'weight')::integer, 1);
    if resolved_weight not between 1 and 100 then
      raise exception using errcode = '22023', message = 'question weight must be between 1 and 100';
    end if;

    if bank_item_id is not null then
      if not public.can_access_bank_item(bank_item_id) then
        raise exception using errcode = 'P0002', message = 'bank item not found';
      end if;
      select * into bank_item from public.question_bank_items where id = bank_item_id;
      resolved_prompt := bank_item.prompt;
      resolved_choices := bank_item.choices;
      resolved_kind := 'multiple_choice';
      resolved_correct_choice_ids := array[bank_item.correct_choice_id];
    else
      if nullif(btrim(question->>'prompt'), '') is null or length(question->>'prompt') > 2000 then
        raise exception using errcode = '22023', message = 'every question needs a non-empty prompt up to 2000 characters';
      end if;
      if jsonb_typeof(question->'choices') <> 'array'
        or jsonb_array_length(question->'choices') < 2
        or jsonb_array_length(question->'choices') > 8 then
        raise exception using errcode = '22023', message = 'every question needs between 2 and 8 choices';
      end if;
      resolved_prompt := question->>'prompt';
      resolved_choices := question->'choices';
      resolved_kind := coalesce(question->>'kind', 'multiple_choice');
      if resolved_kind = 'multiple_choice' then
        resolved_correct_choice_ids := array[question->>'correctChoiceId'];
      elsif resolved_kind = 'multiple_answer' and jsonb_typeof(question->'correctChoiceIds') = 'array' then
        select array_agg(value #>> '{}') into resolved_correct_choice_ids
        from jsonb_array_elements(question->'correctChoiceIds') value;
      else
        raise exception using errcode = '22023', message = 'invalid question kind or answer key';
      end if;
      if cardinality(resolved_correct_choice_ids) < 1
        or cardinality(resolved_correct_choice_ids) > jsonb_array_length(resolved_choices)
        or (select count(distinct value) from unnest(resolved_correct_choice_ids) value)
          <> cardinality(resolved_correct_choice_ids)
        or exists (
          select 1 from unnest(resolved_correct_choice_ids) answer(value)
          where value is null or not exists (
            select 1 from jsonb_array_elements(resolved_choices) choice
            where choice->>'id' = answer.value
          )
        ) then
        raise exception using errcode = '22023', message = 'answer key must contain unique known choice IDs';
      end if;
    end if;

    question_index := question_index + 1;
    insert into public.quiz_questions (
      quiz_id, position, prompt, choices, sourced_from_bank_item_id, question_kind, weight
    ) values (
      created.id, question_index, resolved_prompt, resolved_choices, bank_item_id, resolved_kind, resolved_weight
    ) returning id into new_question_id;
    insert into public.quiz_answer_keys (question_id, correct_choice_id, correct_choice_ids)
    values (
      new_question_id,
      case when resolved_kind = 'multiple_choice' then resolved_correct_choice_ids[1] else null end,
      resolved_correct_choice_ids
    );
  end loop;

  insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, after_data)
  values (actor, 'quiz.created', 'quiz', created.id, correlation_id, 'app',
    jsonb_build_object('tags', audience_tag_ids, 'question_count', question_index));
  return created;
end;
$$;

create or replace function public.submit_quiz_attempt(
  target_quiz_id uuid,
  submitted_answers jsonb,
  correlation_id uuid default null
) returns public.quiz_attempts
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  quiz public.quizzes;
  total integer := 0;
  correct integer := 0;
  question record;
  selected_ids text[];
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
  if exists (select 1 from public.quiz_attempts where quiz_id = target_quiz_id and student_id = actor) then
    raise exception using errcode = '55000', message = 'you have already submitted this quiz';
  end if;
  if jsonb_typeof(submitted_answers) <> 'object' or pg_column_size(submitted_answers) > 16384 then
    raise exception using errcode = '22023', message = 'answers must be a bounded object keyed by question id';
  end if;
  if (select count(*) from jsonb_object_keys(submitted_answers)) <>
      (select count(*) from public.quiz_questions where quiz_id = target_quiz_id)
    or exists (
      select 1 from jsonb_each(submitted_answers) answer(key, value)
      left join public.quiz_questions qq
        on qq.quiz_id = target_quiz_id and qq.id::text = answer.key
      where qq.id is null or not coalesce(public.valid_quiz_answer(qq.question_kind, qq.choices, answer.value), false)
    ) then
    raise exception using errcode = '22023', message = 'every quiz question needs one valid choice';
  end if;

  for question in
    select qq.id, qq.question_kind, qq.weight, qk.correct_choice_ids
    from public.quiz_questions qq join public.quiz_answer_keys qk on qk.question_id = qq.id
    where qq.quiz_id = target_quiz_id
  loop
    total := total + question.weight;
    if question.question_kind = 'multiple_choice' then
      selected_ids := array[submitted_answers->>(question.id::text)];
    else
      select array_agg(value #>> '{}' order by value #>> '{}') into selected_ids
      from jsonb_array_elements(submitted_answers->(question.id::text)) value;
    end if;
    if selected_ids = (select array_agg(value order by value) from unnest(question.correct_choice_ids) value) then
      correct := correct + question.weight;
    end if;
  end loop;

  insert into public.quiz_attempts (quiz_id, student_id, answers, score, max_score)
  values (target_quiz_id, actor, submitted_answers, correct, total) returning * into created;
  insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, after_data)
  values (actor, 'quiz.attempted', 'quiz_attempt', created.id, correlation_id, 'app',
    jsonb_build_object('quiz_id', target_quiz_id, 'score', created.score, 'max_score', created.max_score));
  return created;
end;
$$;

revoke all on function public.valid_quiz_answer(text, jsonb, jsonb) from public;
