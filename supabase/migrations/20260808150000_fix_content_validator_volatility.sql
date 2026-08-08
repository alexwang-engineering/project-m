-- assert_valid_content calls PostgreSQL STABLE routines such as format().
-- Match the least-volatile dependency so the planner never treats validation
-- as immutable across statements.
alter function public.assert_valid_content(jsonb, integer) stable;
