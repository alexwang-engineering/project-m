-- Project M: restrict Supabase Auth sign-ups to Merchant Taylors' accounts.
-- Run this migration as the Supabase dashboard's postgres role.

create or replace function public.enforce_merchant_taylors_email_domain()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Require exactly one valid-looking local part and the institutional domain.
  -- The case-insensitive regex permits normal mixed-case email input while
  -- rejecting subdomains, suffix tricks, whitespace, and additional @ signs.
  if new.email is null
     or new.email !~* '^[^@[:space:]]+@merchanttaylors[.]com$' then
    raise exception using
      errcode = '28000',
      message = 'Sign-up requires a @merchanttaylors.com email address.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_merchant_taylors_email_domain() from public;

drop trigger if exists enforce_merchant_taylors_email_domain on auth.users;

create trigger enforce_merchant_taylors_email_domain
  before insert on auth.users
  for each row
  execute function public.enforce_merchant_taylors_email_domain();

comment on function public.enforce_merchant_taylors_email_domain() is
  'Blocks creation of auth users outside the merchanttaylors.com email domain.';

-- Supabase SQL Editor: open SQL Editor > New query, paste this entire file,
-- click Run once, then verify with an allowed and a disallowed test sign-up.
