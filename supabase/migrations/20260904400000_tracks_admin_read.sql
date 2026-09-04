-- The admin Recordings queue was empty for everyone but the uploader: the
-- original select policy allowed "approved or own" but never the admin, so
-- pending tracks were invisible to the one person meant to review them.
-- (Update/delete already had the is_admin() clause — only select lacked it.)
drop policy if exists "tracks read approved or own" on student_tracks;
create policy "tracks read approved or own" on student_tracks
  for select to anon, authenticated using (
    status = 'approved' or user_id = auth.uid() or public.is_admin()
  );
