-- Found while seeding demo data for a real live walkthrough (not caught by
-- pgTAP, which simulates callers at the `authenticated` role and never
-- exercises a real service-role client): service_role has BYPASSRLS at the
-- role level, but Postgres still checks base table grants before RLS is
-- even evaluated - the exact bug class the 20260804240000 migration closed
-- for authenticated/anon. service_role had no DML grants on any table here,
-- meaning every server-side privileged operation that actually needs it
-- (completeFileUpload marking an upload ready being the concrete example)
-- would fail with "permission denied" the first time it really ran.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant usage on schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
