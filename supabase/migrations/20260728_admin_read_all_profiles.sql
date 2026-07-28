-- Let an admin see unapproved profiles, so they can approve them.
--
-- The SELECT policies on profiles are:
--
--   using ((approved = true) OR (id = auth.uid()))
--
-- which is right for students browsing the map — you see people who are live,
-- plus yourself. But it also applies to the admin, and Postgres applies SELECT
-- policies to an UPDATE's WHERE clause and RETURNING. So "approve this
-- student" became: find a row whose approved is false, using a policy that
-- only reveals rows whose approved is true. The row was never found, zero rows
-- were updated, and the student stayed on "your documents are under review".
--
-- A catch-22: you could only approve people who were already approved.
--
-- The admin UPDATE policy was never the problem — permission to write was
-- fine, permission to *find the row* was missing. Policies are permissive and
-- OR together, so this widens reads for admins only and leaves the student
-- rule untouched.
--
-- Run this in the Supabase SQL editor.

create policy "profiles admin read all" on profiles
  for select
  using (public.is_admin());
