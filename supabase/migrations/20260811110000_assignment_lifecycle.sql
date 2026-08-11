-- Assignment publishing is explicit. Existing rows were already visible, so
-- they are deterministically backfilled as published before draft becomes the
-- creation default.
alter table public.assignments
  add column lifecycle public.content_state,
  add column version bigint not null default 1,
  add column available_from timestamptz,
  add column published_at timestamptz,
  add column closed_at timestamptz;

update public.assignments
set lifecycle = case when archived_at is null then 'published'::public.content_state else 'archived'::public.content_state end,
    published_at = created_at;

alter table public.assignments
  alter column lifecycle set default 'draft',
  alter column lifecycle set not null,
  add constraint assignments_schedule_order check (
    available_from is null or due_at is null or available_from <= due_at
  ),
  add constraint assignments_lifecycle_timestamps check (
    (lifecycle = 'draft' and published_at is null and archived_at is null)
    or (lifecycle = 'published' and published_at is not null and archived_at is null)
    or (lifecycle = 'archived' and archived_at is not null)
  );

-- Staff may inspect assignment history, but only non-archived assignments are
-- mutable through can_manage_assignment. Students see only published work once
-- its availability time has arrived.
create or replace function public.can_read_assignment(target_assignment uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.assignments a
    where a.id = target_assignment
      and public.is_active_principal(auth.uid())
      and (
        public.has_system_role('institution_admin', auth.uid())
        or (
          public.has_system_role('teacher', auth.uid())
          and exists (select 1 from public.assignment_tags where assignment_id = a.id)
          and not exists (
            select 1 from public.assignment_tags at
            where at.assignment_id = a.id
              and not public.has_tag_membership(at.tag_id, array['teacher','manager']::public.membership_role[], auth.uid())
          )
        )
        or (
          a.lifecycle = 'published'
          and (a.available_from is null or a.available_from <= now())
          and exists (
            select 1 from public.assignment_tags at
            where at.assignment_id = a.id
              and public.has_tag_membership(at.tag_id, array['member','teacher','manager']::public.membership_role[], auth.uid())
          )
        )
      )
  );
$$;

