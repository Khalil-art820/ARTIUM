-- Which of a set of members are connected to each other, for the lines on
-- the globe: a line joins two of your connections only when those two are
-- connected. Accepted connections only, and only for a member (an approved
-- student or a learner) — never for someone signed out or awaiting approval.
-- member_connections already lets a member read anyone's connection list;
-- this answers the same question for a set at once.
--
-- Run this in the Supabase SQL editor.

create or replace function public.connections_among(p_ids uuid[])
returns table (a uuid, b uuid)
language sql
stable
security definer
set search_path = public
as $$
  select c.requester_id, c.addressee_id
    from connections c
   where c.status = 'accepted'
     and c.requester_id = any(p_ids)
     and c.addressee_id = any(p_ids)
     and cardinality(p_ids) <= 500
     and public.is_member();
$$;

revoke all on function public.connections_among(uuid[]) from public, anon;
grant execute on function public.connections_among(uuid[]) to authenticated;

-- Should return one row: connections_among.
select routine_name from information_schema.routines
where routine_schema = 'public' and routine_name = 'connections_among';
