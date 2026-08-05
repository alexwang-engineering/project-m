-- Fixes a real bug found by actually running the pgTAP suite for the first
-- time (previously only statically reviewed): RLS policies restrict which
-- rows a role can see, but Postgres checks base table-level privileges
-- *before* evaluating any RLS policy. Without these GRANTs, every SELECT
-- against these tables fails with "permission denied for table X" for every
-- authenticated/anon caller, regardless of how correct the RLS policy is.
-- Column privileges are intentionally omitted where a table has none of its
-- own INSERT/UPDATE/DELETE policies (all writes route through the audited
-- SECURITY DEFINER functions in prior migrations), so only SELECT is granted.

grant select on public.profiles to authenticated;
grant select on public.role_assignments to authenticated;
grant select on public.tags to authenticated;
grant select on public.tag_memberships to authenticated;
grant select on public.page_editors to authenticated;
grant select on public.page_revisions to authenticated;
grant select on public.files to authenticated;
grant select on public.page_files to authenticated;
grant select on public.audit_events to authenticated;

-- These three tables also carry an `anon` read policy (public pages).
grant select on public.pages to anon, authenticated;
grant select on public.page_tags to anon, authenticated;
grant select on public.canonical_redirects to anon, authenticated;
