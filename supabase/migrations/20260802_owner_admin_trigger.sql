-- Make the owner's admin flag survive signing up again.
--
-- is_admin defaults to false, so every new profile row starts without it. A
-- one-off update fixes the row that exists when it runs and nothing after:
-- delete the account, sign up again, and the new row is back to false. That is
-- not the update failing, it is the update having no opinion about rows that
-- do not exist yet.
--
-- A before-insert trigger does have one. Whenever a profile is created for the
-- owner's address, it is flagged as it goes in, so the grant survives the
-- account being deleted and recreated any number of times.
--
-- security definer because the check reads auth.users, which the inserting
-- user cannot see, and search_path is pinned so the function cannot be
-- redirected at call time. It grants nothing to anyone else: the condition is
-- one address, and only whoever can sign in as it ever reaches this row.
--
-- Run this in the Supabase SQL editor. Run it once — it replaces itself.

create or replace function public.grant_owner_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
      from auth.users u
     where u.id = new.id
       and lower(u.email) = lower('ktannous0@gmail.com')
  ) then
    new.is_admin := true;
    new.approved := true;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_grant_owner_admin on profiles;
create trigger profiles_grant_owner_admin
  before insert on profiles
  for each row
  execute function public.grant_owner_admin();

-- Catch the row that already exists, since the trigger only fires on insert.
update profiles p
   set is_admin = true,
       approved = true
  from auth.users u
 where u.id = p.id
   and lower(u.email) = lower('ktannous0@gmail.com')
returning p.id, u.email, p.role, p.approved, p.is_admin;
