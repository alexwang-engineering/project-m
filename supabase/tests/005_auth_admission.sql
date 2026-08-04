begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

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

select throws_ok(
  $$ insert into auth.users (id, email, aud, role, raw_app_meta_data, email_confirmed_at)
     values ('90000000-0000-4000-8000-000000000099', 'attacker@merchanttaylors.com',
       'authenticated', 'authenticated', '{"provider":"google"}'::jsonb, now()) $$,
  '42501', 'institutional admission rejected',
  'database provisioning trigger independently rejects a bypassed provider'
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

select * from finish();
rollback;
