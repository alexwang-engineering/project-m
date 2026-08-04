-- Enforce the version-1 block envelope inside direct mutation RPCs. The
-- application still performs DOM-based allow-list sanitization; these checks
-- ensure bypassing Next.js cannot store unknown blocks or obvious active HTML.

create or replace function public.jsonb_has_only_keys(value jsonb, allowed text[])
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(value) = 'object'
    and not exists (select 1 from jsonb_object_keys(value) key where not key = any(allowed));
$$;

create or replace function public.assert_safe_rich_html(value jsonb, field_path text)
returns void language plpgsql immutable set search_path = '' as $$
declare html text;
begin
  if coalesce(jsonb_typeof(value), 'missing') <> 'string' then
    raise exception using errcode = '22023', message = field_path || ' must be a string';
  end if;
  html := value #>> '{}';
  if length(html) > 100000 then
    raise exception using errcode = '22001', message = field_path || ' exceeds 100000 characters';
  end if;
  if html ~* '<[[:space:]]*(script|style|svg|math|iframe|object|embed|form|input|button|textarea|select)([[:space:]]|/|>)'
    or html ~* '[[:space:]]on[a-z0-9_-]+[[:space:]]*='
    or html ~* '(javascript|vbscript)[[:space:]]*:'
    or html ~* 'data[[:space:]]*:[[:space:]]*text/html' then
    raise exception using errcode = '22023', message = field_path || ' contains active content';
  end if;
end;
$$;

create or replace function public.assert_valid_content(payload jsonb, schema_version integer)
returns void language plpgsql immutable set search_path = '' as $$
declare block jsonb; block_index integer := 0; block_type text; item jsonb;
begin
  if schema_version <> 1 or coalesce(jsonb_typeof(payload), 'missing') <> 'object'
    or not coalesce(payload -> 'schemaVersion' = '1'::jsonb, false)
    or coalesce(jsonb_typeof(payload -> 'blocks'), 'missing') <> 'array'
    or not public.jsonb_has_only_keys(payload, array['schemaVersion', 'blocks']) then
    raise exception using errcode = '22023', message = 'invalid editor document envelope';
  end if;
  if jsonb_array_length(payload -> 'blocks') > 200 then
    raise exception using errcode = '22023', message = 'editor document exceeds 200 blocks';
  end if;
  if pg_column_size(payload) > 1048576 then
    raise exception using errcode = '22001', message = 'content exceeds 1 MiB';
  end if;

  for block in select value from jsonb_array_elements(payload -> 'blocks') loop
    if jsonb_typeof(block) <> 'object' or coalesce(block ->> 'id', '') !~ '^[A-Za-z0-9_-]{1,64}$' then
      raise exception using errcode = '22023', message = format('blocks[%s] has an invalid ID', block_index);
    end if;
    block_type := block ->> 'type';
    case block_type
      when 'paragraph' then
        if not public.jsonb_has_only_keys(block, array['id','type','html']) then raise exception using errcode = '22023', message = format('blocks[%s] has unknown fields', block_index); end if;
        perform public.assert_safe_rich_html(block -> 'html', format('blocks[%s].html', block_index));
      when 'heading' then
        if not public.jsonb_has_only_keys(block, array['id','type','level','html']) or not coalesce(block -> 'level' in ('2'::jsonb,'3'::jsonb,'4'::jsonb), false) then raise exception using errcode = '22023', message = format('blocks[%s] is an invalid heading', block_index); end if;
        perform public.assert_safe_rich_html(block -> 'html', format('blocks[%s].html', block_index));
      when 'list' then
        if not public.jsonb_has_only_keys(block, array['id','type','ordered','items'])
          or coalesce(jsonb_typeof(block -> 'ordered'),'missing') <> 'boolean' or coalesce(jsonb_typeof(block -> 'items'),'missing') <> 'array'
          or jsonb_array_length(block -> 'items') not between 1 and 100 then raise exception using errcode = '22023', message = format('blocks[%s] is an invalid list', block_index); end if;
        for item in select value from jsonb_array_elements(block -> 'items') loop
          perform public.assert_safe_rich_html(item, format('blocks[%s].items', block_index));
        end loop;
      when 'quote' then
        if not public.jsonb_has_only_keys(block, array['id','type','html','attribution'])
          or (block ? 'attribution' and (jsonb_typeof(block -> 'attribution') <> 'string' or length(btrim(block ->> 'attribution')) not between 1 and 500)) then raise exception using errcode = '22023', message = format('blocks[%s] is an invalid quote', block_index); end if;
        perform public.assert_safe_rich_html(block -> 'html', format('blocks[%s].html', block_index));
      when 'code' then
        if not public.jsonb_has_only_keys(block, array['id','type','code','language'])
          or coalesce(jsonb_typeof(block -> 'code'),'missing') <> 'string' or length(block ->> 'code') > 100000
          or (block ? 'language' and coalesce(block ->> 'language','') !~ '^[A-Za-z0-9_+#.-]{1,32}$') then raise exception using errcode = '22023', message = format('blocks[%s] is invalid code', block_index); end if;
      when 'callout' then
        if not public.jsonb_has_only_keys(block, array['id','type','tone','title','html'])
          or not coalesce(block ->> 'tone' in ('neutral','info','warning'), false)
          or (block ? 'title' and (jsonb_typeof(block -> 'title') <> 'string' or length(btrim(block ->> 'title')) not between 1 and 500)) then raise exception using errcode = '22023', message = format('blocks[%s] is an invalid callout', block_index); end if;
        perform public.assert_safe_rich_html(block -> 'html', format('blocks[%s].html', block_index));
      when 'file' then
        if not public.jsonb_has_only_keys(block, array['id','type','fileId','label'])
          or coalesce(block ->> 'fileId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          or coalesce(jsonb_typeof(block -> 'label'),'missing') <> 'string' or length(btrim(block ->> 'label')) not between 1 and 500 then raise exception using errcode = '22023', message = format('blocks[%s] is an invalid file', block_index); end if;
      when 'image' then
        if not public.jsonb_has_only_keys(block, array['id','type','fileId','alt','captionHtml'])
          or coalesce(block ->> 'fileId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          or coalesce(jsonb_typeof(block -> 'alt'),'missing') <> 'string' or length(btrim(block ->> 'alt')) not between 1 and 1000 then raise exception using errcode = '22023', message = format('blocks[%s] is an invalid image', block_index); end if;
        if block ? 'captionHtml' then perform public.assert_safe_rich_html(block -> 'captionHtml', format('blocks[%s].captionHtml', block_index)); end if;
      else
        raise exception using errcode = '22023', message = format('blocks[%s] has unsupported type', block_index);
    end case;
    block_index := block_index + 1;
  end loop;

  if exists (
    select 1 from jsonb_array_elements(payload -> 'blocks') element(value)
    group by element.value ->> 'id' having count(*) > 1
  ) then raise exception using errcode = '22023', message = 'block IDs must be unique'; end if;
end;
$$;

revoke all on function public.jsonb_has_only_keys(jsonb, text[]) from public;
revoke all on function public.assert_safe_rich_html(jsonb, text) from public;
revoke all on function public.assert_valid_content(jsonb, integer) from public;