create or replace function public.can_review_assignment(target_assignment uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_active_principal(auth.uid()) and (public.has_system_role('institution_admin', auth.uid()) or (
    public.has_system_role('teacher', auth.uid())
    and exists (select 1 from public.assignment_tags where assignment_id = target_assignment)
    and not exists (
      select 1 from public.assignment_tags at
      where at.assignment_id = target_assignment
        and not public.has_tag_membership(at.tag_id, array['teacher','manager']::public.membership_role[], auth.uid())
    )
  ));
$$;
revoke all on function public.can_review_assignment(uuid) from public;
grant execute on function public.can_review_assignment(uuid) to authenticated;

create or replace function public.can_manage_assignment(target_assignment uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_active_principal(auth.uid()) and (
    public.has_system_role('institution_admin', auth.uid()) or (
      public.has_system_role('teacher', auth.uid())
      and exists (select 1 from public.assignment_tags where assignment_id = target_assignment)
      and not exists (
        select 1 from public.assignment_tags at
        where at.assignment_id = target_assignment
          and not public.has_tag_membership(at.tag_id, array['teacher','manager']::public.membership_role[], auth.uid())
      )
      and exists (select 1 from public.assignments a where a.id = target_assignment and a.archived_at is null)
    )
  );
$$;

drop policy assignment_submissions_read on public.assignment_submissions;
create policy assignment_submissions_read on public.assignment_submissions for select to authenticated
using (student_id = auth.uid() or public.can_review_assignment(assignment_id));

-- Replace the earlier RPC with an availability-aware draft creator. Existing
-- positional callers remain compatible because the new parameter is last.
drop function public.create_assignment(text, uuid, timestamptz, boolean, uuid[], uuid);
create function public.create_assignment(
  assignment_title text,
  instructions_page uuid,
  assignment_due_at timestamptz,
  resubmission_allowed boolean,
  audience_tag_ids uuid[],
  correlation_id uuid default null,
  assignment_available_from timestamptz default null
) returns public.assignments
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); created public.assignments; instruction public.pages; tag_id uuid;
begin
  if nullif(btrim(assignment_title), '') is null or length(assignment_title) > 240 then
    raise exception using errcode = '22023', message = 'assignment title is required and must not exceed 240 characters';
  end if;
  if assignment_available_from is not null and assignment_due_at is not null and assignment_available_from > assignment_due_at then
    raise exception using errcode = '22023', message = 'availability must not be after the due date';
  end if;
  perform public.assert_can_assign_tags(audience_tag_ids, actor);
  if instructions_page is not null then
    select * into instruction from public.pages where id = instructions_page;
    if not found or instruction.lifecycle <> 'published' or not public.can_read_page(instructions_page)
       or (not instruction.is_public and exists (
         select 1 from unnest(audience_tag_ids) requested(tag_id)
         where not exists (select 1 from public.page_tags pt where pt.page_id = instructions_page and pt.tag_id = requested.tag_id)
       )) then
      raise exception using errcode = '42501', message = 'instructions page must be published and cover every audience tag';
    end if;
  end if;
  insert into public.assignments (title, instructions_page_id, due_at, available_from, allow_resubmission, created_by)
  values (btrim(assignment_title), instructions_page, assignment_due_at, assignment_available_from, coalesce(resubmission_allowed, false), actor)
  returning * into created;
  foreach tag_id in array audience_tag_ids loop
    insert into public.assignment_tags (assignment_id, tag_id, added_by) values (created.id, tag_id, actor);
  end loop;
  insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, after_data)
  values (actor, 'assignment.draft_created', 'assignment', created.id, correlation_id, 'app',
    jsonb_build_object('due_at', created.due_at, 'available_from', created.available_from, 'instructions_page_id', created.instructions_page_id, 'tags', audience_tag_ids));
  return created;
end;
$$;
revoke all on function public.create_assignment(text, uuid, timestamptz, boolean, uuid[], uuid, timestamptz) from public;
grant execute on function public.create_assignment(text, uuid, timestamptz, boolean, uuid[], uuid, timestamptz) to authenticated;

create function public.transition_assignment(
  target_assignment_id uuid,
  expected_version bigint,
  next_lifecycle public.content_state,
  correlation_id uuid default null
) returns public.assignments
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); current_row public.assignments; changed public.assignments; instruction public.pages;
begin
  select * into current_row from public.assignments where id = target_assignment_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'assignment not found'; end if;
  if not public.can_manage_assignment(target_assignment_id) then raise exception using errcode = '42501', message = 'assignment access denied'; end if;
  if current_row.version <> expected_version then raise exception using errcode = '40001', message = 'assignment changed; reload and try again'; end if;
  if next_lifecycle not in ('published', 'archived') or current_row.lifecycle = 'archived'
     or (next_lifecycle = 'published' and current_row.lifecycle <> 'draft') then
    raise exception using errcode = '22023', message = 'invalid assignment lifecycle transition';
  end if;
  if next_lifecycle = 'published' and current_row.instructions_page_id is not null then
    select * into instruction from public.pages where id = current_row.instructions_page_id;
    if not found or instruction.lifecycle <> 'published'
       or (not instruction.is_public and exists (
         select 1 from public.assignment_tags at where at.assignment_id = current_row.id
           and not exists (select 1 from public.page_tags pt where pt.page_id = instruction.id and pt.tag_id = at.tag_id)
       )) then
      raise exception using errcode = '42501', message = 'instructions page is unavailable to the full audience';
    end if;
  end if;
  update public.assignments set
    lifecycle = next_lifecycle,
    published_at = case when next_lifecycle = 'published' then coalesce(published_at, now()) else published_at end,
    archived_at = case when next_lifecycle = 'archived' then now() else null end,
    version = version + 1
  where id = target_assignment_id returning * into changed;
  insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, before_data, after_data)
  values (actor, 'assignment.' || next_lifecycle::text, 'assignment', changed.id, correlation_id, 'app',
    jsonb_build_object('lifecycle', current_row.lifecycle, 'version', current_row.version),
    jsonb_build_object('lifecycle', changed.lifecycle, 'version', changed.version));
  return changed;
