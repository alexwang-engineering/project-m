-- Private learning-content storage. Metadata is authoritative; object paths do
-- not grant access by themselves.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'learning-content',
  'learning-content',
  false,
  26214400,
  array['application/pdf', 'application/zip', 'application/octet-stream']
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
  if not (public.has_system_role('teacher', actor) or public.has_system_role('institution_admin', actor)) then
    raise exception using errcode = '42501', message = 'content upload role required';
  end if;
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

revoke all on function public.begin_file_upload(text, text, bigint, text, uuid) from public;
grant execute on function public.begin_file_upload(text, text, bigint, text, uuid) to authenticated;

create policy learning_content_insert_pending_owner
on storage.objects for insert to authenticated
with check (
  bucket_id = 'learning-content'
  and exists (
    select 1 from public.files f
    where f.bucket_id = storage.objects.bucket_id
      and f.object_name = storage.objects.name
      and f.owner_id = auth.uid()
      and f.state = 'pending'
      and public.current_principal_is_active()
  )
);

create policy learning_content_read_authorized
on storage.objects for select to authenticated
using (
  bucket_id = 'learning-content'
  and exists (
    select 1 from public.files f
    where f.bucket_id = storage.objects.bucket_id
      and f.object_name = storage.objects.name
      and f.state = 'ready'
      and (
        f.owner_id = auth.uid()
        or exists (
          select 1 from public.page_files pf
          where pf.file_id = f.id and public.can_read_page(pf.page_id)
        )
      )
  )
);

-- Object UPDATE/DELETE and file state transitions are intentionally withheld.
-- A trusted malware/checksum worker must verify the stored object before a
-- later function may mark metadata ready; users cannot self-approve uploads.
