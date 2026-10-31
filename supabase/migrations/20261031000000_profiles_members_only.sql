-- Other people's profiles are for members only.
--
-- The read rule on profiles was: using ((approved = true) OR (id = auth.uid())).
-- It never asked who was reading, so the public app key alone could read every
-- approved student's row without an account. The app is auth-first: nobody sees
-- anyone until they are in.
--
-- Now:
--   * you can always read your own row (signup and the waiting screen need it)
--   * a member can read approved profiles
--   * an admin can read everything (approving someone needs to find their row)
-- A member is an approved student, or a learner, who has no approval step.
-- Logged-out visitors, and students still waiting or rejected, read nobody else.
--
-- security definer for the same reason as is_admin(): a policy on profiles that
-- selects from profiles would recurse.
--
-- The original policy's name is not in this repo, so every SELECT policy on the
-- table is dropped by lookup and the three below replace them.
--
-- Run this in the Supabase SQL editor.

create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select p.approved is true or p.is_admin is true or p.role is distinct from 'student'
    from profiles p where p.id = auth.uid()
  ), false);
$$;

revoke all on function public.is_member() from public;
revoke all on function public.is_member() from anon;
grant execute on function public.is_member() to authenticated;

do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and cmd = 'SELECT'
  loop
    execute format('drop policy %I on public.profiles', r.policyname);
  end loop;
end $$;

create policy "profiles read own" on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy "profiles members read approved" on public.profiles
  for select to authenticated
  using (approved = true and public.is_member());

create policy "profiles admin read all" on public.profiles
  for select to authenticated
  using (public.is_admin());

-- Should list the three policies above, plus your insert and update ones.
-- Anything with cmd = ALL or roles {public} deserves a second look.
select policyname, cmd, roles from pg_policies
where schemaname = 'public' and tablename = 'profiles' order by cmd, policyname;
