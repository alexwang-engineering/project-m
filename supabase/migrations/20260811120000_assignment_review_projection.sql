-- Bounded, authorization-safe class review projection. It returns only active
-- students currently belonging to an assignment cohort and their latest
-- immutable receipt/grade state.
create function public.assignment_review_roster(target_assignment_id uuid)
returns table (
  student_id uuid,
  student_email text,
  submission_id uuid,
  submitted_at timestamptz,
  submission_note text,
  file_id uuid,
  status text,
  grade numeric,
  feedback text,
  released_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_review_assignment(target_assignment_id) then
    raise exception using errcode = '42501', message = 'assignment access denied';
  end if;
  return query
  select distinct on (p.id)
    p.id, p.email, s.id, s.submitted_at, s.note, s.file_id,
    case when s.id is null then 'not_submitted'
         when g.released_at is not null then 'released'
         when g.submission_id is not null then 'marked'
         else 'submitted' end,
    g.grade, g.feedback, g.released_at
  from public.assignment_tags at
  join public.tag_memberships tm on tm.tag_id = at.tag_id
    and tm.valid_from <= now() and (tm.valid_until is null or tm.valid_until > now())
  join public.profiles p on p.id = tm.profile_id and p.state = 'active'
  left join lateral (
    select latest.* from public.assignment_submissions latest
    where latest.assignment_id = target_assignment_id and latest.student_id = p.id
    order by latest.submitted_at desc, latest.id desc limit 1
  ) s on true
  left join public.assignment_grades g on g.submission_id = s.id
  where at.assignment_id = target_assignment_id
    and public.has_system_role('student', p.id)
  order by p.id, s.submitted_at desc nulls last
  limit 500;
end;
$$;
revoke all on function public.assignment_review_roster(uuid) from public;
grant execute on function public.assignment_review_roster(uuid) to authenticated;

create function public.assignment_submission_timeline(target_submission_id uuid)
returns table (occurred_at timestamptz, action text, actor_email text)
language plpgsql stable security definer set search_path = '' as $$
declare assignment_id uuid;
begin
  select s.assignment_id into assignment_id from public.assignment_submissions s where s.id = target_submission_id;
  if not found then raise exception using errcode = 'P0002', message = 'submission not found'; end if;
  if not public.can_review_assignment(assignment_id) then
    raise exception using errcode = '42501', message = 'assignment access denied';
  end if;
  return query
  select s.submitted_at, 'assignment.submitted'::text, p.email
  from public.assignment_submissions s join public.profiles p on p.id = s.student_id
  where s.id = target_submission_id
  union all
  select ae.created_at, ae.action, p.email
  from public.audit_events ae left join public.profiles p on p.id = ae.actor_id
  where ae.target_type = 'assignment_submission' and ae.target_id = target_submission_id
    and ae.action <> 'assignment.submitted'
  order by 1;
end;
$$;
revoke all on function public.assignment_submission_timeline(uuid) from public;
grant execute on function public.assignment_submission_timeline(uuid) to authenticated;
