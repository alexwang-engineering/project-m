-- Closes a real gap found while verifying Package K: no RPC existed to
-- create a tag at all, despite tags being the entire organizing model of
-- this LMS. Institution-admin only, per explicit product owner decision
-- (2026-08-07): tag/class codes come from the school's own timetabling
-- process, not ad-hoc from individual teachers, so this stays centrally
-- controlled - the same authorization tier as the other four admin RPCs in
-- 20260804192000_audited_administration.sql, which this file otherwise
-- mirrors exactly.
create or replace function public.create_tag(
  new_tag_name text,
  new_display_name text,
  creation_reason text default null,
  correlation_id uuid default null
) returns public.tags
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); normalized_name text; created public.tags;
begin
  perform public.assert_institution_admin(actor);

  normalized_name := upper(btrim(new_tag_name));
  if normalized_name !~ '^[A-Z0-9][A-Z0-9_-]{1,31}$' then
    raise exception using errcode = '22023',
      message = 'tag name must be 2-32 characters: letters, digits, underscore, or hyphen, starting with a letter or digit';
  end if;
  if nullif(btrim(new_display_name), '') is null or length(new_display_name) > 200 then
    raise exception using errcode = '22023', message = 'display name is required and must not exceed 200 characters';
  end if;
  if exists (select 1 from public.tags t where upper(t.tag_name) = normalized_name) then
    raise exception using errcode = '23505', message = 'a tag with this name already exists';
  end if;

  insert into public.tags (tag_name, display_name, created_by)
  values (normalized_name, btrim(new_display_name), actor)
  returning * into created;

  insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, after_data)
  values (actor, 'tag.created', 'tag', created.id, correlation_id, 'app',
    jsonb_build_object('tag_name', created.tag_name, 'display_name', created.display_name,
      'reason', nullif(btrim(creation_reason), '')));
  return created;
end;
$$;

revoke all on function public.create_tag(text, text, text, uuid) from public;
grant execute on function public.create_tag(text, text, text, uuid) to authenticated;
