-- Package Y (ADR-019): coverage for content_migration_imports and the
-- get_migration_import/record_migration_import RPCs from
-- 20260807090000_content_migration.sql.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-000000000901', 'migration-admin@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000902', 'migration-teacher@merchanttaylors.com', 'authenticated', 'authenticated');

insert into public.profiles (id, email, kind, state) values
  ('00000000-0000-0000-0000-000000000901', 'migration-admin@merchanttaylors.com', 'institutional', 'active'),
  ('00000000-0000-0000-0000-000000000902', 'migration-teacher@merchanttaylors.com', 'institutional', 'active');

insert into public.role_assignments (profile_id, role, reason) values
  ('00000000-0000-0000-0000-000000000901', 'institution_admin', 'test fixture'),
  ('00000000-0000-0000-0000-000000000902', 'teacher', 'test fixture');

-- A page to stand in for "already-migrated content" - what it actually is
-- doesn't matter to this migration-tracking layer, only that internal_id
-- references something real.
insert into public.pages (id, slug, canonical_url, title, content_json, author_id) values
  ('90000000-0000-0000-0000-000000000101', 'migration-test-page', '/migration-test-page', 'Migration test page',
   '{"schemaVersion":1,"blocks":[]}'::jsonb, '00000000-0000-0000-0000-000000000901');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- A non-admin cannot look up or record a migration import.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000902', true);
select throws_ok(
  $$ select public.get_migration_import('moodle', 'course-1-resource-1') $$,
  '42501', 'institution administrator role required',
  'a teacher cannot look up a migration import record'
);
select throws_ok(
  $$ select public.record_migration_import('moodle', 'course-1-resource-1', gen_random_uuid(), 'page',
    '90000000-0000-0000-0000-000000000101', 'checksum-a') $$,
  '42501', 'institution administrator role required',
  'a teacher cannot record a migration import'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000901', true);

-- Looking up an item never imported returns no row (all fields null via the composite).
select is(
  (select external_id from public.get_migration_import('moodle', 'course-1-resource-1')),
  null,
  'an unimported external_id has no tracking row'
);

-- Rejects an unsupported external_source or internal_type outright.
select throws_ok(
  $$ select public.record_migration_import('canvas', 'x', gen_random_uuid(), 'page',
    '90000000-0000-0000-0000-000000000101', 'c') $$,
  '22023', 'unsupported external_source',
  'only moodle is accepted as an external_source'
);
select throws_ok(
  $$ select public.record_migration_import('moodle', 'x', gen_random_uuid(), 'forum',
    '90000000-0000-0000-0000-000000000101', 'c') $$,
  '22023', 'internal_type must be page, assignment, or quiz',
  'internal_type is restricted to page, assignment, or quiz'
);

-- First import of a manifest item succeeds and is reported as such.
select is(
  (select status from public.record_migration_import('moodle', 'course-1-resource-1', gen_random_uuid(), 'page',
    '90000000-0000-0000-0000-000000000101', 'checksum-a')),
  'imported',
  'the first import of a new external_id is recorded as imported'
);

-- An audit event was written for the import.
select is(
  (select count(*)::int from public.audit_events where action = 'migration.imported' and target_id = '90000000-0000-0000-0000-000000000101'),
  1,
  'importing writes exactly one audit event'
);

-- Re-recording the identical checksum is a true no-op, reported as unchanged.
select is(
  (select status from public.record_migration_import('moodle', 'course-1-resource-1', gen_random_uuid(), 'page',
    '90000000-0000-0000-0000-000000000101', 'checksum-a')),
  'unchanged',
  'recording the same external_id with an identical checksum is reported as unchanged, not re-imported'
);

-- Re-recording with a *different* checksum is reported as a conflict, not silently applied.
select is(
  (select status from public.record_migration_import('moodle', 'course-1-resource-1', gen_random_uuid(), 'page',
    '90000000-0000-0000-0000-000000000101', 'checksum-b-different')),
  'conflict',
  'a changed checksum for an already-imported external_id is reported as a conflict'
);

-- The conflict did not overwrite the original tracking row - the checksum
-- on record is still the first one, proving nothing was silently applied.
select is(
  (select content_checksum from public.get_migration_import('moodle', 'course-1-resource-1')),
  'checksum-a',
  'a conflicting re-import never overwrites the original tracking row'
);

select * from finish();
rollback;
