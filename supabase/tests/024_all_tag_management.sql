begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email, aud, role) values
  ('24000000-0000-4000-8000-000000000001', 'all-tags@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('24000000-0000-4000-8000-000000000002', 'partial-tags@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('24000000-0000-4000-8000-000000000003', 'former-creator@merchanttaylors.com', 'authenticated', 'authenticated');
insert into public.profiles (id, email, kind, state) values
  ('24000000-0000-4000-8000-000000000001', 'all-tags@merchanttaylors.com', 'institutional', 'active'),
  ('24000000-0000-4000-8000-000000000002', 'partial-tags@merchanttaylors.com', 'institutional', 'active'),
  ('24000000-0000-4000-8000-000000000003', 'former-creator@merchanttaylors.com', 'institutional', 'active');
insert into public.role_assignments (profile_id, role, reason) values
  ('24000000-0000-4000-8000-000000000001', 'teacher', 'test fixture'),
  ('24000000-0000-4000-8000-000000000002', 'teacher', 'test fixture'),
  ('24000000-0000-4000-8000-000000000003', 'student', 'expired teacher fixture');
insert into public.tags (id, tag_name, display_name, created_by) values
  ('24000000-0000-4000-8000-000000000011', 'Y9ALLA', 'All tags A', '24000000-0000-4000-8000-000000000001'),
  ('24000000-0000-4000-8000-000000000012', 'Y9ALLB', 'All tags B', '24000000-0000-4000-8000-000000000001');
insert into public.tag_memberships (profile_id, tag_id, membership_role, source) values
  ('24000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000011', 'teacher', 'test'),
  ('24000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000012', 'teacher', 'test'),
  ('24000000-0000-4000-8000-000000000002', '24000000-0000-4000-8000-000000000011', 'teacher', 'test');

insert into public.assignments (id, title, created_by) values
  ('24000000-0000-4000-8000-000000000021', 'Multi-tag assignment', '24000000-0000-4000-8000-000000000003');
insert into public.assignment_tags (assignment_id, tag_id, added_by) values
  ('24000000-0000-4000-8000-000000000021', '24000000-0000-4000-8000-000000000011', '24000000-0000-4000-8000-000000000003'),
  ('24000000-0000-4000-8000-000000000021', '24000000-0000-4000-8000-000000000012', '24000000-0000-4000-8000-000000000003');
insert into public.quizzes (id, title, author_id) values
  ('24000000-0000-4000-8000-000000000022', 'Multi-tag quiz', '24000000-0000-4000-8000-000000000003');
insert into public.quiz_tags (quiz_id, tag_id, added_by) values
  ('24000000-0000-4000-8000-000000000022', '24000000-0000-4000-8000-000000000011', '24000000-0000-4000-8000-000000000003'),
  ('24000000-0000-4000-8000-000000000022', '24000000-0000-4000-8000-000000000012', '24000000-0000-4000-8000-000000000003');
insert into public.calendar_events (id, title, starts_at, created_by) values
  ('24000000-0000-4000-8000-000000000023', 'Multi-tag event', now(), '24000000-0000-4000-8000-000000000003');
insert into public.calendar_event_tags (event_id, tag_id, added_by) values
  ('24000000-0000-4000-8000-000000000023', '24000000-0000-4000-8000-000000000011', '24000000-0000-4000-8000-000000000003'),
  ('24000000-0000-4000-8000-000000000023', '24000000-0000-4000-8000-000000000012', '24000000-0000-4000-8000-000000000003');
insert into public.announcements (id, title, body, created_by) values
  ('24000000-0000-4000-8000-000000000024', 'Multi-tag announcement', 'Body', '24000000-0000-4000-8000-000000000003');
insert into public.announcement_tags (announcement_id, tag_id, added_by) values
  ('24000000-0000-4000-8000-000000000024', '24000000-0000-4000-8000-000000000011', '24000000-0000-4000-8000-000000000003'),
  ('24000000-0000-4000-8000-000000000024', '24000000-0000-4000-8000-000000000012', '24000000-0000-4000-8000-000000000003');
insert into public.question_bank_items (id, prompt, choices, correct_choice_id, created_by) values
  ('24000000-0000-4000-8000-000000000025', 'Multi-tag question',
   '[{"id":"a","label":"A"},{"id":"b","label":"B"}]'::jsonb, 'a', '24000000-0000-4000-8000-000000000003');
insert into public.question_bank_item_tags (item_id, tag_id, added_by) values
  ('24000000-0000-4000-8000-000000000025', '24000000-0000-4000-8000-000000000011', '24000000-0000-4000-8000-000000000003'),
  ('24000000-0000-4000-8000-000000000025', '24000000-0000-4000-8000-000000000012', '24000000-0000-4000-8000-000000000003');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '24000000-0000-4000-8000-000000000002', true);
select is(public.can_manage_assignment('24000000-0000-4000-8000-000000000021'), false, 'partial-tag teacher cannot manage assignment');
select is(public.can_manage_quiz('24000000-0000-4000-8000-000000000022'), false, 'partial-tag teacher cannot manage quiz');
select is(public.can_manage_calendar_event('24000000-0000-4000-8000-000000000023'), false, 'partial-tag teacher cannot manage event');
select is(public.can_manage_announcement('24000000-0000-4000-8000-000000000024'), false, 'partial-tag teacher cannot manage announcement');
select is(public.can_access_bank_item('24000000-0000-4000-8000-000000000025'), false, 'partial-tag teacher cannot access bank item');

select set_config('request.jwt.claim.sub', '24000000-0000-4000-8000-000000000001', true);
select is(public.can_manage_assignment('24000000-0000-4000-8000-000000000021'), true, 'all-tag teacher can manage assignment');
select is(public.can_manage_quiz('24000000-0000-4000-8000-000000000022'), true, 'all-tag teacher can manage quiz');
select is(public.can_manage_calendar_event('24000000-0000-4000-8000-000000000023'), true, 'all-tag teacher can manage event');
select is(public.can_manage_announcement('24000000-0000-4000-8000-000000000024'), true, 'all-tag teacher can manage announcement');
select is(public.can_access_bank_item('24000000-0000-4000-8000-000000000025'), true, 'all-tag teacher can access bank item');

select set_config('request.jwt.claim.sub', '24000000-0000-4000-8000-000000000003', true);
select is(public.can_manage_assignment('24000000-0000-4000-8000-000000000021'), false, 'former teacher creator cannot manage assignment');
select is(public.can_manage_quiz('24000000-0000-4000-8000-000000000022'), false, 'former teacher creator cannot manage quiz');

select * from finish();
rollback;
