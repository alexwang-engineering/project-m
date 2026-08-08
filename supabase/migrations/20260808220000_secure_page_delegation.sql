-- Page delegation never changes the teacher-only write boundary. Delegates may
-- edit one page, but only admins may use a delegation to change its audience.
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
  if exists (
    select 1 from unnest(tag_ids) requested(tag_id)
    left join public.tags t on t.id = requested.tag_id
    where t.id is null or not t.is_active
  ) then raise exception using errcode = '22023', message = 'audience tags must exist and be active'; end if;
  if public.has_system_role('institution_admin', actor) then return; end if;
  if not public.has_system_role('teacher', actor) then
    raise exception using errcode = '42501', message = 'teacher or administrator role required';
  end if;
  if exists (
    select 1 from unnest(tag_ids) requested(tag_id)
    where not public.has_tag_membership(
      requested.tag_id, array['teacher','manager']::public.membership_role[], actor
    )
  ) then raise exception using errcode = '42501', message = 'actor does not manage every audience tag'; end if;
end;
$$;

create or replace function public.can_read_page(target_page uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.pages p where p.id = target_page and (
      (p.lifecycle = 'published' and p.is_public)
      or (public.is_active_principal(auth.uid()) and p.lifecycle <> 'archived' and (
        public.has_system_role('institution_admin', auth.uid())
        or (public.has_system_role('teacher', auth.uid()) and (
          p.author_id = auth.uid()
          or exists (
            select 1 from public.page_editors e
            where e.page_id = p.id and e.profile_id = auth.uid()
              and (e.valid_until is null or e.valid_until > now())
          )
        ))
        or (p.lifecycle = 'published' and exists (
          select 1 from public.page_tags pt where pt.page_id = p.id
            and public.has_tag_membership(pt.tag_id, array['member','teacher','manager']::public.membership_role[], auth.uid())
        ))
      ))
    )
  );
$$;

create or replace function public.can_edit_page(target_page uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_active_principal(auth.uid()) and exists (
    select 1 from public.pages p where p.id = target_page and p.lifecycle <> 'archived' and (
      public.has_system_role('institution_admin', auth.uid())
      or (public.has_system_role('teacher', auth.uid()) and (
        exists (
          select 1 from public.page_editors e
          where e.page_id = p.id and e.profile_id = auth.uid()
            and (e.valid_until is null or e.valid_until > now())
        )
        or (exists (select 1 from public.page_tags pt where pt.page_id = p.id)
          and not exists (select 1 from public.page_tags pt where pt.page_id = p.id
            and not public.has_tag_membership(pt.tag_id, array['teacher','manager']::public.membership_role[], auth.uid())))
      ))
    )
  );
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
  if not public.is_active_principal(target_profile) or not public.has_system_role('teacher', target_profile) then
    raise exception using errcode = '22023', message = 'page editors must be active teachers';
  end if;
  if not exists (select 1 from public.pages where id = target_page) then
    raise exception using errcode = 'P0002', message = 'page not found';
  end if;
  if nullif(btrim(grant_reason), '') is null or length(btrim(grant_reason)) > 1000 then
    raise exception using errcode = '22023', message = 'a grant reason between 1 and 1000 characters is required';
  end if;
  if grant_valid_until is not null and grant_valid_until <= now() then
    raise exception using errcode = '22023', message = 'editor grant expiry must be in the future';
  end if;
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

create or replace function public.revoke_page_editor(
  target_page uuid,
  target_profile uuid,
  revocation_reason text,
  correlation_id uuid default null
) returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); changed integer;
begin
  perform public.assert_institution_admin(actor);
  if nullif(btrim(revocation_reason), '') is null or length(btrim(revocation_reason)) > 1000 then
    raise exception using errcode = '22023', message = 'a revocation reason between 1 and 1000 characters is required';
  end if;
  update public.page_editors set valid_until = now()
  where page_id = target_page and profile_id = target_profile
    and (valid_until is null or valid_until > now());
  get diagnostics changed = row_count;
  if changed = 0 then raise exception using errcode = 'P0002', message = 'active page-editor grant not found'; end if;
  insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, after_data)
  values (actor, 'page_editor.revoked', 'page', target_page, correlation_id, 'app',
    jsonb_build_object('profile_id', target_profile, 'reason', btrim(revocation_reason)));
end;
$$;

-- A delegate may keep the current audience; changing it requires normal
-- authority over every requested tag.
create or replace function public.assert_page_audience_change_allowed(
  target_page uuid,
  audience_tag_ids uuid[],
  actor uuid default auth.uid()
) returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if audience_tag_ids is null or cardinality(audience_tag_ids) = 0 then
    raise exception using errcode = '22023', message = 'at least one audience tag is required';
  end if;
  if public.has_system_role('institution_admin', actor) then return; end if;
  if exists (
    (select unnest(audience_tag_ids))
    except
    (select pt.tag_id from public.page_tags pt where pt.page_id = target_page)
  ) or exists (
    (select pt.tag_id from public.page_tags pt where pt.page_id = target_page)
    except
    (select unnest(audience_tag_ids))
  ) then
    perform public.assert_can_assign_tags(audience_tag_ids, actor);
  end if;
