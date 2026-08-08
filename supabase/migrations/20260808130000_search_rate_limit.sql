-- A database-backed fixed-window quota works across every Next.js instance.
-- It is deliberately private: callers can only consume their own quota via auth.uid().
create table public.search_rate_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default clock_timestamp(),
  request_count integer not null default 1 check (request_count between 1 and 30)
);

alter table public.search_rate_limits enable row level security;

create or replace function public.consume_search_quota()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  consumed uuid;
begin
  if caller is null then return false; end if;

  insert into public.search_rate_limits as limits (user_id)
  values (caller)
  on conflict (user_id) do update
  set
    window_started_at = case
      when limits.window_started_at <= clock_timestamp() - interval '1 minute'
        then clock_timestamp()
      else limits.window_started_at
    end,
    request_count = case
      when limits.window_started_at <= clock_timestamp() - interval '1 minute'
        then 1
      else limits.request_count + 1
    end
  where limits.window_started_at <= clock_timestamp() - interval '1 minute'
     or limits.request_count < 30
  returning user_id into consumed;

  return consumed is not null;
end;
$$;

revoke all on table public.search_rate_limits from public, anon, authenticated;
revoke all on function public.consume_search_quota() from public, anon;
grant execute on function public.consume_search_quota() to authenticated;
