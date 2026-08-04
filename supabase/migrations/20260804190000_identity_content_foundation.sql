-- Project M identity/content foundation.
-- Admission remains disabled at Supabase configuration level until the Entra
-- tenant and guardian verification facts required by ADR-002 are supplied.

create extension if not exists pgcrypto with schema extensions;

create type public.principal_kind as enum ('institutional', 'guardian', 'service');
create type public.principal_state as enum ('active', 'disabled');
create type public.system_role as enum ('institution_admin', 'teacher', 'student');
create type public.membership_role as enum ('member', 'teacher', 'manager');
create type public.content_state as enum ('draft', 'published', 'archived');
create type public.file_state as enum ('pending', 'ready', 'quarantined', 'failed', 'archived');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  kind public.principal_kind not null,
  state public.principal_state not null default 'active',
  admitted_by uuid references public.profiles(id) on delete restrict,
  admitted_at timestamptz not null default now(),
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_normalized check (email = lower(btrim(email))),
  constraint profiles_disabled_consistent check (
    (state = 'active' and disabled_at is null) or
    (state = 'disabled' and disabled_at is not null)
  )
);
create unique index profiles_email_unique on public.profiles (lower(email));

create table public.role_assignments (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.system_role not null,
  granted_by uuid references public.profiles(id) on delete restrict,
  reason text not null,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  primary key (profile_id, role, valid_from),
  constraint role_assignment_window check (valid_until is null or valid_until > valid_from)
);
create index role_assignments_current_idx
  on public.role_assignments (profile_id, role, valid_from, valid_until);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  tag_name text not null,
  display_name text not null,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint tags_name_format check (tag_name ~ '^[A-Z0-9][A-Z0-9_-]{1,31}$'),
  constraint tags_archive_consistent check (
    (is_active and archived_at is null) or (not is_active and archived_at is not null)
  )
);
create unique index tags_name_unique on public.tags (upper(tag_name));

create table public.tag_memberships (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  membership_role public.membership_role not null default 'member',
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  source text not null,
  reason text,
  granted_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (profile_id, tag_id, membership_role, valid_from),
  constraint tag_membership_window check (valid_until is null or valid_until > valid_from)
);
create index tag_memberships_current_profile_idx
  on public.tag_memberships (profile_id, tag_id, membership_role, valid_from, valid_until);
create index tag_memberships_current_tag_idx
  on public.tag_memberships (tag_id, profile_id, membership_role, valid_from, valid_until);

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.pages(id) on delete restrict,
  slug text not null,
  canonical_url text not null,
  title text not null,
  content_json jsonb not null,
  content_schema_version integer not null default 1,
  author_id uuid not null references public.profiles(id) on delete restrict,
  lifecycle public.content_state not null default 'draft',
  is_public boolean not null default false,
  version bigint not null default 1,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pages_not_self_parent check (parent_id is null or parent_id <> id),
  constraint pages_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint pages_canonical_url_format check (canonical_url ~ '^/[a-z0-9]+(?:-[a-z0-9]+)*(?:/[a-z0-9]+(?:-[a-z0-9]+)*)*$'),
  constraint pages_schema_version_positive check (content_schema_version > 0),
  constraint pages_version_positive check (version > 0),
  constraint pages_lifecycle_dates check (
    (lifecycle = 'draft' and published_at is null and archived_at is null) or
    (lifecycle = 'published' and published_at is not null and archived_at is null) or
    (lifecycle = 'archived' and archived_at is not null)
  ),
  constraint pages_public_only_published check (not is_public or lifecycle = 'published')
);
create unique index pages_root_slug_unique on public.pages (slug) where parent_id is null and lifecycle <> 'archived';
create unique index pages_sibling_slug_unique on public.pages (parent_id, slug) where parent_id is not null and lifecycle <> 'archived';
create unique index pages_canonical_url_unique on public.pages (canonical_url);
create index pages_parent_idx on public.pages (parent_id);
create index pages_author_idx on public.pages (author_id);

