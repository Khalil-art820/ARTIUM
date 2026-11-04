-- Deleting a chat, as on Instagram: it goes from your inbox only. The other
-- person keeps everything, and a new message brings the conversation back
-- with only what came after.
--
-- One row per person and conversation: the moment you cleared it. The app
-- hides your messages with that person up to then.
--
-- Run this in the Supabase SQL editor.

create table if not exists public.dm_cleared (
  user_id uuid not null references public.profiles(id) on delete cascade,
  peer_id uuid not null references public.profiles(id) on delete cascade,
  cleared_at timestamptz not null default now(),
  primary key (user_id, peer_id)
);

alter table public.dm_cleared enable row level security;

drop policy if exists "own cleared read" on public.dm_cleared;
create policy "own cleared read" on public.dm_cleared
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "own cleared insert" on public.dm_cleared;
create policy "own cleared insert" on public.dm_cleared
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "own cleared update" on public.dm_cleared;
create policy "own cleared update" on public.dm_cleared
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.dm_cleared from anon;

-- Should read: true (protection on).
select relrowsecurity from pg_class where relname = 'dm_cleared';
