-- Package R: coverage for announcements/announcement_tags and the
-- create_announcement/cancel_announcement RPCs from
-- 20260807040000_announcements.sql. Structurally near-identical to
-- 012_calendar.sql's coverage of calendar_events, since both reuse the
-- exact same broadcast/tag-scoped authorization shape.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

-- Baseline before this file's own fixtures - see the identical note in
-- 012_calendar.sql.
select count(*) as baseline_announcement_audit_events
  from public.audit_events where target_type = 'announcement' \gset

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-000000000701', 'announce-admin@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000702', 'announce-teacher-in@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000703', 'announce-teacher-out@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000704', 'announce-student-in@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000705', 'announce-student-out@merchanttaylors.com', 'authenticated', 'authenticated');

insert into public.profiles (id, email, kind, state) values
  ('00000000-0000-0000-0000-000000000701', 'announce-admin@merchanttaylors.com', 'institutional', 'active'),
  ('00000000-0000-0000-0000-000000000702', 'announce-teacher-in@merchanttaylors.com', 'institutional', 'active'),
  ('00000000-0000-0000-0000-000000000703', 'announce-teacher-out@merchanttaylors.com', 'institutional', 'active'),
  ('00000000-0000-0000-0000-000000000704', 'announce-student-in@merchanttaylors.com', 'institutional', 'active'),
  ('00000000-0000-0000-0000-000000000705', 'announce-student-out@merchanttaylors.com', 'institutional', 'active');

insert into public.role_assignments (profile_id, role, reason) values
  ('00000000-0000-0000-0000-000000000701', 'institution_admin', 'test fixture'),
  ('00000000-0000-0000-0000-000000000702', 'teacher', 'test fixture'),
  ('00000000-0000-0000-0000-000000000703', 'teacher', 'test fixture'),
  ('00000000-0000-0000-0000-000000000704', 'student', 'test fixture'),
  ('00000000-0000-0000-0000-000000000705', 'student', 'test fixture');

insert into public.tags (id, tag_name, display_name, created_by) values
  ('80000000-0000-0000-0000-000000000001', 'Y10ANN', 'Year 10 Announcements Test', '00000000-0000-0000-0000-000000000701');

insert into public.tag_memberships (profile_id, tag_id, membership_role, source) values
  ('00000000-0000-0000-0000-000000000702', '80000000-0000-0000-0000-000000000001', 'teacher', 'test'),
  ('00000000-0000-0000-0000-000000000704', '80000000-0000-0000-0000-000000000001', 'member', 'test');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- A non-admin teacher cannot post a whole-school broadcast announcement.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000702', true);
select throws_ok(
  $$ select public.create_announcement('Staff meeting moved', 'The 3pm staff meeting is now in the hall.',
    true, array[]::uuid[]) $$,
  '42501', 'institution administrator role required',
  'a non-admin teacher cannot post a whole-school broadcast announcement'
);

-- A teacher owning the tag can post a tag-scoped announcement.
select lives_ok(
  $$ select public.create_announcement('Trip reminder', 'Bring a packed lunch on Friday.', false,
    array['80000000-0000-0000-0000-000000000001']::uuid[]) $$,
  'teacher owning the tag can post a tag-scoped announcement'
);

-- A teacher not on the tag cannot post against it.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000703', true);
select throws_ok(
  $$ select public.create_announcement('Unauthorized post', 'Should not be allowed.', false,
    array['80000000-0000-0000-0000-000000000001']::uuid[]) $$,
  '42501', 'actor does not manage every audience tag',
  'a teacher not on the tag cannot post an announcement against it'
);

-- Admin happy path: a whole-school broadcast announcement.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000701', true);
select lives_ok(
  $$ select public.create_announcement('INSET day reminder', 'School closed for staff training on 1 September.',
    true, array[]::uuid[]) $$,
  'institution_admin can post a whole-school broadcast announcement'
);

-- A broadcast announcement must not also list audience tags.
select throws_ok(
  $$ select public.create_announcement('Invalid combo', 'Body text.', true,
    array['80000000-0000-0000-0000-000000000001']::uuid[]) $$,
  '22023', 'a whole-school announcement must not also list audience tags',
  'a broadcast announcement rejects an accompanying audience tag list'
);

-- A non-broadcast announcement requires at least one audience tag.
select throws_ok(
  $$ select public.create_announcement('No audience', 'Body text.', false, array[]::uuid[]) $$,
  '22023', 'at least one audience tag is required',
  'a non-broadcast announcement requires at least one audience tag'
);

-- Read visibility: a member-tier student on the tag sees both the
-- tag-scoped announcement and the broadcast announcement.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000704', true);
select is(
  (select count(*) from public.announcements)::bigint, 2::bigint,
  'a tag member sees the tag-scoped announcement and the broadcast announcement'
);

-- Read visibility: a student with no tag membership at all still sees the
-- broadcast announcement, but not the tag-scoped one.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000705', true);
select is(
  (select count(*) from public.announcements)::bigint, 1::bigint,
  'a student outside the tag sees only the broadcast announcement'
);

-- A member-tier student cannot cancel the tag-scoped announcement.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000704', true);
select throws_ok(
  $$ select public.cancel_announcement((select id from public.announcements where title = 'Trip reminder')) $$,
  '42501', 'you do not manage this announcement',
  'a member-tier student cannot cancel the tag-scoped announcement'
);

-- The owning teacher can cancel the tag-scoped announcement.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000702', true);
select lives_ok(
  $$ select public.cancel_announcement((select id from public.announcements where title = 'Trip reminder')) $$,
  'teacher owning the tag can cancel the tag-scoped announcement'
);

-- Cancelling again reports not-found.
select throws_ok(
  $$ select public.cancel_announcement('80000000-0000-0000-0000-000000000fff') $$,
  'P0002', 'announcement not found',
  'cancelling a nonexistent announcement id reports not found'
);

-- The same teacher cannot cancel the broadcast announcement.
select throws_ok(
  $$ select public.cancel_announcement((select id from public.announcements where title = 'INSET day reminder')) $$,
  '42501', 'you do not manage this announcement',
  'a teacher cannot cancel a broadcast announcement they did not create'
);

-- The admin who created it can cancel the broadcast announcement.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000701', true);
select lives_ok(
  $$ select public.cancel_announcement((select id from public.announcements where title = 'INSET day reminder')) $$,
  'admin can cancel the broadcast announcement they created'
);

-- Every create and cancel is audited.
select is(
  (
    (select count(*) from public.audit_events where target_type = 'announcement')
    - :baseline_announcement_audit_events
  )::bigint,
  4::bigint,
  'two postings and two cancellations are all audited'
);

-- Direct table writes cannot bypass the audited RPC path.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000702', true);
select throws_ok(
  $$ update public.announcements set title = 'tampered' $$,
  '42501', 'permission denied for table announcements',
  'direct table update cannot bypass the audited mutation path'
);

select * from finish();
rollback;
