begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- Fixtures: a teacher who owns two files (one attached to a published page,
-- one submitted against an assignment), a student who can read the page
-- but does not manage anything, and an unrelated student with no relation
-- to either file at all.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-000000000301', 'teacher-c@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000302', 'student-storage-in@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000303', 'student-storage-out@merchanttaylors.com', 'authenticated', 'authenticated');

insert into public.profiles (id, email, kind, state) values
  ('00000000-0000-0000-0000-000000000301', 'teacher-c@merchanttaylors.com', 'institutional', 'active'),
  ('00000000-0000-0000-0000-000000000302', 'student-storage-in@merchanttaylors.com', 'institutional', 'active'),
  ('00000000-0000-0000-0000-000000000303', 'student-storage-out@merchanttaylors.com', 'institutional', 'active');

insert into public.role_assignments (profile_id, role, reason) values
  ('00000000-0000-0000-0000-000000000301', 'teacher', 'test fixture'),
  ('00000000-0000-0000-0000-000000000302', 'student', 'test fixture'),
  ('00000000-0000-0000-0000-000000000303', 'student', 'test fixture');

insert into public.tags (id, tag_name, display_name, created_by) values
  ('20000000-0000-0000-0000-000000000003', 'Y11GE1', 'Year 11 Geography Set 1', '00000000-0000-0000-0000-000000000301');

insert into public.tag_memberships (profile_id, tag_id, membership_role, source) values
  ('00000000-0000-0000-0000-000000000301', '20000000-0000-0000-0000-000000000003', 'teacher', 'test'),
  ('00000000-0000-0000-0000-000000000302', '20000000-0000-0000-0000-000000000003', 'member', 'test');

-- A page-attached file: published but audience-only (not is_public), so
-- only a tag member can read it - an is_public page would be readable by
-- literally anyone, which would defeat the "unrelated student" assertion
-- below.
insert into public.pages (id, slug, canonical_url, title, content_json, author_id, lifecycle, is_public, published_at) values
  ('40000000-0000-0000-0000-000000000001', 'storage-test-page', '/storage-test-page', 'Storage test page',
   '{"schemaVersion":1,"blocks":[]}'::jsonb, '00000000-0000-0000-0000-000000000301', 'published', false, now());
insert into public.page_tags (page_id, tag_id, added_by) values
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000301');
insert into public.files (id, owner_id, bucket_id, object_name, original_name, media_type, size_bytes, sha256, state) values
  ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000301', 'learning-content',
   '00000000-0000-0000-0000-000000000301/40000000-0000-0000-0000-000000000002.png', 'diagram.png', 'image/png', 10, repeat('a', 64), 'ready');
insert into public.page_files (page_id, file_id, added_by) values
  ('40000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000301');
insert into storage.objects (bucket_id, name) values
  ('learning-content', '00000000-0000-0000-0000-000000000301/40000000-0000-0000-0000-000000000002.png');

-- An assignment-submission file: not attached to any page, only reachable
-- through the assignment-management path.
insert into public.assignments (id, title, created_by) values
  ('40000000-0000-0000-0000-000000000003', 'Storage test assignment', '00000000-0000-0000-0000-000000000301');
insert into public.assignment_tags (assignment_id, tag_id, added_by) values
  ('40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000301');
insert into public.files (id, owner_id, bucket_id, object_name, original_name, media_type, size_bytes, sha256, state) values
  ('40000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000302', 'learning-content',
   '00000000-0000-0000-0000-000000000302/40000000-0000-0000-0000-000000000004.pdf', 'homework.pdf', 'application/pdf', 20, repeat('b', 64), 'ready');
insert into public.assignment_submissions (assignment_id, student_id, file_id) values
  ('40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000302', '40000000-0000-0000-0000-000000000004');
insert into storage.objects (bucket_id, name) values
  ('learning-content', '00000000-0000-0000-0000-000000000302/40000000-0000-0000-0000-000000000004.pdf');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Owner can always read their own object.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000301', true);
select is(
  (select count(*) from storage.objects where bucket_id = 'learning-content'
    and name = '00000000-0000-0000-0000-000000000301/40000000-0000-0000-0000-000000000002.png')::bigint,
  1::bigint, 'the owning teacher can read their own page-attached object'
);

-- The bug this migration fixes: a non-owner who can read the page (via
-- page_files) could not previously read the attached object at all,
-- because the storage policy's subquery against public.files was itself
-- blocked by files' own owner-only RLS.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000302', true);
select is(
  (select count(*) from storage.objects where bucket_id = 'learning-content'
    and name = '00000000-0000-0000-0000-000000000301/40000000-0000-0000-0000-000000000002.png')::bigint,
  1::bigint, 'a non-owner who can read the published page can now read its attached object'
);

-- The submitting student can read their own submitted file.
select is(
  (select count(*) from storage.objects where bucket_id = 'learning-content'
    and name = '00000000-0000-0000-0000-000000000302/40000000-0000-0000-0000-000000000004.pdf')::bigint,
  1::bigint, 'the submitting student can read their own submission object'
);

-- The other half of the same bug: a teacher who manages the assignment but
-- does not own the submitted file could not previously read it either.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000301', true);
select is(
  (select count(*) from storage.objects where bucket_id = 'learning-content'
    and name = '00000000-0000-0000-0000-000000000302/40000000-0000-0000-0000-000000000004.pdf')::bigint,
  1::bigint, 'the managing teacher can read a submission object they do not own'
);

-- A completely unrelated student (no tag membership, no submission, no
-- page access) must still see neither object.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000303', true);
select is(
  (select count(*) from storage.objects where bucket_id = 'learning-content'
    and name = '00000000-0000-0000-0000-000000000301/40000000-0000-0000-0000-000000000002.png')::bigint,
  0::bigint, 'an unrelated student cannot read the page-attached object'
);
select is(
  (select count(*) from storage.objects where bucket_id = 'learning-content'
    and name = '00000000-0000-0000-0000-000000000302/40000000-0000-0000-0000-000000000004.pdf')::bigint,
  0::bigint, 'an unrelated student cannot read the submission object'
);

select * from finish();
rollback;
