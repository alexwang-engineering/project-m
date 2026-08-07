-- Package Q (calendar), scoped by ADR-011: one-off events only (no
-- recurrence), an institution_admin-gated whole-school broadcast flag
-- alongside tag-scoped events, create+cancel only (no edit - matches the
-- "smallest correct thing" precedent set for assignments/quizzes). Deadline
-- aggregation itself needs no new table: assignments.due_at and
-- quizzes.due_at are already RLS-scoped and read directly by the loader.

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  is_broadcast boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint calendar_events_title_not_blank check (btrim(title) <> ''),
  constraint calendar_events_title_bounded check (length(title) <= 240),
  constraint calendar_events_description_bounded check (description is null or length(description) <= 2000),
  constraint calendar_events_end_after_start check (ends_at is null or ends_at > starts_at)
);
create index calendar_events_starts_idx on public.calendar_events (starts_at) where archived_at is null;

-- Empty for broadcast events by construction (create_calendar_event rejects
-- tags alongside the broadcast flag) - is_broadcast is what a reader checks,
-- never "zero rows here" as an implicit meaning.
create table public.calendar_event_tags (
  event_id uuid not null references public.calendar_events(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete restrict,
  added_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (event_id, tag_id)
);
create index calendar_event_tags_tag_idx on public.calendar_event_tags (tag_id, event_id);

create or replace function public.can_read_calendar_event(target_event uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.calendar_events e where e.id = target_event and e.archived_at is null and (
      public.is_active_principal(auth.uid()) and (
        e.is_broadcast
        or e.created_by = auth.uid()
        or public.has_system_role('institution_admin', auth.uid())
        or exists (
          select 1 from public.calendar_event_tags cet
          where cet.event_id = e.id
            and public.has_tag_membership(cet.tag_id, array['member','teacher','manager']::public.membership_role[], auth.uid())
        )
      )
    )
  );
$$;
revoke all on function public.can_read_calendar_event(uuid) from public;
grant execute on function public.can_read_calendar_event(uuid) to authenticated;

-- Same "any owned tag, not every tag" shape as can_manage_assignment: a
-- teacher/manager on just one of an event's several audience tags can still
-- cancel it. Broadcast events have no tags at all, so only the creator or an
-- admin can ever manage one.
create or replace function public.can_manage_calendar_event(target_event uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_active_principal(auth.uid()) and exists (
    select 1 from public.calendar_events e where e.id = target_event and e.archived_at is null and (
      e.created_by = auth.uid()
      or public.has_system_role('institution_admin', auth.uid())
      or (
        not e.is_broadcast and exists (
          select 1 from public.calendar_event_tags cet
          where cet.event_id = e.id
            and public.has_tag_membership(cet.tag_id, array['teacher','manager']::public.membership_role[], auth.uid())
        )
      )
    )
  );
$$;
revoke all on function public.can_manage_calendar_event(uuid) from public;
grant execute on function public.can_manage_calendar_event(uuid) to authenticated;

create or replace function public.create_calendar_event(
  event_title text,
  event_starts_at timestamptz,
  broadcast boolean,
  audience_tag_ids uuid[],
  event_description text default null,
  event_ends_at timestamptz default null,
  correlation_id uuid default null
) returns public.calendar_events
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); created public.calendar_events; tag_id uuid;
  wants_broadcast boolean := coalesce(broadcast, false);
begin
  if nullif(btrim(event_title), '') is null or length(event_title) > 240 then
    raise exception using errcode = '22023', message = 'event title is required and must not exceed 240 characters';
  end if;
  if event_description is not null and length(event_description) > 2000 then
    raise exception using errcode = '22023', message = 'description must not exceed 2000 characters';
  end if;
  if event_starts_at is null then
    raise exception using errcode = '22023', message = 'a start time is required';
  end if;
  if event_ends_at is not null and event_ends_at <= event_starts_at then
    raise exception using errcode = '22023', message = 'end time must be after the start time';
  end if;

  if wants_broadcast then
    perform public.assert_institution_admin(actor);
    if audience_tag_ids is not null and cardinality(audience_tag_ids) > 0 then
      raise exception using errcode = '22023', message = 'a whole-school event must not also list audience tags';
    end if;
  else
    perform public.assert_can_assign_tags(audience_tag_ids, actor);
  end if;

  insert into public.calendar_events (title, description, starts_at, ends_at, is_broadcast, created_by)
  values (btrim(event_title), nullif(btrim(event_description), ''), event_starts_at, event_ends_at, wants_broadcast, actor)
  returning * into created;

  if not wants_broadcast then
    foreach tag_id in array audience_tag_ids loop
      insert into public.calendar_event_tags (event_id, tag_id, added_by) values (created.id, tag_id, actor);
    end loop;
  end if;

  insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, after_data)
  values (actor, 'calendar_event.created', 'calendar_event', created.id, correlation_id, 'app',
    jsonb_build_object('starts_at', created.starts_at, 'is_broadcast', wants_broadcast, 'tags', audience_tag_ids));
  return created;
end;
$$;
revoke all on function public.create_calendar_event(text, timestamptz, boolean, uuid[], text, timestamptz, uuid) from public;
grant execute on function public.create_calendar_event(text, timestamptz, boolean, uuid[], text, timestamptz, uuid) to authenticated;

-- The only other operation launch needs: withdraw an event. No edit RPC -
-- same minimal-surface precedent as assignments/quizzes; a mistaken event
-- gets cancelled and recreated rather than patched in place.
create or replace function public.cancel_calendar_event(
  target_event_id uuid,
  correlation_id uuid default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); locked public.calendar_events;
begin
  select * into locked from public.calendar_events where id = target_event_id and archived_at is null for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'calendar event not found';
  end if;
  if not public.can_manage_calendar_event(target_event_id) then
    raise exception using errcode = '42501', message = 'you do not manage this event';
  end if;

  update public.calendar_events set archived_at = now() where id = target_event_id;

  insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, after_data)
  values (actor, 'calendar_event.cancelled', 'calendar_event', target_event_id, correlation_id, 'app',
    jsonb_build_object('cancelled_at', now()));
end;
$$;
revoke all on function public.cancel_calendar_event(uuid, uuid) from public;
grant execute on function public.cancel_calendar_event(uuid, uuid) to authenticated;

alter table public.calendar_events enable row level security;
alter table public.calendar_event_tags enable row level security;

create policy calendar_events_read on public.calendar_events for select to authenticated
using (public.can_read_calendar_event(id));
create policy calendar_event_tags_read on public.calendar_event_tags for select to authenticated
using (public.can_read_calendar_event(event_id));

-- RLS policies are inert without the matching base table GRANT (the bug
-- this project's own history keeps flagging as the first thing to check).
grant select on public.calendar_events to authenticated;
grant select on public.calendar_event_tags to authenticated;
