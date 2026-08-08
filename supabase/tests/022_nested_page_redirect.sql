begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-000000001301', 'nested-teacher@merchanttaylors.com', 'authenticated', 'authenticated');
insert into public.profiles (id, email, kind) values
  ('00000000-0000-4000-8000-000000001301', 'nested-teacher@merchanttaylors.com', 'institutional');
insert into public.role_assignments (profile_id, role, reason) values
  ('00000000-0000-4000-8000-000000001301', 'teacher', 'test fixture');
insert into public.tags (id, tag_name, display_name, created_by) values
  ('91300000-0000-4000-8000-000000000001', 'NESTEDQA', 'Nested page QA', '00000000-0000-4000-8000-000000001301');
insert into public.tag_memberships (profile_id, tag_id, membership_role, source) values
  ('00000000-0000-4000-8000-000000001301', '91300000-0000-4000-8000-000000000001', 'teacher', 'test');
insert into public.pages (id, slug, canonical_url, title, content_json, author_id, lifecycle, published_at) values
  ('91300000-0000-4000-8000-000000000010', 'science', '/science', 'Science', '{"schemaVersion":1,"blocks":[]}', '00000000-0000-4000-8000-000000001301', 'published', now());
insert into public.pages (id, parent_id, slug, canonical_url, title, content_json, author_id, lifecycle, published_at) values
  ('91300000-0000-4000-8000-000000000011', '91300000-0000-4000-8000-000000000010', 'old-topic', '/science/old-topic', 'Old topic', '{"schemaVersion":1,"blocks":[]}', '00000000-0000-4000-8000-000000001301', 'published', now());
insert into public.page_tags (page_id, tag_id, added_by) values
  ('91300000-0000-4000-8000-000000000010', '91300000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000001301'),
  ('91300000-0000-4000-8000-000000000011', '91300000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000001301');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001301', true);
select lives_ok(
  $$ select public.update_page('91300000-0000-4000-8000-000000000011', 1, 'New topic', 'new-topic', '91300000-0000-4000-8000-000000000010', '{"schemaVersion":1,"blocks":[]}', 1, array['91300000-0000-4000-8000-000000000001']::uuid[]) $$,
  'an authorized teacher can rename a nested page'
);
select is((select canonical_url from public.pages where id = '91300000-0000-4000-8000-000000000011'), '/science/new-topic', 'the nested canonical path is updated');
select is((select page_id from public.canonical_redirects where old_path = '/science/old-topic'), '91300000-0000-4000-8000-000000000011'::uuid, 'the old path redirects to the moved page');
select is((select version from public.pages where id = '91300000-0000-4000-8000-000000000011'), 2::bigint, 'the successful update advances the version');

select * from finish();
rollback;
