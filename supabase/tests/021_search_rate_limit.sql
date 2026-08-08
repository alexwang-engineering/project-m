begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-000000001201', 'search-quota@merchanttaylors.com', 'authenticated', 'authenticated');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001201', true);

select ok(public.consume_search_quota(), 'an authenticated user can consume quota');
select ok((select bool_and(public.consume_search_quota()) from generate_series(1, 29)), 'the first 30 requests are allowed');
select is(public.consume_search_quota(), false, 'request 31 is rejected');

reset role;
update public.search_rate_limits
set window_started_at = clock_timestamp() - interval '61 seconds'
where user_id = '00000000-0000-4000-8000-000000001201';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001201', true);
select ok(public.consume_search_quota(), 'quota resets after one minute');

reset role;
set local role anon;
select throws_ok(
  $$ select public.consume_search_quota() $$,
  '42501', 'permission denied for function consume_search_quota',
  'anonymous callers cannot invoke the quota function'
);

select * from finish();
rollback;
