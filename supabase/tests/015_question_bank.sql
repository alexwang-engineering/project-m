-- Package T (ADR-014): coverage for question_bank_items/question_bank_item_tags
-- and the create_bank_item/archive_bank_item RPCs plus create_quiz's new
-- optional bankItemId import path, all from 20260807060000_question_bank.sql.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

select is(
  public.valid_multiple_choice_options('[{"id":"a","label":"Yes"},{"id":"a","label":"No"}]'::jsonb),
  false,
  'multiple-choice option IDs must be unique'
);
select is(
  public.valid_multiple_choice_options('[{"id":"a","label":{"html":"No"}},{"id":"b","label":"Yes"}]'::jsonb),
  false,
  'multiple-choice labels must be bounded strings'
);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-000000000801', 'bank-admin@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000802', 'bank-teacher-in@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000803', 'bank-teacher-out@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000804', 'bank-student-in@merchanttaylors.com', 'authenticated', 'authenticated');

insert into public.profiles (id, email, kind, state) values
  ('00000000-0000-0000-0000-000000000801', 'bank-admin@merchanttaylors.com', 'institutional', 'active'),
  ('00000000-0000-0000-0000-000000000802', 'bank-teacher-in@merchanttaylors.com', 'institutional', 'active'),
  ('00000000-0000-0000-0000-000000000803', 'bank-teacher-out@merchanttaylors.com', 'institutional', 'active'),
  ('00000000-0000-0000-0000-000000000804', 'bank-student-in@merchanttaylors.com', 'institutional', 'active');

insert into public.role_assignments (profile_id, role, reason) values
  ('00000000-0000-0000-0000-000000000801', 'institution_admin', 'test fixture'),
  ('00000000-0000-0000-0000-000000000802', 'teacher', 'test fixture'),
  ('00000000-0000-0000-0000-000000000803', 'teacher', 'test fixture'),
  ('00000000-0000-0000-0000-000000000804', 'student', 'test fixture');

insert into public.tags (id, tag_name, display_name, created_by) values
  ('90000000-0000-0000-0000-000000000001', 'Y10BANKA', 'Year 10 Bank Test A', '00000000-0000-0000-0000-000000000801'),
  ('90000000-0000-0000-0000-000000000002', 'Y10BANKB', 'Year 10 Bank Test B', '00000000-0000-0000-0000-000000000801');

insert into public.tag_memberships (profile_id, tag_id, membership_role, source) values
  ('00000000-0000-0000-0000-000000000802', '90000000-0000-0000-0000-000000000001', 'teacher', 'test'),
  ('00000000-0000-0000-0000-000000000803', '90000000-0000-0000-0000-000000000002', 'teacher', 'test'),
  ('00000000-0000-0000-0000-000000000804', '90000000-0000-0000-0000-000000000001', 'member', 'test');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- A teacher not on the target tag cannot create a bank item against it.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000803', true);
select throws_ok(
  $$ select public.create_bank_item('Unauthorized question', '[{"id":"a","label":"Yes"},{"id":"b","label":"No"}]'::jsonb,
    'a', array['90000000-0000-0000-0000-000000000001']::uuid[]) $$,
  '42501', 'actor does not manage every audience tag',
  'a teacher not on the tag cannot create a bank item against it'
);

-- Invalid correct_choice_id is rejected.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000802', true);
select throws_ok(
  $$ select public.create_bank_item('Bad answer key', '[{"id":"a","label":"Yes"},{"id":"b","label":"No"}]'::jsonb,
    'zzz', array['90000000-0000-0000-0000-000000000001']::uuid[]) $$,
  '22023', 'correct_choice_id must match one of the item choices',
  'an unmatched correct_choice_id is rejected'
);

-- Happy path: the owning teacher creates a bank item on their tag.
select lives_ok(
  $$ select public.create_bank_item('What gas do plants absorb?',
    '[{"id":"a","label":"Oxygen"},{"id":"b","label":"Carbon dioxide"}]'::jsonb,
    'b', array['90000000-0000-0000-0000-000000000001']::uuid[]) $$,
  'a teacher owning the tag can create a bank item'
);

-- A member-tier student cannot read the bank item under any circumstance.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000804', true);
select is(
  (select count(*) from public.question_bank_items)::bigint, 0::bigint,
  'a member-tier student cannot read any bank item'
);

