-- One exact email accepted for a school, beside its domains.
--
-- A school's domains list can now also hold a whole address (anything with an
-- "@"). It admits that address and nothing else at the same provider — so
-- ktannous0@gmail.com can verify as Juilliard and Conservatoire de Paris while
-- every other gmail address is still refused. The code is still mailed to the
-- address, so it still proves the person reads that inbox.
--
-- Admins add more from Admin → Conservatories (type the full email).
--
-- Run this in the Supabase SQL editor.

create or replace function public.email_matches_conservatory(p_email text, p_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from unnest(public.conservatory_domains(p_id)) as d
     where case
             when position('@' in d) > 0 then lower(btrim(p_email)) = d
             else lower(split_part(btrim(p_email), '@', 2)) = d
               or lower(split_part(btrim(p_email), '@', 2)) like '%.' || d
           end
  );
$$;

revoke all on function public.email_matches_conservatory(text, text) from public;
grant execute on function public.email_matches_conservatory(text, text) to anon, authenticated;

-- Accept ktannous0@gmail.com at The Juilliard School and Conservatoire de Paris.
-- An approved row's domains replace the roster's (conservatory_domains), so a
-- school without one gets its current domains carried over first — otherwise
-- adding the address would switch @juilliard.edu / @cnsmdp.fr off.
do $$
declare
  v_addr constant text := 'ktannous0@gmail.com';
  r record;
  v_cur text[];
begin
  for r in select id, name from conservatory_roster where id in ('juilliard', 'cnsmdp') loop
    v_cur := public.conservatory_domains(r.id);
    if not (v_addr = any (v_cur)) then v_cur := v_cur || v_addr; end if;

    update approved_conservatories a
       set domains = v_cur
     where public.normalize_conservatory_name(a.name) = public.normalize_conservatory_name(r.name);

    if not found then
      insert into approved_conservatories (name, address, domains)
      values (r.name, '', v_cur);
    end if;
  end loop;
end $$;

-- Check:
--   select public.email_matches_conservatory('ktannous0@gmail.com', 'juilliard'); -- true
--   select public.email_matches_conservatory('ktannous0@gmail.com', 'cnsmdp');    -- true
--   select public.email_matches_conservatory('someone@gmail.com', 'juilliard');   -- false
--   select public.email_matches_conservatory('a@juilliard.edu', 'juilliard');     -- true
