begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

select volatility_is(
  'public',
  'assert_valid_content',
  array['jsonb', 'integer'],
  'stable',
  'content validation is not misdeclared immutable'
);

select lives_ok(
  $$ select public.assert_valid_content('{"schemaVersion":1,"blocks":[{"id":"p1","type":"paragraph","html":"<p>Safe <strong>text</strong></p>"}]}'::jsonb, 1) $$,
  'version-1 paragraph document is accepted'
);
select lives_ok(
  $$ select public.assert_valid_content('{"schemaVersion":1,"blocks":[{"id":"c1","type":"code","code":"<script>shown as code</script>","language":"typescript"}]}'::jsonb, 1) $$,
  'code remains literal rather than HTML-sanitized'
);
select throws_ok(
  $$ select public.assert_valid_content('{"schemaVersion":1,"blocks":[{"id":"x","type":"embed","url":"https://evil.invalid"}]}'::jsonb, 1) $$,
  '22023', 'blocks[0] has unsupported type',
  'unknown blocks fail closed'
);
select throws_ok(
  $$ select public.assert_valid_content('{"schemaVersion":1,"blocks":[{"id":"x","type":"paragraph","html":"<img src=x onerror=alert(1)>"}]}'::jsonb, 1) $$,
  '22023', 'blocks[0].html contains active content',
  'obvious active HTML is rejected inside direct RPC validation'
);
select throws_ok(
  $$ select public.assert_valid_content('{"schemaVersion":1,"blocks":[{"id":"x","type":"paragraph","html":"a"},{"id":"x","type":"paragraph","html":"b"}]}'::jsonb, 1) $$,
  '22023', 'block IDs must be unique',
  'duplicate block IDs are rejected'
);
select throws_ok(
  $$ select public.assert_valid_content('{"schemaVersion":1,"blocks":[{"id":"f","type":"file","fileId":"../../secret","label":"x"}]}'::jsonb, 1) $$,
  '22023', 'blocks[0] is an invalid file',
  'file references must be controlled UUIDs'
);

select * from finish();
rollback;
