-- Package S (parent/guardian access), scoped by ADR-013. Genuinely new
-- admission path - profiles.kind = 'guardian' has existed unused in the
-- enum since the very first migration. Admission is admin-attested and
-- fail-closed, the same trust model already used for tag creation and role
-- assignment, not MIS/SIS-verified (no such integration exists). Read
-- access is deliberately isolated in new SECURITY DEFINER functions rather
-- than widening any existing RLS policy, given how sensitive this data
-- category is per the threat model.

create table public.guardian_links (
  id uuid primary key default gen_random_uuid(),
  pupil_id uuid not null references public.profiles(id) on delete cascade,
  guardian_email text not null,
  guardian_profile_id uuid references public.profiles(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  reason text not null,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  revoked_at timestamptz,
  constraint guardian_links_email_normalized check (guardian_email = lower(btrim(guardian_email))),
  constraint guardian_links_reason_not_blank check (btrim(reason) <> '')
);
-- Only one active link per (pupil, guardian email) pair - re-linking after
-- a revoke is a new row, preserving the old one as an honest audit record.
create unique index guardian_links_active_unique on public.guardian_links (pupil_id, guardian_email) where revoked_at is null;
create index guardian_links_guardian_idx on public.guardian_links (guardian_profile_id) where revoked_at is null;

create or replace function public.link_guardian(
  target_pupil_id uuid,
  guardian_email text,
  link_reason text,
  correlation_id uuid default null
) returns public.guardian_links
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); normalized_email text; created public.guardian_links;
begin
  perform public.assert_institution_admin(actor);
  if not exists (select 1 from public.profiles where id = target_pupil_id) then
    raise exception using errcode = 'P0002', message = 'pupil not found';
  end if;
  normalized_email := lower(btrim(guardian_email));
  if normalized_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception using errcode = '22023', message = 'a valid guardian email address is required';
  end if;
  if exists (select 1 from public.profiles where email = normalized_email and kind <> 'guardian') then
    raise exception using errcode = '22023', message = 'this email belongs to a non-guardian account';
  end if;
  if nullif(btrim(link_reason), '') is null then
    raise exception using errcode = '22023', message = 'a reason is required to link a guardian';
  end if;

  insert into public.guardian_links (pupil_id, guardian_email, created_by, reason)
  values (target_pupil_id, normalized_email, actor, btrim(link_reason))
  returning * into created;

  -- Activate immediately if the guardian already has an account (e.g. a
  -- second child added for an already-linked parent) - provision_admitted_
  -- guardian only fires at signup time, which has already happened here.
  update public.guardian_links gl
  set guardian_profile_id = p.id, activated_at = now()
  from public.profiles p
  where gl.id = created.id and p.email = normalized_email and p.kind = 'guardian';
  select * into created from public.guardian_links where id = created.id;

  insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, after_data)
  values (actor, 'guardian.linked', 'guardian_link', created.id, correlation_id, 'app',
    jsonb_build_object('pupil_id', target_pupil_id, 'guardian_email', normalized_email));
  return created;
end;
$$;
revoke all on function public.link_guardian(uuid, text, text, uuid) from public;
grant execute on function public.link_guardian(uuid, text, text, uuid) to authenticated;

create or replace function public.revoke_guardian_link(
  target_link_id uuid,
  correlation_id uuid default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  perform public.assert_institution_admin(actor);
  if not exists (select 1 from public.guardian_links where id = target_link_id and revoked_at is null) then
    raise exception using errcode = 'P0002', message = 'guardian link not found';
  end if;
  update public.guardian_links set revoked_at = now() where id = target_link_id;
  insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, after_data)
  values (actor, 'guardian.revoked', 'guardian_link', target_link_id, correlation_id, 'app',
    jsonb_build_object('revoked_at', now()));
end;
$$;
revoke all on function public.revoke_guardian_link(uuid, uuid) from public;
grant execute on function public.revoke_guardian_link(uuid, uuid) to authenticated;

