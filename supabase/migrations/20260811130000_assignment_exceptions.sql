create table public.assignment_exceptions (
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id),
  extended_due_at timestamptz,
  withdrawn_at timestamptz,
  reason text not null check (length(btrim(reason)) between 1 and 500),
  changed_by uuid not null references public.profiles(id),
  changed_at timestamptz not null default now(),
  primary key (assignment_id, student_id),
  check (extended_due_at is not null or withdrawn_at is not null)
);
alter table public.assignment_exceptions enable row level security;
grant select (assignment_id,student_id,extended_due_at,withdrawn_at) on public.assignment_exceptions to authenticated;
create policy assignment_exceptions_read on public.assignment_exceptions for select to authenticated
using (student_id = auth.uid() or public.can_review_assignment(assignment_id));

create or replace function public.can_read_assignment(target_assignment uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.assignments a
    where a.id = target_assignment and public.is_active_principal(auth.uid()) and (
      public.has_system_role('institution_admin', auth.uid())
      or (public.has_system_role('teacher', auth.uid()) and public.can_review_assignment(a.id))
      or (
        a.lifecycle = 'published' and (a.available_from is null or a.available_from <= now())
        and not exists (
          select 1 from public.assignment_exceptions exception
          where exception.assignment_id = a.id and exception.student_id = auth.uid() and exception.withdrawn_at is not null
        )
        and exists (
          select 1 from public.assignment_tags at where at.assignment_id = a.id
            and public.has_tag_membership(at.tag_id, array['member','teacher','manager']::public.membership_role[], auth.uid())
        )
      )
    )
  );
$$;

create function public.set_assignment_exception(
  target_assignment_id uuid,
  target_student_id uuid,
  new_extended_due_at timestamptz,
  withdraw_student boolean,
  exception_reason text,
  correlation_id uuid default null
) returns public.assignment_exceptions
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); assignment public.assignments; changed public.assignment_exceptions;
begin
  select * into assignment from public.assignments where id = target_assignment_id;
  if not found then raise exception using errcode = 'P0002', message = 'assignment not found'; end if;
  if not public.can_manage_assignment(target_assignment_id) then raise exception using errcode = '42501', message = 'assignment access denied'; end if;
  if nullif(btrim(exception_reason), '') is null or length(exception_reason) > 500 then
    raise exception using errcode = '22023', message = 'a reason of at most 500 characters is required';
  end if;
  if not exists (
    select 1 from public.assignment_tags at join public.tag_memberships tm on tm.tag_id = at.tag_id
    where at.assignment_id = target_assignment_id and tm.profile_id = target_student_id
      and tm.valid_from <= now() and (tm.valid_until is null or tm.valid_until > now())
      and public.has_system_role('student', target_student_id)
  ) then raise exception using errcode = '42501', message = 'student is not in the assignment audience'; end if;
  if not coalesce(withdraw_student, false) and new_extended_due_at is null then
    delete from public.assignment_exceptions where assignment_id = target_assignment_id and student_id = target_student_id;
    insert into public.audit_events (actor_id,action,target_type,target_id,correlation_id,source,after_data)
    values (actor,'assignment_exception.cleared','assignment',target_assignment_id,correlation_id,'app',jsonb_build_object('student_id',target_student_id,'reason',btrim(exception_reason)));
    return null;
  end if;
  if new_extended_due_at is not null and assignment.due_at is not null and new_extended_due_at <= assignment.due_at then
    raise exception using errcode = '22023', message = 'an extension must be after the class due date';
  end if;
  insert into public.assignment_exceptions (assignment_id,student_id,extended_due_at,withdrawn_at,reason,changed_by)
  values (target_assignment_id,target_student_id,new_extended_due_at,case when withdraw_student then now() else null end,btrim(exception_reason),actor)
  on conflict (assignment_id,student_id) do update set extended_due_at=excluded.extended_due_at,withdrawn_at=excluded.withdrawn_at,
    reason=excluded.reason,changed_by=excluded.changed_by,changed_at=now()
  returning * into changed;
  insert into public.audit_events (actor_id,action,target_type,target_id,correlation_id,source,after_data)
  values (actor,case when withdraw_student then 'assignment_exception.withdrawn' else 'assignment_exception.extended' end,
    'assignment',target_assignment_id,correlation_id,'app',jsonb_build_object('student_id',target_student_id,'extended_due_at',new_extended_due_at,'reason',btrim(exception_reason)));
  return changed;
end;
$$;
revoke all on function public.set_assignment_exception(uuid,uuid,timestamptz,boolean,text,uuid) from public;
grant execute on function public.set_assignment_exception(uuid,uuid,timestamptz,boolean,text,uuid) to authenticated;

