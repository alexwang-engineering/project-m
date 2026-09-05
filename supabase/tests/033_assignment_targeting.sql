begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users(id,email,aud,role) values
 ('33000000-0000-4000-8000-000000000001','target-teacher@merchanttaylors.com','authenticated','authenticated'),
 ('33000000-0000-4000-8000-000000000002','target-one@merchanttaylors.com','authenticated','authenticated'),
 ('33000000-0000-4000-8000-000000000003','target-two@merchanttaylors.com','authenticated','authenticated'),
 ('33000000-0000-4000-8000-000000000004','target-outside@merchanttaylors.com','authenticated','authenticated'),
 ('33000000-0000-4000-8000-000000000005','target-guardian@example.com','authenticated','authenticated');
insert into public.profiles(id,email,kind,state) values
 ('33000000-0000-4000-8000-000000000001','target-teacher@merchanttaylors.com','institutional','active'),
 ('33000000-0000-4000-8000-000000000002','target-one@merchanttaylors.com','institutional','active'),
 ('33000000-0000-4000-8000-000000000003','target-two@merchanttaylors.com','institutional','active'),
 ('33000000-0000-4000-8000-000000000004','target-outside@merchanttaylors.com','institutional','active'),
 ('33000000-0000-4000-8000-000000000005','target-guardian@example.com','guardian','active');
insert into public.role_assignments(profile_id,role,reason) values
 ('33000000-0000-4000-8000-000000000001','teacher','test'),
 ('33000000-0000-4000-8000-000000000002','student','test'),
 ('33000000-0000-4000-8000-000000000003','student','test'),
 ('33000000-0000-4000-8000-000000000004','student','test');
insert into public.tags(id,tag_name,display_name,created_by) values
 ('33000000-0000-4000-8000-000000000011','TARGET','Target class','33000000-0000-4000-8000-000000000001'),
 ('33000000-0000-4000-8000-000000000012','OUTSIDE','Outside class','33000000-0000-4000-8000-000000000001');
insert into public.tag_memberships(profile_id,tag_id,membership_role,source) values
 ('33000000-0000-4000-8000-000000000001','33000000-0000-4000-8000-000000000011','teacher','test'),
 ('33000000-0000-4000-8000-000000000002','33000000-0000-4000-8000-000000000011','member','test'),
 ('33000000-0000-4000-8000-000000000003','33000000-0000-4000-8000-000000000011','member','test'),
 ('33000000-0000-4000-8000-000000000004','33000000-0000-4000-8000-000000000012','member','test');
insert into public.guardian_links(pupil_id,guardian_email,guardian_profile_id,created_by,reason,activated_at) values
 ('33000000-0000-4000-8000-000000000002','target-guardian@example.com','33000000-0000-4000-8000-000000000005','33000000-0000-4000-8000-000000000001','test',now()),
 ('33000000-0000-4000-8000-000000000003','target-guardian@example.com','33000000-0000-4000-8000-000000000005','33000000-0000-4000-8000-000000000001','test',now());

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','33000000-0000-4000-8000-000000000001',true);
select is((select count(*) from public.list_assignable_students(array['33000000-0000-4000-8000-000000000011']::uuid[])),2::bigint,'teacher lists active pupils in managed tag');
select throws_ok($$ select public.create_assignment_with_audience('Injected pupil',null,now()+interval '1 day',false,array['33000000-0000-4000-8000-000000000011']::uuid[],null,array['33000000-0000-4000-8000-000000000004']::uuid[]) $$,'42501','selected pupil is outside the assignment audience','out-of-tag pupil injection is rejected');
select lives_ok($$ select public.create_assignment_with_audience('Selected assignment',null,now()+interval '1 day',false,array['33000000-0000-4000-8000-000000000011']::uuid[],null,array['33000000-0000-4000-8000-000000000002']::uuid[]) $$,'teacher creates selected-pupil assignment');
select is((select audience_mode from public.assignments where title='Selected assignment'),'selected_students','audience mode is explicit');
select lives_ok($$ select public.transition_assignment((select id from public.assignments where title='Selected assignment'),1,'published') $$,'selected assignment publishes normally');
select is((select count(*) from public.assignment_review_roster((select id from public.assignments where title='Selected assignment')))::bigint,1::bigint,'review roster contains only chosen pupil');
select is((select count(*) from public.assignment_students where assignment_id=(select id from public.assignments where title='Selected assignment'))::bigint,1::bigint,'manager can inspect selected audience');

select set_config('request.jwt.claim.sub','33000000-0000-4000-8000-000000000002',true);
select is((select count(*) from public.assignments where title='Selected assignment')::bigint,1::bigint,'chosen pupil can read assignment');
select set_config('request.jwt.claim.sub','33000000-0000-4000-8000-000000000003',true);
select is((select count(*) from public.assignments where title='Selected assignment')::bigint,0::bigint,'unchosen classmate cannot read assignment');
select is((select count(*) from public.assignment_students)::bigint,0::bigint,'unchosen pupil cannot inspect selected audience');
select set_config('request.jwt.claim.sub','33000000-0000-4000-8000-000000000005',true);
select is((select count(*) from public.guardian_view_calendar('33000000-0000-4000-8000-000000000002') where title='Selected assignment')::bigint,1::bigint,'chosen pupil guardian calendar includes assignment');
select is((select count(*) from public.guardian_view_calendar('33000000-0000-4000-8000-000000000003') where title='Selected assignment')::bigint,0::bigint,'unchosen pupil guardian calendar excludes assignment');

reset role;
delete from public.tag_memberships where profile_id='33000000-0000-4000-8000-000000000002' and tag_id='33000000-0000-4000-8000-000000000011';
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','33000000-0000-4000-8000-000000000002',true);
select is((select count(*) from public.assignments where title='Selected assignment')::bigint,0::bigint,'access ends when current tag membership ends');

select * from finish();
rollback;
