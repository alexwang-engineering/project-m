-- Makes file verification recoverable and keeps terminal state + audit evidence
-- in one transaction. Only the service role may execute either function.

alter table public.files
  add column verification_lease_id uuid,
  add column verification_started_at timestamptz;

create or replace function public.claim_file_for_verification()
returns public.files
language plpgsql security definer set search_path = '' as $$
declare claimed public.files;
begin
  select f.* into claimed
  from public.files f
  where f.state = 'pending'
     or (f.state = 'scanning' and f.verification_started_at < now() - interval '15 minutes')
  order by f.created_at
  for update skip locked
  limit 1;

  if not found then return null; end if;

  update public.files
  set state = 'scanning',
      verification_lease_id = extensions.gen_random_uuid(),
      verification_started_at = now()
  where id = claimed.id
  returning * into claimed;
  return claimed;
end;
$$;

create or replace function public.complete_file_verification(
  target_file_id uuid,
  lease_id uuid,
  outcome public.file_state,
  reason text default null,
  correlation_id uuid default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare claimed public.files;
begin
  if outcome not in ('ready', 'quarantined', 'failed') then
    raise exception using errcode = '22023', message = 'invalid verification outcome';
  end if;
  if (outcome = 'quarantined' and nullif(btrim(reason), '') is null)
     or (outcome = 'ready' and nullif(btrim(reason), '') is not null) then
    raise exception using errcode = '22023', message = 'quarantine reason must match outcome';
  end if;

  select * into claimed from public.files where id = target_file_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'file not found'; end if;
  if claimed.state <> 'scanning' or claimed.verification_lease_id is distinct from lease_id then
    raise exception using errcode = '55000', message = 'file verification lease is not current';
  end if;

  update public.files
  set state = outcome,
      scanned_at = now(),
      verification_lease_id = null,
      verification_started_at = null,
      quarantine_reason = case when outcome = 'quarantined' then btrim(reason) else null end
  where id = target_file_id;

  insert into public.audit_events (
    actor_id, action, target_type, target_id, correlation_id, source,
    before_data, after_data
  ) values (
    null, 'file.verification.' || outcome::text, 'file', target_file_id,
    correlation_id, 'verification-worker', jsonb_build_object('state', 'scanning'),
    jsonb_strip_nulls(jsonb_build_object('state', outcome, 'reason', nullif(btrim(reason), '')))
  );
end;
$$;

revoke all on function public.claim_file_for_verification() from public, anon, authenticated;
revoke all on function public.complete_file_verification(uuid, uuid, public.file_state, text, uuid) from public, anon, authenticated;
grant execute on function public.claim_file_for_verification() to service_role;
grant execute on function public.complete_file_verification(uuid, uuid, public.file_state, text, uuid) to service_role;

drop index public.files_pending_queue_idx;
create index files_verification_queue_idx on public.files (state, verification_started_at, created_at)
where state in ('pending', 'scanning');
