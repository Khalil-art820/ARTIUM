-- Mutual connections for "People you may know" (Network welcome page).
--
-- connections rows are visible only to the two people in them, so the app
-- can't see who your connections are connected to. This returns, for the
-- signed-in user only, each other student who shares at least one accepted
-- connection with them: how many they share, and one of YOUR OWN connections
-- as the example ("Jad and 12 other mutual connections"). Nothing about
-- anyone's connections beyond that count is exposed.
--
-- Run this in the Supabase SQL editor.

create or replace function public.mutual_connections()
returns table(other_id uuid, mutual_count int, sample_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  with mine as (
    select case when requester_id = auth.uid() then addressee_id else requester_id end as friend
      from connections
     where status = 'accepted'
       and (requester_id = auth.uid() or addressee_id = auth.uid())
  ),
  theirs as (
    select case when c.requester_id = m.friend then c.addressee_id else c.requester_id end as other,
           m.friend
      from connections c
      join mine m on (c.requester_id = m.friend or c.addressee_id = m.friend)
     where c.status = 'accepted'
  )
  select other, count(distinct friend)::int, (array_agg(friend order by friend))[1]
    from theirs
   where other <> auth.uid()
   group by other;
$$;

revoke all on function public.mutual_connections() from public;
grant execute on function public.mutual_connections() to authenticated;

-- Check (signed in as a student in the app, or):
--   select * from public.mutual_connections();
