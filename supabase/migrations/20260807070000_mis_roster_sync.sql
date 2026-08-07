-- Package U (ADR-015): file-based MIS/SIS roster reconciliation. No real
-- MIS exists in this environment (PACKAGE-B-PREFLIGHT.md deliberately
-- deferred MIS/SIS credentials until a package owns a concrete connector
-- contract) - this is the reconciliation engine only, driven by an
-- admin-uploaded CSV snapshot parsed to jsonb client-side. A live
-- API/webhook connector is future work layered on top of the same
-- sync_roster(rows, ...) contract this migration defines.
--
-- Reconciliation semantics, matching ADR-009's required properties:
--  - Role grants are additive only. A role the sync doesn't mention is
--    never revoked - that stays a deliberate admin action.
--  - Tag memberships are reconciled, but only ones the sync itself granted
--    (tag_memberships.source = 'mis_sync:<run_id>'). A membership with any
--    other source is never touched, regardless of what the roster says -
--    this is what keeps manual admin overrides safe from a later sync run.
--  - A person the sync previously provisioned who drops off every roster
--    is disabled (profiles.state), never deleted. Re-enabling a disabled
--    account is always a separate, deliberate admin action via the
--    existing set_profile_state RPC - never automatic on reappearing in a
--    later roster, since an automatic reactivation can't tell a sync-caused
--    disable apart from a manual disciplinary/security one, and silently
--    overriding the latter would be a real access-control bug.
--  - Every write is conditional on "differs from current state", so
--    re-running an identical snapshot is a true no-op (idempotent).
--  - dry_run computes and returns the full diff without writing anything.

