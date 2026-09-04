-- The admin's Delete button removes the recording's row AND its audio file.
-- The row delete was already allowed ("tracks delete own or admin"); the
-- bucket had no delete policy at all, so the file removal silently failed
-- and orphaned bytes. This lets the uploader or an admin delete the object.
drop policy if exists "audio delete own or admin" on storage.objects;
create policy "audio delete own or admin" on storage.objects
  for delete to authenticated using (
    bucket_id = 'student-audio' and (owner = auth.uid() or public.is_admin())
  );
