-- Conservatory-domain requests.
--
-- The institutional-email route only works for a school whose domain is in
-- the built-in list, and only while that domain is still current. A student
-- whose conservatory is missing — or whose school has changed address since
-- the list was written — had one way forward: switch to the document route
-- and upload a paper. That works, but it throws away the thing they actually
-- have, which is a working address at the institution.
--
-- So they can send the address instead: conservatory name, its address, and
-- their student email. An admin approves it, the domain joins the roster, and
-- from then on that school verifies by code like any other.
--
-- Run this in the Supabase SQL editor.

-- 1. The request itself rides on the existing review queue, which already
--    carries name, personal_email, conservatory_name and _address. Only two
--    things are missing: which kind of request this is, and the address the
--    student is offering as proof.
alter table student_verifications
  add column if not exists kind text not null default 'document',
  add column if not exists conservatory_email text default '';

-- Existing rows predate the column and are all document uploads.
update student_verifications set kind = 'document' where kind is null;

alter table student_verifications
  drop constraint if exists student_verifications_kind_check;
alter table student_verifications
  add constraint student_verifications_kind_check
  check (kind in ('document', 'domain_request'));

-- 2. An approved school needs somewhere to keep the domain, or approving a
--    request would add the conservatory and lose the very thing it was for.
--    An array because institutions genuinely carry several — a conservatoire
--    with a university parent, a school mid-migration between two.
alter table approved_conservatories
  add column if not exists domains text[] not null default '{}';

-- Looking a domain up is the hot path once this list grows: every signup on
-- the email route checks whether the address they typed belongs to the school
-- they picked.
create index if not exists approved_conservatories_domains_idx
  on approved_conservatories using gin (domains);

-- 3. Approving is a merge, not an overwrite. The admin screen upserts on
--    name, and a plain upsert would replace the domains already there — so a
--    school that has two addresses would lose one every time a student asked
--    about the other. This does the union in the database, where the read and
--    the write cannot be separated by another admin's click.
--
-- security definer because it writes approved_conservatories, which only an
-- admin may change; the check inside is what enforces that, not the caller's
-- own rights. search_path is pinned so the function cannot be redirected.
create or replace function public.approve_conservatory_domain(
  p_name text,
  p_address text,
  p_domain text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_domain text := lower(nullif(btrim(p_domain), ''));
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin) then
    raise exception 'only an admin may approve a conservatory domain';
  end if;

  insert into approved_conservatories (name, address, domains)
    values (btrim(p_name), coalesce(btrim(p_address), ''),
            case when v_domain is null then '{}'::text[] else array[v_domain] end)
  on conflict (name) do update
    set address = case
          when coalesce(btrim(p_address), '') <> '' then btrim(p_address)
          else approved_conservatories.address
        end,
        domains = case
          when v_domain is null then approved_conservatories.domains
          -- union, not replace: keep every address the school already had
          when v_domain = any (approved_conservatories.domains) then approved_conservatories.domains
          else approved_conservatories.domains || v_domain
        end
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.approve_conservatory_domain(text, text, text) from public;
grant execute on function public.approve_conservatory_domain(text, text, text) to authenticated;