-- The owning teacher can read it back.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000802', true);
select is(
  (select count(*) from public.question_bank_items)::bigint, 1::bigint,
  'the owning teacher can read the bank item back'
);

-- The institution admin can also read it (system-wide access tier).
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000801', true);
select is(
  (select count(*) from public.question_bank_items)::bigint, 1::bigint,
  'an institution admin can read any bank item'
);

-- Capture the bank item's real id while still in a session that can see it
-- (institution_admin, system-wide read tier) - re-querying it later under
-- the unauthorized teacher's own session would return no rows at all under
-- RLS, not the real-but-forbidden id the next test needs to simulate
-- someone guessing another department's bank item id.
select id::text as bank_item_id from public.question_bank_items where prompt = 'What gas do plants absorb?' \gset

-- A teacher on an unrelated tag cannot import a bank item they cannot access
-- (defense against guessing another department's bank item id).
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000803', true);
select throws_ok(
  format(
    $$ select public.create_quiz('Cross-department import attempt', null,
      array['90000000-0000-0000-0000-000000000002']::uuid[],
      jsonb_build_array(jsonb_build_object('bankItemId', %L))) $$,
    :'bank_item_id'
  ),
  'P0002', 'bank item not found',
  'a teacher without access to the bank item cannot import it into a quiz'
);

-- The owning teacher can import their own bank item into a quiz.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000802', true);
select lives_ok(
  $$ select public.create_quiz('Photosynthesis check', null,
    array['90000000-0000-0000-0000-000000000001']::uuid[],
    jsonb_build_array(jsonb_build_object('bankItemId',
      (select id::text from public.question_bank_items where prompt = 'What gas do plants absorb?')))) $$,
  'the owning teacher can import their own bank item into a quiz'
);

-- The imported question's content was copied, not referenced, and carries
-- provenance back to the source bank item.
select is(
  (select prompt from public.quiz_questions where quiz_id =
    (select id from public.quizzes where title = 'Photosynthesis check')),
  'What gas do plants absorb?',
  'the imported question copied the bank item prompt'
);
select is(
  (select sourced_from_bank_item_id from public.quiz_questions where quiz_id =
    (select id from public.quizzes where title = 'Photosynthesis check')),
  (select id from public.question_bank_items where prompt = 'What gas do plants absorb?'),
  'the imported question records provenance back to the bank item'
);

-- Stash the id before archiving (once archived, RLS hides it from everyone
-- including its owner, so it can't be re-selected afterward).
select set_config('test.archived_item_id',
  (select id::text from public.question_bank_items where prompt = 'What gas do plants absorb?'), true);

-- Archiving the bank item removes it from the owning teacher's own view.
select lives_ok(
  $$ select public.archive_bank_item(current_setting('test.archived_item_id')::uuid) $$,
  'the owning teacher can archive their bank item'
);
select is(
  (select count(*) from public.question_bank_items)::bigint, 0::bigint,
  'an archived bank item is no longer visible even to its owner'
);

-- The archived item can no longer be freshly imported into a new quiz.
select throws_ok(
  $$ select public.create_quiz('Attempted reimport of archived item', null,
    array['90000000-0000-0000-0000-000000000001']::uuid[],
    jsonb_build_array(jsonb_build_object('bankItemId', current_setting('test.archived_item_id')))) $$,
  'P0002', 'bank item not found',
  'an archived bank item cannot be freshly imported into a new quiz'
);

-- But the earlier quiz that already copied from it is untouched - the
-- immutable-snapshot property archiving must not retroactively break.
select is(
  (select prompt from public.quiz_questions where quiz_id =
    (select id from public.quizzes where title = 'Photosynthesis check')),
  'What gas do plants absorb?',
  'archiving the source bank item does not retroactively affect a quiz that already copied from it'
);

-- Creation and archival are both audited.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000801', true);
select is(
  (select count(*) from public.audit_events where target_type = 'question_bank_item')::bigint, 2::bigint,
  'one creation and one archival are both audited'
);

-- Direct table writes cannot bypass the audited RPC path.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000802', true);
select throws_ok(
  $$ update public.question_bank_items set prompt = 'tampered' $$,
  '42501', 'permission denied for table question_bank_items',
  'direct table update cannot bypass the audited mutation path'
);

select * from finish();
rollback;
