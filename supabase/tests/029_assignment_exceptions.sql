begin;
create extension if not exists pgtap with schema extensions;
select plan(9);
insert into auth.users(id,email,aud,role) values
 ('29000000-0000-4000-8000-000000000001','exception-teacher@merchanttaylors.com','authenticated','authenticated'),
 ('29000000-0000-4000-8000-000000000002','exception-student@merchanttaylors.com','authenticated','authenticated'),
 ('29000000-0000-4000-8000-000000000003','exception-outsider@merchanttaylors.com','authenticated','authenticated');
insert into public.profiles(id,email,kind,state) values
 ('29000000-0000-4000-8000-000000000001','exception-teacher@merchanttaylors.com','institutional','active'),
 ('29000000-0000-4000-8000-000000000002','exception-student@merchanttaylors.com','institutional','active'),
 ('29000000-0000-4000-8000-000000000003','exception-outsider@merchanttaylors.com','institutional','active');
insert into public.role_assignments(profile_id,role,reason) values
 ('29000000-0000-4000-8000-000000000001','teacher','test'),('29000000-0000-4000-8000-000000000002','student','test'),('29000000-0000-4000-8000-000000000003','teacher','test');
insert into public.tags(id,tag_name,display_name,created_by) values('29000000-0000-4000-8000-000000000011','Y9EXCEPT','Exceptions','29000000-0000-4000-8000-000000000001');
insert into public.tag_memberships(profile_id,tag_id,membership_role,source) values
 ('29000000-0000-4000-8000-000000000001','29000000-0000-4000-8000-000000000011','teacher','test'),
 ('29000000-0000-4000-8000-000000000002','29000000-0000-4000-8000-000000000011','member','test');
insert into public.assignments(id,title,due_at,created_by,lifecycle,published_at) values('29000000-0000-4000-8000-000000000021','Exception test',now()+interval '1 day','29000000-0000-4000-8000-000000000001','published',now());
insert into public.assignment_tags(assignment_id,tag_id,added_by) values('29000000-0000-4000-8000-000000000021','29000000-0000-4000-8000-000000000011','29000000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','29000000-0000-4000-8000-000000000001',true);
select lives_ok($$ select public.set_assignment_exception('29000000-0000-4000-8000-000000000021','29000000-0000-4000-8000-000000000002',now()+interval '2 days',false,'approved absence') $$,'managed teacher can grant extension');
select ok((select extended_due_at > now()+interval '1 day' from public.assignment_exceptions where assignment_id='29000000-0000-4000-8000-000000000021'),'extension is stored separately');
select is((select status from public.assignment_review_roster('29000000-0000-4000-8000-000000000021')),'not_submitted','extension does not fabricate a receipt');
select throws_ok($$ select public.set_assignment_exception('29000000-0000-4000-8000-000000000021','29000000-0000-4000-8000-000000000002',now(),false,'bad') $$,'22023','an extension must be after the class due date','shortened deadline is rejected');
select lives_ok($$ select public.set_assignment_exception('29000000-0000-4000-8000-000000000021','29000000-0000-4000-8000-000000000002',null,true,'moved class') $$,'managed teacher can withdraw pupil');
select set_config('request.jwt.claim.sub','29000000-0000-4000-8000-000000000002',true);
select is((select count(*) from public.assignments where id='29000000-0000-4000-8000-000000000021')::bigint,0::bigint,'withdrawn pupil cannot discover assignment');
select throws_ok($$ select reason from public.assignment_exceptions where assignment_id='29000000-0000-4000-8000-000000000021' $$,'42501',null,'pupil cannot query the internal exception reason');
select set_config('request.jwt.claim.sub','29000000-0000-4000-8000-000000000003',true);
select throws_ok($$ select public.set_assignment_exception('29000000-0000-4000-8000-000000000021','29000000-0000-4000-8000-000000000002',null,true,'spoof') $$,'42501','assignment access denied','unassigned teacher cannot change exception');
reset role;
select is((select count(*) from public.audit_events where target_id='29000000-0000-4000-8000-000000000021' and action like 'assignment_exception.%')::bigint,2::bigint,'each accepted exception change is audited');
select * from finish();
rollback;
