-- Duplicate the current page snapshot through the same authorization and
-- validation path used for ordinary page creation.
create or replace function public.duplicate_page(
  target_page_id uuid,
  duplicate_title text,
  duplicate_slug text,
  correlation_id uuid default null
) returns public.pages
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  source_page public.pages;
  source_tags uuid[];
  duplicated public.pages;
begin
  select * into source_page from public.pages where id = target_page_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'page not found';
  end if;
  if not public.can_edit_page(target_page_id) then
    raise exception using errcode = '42501', message = 'page edit not permitted';
  end if;

  select array_agg(pt.tag_id order by pt.tag_id) into source_tags
  from public.page_tags pt where pt.page_id = target_page_id;
  perform public.assert_can_assign_tags(source_tags, actor);

  duplicated := public.create_page(
    duplicate_title,
    duplicate_slug,
    source_page.parent_id,
    source_page.content_json,
    source_page.content_schema_version,
    source_tags,
    correlation_id
  );

  insert into public.audit_events (
    actor_id, action, target_type, target_id, correlation_id, source, after_data
  ) values (
    actor, 'page.duplicated', 'page', duplicated.id, correlation_id, 'app',
    jsonb_build_object('source_page_id', target_page_id, 'version', duplicated.version)
  );
  return duplicated;
end;
$$;

revoke all on function public.duplicate_page(uuid, text, text, uuid) from public;
grant execute on function public.duplicate_page(uuid, text, text, uuid) to authenticated;
