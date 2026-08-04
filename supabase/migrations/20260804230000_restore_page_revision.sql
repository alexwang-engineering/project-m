-- Restoring never rewrites history: it copies an old snapshot into a new draft
-- version, preserving the current URL, hierarchy, tags, and prior revisions.

create or replace function public.restore_page_revision(
  target_page_id uuid,
  target_revision_id uuid,
  expected_version bigint,
  correlation_id uuid default null
) returns public.pages
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); current_page public.pages; source_revision public.page_revisions; restored public.pages;
begin
  select * into current_page from public.pages where id = target_page_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'page not found'; end if;
  if current_page.version <> expected_version then
    raise exception using errcode = '40001', message = 'page version conflict';
  end if;
  if not public.can_edit_page(target_page_id) then
    raise exception using errcode = '42501', message = 'page edit not permitted';
  end if;
  select * into source_revision from public.page_revisions
  where id = target_revision_id and page_id = target_page_id;
  if not found then raise exception using errcode = 'P0002', message = 'revision not found'; end if;

  update public.pages set
    title = source_revision.title,
    content_json = source_revision.content_json,
    content_schema_version = source_revision.content_schema_version,
    lifecycle = 'draft',
    is_public = false,
    published_at = null,
    archived_at = null,
    version = version + 1
  where id = target_page_id returning * into restored;

  insert into public.page_revisions (
    page_id, version, title, content_json, content_schema_version, lifecycle, actor_id
  ) values (
    restored.id, restored.version, restored.title, restored.content_json,
    restored.content_schema_version, restored.lifecycle, actor
  );
  insert into public.audit_events (
    actor_id, action, target_type, target_id, correlation_id, source, before_data, after_data
  ) values (
    actor, 'page.revision_restored', 'page', target_page_id, correlation_id, 'app',
    jsonb_build_object('version', current_page.version),
    jsonb_build_object('version', restored.version, 'source_revision_id', target_revision_id)
  );
  return restored;
end;
$$;

revoke all on function public.restore_page_revision(uuid, uuid, bigint, uuid) from public;
grant execute on function public.restore_page_revision(uuid, uuid, bigint, uuid) to authenticated;
