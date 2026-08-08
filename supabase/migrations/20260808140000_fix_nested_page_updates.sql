-- Preserve hierarchy when editing nested pages and make path moves create redirects.
-- The original local variable `old_path` collided with canonical_redirects.old_path.
create or replace function public.update_page(
  target_page_id uuid,
  expected_version bigint,
  page_title text,
  page_slug text,
  page_parent_id uuid,
  page_content jsonb,
  page_content_schema_version integer,
  audience_tag_ids uuid[],
  correlation_id uuid default null
) returns public.pages
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); current_page public.pages; updated_page public.pages; original_path text; moved_paths jsonb; tag_id uuid; explicitly_granted boolean;
begin
  select * into current_page from public.pages where id = target_page_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'page not found'; end if;
  if current_page.version <> expected_version then raise exception using errcode = '40001', message = 'page version conflict'; end if;
  if not public.can_edit_page(target_page_id) then raise exception using errcode = '42501', message = 'page edit not permitted'; end if;
  select exists (
    select 1 from public.page_editors e where e.page_id = target_page_id and e.profile_id = actor
      and (e.valid_until is null or e.valid_until > now())
  ) into explicitly_granted;
  if not explicitly_granted and not public.has_system_role('institution_admin', actor) then
    perform public.assert_can_assign_tags(audience_tag_ids, actor);
  elsif audience_tag_ids is null or cardinality(audience_tag_ids) = 0 then
    raise exception using errcode = '22023', message = 'at least one audience tag is required';
  end if;
  perform public.assert_valid_content(page_content, page_content_schema_version);
  if nullif(btrim(page_title), '') is null or length(page_title) > 240 then
    raise exception using errcode = '22023', message = 'invalid page title';
  end if;
  original_path := current_page.canonical_url;
  with recursive subtree as (
    select p.id, p.canonical_url from public.pages p where p.id = target_page_id
    union all
    select child.id, child.canonical_url
    from public.pages child join subtree parent on child.parent_id = parent.id
  ) select jsonb_object_agg(id::text, canonical_url) into moved_paths from subtree;

  update public.pages set
    parent_id = page_parent_id,
    slug = page_slug,
    canonical_url = public.page_path(page_parent_id, page_slug),
    title = btrim(page_title),
    content_json = page_content,
    content_schema_version = page_content_schema_version,
    version = version + 1
  where id = target_page_id returning * into updated_page;

  if original_path <> updated_page.canonical_url then
    with recursive descendant_paths as (
      select child.id, updated_page.canonical_url || '/' || child.slug as next_path
      from public.pages child where child.parent_id = target_page_id
      union all
      select child.id, parent.next_path || '/' || child.slug
      from public.pages child join descendant_paths parent on child.parent_id = parent.id
    )
    update public.pages p set canonical_url = paths.next_path
    from descendant_paths paths where p.id = paths.id;

    insert into public.canonical_redirects (old_path, page_id, created_by)
    select previous.value, p.id, actor
    from jsonb_each_text(moved_paths) previous
    join public.pages p on p.id = previous.key::uuid
    where previous.value <> p.canonical_url
    on conflict (old_path) do update set
      page_id = excluded.page_id,
      created_by = excluded.created_by,
      created_at = now();
  end if;

  delete from public.page_tags where page_id = target_page_id;
  foreach tag_id in array audience_tag_ids loop
    insert into public.page_tags (page_id, tag_id, added_by) values (target_page_id, tag_id, actor);
  end loop;
  insert into public.page_revisions (page_id, version, title, content_json, content_schema_version, lifecycle, actor_id)
  values (updated_page.id, updated_page.version, updated_page.title, updated_page.content_json, updated_page.content_schema_version, updated_page.lifecycle, actor);
  insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, before_data, after_data)
  values (
    actor, 'page.updated', 'page', target_page_id, correlation_id, 'app',
    jsonb_build_object('version', current_page.version, 'path', original_path),
    jsonb_build_object('version', updated_page.version, 'path', updated_page.canonical_url, 'tags', audience_tag_ids)
  );
  return updated_page;
end;
$$;