-- Fires on every new auth.users row, regardless of provider. Found by live
-- testing (not by static review): an earlier version of this function
-- branched on provider = 'email' and rejected any unmatched signup
-- outright, which broke this project's own established way of seeding
-- demo staff accounts (GoTrue's admin-create-user API also sets
-- provider='email', since there is no real Entra flow available locally -
-- it is not exclusively how guardians sign in). The correct boundary is
-- narrower: only ever act (grant a guardian profile) when the email
-- matches a pre-authorized, not-yet-activated guardian_links row. No
-- match, any provider: pass through untouched. The auth.users insert
-- succeeds either way; deny-by-default is enforced at the data-access
-- layer (assert_guardian_of and every guardian_view_* function), not by
-- rejecting account creation itself - an identity with no profile has no
-- access to anything in this application regardless of how it signed in.
create or replace function public.provision_admitted_guardian()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare incoming_email text := lower(btrim(new.email)); created public.profiles;
begin
  if not exists (
    select 1 from public.guardian_links
    where guardian_email = incoming_email and revoked_at is null and guardian_profile_id is null
  ) then
    return new;
  end if;

  insert into public.profiles (id, email, kind) values (new.id, incoming_email, 'guardian')
  returning * into created;

  update public.guardian_links
  set guardian_profile_id = created.id, activated_at = now()
  where guardian_email = incoming_email and revoked_at is null and guardian_profile_id is null;

  return new;
end;
$$;

drop trigger if exists provision_admitted_guardian on auth.users;
create trigger provision_admitted_guardian
after insert on auth.users for each row execute function public.provision_admitted_guardian();
-- Postgres grants EXECUTE to PUBLIC by default on any new function unless
-- explicitly revoked - the same footgun the institutional trigger's own
-- migration already revoked against. A trigger function is never called
-- directly by client code, but 002_security_invariants.sql's blanket
-- "no security-definer function is PUBLIC-executable" check rightly does
-- not special-case that away, so this needs the same explicit revoke.
revoke all on function public.provision_admitted_guardian() from public, anon, authenticated;

-- Bug found by design review (ADR-013), not by running anything - Entra
-- has never been enabled in this environment. Once institutional_auth_
-- config.enabled = true, this trigger previously rejected *any* non-azure
-- signup outright, including a legitimate guardian magic-link, before
-- provision_admitted_guardian above ever got a chance to run. Fixed by
-- deferring non-azure signups entirely rather than rejecting them here.
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
  insert into public.profiles (id, email, kind) values (new.id, incoming_email, 'institutional');
  insert into public.role_assignments (profile_id, role, reason)
  values (new.id, 'student', 'Default role assigned at verified institutional admission');
  return new;
end;
$$;

create or replace function public.assert_guardian_of(target_pupil_id uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.guardian_links
    where guardian_profile_id = auth.uid() and pupil_id = target_pupil_id and revoked_at is null
  ) then
    raise exception using errcode = '42501', message = 'you are not an authorized guardian for this pupil';
  end if;
end;
$$;
revoke all on function public.assert_guardian_of(uuid) from public;
grant execute on function public.assert_guardian_of(uuid) to authenticated;

