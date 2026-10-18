-- How many connections a student has, for their profile page.
--
-- connections rows are visible only to the two people in them, so another
-- student's count can't be read directly. This returns just the number of
-- accepted connections — never who they are.
--
-- Run this in the Supabase SQL editor.

create or replace function public.connection_count(p_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
    from connections
   where status = 'accepted'
     and (requester_id = p_id or addressee_id = p_id);
$$;

revoke all on function public.connection_count(uuid) from public;
grant execute on function public.connection_count(uuid) to authenticated;

-- Check:
--   select public.connection_count('<a student profile id>');
