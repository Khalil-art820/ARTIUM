-- Who a member is connected to, for the list behind "N connections" on their
-- profile. Until now only the number was readable (connection_count); this
-- returns the other people's ids, accepted connections only, and only to a
-- member (an approved student or a learner) — never to someone signed out or
-- still waiting for approval.
--
-- Run this in the Supabase SQL editor.

create or replace function public.member_connections(p_id uuid)
returns table (other_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select case when c.requester_id = p_id then c.addressee_id else c.requester_id end
    from connections c
   where c.status = 'accepted'
     and (c.requester_id = p_id or c.addressee_id = p_id)
     and public.is_member();
$$;

revoke all on function public.member_connections(uuid) from public, anon;
grant execute on function public.member_connections(uuid) to authenticated;

-- Should return one row: member_connections.
select routine_name from information_schema.routines
where routine_schema = 'public' and routine_name = 'member_connections';
