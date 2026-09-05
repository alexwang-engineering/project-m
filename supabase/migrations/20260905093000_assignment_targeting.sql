alter table public.assignments add column audience_mode text not null default 'tags'
  check (audience_mode in ('tags','selected_students'));
create table public.assignment_students (
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete restrict,
  added_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (assignment_id, student_id)
);
alter table public.assignment_students enable row level security;
create policy assignment_students_read on public.assignment_students for select to authenticated
using (student_id=auth.uid() or public.can_manage_assignment(assignment_id));
grant select on public.assignment_students to authenticated;

create function public.list_assignable_students(requested_tag_ids uuid[])
returns table(student_id uuid, student_email text, tag_ids uuid[])
language plpgsql stable security definer set search_path='' as $$
begin
  perform public.assert_can_assign_tags(requested_tag_ids,auth.uid());
  return query select p.id,p.email,array_agg(distinct tm.tag_id order by tm.tag_id)
  from public.profiles p join public.tag_memberships tm on tm.profile_id=p.id
  where tm.tag_id=any(requested_tag_ids) and p.state='active'
    and tm.valid_from<=now() and (tm.valid_until is null or tm.valid_until>now())
    and public.has_system_role('student',p.id)
  group by p.id,p.email order by p.email limit 500;
end; $$;
revoke all on function public.list_assignable_students(uuid[]) from public;
grant execute on function public.list_assignable_students(uuid[]) to authenticated;

create function public.create_assignment_with_audience(
  assignment_title text,instructions_page uuid,assignment_due_at timestamptz,
  resubmission_allowed boolean,audience_tag_ids uuid[],assignment_available_from timestamptz,
  selected_student_ids uuid[],correlation_id uuid default null
) returns public.assignments language plpgsql security definer set search_path='' as $$
declare created public.assignments; student_id uuid;
begin
  if selected_student_ids is not null and (cardinality(selected_student_ids)<1 or cardinality(selected_student_ids)>500
    or (select count(distinct value) from unnest(selected_student_ids)value)<>cardinality(selected_student_ids)) then
    raise exception using errcode='22023',message='selected pupils must be a unique non-empty list';
  end if;
  if selected_student_ids is not null and exists(
    select 1 from unnest(selected_student_ids)s(id) where not exists(
      select 1 from public.profiles p join public.tag_memberships tm on tm.profile_id=p.id
      where p.id=s.id and p.state='active' and public.has_system_role('student',p.id)
        and tm.tag_id=any(audience_tag_ids) and tm.valid_from<=now() and (tm.valid_until is null or tm.valid_until>now())
    )) then raise exception using errcode='42501',message='selected pupil is outside the assignment audience'; end if;
  created:=public.create_assignment(assignment_title,instructions_page,assignment_due_at,resubmission_allowed,
    audience_tag_ids,correlation_id,assignment_available_from);
  if selected_student_ids is not null then
    update public.assignments set audience_mode='selected_students' where id=created.id returning * into created;
    foreach student_id in array selected_student_ids loop
      insert into public.assignment_students values(created.id,student_id,auth.uid(),now());
    end loop;
  end if;
  return created;
end; $$;
revoke all on function public.create_assignment_with_audience(text,uuid,timestamptz,boolean,uuid[],timestamptz,uuid[],uuid) from public;
grant execute on function public.create_assignment_with_audience(text,uuid,timestamptz,boolean,uuid[],timestamptz,uuid[],uuid) to authenticated;

create function public.pupil_can_read_assignment(target_assignment uuid,target_pupil uuid)
returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.assignments a where a.id=target_assignment and a.lifecycle='published'
 and public.is_active_principal(target_pupil) and public.has_system_role('student',target_pupil)
 and (a.available_from is null or a.available_from<=now())
 and not exists(select 1 from public.assignment_exceptions x where x.assignment_id=a.id and x.student_id=target_pupil and x.withdrawn_at is not null)
 and exists(select 1 from public.assignment_tags at where at.assignment_id=a.id and public.has_tag_membership(at.tag_id,array['member','teacher','manager']::public.membership_role[],target_pupil))
 and (a.audience_mode='tags' or exists(select 1 from public.assignment_students s where s.assignment_id=a.id and s.student_id=target_pupil)))
$$;
revoke all on function public.pupil_can_read_assignment(uuid,uuid) from public;

create or replace function public.can_read_assignment(target_assignment uuid)
returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.assignments a where a.id=target_assignment and public.is_active_principal(auth.uid()) and (
 public.has_system_role('institution_admin',auth.uid()) or (public.has_system_role('teacher',auth.uid()) and public.can_review_assignment(a.id)) or
 public.pupil_can_read_assignment(a.id,auth.uid())))
$$;

drop function public.assignment_review_roster(uuid);
create function public.assignment_review_roster(target_assignment_id uuid)
returns table (student_id uuid,student_email text,submission_id uuid,submitted_at timestamptz,submission_note text,file_id uuid,status text,grade numeric,feedback text,released_at timestamptz,effective_due_at timestamptz,withdrawn_at timestamptz)
language plpgsql stable security definer set search_path='' as $$ begin
 if not public.can_review_assignment(target_assignment_id) then raise exception using errcode='42501',message='assignment access denied'; end if;
 return query select distinct on(p.id) p.id,p.email,s.id,s.submitted_at,s.note,s.file_id,
  case when x.withdrawn_at is not null then 'withdrawn' when s.id is null then 'not_submitted' when g.released_at is not null then 'released' when g.submission_id is not null then 'marked' else 'submitted' end,
  g.grade,g.feedback,g.released_at,coalesce(x.extended_due_at,a.due_at),x.withdrawn_at
 from public.assignments a join public.assignment_tags at on at.assignment_id=a.id
 join public.tag_memberships tm on tm.tag_id=at.tag_id and tm.valid_from<=now() and(tm.valid_until is null or tm.valid_until>now())
 join public.profiles p on p.id=tm.profile_id and p.state='active'
 left join public.assignment_exceptions x on x.assignment_id=a.id and x.student_id=p.id
 left join lateral(select z.* from public.assignment_submissions z where z.assignment_id=a.id and z.student_id=p.id order by z.submitted_at desc,z.id desc limit 1)s on true
 left join public.assignment_grades g on g.submission_id=s.id
 where a.id=target_assignment_id and public.has_system_role('student',p.id)
  and(a.audience_mode='tags' or exists(select 1 from public.assignment_students ast where ast.assignment_id=a.id and ast.student_id=p.id))
 order by p.id,s.submitted_at desc nulls last limit 500;
end $$;
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
  where coalesce(x.extended_due_at,a.due_at) is not null and public.pupil_can_read_assignment(a.id,target_pupil_id)
  union all select q.id,'quiz'::text,q.title,q.due_at,null::timestamptz,false from public.quizzes q
  where q.due_at is not null and q.archived_at is null and exists(select 1 from public.quiz_tags qt where qt.quiz_id=q.id and public.has_tag_membership(qt.tag_id,array['member','teacher','manager']::public.membership_role[],target_pupil_id))
  union all select e.id,'event'::text,e.title,e.starts_at,e.ends_at,e.is_broadcast from public.calendar_events e
  where e.archived_at is null and (e.is_broadcast or exists(select 1 from public.calendar_event_tags cet where cet.event_id=e.id and public.has_tag_membership(cet.tag_id,array['member','teacher','manager']::public.membership_role[],target_pupil_id)))
  order by 4;
end;
$$;
