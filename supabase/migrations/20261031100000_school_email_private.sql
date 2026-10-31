-- The school email moves out of profiles, which every member can read, into
-- profile_private, which only its owner and admins can.
--
-- profiles.conservatory_email stays as a column but holds nothing at rest. It
-- is how the address reaches the database: the signup insert carries it, the
-- approval trigger needs it in that same statement to check the proof, and
-- profile_private cannot take a row until the profile exists. So the BEFORE
-- trigger checks it, and an AFTER trigger files it in profile_private and
-- blanks the column before the statement ends. Nothing about how the app or an
-- admin writes it changes.
--
-- Since the column is now blank, enforce_profile_approval compares against
-- profile_private. An update that sends no address at the same school means
-- "unchanged": an edit from a stale client must not unapprove a member.
-- Moving school still sends the question back through the proof.
--
-- Run this in the Supabase SQL editor.

-- 20261025100000_profile_private.sql was never run on the live database, so
-- the table and its policies are created here too. Safe if it has been.
create table if not exists public.profile_private (
  id uuid primary key references public.profiles(id) on delete cascade,
  birth_date date check (birth_date > date '1900-01-01' and birth_date <= current_date),
  updated_at timestamptz not null default now()
);

alter table public.profile_private enable row level security;

drop policy if exists "own private read" on public.profile_private;
create policy "own private read" on public.profile_private
  for select to authenticated using (auth.uid() = id or public.is_admin());

drop policy if exists "own private insert" on public.profile_private;
create policy "own private insert" on public.profile_private
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists "own private update" on public.profile_private;
create policy "own private update" on public.profile_private
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

alter table public.profile_private
  add column if not exists conservatory_email text,
  alter column birth_date drop not null;

-- Owners write birth_date as before; only the trigger writes the school email.
revoke insert, update on public.profile_private from anon, authenticated;
grant insert (id, birth_date, updated_at) on public.profile_private to authenticated;
grant update (birth_date, updated_at) on public.profile_private to authenticated;

create or replace function public.enforce_profile_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(nullif(btrim(new.conservatory_email), ''));
  v_old_email text;
  v_proved boolean := false;
begin
  if public.is_admin() then
    return new;
  end if;

  if new.role is distinct from 'student' then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    select lower(p.conservatory_email) into v_old_email
      from profile_private p where p.id = new.id;

    if new.conservatory_id is not distinct from old.conservatory_id
       and (v_email is null or v_email is not distinct from v_old_email)
    then
      new.approved := old.approved;
      new.conservatory_verified := old.conservatory_verified;
      return new;
    end if;
  end if;

  if v_email is not null and new.conservatory_id is not null then
    -- A code verified for this address AND issued for this school.
    select true into v_proved
      from conservatory_email_codes c
     where c.email = v_email
       and c.conservatory_id = new.conservatory_id
       and c.verified_at is not null
       and c.verified_at > now() - interval '1 day'
     limit 1;

    if not coalesce(v_proved, false) then
      -- The account's own address, verified by Supabase at sign-in — the
      -- Google Workspace case. It still has to belong to the school, which is
      -- the check that used to be impossible here.
      select true into v_proved
        from auth.users u
       where u.id = new.id
         and lower(u.email) = v_email
         and public.email_matches_conservatory(v_email, new.conservatory_id)
       limit 1;
    end if;
  end if;

  new.conservatory_verified := coalesce(v_proved, false);
  new.approved := new.conservatory_verified;

  return new;
end;
$$;

revoke all on function public.enforce_profile_approval() from public;

create or replace function public.file_school_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(nullif(btrim(new.conservatory_email), ''));
begin
  if v_email is not null then
    insert into profile_private (id, conservatory_email)
      values (new.id, v_email)
    on conflict (id) do update
      set conservatory_email = excluded.conservatory_email, updated_at = now();
  elsif tg_op = 'UPDATE' and new.conservatory_id is distinct from old.conservatory_id then
    update profile_private set conservatory_email = null, updated_at = now() where id = new.id;
  end if;

  if new.conservatory_email is not null then
    update profiles set conservatory_email = null where id = new.id;
  end if;
  return null;
end;
$$;

revoke all on function public.file_school_email() from public;

drop trigger if exists profiles_file_school_email on profiles;
create trigger profiles_file_school_email
  after insert or update of conservatory_email, conservatory_id
  on profiles
  for each row
  execute function public.file_school_email();

-- Move what is already there: copy first, then blank. In that order, because
-- the blanking update passes through enforce_profile_approval, and an address
-- it has not seen yet would re-open approval on a proof long since pruned.
insert into profile_private (id, conservatory_email)
  select id, lower(btrim(conservatory_email))
    from profiles
   where nullif(btrim(conservatory_email), '') is not null
on conflict (id) do update
  set conservatory_email = excluded.conservatory_email, updated_at = now();

update profiles set conservatory_email = null where conservatory_email is not null;

-- Should read: public_copies 0, private_copies 1, approved_students 6.
select
  (select count(*) from profiles where conservatory_email is not null) as public_copies,
  (select count(*) from profile_private where conservatory_email is not null) as private_copies,
  (select count(*) from profiles where role = 'student' and approved) as approved_students;
