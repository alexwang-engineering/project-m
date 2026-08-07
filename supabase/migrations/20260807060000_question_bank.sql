-- Package T (ADR-014): a shared, tag-scoped question bank, reused into
-- quizzes by copy-on-import - not a live reference. A bank item has no
-- student read path at all, so read and manage collapse into a single
-- authorization tier (can_access_bank_item), unlike quizzes' broader
-- member-can-read/teacher-can-manage split. Correct answers live directly
-- on the row (no separate answer-key table like quiz_answer_keys) because
-- the property that table protects - "a student must never read the
-- answer before attempting" - does not apply here.

create table public.question_bank_items (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  choices jsonb not null,
  correct_choice_id text not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint question_bank_items_prompt_not_blank check (btrim(prompt) <> ''),
  constraint question_bank_items_choices_shape check (
    jsonb_typeof(choices) = 'array' and jsonb_array_length(choices) between 2 and 8
  )
);
create index question_bank_items_created_by_idx on public.question_bank_items (created_by) where archived_at is null;

create table public.question_bank_item_tags (
  item_id uuid not null references public.question_bank_items(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete restrict,
  added_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (item_id, tag_id)
);
create index question_bank_item_tags_tag_idx on public.question_bank_item_tags (tag_id, item_id);

-- Optional provenance only - quizzes never read from the bank live. Set
-- once at import time, untouched afterward; archiving or editing the
-- source item must never retroactively affect a quiz that already copied
-- from it (same immutable-snapshot precedent as page revisions).
alter table public.quiz_questions add column sourced_from_bank_item_id uuid references public.question_bank_items(id) on delete set null;

create or replace function public.can_access_bank_item(target_item uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.question_bank_items i where i.id = target_item and i.archived_at is null and (
      public.is_active_principal(auth.uid()) and (
        i.created_by = auth.uid()
        or public.has_system_role('institution_admin', auth.uid())
        or exists (
          select 1 from public.question_bank_item_tags it
          where it.item_id = i.id
            and public.has_tag_membership(it.tag_id, array['teacher','manager']::public.membership_role[], auth.uid())
        )
      )
    )
  );
$$;
revoke all on function public.can_access_bank_item(uuid) from public;
grant execute on function public.can_access_bank_item(uuid) to authenticated;

create or replace function public.create_bank_item(
  item_prompt text,
  item_choices jsonb,
  item_correct_choice_id text,
  audience_tag_ids uuid[],
  correlation_id uuid default null
) returns public.question_bank_items
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  created public.question_bank_items;
  tag_id uuid;
begin
  if nullif(btrim(item_prompt), '') is null or length(item_prompt) > 2000 then
    raise exception using errcode = '22023', message = 'a bank item needs a non-empty prompt up to 2000 characters';
  end if;
  if jsonb_typeof(item_choices) <> 'array'
    or jsonb_array_length(item_choices) < 2
    or jsonb_array_length(item_choices) > 8
  then
    raise exception using errcode = '22023', message = 'a bank item needs between 2 and 8 choices';
  end if;
  if item_correct_choice_id is null or not exists (
    select 1 from jsonb_array_elements(item_choices) choice
    where choice->>'id' = item_correct_choice_id
  ) then
    raise exception using errcode = '22023', message = 'correct_choice_id must match one of the item choices';
  end if;
  perform public.assert_can_assign_tags(audience_tag_ids, actor);

  insert into public.question_bank_items (prompt, choices, correct_choice_id, created_by)
  values (btrim(item_prompt), item_choices, item_correct_choice_id, actor)
  returning * into created;

  foreach tag_id in array audience_tag_ids loop
    insert into public.question_bank_item_tags (item_id, tag_id, added_by) values (created.id, tag_id, actor);
  end loop;

  insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, after_data)
  values (actor, 'question_bank_item.created', 'question_bank_item', created.id, correlation_id, 'app',
    jsonb_build_object('tags', audience_tag_ids));
  return created;
end;
$$;
revoke all on function public.create_bank_item(text, jsonb, text, uuid[], uuid) from public;
grant execute on function public.create_bank_item(text, jsonb, text, uuid[], uuid) to authenticated;

-- Create-and-archive only, matching the precedent already set for
-- calendar events and announcements - a wrong bank item is archived and
-- re-created, not patched in place.
create or replace function public.archive_bank_item(
  target_item_id uuid,
  correlation_id uuid default null
) returns public.question_bank_items
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); updated public.question_bank_items;
begin
  if not public.can_access_bank_item(target_item_id) then
    raise exception using errcode = 'P0002', message = 'bank item not found';
  end if;
  update public.question_bank_items set archived_at = now()
  where id = target_item_id and archived_at is null
  returning * into updated;
  if not found then
    raise exception using errcode = '55000', message = 'bank item is already archived';
  end if;

  insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source)
  values (actor, 'question_bank_item.archived', 'question_bank_item', target_item_id, correlation_id, 'app');
  return updated;
end;
$$;
revoke all on function public.archive_bank_item(uuid, uuid) from public;
grant execute on function public.archive_bank_item(uuid, uuid) to authenticated;

alter table public.question_bank_items enable row level security;
alter table public.question_bank_item_tags enable row level security;

create policy question_bank_items_read on public.question_bank_items for select to authenticated
using (public.can_access_bank_item(id));
create policy question_bank_item_tags_read on public.question_bank_item_tags for select to authenticated
using (public.can_access_bank_item(item_id));

grant select on public.question_bank_items to authenticated;
grant select on public.question_bank_item_tags to authenticated;

-- ---------------------------------------------------------------------------
-- create_quiz gains an optional capability, not a new RPC: each element of
-- quiz_questions may now be either the existing inline shape
-- ({prompt, choices, correctChoiceId}) or {bankItemId}, copying that item's
-- content in place of requiring inline prompt/choices. Every existing call
-- (all-inline, no bankItemId) behaves identically - this replaces the
-- function body only, the signature is unchanged.
-- ---------------------------------------------------------------------------

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
  resolved_correct_choice_id text;
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
    bank_item_id := nullif(question->>'bankItemId', '')::uuid;

    if bank_item_id is not null then
      if not public.can_access_bank_item(bank_item_id) then
        raise exception using errcode = 'P0002', message = 'bank item not found';
      end if;
      select * into bank_item from public.question_bank_items where id = bank_item_id;
      resolved_prompt := bank_item.prompt;
      resolved_choices := bank_item.choices;
      resolved_correct_choice_id := bank_item.correct_choice_id;
    else
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
      resolved_prompt := question->>'prompt';
      resolved_choices := question->'choices';
      resolved_correct_choice_id := question->>'correctChoiceId';
    end if;

    question_index := question_index + 1;
    insert into public.quiz_questions (quiz_id, position, prompt, choices, sourced_from_bank_item_id)
    values (created.id, question_index, resolved_prompt, resolved_choices, bank_item_id)
    returning id into new_question_id;
    insert into public.quiz_answer_keys (question_id, correct_choice_id)
    values (new_question_id, resolved_correct_choice_id);
  end loop;

  insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, after_data)
  values (actor, 'quiz.created', 'quiz', created.id, correlation_id, 'app',
    jsonb_build_object('tags', audience_tag_ids, 'question_count', question_index));
  return created;
end;
$$;
revoke all on function public.create_quiz(text, timestamptz, uuid[], jsonb, uuid) from public;
grant execute on function public.create_quiz(text, timestamptz, uuid[], jsonb, uuid) to authenticated;
