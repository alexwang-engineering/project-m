-- Isolated coverage for update_page's optimistic-version-conflict path
-- (20260804191000_atomic_content_mutations.sql:109), found to have zero
-- pgTAP coverage anywhere in this suite while live-verifying the
-- concurrent-edit conflict-UX gap-fix (commit ac34880) this session.
begin;
create extension if not exists pgtap with schema extensions;
select plan(2);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-000000001001', 'conflict-teacher@merchanttaylors.com', 'authenticated', 'authenticated');

insert into public.profiles (id, email, kind, state) values
  ('00000000-0000-0000-0000-000000001001', 'conflict-teacher@merchanttaylors.com', 'institutional', 'active');

insert into public.role_assignments (profile_id, role, reason) values
  ('00000000-0000-0000-0000-000000001001', 'teacher', 'test fixture');

insert into public.tags (id, tag_name, display_name, created_by) values
  ('90000000-0000-0000-0000-000000001001', 'CONFLICTTAG', 'Conflict Test Tag', '00000000-0000-0000-0000-000000001001');

insert into public.tag_memberships (profile_id, tag_id, membership_role, source) values
  ('00000000-0000-0000-0000-000000001001', '90000000-0000-0000-0000-000000001001', 'teacher', 'test');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000001001', true);

select public.create_page(
  'Conflict Coverage Page', 'conflict-coverage-page', null,
  '{"schemaVersion":1,"blocks":[]}'::jsonb, 1,
  array['90000000-0000-0000-0000-000000001001']::uuid[]
);

-- First update, using the correct starting version (1), succeeds.
select lives_ok(
  $$ select public.update_page(
    (select id from public.pages where slug = 'conflict-coverage-page'), 1,
    'Conflict Coverage Page (first writer)', 'conflict-coverage-page', null,
    '{"schemaVersion":1,"blocks":[]}'::jsonb, 1,
    array['90000000-0000-0000-0000-000000001001']::uuid[]
  ) $$,
  'the first writer, holding the correct version, saves successfully'
);

-- A second writer, still holding the now-stale version (1), must be
-- rejected with 40001 - this is what PageEditor.tsx's error.code ===
-- 'conflict' branch depends on to show the amber banner instead of a
-- generic error.
select throws_ok(
  $$ select public.update_page(
    (select id from public.pages where slug = 'conflict-coverage-page'), 1,
    'Conflict Coverage Page (second writer, stale)', 'conflict-coverage-page', null,
    '{"schemaVersion":1,"blocks":[]}'::jsonb, 1,
    array['90000000-0000-0000-0000-000000001001']::uuid[]
  ) $$,
  '40001', 'page version conflict',
  'a second writer holding the now-stale version is rejected with 40001, not a generic failure'
);

select * from finish();
rollback;