-- Re-apply submission acceptance with the pupil's effective deadline.
create or replace function public.submit_assignment(target_assignment_id uuid,target_file_id uuid,submission_note text default null,correlation_id uuid default null)
returns public.assignment_submissions language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); assignment public.assignments; owned_file public.files; exception public.assignment_exceptions; already_submitted boolean; created public.assignment_submissions; effective_due timestamptz;
begin
  if not public.is_active_principal(actor) or not public.has_system_role('student',actor) then raise exception using errcode='42501',message='active student required'; end if;
  select * into assignment from public.assignments where id=target_assignment_id;
  if not found then raise exception using errcode='P0002',message='assignment not found'; end if;
  select * into exception from public.assignment_exceptions where assignment_id=target_assignment_id and student_id=actor;
  effective_due := coalesce(exception.extended_due_at,assignment.due_at);
  if assignment.lifecycle <> 'published' or (assignment.available_from is not null and now()<assignment.available_from)
    or assignment.closed_at is not null or exception.withdrawn_at is not null or (effective_due is not null and now()>effective_due)
    then raise exception using errcode='55000',message='this assignment is not accepting submissions'; end if;
  if not public.can_read_assignment(target_assignment_id) then raise exception using errcode='42501',message='assignment access denied'; end if;
  select exists(select 1 from public.assignment_submissions s where s.assignment_id=target_assignment_id and s.student_id=actor) into already_submitted;
  if already_submitted and not assignment.allow_resubmission then raise exception using errcode='55000',message='this assignment does not accept resubmission'; end if;
  select * into owned_file from public.files where id=target_file_id and state='ready' for update;
  if not found then raise exception using errcode='P0002',message='file not found or not yet ready'; end if;
  if owned_file.owner_id<>actor then raise exception using errcode='42501',message='submission file must belong to the submitting student'; end if;
  if submission_note is not null and length(submission_note)>2000 then raise exception using errcode='22023',message='note must not exceed 2000 characters'; end if;
  insert into public.assignment_submissions(assignment_id,student_id,file_id,note) values(target_assignment_id,actor,target_file_id,submission_note) returning * into created;
  insert into public.audit_events(actor_id,action,target_type,target_id,correlation_id,source,after_data) values(actor,'assignment.submitted','assignment_submission',created.id,correlation_id,'app',jsonb_build_object('assignment_id',target_assignment_id,'submitted_at',created.submitted_at,'effective_due_at',effective_due));
  return created;
end;
$$;

drop function public.assignment_review_roster(uuid);
create function public.assignment_review_roster(target_assignment_id uuid)
returns table (student_id uuid,student_email text,submission_id uuid,submitted_at timestamptz,submission_note text,file_id uuid,status text,grade numeric,feedback text,released_at timestamptz,effective_due_at timestamptz,withdrawn_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.can_review_assignment(target_assignment_id) then raise exception using errcode='42501',message='assignment access denied'; end if;
  return query select distinct on (p.id) p.id,p.email,s.id,s.submitted_at,s.note,s.file_id,
    case when x.withdrawn_at is not null then 'withdrawn' when s.id is null then 'not_submitted' when g.released_at is not null then 'released' when g.submission_id is not null then 'marked' else 'submitted' end,
    g.grade,g.feedback,g.released_at,coalesce(x.extended_due_at,a.due_at),x.withdrawn_at
  from public.assignments a join public.assignment_tags at on at.assignment_id=a.id
  join public.tag_memberships tm on tm.tag_id=at.tag_id and tm.valid_from<=now() and (tm.valid_until is null or tm.valid_until>now())
  join public.profiles p on p.id=tm.profile_id and p.state='active'
  left join public.assignment_exceptions x on x.assignment_id=a.id and x.student_id=p.id
  left join lateral(select latest.* from public.assignment_submissions latest where latest.assignment_id=a.id and latest.student_id=p.id order by latest.submitted_at desc,latest.id desc limit 1)s on true
  left join public.assignment_grades g on g.submission_id=s.id
  where a.id=target_assignment_id and public.has_system_role('student',p.id)
  order by p.id,s.submitted_at desc nulls last limit 500;
end;
$$;
revoke all on function public.assignment_review_roster(uuid) from public;
grant execute on function public.assignment_review_roster(uuid) to authenticated;

create or replace function public.guardian_view_calendar(target_pupil_id uuid)
returns table(item_id uuid,item_kind text,title text,occurs_at timestamptz,ends_at timestamptz,is_broadcast boolean)
language plpgsql stable security definer set search_path='' as $$
begin
  perform public.assert_guardian_of(target_pupil_id);
  return query
  select a.id,'assignment'::text,a.title,coalesce(x.extended_due_at,a.due_at),null::timestamptz,false
  from public.assignments a left join public.assignment_exceptions x on x.assignment_id=a.id and x.student_id=target_pupil_id
  where coalesce(x.extended_due_at,a.due_at) is not null and a.lifecycle='published' and x.withdrawn_at is null
    and exists(select 1 from public.assignment_tags at where at.assignment_id=a.id and public.has_tag_membership(at.tag_id,array['member','teacher','manager']::public.membership_role[],target_pupil_id))
  union all select q.id,'quiz'::text,q.title,q.due_at,null::timestamptz,false from public.quizzes q
  where q.due_at is not null and q.archived_at is null and exists(select 1 from public.quiz_tags qt where qt.quiz_id=q.id and public.has_tag_membership(qt.tag_id,array['member','teacher','manager']::public.membership_role[],target_pupil_id))
  union all select e.id,'event'::text,e.title,e.starts_at,e.ends_at,e.is_broadcast from public.calendar_events e
  where e.archived_at is null and (e.is_broadcast or exists(select 1 from public.calendar_event_tags cet where cet.event_id=e.id and public.has_tag_membership(cet.tag_id,array['member','teacher','manager']::public.membership_role[],target_pupil_id)))
  order by 4;
end;
$$;
