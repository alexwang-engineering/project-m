-- Audited, optimistic, atomic page mutations. Direct application writes remain
-- denied; callers use these functions so page and tag authorization is checked
-- against one transaction snapshot.

create or replace function public.page_path(target_parent uuid, target_slug text)
returns text language plpgsql stable security definer set search_path = '' as $$
declare parent_path text;
begin
  if target_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception using errcode = '22023', message = 'invalid page slug';
  end if;
  if target_parent is null then return '/' || target_slug; end if;
  select p.canonical_url into parent_path from public.pages p where p.id = target_parent and p.lifecycle <> 'archived';
  if parent_path is null then raise exception using errcode = '23503', message = 'active parent page not found'; end if;
  return parent_path || '/' || target_slug;
end;
$$;

create or replace function public.assert_valid_content(payload jsonb, schema_version integer)
returns void language plpgsql immutable set search_path = '' as $$
begin
  if schema_version <> 1 then raise exception using errcode = '22023', message = 'unsupported content schema version'; end if;
  if jsonb_typeof(payload) <> 'object' then raise exception using errcode = '22023', message = 'content must be a JSON object'; end if;
  if pg_column_size(payload) > 1048576 then raise exception using errcode = '22001', message = 'content exceeds 1 MiB'; end if;
end;
$$;

create or replace function public.assert_can_assign_tags(tag_ids uuid[], actor uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
declare requested_count integer;
begin
  if tag_ids is null or cardinality(tag_ids) = 0 then
    raise exception using errcode = '22023', message = 'at least one audience tag is required';
  end if;
  select count(distinct value) into requested_count from unnest(tag_ids) value;
  if requested_count <> cardinality(tag_ids) then
    raise exception using errcode = '22023', message = 'duplicate audience tags';
  end if;
  if public.has_system_role('institution_admin', actor) then return; end if;
  if not public.has_system_role('teacher', actor) then
    raise exception using errcode = '42501', message = 'teacher or administrator role required';
  end if;
  if exists (
    select 1 from unnest(tag_ids) requested(tag_id)
    where not public.has_tag_membership(
      requested.tag_id,
      array['teacher','manager']::public.membership_role[],
      actor
    )
  ) then
    raise exception using errcode = '42501', message = 'actor does not manage every audience tag';
  end if;
end;
$$;

create or replace function public.create_page(
  page_title text,
  page_slug text,
  page_parent_id uuid,
  page_content jsonb,
  page_content_schema_version integer,
  audience_tag_ids uuid[],
  correlation_id uuid default null
) returns public.pages
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); created public.pages; tag_id uuid;
begin
  if not public.is_active_principal(actor) then raise exception using errcode = '42501', message = 'active principal required'; end if;
  if nullif(btrim(page_title), '') is null or length(page_title) > 240 then
    raise exception using errcode = '22023', message = 'page title is required and must not exceed 240 characters';
  end if;
  perform public.assert_valid_content(page_content, page_content_schema_version);
  perform public.assert_can_assign_tags(audience_tag_ids, actor);

  insert into public.pages (
    parent_id, slug, canonical_url, title, content_json, content_schema_version, author_id
  ) values (
    page_parent_id, page_slug, public.page_path(page_parent_id, page_slug),
    btrim(page_title), page_content, page_content_schema_version, actor
  ) returning * into created;

  foreach tag_id in array audience_tag_ids loop
    insert into public.page_tags (page_id, tag_id, added_by) values (created.id, tag_id, actor);
  end loop;
  insert into public.page_revisions (page_id, version, title, content_json, content_schema_version, lifecycle, actor_id)
  values (created.id, created.version, created.title, created.content_json, created.content_schema_version, created.lifecycle, actor);
  insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, after_data)
  values (actor, 'page.created', 'page', created.id, correlation_id, 'app', jsonb_build_object('version', created.version, 'tags', audience_tag_ids));
  return created;
end;
$$;

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
declare actor uuid := auth.uid(); current_page public.pages; updated_page public.pages; old_path text; moved_paths jsonb; tag_id uuid; explicitly_granted boolean;
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
  old_path := current_page.canonical_url;
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

  if old_path <> updated_page.canonical_url then
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
    jsonb_build_object('version', current_page.version, 'path', old_path),
    jsonb_build_object('version', updated_page.version, 'path', updated_page.canonical_url, 'tags', audience_tag_ids)
  );
  return updated_page;
end;
$$;

create or replace function public.set_page_lifecycle(
  target_page_id uuid,
  expected_version bigint,
  next_state public.content_state,
  make_public boolean default false,
  correlation_id uuid default null
) returns public.pages
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); current_page public.pages; updated_page public.pages;
begin
  select * into current_page from public.pages where id = target_page_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'page not found'; end if;
  if current_page.version <> expected_version then raise exception using errcode = '40001', message = 'page version conflict'; end if;
  if not (
    public.can_edit_page(target_page_id)
    or (current_page.lifecycle = 'archived' and public.has_system_role('institution_admin', actor))
  ) then raise exception using errcode = '42501', message = 'page edit not permitted'; end if;
  if next_state = 'published' and not (
    public.has_system_role('institution_admin', actor) or
    not exists (select 1 from public.page_tags pt where pt.page_id = target_page_id and not public.has_tag_membership(
      pt.tag_id, array['teacher','manager']::public.membership_role[], actor
    ))
  ) then raise exception using errcode = '42501', message = 'publishing requires authority over every audience tag'; end if;

  update public.pages set
    lifecycle = next_state,
    is_public = case when next_state = 'published' then make_public else false end,
    published_at = case when next_state = 'published' then coalesce(published_at, now()) else null end,
    archived_at = case when next_state = 'archived' then now() else null end,
    version = version + 1
  where id = target_page_id returning * into updated_page;
  insert into public.page_revisions (page_id, version, title, content_json, content_schema_version, lifecycle, actor_id)
  values (updated_page.id, updated_page.version, updated_page.title, updated_page.content_json, updated_page.content_schema_version, updated_page.lifecycle, actor);
  insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, before_data, after_data)
  values (actor, 'page.lifecycle_changed', 'page', target_page_id, correlation_id, 'app',
    jsonb_build_object('state', current_page.lifecycle, 'version', current_page.version),
    jsonb_build_object('state', updated_page.lifecycle, 'version', updated_page.version, 'public', updated_page.is_public));
  return updated_page;
end;
$$;

revoke all on function public.page_path(uuid, text) from public;
revoke all on function public.assert_valid_content(jsonb, integer) from public;
revoke all on function public.assert_can_assign_tags(uuid[], uuid) from public;
revoke all on function public.create_page(text, text, uuid, jsonb, integer, uuid[], uuid) from public;
revoke all on function public.update_page(uuid, bigint, text, text, uuid, jsonb, integer, uuid[], uuid) from public;
revoke all on function public.set_page_lifecycle(uuid, bigint, public.content_state, boolean, uuid) from public;
grant execute on function public.create_page(text, text, uuid, jsonb, integer, uuid[], uuid) to authenticated;
grant execute on function public.update_page(uuid, bigint, text, text, uuid, jsonb, integer, uuid[], uuid) to authenticated;
grant execute on function public.set_page_lifecycle(uuid, bigint, public.content_state, boolean, uuid) to authenticated;
