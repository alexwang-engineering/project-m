create function public.can_restore_deleted(item_kind text,item_id uuid,actor uuid)
returns boolean language sql stable security definer set search_path='' as $$
select public.is_active_principal(actor) and (
 public.has_system_role('institution_admin',actor) or
 (public.has_system_role('teacher',actor) and case item_kind
  when 'page' then exists(select 1 from public.pages p where p.id=item_id and p.author_id=actor and p.lifecycle='archived'
    and exists(select 1 from public.page_tags pt where pt.page_id=p.id)
    and not exists(select 1 from public.page_tags pt where pt.page_id=p.id and not public.has_tag_membership(pt.tag_id,array['teacher','manager']::public.membership_role[],actor)))
  when 'quiz' then exists(select 1 from public.quizzes q where q.id=item_id and q.author_id=actor and q.archived_at is not null
    and exists(select 1 from public.quiz_tags qt where qt.quiz_id=q.id)
    and not exists(select 1 from public.quiz_tags qt where qt.quiz_id=q.id and not public.has_tag_membership(qt.tag_id,array['teacher','manager']::public.membership_role[],actor)))
  when 'assignment' then exists(select 1 from public.assignments a where a.id=item_id and a.created_by=actor and a.lifecycle='archived'
    and exists(select 1 from public.assignment_tags at where at.assignment_id=a.id)
    and not exists(select 1 from public.assignment_tags at where at.assignment_id=a.id and not public.has_tag_membership(at.tag_id,array['teacher','manager']::public.membership_role[],actor)))
  else false end))
$$;
revoke all on function public.can_restore_deleted(text,uuid,uuid) from public;

create function public.recently_deleted()
returns table(item_kind text,item_id uuid,title text,deleted_at timestamptz,restore_until timestamptz)
language sql stable security definer set search_path='' as $$
 select 'page',p.id,p.title,p.archived_at,p.archived_at+interval '30 days' from public.pages p
 where p.lifecycle='archived' and p.archived_at>=now()-interval '30 days' and public.can_restore_deleted('page',p.id,auth.uid())
 union all
 select 'quiz',q.id,q.title,q.archived_at,q.archived_at+interval '30 days' from public.quizzes q
 where q.archived_at>=now()-interval '30 days' and public.can_restore_deleted('quiz',q.id,auth.uid())
 union all
 select 'assignment',a.id,a.title,a.archived_at,a.archived_at+interval '30 days' from public.assignments a
 where a.lifecycle='archived' and a.archived_at>=now()-interval '30 days' and public.can_restore_deleted('assignment',a.id,auth.uid())
 order by 4 desc limit 200
$$;
revoke all on function public.recently_deleted() from public;
grant execute on function public.recently_deleted() to authenticated;

create function public.restore_deleted_item(item_kind text,item_id uuid,correlation_id uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); deleted_at timestamptz; page_row public.pages;
begin
 if item_kind not in('page','quiz','assignment') then raise exception using errcode='22023',message='unsupported deleted item type'; end if;
 if item_kind='page' then
  select * into page_row from public.pages where id=item_id for update;
  deleted_at:=page_row.archived_at;
 elsif item_kind='quiz' then
  select archived_at into deleted_at from public.quizzes where id=item_id for update;
 else
  select archived_at into deleted_at from public.assignments where id=item_id for update;
 end if;
 if deleted_at is null then raise exception using errcode='P0002',message='deleted item not found'; end if;
 if deleted_at<now()-interval '30 days' then raise exception using errcode='55000',message='recovery window has expired'; end if;
 if not public.can_restore_deleted(item_kind,item_id,actor) then raise exception using errcode='42501',message='restore access denied'; end if;
 if item_kind='page' then
  if exists(select 1 from public.pages p where p.id<>item_id and p.lifecycle<>'archived' and p.canonical_url=page_row.canonical_url) then
   raise exception using errcode='23505',message='canonical path is already in use';
  end if;
  if exists(select 1 from public.pages parent where parent.id=page_row.parent_id and parent.lifecycle='archived') then
   raise exception using errcode='55000',message='restore the parent page first';
  end if;
  update public.pages set lifecycle='draft',archived_at=null,published_at=null,is_public=false,version=version+1 where id=item_id returning * into page_row;
  insert into public.page_revisions(page_id,version,title,content_json,content_schema_version,lifecycle,actor_id)
   values(page_row.id,page_row.version,page_row.title,page_row.content_json,page_row.content_schema_version,page_row.lifecycle,actor);
 elsif item_kind='quiz' then update public.quizzes set archived_at=null where id=item_id;
 else update public.assignments set lifecycle='draft',archived_at=null,published_at=null,closed_at=null,version=version+1 where id=item_id;
 end if;
 insert into public.audit_events(actor_id,action,target_type,target_id,correlation_id,source,before_data,after_data)
 values(actor,item_kind||'.restored',item_kind,item_id,correlation_id,'app',jsonb_build_object('archived_at',deleted_at),jsonb_build_object('state',case when item_kind='quiz' then 'active' else 'draft' end));
end;
$$;
revoke all on function public.restore_deleted_item(text,uuid,uuid) from public;
grant execute on function public.restore_deleted_item(text,uuid,uuid) to authenticated;
