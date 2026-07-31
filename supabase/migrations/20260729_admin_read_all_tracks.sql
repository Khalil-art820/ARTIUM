-- Let an admin see pending recordings, so they can review them.
--
-- The select policy from 20260729_student_tracks.sql is:
--
--   using (status = 'approved' or user_id = auth.uid())
--
-- which is right for visitors — you hear what's live, and a student sees
-- their own submission whatever its state. But it applies to the admin too,
-- and a review queue is by definition a list of rows that are NOT yet
-- approved and do NOT belong to the reviewer. The queue would always be
-- empty, and approving would silently change nothing, because Postgres
-- applies select policies to an UPDATE's WHERE clause and RETURNING as well.
--
-- Exactly the shape already fixed on profiles in
-- 20260728_admin_read_all_profiles.sql: permission to write was never the
-- problem, permission to find the row was.
--
-- Run this in the Supabase SQL editor.

do $$ begin
  create policy "tracks admin read all" on student_tracks
    for select to authenticated using (public.is_admin());
exception when duplicate_object then null; end $$;
