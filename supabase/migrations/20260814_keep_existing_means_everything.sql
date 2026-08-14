-- "Keep the old one working too" has to mean every domain that works today.
--
-- p_keep_existing unioned the new address with the approved row's domains.
-- But a built-in school keeps its domain in conservatory_roster, and an
-- approved row with any domains masks the roster completely — so for exactly
-- the school the checkbox is aimed at, the domain being kept was not in the
-- list being unioned. Ticking it changed nothing: the old address stopped
-- working either way, silently, which is the failure the checkbox exists to
-- prevent.
--
-- Keeping now unions with everything the school accepts today, wherever that
-- lives — the approved row and the roster entry it patches.
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
  v_keep text[] := '{}';
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin) then
    raise exception 'only an admin may approve a conservatory domain';
  end if;

  -- What the school accepts today, from both layers, gathered before the
  -- write. Only consulted when asked to keep; otherwise the new address stands
  -- alone, which is the default and the common case.
  if p_keep_existing then
    select coalesce(array_agg(distinct d), '{}'::text[])
      into v_keep
      from (
        select lower(d) as d
          from approved_conservatories a
          cross join lateral unnest(a.domains) as d
         where public.normalize_conservatory_name(a.name)
             = public.normalize_conservatory_name(p_name)
        union
        select lower(d)
          from conservatory_roster c
          cross join lateral unnest(c.domains) as d
         where public.normalize_conservatory_name(c.name)
             = public.normalize_conservatory_name(p_name)
      ) all_live
     where d is not null and btrim(d) <> '';
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
          -- An approval carrying no domain must not erase the ones a school
          -- already has. That is the document route.
          when v_domain is null then approved_conservatories.domains
          -- Everything that worked before, plus the new one.
          when p_keep_existing then (
            select coalesce(array_agg(distinct d), '{}'::text[])
              from unnest(v_keep || v_domain) as d
          )
          -- Default: this is the school's address now.
          else array[v_domain]
        end
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.approve_conservatory_domain(text, text, text, boolean) from public;
grant execute on function public.approve_conservatory_domain(text, text, text, boolean) to authenticated;

-- After ticking "keep", both should be listed:
--   select public.conservatory_domains('artium-test');
