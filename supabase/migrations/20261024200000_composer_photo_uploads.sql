-- Composer portraits uploaded from Admin → Composers & pieces.
-- A public bucket (the portraits show to every signed-in user and in
-- suggestions); only admins may add, replace or delete files.
--
-- Run this in the Supabase SQL editor.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('composer-photos', 'composer-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "composer photos read" on storage.objects;
create policy "composer photos read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'composer-photos');

drop policy if exists "composer photos admin insert" on storage.objects;
create policy "composer photos admin insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'composer-photos' and public.is_admin());

drop policy if exists "composer photos admin update" on storage.objects;
create policy "composer photos admin update" on storage.objects
  for update to authenticated using (bucket_id = 'composer-photos' and public.is_admin())
  with check (bucket_id = 'composer-photos' and public.is_admin());

drop policy if exists "composer photos admin delete" on storage.objects;
create policy "composer photos admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'composer-photos' and public.is_admin());
