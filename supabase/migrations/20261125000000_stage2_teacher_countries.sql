-- Stage 2 of docs/international-teacher-onboarding-plan.md (the plan's
-- "teacher stage 1", the free profile): the three countries a teacher
-- declares, and a private phone number.
--
--   1. teacher_compliance: one row per teacher, holding residence,
--      professional establishment and tax residence. Later stages add the
--      professional-verification and status columns to this same table, which
--      is why the API grants below are per column: a column added later is NOT
--      writable by the teacher until a migration grants it, so a status field
--      can never be self-approved by accident.
--   2. profile_private.phone: where the phone goes, never in profiles (every
--      member can read profiles).
--
-- Vocabulary: "teacher" is profiles.role 'student' (a conservatory student
-- who teaches), "learner" is role 'learner' (the paying member).
--
-- Run this in the Supabase SQL editor, after 20261124000000 and
-- 20261124100000. Run it BEFORE deploying the frontend that writes these
-- columns.
--
-- RE-RUNNING: safe now, and only now. Do not re-run after Stage 3+
-- migrations: the grants on teacher_compliance are set only when the table is
-- first created (below), so a re-run leaves them alone, but if you ever
-- change that block, remember that "revoke all" resets later column grants.
-- The profile_private part at the end is additive and always safe.

-- ---------------------------------------------------------------------
-- 1. teacher_compliance
-- ---------------------------------------------------------------------
-- on delete cascade: rows go with the profile (delete-account), which is also
-- why there is no DELETE through the API.
-- The countries are nullable: a teacher may save the rest of the profile
-- before choosing them. Nothing here is a payment gate; that is a later
-- stage, checked on the server.
--
-- Creation and privileges are one block that runs only when the table does
-- not exist yet. "revoke all" also strips COLUMN grants, so running it on a
-- later re-run would silently undo what Stage 3+ migrations grant on the
-- columns they add.
do $stage2$
begin
  if to_regclass('public.teacher_compliance') is null then
    create table public.teacher_compliance (
      profile_id uuid primary key references public.profiles(id) on delete cascade,
      residence_country text references public.countries(iso2),
      establishment_country text references public.countries(iso2),
      tax_residence_country text references public.countries(iso2),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    -- Start from nothing. Supabase's default privileges hand anon and
    -- authenticated every right on a new table; RLS would still block most
    -- of it, but TRUNCATE and the like are not covered by RLS, and anon
    -- should not even see the table.
    revoke all on public.teacher_compliance from anon, authenticated;

    -- Reads are per column too, so a later admin-only column (verification
    -- status, review notes) is invisible to the teacher by default.
    -- FUTURE COLUMNS: need an explicit grant to be visible or writable to
    -- authenticated, and a default if NOT NULL (the teacher's insert does
    -- not list them, so a NOT NULL column without a default breaks it).
    grant select (profile_id, residence_country, establishment_country,
                  tax_residence_country, created_at, updated_at)
      on public.teacher_compliance to authenticated;

    -- Writes: profile_id is in the update grant only so that
    -- upsert(..., { onConflict: 'profile_id' }) works: PostgREST writes
    -- "SET profile_id = excluded.profile_id, ..." and that needs the
    -- privilege. It can't move a row: the policy's WITH CHECK pins profile_id
    -- to the caller. created_at / updated_at are not grantable: the default
    -- and the trigger own them.
    grant insert (profile_id, residence_country, establishment_country, tax_residence_country)
      on public.teacher_compliance to authenticated;
    grant update (profile_id, residence_country, establishment_country, tax_residence_country)
      on public.teacher_compliance to authenticated;
    -- No delete grant and no delete policy.
  end if;
end
$stage2$;

alter table public.teacher_compliance enable row level security;


-- A teacher reads and writes only their own row, and only while their profile
-- is a teacher's: a learner has no business here, and a role change away from
-- 'student' closes the door. Admins read everything and write nothing
-- through the API (corrections go through the SQL editor or a server function).
drop policy if exists "teacher compliance read" on public.teacher_compliance;
create policy "teacher compliance read" on public.teacher_compliance
  for select to authenticated using (
    public.is_admin()
    or (
      auth.uid() = profile_id
      and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'student')
    )
  );

drop policy if exists "teacher compliance insert" on public.teacher_compliance;
create policy "teacher compliance insert" on public.teacher_compliance
  for insert to authenticated with check (
    auth.uid() = profile_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'student')
  );

drop policy if exists "teacher compliance update" on public.teacher_compliance;
create policy "teacher compliance update" on public.teacher_compliance
  for update to authenticated
  using (
    auth.uid() = profile_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'student')
  )
  with check (
    auth.uid() = profile_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'student')
  );

