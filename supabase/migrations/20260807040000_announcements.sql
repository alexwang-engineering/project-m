-- Package R (announcements), scoped by ADR-012: a one-way broadcast only -
-- staff/admin post, recipients read, nobody replies. That structural
-- absence of a reply path is exactly why this needs none of the
-- moderation/reporting/rate-limiting machinery threaded messaging would -
-- there is no channel for one recipient to abuse another through. Threaded
-- messaging itself remains unscoped, pending a named human safeguarding
-- owner per the collaboration plan's C1-05 - nothing here builds toward it.

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  is_broadcast boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint announcements_title_not_blank check (btrim(title) <> ''),
  constraint announcements_title_bounded check (length(title) <= 240),
  constraint announcements_body_not_blank check (btrim(body) <> ''),
  constraint announcements_body_bounded check (length(body) <= 4000)
);
create index announcements_created_idx on public.announcements (created_at desc) where archived_at is null;

-- Empty for broadcast announcements by construction (create_announcement
-- rejects tags alongside the broadcast flag), same as calendar_event_tags.
create table public.announcement_tags (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete restrict,
  added_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (announcement_id, tag_id)
);
create index announcement_tags_tag_idx on public.announcement_tags (tag_id, announcement_id);

create or replace function public.can_read_announcement(target_announcement uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.announcements a where a.id = target_announcement and a.archived_at is null and (
      public.is_active_principal(auth.uid()) and (
        a.is_broadcast
        or a.created_by = auth.uid()
        or public.has_system_role('institution_admin', auth.uid())
        or exists (
          select 1 from public.announcement_tags at
          where at.announcement_id = a.id
            and public.has_tag_membership(at.tag_id, array['member','teacher','manager']::public.membership_role[], auth.uid())
        )
      )
    )
  );
$$;
revoke all on function public.can_read_announcement(uuid) from public;
grant execute on function public.can_read_announcement(uuid) to authenticated;

create or replace function public.can_manage_announcement(target_announcement uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_active_principal(auth.uid()) and exists (
    select 1 from public.announcements a where a.id = target_announcement and a.archived_at is null and (
      a.created_by = auth.uid()
      or public.has_system_role('institution_admin', auth.uid())
      or (
        not a.is_broadcast and exists (
          select 1 from public.announcement_tags at
          where at.announcement_id = a.id
            and public.has_tag_membership(at.tag_id, array['teacher','manager']::public.membership_role[], auth.uid())
        )
      )
    )
  );
$$;
revoke all on function public.can_manage_announcement(uuid) from public;
grant execute on function public.can_manage_announcement(uuid) to authenticated;

create or replace function public.create_announcement(
  announcement_title text,
  announcement_body text,
  broadcast boolean,
  audience_tag_ids uuid[],
  correlation_id uuid default null
) returns public.announcements
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); created public.announcements; tag_id uuid;
  wants_broadcast boolean := coalesce(broadcast, false);
begin
  if nullif(btrim(announcement_title), '') is null or length(announcement_title) > 240 then
    raise exception using errcode = '22023', message = 'announcement title is required and must not exceed 240 characters';
  end if;
  if nullif(btrim(announcement_body), '') is null or length(announcement_body) > 4000 then
    raise exception using errcode = '22023', message = 'announcement body is required and must not exceed 4000 characters';
  end if;

  if wants_broadcast then
    perform public.assert_institution_admin(actor);
    if audience_tag_ids is not null and cardinality(audience_tag_ids) > 0 then
      raise exception using errcode = '22023', message = 'a whole-school announcement must not also list audience tags';
    end if;
  else
    perform public.assert_can_assign_tags(audience_tag_ids, actor);
  end if;

  insert into public.announcements (title, body, is_broadcast, created_by)
  values (btrim(announcement_title), btrim(announcement_body), wants_broadcast, actor)
  returning * into created;

  if not wants_broadcast then
    foreach tag_id in array audience_tag_ids loop
      insert into public.announcement_tags (announcement_id, tag_id, added_by) values (created.id, tag_id, actor);
    end loop;
  end if;

  insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, after_data)
  values (actor, 'announcement.created', 'announcement', created.id, correlation_id, 'app',
    jsonb_build_object('is_broadcast', wants_broadcast, 'tags', audience_tag_ids));
  return created;
end;
$$;
revoke all on function public.create_announcement(text, text, boolean, uuid[], uuid) from public;
grant execute on function public.create_announcement(text, text, boolean, uuid[], uuid) to authenticated;

-- Retraction, not editing - same minimal-surface precedent as calendar
-- events and assignments/quizzes. A mistaken announcement is retracted and
-- reposted, not patched in place.
create or replace function public.cancel_announcement(
  target_announcement_id uuid,
  correlation_id uuid default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); locked public.announcements;
begin
  select * into locked from public.announcements where id = target_announcement_id and archived_at is null for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'announcement not found';
  end if;
  if not public.can_manage_announcement(target_announcement_id) then
    raise exception using errcode = '42501', message = 'you do not manage this announcement';
  end if;

  update public.announcements set archived_at = now() where id = target_announcement_id;

  insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, after_data)
  values (actor, 'announcement.cancelled', 'announcement', target_announcement_id, correlation_id, 'app',
    jsonb_build_object('cancelled_at', now()));
end;
$$;
revoke all on function public.cancel_announcement(uuid, uuid) from public;
grant execute on function public.cancel_announcement(uuid, uuid) to authenticated;

alter table public.announcements enable row level security;
alter table public.announcement_tags enable row level security;

create policy announcements_read on public.announcements for select to authenticated
using (public.can_read_announcement(id));
create policy announcement_tags_read on public.announcement_tags for select to authenticated
using (public.can_read_announcement(announcement_id));

grant select on public.announcements to authenticated;
grant select on public.announcement_tags to authenticated;
