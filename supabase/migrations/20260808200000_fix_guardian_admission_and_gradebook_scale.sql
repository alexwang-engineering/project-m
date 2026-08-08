-- Reconcile the global auth hook with the separately approved guardian path.
-- A pre-authorized guardian may use email auth regardless of whether Entra is
-- enabled; every other non-Azure signup remains rejected.
create or replace function public.before_user_created_institutional(event jsonb)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  config public.institutional_auth_config;
  incoming_email text := lower(btrim(event #>> '{user,email}'));
  provider text := event #>> '{user,app_metadata,provider}';
begin
  if provider = 'email' and exists (
    select 1 from public.guardian_links
    where guardian_email = incoming_email
      and revoked_at is null
      and guardian_profile_id is null
  ) then
    return '{}'::jsonb;
  end if;

  select * into config from public.institutional_auth_config where singleton;
  if config is null or not config.enabled then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 503, 'message', 'Institutional sign-in is not yet enabled.'
    ));
  end if;
  if provider <> 'azure' then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403, 'message', 'Only institutional Microsoft sign-in is permitted.'
    ));
  end if;
  if incoming_email is null or split_part(incoming_email, '@', 2) <> config.email_domain
     or incoming_email <> split_part(incoming_email, '@', 1) || '@' || config.email_domain then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403, 'message', 'This Microsoft account is not eligible for institutional access.'
    ));
  end if;
  return '{}'::jsonb;
end;
$$;

-- Disabled guardians must lose access immediately, just like every other
-- principal. The linked target must also remain an active student.
create or replace function public.assert_guardian_of(target_pupil_id uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_active_principal(auth.uid()) or not exists (
    select 1 from public.guardian_links
    where guardian_profile_id = auth.uid()
      and pupil_id = target_pupil_id
      and revoked_at is null
  ) or not public.has_system_role('student', target_pupil_id) then
    raise exception using errcode = '42501', message = 'you are not an authorized guardian for this pupil';
  end if;
end;
$$;

create or replace function public.list_my_pupils()
returns table (pupil_id uuid, pupil_email text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.email
  from public.guardian_links gl
  join public.profiles p on p.id = gl.pupil_id
  where public.is_active_principal(auth.uid())
    and gl.guardian_profile_id = auth.uid()
    and gl.revoked_at is null
    and public.has_system_role('student', p.id)
  order by p.email;
$$;

create or replace function public.link_guardian(
  target_pupil_id uuid,
  guardian_email text,
  link_reason text,
  correlation_id uuid default null
) returns public.guardian_links
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); normalized_email text; created public.guardian_links;
begin
  perform public.assert_institution_admin(actor);
  if not public.has_system_role('student', target_pupil_id)
     or not exists (
       select 1 from public.profiles
       where id = target_pupil_id and kind = 'institutional' and state = 'active'
     ) then
    raise exception using errcode = 'P0002', message = 'active pupil not found';
  end if;
  normalized_email := lower(btrim(guardian_email));
  if normalized_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception using errcode = '22023', message = 'a valid guardian email address is required';
  end if;
  if exists (select 1 from public.profiles where email = normalized_email and kind <> 'guardian') then
    raise exception using errcode = '22023', message = 'this email belongs to a non-guardian account';
  end if;
  if nullif(btrim(link_reason), '') is null or length(btrim(link_reason)) > 1000 then
    raise exception using errcode = '22023', message = 'a reason between 1 and 1000 characters is required to link a guardian';
  end if;

  insert into public.guardian_links (pupil_id, guardian_email, created_by, reason)
  values (target_pupil_id, normalized_email, actor, btrim(link_reason))
  returning * into created;

  update public.guardian_links gl
  set guardian_profile_id = p.id, activated_at = now()
  from public.profiles p
  where gl.id = created.id and p.email = normalized_email and p.kind = 'guardian';
  select * into created from public.guardian_links where id = created.id;

  insert into public.audit_events (actor_id, action, target_type, target_id, correlation_id, source, after_data)
  values (actor, 'guardian.linked', 'guardian_link', created.id, correlation_id, 'app',
    jsonb_build_object('pupil_id', target_pupil_id, 'guardian_email', normalized_email));
  return created;
end;
$$;

-- Aggregate inside Postgres and cap the assessment list. This avoids moving
-- every submission and attempt into the Next.js process at school scale.
create or replace function public.teacher_gradebook_rollups(row_limit integer default 200)
returns table (
  item_kind text,
  item_id uuid,
  item_title text,
  submission_count bigint,
  average_percent numeric
)
language sql stable security definer set search_path = '' as $$
  with managed_assignments as (
    select a.id, a.title, a.created_at
    from public.assignments a
    where public.can_manage_assignment(a.id)
    order by a.created_at desc
    limit least(greatest(coalesce(row_limit, 200), 1), 200)
  ), managed_quizzes as (
    select q.id, q.title, q.created_at
    from public.quizzes q
    where public.can_manage_quiz(q.id)
    order by q.created_at desc
    limit least(greatest(coalesce(row_limit, 200), 1), 200)
  )
  select 'assignment'::text, a.id, a.title,
    count(s.id), avg(g.grade)
  from managed_assignments a
  left join public.assignment_submissions s on s.assignment_id = a.id
  left join public.assignment_grades g on g.submission_id = s.id
  group by a.id, a.title, a.created_at
  union all
  select 'quiz'::text, q.id, q.title,
    count(qa.id), avg(100.0 * qa.score / nullif(qa.max_score, 0))
  from managed_quizzes q
  left join public.quiz_attempts qa on qa.quiz_id = q.id
  group by q.id, q.title, q.created_at;
$$;

revoke all on function public.teacher_gradebook_rollups(integer) from public;
grant execute on function public.teacher_gradebook_rollups(integer) to authenticated;
