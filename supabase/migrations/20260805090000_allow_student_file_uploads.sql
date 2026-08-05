-- begin_file_upload originally required teacher/admin, built for attaching
-- resources to pages. Assignment submissions (added in the next migration)
-- need students to upload their own work too. Widening this is safe: it
-- only lets an active principal register *pending* metadata for a file they
-- will own - attach_ready_file_to_page still requires page-edit permission,
-- and submit_assignment still requires audience membership and file
-- ownership, so this alone grants no new read/write access to anything.
create or replace function public.begin_file_upload(
  original_filename text,
  declared_media_type text,
  declared_size_bytes bigint,
  declared_sha256 text,
  correlation_id uuid default null
) returns public.files
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); file_id uuid := extensions.gen_random_uuid(); created public.files; safe_extension text;
begin
  if not public.current_principal_is_active() then raise exception using errcode = '42501', message = 'active principal required'; end if;
  if declared_media_type not in ('application/pdf', 'application/zip', 'application/octet-stream') then
    raise exception using errcode = '22023', message = 'unsupported upload media type';
  end if;
  if nullif(btrim(original_filename), '') is null or length(original_filename) > 255 then
    raise exception using errcode = '22023', message = 'invalid original filename';
  end if;
  safe_extension := case declared_media_type
    when 'application/pdf' then '.pdf'
    when 'application/zip' then '.mpx'
    else '.bin'
  end;
  insert into public.files (
    id, owner_id, object_name, original_name, media_type, size_bytes, sha256
  ) values (
    file_id, actor, actor::text || '/' || file_id::text || safe_extension,
    btrim(original_filename), declared_media_type, declared_size_bytes, lower(declared_sha256)
  ) returning * into created;
  insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, after_data)
  values (actor, 'file.upload_started', 'file', file_id, correlation_id, 'app',
    jsonb_build_object('media_type', declared_media_type, 'size_bytes', declared_size_bytes));
  return created;
end;
$$;
