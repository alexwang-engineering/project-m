-- Package V (ADR-016): coverage for the search_vector columns/GIN indexes
-- from 20260807080000_search.sql. No new RPC exists to test - the property
-- under test is that plain authenticated selects using @@ websearch_to_tsquery
-- against these columns still go through each table's own existing RLS
-- select policy, so a principal never sees a result their own read
-- authorization would deny them.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-000000001101', 'search-admin@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000001102', 'search-member@merchanttaylors.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000001103', 'search-outsider@merchanttaylors.com', 'authenticated', 'authenticated');

insert into public.profiles (id, email, kind, state) values
  ('00000000-0000-0000-0000-000000001101', 'search-admin@merchanttaylors.com', 'institutional', 'active'),
  ('00000000-0000-0000-0000-000000001102', 'search-member@merchanttaylors.com', 'institutional', 'active'),
  ('00000000-0000-0000-0000-000000001103', 'search-outsider@merchanttaylors.com', 'institutional', 'active');

insert into public.role_assignments (profile_id, role, reason) values
  ('00000000-0000-0000-0000-000000001101', 'institution_admin', 'test fixture'),
  ('00000000-0000-0000-0000-000000001102', 'student', 'test fixture'),
  ('00000000-0000-0000-0000-000000001103', 'student', 'test fixture');

insert into public.tags (id, tag_name, display_name, created_by) values
  ('91100000-0000-0000-0000-000000000001', 'Y10SEARCH', 'Year 10 Search Test', '00000000-0000-0000-0000-000000001101');

insert into public.tag_memberships (profile_id, tag_id, membership_role, source) values
  ('00000000-0000-0000-0000-000000001102', '91100000-0000-0000-0000-000000000001', 'member', 'test');

-- A published, non-public, tag-scoped page - only the tag member can read it.
insert into public.pages (id, slug, canonical_url, title, content_json, author_id, lifecycle, is_public, published_at) values
  ('91100000-0000-0000-0000-000000000010', 'photosynthesis-basics', '/photosynthesis-basics', 'Photosynthesis Basics',
   '{"schemaVersion":1,"blocks":[]}'::jsonb, '00000000-0000-0000-0000-000000001101', 'published', false, now());
insert into public.page_tags (page_id, tag_id, added_by) values
  ('91100000-0000-0000-0000-000000000010', '91100000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000001101');

-- An announcement matching only on its body, not its title - proves the
-- concatenated title+body tsvector actually indexes both fields.
insert into public.announcements (id, title, body, is_broadcast, created_by) values
  ('91100000-0000-0000-0000-000000000011', 'Reminder', 'Bring your microscope tomorrow for the lab.', false, '00000000-0000-0000-0000-000000001101');
insert into public.announcement_tags (announcement_id, tag_id, added_by) values
  ('91100000-0000-0000-0000-000000000011', '91100000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000001101');

-- An archived quiz - RLS's own archived_at check should keep it out of
-- search results without any extra filtering in the search query itself.
insert into public.quizzes (id, title, author_id, archived_at) values
  ('91100000-0000-0000-0000-000000000012', 'Old Archived Cell Biology Quiz', '00000000-0000-0000-0000-000000001101', now());
insert into public.quiz_tags (quiz_id, tag_id, added_by) values
  ('91100000-0000-0000-0000-000000000012', '91100000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000001101');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- The tag member can find the page by title.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000001102', true);
select is(
  (select count(*) from public.pages where search_vector @@ websearch_to_tsquery('english', 'photosynthesis'))::bigint,
  1::bigint,
  'a tag member finds the page by a title term'
);

-- An outsider with no tag membership and no public access finds nothing,
-- even though the row genuinely matches the text query - proving search
-- results are gated by RLS, not just by whether the term matches.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000001103', true);
select is(
  (select count(*) from public.pages where search_vector @@ websearch_to_tsquery('english', 'photosynthesis'))::bigint,
  0::bigint,
  'an outsider with no read access finds nothing, even though the row matches the query'
);

-- The institution admin can read anything, so also finds it.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000001101', true);
select is(
  (select count(*) from public.pages where search_vector @@ websearch_to_tsquery('english', 'photosynthesis'))::bigint,
  1::bigint,
  'an institution admin finds the page by title'
);

-- The tag member finds the announcement by a body-only term.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000001102', true);
select is(
  (select count(*) from public.announcements where search_vector @@ websearch_to_tsquery('english', 'microscope'))::bigint,
  1::bigint,
  'a tag member finds the announcement by a body term, not just its title'
);

-- The outsider does not, since they are not on the announcement's tag.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000001103', true);
select is(
  (select count(*) from public.announcements where search_vector @@ websearch_to_tsquery('english', 'microscope'))::bigint,
  0::bigint,
  'an outsider does not find the tag-scoped announcement'
);

-- The archived quiz never appears in search results, for anyone - RLS's
-- own archived_at check already excludes it, with no extra work needed
-- in the search query.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000001101', true);
select is(
  (select count(*) from public.quizzes where search_vector @@ websearch_to_tsquery('english', 'archived'))::bigint,
  0::bigint,
  'an archived quiz never appears in search results, even for an institution admin'
);

-- A non-matching term correctly returns nothing.
select is(
  (select count(*) from public.pages where search_vector @@ websearch_to_tsquery('english', 'nonexistentterm'))::bigint,
  0::bigint,
  'a non-matching term returns no results'
);

-- The generated column actually reflects title changes, not a stale
-- snapshot. pages has no update policy for any client role at all (only
-- update_page, a SECURITY DEFINER RPC, can mutate it) - reset to the
-- table-owning role to do this directly, same as every fixture insert
-- above already does implicitly before `set local role authenticated`.
reset role;
update public.pages set title = 'Renamed Page About Mitosis' where id = '91100000-0000-0000-0000-000000000010';
select is(
  (select count(*) from public.pages where id = '91100000-0000-0000-0000-000000000010' and search_vector @@ websearch_to_tsquery('english', 'mitosis'))::bigint,
  1::bigint,
  'the generated search_vector column updates when the title changes'
);

select * from finish();
rollback;
