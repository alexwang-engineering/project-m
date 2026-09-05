alter function public.assert_valid_content(jsonb,integer) rename to assert_valid_content_without_youtube;

create function public.assert_valid_content(payload jsonb,schema_version integer)
returns void language plpgsql stable set search_path='' as $$
declare block jsonb; block_index integer:=0;
begin
 perform public.assert_valid_content_without_youtube(
  jsonb_set(payload,'{blocks}',coalesce((select jsonb_agg(case when value->>'type'='youtube' then jsonb_build_object('id',value->>'id','type','paragraph','html','') else value end order by ordinality) from jsonb_array_elements(payload->'blocks') with ordinality),'[]'::jsonb)),schema_version);
 for block in select value from jsonb_array_elements(payload->'blocks') loop
  if block->>'type'='youtube' and (
   not public.jsonb_has_only_keys(block,array['id','type','videoId','title'])
   or coalesce(block->>'videoId','') !~ '^[A-Za-z0-9_-]{11}$'
   or coalesce(jsonb_typeof(block->'title'),'missing')<>'string'
   or length(btrim(block->>'title')) not between 1 and 500
  ) then raise exception using errcode='22023',message=format('blocks[%s] is an invalid YouTube video',block_index); end if;
  block_index:=block_index+1;
 end loop;
end;
$$;
revoke all on function public.assert_valid_content_without_youtube(jsonb,integer) from public;
revoke all on function public.assert_valid_content(jsonb,integer) from public;