create table public.page_tags (
  page_id uuid not null references public.pages(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete restrict,
  added_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (page_id, tag_id)
);
create index page_tags_tag_idx on public.page_tags (tag_id, page_id);

create table public.page_editors (
  page_id uuid not null references public.pages(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  granted_by uuid not null references public.profiles(id) on delete restrict,
  reason text not null,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  primary key (page_id, profile_id)
);

create table public.page_revisions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages(id) on delete restrict,
  version bigint not null,
  title text not null,
  content_json jsonb not null,
  content_schema_version integer not null,
  lifecycle public.content_state not null,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (page_id, version)
);

create table public.canonical_redirects (
  old_path text primary key,
  page_id uuid not null references public.pages(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint canonical_redirect_path check (old_path ~ '^/[a-z0-9/-]+$')
);

create table public.files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  bucket_id text not null default 'learning-content',
  object_name text not null,
  original_name text not null,
  media_type text not null,
  size_bytes bigint not null,
  sha256 text not null,
  state public.file_state not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (bucket_id, object_name),
  constraint files_size_bounded check (size_bytes between 1 and 26214400),
  constraint files_sha256_format check (sha256 ~ '^[0-9a-f]{64}$'),
  constraint files_object_name_safe check (object_name !~ '(^|/)\.\.(/|$)' and object_name !~ '^/'),
  constraint files_archive_consistent check ((state = 'archived') = (archived_at is not null))
);

create table public.page_files (
  page_id uuid not null references public.pages(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete restrict,
  added_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (page_id, file_id)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete restrict,
  action text not null,
  target_type text not null,
  target_id uuid,
  correlation_id uuid,
  source text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_target_idx on public.audit_events (target_type, target_id, created_at desc);
create index audit_events_actor_idx on public.audit_events (actor_id, created_at desc);

create or replace function public.is_active_principal(target_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = target_id and p.state = 'active');
$$;

create or replace function public.has_system_role(required_role public.system_role, target_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_active_principal(target_id) and exists (
    select 1 from public.role_assignments r
    where r.profile_id = target_id and r.role = required_role
      and r.valid_from <= now() and (r.valid_until is null or r.valid_until > now())
  );
$$;

create or replace function public.current_principal_is_active()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_active_principal(auth.uid());
$$;

create or replace function public.current_principal_is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_system_role('institution_admin', auth.uid());
$$;

create or replace function public.has_tag_membership(target_tag uuid, allowed_roles public.membership_role[], target_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_active_principal(target_id) and exists (
    select 1 from public.tag_memberships m join public.tags t on t.id = m.tag_id
    where m.profile_id = target_id and m.tag_id = target_tag and m.membership_role = any(allowed_roles)
      and t.is_active and m.valid_from <= now() and (m.valid_until is null or m.valid_until > now())
  );
$$;

create or replace function public.can_read_page(target_page uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.pages p where p.id = target_page and (
      (p.lifecycle = 'published' and p.is_public)
      or (public.is_active_principal(auth.uid()) and p.lifecycle <> 'archived' and (
        p.author_id = auth.uid()
        or public.has_system_role('institution_admin', auth.uid())
        or exists (select 1 from public.page_editors e where e.page_id = p.id and e.profile_id = auth.uid() and (e.valid_until is null or e.valid_until > now()))
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
      or exists (select 1 from public.page_editors e where e.page_id = p.id and e.profile_id = auth.uid() and (e.valid_until is null or e.valid_until > now()))
      or (public.has_system_role('teacher', auth.uid()) and exists (select 1 from public.page_tags pt where pt.page_id = p.id)
        and not exists (select 1 from public.page_tags pt where pt.page_id = p.id
          and not public.has_tag_membership(pt.tag_id, array['teacher','manager']::public.membership_role[], auth.uid())))
    )
  );
$$;

create or replace function public.reject_page_cycles()
returns trigger language plpgsql set search_path = '' as $$
declare cursor_id uuid;
begin
  cursor_id := new.parent_id;
  while cursor_id is not null loop
    if cursor_id = new.id then raise exception using errcode = '23514', message = 'page hierarchy cycle'; end if;
    select p.parent_id into cursor_id from public.pages p where p.id = cursor_id;
  end loop;
  return new;
end;
$$;
create trigger pages_reject_cycles before insert or update of parent_id on public.pages
for each row execute function public.reject_page_cycles();

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
create trigger pages_touch_updated_at before update on public.pages for each row execute function public.touch_updated_at();
create trigger files_touch_updated_at before update on public.files for each row execute function public.touch_updated_at();
create trigger profiles_touch_updated_at before update on public.profiles for each row execute function public.touch_updated_at();

revoke all on function public.is_active_principal(uuid) from public;
revoke all on function public.has_system_role(public.system_role, uuid) from public;
revoke all on function public.current_principal_is_active() from public;
revoke all on function public.current_principal_is_admin() from public;
revoke all on function public.has_tag_membership(uuid, public.membership_role[], uuid) from public;
revoke all on function public.can_read_page(uuid) from public;
revoke all on function public.can_edit_page(uuid) from public;
revoke all on function public.reject_page_cycles() from public;
revoke all on function public.touch_updated_at() from public;
grant execute on function public.current_principal_is_active() to authenticated;
grant execute on function public.current_principal_is_admin() to authenticated;
grant execute on function public.can_read_page(uuid) to authenticated, anon;
grant execute on function public.can_edit_page(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.role_assignments enable row level security;
alter table public.tags enable row level security;
alter table public.tag_memberships enable row level security;
alter table public.pages enable row level security;
alter table public.page_tags enable row level security;
alter table public.page_editors enable row level security;
alter table public.page_revisions enable row level security;
alter table public.canonical_redirects enable row level security;
alter table public.files enable row level security;
alter table public.page_files enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_read_self_admin on public.profiles for select to authenticated
using (id = auth.uid() or public.current_principal_is_admin());
create policy roles_read_self_admin on public.role_assignments for select to authenticated
using (profile_id = auth.uid() or public.current_principal_is_admin());
create policy tags_read_active on public.tags for select to authenticated using (is_active and public.current_principal_is_active());
create policy memberships_read_self_admin on public.tag_memberships for select to authenticated
using (profile_id = auth.uid() or public.current_principal_is_admin());
create policy pages_read on public.pages for select to anon, authenticated using (public.can_read_page(id));
create policy page_tags_read on public.page_tags for select to anon, authenticated using (public.can_read_page(page_id));
create policy page_editors_read on public.page_editors for select to authenticated
using (profile_id = auth.uid() or public.can_edit_page(page_id) or public.current_principal_is_admin());
create policy revisions_read on public.page_revisions for select to authenticated using (public.can_read_page(page_id));
create policy redirects_read on public.canonical_redirects for select to anon, authenticated using (public.can_read_page(page_id));
create policy files_read_owner on public.files for select to authenticated using (owner_id = auth.uid() and public.current_principal_is_active());
create policy page_files_read on public.page_files for select to authenticated using (public.can_read_page(page_id));
create policy audit_read_admin on public.audit_events for select to authenticated using (public.current_principal_is_admin());

-- Application mutations intentionally have no direct INSERT/DELETE grants yet.
-- Package D's next migration adds audited transactional functions after these
-- denial-by-default policies are verified locally.
