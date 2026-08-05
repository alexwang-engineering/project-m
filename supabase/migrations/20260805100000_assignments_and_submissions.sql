-- Minimal assignment/submission slice per ADR-008's 2026-08-05 addendum:
-- "accept a submission with a timestamp", not a full assessment domain.
-- Gradebook/rubric/moderation/release are deliberately out of scope here and
-- layered on later as separate, additive work.

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  instructions_page_id uuid references public.pages(id) on delete set null,
  due_at timestamptz,
  allow_resubmission boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint assignments_title_not_blank check (btrim(title) <> '')
);
create index assignments_due_idx on public.assignments (due_at) where archived_at is null;

create table public.assignment_tags (
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete restrict,
  added_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (assignment_id, tag_id)
);
create index assignment_tags_tag_idx on public.assignment_tags (tag_id, assignment_id);

-- Submissions are append-only, like page_revisions and audit_events: a
-- submission is an immutable event, not a row a student can edit in place.
-- When allow_resubmission is true, the latest row per (assignment, student)
-- is the authoritative one; earlier rows remain as an honest record.
create table public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete restrict,
  student_id uuid not null references public.profiles(id) on delete restrict,
  file_id uuid not null references public.files(id) on delete restrict,
  note text,
  submitted_at timestamptz not null default now(),
  constraint assignment_submissions_note_bounded check (note is null or length(note) <= 2000)
);
create index assignment_submissions_lookup_idx
  on public.assignment_submissions (assignment_id, student_id, submitted_at desc);

create or replace function public.can_read_assignment(target_assignment uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.assignments a where a.id = target_assignment and a.archived_at is null and (
      public.is_active_principal(auth.uid()) and (
        a.created_by = auth.uid()
        or public.has_system_role('institution_admin', auth.uid())
        or exists (
          select 1 from public.assignment_tags at
          where at.assignment_id = a.id
            and public.has_tag_membership(at.tag_id, array['member','teacher','manager']::public.membership_role[], auth.uid())
        )
      )
    )
  );
$$;
revoke all on function public.can_read_assignment(uuid) from public;
grant execute on function public.can_read_assignment(uuid) to authenticated;

-- Deliberately narrower than can_read_assignment: a tag 'member' (an
-- ordinary student in the audience) can read the assignment itself but must
-- NOT see other students' submissions. Only the creator, an admin, or a
-- teacher/manager-tier tag holder can manage/see submissions in bulk.
create or replace function public.can_manage_assignment(target_assignment uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_active_principal(auth.uid()) and exists (
    select 1 from public.assignments a where a.id = target_assignment and a.archived_at is null and (
      a.created_by = auth.uid()
      or public.has_system_role('institution_admin', auth.uid())
      or exists (
        select 1 from public.assignment_tags at
        where at.assignment_id = a.id
          and public.has_tag_membership(at.tag_id, array['teacher','manager']::public.membership_role[], auth.uid())
      )
    )
  );
$$;
revoke all on function public.can_manage_assignment(uuid) from public;
grant execute on function public.can_manage_assignment(uuid) to authenticated;

create or replace function public.create_assignment(
  assignment_title text,
  instructions_page uuid,
  assignment_due_at timestamptz,
  resubmission_allowed boolean,
  audience_tag_ids uuid[],
  correlation_id uuid default null
) returns public.assignments
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); created public.assignments; tag_id uuid;
begin
  if nullif(btrim(assignment_title), '') is null or length(assignment_title) > 240 then
    raise exception using errcode = '22023', message = 'assignment title is required and must not exceed 240 characters';
  end if;
  perform public.assert_can_assign_tags(audience_tag_ids, actor);
  if instructions_page is not null and not public.can_read_page(instructions_page) then
    raise exception using errcode = '42501', message = 'instructions page must be readable by the creator';
  end if;

  insert into public.assignments (title, instructions_page_id, due_at, allow_resubmission, created_by)
  values (btrim(assignment_title), instructions_page, assignment_due_at, coalesce(resubmission_allowed, false), actor)
  returning * into created;

  foreach tag_id in array audience_tag_ids loop
    insert into public.assignment_tags (assignment_id, tag_id, added_by) values (created.id, tag_id, actor);
  end loop;
  insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, after_data)
  values (actor, 'assignment.created', 'assignment', created.id, correlation_id, 'app',
    jsonb_build_object('due_at', created.due_at, 'tags', audience_tag_ids));
  return created;
