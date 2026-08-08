-- Package S: coverage for guardian_links and its admission trigger
-- (provision_admitted_guardian), the link_guardian/revoke_guardian_link
-- RPCs, and the three guardian_view_* read functions from
-- 20260807050000_guardian_access.sql. The institutional-trigger fix itself
-- (provision_admitted_institutional_user deferring non-azure signups) is
-- covered by a regression check appended to 005_auth_admission.sql, since
-- that file already owns institutional-trigger testing.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-000000000901', 'guardian-admin@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000902', 'guardian-teacher@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000903', 'guardian-pupil@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000904', 'guardian-other-pupil@merchanttaylors.com', 'authenticated', 'authenticated');

insert into public.profiles (id, email, kind, state) values
  ('00000000-0000-0000-0000-000000000901', 'guardian-admin@merchanttaylors.com', 'institutional', 'active'),
  ('00000000-0000-0000-0000-000000000902', 'guardian-teacher@merchanttaylors.com', 'institutional', 'active'),
  ('00000000-0000-0000-0000-000000000903', 'guardian-pupil@merchanttaylors.com', 'institutional', 'active'),
  ('00000000-0000-0000-0000-000000000904', 'guardian-other-pupil@merchanttaylors.com', 'institutional', 'active');

insert into public.role_assignments (profile_id, role, reason) values
  ('00000000-0000-0000-0000-000000000901', 'institution_admin', 'test fixture'),
  ('00000000-0000-0000-0000-000000000902', 'teacher', 'test fixture'),
  ('00000000-0000-0000-0000-000000000903', 'student', 'test fixture'),
  ('00000000-0000-0000-0000-000000000904', 'student', 'test fixture');

insert into public.tags (id, tag_name, display_name, created_by) values
  ('90000000-0000-0000-0000-000000000001', 'Y8GUARD', 'Year 8 Guardian Test', '00000000-0000-0000-0000-000000000901');

insert into public.tag_memberships (profile_id, tag_id, membership_role, source) values
  ('00000000-0000-0000-0000-000000000902', '90000000-0000-0000-0000-000000000001', 'teacher', 'test'),
  ('00000000-0000-0000-0000-000000000903', '90000000-0000-0000-0000-000000000001', 'member', 'test');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Fixture content the pupil's guardian should be able to see through them.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000902', true);
select lives_ok(
  $$ select public.create_assignment('Guardian test assignment', null, now() + interval '5 days', false,
    array['90000000-0000-0000-0000-000000000001']::uuid[]) $$,
  'fixture: teacher creates an assignment on the shared tag'
);
select lives_ok(
  $$ select public.create_announcement('Guardian test announcement', 'Body text.', false,
    array['90000000-0000-0000-0000-000000000001']::uuid[]) $$,
  'fixture: teacher posts an announcement on the shared tag'
);

-- Two marks for the linked pupil: only the explicitly released one may cross
-- the guardian projection boundary.
reset role;
insert into public.files (id, owner_id, object_name, original_name, media_type, size_bytes, sha256, state, scanned_at) values
  ('91000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000903', 'guardian/released.pdf', 'released.pdf', 'application/pdf', 100, repeat('a', 64), 'ready', now()),
  ('91000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000903', 'guardian/draft.pdf', 'draft.pdf', 'application/pdf', 100, repeat('b', 64), 'ready', now());
insert into public.assignment_submissions (id, assignment_id, student_id, file_id) values
  ('92000000-0000-4000-8000-000000000001', (select id from public.assignments where title = 'Guardian test assignment'), '00000000-0000-0000-0000-000000000903', '91000000-0000-4000-8000-000000000001'),
  ('92000000-0000-4000-8000-000000000002', (select id from public.assignments where title = 'Guardian test assignment'), '00000000-0000-0000-0000-000000000903', '91000000-0000-4000-8000-000000000002');
insert into public.assignment_grades (submission_id, grade, graded_by, released_by, released_at) values
  ('92000000-0000-4000-8000-000000000001', 77, '00000000-0000-0000-0000-000000000902', '00000000-0000-0000-0000-000000000902', now()),
  ('92000000-0000-4000-8000-000000000002', 44, '00000000-0000-0000-0000-000000000902', null, null);
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000902', true);

