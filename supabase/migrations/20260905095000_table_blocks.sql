alter function public.assert_valid_content(jsonb,integer) rename to assert_valid_content_without_tables;

create function public.assert_valid_content(payload jsonb,schema_version integer)
returns void language plpgsql stable set search_path='' as $$
declare block jsonb; row_value jsonb; cell jsonb; block_index integer:=0; column_count integer;
begin
 if pg_column_size(payload)>1048576 then raise exception using errcode='22001',message='content exceeds 1 MiB'; end if;
 perform public.assert_valid_content_without_tables(
  jsonb_set(payload,'{blocks}',coalesce((select jsonb_agg(case when value->>'type'='table' then jsonb_build_object('id',value->>'id','type','paragraph','html','') else value end order by ordinality) from jsonb_array_elements(payload->'blocks') with ordinality), '[]'::jsonb)),
  schema_version);
 for block in select value from jsonb_array_elements(payload->'blocks') loop
  if block->>'type'='table' then
   if not public.jsonb_has_only_keys(block,array['id','type','caption','headers','rows'])
    or coalesce(jsonb_typeof(block->'caption'),'missing')<>'string' or length(btrim(block->>'caption')) not between 1 and 500
    or coalesce(jsonb_typeof(block->'headers'),'missing')<>'array' or jsonb_array_length(block->'headers') not between 1 and 12
    or coalesce(jsonb_typeof(block->'rows'),'missing')<>'array' or jsonb_array_length(block->'rows') not between 1 and 100
   then raise exception using errcode='22023',message=format('blocks[%s] is an invalid table',block_index); end if;
   column_count:=jsonb_array_length(block->'headers');
   for cell in select value from jsonb_array_elements(block->'headers') loop
    perform public.assert_safe_rich_html(cell,format('blocks[%s].headers',block_index));
   end loop;
   for row_value in select value from jsonb_array_elements(block->'rows') loop
    if jsonb_typeof(row_value)<>'array' or jsonb_array_length(row_value)<>column_count then raise exception using errcode='22023',message=format('blocks[%s] table rows must match header width',block_index); end if;
    for cell in select value from jsonb_array_elements(row_value) loop
     perform public.assert_safe_rich_html(cell,format('blocks[%s].rows',block_index));
    end loop;
   end loop;
  end if;
  block_index:=block_index+1;
 end loop;
end;
$$;
revoke all on function public.assert_valid_content_without_tables(jsonb,integer) from public;
revoke all on function public.assert_valid_content(jsonb,integer) from public;
