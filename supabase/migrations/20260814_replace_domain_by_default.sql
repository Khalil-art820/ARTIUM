-- Approving a new domain replaces the old one, unless told otherwise.
--
-- The union was the wrong default. A school that changes its email domain has
-- changed it: keeping the old one means an address the school has retired goes
-- on verifying students indefinitely, and nobody ever notices, because nothing
-- fails. Domains accumulate quietly and the list stops meaning "addresses this
-- school issues" and starts meaning "addresses it has ever issued".
--
-- But replacing is wrong too, some of the time. A migration takes a year or
-- two and both addresses are live throughout; replacing on the first request
-- locks out everyone still on the old one, with no way for them to find out
-- why. That case is real and the admin is the only one who knows which it is.
--
-- So it is a choice made at approval, defaulting to replace, and the function
-- takes it as an argument rather than guessing.
--
-- Run this in the Supabase SQL editor.

create or replace function public.approve_conservatory_domain(
  p_name text,
  p_address text,
  p_domain text,
  p_keep_existing boolean default false
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
          -- Nothing offered: an approval that carries no domain must not erase
          -- the ones the school already has. This is the document route, where
          -- there is no address to add.
          when v_domain is null then approved_conservatories.domains
          -- Asked to keep them: union, the old behaviour, for a school running
          -- two addresses through a migration.
          when p_keep_existing then
            case when v_domain = any (approved_conservatories.domains)
                 then approved_conservatories.domains
                 else approved_conservatories.domains || v_domain end
          -- Default: this is the school's domain now.
          else array[v_domain]
        end
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.approve_conservatory_domain(text, text, text, boolean) from public;
grant execute on function public.approve_conservatory_domain(text, text, text, boolean) to authenticated;

-- The three-argument version is gone: leaving it would mean the old
-- union-always behaviour survived under a name the client no longer calls,
-- waiting to be picked up by something and quietly disagreeing with this one.
drop function if exists public.approve_conservatory_domain(text, text, text);

-- ---------------------------------------------------------------------------
-- The same question, one layer up
--
-- A built-in school keeps its domain in conservatory_roster, and an approved
-- row patches it. conservatory_domains() unioned the two, so replacing inside
-- approved_conservatories would have changed nothing: the roster's original
-- domain would still have been offered alongside.
--
-- An approved row exists precisely because someone told us the roster is out
-- of date, so where one exists with domains, it is the answer — not an
-- addition to it.
-- ---------------------------------------------------------------------------
create or replace function public.conservatory_domains(p_id text)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  with approved as (
    select lower(d) as d
      from approved_conservatories a
      join conservatory_roster c
        on public.normalize_conservatory_name(a.name)
         = public.normalize_conservatory_name(c.name)
      cross join lateral unnest(a.domains) as d
     where c.id = p_id

    union all

    -- a school that exists only as an approved row: its id is the uuid
    select lower(d)
      from approved_conservatories a
      cross join lateral unnest(a.domains) as d
     where a.id::text = p_id
  ),
  roster as (
    select lower(d) as d
      from conservatory_roster c
      cross join lateral unnest(c.domains) as d
     where c.id = p_id
  )
  select coalesce(
    array_agg(distinct d),
    '{}'::text[]
  )
  from (
    select d from approved where d is not null and btrim(d) <> ''
    union all
    -- only when nothing has been approved for this school
    select d from roster
     where not exists (select 1 from approved where d is not null and btrim(d) <> '')
  ) chosen
  where d is not null and btrim(d) <> '';
$$;

revoke all on function public.conservatory_domains(text) from public;
grant execute on function public.conservatory_domains(text) to anon, authenticated;
