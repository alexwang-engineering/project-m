begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

select is(
  public.before_user_created_institutional('{"user":{"email":"teacher@merchanttaylors.com","app_metadata":{"provider":"azure"}}}'::jsonb) #>> '{error,http_code}',
  '503',
  'institutional admission fails closed until configured'
);

update public.institutional_auth_config
set tenant_id = '10000000-0000-4000-8000-000000000001', enabled = true;

select is(
  public.before_user_created_institutional('{"user":{"email":"teacher@merchanttaylors.com","app_metadata":{"provider":"azure"}}}'::jsonb),
  '{}'::jsonb,
  'configured Azure school identity is admitted'
);
select is(
  public.before_user_created_institutional('{"user":{"email":"teacher@merchanttaylors.com.attacker.test","app_metadata":{"provider":"azure"}}}'::jsonb) #>> '{error,http_code}',
  '403',
  'suffix confusion cannot bypass the exact domain check'
);
select is(
  public.before_user_created_institutional('{"user":{"email":"teacher@merchanttaylors.com","app_metadata":{"provider":"google"}}}'::jsonb) #>> '{error,http_code}',
  '403',
  'non-Azure providers are rejected'
);

-- Package S (2026-08-07): provision_admitted_institutional_user now defers
-- any non-azure signup entirely to provision_admitted_guardian, which only
-- ever acts (granting a guardian profile) when the email matches a
-- pre-authorized guardian_links row. A bypassed provider with no such
-- match is not rejected at the auth.users insert itself (an admin console
-- must be able to create arbitrary auth-only accounts) - it just never
-- receives any profile, and therefore no access at all. The insert
-- succeeds; institutional access does not.
insert into auth.users (id, email, aud, role, raw_app_meta_data, email_confirmed_at)
values ('90000000-0000-4000-8000-000000000099', 'attacker@merchanttaylors.com',
  'authenticated', 'authenticated', '{"provider":"google"}'::jsonb, now());
select ok(
  not exists (select 1 from public.profiles where id = '90000000-0000-4000-8000-000000000099'),
  'a bypassed non-azure provider gets no institutional profile, and therefore no access'
);

insert into auth.users (id, email, aud, role, raw_app_meta_data, email_confirmed_at)
values (
  '90000000-0000-4000-8000-000000000001', 'new.student@merchanttaylors.com',
  'authenticated', 'authenticated', '{"provider":"azure","providers":["azure"]}'::jsonb, now()
);
select ok(
  exists (select 1 from public.profiles where id = '90000000-0000-4000-8000-000000000001' and kind = 'institutional'),
  'admitted auth identity receives an institutional profile'
);
select ok(
  exists (select 1 from public.role_assignments where profile_id = '90000000-0000-4000-8000-000000000001' and role = 'student'),
  'new institutional identity receives least-privilege student role'
);
select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'institutional_auth_config')::bigint,
  0::bigint,
  'browser roles cannot read or mutate protected tenant configuration'
);

-- Package S regression check: with institutional auth enabled (set above),
-- a legitimate pre-authorized guardian magic-link must still succeed
-- rather than being caught by the institutional trigger's azure-only
-- check - this is exactly the bug ADR-013 found by design review.
insert into public.guardian_links (pupil_id, guardian_email, created_by, reason)
values ('90000000-0000-4000-8000-000000000001', 'guardian@example.com',
  '90000000-0000-4000-8000-000000000001', 'test fixture');
insert into auth.users (id, email, aud, role, raw_app_meta_data, email_confirmed_at)
values ('90000000-0000-4000-8000-000000000002', 'guardian@example.com',
  'authenticated', 'authenticated', '{"provider":"email"}'::jsonb, now());
select ok(
  exists (select 1 from public.profiles where id = '90000000-0000-4000-8000-000000000002' and kind = 'guardian'),
  'a pre-authorized guardian magic-link still succeeds once institutional auth is enabled'
);

select * from finish();
rollback;
