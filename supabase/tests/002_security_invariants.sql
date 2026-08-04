begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

select has_index('public', 'tag_memberships', 'tag_memberships_current_profile_idx', 'membership authorization has a profile-first index');
select has_index('public', 'page_tags', 'page_tags_tag_idx', 'page audience lookup has a tag-first index');
select has_index('public', 'pages', 'pages_canonical_url_unique', 'canonical URL lookup is unique and indexed');

select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'pages' and cmd in ('INSERT', 'UPDATE', 'DELETE'))::bigint,
  0::bigint,
  'pages expose no direct mutation policy'
);
select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'audit_events' and cmd <> 'SELECT')::bigint,
  0::bigint,
  'audit events expose no mutation policy'
);
select is(
  (
    select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and not coalesce(p.proconfig, array[]::text[]) @> array['search_path=""']::text[]
  )::bigint,
  0::bigint,
  'every security-definer function fixes an empty search path'
);
select is(
  (
    select count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    where n.nspname = 'public' and p.prosecdef
      and acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
  )::bigint,
  0::bigint,
  'PUBLIC cannot execute security-definer functions'
);
select is(
  (select public from storage.buckets where id = 'learning-content'),
  false,
  'learning-content bucket is private'
);
select is(
  (select file_size_limit from storage.buckets where id = 'learning-content')::bigint,
  26214400::bigint,
  'storage bucket enforces the 25 MiB object limit'
);
select is(
  (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and cmd in ('UPDATE', 'DELETE'))::bigint,
  0::bigint,
  'browser roles cannot update or delete stored learning content'
);

select * from finish();
rollback;