end;
$$;

create or replace function public.assert_page_hierarchy_change_allowed(
  target_page uuid,
  current_parent uuid,
  next_parent uuid,
  current_slug text,
  next_slug text
) returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if current_parent is not distinct from next_parent and current_slug = next_slug then return; end if;
  if next_parent is not null and not public.can_edit_page(next_parent) then
    raise exception using errcode = '42501', message = 'new parent page edit permission required';
  end if;
  if exists (
    with recursive descendants as (
      select p.id from public.pages p where p.parent_id = target_page
      union all
      select child.id from public.pages child join descendants parent on child.parent_id = parent.id
    )
    select 1 from descendants where not public.can_edit_page(id)
  ) then
    raise exception using errcode = '42501', message = 'page move requires edit permission for every descendant';
  end if;
end;
$$;

create or replace function public.create_page(
  page_title text, page_slug text, page_parent_id uuid, page_content jsonb,
  page_content_schema_version integer, audience_tag_ids uuid[], correlation_id uuid default null
) returns public.pages
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); created public.pages; tag_id uuid;
begin
  if not public.is_active_principal(actor) then raise exception using errcode = '42501', message = 'active principal required'; end if;
  if page_parent_id is not null and not public.can_edit_page(page_parent_id) then
    raise exception using errcode = '42501', message = 'parent page edit permission required';
  end if;
  if nullif(btrim(page_title), '') is null or length(page_title) > 240 then
    raise exception using errcode = '22023', message = 'page title is required and must not exceed 240 characters';
  end if;
  perform public.assert_valid_content(page_content, page_content_schema_version);
  perform public.assert_can_assign_tags(audience_tag_ids, actor);
  insert into public.pages (parent_id, slug, canonical_url, title, content_json, content_schema_version, author_id)
  values (page_parent_id, page_slug, public.page_path(page_parent_id, page_slug),
    btrim(page_title), page_content, page_content_schema_version, actor)
  returning * into created;
  foreach tag_id in array audience_tag_ids loop
    insert into public.page_tags (page_id, tag_id, added_by) values (created.id, tag_id, actor);
  end loop;
  insert into public.page_revisions (page_id, version, title, content_json, content_schema_version, lifecycle, actor_id)
  values (created.id, created.version, created.title, created.content_json, created.content_schema_version, created.lifecycle, actor);
  insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, after_data)
  values (actor, 'page.created', 'page', created.id, correlation_id, 'app',
    jsonb_build_object('version', created.version, 'tags', audience_tag_ids));
  return created;
end;
$$;

create or replace function public.update_page(
  target_page_id uuid, expected_version bigint, page_title text, page_slug text,
  page_parent_id uuid, page_content jsonb, page_content_schema_version integer,
  audience_tag_ids uuid[], correlation_id uuid default null
) returns public.pages
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); current_page public.pages; updated_page public.pages; original_path text; moved_paths jsonb; tag_id uuid;
begin
  select * into current_page from public.pages where id = target_page_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'page not found'; end if;
  if current_page.version <> expected_version then raise exception using errcode = '40001', message = 'page version conflict'; end if;
  if not public.can_edit_page(target_page_id) then raise exception using errcode = '42501', message = 'page edit not permitted'; end if;
  perform public.assert_page_audience_change_allowed(target_page_id, audience_tag_ids, actor);
  perform public.assert_page_hierarchy_change_allowed(
    target_page_id, current_page.parent_id, page_parent_id, current_page.slug, page_slug
  );
  perform public.assert_valid_content(page_content, page_content_schema_version);
  if nullif(btrim(page_title), '') is null or length(page_title) > 240 then
    raise exception using errcode = '22023', message = 'invalid page title';
  end if;
  original_path := current_page.canonical_url;
  with recursive subtree as (
    select p.id, p.canonical_url from public.pages p where p.id = target_page_id
    union all
    select child.id, child.canonical_url from public.pages child join subtree parent on child.parent_id = parent.id
  ) select jsonb_object_agg(id::text, canonical_url) into moved_paths from subtree;

  update public.pages set
    parent_id = page_parent_id, slug = page_slug,
    canonical_url = public.page_path(page_parent_id, page_slug),
    title = btrim(page_title), content_json = page_content,
    content_schema_version = page_content_schema_version, version = version + 1
  where id = target_page_id returning * into updated_page;

  if original_path <> updated_page.canonical_url then
    with recursive descendant_paths as (
      select child.id, updated_page.canonical_url || '/' || child.slug as next_path
      from public.pages child where child.parent_id = target_page_id
      union all
      select child.id, parent.next_path || '/' || child.slug
      from public.pages child join descendant_paths parent on child.parent_id = parent.id
    )
    update public.pages p set canonical_url = paths.next_path, version = p.version + 1
    from descendant_paths paths where p.id = paths.id;
    insert into public.page_revisions (page_id, version, title, content_json, content_schema_version, lifecycle, actor_id)
    select p.id, p.version, p.title, p.content_json, p.content_schema_version, p.lifecycle, actor
    from public.pages p where moved_paths ? p.id::text and p.id <> target_page_id;
    insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, before_data, after_data)
    select actor, 'page.path_changed', 'page', p.id, correlation_id, 'app',
      jsonb_build_object('version', p.version - 1, 'path', moved_paths ->> p.id::text),
      jsonb_build_object('version', p.version, 'path', p.canonical_url)
    from public.pages p where moved_paths ? p.id::text and p.id <> target_page_id;
    insert into public.canonical_redirects (old_path, page_id, created_by)
    select previous.value, p.id, actor from jsonb_each_text(moved_paths) previous
    join public.pages p on p.id = previous.key::uuid where previous.value <> p.canonical_url
    on conflict (old_path) do update set page_id = excluded.page_id, created_by = excluded.created_by, created_at = now();
  end if;

  delete from public.page_tags where page_id = target_page_id;
  foreach tag_id in array audience_tag_ids loop
    insert into public.page_tags (page_id, tag_id, added_by) values (target_page_id, tag_id, actor);
  end loop;
  insert into public.page_revisions (page_id, version, title, content_json, content_schema_version, lifecycle, actor_id)
  values (updated_page.id, updated_page.version, updated_page.title, updated_page.content_json, updated_page.content_schema_version, updated_page.lifecycle, actor);
  insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, before_data, after_data)
  values (actor, 'page.updated', 'page', target_page_id, correlation_id, 'app',
    jsonb_build_object('version', current_page.version, 'path', original_path),
    jsonb_build_object('version', updated_page.version, 'path', updated_page.canonical_url, 'tags', audience_tag_ids));
  return updated_page;
