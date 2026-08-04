begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select has_function(
  'public',
  'attach_ready_file_to_page',
  array['uuid', 'uuid', 'uuid'],
  'verified files have one audited attachment boundary'
);
select has_function(
  'public',
  'get_file_download_target',
  array['uuid'],
  'private download target resolution exists'
);
select function_privs_are(
  'public',
  'attach_ready_file_to_page',
  array['uuid', 'uuid', 'uuid'],
  'authenticated',
  array['EXECUTE'],
  'authenticated users may invoke the attachment authorization boundary'
);
select function_privs_are(
  'public',
  'get_file_download_target',
  array['uuid'],
  'authenticated',
  array['EXECUTE'],
  'authenticated users may request an authorized download target'
);
select function_privs_are(
  'public',
  'attach_ready_file_to_page',
  array['uuid', 'uuid', 'uuid'],
  'public',
  array[]::text[],
  'PUBLIC cannot invoke attachment security definer'
);
select function_privs_are(
  'public',
  'get_file_download_target',
  array['uuid'],
  'public',
  array[]::text[],
  'PUBLIC cannot invoke download-target security definer'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.attach_ready_file_to_page(uuid,uuid,uuid)'::regprocedure),
  true,
  'attachment function is security definer'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.get_file_download_target(uuid)'::regprocedure),
  true,
  'download target function is security definer'
);

select * from finish();
rollback;
