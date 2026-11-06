-- Cover photos replace cover videos. They go in their own public bucket,
-- images only, 8 MB each (the app shrinks them to about 1600px first), into
-- profiles.cover_photo_url, which was already there and unused.
-- Cover videos already uploaded stay in storage and in cover_video_url; the
-- app no longer shows them.
--
-- Run this in the Supabase SQL editor.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('student-covers', 'student-covers', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update
    set public = true, file_size_limit = 8388608, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "cover photo upload signed in" on storage.objects;
create policy "cover photo upload signed in" on storage.objects
  for insert to authenticated with check (bucket_id = 'student-covers');

drop policy if exists "cover photo read all" on storage.objects;
create policy "cover photo read all" on storage.objects
  for select to anon, authenticated using (bucket_id = 'student-covers');

comment on column public.profiles.cover_photo_url is
  'Public URL (student-covers bucket) of the photo shown at the top of the profile.';

-- Should list the two policies.
select policyname, cmd, roles from pg_policies
where schemaname = 'storage' and tablename = 'objects' and policyname like 'cover photo%';
