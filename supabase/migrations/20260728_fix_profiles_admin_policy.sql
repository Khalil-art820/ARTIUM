-- Break the recursion in the admin-update policy on profiles.
--
-- The original policy was:
--
--   create policy "profiles admin update all" on profiles
--     for update using (
--       exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin)
--     );
--
-- That is a policy ON profiles whose condition SELECTs FROM profiles. Postgres
-- applies row-level security to the inner query too, which re-enters the same
-- policy — "infinite recursion detected in policy for relation profiles". The
-- update then fails, and because the admin screen didn't check its writes, the
-- request flipped to "approved" while the student's profile never changed and
-- they kept seeing "your documents are under review".
--
-- The same shape is harmless in the student_verifications policies: those live
-- on a different table, so reading a proof document never recursed. Only the
-- policy on profiles itself is affected.
--
-- security definer runs the lookup as the function owner, outside RLS, so
-- there is nothing to recurse into. It is marked stable so the planner can
-- cache it per statement, and search_path is pinned so the function can't be
-- redirected at call time.
--
-- Run this in the Supabase SQL editor.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from profiles p where p.id = auth.uid()), false);
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "profiles admin update all" on profiles;
create policy "profiles admin update all" on profiles
  for update
  using (public.is_admin())
  with check (public.is_admin());
