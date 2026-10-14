-- The entry gate's four cards can feature approved students the owner picks
-- in Admin → Gate cards. Stored as one platform_settings row:
--   key 'gate_featured', value {"ids": ["<profile uuid>", ...]} (max 4, in order)
-- Every signed-in account reads it (the gate shows it to all); only admins
-- write it.
insert into platform_settings (key, value)
values ('gate_featured', '{"ids": []}'::jsonb)
on conflict (key) do nothing;

drop policy if exists "Anyone signed in can read gate featured" on platform_settings;
create policy "Anyone signed in can read gate featured"
  on platform_settings for select
  to authenticated
  using (key = 'gate_featured');

drop policy if exists "Admins insert gate featured" on platform_settings;
create policy "Admins insert gate featured"
  on platform_settings for insert
  to authenticated
  with check (key = 'gate_featured' and public.is_admin());

drop policy if exists "Admins update gate featured" on platform_settings;
create policy "Admins update gate featured"
  on platform_settings for update
  to authenticated
  using (key = 'gate_featured' and public.is_admin())
  with check (key = 'gate_featured' and public.is_admin());
