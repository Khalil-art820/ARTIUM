-- Proof documents can only be uploaded by someone signed in.
--
-- The rule allowed anon because uploads once happened before the account
-- existed. Since the app went auth-first the signup flow always has a session
-- by this step, so the open door only served uploads from outside the app.
--
-- Run this in the Supabase SQL editor.

drop policy if exists "proofs upload" on storage.objects;
create policy "proofs upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'student-proofs');

-- Should show "proofs upload" with roles {authenticated}, and nothing with
-- {anon} or {public} on an INSERT.
select policyname, cmd, roles, coalesce(with_check, qual) as rule
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and coalesce(with_check, qual) like '%student-proofs%'
order by cmd, policyname;
