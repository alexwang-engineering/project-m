-- Teacher-facing submission review needs two things neither existing policy
-- covers: reading the submitting student's identity, and downloading the
-- submitted file. Both are scoped as narrowly as the thing they enable -
-- a teacher gains no access to a student's profile or files except through
-- a submission against an assignment that teacher actually manages.

-- A teacher/manager-tier tag holder (or admin, or the assignment creator)
-- can read the profile of a student who has submitted to their assignment.
-- Until a student submits, their profile stays invisible via this path -
-- this does not turn into a general class-roster lookup.
create policy profiles_read_submitters on public.profiles for select to authenticated
using (
  exists (
    select 1 from public.assignment_submissions s
    where s.student_id = profiles.id
      and public.can_manage_assignment(s.assignment_id)
  )
);

-- Extends the existing generic download-target resolver (already used by
-- page-attached files) with a third path: a submission's file is
-- downloadable by the student who submitted it, or by whoever manages the
-- assignment it was submitted against.
create or replace function public.get_file_download_target(target_file_id uuid)
returns table (
  bucket_id text,
  object_name text,
  original_name text,
  media_type text,
  size_bytes bigint
)
language sql stable security definer set search_path = '' as $$
  select f.bucket_id, f.object_name, f.original_name, f.media_type, f.size_bytes
  from public.files f
  where f.id = target_file_id
    and f.state = 'ready'
    and public.current_principal_is_active()
    and (
      f.owner_id = auth.uid()
      or exists (
        select 1
        from public.page_files pf
        where pf.file_id = f.id
          and public.can_read_page(pf.page_id)
      )
      or exists (
        select 1
        from public.assignment_submissions s
        where s.file_id = f.id
          and public.can_manage_assignment(s.assignment_id)
      )
    )
  limit 1
$$;
