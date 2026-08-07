-- Package V (ADR-016): full-text search over titles (and, where a real
-- plain-text field already exists, bodies) across pages, assignments,
-- quizzes, announcements, and calendar_events. No new RPC and no new
-- authorization logic - each table already has its own tested RLS select
-- policy, so an ordinary authenticated select/.textSearch() against these
-- columns is authorized "inside source query" by construction, matching
-- the exact requirement PM-04's threat model already names for search.
--
-- Postgres's built-in text search (native platform feature, no new
-- dependency) rather than ILIKE, since a leading-wildcard ILIKE cannot use
-- a standard index and would not scale toward PM-02's stated 100,000-page
-- envelope or its p95 <750ms target.
--
-- generated ... stored columns require an IMMUTABLE expression; passing an
-- explicit regconfig literal ('english') rather than relying on the
-- session-mutable default_text_search_config GUC is what makes
-- to_tsvector('english', ...) valid here - this is the standard, documented
-- pattern for a generated/indexed tsvector column.

alter table public.pages add column search_vector tsvector
  generated always as (to_tsvector('english', coalesce(title, ''))) stored;
create index pages_search_idx on public.pages using gin (search_vector);

alter table public.assignments add column search_vector tsvector
  generated always as (to_tsvector('english', coalesce(title, ''))) stored;
create index assignments_search_idx on public.assignments using gin (search_vector);

alter table public.quizzes add column search_vector tsvector
  generated always as (to_tsvector('english', coalesce(title, ''))) stored;
create index quizzes_search_idx on public.quizzes using gin (search_vector);

alter table public.announcements add column search_vector tsvector
  generated always as (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))) stored;
create index announcements_search_idx on public.announcements using gin (search_vector);

alter table public.calendar_events add column search_vector tsvector
  generated always as (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))) stored;
create index calendar_events_search_idx on public.calendar_events using gin (search_vector);
