begin;
create extension if not exists pgtap with schema extensions;
select plan(12);
insert into auth.users(id,email,aud,role) values
 ('34000000-0000-4000-8000-000000000001','deleted-owner@merchanttaylors.com','authenticated','authenticated'),
 ('34000000-0000-4000-8000-000000000002','deleted-other@merchanttaylors.com','authenticated','authenticated'),
 ('34000000-0000-4000-8000-000000000003','deleted-student@merchanttaylors.com','authenticated','authenticated');
insert into public.profiles(id,email,kind,state) values
 ('34000000-0000-4000-8000-000000000001','deleted-owner@merchanttaylors.com','institutional','active'),
 ('34000000-0000-4000-8000-000000000002','deleted-other@merchanttaylors.com','institutional','active'),
 ('34000000-0000-4000-8000-000000000003','deleted-student@merchanttaylors.com','institutional','active');
insert into public.role_assignments(profile_id,role,reason) values
 ('34000000-0000-4000-8000-000000000001','teacher','test'),('34000000-0000-4000-8000-000000000002','teacher','test'),('34000000-0000-4000-8000-000000000003','student','test');
insert into public.tags(id,tag_name,display_name,created_by) values('34000000-0000-4000-8000-000000000011','DELETED','Deleted test','34000000-0000-4000-8000-000000000001');
insert into public.tag_memberships(profile_id,tag_id,membership_role,source) values
 ('34000000-0000-4000-8000-000000000001','34000000-0000-4000-8000-000000000011','teacher','test'),
 ('34000000-0000-4000-8000-000000000002','34000000-0000-4000-8000-000000000011','teacher','test'),
 ('34000000-0000-4000-8000-000000000003','34000000-0000-4000-8000-000000000011','member','test');
insert into public.pages(id,slug,canonical_url,title,content_json,author_id,lifecycle,archived_at) values
 ('34000000-0000-4000-8000-000000000021','deleted-page','/deleted-page','Deleted page','{"schemaVersion":1,"blocks":[]}','34000000-0000-4000-8000-000000000001','archived',now()),
 ('34000000-0000-4000-8000-000000000022','expired-page','/expired-page','Expired page','{"schemaVersion":1,"blocks":[]}','34000000-0000-4000-8000-000000000001','archived',now()-interval '31 days');
insert into public.page_tags(page_id,tag_id,added_by) values
 ('34000000-0000-4000-8000-000000000021','34000000-0000-4000-8000-000000000011','34000000-0000-4000-8000-000000000001'),
 ('34000000-0000-4000-8000-000000000022','34000000-0000-4000-8000-000000000011','34000000-0000-4000-8000-000000000001');
insert into public.quizzes(id,title,author_id,archived_at) values('34000000-0000-4000-8000-000000000023','Deleted quiz','34000000-0000-4000-8000-000000000001',now());
insert into public.quiz_tags(quiz_id,tag_id,added_by) values('34000000-0000-4000-8000-000000000023','34000000-0000-4000-8000-000000000011','34000000-0000-4000-8000-000000000001');
insert into public.assignments(id,title,created_by,lifecycle,archived_at) values('34000000-0000-4000-8000-000000000024','Deleted assignment','34000000-0000-4000-8000-000000000001','archived',now());
insert into public.assignment_tags(assignment_id,tag_id,added_by) values('34000000-0000-4000-8000-000000000024','34000000-0000-4000-8000-000000000011','34000000-0000-4000-8000-000000000001');

set local role authenticated; select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','34000000-0000-4000-8000-000000000003',true);
select is((select count(*) from public.recently_deleted())::bigint,0::bigint,'student sees no deleted records');
select throws_ok($$select public.restore_deleted_item('page','34000000-0000-4000-8000-000000000021')$$,'42501','restore access denied','student cannot restore');
select set_config('request.jwt.claim.sub','34000000-0000-4000-8000-000000000002',true);
select is((select count(*) from public.recently_deleted())::bigint,0::bigint,'non-owner teacher sees no deleted records');
select throws_ok($$select public.restore_deleted_item('quiz','34000000-0000-4000-8000-000000000023')$$,'42501','restore access denied','non-owner teacher cannot restore');
select set_config('request.jwt.claim.sub','34000000-0000-4000-8000-000000000001',true);
select is((select count(*) from public.recently_deleted())::bigint,3::bigint,'owner sees recoverable page quiz and assignment');
select throws_ok($$select public.restore_deleted_item('page','34000000-0000-4000-8000-000000000022')$$,'55000','recovery window has expired','expired record cannot restore');
select lives_ok($$select public.restore_deleted_item('page','34000000-0000-4000-8000-000000000021')$$,'owner restores page');
select is((select lifecycle from public.pages where id='34000000-0000-4000-8000-000000000021'),'draft'::public.content_state,'page restores as private draft');
select lives_ok($$select public.restore_deleted_item('quiz','34000000-0000-4000-8000-000000000023')$$,'owner restores quiz');
select lives_ok($$select public.restore_deleted_item('assignment','34000000-0000-4000-8000-000000000024')$$,'owner restores assignment');
reset role;
select is((select count(*) from public.audit_events where action like '%.restored' and target_id in('34000000-0000-4000-8000-000000000021','34000000-0000-4000-8000-000000000023','34000000-0000-4000-8000-000000000024'))::bigint,3::bigint,'every restore is audited');
select is((select count(*) from public.page_revisions where page_id='34000000-0000-4000-8000-000000000021' and lifecycle='draft')::bigint,1::bigint,'page restore records immutable revision');
select * from finish(); rollback;