-- Only an institution_admin can link a guardian.
select throws_ok(
  $$ select public.link_guardian('00000000-0000-0000-0000-000000000903', 'guardian.parent@example.com', 'confirmed via enrolment form') $$,
  '42501', 'institution administrator role required',
  'a non-admin teacher cannot link a guardian'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000901', true);
select throws_ok(
  $$ select public.link_guardian('00000000-0000-0000-0000-000000000903', 'not-an-email', 'confirmed via enrolment form') $$,
  '22023', 'a valid guardian email address is required',
  'an invalid guardian email format is rejected'
);
select throws_ok(
  $$ select public.link_guardian('00000000-0000-0000-0000-000000000903', 'guardian.parent@example.com', '') $$,
  '22023', 'a reason is required to link a guardian',
  'a blank reason is rejected'
);
select lives_ok(
  $$ select public.link_guardian('00000000-0000-0000-0000-000000000903', 'guardian.parent@example.com', 'confirmed via enrolment form') $$,
  'admin can link a guardian to a pupil with a reason'
);
select throws_ok(
  $$ select public.link_guardian('00000000-0000-0000-0000-000000000903', 'guardian.parent@example.com', 'duplicate attempt') $$,
  '23505', 'duplicate key value violates unique constraint "guardian_links_active_unique"',
  'a second active link for the same pupil and guardian email is rejected'
);

-- Admission: signing up with no pre-authorized link succeeds at the
-- auth.users level (an admin console must be able to create arbitrary
-- auth-only accounts without every provider='email' signup being assumed
-- to be a guardian attempt), but grants no profile and therefore no access
-- at all - deny-by-default is enforced at the data-access layer, not by
-- rejecting the insert itself.
reset role;
insert into auth.users (id, email, aud, role, raw_app_meta_data, email_confirmed_at)
values ('00000000-0000-0000-0000-000000000906', 'stranger@example.com',
  'authenticated', 'authenticated', '{"provider":"email"}'::jsonb, now());
select ok(
  not exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-000000000906'),
  'an email with no pre-authorized guardian link gets no profile, and therefore no access'
);

-- Admission: the pre-authorized guardian's first magic-link signup activates the link.
insert into auth.users (id, email, aud, role, raw_app_meta_data, email_confirmed_at)
values ('00000000-0000-0000-0000-000000000905', 'guardian.parent@example.com',
  'authenticated', 'authenticated', '{"provider":"email"}'::jsonb, now());
select ok(
  exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-000000000905' and kind = 'guardian'),
  'a pre-authorized guardian magic-link creates a guardian profile'
);
select ok(
  exists (
    select 1 from public.guardian_links
    where guardian_profile_id = '00000000-0000-0000-0000-000000000905' and activated_at is not null
  ),
  'the matching guardian_links row is activated on signup'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- An unrelated authenticated user cannot read this pupil's data as a guardian.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000904', true);
select throws_ok(
  $$ select * from public.guardian_view_calendar('00000000-0000-0000-0000-000000000903') $$,
  '42501', 'you are not an authorized guardian for this pupil',
  'an unrelated user cannot view a pupil they are not linked to'
);

-- The authorized guardian sees exactly the fixture content, and nothing else.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000905', true);
select is(
  (select count(*) from public.guardian_view_calendar('00000000-0000-0000-0000-000000000903'))::bigint,
  1::bigint,
  'the authorized guardian sees exactly the one fixture assignment deadline'
);
select is(
  (select count(*) from public.guardian_view_announcements('00000000-0000-0000-0000-000000000903'))::bigint,
  1::bigint,
  'the authorized guardian sees exactly the one fixture announcement'
);
select is(
  (select count(*) from public.guardian_view_grades('00000000-0000-0000-0000-000000000903'))::bigint,
  1::bigint,
  'the guardian sees the released mark but not the saved draft'
);
select is(
  (select grade from public.guardian_view_grades('00000000-0000-0000-0000-000000000903'))::numeric,
  77::numeric,
  'the guardian projection returns the released mark'
);

-- Revocation: only an institution_admin can revoke, and it fails closed immediately.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000902', true);
select throws_ok(
  $$ select public.revoke_guardian_link(
    (select id from public.guardian_links where guardian_email = 'guardian.parent@example.com')) $$,
  '42501', 'institution administrator role required',
  'a non-admin teacher cannot revoke a guardian link'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000901', true);
select lives_ok(
  $$ select public.revoke_guardian_link(
    (select id from public.guardian_links where guardian_email = 'guardian.parent@example.com')) $$,
  'admin can revoke a guardian link'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000905', true);
select throws_ok(
  $$ select * from public.guardian_view_calendar('00000000-0000-0000-0000-000000000903') $$,
  '42501', 'you are not an authorized guardian for this pupil',
  'a revoked guardian immediately loses read access'
);

-- audit_events is admin-only readable; switch back from the guardian
-- context the previous assertion used.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000901', true);
select is(
  (select count(*) from public.audit_events where target_type = 'guardian_link')::bigint, 2::bigint,
  'one link and one revoke are both audited'
);

select throws_ok(
  $$ update public.guardian_links set reason = 'tampered' $$,
  '42501', 'permission denied for table guardian_links',
  'direct table update cannot bypass the audited mutation path'
);

select * from finish();
rollback;
