begin;
create extension if not exists pgtap with schema extensions;
select plan(4);
select lives_ok($$select public.assert_valid_content('{"schemaVersion":1,"blocks":[{"id":"video1","type":"youtube","videoId":"dQw4w9WgXcQ","title":"Lesson video"}]}'::jsonb,1)$$,'canonical YouTube ID is accepted');
select throws_ok($$select public.assert_valid_content('{"schemaVersion":1,"blocks":[{"id":"video1","type":"youtube","videoId":"https://evil.test/embed/x","title":"Bad"}]}'::jsonb,1)$$,'22023','blocks[0] is an invalid YouTube video','arbitrary iframe URL is rejected');
select throws_ok($$select public.assert_valid_content('{"schemaVersion":1,"blocks":[{"id":"video1","type":"youtube","videoId":"dQw4w9WgXcQ","title":"Lesson","src":"https://evil.test"}]}'::jsonb,1)$$,'22023','blocks[0] is an invalid YouTube video','extra embed source cannot be injected');
select throws_ok($$select public.assert_valid_content('{"schemaVersion":1,"blocks":[{"id":"video1","type":"youtube","videoId":"too-short","title":"Lesson"}]}'::jsonb,1)$$,'22023','blocks[0] is an invalid YouTube video','malformed video ID is rejected');
select * from finish(); rollback;
