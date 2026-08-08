-- Staff management authority is current and cohort-complete: creator
-- attribution is not a permanent permission, and owning one of several tags
-- never grants access to the other cohorts.
create or replace function public.can_read_assignment(target_assignment uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.assignments a
    where a.id = target_assignment and a.archived_at is null
      and public.is_active_principal(auth.uid())
      and (
        public.has_system_role('institution_admin', auth.uid())
        or exists (
          select 1 from public.assignment_tags at
          where at.assignment_id = a.id
            and public.has_tag_membership(at.tag_id, array['member','teacher','manager']::public.membership_role[], auth.uid())
        )
      )
  );
$$;

create or replace function public.can_manage_assignment(target_assignment uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_system_role('institution_admin', auth.uid()) or (
    public.has_system_role('teacher', auth.uid())
    and exists (select 1 from public.assignment_tags where assignment_id = target_assignment)
    and not exists (
      select 1 from public.assignment_tags at
      where at.assignment_id = target_assignment
        and not public.has_tag_membership(at.tag_id, array['teacher','manager']::public.membership_role[], auth.uid())
    )
    and exists (
      select 1 from public.assignments a
      where a.id = target_assignment and a.archived_at is null
    )
  );
$$;

create or replace function public.can_read_quiz(target_quiz uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.quizzes q
    where q.id = target_quiz and q.archived_at is null
      and public.is_active_principal(auth.uid())
      and (
        public.has_system_role('institution_admin', auth.uid())
        or exists (
          select 1 from public.quiz_tags qt
          where qt.quiz_id = q.id
            and public.has_tag_membership(qt.tag_id, array['member','teacher','manager']::public.membership_role[], auth.uid())
        )
      )
  );
$$;

create or replace function public.can_manage_quiz(target_quiz uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_system_role('institution_admin', auth.uid()) or (
    public.has_system_role('teacher', auth.uid())
    and exists (select 1 from public.quiz_tags where quiz_id = target_quiz)
    and not exists (
      select 1 from public.quiz_tags qt
      where qt.quiz_id = target_quiz
        and not public.has_tag_membership(qt.tag_id, array['teacher','manager']::public.membership_role[], auth.uid())
    )
    and exists (
      select 1 from public.quizzes q
      where q.id = target_quiz and q.archived_at is null
    )
  );
$$;

create or replace function public.can_read_calendar_event(target_event uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.calendar_events e
    where e.id = target_event and e.archived_at is null
      and public.is_active_principal(auth.uid())
      and (
        e.is_broadcast
        or public.has_system_role('institution_admin', auth.uid())
        or exists (
          select 1 from public.calendar_event_tags cet
          where cet.event_id = e.id
            and public.has_tag_membership(cet.tag_id, array['member','teacher','manager']::public.membership_role[], auth.uid())
        )
      )
  );
$$;

create or replace function public.can_manage_calendar_event(target_event uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_system_role('institution_admin', auth.uid()) or (
    public.has_system_role('teacher', auth.uid())
    and exists (select 1 from public.calendar_event_tags where event_id = target_event)
    and not exists (
      select 1 from public.calendar_event_tags cet
      where cet.event_id = target_event
        and not public.has_tag_membership(cet.tag_id, array['teacher','manager']::public.membership_role[], auth.uid())
    )
    and exists (
      select 1 from public.calendar_events e
      where e.id = target_event and not e.is_broadcast and e.archived_at is null
    )
  );
$$;

create or replace function public.can_read_announcement(target_announcement uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.announcements a
    where a.id = target_announcement and a.archived_at is null
      and public.is_active_principal(auth.uid())
      and (
        a.is_broadcast
        or public.has_system_role('institution_admin', auth.uid())
        or exists (
          select 1 from public.announcement_tags at
          where at.announcement_id = a.id
            and public.has_tag_membership(at.tag_id, array['member','teacher','manager']::public.membership_role[], auth.uid())
        )
      )
  );
$$;

create or replace function public.can_manage_announcement(target_announcement uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_system_role('institution_admin', auth.uid()) or (
    public.has_system_role('teacher', auth.uid())
    and exists (select 1 from public.announcement_tags where announcement_id = target_announcement)
    and not exists (
      select 1 from public.announcement_tags at
      where at.announcement_id = target_announcement
        and not public.has_tag_membership(at.tag_id, array['teacher','manager']::public.membership_role[], auth.uid())
    )
    and exists (
      select 1 from public.announcements a
      where a.id = target_announcement and not a.is_broadcast and a.archived_at is null
    )
  );
$$;

create or replace function public.can_access_bank_item(target_item uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_system_role('institution_admin', auth.uid()) or (
    public.has_system_role('teacher', auth.uid())
    and exists (select 1 from public.question_bank_item_tags where item_id = target_item)
    and not exists (
      select 1 from public.question_bank_item_tags it
      where it.item_id = target_item
        and not public.has_tag_membership(it.tag_id, array['teacher','manager']::public.membership_role[], auth.uid())
    )
    and exists (
      select 1 from public.question_bank_items i
      where i.id = target_item and i.archived_at is null
    )
  );
$$;

-- Narrow, audited closure operations preserve history while making access
-- revocable without disabling the whole person.
create or replace function public.revoke_system_role(
  target_profile uuid,
  revoked_role public.system_role,
  revocation_reason text,
  correlation_id uuid default null
) returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); changed integer;
begin
  perform public.assert_institution_admin(actor);
  if nullif(btrim(revocation_reason), '') is null or length(btrim(revocation_reason)) > 1000 then
    raise exception using errcode = '22023', message = 'a revocation reason between 1 and 1000 characters is required';
  end if;
  if target_profile = actor and revoked_role = 'institution_admin' then
    raise exception using errcode = '22023', message = 'administrator cannot revoke own admin role';
  end if;
  if revoked_role = 'institution_admin' and not exists (
    select 1 from public.profiles p
    where p.id <> target_profile and public.has_system_role('institution_admin', p.id)
  ) then
    raise exception using errcode = '22023', message = 'at least one active institution administrator is required';
  end if;

  update public.role_assignments
  set valid_until = now()
  where profile_id = target_profile and role = revoked_role
    and valid_from <= now() and (valid_until is null or valid_until > now());
  get diagnostics changed = row_count;
  if changed = 0 then raise exception using errcode = 'P0002', message = 'active role assignment not found'; end if;

  insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, after_data)
  values (actor, 'role.revoked', 'profile', target_profile, correlation_id, 'app',
    jsonb_build_object('role', revoked_role, 'reason', btrim(revocation_reason)));
end;
$$;

create or replace function public.revoke_tag_membership(
  target_profile uuid,
  target_tag uuid,
  revoked_membership_role public.membership_role,
  revocation_reason text,
  correlation_id uuid default null
) returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); changed integer;
begin
  perform public.assert_institution_admin(actor);
  if nullif(btrim(revocation_reason), '') is null or length(btrim(revocation_reason)) > 1000 then
    raise exception using errcode = '22023', message = 'a revocation reason between 1 and 1000 characters is required';
  end if;

  update public.tag_memberships
  set valid_until = now()
  where profile_id = target_profile and tag_id = target_tag
    and membership_role = revoked_membership_role
    and valid_from <= now() and (valid_until is null or valid_until > now());
  get diagnostics changed = row_count;
  if changed = 0 then raise exception using errcode = 'P0002', message = 'active tag membership not found'; end if;

  insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, after_data)
  values (actor, 'tag_membership.revoked', 'profile', target_profile, correlation_id, 'app',
    jsonb_build_object('tag_id', target_tag, 'membership_role', revoked_membership_role,
      'reason', btrim(revocation_reason)));
end;
$$;

revoke all on function public.revoke_system_role(uuid, public.system_role, text, uuid) from public;
revoke all on function public.revoke_tag_membership(uuid, uuid, public.membership_role, text, uuid) from public;
grant execute on function public.revoke_system_role(uuid, public.system_role, text, uuid) to authenticated;
grant execute on function public.revoke_tag_membership(uuid, uuid, public.membership_role, text, uuid) to authenticated;

-- If an attested guardian email already has an auth identity but no profile,
-- provision it during linking because the auth.users INSERT trigger will not
-- run a second time.
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
  if not public.has_system_role('student', target_pupil_id)
     or not exists (
       select 1 from public.profiles
       where id = target_pupil_id and kind = 'institutional' and state = 'active'
     ) then
    raise exception using errcode = 'P0002', message = 'active pupil not found';
  end if;
  normalized_email := lower(btrim(guardian_email));
  if normalized_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception using errcode = '22023', message = 'a valid guardian email address is required';
  end if;
  if exists (select 1 from public.profiles where email = normalized_email and kind <> 'guardian') then
    raise exception using errcode = '22023', message = 'this email belongs to a non-guardian account';
  end if;
  if nullif(btrim(link_reason), '') is null or length(btrim(link_reason)) > 1000 then
    raise exception using errcode = '22023', message = 'a reason between 1 and 1000 characters is required to link a guardian';
  end if;

  insert into public.profiles (id, email, kind)
  select u.id, normalized_email, 'guardian'::public.principal_kind
  from auth.users u
  where lower(btrim(u.email)) = normalized_email
    and not exists (select 1 from public.profiles p where p.id = u.id)
  on conflict (id) do nothing;

  insert into public.guardian_links (pupil_id, guardian_email, created_by, reason)
  values (target_pupil_id, normalized_email, actor, btrim(link_reason))
  returning * into created;

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
