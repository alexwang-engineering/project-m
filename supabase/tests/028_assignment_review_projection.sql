begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email, aud, role) values
 ('28000000-0000-4000-8000-000000000001','review-teacher@merchanttaylors.com','authenticated','authenticated'),
 ('28000000-0000-4000-8000-000000000002','review-a@merchanttaylors.com','authenticated','authenticated'),
 ('28000000-0000-4000-8000-000000000003','review-b@merchanttaylors.com','authenticated','authenticated'),
 ('28000000-0000-4000-8000-000000000004','review-outsider@merchanttaylors.com','authenticated','authenticated');
insert into public.profiles (id,email,kind,state) values
 ('28000000-0000-4000-8000-000000000001','review-teacher@merchanttaylors.com','institutional','active'),
 ('28000000-0000-4000-8000-000000000002','review-a@merchanttaylors.com','institutional','active'),
 ('28000000-0000-4000-8000-000000000003','review-b@merchanttaylors.com','institutional','active'),
 ('28000000-0000-4000-8000-000000000004','review-outsider@merchanttaylors.com','institutional','active');
insert into public.role_assignments (profile_id,role,reason) values
 ('28000000-0000-4000-8000-000000000001','teacher','test'),
 ('28000000-0000-4000-8000-000000000002','student','test'),
 ('28000000-0000-4000-8000-000000000003','student','test'),
 ('28000000-0000-4000-8000-000000000004','teacher','test');
insert into public.tags (id,tag_name,display_name,created_by) values
 ('28000000-0000-4000-8000-000000000011','Y9REVIEW','Review','28000000-0000-4000-8000-000000000001');
insert into public.tag_memberships (profile_id,tag_id,membership_role,source) values
 ('28000000-0000-4000-8000-000000000001','28000000-0000-4000-8000-000000000011','teacher','test'),
 ('28000000-0000-4000-8000-000000000002','28000000-0000-4000-8000-000000000011','member','test'),
 ('28000000-0000-4000-8000-000000000003','28000000-0000-4000-8000-000000000011','member','test');
insert into public.assignments (id,title,created_by,lifecycle,published_at) values
 ('28000000-0000-4000-8000-000000000021','Review projection','28000000-0000-4000-8000-000000000001','published',now());
insert into public.assignment_tags (assignment_id,tag_id,added_by) values
 ('28000000-0000-4000-8000-000000000021','28000000-0000-4000-8000-000000000011','28000000-0000-4000-8000-000000000001');
insert into public.files (id,owner_id,original_name,media_type,size_bytes,sha256,bucket_id,object_name,state) values
 ('28000000-0000-4000-8000-000000000031','28000000-0000-4000-8000-000000000002','work.pdf','application/pdf',1,repeat('a',64),'uploads','test/work.pdf','ready');
insert into public.assignment_submissions (id,assignment_id,student_id,file_id,note) values
 ('28000000-0000-4000-8000-000000000041','28000000-0000-4000-8000-000000000021','28000000-0000-4000-8000-000000000002','28000000-0000-4000-8000-000000000031','my note');
insert into public.assignment_grades (submission_id,grade,feedback,graded_by,released_by,released_at) values
 ('28000000-0000-4000-8000-000000000041',88,'Clear work','28000000-0000-4000-8000-000000000001','28000000-0000-4000-8000-000000000001',now());
insert into public.audit_events (actor_id,action,target_type,target_id,source) values
 ('28000000-0000-4000-8000-000000000001','assignment_grade.released','assignment_submission','28000000-0000-4000-8000-000000000041','test');

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','28000000-0000-4000-8000-000000000001',true);
select is((select count(*) from public.assignment_review_roster('28000000-0000-4000-8000-000000000021')),2::bigint,'roster contains both managed pupils');
select is((select status from public.assignment_review_roster('28000000-0000-4000-8000-000000000021') where student_id='28000000-0000-4000-8000-000000000002'),'released','released state is projected');
select is((select status from public.assignment_review_roster('28000000-0000-4000-8000-000000000021') where student_id='28000000-0000-4000-8000-000000000003'),'not_submitted','missing receipt is explicit');
select is((select submission_note from public.assignment_review_roster('28000000-0000-4000-8000-000000000021') where student_id='28000000-0000-4000-8000-000000000002'),'my note','submission note is projected');
select is((select count(*) from public.assignment_submission_timeline('28000000-0000-4000-8000-000000000041')),2::bigint,'timeline contains receipt and release events');
select set_config('request.jwt.claim.sub','28000000-0000-4000-8000-000000000004',true);
select throws_ok($$ select * from public.assignment_review_roster('28000000-0000-4000-8000-000000000021') $$,'42501','assignment access denied','unassigned teacher cannot inspect roster');
reset role;
update public.profiles set state = 'disabled', disabled_at = now() where id = '28000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','28000000-0000-4000-8000-000000000001',true);
select throws_ok($$ select * from public.assignment_review_roster('28000000-0000-4000-8000-000000000021') $$,'42501','assignment access denied','suspended teacher cannot inspect roster');

select * from finish();
rollback;
