-- Blocking, as on Instagram. A block is one row: who blocked whom. Once it
-- exists, neither of the two can send the other a message until it is lifted
-- (the database refuses the insert, so it holds whatever the app does). The
-- conversation itself is kept, and moves to the blocker's Blocked folder.
--
-- dm_is_blocked is security definer because the insert rule must see the
-- other person's block, which their row's own rules keep private.
--
-- Run this in the Supabase SQL editor.

create table if not exists public.dm_blocks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, blocked_id),
  check (user_id <> blocked_id)
);

alter table public.dm_blocks enable row level security;

drop policy if exists "own blocks read" on public.dm_blocks;
create policy "own blocks read" on public.dm_blocks
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "own blocks insert" on public.dm_blocks;
create policy "own blocks insert" on public.dm_blocks
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "own blocks delete" on public.dm_blocks;
create policy "own blocks delete" on public.dm_blocks
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.dm_blocks from anon;

create or replace function public.dm_is_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from dm_blocks
     where (user_id = a and blocked_id = b) or (user_id = b and blocked_id = a)
  );
$$;

revoke all on function public.dm_is_blocked(uuid, uuid) from public, anon;
grant execute on function public.dm_is_blocked(uuid, uuid) to authenticated;

-- Sending: as before, plus no message across a block in either direction.
drop policy if exists "Sender can insert own message" on public.direct_messages;
create policy "Sender can insert own message" on public.direct_messages
  for insert
  with check (auth.uid() = sender_id and sender_id <> recipient_id
              and not public.dm_is_blocked(sender_id, recipient_id));

-- Should read: true, then the new insert rule.
select relrowsecurity from pg_class where relname = 'dm_blocks';
select policyname, with_check from pg_policies
where schemaname = 'public' and tablename = 'direct_messages' and cmd = 'INSERT';