end;
$$;
revoke all on function public.transition_assignment(uuid, bigint, public.content_state, uuid) from public;
grant execute on function public.transition_assignment(uuid, bigint, public.content_state, uuid) to authenticated;

create function public.set_assignment_closed(
  target_assignment_id uuid,
  expected_version bigint,
  is_closed boolean,
  correlation_id uuid default null
) returns public.assignments
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); current_row public.assignments; changed public.assignments;
begin
  select * into current_row from public.assignments where id = target_assignment_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'assignment not found'; end if;
  if not public.can_manage_assignment(target_assignment_id) then raise exception using errcode = '42501', message = 'assignment access denied'; end if;
  if current_row.version <> expected_version then raise exception using errcode = '40001', message = 'assignment changed; reload and try again'; end if;
  if current_row.lifecycle <> 'published' then raise exception using errcode = '55000', message = 'only published assignments can change submission state'; end if;
  update public.assignments set closed_at = case when is_closed then now() else null end, version = version + 1
  where id = target_assignment_id returning * into changed;
  insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, after_data)
  values (actor, case when is_closed then 'assignment.closed' else 'assignment.reopened' end, 'assignment', changed.id, correlation_id, 'app',
    jsonb_build_object('closed_at', changed.closed_at, 'version', changed.version));
  return changed;
end;
$$;
revoke all on function public.set_assignment_closed(uuid, bigint, boolean, uuid) from public;
grant execute on function public.set_assignment_closed(uuid, bigint, boolean, uuid) to authenticated;

create or replace function public.submit_assignment(
  target_assignment_id uuid,
  target_file_id uuid,
  submission_note text default null,
  correlation_id uuid default null
) returns public.assignment_submissions
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); assignment public.assignments; owned_file public.files; already_submitted boolean; created public.assignment_submissions;
begin
  if not public.is_active_principal(actor) or not public.has_system_role('student', actor) then
    raise exception using errcode = '42501', message = 'active student required';
  end if;
  select * into assignment from public.assignments where id = target_assignment_id;
  if not found then raise exception using errcode = 'P0002', message = 'assignment not found'; end if;
  if assignment.lifecycle <> 'published' or (assignment.available_from is not null and now() < assignment.available_from)
     or assignment.closed_at is not null or (assignment.due_at is not null and now() > assignment.due_at) then
    raise exception using errcode = '55000', message = 'this assignment is not accepting submissions';
  end if;
  if not public.can_read_assignment(target_assignment_id) then raise exception using errcode = '42501', message = 'assignment access denied'; end if;
  select exists (select 1 from public.assignment_submissions s where s.assignment_id = target_assignment_id and s.student_id = actor) into already_submitted;
  if already_submitted and not assignment.allow_resubmission then raise exception using errcode = '55000', message = 'this assignment does not accept resubmission'; end if;
  select * into owned_file from public.files where id = target_file_id and state = 'ready' for update;
  if not found then raise exception using errcode = 'P0002', message = 'file not found or not yet ready'; end if;
  if owned_file.owner_id <> actor then raise exception using errcode = '42501', message = 'submission file must belong to the submitting student'; end if;
  if submission_note is not null and length(submission_note) > 2000 then raise exception using errcode = '22023', message = 'note must not exceed 2000 characters'; end if;
  insert into public.assignment_submissions (assignment_id, student_id, file_id, note)
  values (target_assignment_id, actor, target_file_id, submission_note) returning * into created;
  insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, after_data)
  values (actor, 'assignment.submitted', 'assignment_submission', created.id, correlation_id, 'app', jsonb_build_object('assignment_id', target_assignment_id, 'submitted_at', created.submitted_at));
  return created;
end;
$$;
