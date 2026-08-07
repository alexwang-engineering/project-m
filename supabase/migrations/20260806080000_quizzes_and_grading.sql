-- Minimal quiz slice, same "smallest correct thing" spirit as
-- 20260805100000's assignment/submission slice: multiple-choice only,
-- single attempt, auto-graded on submit. No timers, no question banks, no
-- partial credit, no manual review queue - those stay separate, additive
-- work if ever needed.
--
-- Correct answers live in a separate quiz_answer_keys table, deliberately
-- not covered by the same read policy as quiz_questions: a student who can
-- read a question must not be able to read its answer key before
-- attempting. submit_quiz_attempt (SECURITY DEFINER) reads it internally
-- to grade; only a manager-tier tag holder can read it directly (to author
-- or review the quiz).

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  due_at timestamptz,
  author_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint quizzes_title_not_blank check (btrim(title) <> '')
);
create index quizzes_due_idx on public.quizzes (due_at) where archived_at is null;

create table public.quiz_tags (
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete restrict,
  added_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (quiz_id, tag_id)
);
create index quiz_tags_tag_idx on public.quiz_tags (tag_id, quiz_id);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  position integer not null,
  prompt text not null,
  choices jsonb not null,
  constraint quiz_questions_position_positive check (position > 0),
  constraint quiz_questions_position_unique unique (quiz_id, position),
  constraint quiz_questions_prompt_not_blank check (btrim(prompt) <> ''),
  constraint quiz_questions_choices_shape check (
    jsonb_typeof(choices) = 'array' and jsonb_array_length(choices) between 2 and 8
  )
);
create index quiz_questions_quiz_idx on public.quiz_questions (quiz_id, position);

create table public.quiz_answer_keys (
  question_id uuid primary key references public.quiz_questions(id) on delete cascade,
  correct_choice_id text not null
);

-- Append-only, like assignment_submissions: an attempt is an immutable
-- event. One attempt per student per quiz (no resubmission for v1).
create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete restrict,
  student_id uuid not null references public.profiles(id) on delete restrict,
  answers jsonb not null,
  score integer not null,
  max_score integer not null,
  submitted_at timestamptz not null default now(),
  constraint quiz_attempts_score_bounds check (score >= 0 and score <= max_score),
  constraint quiz_attempts_one_per_student unique (quiz_id, student_id)
);
create index quiz_attempts_lookup_idx on public.quiz_attempts (quiz_id, student_id, submitted_at desc);

create or replace function public.can_read_quiz(target_quiz uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.quizzes q where q.id = target_quiz and q.archived_at is null and (
      public.is_active_principal(auth.uid()) and (
        q.author_id = auth.uid()
        or public.has_system_role('institution_admin', auth.uid())
        or exists (
          select 1 from public.quiz_tags qt
          where qt.quiz_id = q.id
            and public.has_tag_membership(qt.tag_id, array['member','teacher','manager']::public.membership_role[], auth.uid())
        )
      )
    )
  );
$$;
revoke all on function public.can_read_quiz(uuid) from public;
grant execute on function public.can_read_quiz(uuid) to authenticated;

-- Deliberately narrower than can_read_quiz, same reasoning as
-- can_manage_assignment: an ordinary 'member' tag holder can take the quiz
-- but must never see classmates' attempts or the answer key.
create or replace function public.can_manage_quiz(target_quiz uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_active_principal(auth.uid()) and exists (
    select 1 from public.quizzes q where q.id = target_quiz and q.archived_at is null and (
      q.author_id = auth.uid()
      or public.has_system_role('institution_admin', auth.uid())
      or exists (
        select 1 from public.quiz_tags qt
        where qt.quiz_id = q.id
          and public.has_tag_membership(qt.tag_id, array['teacher','manager']::public.membership_role[], auth.uid())
      )
    )
  );
$$;
revoke all on function public.can_manage_quiz(uuid) from public;
grant execute on function public.can_manage_quiz(uuid) to authenticated;

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
begin
  if nullif(btrim(quiz_title), '') is null or length(quiz_title) > 240 then
    raise exception using errcode = '22023', message = 'quiz title is required and must not exceed 240 characters';
  end if;
  perform public.assert_can_assign_tags(audience_tag_ids, actor);
  if jsonb_typeof(quiz_questions) <> 'array' or jsonb_array_length(quiz_questions) < 1 or jsonb_array_length(quiz_questions) > 100 then
    raise exception using errcode = '22023', message = 'a quiz needs between 1 and 100 questions';
  end if;

  insert into public.quizzes (title, due_at, author_id)
  values (btrim(quiz_title), quiz_due_at, actor)
  returning * into created;

  foreach tag_id in array audience_tag_ids loop
    insert into public.quiz_tags (quiz_id, tag_id, added_by) values (created.id, tag_id, actor);
  end loop;

  for question in select * from jsonb_array_elements(quiz_questions) loop
    if nullif(btrim(question->>'prompt'), '') is null or length(question->>'prompt') > 2000 then
      raise exception using errcode = '22023', message = 'every question needs a non-empty prompt up to 2000 characters';
    end if;
    if jsonb_typeof(question->'choices') <> 'array'
      or jsonb_array_length(question->'choices') < 2
      or jsonb_array_length(question->'choices') > 8
    then
      raise exception using errcode = '22023', message = 'every question needs between 2 and 8 choices';
    end if;
    if question->>'correctChoiceId' is null or not exists (
      select 1 from jsonb_array_elements(question->'choices') choice
      where choice->>'id' = question->>'correctChoiceId'
    ) then
      raise exception using errcode = '22023', message = 'correctChoiceId must match one of the question choices';
    end if;

    question_index := question_index + 1;
    insert into public.quiz_questions (quiz_id, position, prompt, choices)
    values (created.id, question_index, question->>'prompt', question->'choices')
    returning id into new_question_id;
    insert into public.quiz_answer_keys (question_id, correct_choice_id)
    values (new_question_id, question->>'correctChoiceId');
  end loop;

  insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, after_data)
  values (actor, 'quiz.created', 'quiz', created.id, correlation_id, 'app',
    jsonb_build_object('tags', audience_tag_ids, 'question_count', question_index));
  return created;
