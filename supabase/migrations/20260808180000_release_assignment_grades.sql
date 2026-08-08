-- Draft marks and released results have different audiences. Keep marks in a
-- separate RLS-protected row so students cannot bypass the application and
-- select unreleased values from their submission record.
create table public.assignment_grades (
  submission_id uuid primary key references public.assignment_submissions(id) on delete cascade,
  grade numeric not null check (grade between 0 and 100),
  feedback text check (feedback is null or length(feedback) <= 2000),
  graded_by uuid not null references public.profiles(id) on delete restrict,
  graded_at timestamptz not null default now(),
  released_by uuid references public.profiles(id) on delete restrict,
  released_at timestamptz,
  constraint assignment_grades_release_pair check ((released_by is null) = (released_at is null))
);

alter table public.assignment_grades enable row level security;
create policy assignment_grades_read on public.assignment_grades for select to authenticated
using (
  exists (
    select 1 from public.assignment_submissions s
    where s.id = assignment_grades.submission_id
      and (
        public.can_manage_assignment(s.assignment_id)
        or (s.student_id = auth.uid() and assignment_grades.released_at is not null)
      )
  )
);
grant select on public.assignment_grades to authenticated;

-- Preserve the old behavior for results that were already disclosed before
-- this release gate existed: migrate them as released, then erase the legacy
-- columns that students can directly select.
insert into public.assignment_grades (
  submission_id, grade, feedback, graded_by, graded_at, released_by, released_at
)
select id, grade, grade_feedback, graded_by, graded_at, graded_by, graded_at
from public.assignment_submissions
where grade is not null and graded_by is not null and graded_at is not null;

update public.assignment_submissions
set grade = null, grade_feedback = null, graded_by = null, graded_at = null
where grade is not null or grade_feedback is not null or graded_by is not null or graded_at is not null;

alter table public.assignment_submissions
  add constraint assignment_submissions_legacy_grade_empty
  check (grade is null and grade_feedback is null and graded_by is null and graded_at is null);

create or replace function public.grade_assignment_submission(
  target_submission_id uuid,
  grade_value numeric,
  feedback_text text default null,
  correlation_id uuid default null
) returns public.assignment_submissions
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  submission public.assignment_submissions;
  previous public.assignment_grades;
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

  select * into previous from public.assignment_grades where submission_id = target_submission_id;
  insert into public.assignment_grades (submission_id, grade, feedback, graded_by, graded_at)
  values (target_submission_id, grade_value, feedback_text, actor, now())
  on conflict (submission_id) do update set
    grade = excluded.grade,
    feedback = excluded.feedback,
    graded_by = excluded.graded_by,
    graded_at = excluded.graded_at,
    released_by = null,
    released_at = null;

  insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, before_data, after_data)
  values (actor, 'assignment_grade.saved', 'assignment_submission', target_submission_id, correlation_id, 'app',
    case when previous.submission_id is null then null else jsonb_build_object('grade', previous.grade, 'released_at', previous.released_at) end,
    jsonb_build_object('grade', grade_value, 'released_at', null));
  return submission;
end;
$$;
revoke all on function public.grade_assignment_submission(uuid, numeric, text, uuid) from public;
grant execute on function public.grade_assignment_submission(uuid, numeric, text, uuid) to authenticated;

create or replace function public.release_assignment_grade(
  target_submission_id uuid,
  correlation_id uuid default null
) returns public.assignment_grades
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  submission public.assignment_submissions;
  released public.assignment_grades;
begin
  select * into submission from public.assignment_submissions where id = target_submission_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'submission not found'; end if;
  if not public.can_manage_assignment(submission.assignment_id) then
    raise exception using errcode = '42501', message = 'you do not manage this assignment';
  end if;

  update public.assignment_grades
  set released_by = actor, released_at = now()
  where submission_id = target_submission_id and released_at is null
  returning * into released;
  if not found then
    raise exception using errcode = '55000', message = 'a saved unreleased grade is required';
  end if;

  insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, after_data)
  values (actor, 'assignment_grade.released', 'assignment_submission', target_submission_id, correlation_id, 'app',
    jsonb_build_object('grade', released.grade, 'released_at', released.released_at));
  return released;
end;
$$;
revoke all on function public.release_assignment_grade(uuid, uuid) from public;
grant execute on function public.release_assignment_grade(uuid, uuid) to authenticated;

create or replace function public.guardian_view_grades(target_pupil_id uuid)
returns table (
  submission_id uuid,
  assignment_title text,
  grade numeric,
  grade_feedback text,
  graded_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_guardian_of(target_pupil_id);
  return query
    select g.submission_id, a.title, g.grade, g.feedback, g.graded_at
    from public.assignment_grades g
    join public.assignment_submissions s on s.id = g.submission_id
    join public.assignments a on a.id = s.assignment_id
    where s.student_id = target_pupil_id and g.released_at is not null
    order by g.released_at desc;
end;
$$;
revoke all on function public.guardian_view_grades(uuid) from public;
grant execute on function public.guardian_view_grades(uuid) to authenticated;
