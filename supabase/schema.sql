-- ============================================================
-- Project M — Core Schema (Phase 1)
-- Tag-based content engine for a Next.js + Supabase LMS
-- ============================================================

create extension if not exists "pgcrypto";

create type user_role as enum ('admin', 'teacher', 'student');

-- ---------- 1. users ----------
-- Mirrors auth.users; id is shared 1:1 with the Supabase auth user.
create table public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  role        user_role not null default 'student',
  created_at  timestamptz not null default now()
);

-- Auto-provision a public.users row whenever someone signs up via Supabase Auth.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------- 2. tags ----------
create table public.tags (
  id          uuid primary key default gen_random_uuid(),
  tag_name    text not null unique,          -- e.g. 'Y9MA1', 'L6CH2'
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ---------- 3. user_tags ----------
create table public.user_tags (
  user_id  uuid not null references public.users(id) on delete cascade,
  tag_id   uuid not null references public.tags(id) on delete cascade,
  primary key (user_id, tag_id)
);

create index idx_user_tags_tag on public.user_tags(tag_id);
create index idx_user_tags_user on public.user_tags(user_id);

-- ---------- 4. pages ----------
create table public.pages (
  id             uuid primary key default gen_random_uuid(),
  canonical_url  text not null unique,        -- e.g. '/chemistry/organic-chemistry/mechanisms'
  title          text not null,
  content_json   jsonb not null default '{}'::jsonb,
  author_id      uuid references public.users(id) on delete set null,
  is_public      boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_pages_author on public.pages(author_id);

-- keep updated_at current
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger pages_set_updated_at
  before update on public.pages
  for each row execute function public.set_updated_at();

-- ---------- 5. page_tags ----------
create table public.page_tags (
  page_id  uuid not null references public.pages(id) on delete cascade,
  tag_id   uuid not null references public.tags(id) on delete cascade,
  primary key (page_id, tag_id)
);

create index idx_page_tags_tag on public.page_tags(tag_id);
create index idx_page_tags_page on public.page_tags(page_id);

-- ============================================================
-- Helper functions (SECURITY DEFINER — bypass RLS internally,
-- so policies below can call them without recursive RLS checks)
-- ============================================================

create or replace function public.current_role()
returns user_role
language sql stable security definer set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

-- True if the calling user is assigned at least one tag shared with the page.
create or replace function public.user_matches_page(target_page_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.page_tags pt
    join public.user_tags ut on ut.tag_id = pt.tag_id
    where pt.page_id = target_page_id
      and ut.user_id = auth.uid()
  );
$$;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.users     enable row level security;
alter table public.tags      enable row level security;
alter table public.user_tags enable row level security;
alter table public.pages     enable row level security;
alter table public.page_tags enable row level security;

-- ---------- users ----------
create policy "users_select_self_or_admin"
  on public.users for select
  using (id = auth.uid() or public.current_role() = 'admin');

create policy "users_update_admin_only"
  on public.users for update
  using (public.current_role() = 'admin');

-- ---------- tags ----------
-- Any authenticated user can read tags (needed to render the tag rail / navigation).
create policy "tags_select_authenticated"
  on public.tags for select
  using (auth.role() = 'authenticated');

create policy "tags_insert_teacher_or_admin"
  on public.tags for insert
  with check (public.current_role() in ('teacher', 'admin'));

create policy "tags_update_delete_admin_only"
  on public.tags for update using (public.current_role() = 'admin');

create policy "tags_delete_admin_only"
  on public.tags for delete
  using (public.current_role() = 'admin');

-- ---------- user_tags ----------
create policy "user_tags_select_self_or_admin"
  on public.user_tags for select
  using (user_id = auth.uid() or public.current_role() = 'admin');

create policy "user_tags_write_admin_only"
  on public.user_tags for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- ---------- pages ----------
-- Read: public pages, pages matching the caller's tags, the caller's own pages, or admin.
create policy "pages_select"
  on public.pages for select
  using (
    is_public = true
    or author_id = auth.uid()
    or public.current_role() = 'admin'
    or public.user_matches_page(id)
  );

-- Insert: teachers and admins only.
create policy "pages_insert_teacher_or_admin"
  on public.pages for insert
  with check (public.current_role() in ('teacher', 'admin'));

-- Update ("Students only have read access"; "Teachers can only edit pages
-- that match their assigned tags"): admin always, teacher only on tag-matched pages.
create policy "pages_update"
  on public.pages for update
  using (
    public.current_role() = 'admin'
    or (public.current_role() = 'teacher' and public.user_matches_page(id))
  )
  with check (
    public.current_role() = 'admin'
    or (public.current_role() = 'teacher' and public.user_matches_page(id))
  );

create policy "pages_delete_admin_only"
  on public.pages for delete
  using (public.current_role() = 'admin');

-- ---------- page_tags ----------
-- Readable wherever the underlying page is readable.
create policy "page_tags_select"
  on public.page_tags for select
  using (
    exists (
      select 1 from public.pages p
      where p.id = page_id
        and (
          p.is_public = true
          or p.author_id = auth.uid()
          or public.current_role() = 'admin'
          or public.user_matches_page(p.id)
        )
    )
  );

-- Writable by admin, or by a teacher who already matches the page via an
-- existing tag (prevents a teacher tagging a page into a set they can't reach).
create policy "page_tags_write"
  on public.page_tags for all
  using (
    public.current_role() = 'admin'
    or (public.current_role() = 'teacher' and public.user_matches_page(page_id))
  )
  with check (
    public.current_role() = 'admin'
    or (public.current_role() = 'teacher' and public.user_matches_page(page_id))
  );