create or replace function public.list_my_pupils()
returns table (pupil_id uuid, pupil_email text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.email
  from public.guardian_links gl
  join public.profiles p on p.id = gl.pupil_id
  where gl.guardian_profile_id = auth.uid() and gl.revoked_at is null
  order by p.email;
$$;
revoke all on function public.list_my_pupils() from public;
grant execute on function public.list_my_pupils() to authenticated;

create or replace function public.guardian_view_calendar(target_pupil_id uuid)
returns table (
  item_id uuid,
  item_kind text,
  title text,
  occurs_at timestamptz,
  ends_at timestamptz,
  is_broadcast boolean
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_guardian_of(target_pupil_id);
  return query
    select a.id as item_id, 'assignment'::text as item_kind, a.title, a.due_at as occurs_at,
      null::timestamptz as ends_at, false as is_broadcast
    from public.assignments a
    where a.due_at is not null and a.archived_at is null
      and exists (
        select 1 from public.assignment_tags atg
        where atg.assignment_id = a.id
          and public.has_tag_membership(atg.tag_id, array['member','teacher','manager']::public.membership_role[], target_pupil_id)
      )
  union all
    select q.id, 'quiz'::text, q.title, q.due_at, null::timestamptz, false
    from public.quizzes q
    where q.due_at is not null and q.archived_at is null
      and exists (
        select 1 from public.quiz_tags qt
        where qt.quiz_id = q.id
          and public.has_tag_membership(qt.tag_id, array['member','teacher','manager']::public.membership_role[], target_pupil_id)
      )
  union all
    select e.id, 'event'::text, e.title, e.starts_at, e.ends_at, e.is_broadcast
    from public.calendar_events e
    where e.archived_at is null
      and (
        e.is_broadcast
        or exists (
          select 1 from public.calendar_event_tags cet
          where cet.event_id = e.id
            and public.has_tag_membership(cet.tag_id, array['member','teacher','manager']::public.membership_role[], target_pupil_id)
        )
      )
  order by occurs_at asc;
end;
$$;
revoke all on function public.guardian_view_calendar(uuid) from public;
grant execute on function public.guardian_view_calendar(uuid) to authenticated;

create or replace function public.guardian_view_announcements(target_pupil_id uuid)
returns table (
  item_id uuid,
  title text,
  body text,
  is_broadcast boolean,
  created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_guardian_of(target_pupil_id);
  return query
    select an.id, an.title, an.body, an.is_broadcast, an.created_at
    from public.announcements an
    where an.archived_at is null
      and (
        an.is_broadcast
        or exists (
          select 1 from public.announcement_tags ant
          where ant.announcement_id = an.id
            and public.has_tag_membership(ant.tag_id, array['member','teacher','manager']::public.membership_role[], target_pupil_id)
        )
      )
    order by an.created_at desc;
end;
$$;
revoke all on function public.guardian_view_announcements(uuid) from public;
grant execute on function public.guardian_view_announcements(uuid) to authenticated;

-- No new "release" gate to build: a grade is already visible to its
-- student the instant grade_assignment_submission runs. This just extends
-- that same authorization to a verified guardian.
create or replace function public.guardian_view_grades(target_pupil_id uuid)
returns table (
  submission_id uuid,
  assignment_title text,
  grade numeric,
  grade_feedback text,
  graded_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_guardian_of(target_pupil_id);
  return query
    select s.id, a.title, s.grade, s.grade_feedback, s.graded_at
    from public.assignment_submissions s
    join public.assignments a on a.id = s.assignment_id
    where s.student_id = target_pupil_id and s.grade is not null
    order by s.graded_at desc nulls last;
end;
$$;
revoke all on function public.guardian_view_grades(uuid) from public;
grant execute on function public.guardian_view_grades(uuid) to authenticated;

alter table public.guardian_links enable row level security;
-- Only admin needs raw table access (to manage links in /admin); a
-- guardian always goes through list_my_pupils()/guardian_view_* instead of
-- reading this table directly.
--
-- Calls current_principal_is_admin(), not has_system_role() directly - RLS
-- policy expressions run under the querying role's own privileges, not any
-- function-owner elevation, so a bare internal helper call here fails with
-- "permission denied" the moment Postgres plans the policy for a
-- non-superuser role. has_system_role itself was never granted EXECUTE to
-- authenticated; only its wrapper functions were. Same bug class this
-- project has hit (and documented) at least twice before, in
-- assignment_submissions_read and can_manage_assignment.
create policy guardian_links_read_admin on public.guardian_links for select to authenticated
using (public.current_principal_is_admin());
grant select on public.guardian_links to authenticated;