end;
$$;
revoke all on function public.create_quiz(text, timestamptz, uuid[], jsonb, uuid) from public;
grant execute on function public.create_quiz(text, timestamptz, uuid[], jsonb, uuid) to authenticated;

-- Grades server-side from the answer key so the client never needs (or
-- gets) to see correct answers before submitting.
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
  if jsonb_typeof(submitted_answers) <> 'object' then
    raise exception using errcode = '22023', message = 'answers must be an object keyed by question id';
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

alter table public.quizzes enable row level security;
alter table public.quiz_tags enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_answer_keys enable row level security;
alter table public.quiz_attempts enable row level security;

create policy quizzes_read on public.quizzes for select to authenticated
using (public.can_read_quiz(id));
create policy quiz_tags_read on public.quiz_tags for select to authenticated
using (public.can_read_quiz(quiz_id));
create policy quiz_questions_read on public.quiz_questions for select to authenticated
using (public.can_read_quiz(quiz_id));
-- Answer keys are readable only by whoever manages the quiz - never by an
-- ordinary tag member, even after they've attempted it.
create policy quiz_answer_keys_read on public.quiz_answer_keys for select to authenticated
using (exists (
  select 1 from public.quiz_questions qq
  where qq.id = quiz_answer_keys.question_id and public.can_manage_quiz(qq.quiz_id)
));
create policy quiz_attempts_read on public.quiz_attempts for select to authenticated
using (
  student_id = auth.uid()
  or public.can_manage_quiz(quiz_id)
);

grant select on public.quizzes to authenticated;
grant select on public.quiz_tags to authenticated;
grant select on public.quiz_questions to authenticated;
grant select on public.quiz_answer_keys to authenticated;
grant select on public.quiz_attempts to authenticated;

-- ---------------------------------------------------------------------------
-- Minimal grading extension for assignment_submissions (the gradebook's
-- other data source). Percentage-only, no rubric/moderation/release
-- workflow - ADR-008's 2026-08-05 addendum scoped assignments down to
-- "accept a submission with a timestamp"; this adds just enough on top for
-- a teacher to record a mark, nothing heavier.
-- ---------------------------------------------------------------------------

alter table public.assignment_submissions add column grade numeric;
alter table public.assignment_submissions add column grade_feedback text;
alter table public.assignment_submissions add column graded_by uuid references public.profiles(id) on delete set null;
alter table public.assignment_submissions add column graded_at timestamptz;
alter table public.assignment_submissions add constraint assignment_submissions_grade_range
  check (grade is null or (grade >= 0 and grade <= 100));
alter table public.assignment_submissions add constraint assignment_submissions_feedback_bounded
  check (grade_feedback is null or length(grade_feedback) <= 2000);

create or replace function public.grade_assignment_submission(
  target_submission_id uuid,
  grade_value numeric,
  feedback_text text default null,
  correlation_id uuid default null
) returns public.assignment_submissions
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); submission public.assignment_submissions; updated public.assignment_submissions;
begin
  select * into submission from public.assignment_submissions where id = target_submission_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'submission not found'; end if;
  if not public.can_manage_assignment(submission.assignment_id) then
    raise exception using errcode = '42501', message = 'you do not manage this assignment';
  end if;
  if grade_value is null or grade_value < 0 or grade_value > 100 then
    raise exception using errcode = '22023', message = 'grade must be between 0 and 100';
  end if;
  if feedback_text is not null and length(feedback_text) > 2000 then
    raise exception using errcode = '22023', message = 'feedback must not exceed 2000 characters';
  end if;

  update public.assignment_submissions set
    grade = grade_value,
    grade_feedback = feedback_text,
    graded_by = actor,
    graded_at = now()
  where id = target_submission_id
  returning * into updated;

  insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, before_data, after_data)
  values (actor, 'assignment_submission.graded', 'assignment_submission', target_submission_id, correlation_id, 'app',
    jsonb_build_object('grade', submission.grade), jsonb_build_object('grade', updated.grade));
  return updated;
end;
$$;
revoke all on function public.grade_assignment_submission(uuid, numeric, text, uuid) from public;
grant execute on function public.grade_assignment_submission(uuid, numeric, text, uuid) to authenticated;
