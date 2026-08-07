-- Package Q: coverage for calendar_events/calendar_event_tags and the
-- create_calendar_event/cancel_calendar_event RPCs from
-- 20260807030000_calendar.sql. Deadline aggregation itself (assignments.due_at
-- and quizzes.due_at) needs no new DB-level test - it's already covered by
-- 007_assignments.sql/009_quizzes_and_grading.sql's own read-authorization
-- assertions and is read directly by the TS loader, not through a new RPC.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-000000000601', 'calendar-admin@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000602', 'calendar-teacher-in@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000603', 'calendar-teacher-out@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000604', 'calendar-student-in@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000605', 'calendar-student-out@merchanttaylors.com', 'authenticated', 'authenticated');

insert into public.profiles (id, email, kind, state) values
  ('00000000-0000-0000-0000-000000000601', 'calendar-admin@merchanttaylors.com', 'institutional', 'active'),
  ('00000000-0000-0000-0000-000000000602', 'calendar-teacher-in@merchanttaylors.com', 'institutional', 'active'),
  ('00000000-0000-0000-0000-000000000603', 'calendar-teacher-out@merchanttaylors.com', 'institutional', 'active'),
  ('00000000-0000-0000-0000-000000000604', 'calendar-student-in@merchanttaylors.com', 'institutional', 'active'),
  ('00000000-0000-0000-0000-000000000605', 'calendar-student-out@merchanttaylors.com', 'institutional', 'active');

insert into public.role_assignments (profile_id, role, reason) values
  ('00000000-0000-0000-0000-000000000601', 'institution_admin', 'test fixture'),
  ('00000000-0000-0000-0000-000000000602', 'teacher', 'test fixture'),
  ('00000000-0000-0000-0000-000000000603', 'teacher', 'test fixture'),
  ('00000000-0000-0000-0000-000000000604', 'student', 'test fixture'),
  ('00000000-0000-0000-0000-000000000605', 'student', 'test fixture');

insert into public.tags (id, tag_name, display_name, created_by) values
  ('60000000-0000-0000-0000-000000000001', 'Y10CAL', 'Year 10 Calendar Test', '00000000-0000-0000-0000-000000000601');

insert into public.tag_memberships (profile_id, tag_id, membership_role, source) values
  ('00000000-0000-0000-0000-000000000602', '60000000-0000-0000-0000-000000000001', 'teacher', 'test'),
  ('00000000-0000-0000-0000-000000000604', '60000000-0000-0000-0000-000000000001', 'member', 'test');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- A non-admin teacher cannot create a whole-school broadcast event.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000602', true);
select throws_ok(
  $$ select public.create_calendar_event('Staff INSET day', now() + interval '10 days', true, array[]::uuid[]) $$,
  '42501', 'institution administrator role required',
  'a non-admin teacher cannot create a whole-school broadcast event'
);

-- A teacher owning the tag can create a tag-scoped event.
select lives_ok(
  $$ select public.create_calendar_event('Y10 field trip', now() + interval '14 days', false,
    array['60000000-0000-0000-0000-000000000001']::uuid[]) $$,
  'teacher owning the tag can create a tag-scoped event'
);

-- A teacher not on the tag cannot create an event against it.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000603', true);
select throws_ok(
  $$ select public.create_calendar_event('Unauthorized event', now() + interval '5 days', false,
    array['60000000-0000-0000-0000-000000000001']::uuid[]) $$,
  '42501', 'actor does not manage every audience tag',
  'a teacher not on the tag cannot create an event against it'
);

-- Admin happy path: a whole-school broadcast event.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000601', true);
select lives_ok(
  $$ select public.create_calendar_event('Half-term break', now() + interval '20 days', true, array[]::uuid[]) $$,
  'institution_admin can create a whole-school broadcast event'
);

-- A broadcast event must not also list audience tags.
select throws_ok(
  $$ select public.create_calendar_event('Invalid combo', now() + interval '3 days', true,
    array['60000000-0000-0000-0000-000000000001']::uuid[]) $$,
  '22023', 'a whole-school event must not also list audience tags',
  'a broadcast event rejects an accompanying audience tag list'
);

-- A non-broadcast event requires at least one audience tag.
select throws_ok(
  $$ select public.create_calendar_event('No audience', now() + interval '3 days', false, array[]::uuid[]) $$,
  '22023', 'at least one audience tag is required',
  'a non-broadcast event requires at least one audience tag'
);

-- End time must be after start time, checked before the broadcast/tag branch.
select throws_ok(
  $$ select public.create_calendar_event('Backwards event', now() + interval '3 days', false,
    array['60000000-0000-0000-0000-000000000001']::uuid[], null, now()) $$,
  '22023', 'end time must be after the start time',
  'an end time at or before the start time is rejected'
);

-- Read visibility: a member-tier student on the tag sees both the
-- tag-scoped event and the broadcast event.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000604', true);
select is(
  (select count(*) from public.calendar_events)::bigint, 2::bigint,
  'a tag member sees the tag-scoped event and the broadcast event'
);

-- Read visibility: a student with no tag membership at all still sees the
-- broadcast event, but not the tag-scoped one.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000605', true);
select is(
  (select count(*) from public.calendar_events)::bigint, 1::bigint,
  'a student outside the tag sees only the broadcast event'
);

-- A member-tier student cannot cancel the tag-scoped event.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000604', true);
select throws_ok(
  $$ select public.cancel_calendar_event((select id from public.calendar_events where title = 'Y10 field trip')) $$,
  '42501', 'you do not manage this event',
  'a member-tier student cannot cancel the tag-scoped event'
);

-- The owning teacher can cancel the tag-scoped event.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000602', true);
select lives_ok(
  $$ select public.cancel_calendar_event((select id from public.calendar_events where title = 'Y10 field trip')) $$,
  'teacher owning the tag can cancel the tag-scoped event'
);

-- Cancelling again reports not-found, since the RPC only ever matches
-- archived_at is null rows.
select throws_ok(
  $$ select public.cancel_calendar_event('60000000-0000-0000-0000-000000000fff') $$,
  'P0002', 'calendar event not found',
  'cancelling a nonexistent event id reports not found'
);

-- The same teacher cannot cancel the broadcast event - not its creator, not
-- an admin, and broadcast events have no tags to hold a manage grant.
select throws_ok(
  $$ select public.cancel_calendar_event((select id from public.calendar_events where title = 'Half-term break')) $$,
  '42501', 'you do not manage this event',
  'a teacher cannot cancel a broadcast event they did not create'
);

-- The admin who created it can cancel the broadcast event.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000601', true);
select lives_ok(
  $$ select public.cancel_calendar_event((select id from public.calendar_events where title = 'Half-term break')) $$,
  'admin can cancel the broadcast event they created'
);

-- Every create and cancel is audited.
select is(
  (select count(*) from public.audit_events where target_type = 'calendar_event')::bigint, 4::bigint,
  'two creations and two cancellations are all audited'
);

-- Direct table writes cannot bypass the audited RPC path.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000602', true);
select throws_ok(
  $$ update public.calendar_events set title = 'tampered' $$,
  '42501', 'permission denied for table calendar_events',
  'direct table update cannot bypass the audited mutation path'
);

select * from finish();
rollback;
