begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

select has_function(
  'public', 'restore_page_revision', array['uuid', 'uuid', 'bigint', 'uuid'],
  'revision restore has one transactional database boundary'
);
select function_privs_are(
  'public', 'restore_page_revision', array['uuid', 'uuid', 'bigint', 'uuid'],
  'authenticated', array['EXECUTE'],
  'authenticated callers may invoke database-authorized restore'
);
select function_privs_are(
  'public', 'restore_page_revision', array['uuid', 'uuid', 'bigint', 'uuid'],
  'public', array[]::text[],
  'PUBLIC cannot invoke revision restore'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.restore_page_revision(uuid,uuid,bigint,uuid)'::regprocedure),
  true,
  'restore is security definer with authorization inside the function'
);

select * from finish();
rollback;