end;
$$;
revoke all on function public.create_assignment(text, uuid, timestamptz, boolean, uuid[], uuid) from public;
grant execute on function public.create_assignment(text, uuid, timestamptz, boolean, uuid[], uuid) to authenticated;

-- The one operation the product owner actually asked for: accept a
-- submission and record when it happened. No grading, no rubric, no
-- moderation - just an authorized, timestamped, immutable receipt.
create or replace function public.submit_assignment(
  target_assignment_id uuid,
  target_file_id uuid,
  submission_note text default null,
  correlation_id uuid default null
) returns public.assignment_submissions
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); assignment public.assignments; owned_file public.files; already_submitted boolean; created public.assignment_submissions;
begin
  if not public.is_active_principal(actor) then
    raise exception using errcode = '42501', message = 'active principal required';
  end if;
  select * into assignment from public.assignments where id = target_assignment_id and archived_at is null;
  if not found then raise exception using errcode = 'P0002', message = 'assignment not found'; end if;
  if not public.can_read_assignment(target_assignment_id) then
    raise exception using errcode = '42501', message = 'assignment is not in your audience';
  end if;
  if assignment.due_at is not null and now() > assignment.due_at then
    raise exception using errcode = '55000', message = 'the submission deadline has passed';
  end if;

  select exists (
    select 1 from public.assignment_submissions s
    where s.assignment_id = target_assignment_id and s.student_id = actor
  ) into already_submitted;
  if already_submitted and not assignment.allow_resubmission then
    raise exception using errcode = '55000', message = 'this assignment does not accept resubmission';
  end if;

  select * into owned_file from public.files where id = target_file_id and state = 'ready' for update;
  if not found then raise exception using errcode = 'P0002', message = 'file not found or not yet ready'; end if;
  if owned_file.owner_id <> actor then
    raise exception using errcode = '42501', message = 'submission file must belong to the submitting student';
  end if;
  if submission_note is not null and length(submission_note) > 2000 then
    raise exception using errcode = '22023', message = 'note must not exceed 2000 characters';
  end if;

  insert into public.assignment_submissions (assignment_id, student_id, file_id, note)
  values (target_assignment_id, actor, target_file_id, submission_note)
  returning * into created;

  insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, after_data)
  values (actor, 'assignment.submitted', 'assignment_submission', created.id, correlation_id, 'app',
    jsonb_build_object('assignment_id', target_assignment_id, 'submitted_at', created.submitted_at));
  return created;
end;
$$;
revoke all on function public.submit_assignment(uuid, uuid, text, uuid) from public;
grant execute on function public.submit_assignment(uuid, uuid, text, uuid) to authenticated;

alter table public.assignments enable row level security;
alter table public.assignment_tags enable row level security;
alter table public.assignment_submissions enable row level security;

create policy assignments_read on public.assignments for select to authenticated
using (public.can_read_assignment(id));
create policy assignment_tags_read on public.assignment_tags for select to authenticated
using (public.can_read_assignment(assignment_id));
-- A student reads their own submissions; a teacher/manager-tier tag holder
-- or admin can read every submission against an assignment they manage.
-- Deliberately does NOT use can_read_assignment here - that also admits
-- ordinary 'member' tag holders (classmates), who must never see each
-- other's submitted work. Calling can_manage_assignment (a granted
-- SECURITY DEFINER function) rather than has_tag_membership/has_system_role
-- directly also avoids a real bug: RLS policy expressions run under the
-- querying role's own privileges, not any function-owner elevation, so a
-- bare internal helper call here would fail with "permission denied" the
-- moment Postgres plans the policy - only the wrapper functions were ever
-- granted EXECUTE to authenticated.
create policy assignment_submissions_read on public.assignment_submissions for select to authenticated
using (
  student_id = auth.uid()
  or public.can_manage_assignment(assignment_id)
);

-- Learned from the earlier grant bug found by actually running the tests:
-- RLS policies are inert without the matching base table GRANT.
grant select on public.assignments to authenticated;
grant select on public.assignment_tags to authenticated;
grant select on public.assignment_submissions to authenticated;