-- Guard, same pattern as guard_learner_country in Stage 1:
--   * 'country_not_available': a country being set, or changed, to a value
--     whose teacher_registration_enabled is false (this also catches a code
--     that isn't in the table, since the check is "exists and enabled").
-- Only checked when a value is inserted or changed, so a teacher whose
-- country is closed later can still save the other fields. Null is always
-- allowed (not chosen yet).
-- security definer because countries is readable only by admins; a teacher's
-- own session could not see the flag. Applies to admins too, so a closed
-- country can't be slipped in by hand.
-- created_at is pinned so an upsert that sends it can't rewrite history.
-- plpgsql can't index a record by column name at run time, so the three
-- columns are compared through to_jsonb, new and old side by side.
create or replace function public.guard_teacher_countries()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_col text;
  v_new text;
  v_old text;
  v_existing jsonb;
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
    v_existing := to_jsonb(old);
  else
    -- PostgREST's upsert is INSERT ... ON CONFLICT DO UPDATE, and this
    -- trigger fires on the INSERT half before the conflict is resolved. So
    -- on INSERT the "old" values are whatever row already exists for this
    -- profile (none, for a genuine first save). Without this, a teacher whose
    -- saved country was closed later could not save any other field.
    select to_jsonb(t) into v_existing
      from public.teacher_compliance t
     where t.profile_id = new.profile_id;
  end if;

  foreach v_col in array array['residence_country', 'establishment_country', 'tax_residence_country'] loop
    v_new := to_jsonb(new) ->> v_col;
    v_old := v_existing ->> v_col;

    if v_new is not null and v_new is distinct from v_old then
      if not exists (
        select 1 from public.countries c
        where c.iso2 = v_new and c.teacher_registration_enabled
      ) then
        raise exception 'country_not_available';
      end if;
    end if;
  end loop;

  return new;
end;
$$;

-- Supabase's default privileges grant EXECUTE on new public functions to
-- anon and authenticated by name, so "from public" alone is not enough.
revoke all on function public.guard_teacher_countries() from public, anon, authenticated;

drop trigger if exists teacher_compliance_guard on public.teacher_compliance;
create trigger teacher_compliance_guard
  before insert or update on public.teacher_compliance
  for each row execute function public.guard_teacher_countries();

-- ---------------------------------------------------------------------
-- 2. profile_private.phone
-- ---------------------------------------------------------------------
-- History: 20261025100000 created this table, 20261025200000 dropped it, and
-- 20261031100000 re-created it (birth_date now nullable, conservatory_email
-- added), with owner-only policies and COLUMN-level grants:
--   insert (id, birth_date, updated_at), update (birth_date, updated_at).
-- conservatory_email is written only by the file_school_email trigger. So the
-- policies already do what is needed, but a new column is NOT writable until
-- it is granted. The policies are re-asserted below (idempotent) in case the
-- live table drifted, and the grants are widened by phone alone.
alter table public.profile_private add column if not exists phone text;

-- E.164: a plus, a non-zero first digit, 7 to 15 digits in all. The frontend
-- normalises before sending; this is the backstop, not the formatter.
-- NOT VALID then VALIDATE: the add takes only a brief lock and the scan
-- happens separately. Dropping first keeps it re-runnable.
alter table public.profile_private drop constraint if exists profile_private_phone_e164;
alter table public.profile_private
  add constraint profile_private_phone_e164 check (phone ~ '^\+[1-9][0-9]{6,14}$') not valid;
alter table public.profile_private validate constraint profile_private_phone_e164;

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

-- anon never reads this table (the policies already return it nothing, which
-- is why an anonymous GET answers 200 []): drop the grant so it answers 401.
revoke all on public.profile_private from anon;

-- The owner has no business deleting, truncating or adding references or
-- triggers on this table (default privileges grant them). RLS has no delete
-- policy, but TRUNCATE ignores RLS. The file_school_email trigger is
-- security definer, so it is unaffected.
revoke delete, truncate, references, trigger on public.profile_private from authenticated;

-- The owner may write phone. id is in the update grant for the same reason as
-- above: upsert({ id, phone }, { onConflict: 'id' }) sets id = excluded.id,
-- and the policy pins it to the caller's own id, so it is a no-op.
-- conservatory_email stays out of both lists.
grant insert (id, birth_date, phone, updated_at) on public.profile_private to authenticated;
grant update (id, birth_date, phone, updated_at) on public.profile_private to authenticated;

-- ---------------------------------------------------------------------
-- Verification. Should return one row:
--   table_exists = true, rls_enabled = true, policies = 3,
--   phone_column = true, phone_check = true, phone_writable = true,
--   email_not_writable = true, anon_any_privilege = false,
--   authenticated_can_delete = false, guard_anon_can_execute = false,
--   guard_authenticated_can_execute = false,
--   private_anon_any_privilege = false,
--   private_authenticated_extra_privileges = false,
--   teacher_select_is_column_level = true
-- ---------------------------------------------------------------------
select
  to_regclass('public.teacher_compliance') is not null as table_exists,
  coalesce((select c.relrowsecurity from pg_class c
            where c.oid = to_regclass('public.teacher_compliance')), false) as rls_enabled,
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'teacher_compliance') as policies,
  exists (select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'profile_private'
            and column_name = 'phone') as phone_column,
  exists (select 1 from pg_constraint
          where conrelid = 'public.profile_private'::regclass
            and conname = 'profile_private_phone_e164') as phone_check,
  has_column_privilege('authenticated', 'public.profile_private', 'phone', 'insert')
    and has_column_privilege('authenticated', 'public.profile_private', 'phone', 'update') as phone_writable,
  not has_column_privilege('authenticated', 'public.profile_private', 'conservatory_email', 'update') as email_not_writable,
  (has_table_privilege('anon', 'public.teacher_compliance', 'select,insert,update,delete,truncate,references,trigger')
    or has_any_column_privilege('anon', 'public.teacher_compliance', 'select,insert,update,references')) as anon_any_privilege,
  has_table_privilege('authenticated', 'public.teacher_compliance', 'delete') as authenticated_can_delete,
  has_function_privilege('anon', 'public.guard_teacher_countries()', 'execute') as guard_anon_can_execute,
  has_function_privilege('authenticated', 'public.guard_teacher_countries()', 'execute') as guard_authenticated_can_execute,
  (has_table_privilege('anon', 'public.profile_private', 'select,insert,update,delete,truncate,references,trigger')
    or has_any_column_privilege('anon', 'public.profile_private', 'select,insert,update,references')) as private_anon_any_privilege,
  has_table_privilege('authenticated', 'public.profile_private', 'delete,truncate,references,trigger') as private_authenticated_extra_privileges,
  not has_table_privilege('authenticated', 'public.teacher_compliance', 'select') as teacher_select_is_column_level;
