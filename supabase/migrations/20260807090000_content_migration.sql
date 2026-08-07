-- Package Y (ADR-019): staged content migration import engine. No real
-- Moodle instance exists in this environment - this tracks and reconciles
-- an admin-supplied manifest, resumable and checksummed, but every actual
-- content write reuses the *already-tested* create_page/create_assignment/
-- create_quiz RPCs from Packages G/L/P rather than a new bulk-SQL path, so
-- almost no new authorization/validation logic exists here to get wrong
-- blind. A real .mbz backup-format reader is future work layered on top of
-- the same manifest shape this migration's TypeScript caller consumes.

create table public.content_migration_imports (
  id uuid primary key default gen_random_uuid(),
  external_source text not null,
  external_id text not null,
  run_id uuid not null,
  internal_type text not null,
  internal_id uuid not null,
  content_checksum text not null,
  original_author text,
  imported_by uuid not null references public.profiles(id) on delete restrict,
  imported_at timestamptz not null default now(),
  constraint content_migration_imports_source_scope check (external_source = 'moodle'),
  constraint content_migration_imports_type_scope check (internal_type in ('page', 'assignment', 'quiz'))
);
create unique index content_migration_imports_external_unique on public.content_migration_imports (external_source, external_id);

alter table public.content_migration_imports enable row level security;
-- No policies - internal bookkeeping only, read/written exclusively through
-- the two SECURITY DEFINER functions below, matching mis_roster_intents'
-- and quiz_answer_keys' precedent for "no direct client SELECT surface."

create or replace function public.get_migration_import(
  ext_source text,
  ext_id text
) returns public.content_migration_imports
language plpgsql stable security definer set search_path = '' as $$
declare found public.content_migration_imports;
begin
  perform public.assert_institution_admin(auth.uid());
  select * into found from public.content_migration_imports
  where external_source = ext_source and external_id = ext_id;
  return found;
end;
$$;
revoke all on function public.get_migration_import(text, text) from public;
grant execute on function public.get_migration_import(text, text) to authenticated;

-- Records a completed import for one manifest item. The caller (TypeScript
-- layer) is expected to check get_migration_import first and skip creating
-- the underlying page/assignment/quiz entirely when this would report
-- 'unchanged' or 'conflict' - this function's own re-check exists as a
-- defense against a concurrent second migration run racing the first, not
-- as the primary control flow.
create or replace function public.record_migration_import(
  ext_source text,
  ext_id text,
  migration_run_id uuid,
  content_type text,
  content_id uuid,
  checksum text,
  author_note text default null,
  correlation_id uuid default null
) returns table (status text, existing_internal_id uuid)
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); existing public.content_migration_imports;
begin
  perform public.assert_institution_admin(actor);
  if ext_source <> 'moodle' then
    raise exception using errcode = '22023', message = 'unsupported external_source';
  end if;
  if content_type not in ('page', 'assignment', 'quiz') then
    raise exception using errcode = '22023', message = 'internal_type must be page, assignment, or quiz';
  end if;
  if nullif(btrim(ext_id), '') is null then
    raise exception using errcode = '22023', message = 'external_id is required';
  end if;

  select * into existing from public.content_migration_imports where external_source = ext_source and external_id = ext_id;

  if existing is null then
    insert into public.content_migration_imports
      (external_source, external_id, run_id, internal_type, internal_id, content_checksum, original_author, imported_by)
    values (ext_source, ext_id, migration_run_id, content_type, content_id, checksum, author_note, actor);
    insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, after_data)
    values (actor, 'migration.imported', content_type, content_id, correlation_id, 'app',
      jsonb_build_object('external_source', ext_source, 'external_id', ext_id, 'run_id', migration_run_id));
    return query select 'imported'::text, content_id;
    return;
  end if;

  if existing.content_checksum = checksum then
    return query select 'unchanged'::text, existing.internal_id;
    return;
  end if;

  return query select 'conflict'::text, existing.internal_id;
end;
$$;
revoke all on function public.record_migration_import(text, text, uuid, text, uuid, text, text, uuid) from public;
grant execute on function public.record_migration_import(text, text, uuid, text, uuid, text, text, uuid) to authenticated;
