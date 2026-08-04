-- Fail-closed institutional admission for Supabase's Before User Created hook.
-- The row remains disabled until deployment supplies the real Entra tenant and
-- explicitly enables it after configuring Azure Tenant URL as single-tenant.

create table public.institutional_auth_config (
  singleton boolean primary key default true check (singleton),
  tenant_id uuid,
  email_domain text not null default 'merchanttaylors.com',
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint institutional_auth_enabled_configured check (not enabled or tenant_id is not null),
  constraint institutional_auth_domain_format check (
    email_domain = lower(email_domain) and email_domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'
  )
);

insert into public.institutional_auth_config (singleton) values (true)
on conflict (singleton) do nothing;

alter table public.institutional_auth_config enable row level security;

create or replace function public.before_user_created_institutional(event jsonb)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  config public.institutional_auth_config;
  incoming_email text := lower(btrim(event #>> '{user,email}'));
  provider text := event #>> '{user,app_metadata,provider}';
begin
  select * into config from public.institutional_auth_config where singleton;
  if config is null or not config.enabled then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 503, 'message', 'Institutional sign-in is not yet enabled.'
    ));
  end if;
  if provider <> 'azure' then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403, 'message', 'Only institutional Microsoft sign-in is permitted.'
    ));
  end if;
  if incoming_email is null or split_part(incoming_email, '@', 2) <> config.email_domain
     or incoming_email <> split_part(incoming_email, '@', 1) || '@' || config.email_domain then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403, 'message', 'This Microsoft account is not eligible for institutional access.'
    ));
  end if;
  return '{}'::jsonb;
end;
$$;

create or replace function public.provision_admitted_institutional_user()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare config public.institutional_auth_config; incoming_email text := lower(btrim(new.email));
begin
  select * into config from public.institutional_auth_config where singleton;
  if config is null or not config.enabled then return new; end if;
  if new.raw_app_meta_data ->> 'provider' <> 'azure'
     or new.email_confirmed_at is null
     or split_part(incoming_email, '@', 2) <> config.email_domain
     or incoming_email <> split_part(incoming_email, '@', 1) || '@' || config.email_domain then
    raise exception using errcode = '42501', message = 'institutional admission rejected';
  end if;
  insert into public.profiles (id, email, kind) values (new.id, incoming_email, 'institutional');
  insert into public.role_assignments (profile_id, role, reason)
  values (new.id, 'student', 'Default role assigned at verified institutional admission');
  return new;
end;
$$;

drop trigger if exists provision_admitted_institutional_user on auth.users;
create trigger provision_admitted_institutional_user
after insert on auth.users for each row execute function public.provision_admitted_institutional_user();

revoke all on table public.institutional_auth_config from public, anon, authenticated;
revoke all on function public.before_user_created_institutional(jsonb) from public, anon, authenticated;
revoke all on function public.provision_admitted_institutional_user() from public, anon, authenticated;
grant execute on function public.before_user_created_institutional(jsonb) to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;