end;
$$;

create or replace function public.set_page_lifecycle(
  target_page_id uuid, expected_version bigint, next_state public.content_state,
  make_public boolean default false, correlation_id uuid default null
) returns public.pages
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); current_page public.pages; updated_page public.pages;
begin
  select * into current_page from public.pages where id = target_page_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'page not found'; end if;
  if current_page.version <> expected_version then raise exception using errcode = '40001', message = 'page version conflict'; end if;
  if not (public.can_edit_page(target_page_id)
    or (current_page.lifecycle = 'archived' and public.has_system_role('institution_admin', actor))) then
    raise exception using errcode = '42501', message = 'page edit not permitted';
  end if;
  if next_state = 'published' and not (
    public.has_system_role('institution_admin', actor) or
    not exists (select 1 from public.page_tags pt where pt.page_id = target_page_id and not public.has_tag_membership(
      pt.tag_id, array['teacher','manager']::public.membership_role[], actor))) then
    raise exception using errcode = '42501', message = 'publishing requires authority over every audience tag';
  end if;
  if next_state = 'published' and exists (
    with recursive ancestors as (
      select p.id, p.parent_id, p.lifecycle from public.pages p where p.id = current_page.parent_id
      union all
      select p.id, p.parent_id, p.lifecycle from public.pages p join ancestors child on p.id = child.parent_id
    ) select 1 from ancestors where lifecycle <> 'published'
  ) then raise exception using errcode = '55000', message = 'all parent pages must be published first'; end if;
  if next_state <> 'published' and exists (
    with recursive descendants as (
      select p.id, p.lifecycle from public.pages p where p.parent_id = target_page_id
      union all
      select p.id, p.lifecycle from public.pages p join descendants parent on p.parent_id = parent.id
    ) select 1 from descendants where lifecycle = 'published'
  ) then raise exception using errcode = '55000', message = 'published descendants must be unpublished first'; end if;
  if next_state = 'archived' and exists (
    with recursive descendants as (
      select p.id, p.lifecycle from public.pages p where p.parent_id = target_page_id
      union all
      select p.id, p.lifecycle from public.pages p join descendants parent on p.parent_id = parent.id
    ) select 1 from descendants where lifecycle <> 'archived'
  ) then raise exception using errcode = '55000', message = 'descendants must be archived first'; end if;

  update public.pages set lifecycle = next_state,
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

revoke all on function public.revoke_page_editor(uuid, uuid, text, uuid) from public;
revoke all on function public.assert_page_audience_change_allowed(uuid, uuid[], uuid) from public;
revoke all on function public.assert_page_hierarchy_change_allowed(uuid, uuid, uuid, text, text) from public;
grant execute on function public.revoke_page_editor(uuid, uuid, text, uuid) to authenticated;

-- Closing a teacher role also closes page-specific delegations, preventing a
-- later role assignment from silently reviving old authority.
create or replace function public.close_page_editor_grants_with_teacher_role()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'teacher'
     and old.valid_from <= now() and (old.valid_until is null or old.valid_until > now())
     and new.valid_until is not null and new.valid_until <= now() then
    update public.page_editors set valid_until = now()
    where profile_id = new.profile_id and (valid_until is null or valid_until > now());
  end if;
  return new;
end;
$$;

create trigger role_revocation_closes_page_editor_grants
after update of valid_until on public.role_assignments
for each row execute function public.close_page_editor_grants_with_teacher_role();

revoke all on function public.close_page_editor_grants_with_teacher_role() from public;
