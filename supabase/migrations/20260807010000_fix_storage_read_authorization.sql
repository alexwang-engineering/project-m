-- Real bug found via live end-to-end verification: a student who can read
-- a published page (via page_files) - or a teacher who manages an
-- assignment (via assignment_submissions) - still could not actually
-- download the attached file. The signed-URL request returned a bare
-- "not found" from Storage, which looks like a missing object but is
-- really an RLS denial.
--
-- Root cause: learning_content_read_authorized queries public.files
-- directly inside its own USING clause. That subquery is itself subject to
-- files' own RLS (files_read_owner: owner_id = auth.uid() only), so for
-- any non-owner the FROM public.files scan returns zero rows before the OR
-- conditions ever get a chance to evaluate - no matter how many read paths
-- are added to them. This is the same RLS-composition pitfall documented
-- elsewhere in this project (a direct table/function reference inside a
-- policy runs under the querying role's own privileges, not any elevated
-- context) - the fix is the same: route the lookup through a SECURITY
-- DEFINER function so it runs under elevated privileges once, instead of
-- re-hitting files' RLS from inside another table's policy.
--
-- This also retroactively fixes the teacher-downloads-a-submission path
-- added by 20260805120000_teacher_submission_review.sql: that migration
-- extended get_file_download_target's application-level check with a
-- third path (manages via assignment_submissions) but never updated this
-- storage-level policy to match, so the same failure applied there too.
create or replace function public.can_read_file_object(target_bucket text, target_object_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.files f
    where f.bucket_id = target_bucket
      and f.object_name = target_object_name
      and f.state = 'ready'
      and (
        f.owner_id = auth.uid()
        or exists (
          select 1 from public.page_files pf
          where pf.file_id = f.id and public.can_read_page(pf.page_id)
        )
        or exists (
          select 1 from public.assignment_submissions s
          where s.file_id = f.id and public.can_manage_assignment(s.assignment_id)
        )
      )
  );
$$;
revoke all on function public.can_read_file_object(text, text) from public;
grant execute on function public.can_read_file_object(text, text) to authenticated;

drop policy if exists learning_content_read_authorized on storage.objects;
create policy learning_content_read_authorized
on storage.objects for select to authenticated
using (
  bucket_id = 'learning-content'
  and public.can_read_file_object(bucket_id, name)
);
