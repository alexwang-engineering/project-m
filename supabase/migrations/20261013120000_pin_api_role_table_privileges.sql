-- Makes the anon/authenticated table privileges explicit instead of relying on
-- whatever default privileges the Supabase platform image applies.
--
-- Every write in this schema routes through audited SECURITY DEFINER
-- functions; the API roles were only ever meant to hold the explicit SELECT
-- grants issued by earlier migrations (see 20260804240000). The pgTAP suite
-- asserts this ("direct table update cannot bypass ..." expects 42501). Newer
-- Supabase local stacks grant ALL on new public tables to anon/authenticated
-- by default, so a direct UPDATE stopped being rejected at the privilege layer
-- and was left to RLS alone. Hosted projects have long applied the same
-- defaults, so this also closes the gap in production.
--
-- Approach: drop every table/sequence privilege the API roles hold, stop future
-- tables inheriting platform defaults, then re-issue exactly the SELECT grants
-- the earlier migrations declared. Tables with no grant below
-- (institutional_auth_config, mis_roster_intents, content_migration_imports,
-- search_rate_limits) stay unreachable to the API roles, as intended.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;

-- Public pages (also carry an anon read policy).
grant select on public.pages to anon, authenticated;
grant select on public.page_tags to anon, authenticated;
grant select on public.canonical_redirects to anon, authenticated;

grant select on public.profiles to authenticated;
grant select on public.role_assignments to authenticated;
grant select on public.tags to authenticated;
grant select on public.tag_memberships to authenticated;
grant select on public.page_editors to authenticated;
grant select on public.page_revisions to authenticated;
grant select on public.files to authenticated;
grant select on public.page_files to authenticated;
grant select on public.audit_events to authenticated;

grant select on public.assignments to authenticated;
grant select on public.assignment_tags to authenticated;
grant select on public.assignment_submissions to authenticated;
grant select on public.assignment_grades to authenticated;
grant select on public.assignment_students to authenticated;
grant select (assignment_id, student_id, extended_due_at, withdrawn_at)
  on public.assignment_exceptions to authenticated;

grant select on public.quizzes to authenticated;
grant select on public.quiz_tags to authenticated;
grant select on public.quiz_questions to authenticated;
grant select on public.quiz_answer_keys to authenticated;
grant select on public.quiz_attempts to authenticated;

grant select on public.calendar_events to authenticated;
grant select on public.calendar_event_tags to authenticated;
grant select on public.announcements to authenticated;
grant select on public.announcement_tags to authenticated;
grant select on public.guardian_links to authenticated;
grant select on public.question_bank_items to authenticated;
grant select on public.question_bank_item_tags to authenticated;
