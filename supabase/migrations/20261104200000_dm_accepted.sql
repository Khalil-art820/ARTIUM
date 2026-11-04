-- Message requests, as on Instagram. A conversation is a request when the
-- other person isn't one of your people (a connection, or for a learner a
-- teacher who accepted them), you have never written to them, and you
-- haven't accepted it. Accepting is remembered here, one row per person and
-- conversation, readable and writable only by its owner.
--
-- Run this in the Supabase SQL editor.

create table if not exists public.dm_accepted (
  user_id uuid not null references public.profiles(id) on delete cascade,
  peer_id uuid not null references public.profiles(id) on delete cascade,
  accepted_at timestamptz not null default now(),
  primary key (user_id, peer_id)
);

alter table public.dm_accepted enable row level security;

drop policy if exists "own accepted read" on public.dm_accepted;
create policy "own accepted read" on public.dm_accepted
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "own accepted insert" on public.dm_accepted;
create policy "own accepted insert" on public.dm_accepted
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "own accepted update" on public.dm_accepted;
create policy "own accepted update" on public.dm_accepted
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.dm_accepted from anon;

-- Should read: true (protection on).
select relrowsecurity from pg_class where relname = 'dm_accepted';
