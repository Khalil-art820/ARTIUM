-- Deleting an account should delete the person.
--
-- profiles.id is a foreign key onto auth.users, and delete-account removes the
-- auth user. If that key does not cascade, the profile survives: name, bio,
-- photo, repertoire, still on the map, still in their conservatory's roster,
-- belonging to an account that no longer exists and cannot be logged into to
-- remove it. Someone who asked to be deleted would still be listed.
--
-- Every other table that hangs off auth.users already cascades — promotions,
-- student_verifications, student_tracks all say so in their own migrations.
-- profiles was created outside the migrations, so nobody knows what it says
-- without looking, and it has never been looked at.
--
-- Safe to run whichever way it turns out: it changes nothing if the key
-- already cascades, and says which it found.
--
-- Run this in the Supabase SQL editor.

do $$
declare
  v_name text;
  v_del  char;
begin
  -- By shape, not by name. The constraint is probably profiles_id_fkey, but
  -- it was created by hand and a guessed name that does not exist would look
  -- exactly like a key that is already correct.
  select c.conname, c.confdeltype
    into v_name, v_del
    from pg_constraint c
    join pg_class      t on t.oid = c.conrelid
    join pg_class      f on f.oid = c.confrelid
    join pg_namespace  fn on fn.oid = f.relnamespace
   where t.relname = 'profiles'
     and c.contype = 'f'
     and fn.nspname = 'auth'
     and f.relname  = 'users'
   limit 1;

  if v_name is null then
    raise notice 'profiles has no foreign key onto auth.users — nothing to change. Deleting an account will not touch the profile.';
    return;
  end if;

  if v_del = 'c' then
    raise notice 'Already cascading (%). No change.', v_name;
    return;
  end if;

  raise notice 'Foreign key % had delete rule "%" — recreating it as ON DELETE CASCADE.', v_name, v_del;
  execute format('alter table profiles drop constraint %I', v_name);
  alter table profiles
    add constraint profiles_id_fkey
    foreign key (id) references auth.users(id) on delete cascade;
end $$;

-- Confirm. confdeltype 'c' is cascade; 'a' is no action, 'r' restrict.
select c.conname, c.confdeltype
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
 where t.relname = 'profiles' and c.contype = 'f';

-- Worth knowing, though not changed here: anything that references profiles.id
-- in turn has to allow the delete, or removing an account fails instead of
-- cascading. This lists them and their rules — all should be 'c'.
--
--   select t.relname as child, c.conname, c.confdeltype
--     from pg_constraint c
--     join pg_class t on t.oid = c.conrelid
--     join pg_class f on f.oid = c.confrelid
--    where f.relname = 'profiles' and c.contype = 'f';
--
-- Storage is separate and cascades from none of this: uploaded proofs live in
-- the student-proofs bucket and outlive the account. That is the orphaned
-- upload problem, still open.
