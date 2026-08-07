-- Pages support embedded image blocks (schema.ts ImageBlock), but
-- begin_file_upload only ever allow-listed PDF/MPX/octet-stream. Widen the
-- same way 20260805090000 widened it for students: images still land as
-- `pending` and still need attach_ready_file_to_page (page-edit permission)
-- before they are readable, so this alone grants no new access.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'learning-content',
  'learning-content',
  false,
  26214400,
  array[
    'application/pdf', 'application/zip', 'application/octet-stream',
    'image/png', 'image/jpeg', 'image/webp', 'image/gif'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

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
  if declared_media_type not in (
    'application/pdf', 'application/zip', 'application/octet-stream',
    'image/png', 'image/jpeg', 'image/webp', 'image/gif'
  ) then
    raise exception using errcode = '22023', message = 'unsupported upload media type';
  end if;
  if nullif(btrim(original_filename), '') is null or length(original_filename) > 255 then
    raise exception using errcode = '22023', message = 'invalid original filename';
  end if;
  safe_extension := case declared_media_type
    when 'application/pdf' then '.pdf'
    when 'application/zip' then '.mpx'
    when 'image/png' then '.png'
    when 'image/jpeg' then '.jpg'
    when 'image/webp' then '.webp'
    when 'image/gif' then '.gif'
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
