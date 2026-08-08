begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-000000000901', 'worker-owner@merchanttaylors.com', 'authenticated', 'authenticated');
insert into public.profiles (id, email, kind) values
  ('00000000-0000-4000-8000-000000000901', 'worker-owner@merchanttaylors.com', 'institutional');
insert into public.files (
  id, owner_id, object_name, original_name, media_type, size_bytes, sha256, state,
  created_at, verification_started_at
) values
  ('90000000-0000-4000-8000-000000000901', '00000000-0000-4000-8000-000000000901',
   'worker/first.pdf', 'first.pdf', 'application/pdf', 10, repeat('a', 64), 'pending', now() - interval '30 minutes', null),
  ('90000000-0000-4000-8000-000000000902', '00000000-0000-4000-8000-000000000901',
   'worker/stale.pdf', 'stale.pdf', 'application/pdf', 10, repeat('b', 64), 'scanning', now() - interval '20 minutes', now() - interval '20 minutes'),
  ('90000000-0000-4000-8000-000000000903', '00000000-0000-4000-8000-000000000901',
   'worker/fresh.pdf', 'fresh.pdf', 'application/pdf', 10, repeat('c', 64), 'scanning', now(), now());

set local role service_role;
select is((public.claim_file_for_verification()).id,
  '90000000-0000-4000-8000-000000000901'::uuid, 'oldest pending file is claimed first');
select lives_ok(
  format(
    $$ select public.complete_file_verification('90000000-0000-4000-8000-000000000901', %L, 'ready', null, null) $$,
    (select verification_lease_id from public.files where id = '90000000-0000-4000-8000-000000000901')
  ),
  'terminal transition succeeds');
select is((select state from public.files where id = '90000000-0000-4000-8000-000000000901'),
  'ready'::public.file_state, 'terminal state is stored');
select is((select count(*) from public.audit_events where target_id = '90000000-0000-4000-8000-000000000901'
  and action = 'file.verification.ready')::bigint, 1::bigint, 'terminal transition writes its audit event');
select is((public.claim_file_for_verification()).id,
  '90000000-0000-4000-8000-000000000902'::uuid, 'a stale scanning lease is reclaimed');
select verification_lease_id as old_lease
from public.files where id = '90000000-0000-4000-8000-000000000902' \gset
update public.files set verification_started_at = now() - interval '20 minutes'
where id = '90000000-0000-4000-8000-000000000902';
select is((public.claim_file_for_verification()).id,
  '90000000-0000-4000-8000-000000000902'::uuid, 'reclaim rotates an expired lease');
select throws_ok(
  format(
    $$ select public.complete_file_verification('90000000-0000-4000-8000-000000000902', %L, 'ready', null, null) $$,
    :'old_lease'
  ),
  '55000', 'file verification lease is not current', 'an expired worker cannot finalize a reclaimed file');
select is(public.claim_file_for_verification(), null::public.files,
  'a fresh scanning lease is not reclaimed');
select throws_ok(
  $$ select public.complete_file_verification('90000000-0000-4000-8000-000000000903', null, 'quarantined', null, null) $$,
  '22023', 'quarantine reason must match outcome', 'quarantine requires a reason');

reset role;
set local role authenticated;
select throws_ok(
  $$ select public.claim_file_for_verification() $$,
  '42501', 'permission denied for function claim_file_for_verification',
  'browser roles cannot claim verification work');

select * from finish();
rollback;
