-- Narrow administration functions. Browser clients receive no direct write
-- policy on profiles, roles, memberships, editor grants, or audit events.

create or replace function public.assert_institution_admin(actor uuid default auth.uid())
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_system_role('institution_admin', actor) then
    raise exception using errcode = '42501', message = 'institution administrator role required';
  end if;
end;
$$;

create or replace function public.assign_system_role(
  target_profile uuid,
  assigned_role public.system_role,
  assignment_reason text,
  assignment_valid_until timestamptz default null,
  correlation_id uuid default null
) returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  perform public.assert_institution_admin(actor);
  if nullif(btrim(assignment_reason), '') is null then raise exception using errcode = '22023', message = 'assignment reason required'; end if;
  if assignment_valid_until is not null and assignment_valid_until <= now() then raise exception using errcode = '22023', message = 'role expiry must be in the future'; end if;
  insert into public.role_assignments (profile_id, role, granted_by, reason, valid_until)
  values (target_profile, assigned_role, actor, btrim(assignment_reason), assignment_valid_until);
  insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, after_data)
  values (actor, 'role.assigned', 'profile', target_profile, correlation_id, 'app',
    jsonb_build_object('role', assigned_role, 'valid_until', assignment_valid_until, 'reason', btrim(assignment_reason)));
end;
$$;

create or replace function public.assign_tag_membership(
  target_profile uuid,
  target_tag uuid,
  assigned_membership_role public.membership_role,
  assignment_source text,
  assignment_reason text default null,
  assignment_valid_until timestamptz default null,
  correlation_id uuid default null
) returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  perform public.assert_institution_admin(actor);
  if nullif(btrim(assignment_source), '') is null then raise exception using errcode = '22023', message = 'membership source required'; end if;
  if assignment_valid_until is not null and assignment_valid_until <= now() then raise exception using errcode = '22023', message = 'membership expiry must be in the future'; end if;
  insert into public.tag_memberships (
    profile_id, tag_id, membership_role, source, reason, granted_by, valid_until
  ) values (
    target_profile, target_tag, assigned_membership_role, btrim(assignment_source),
    nullif(btrim(assignment_reason), ''), actor, assignment_valid_until
  );
  insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, after_data)
  values (actor, 'tag_membership.assigned', 'profile', target_profile, correlation_id, 'app',
    jsonb_build_object('tag_id', target_tag, 'membership_role', assigned_membership_role,
      'valid_until', assignment_valid_until, 'source', btrim(assignment_source)));
end;
$$;

create or replace function public.grant_page_editor(
  target_page uuid,
  target_profile uuid,
  grant_reason text,
  grant_valid_until timestamptz default null,
  correlation_id uuid default null
) returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  perform public.assert_institution_admin(actor);
  if nullif(btrim(grant_reason), '') is null then raise exception using errcode = '22023', message = 'editor grant reason required'; end if;
  if grant_valid_until is not null and grant_valid_until <= now() then raise exception using errcode = '22023', message = 'editor grant expiry must be in the future'; end if;
  insert into public.page_editors (page_id, profile_id, granted_by, reason, valid_until)
  values (target_page, target_profile, actor, btrim(grant_reason), grant_valid_until)
  on conflict (page_id, profile_id) do update set
    granted_by = excluded.granted_by, reason = excluded.reason,
    valid_until = excluded.valid_until, created_at = now();
  insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, after_data)
  values (actor, 'page_editor.granted', 'page', target_page, correlation_id, 'app',
    jsonb_build_object('profile_id', target_profile, 'valid_until', grant_valid_until, 'reason', btrim(grant_reason)));
end;
$$;

create or replace function public.set_profile_state(
  target_profile uuid,
  next_state public.principal_state,
  change_reason text,
  correlation_id uuid default null
) returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); previous_state public.principal_state;
begin
  perform public.assert_institution_admin(actor);
  if target_profile = actor and next_state = 'disabled' then raise exception using errcode = '22023', message = 'administrator cannot disable own profile'; end if;
  if nullif(btrim(change_reason), '') is null then raise exception using errcode = '22023', message = 'state change reason required'; end if;
  select state into previous_state from public.profiles where id = target_profile for update;
  if not found then raise exception using errcode = 'P0002', message = 'profile not found'; end if;
  update public.profiles set state = next_state,
    disabled_at = case when next_state = 'disabled' then now() else null end
  where id = target_profile;
  insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, before_data, after_data)
  values (actor, 'profile.state_changed', 'profile', target_profile, correlation_id, 'app',
    jsonb_build_object('state', previous_state),
    jsonb_build_object('state', next_state, 'reason', btrim(change_reason)));
end;
$$;

revoke all on function public.assert_institution_admin(uuid) from public;
revoke all on function public.assign_system_role(uuid, public.system_role, text, timestamptz, uuid) from public;
revoke all on function public.assign_tag_membership(uuid, uuid, public.membership_role, text, text, timestamptz, uuid) from public;
revoke all on function public.grant_page_editor(uuid, uuid, text, timestamptz, uuid) from public;
revoke all on function public.set_profile_state(uuid, public.principal_state, text, uuid) from public;
grant execute on function public.assign_system_role(uuid, public.system_role, text, timestamptz, uuid) to authenticated;
grant execute on function public.assign_tag_membership(uuid, uuid, public.membership_role, text, text, timestamptz, uuid) to authenticated;
grant execute on function public.grant_page_editor(uuid, uuid, text, timestamptz, uuid) to authenticated;
grant execute on function public.set_profile_state(uuid, public.principal_state, text, uuid) to authenticated;
