-- Assignment instructions must be a published canonical page readable by
-- every target cohort. A teacher being able to read a page is insufficient:
-- without audience coverage, pupils could receive an assignment whose
-- instructions are inaccessible to some or all of them.
create or replace function public.create_assignment(
  assignment_title text,
  instructions_page uuid,
  assignment_due_at timestamptz,
  resubmission_allowed boolean,
  audience_tag_ids uuid[],
  correlation_id uuid default null
) returns public.assignments
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); created public.assignments; instruction public.pages; tag_id uuid;
begin
  if nullif(btrim(assignment_title), '') is null or length(assignment_title) > 240 then
    raise exception using errcode = '22023', message = 'assignment title is required and must not exceed 240 characters';
  end if;
  perform public.assert_can_assign_tags(audience_tag_ids, actor);

  if instructions_page is not null then
    select * into instruction from public.pages where id = instructions_page;
    if not found or instruction.lifecycle <> 'published' or not public.can_read_page(instructions_page) then
      raise exception using errcode = '42501', message = 'instructions page must be published and cover every audience tag';
    end if;
    if not instruction.is_public and exists (
      select 1 from unnest(audience_tag_ids) requested(tag_id)
      where not exists (
        select 1 from public.page_tags pt
        where pt.page_id = instructions_page and pt.tag_id = requested.tag_id
      )
    ) then
      raise exception using errcode = '42501', message = 'instructions page must be published and cover every audience tag';
    end if;
  end if;

  insert into public.assignments (title, instructions_page_id, due_at, allow_resubmission, created_by)
  values (btrim(assignment_title), instructions_page, assignment_due_at, coalesce(resubmission_allowed, false), actor)
  returning * into created;

  foreach tag_id in array audience_tag_ids loop
    insert into public.assignment_tags (assignment_id, tag_id, added_by) values (created.id, tag_id, actor);
  end loop;
  insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, after_data)
  values (actor, 'assignment.created', 'assignment', created.id, correlation_id, 'app',
    jsonb_build_object('due_at', created.due_at, 'instructions_page_id', created.instructions_page_id, 'tags', audience_tag_ids));
  return created;
end;
$$;

revoke all on function public.create_assignment(text, uuid, timestamptz, boolean, uuid[], uuid) from public;
grant execute on function public.create_assignment(text, uuid, timestamptz, boolean, uuid[], uuid) to authenticated;
