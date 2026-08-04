-- Authorized file attachment and download target resolution. File metadata RLS
-- remains owner-only; these narrow functions expose only the fields needed by
-- an authorized application flow.

create or replace function public.attach_ready_file_to_page(
  target_page_id uuid,
  target_file_id uuid,
  correlation_id uuid default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); target_file public.files; inserted_count integer;
begin
  if not public.can_edit_page(target_page_id) then
    raise exception using errcode = '42501', message = 'page edit not permitted';
  end if;

  select * into target_file from public.files where id = target_file_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'file not found'; end if;
  if target_file.state <> 'ready' then
    raise exception using errcode = '55000', message = 'file has not passed verification';
  end if;
  if target_file.owner_id <> actor and not public.has_system_role('institution_admin', actor) then
    raise exception using errcode = '42501', message = 'file ownership required';
  end if;

  insert into public.page_files (page_id, file_id, added_by)
  values (target_page_id, target_file_id, actor)
  on conflict (page_id, file_id) do nothing;

  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then return; end if;

  insert into public.audit_events (
    actor_id, action, target_type, target_id, correlation_id, source, after_data
  ) values (
    actor, 'page.file_attached', 'page', target_page_id, correlation_id, 'app',
    jsonb_build_object('file_id', target_file_id)
  );
end;
$$;

create or replace function public.get_file_download_target(target_file_id uuid)
returns table (
  bucket_id text,
  object_name text,
  original_name text,
  media_type text,
  size_bytes bigint
)
language sql stable security definer set search_path = '' as $$
  select f.bucket_id, f.object_name, f.original_name, f.media_type, f.size_bytes
  from public.files f
  where f.id = target_file_id
    and f.state = 'ready'
    and public.current_principal_is_active()
    and (
      f.owner_id = auth.uid()
      or exists (
        select 1
        from public.page_files pf
        where pf.file_id = f.id
          and public.can_read_page(pf.page_id)
      )
    )
  limit 1
$$;

revoke all on function public.attach_ready_file_to_page(uuid, uuid, uuid) from public;
revoke all on function public.get_file_download_target(uuid) from public;
grant execute on function public.attach_ready_file_to_page(uuid, uuid, uuid) to authenticated;
grant execute on function public.get_file_download_target(uuid) to authenticated;
