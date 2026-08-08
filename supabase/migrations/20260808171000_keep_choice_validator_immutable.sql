-- The field/count bounds already cap this document below 32 KiB. Avoid the
-- STABLE pg_column_size routine so this CHECK-constraint helper is truthfully
-- immutable.
create or replace function public.valid_multiple_choice_options(options jsonb)
returns boolean
language plpgsql immutable set search_path = '' as $$
declare option jsonb;
begin
  if jsonb_typeof(options) <> 'array'
    or jsonb_array_length(options) not between 2 and 8
  then
    return false;
  end if;

  for option in select value from jsonb_array_elements(options) loop
    if jsonb_typeof(option) <> 'object'
      or not public.jsonb_has_only_keys(option, array['id', 'label'])
      or coalesce(option ->> 'id', '') !~ '^[A-Za-z0-9_-]{1,64}$'
      or coalesce(jsonb_typeof(option -> 'label'), 'missing') <> 'string'
      or length(btrim(option ->> 'label')) not between 1 and 500
    then
      return false;
    end if;
  end loop;

  return (select count(*) = count(distinct value ->> 'id') from jsonb_array_elements(options));
end;
$$;
