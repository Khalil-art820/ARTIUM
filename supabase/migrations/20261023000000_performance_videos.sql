-- Performance videos: sign-up step 5 asks every conservatory student for up
-- to three videos (a minute each, at least one). The files go to the existing
-- student-video bucket under performances/; the profile keeps their URLs.
--
-- Run this in the Supabase SQL editor BEFORE the app update that writes it —
-- a profile save that names a missing column fails.

alter table public.profiles
  add column if not exists performance_videos text[] not null default '{}';

comment on column public.profiles.performance_videos is
  'Public URLs (student-video bucket, performances/) of up to three performance videos, each capped at 60 seconds by the client.';

-- Let a one-minute phone video through: 150 MB per file, videos only.
-- (The project-wide upload limit in Storage settings must be at least this
-- too — on the Free plan it is 50 MB and cannot be raised.)
update storage.buckets
   set file_size_limit = 157286400,
       allowed_mime_types = array['video/*']
 where id = 'student-video';
