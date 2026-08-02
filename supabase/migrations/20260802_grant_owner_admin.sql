-- Grant the owner account admin, and make sure it is approved.
--
-- The client cannot do this. isAdmin reads profiles.is_admin, and every admin
-- query behind it is gated by RLS through public.is_admin(), which looks the
-- flag up for auth.uid() with security definer. A constant in the bundle would
-- put the Admin tab on screen and nothing behind it — the exact failure the
-- comment above isAdmin already records from the demo-teacher version.
--
-- Matched on auth.users.email rather than a hardcoded uuid so this survives
-- the account being recreated, and lowered on both sides because Postgres
-- compares text case-sensitively while mail does not.
--
-- approved is set too. Students who verify by conservatory email are inserted
-- approved already, so this is normally a no-op, but it costs nothing here and
-- covers the row having been created down the document-proof path.
--
-- Run this in the Supabase SQL editor.

update profiles p
   set is_admin = true,
       approved = true
  from auth.users u
 where u.id = p.id
   and lower(u.email) = lower('ktannous0@gmail.com');

-- Confirm it landed. Expect exactly one row, is_admin and approved both true.
-- Zero rows means no profile exists for that address yet: sign up first, then
-- run the update again.
select p.id, u.email, p.role, p.approved, p.is_admin
  from profiles p
  join auth.users u on u.id = p.id
 where lower(u.email) = lower('ktannous0@gmail.com');