create table public.mis_roster_intents (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  granted_role public.system_role not null,
  memberships jsonb not null,
  sync_run_id uuid not null,
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  constraint mis_roster_intents_email_normalized check (email = lower(btrim(email))),
  constraint mis_roster_intents_role_scope check (granted_role in ('student', 'teacher'))
);
-- One pending intent per email - a later sync run's data replaces an
-- earlier one that never got applied (person still hasn't logged in).
create unique index mis_roster_intents_pending_email_unique on public.mis_roster_intents ((lower(email))) where applied_at is null;

alter table public.mis_roster_intents enable row level security;
-- No policies at all, on purpose - this table is never read through
-- PostgREST by any client. It exists purely as internal state between
-- sync_roster (writes it) and the apply_mis_roster_intents trigger below
-- (reads and consumes it).

create or replace function public.sync_roster(
  rows jsonb,
  dry_run boolean default true,
  correlation_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  run_id uuid := coalesce(correlation_id, extensions.gen_random_uuid());
  row_count integer;
  entry jsonb;
  row_email text;
  row_role text;
  membership jsonb;
  tag_id uuid;
  membership_role_text text;
  seen_emails text[] := array[]::text[];
  errors jsonb := '[]'::jsonb;
  report jsonb;
begin
  perform public.assert_institution_admin(actor);
  if jsonb_typeof(rows) <> 'array' then
    raise exception using errcode = '22023', message = 'rows must be a JSON array';
  end if;
  row_count := jsonb_array_length(rows);
  if row_count < 1 or row_count > 5000 then
    raise exception using errcode = '22023', message = 'between 1 and 5000 roster rows are required';
  end if;

  -- Explicit pg_temp. qualification throughout, not relying on search_path
  -- (deliberately '' on this function) to resolve the temp schema. Dropped
  -- explicitly rather than relying on ON COMMIT DROP - that only fires when
  -- the enclosing transaction actually commits, which is true for a normal
  -- one-call-per-transaction production RPC invocation but not for two
  -- calls inside one transaction (found via pgTAP, which wraps an entire
  -- test file in a single transaction to roll back - the second sync_roster
  -- call in a dry-run-then-apply sequence hit "relation already exists").
  drop table if exists pg_temp.roster_valid_people;
  create temporary table roster_valid_people (
    email text primary key,
    granted_role public.system_role not null
  );
  drop table if exists pg_temp.roster_valid_memberships;
  create temporary table roster_valid_memberships (
    email text not null,
    tag_id uuid not null,
    tag_name text not null,
    membership_role public.membership_role not null
  );

  for entry in select * from jsonb_array_elements(rows) loop
    row_email := lower(btrim(entry ->> 'email'));
    row_role := entry ->> 'systemRole';

    if row_email is null or row_email = '' or row_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      errors := errors || jsonb_build_array(jsonb_build_object('email', coalesce(entry ->> 'email', ''), 'error', 'invalid email'));
      continue;
    end if;
    if row_email = any (seen_emails) then
      errors := errors || jsonb_build_array(jsonb_build_object('email', row_email, 'error', 'duplicate row for this email in the same upload'));
      continue;
    end if;
    if row_role not in ('student', 'teacher') then
      errors := errors || jsonb_build_array(jsonb_build_object('email', row_email, 'error', 'systemRole must be student or teacher'));
      continue;
    end if;
    seen_emails := seen_emails || row_email;

    for membership in select * from jsonb_array_elements(coalesce(entry -> 'memberships', '[]'::jsonb)) loop
      membership_role_text := membership ->> 'membershipRole';
      if membership_role_text not in ('member', 'teacher', 'manager') then
        errors := errors || jsonb_build_array(jsonb_build_object(
          'email', row_email, 'error', format('invalid membershipRole for tag %s', coalesce(membership ->> 'tagName', ''))
        ));
        continue;
      end if;
      select id into tag_id from public.tags where upper(tag_name) = upper(membership ->> 'tagName') and is_active;
      if tag_id is null then
        errors := errors || jsonb_build_array(jsonb_build_object(
          'email', row_email, 'error', format('unknown or archived tag %s', coalesce(membership ->> 'tagName', ''))
        ));
        continue;
      end if;
      insert into pg_temp.roster_valid_memberships (email, tag_id, tag_name, membership_role)
      values (row_email, tag_id, upper(membership ->> 'tagName'), membership_role_text::public.membership_role);
    end loop;

    insert into pg_temp.roster_valid_people (email, granted_role) values (row_email, row_role::public.system_role);
  end loop;

  report := jsonb_build_object(
    'runId', run_id,
    'dryRun', dry_run,
    'rowsProcessed', row_count,
    'peopleValidated', (select count(*) from pg_temp.roster_valid_people),
    'errors', errors,
    'roleGrants', (
      select coalesce(jsonb_agg(jsonb_build_object('email', v.email, 'role', v.granted_role)), '[]'::jsonb)
      from pg_temp.roster_valid_people v
      join public.profiles p on p.email = v.email
      where not exists (
        select 1 from public.role_assignments ra
        where ra.profile_id = p.id and ra.role = v.granted_role
          and ra.valid_from <= now() and (ra.valid_until is null or ra.valid_until > now())
      )
    ),
    'membershipGrants', (
      select coalesce(jsonb_agg(jsonb_build_object('email', m.email, 'tag', m.tag_name, 'role', m.membership_role)), '[]'::jsonb)
      from pg_temp.roster_valid_memberships m
      join public.profiles p on p.email = m.email
      where not exists (
        select 1 from public.tag_memberships tm
        where tm.profile_id = p.id and tm.tag_id = m.tag_id and tm.membership_role = m.membership_role
          and tm.valid_from <= now() and (tm.valid_until is null or tm.valid_until > now())
      )
    ),
    'membershipClosures', (
      select coalesce(jsonb_agg(jsonb_build_object('email', p.email, 'tag', t.tag_name, 'role', tm.membership_role)), '[]'::jsonb)
      from public.tag_memberships tm
      join public.profiles p on p.id = tm.profile_id
      join public.tags t on t.id = tm.tag_id
      where tm.source like 'mis_sync:%'
        and tm.valid_until is null
        and exists (select 1 from pg_temp.roster_valid_people v where v.email = p.email)
        and not exists (
          select 1 from pg_temp.roster_valid_memberships m
          where m.email = p.email and m.tag_id = tm.tag_id and m.membership_role = tm.membership_role
        )
    ),
    'accountsToDisable', (
      select coalesce(jsonb_agg(jsonb_build_object('email', p.email)), '[]'::jsonb)
      from public.profiles p
      where p.state = 'active'
        and not exists (select 1 from pg_temp.roster_valid_people v where v.email = p.email)
        and (
          exists (
            select 1 from public.role_assignments ra
            where ra.profile_id = p.id and ra.reason like 'mis_sync:%'
              and ra.valid_from <= now() and (ra.valid_until is null or ra.valid_until > now())
          )
          or exists (
            select 1 from public.tag_memberships tm
            where tm.profile_id = p.id and tm.source like 'mis_sync:%'
              and tm.valid_from <= now() and (tm.valid_until is null or tm.valid_until > now())
          )
        )
    ),
    'intentsQueued', (
      select coalesce(jsonb_agg(jsonb_build_object('email', v.email, 'role', v.granted_role)), '[]'::jsonb)
      from pg_temp.roster_valid_people v
      where not exists (select 1 from public.profiles p where p.email = v.email)
    )
  );

  if not dry_run then
    insert into public.role_assignments (profile_id, role, granted_by, reason)
    select p.id, v.granted_role, actor, 'mis_sync:' || run_id::text
    from pg_temp.roster_valid_people v
    join public.profiles p on p.email = v.email
    where not exists (
      select 1 from public.role_assignments ra
      where ra.profile_id = p.id and ra.role = v.granted_role
        and ra.valid_from <= now() and (ra.valid_until is null or ra.valid_until > now())
    );

    insert into public.tag_memberships (profile_id, tag_id, membership_role, source, granted_by)
    select p.id, m.tag_id, m.membership_role, 'mis_sync:' || run_id::text, actor
    from pg_temp.roster_valid_memberships m
    join public.profiles p on p.email = m.email
    where not exists (
      select 1 from public.tag_memberships tm
      where tm.profile_id = p.id and tm.tag_id = m.tag_id and tm.membership_role = m.membership_role
        and tm.valid_from <= now() and (tm.valid_until is null or tm.valid_until > now())
    );

    update public.tag_memberships tm
    set valid_until = now()
    from public.profiles p
    where tm.profile_id = p.id
      and tm.source like 'mis_sync:%'
      and tm.valid_until is null
      and exists (select 1 from pg_temp.roster_valid_people v where v.email = p.email)
      and not exists (
        select 1 from pg_temp.roster_valid_memberships m
        where m.email = p.email and m.tag_id = tm.tag_id and m.membership_role = tm.membership_role
      );

    update public.profiles p
    set state = 'disabled', disabled_at = now()
    where p.state = 'active'
      and not exists (select 1 from pg_temp.roster_valid_people v where v.email = p.email)
      and (
        exists (
          select 1 from public.role_assignments ra
          where ra.profile_id = p.id and ra.reason like 'mis_sync:%'
            and ra.valid_from <= now() and (ra.valid_until is null or ra.valid_until > now())
        )
        or exists (
          select 1 from public.tag_memberships tm
          where tm.profile_id = p.id and tm.source like 'mis_sync:%'
            and tm.valid_from <= now() and (tm.valid_until is null or tm.valid_until > now())
        )
      );

    insert into public.mis_roster_intents (email, granted_role, memberships, sync_run_id)
    select
      v.email,
      v.granted_role,
      coalesce((
        select jsonb_agg(jsonb_build_object('tagId', m.tag_id, 'role', m.membership_role))
        from pg_temp.roster_valid_memberships m where m.email = v.email
      ), '[]'::jsonb),
      run_id
    from pg_temp.roster_valid_people v
    where not exists (select 1 from public.profiles p where p.email = v.email)
    on conflict ((lower(email))) where applied_at is null
    do update set granted_role = excluded.granted_role, memberships = excluded.memberships,
      sync_run_id = excluded.sync_run_id, created_at = now();

    insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, after_data)
    values (actor, 'roster_sync.applied', 'mis_roster_sync', run_id, correlation_id, 'app', report);
  end if;

  return report;
end;
$$;
revoke all on function public.sync_roster(jsonb, boolean, uuid) from public;
grant execute on function public.sync_roster(jsonb, boolean, uuid) to authenticated;

-- Applies a pending roster intent the moment its email's first real
-- signup happens - identical precedent to provision_admitted_guardian
-- staging a grant before the guardian's first login.
create or replace function public.apply_mis_roster_intents()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  incoming_email text := lower(btrim(new.email));
  pending public.mis_roster_intents;
  membership jsonb;
begin
  select * into pending from public.mis_roster_intents
  where email = incoming_email and applied_at is null
  order by created_at desc
  limit 1;
  if pending is null then
    return new;
  end if;

  insert into public.profiles (id, email, kind) values (new.id, incoming_email, 'institutional')
  on conflict (id) do nothing;

  insert into public.role_assignments (profile_id, role, reason)
  select new.id, pending.granted_role, 'mis_sync:' || pending.sync_run_id::text
  where not exists (
    select 1 from public.role_assignments ra
    where ra.profile_id = new.id and ra.role = pending.granted_role
      and ra.valid_from <= now() and (ra.valid_until is null or ra.valid_until > now())
  );

  for membership in select * from jsonb_array_elements(pending.memberships) loop
    if exists (select 1 from public.tags t where t.id = (membership ->> 'tagId')::uuid and t.is_active) then
      insert into public.tag_memberships (profile_id, tag_id, membership_role, source)
      values (new.id, (membership ->> 'tagId')::uuid, (membership ->> 'role')::public.membership_role, 'mis_sync:' || pending.sync_run_id::text);
    end if;
  end loop;

  update public.mis_roster_intents set applied_at = now() where id = pending.id;

  return new;
end;
$$;

drop trigger if exists apply_mis_roster_intents on auth.users;
create trigger apply_mis_roster_intents
after insert on auth.users for each row execute function public.apply_mis_roster_intents();
revoke all on function public.apply_mis_roster_intents() from public, anon, authenticated;

-- Fix, not a rewrite: adds `on conflict (id) do nothing` to the one
-- unconditional profiles insert that could otherwise race with
-- apply_mis_roster_intents above (fires first alphabetically) once Entra
-- is enabled and a MIS-intended person's first login happens to be a real
-- institutional Entra signup rather than a magic link. Everything else
-- about this function is unchanged from 20260807050000_guardian_access.sql.
create or replace function public.provision_admitted_institutional_user()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare config public.institutional_auth_config; incoming_email text := lower(btrim(new.email));
begin
  select * into config from public.institutional_auth_config where singleton;
  if config is null or not config.enabled then return new; end if;
  if new.raw_app_meta_data ->> 'provider' <> 'azure' then
    return new;
  end if;
  if new.email_confirmed_at is null
     or split_part(incoming_email, '@', 2) <> config.email_domain
     or incoming_email <> split_part(incoming_email, '@', 1) || '@' || config.email_domain then
    raise exception using errcode = '42501', message = 'institutional admission rejected';
  end if;
  insert into public.profiles (id, email, kind) values (new.id, incoming_email, 'institutional')
  on conflict (id) do nothing;
  insert into public.role_assignments (profile_id, role, reason)
  values (new.id, 'student', 'Default role assigned at verified institutional admission');
  return new;
end;
$$;
