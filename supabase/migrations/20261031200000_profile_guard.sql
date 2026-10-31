-- Nobody makes themselves an admin, or changes what kind of account they have.
--
-- A member may update their own profile row, and no migration limits which
-- columns. So nothing here stopped is_admin = true being sent from the browser,
-- or a waiting student switching to role = 'learner', which needs no approval
-- and so counts as a member.
--
-- Overwritten rather than raised, like enforce_profile_approval. The name sorts
-- first among the BEFORE triggers, so grant_owner_admin still runs after it.
-- auth.uid() is null in the SQL editor and for edge functions: those pass, as
-- does a real admin.
--
-- Run this in the Supabase SQL editor.

create or replace function public.guard_profile_authority()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.is_admin := false;
  else
    new.is_admin := old.is_admin;
    new.role := old.role;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_profile_authority() from public;

drop trigger if exists profiles_a_guard_authority on profiles;
create trigger profiles_a_guard_authority
  before insert or update on profiles
  for each row
  execute function public.guard_profile_authority();

-- Who is an admin today: this should be you alone.
select name, role, approved, is_admin from profiles where is_admin;

-- What each write rule allows, for the tables whose rules are not in the repo.
select tablename, policyname, cmd, with_check from pg_policies
where schemaname = 'public' and cmd in ('INSERT', 'UPDATE')
  and tablename in ('profiles', 'conversation_participants', 'conversations', 'messages',
                    'payments_legacy_pre_connect', 'teaching_requests')
order by tablename, cmd;
