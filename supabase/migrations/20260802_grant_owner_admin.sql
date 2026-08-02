-- Grant the owner account admin, and make sure it is approved.
--
-- 20260717_promotions.sql already ends with this same grant. It is repeated
-- here because that one is a single statement, not a rule: it matches zero
-- rows if it runs before the profile exists, and signing up afterwards does
-- not retro-apply it. Re-running is safe and idempotent.
--
-- The client cannot do this. isAdmin reads profiles.is_admin, and every admin
-- query behind it is gated by RLS through public.is_admin(), which looks the
-- flag up for auth.uid() with security definer. A constant in the bundle would
-- put the Admin tab on screen and nothing behind it — the exact failure the
-- comment above isAdmin already records from the demo-teacher version.
--
-- Run this in the Supabase SQL editor.


-- 1. Diagnose first. Read the row this returns before running step 2:
--
--    no rows at all      -> no account with that address; sign up first
--    profile_row is null -> account exists but signup never finished, so
--                           there is no profile to flag; finish signup
--    is_admin false      -> expected before step 2; run it
--    is_admin true       -> already granted, and the problem is client-side:
--                           the profile is fetched once per session, so sign
--                           out and back in to pick the flag up
select u.id   as auth_user,
       u.email,
       p.id   as profile_row,
       p.role,
       p.approved,
       p.is_admin
  from auth.users u
  left join profiles p on p.id = u.id
 where lower(u.email) = lower('ktannous0@gmail.com');


-- 2. Grant. Matched on auth.users.email rather than a hardcoded uuid so this
-- survives the account being recreated, and lowered on both sides because
-- Postgres compares text case-sensitively while mail does not.
--
-- approved is set too. Students who verify by conservatory email are inserted
-- approved already, so that part is usually a no-op, but it covers the row
-- having been created down the document-proof path.
-- returning, so the editor shows the row it changed. Without it an update
-- reports "No rows returned" either way — that is the absence of a result set,
-- not a count, and it reads exactly like failure when it has just succeeded.
update profiles p
   set is_admin = true,
       approved = true
  from auth.users u
 where u.id = p.id
   and lower(u.email) = lower('ktannous0@gmail.com')
returning p.id, u.email, p.role, p.approved, p.is_admin;


-- 3. Confirm. Expect exactly one row, is_admin and approved both true. If this
-- returns nothing, step 1 explains which case you are in.
select p.id, u.email, p.role, p.approved, p.is_admin
  from profiles p
  join auth.users u on u.id = p.id
 where lower(u.email) = lower('ktannous0@gmail.com');
