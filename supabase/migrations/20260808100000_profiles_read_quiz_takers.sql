-- A teacher managing a quiz can never see who took it - quiz_attempts embeds
-- profiles(email) (lib/content/quizzes.ts), but no RLS policy on profiles
-- ever grants that read, so the join silently returns null and the UI shows
-- "Unknown student" for every real attempt. Same bug class as the
-- assignment-submissions gap Package N already closed with
-- profiles_read_submitters (20260805120000) - this extends that precedent
-- to quizzes rather than inventing a new pattern. Found live-testing a real
-- quiz attempt end to end, not by code review.

-- A teacher/manager-tier tag holder (or admin, or the quiz's own author)
-- can read the profile of a student who has attempted their quiz. Until a
-- student submits an attempt, their profile stays invisible via this path -
-- this does not turn into a general class-roster lookup, matching the same
-- boundary profiles_read_submitters already set for assignments.
create policy profiles_read_quiz_takers on public.profiles for select to authenticated
using (
  exists (
    select 1 from public.quiz_attempts a
    where a.student_id = profiles.id
      and public.can_manage_quiz(a.quiz_id)
  )
);
