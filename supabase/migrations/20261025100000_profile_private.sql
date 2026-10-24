-- Private profile data: the date of birth asked at sign-up (French digital age
-- of majority — 15 to register alone; parents/guardians registering a child
-- must be adults). Kept OUT of profiles, which every signed-in user can read:
-- only the owner (and admins) can see their row here.
-- Run this BEFORE the app update that writes it.

create table if not exists public.profile_private (
  id uuid primary key references public.profiles(id) on delete cascade,
  birth_date date not null check (birth_date > date '1900-01-01' and birth_date <= current_date),
  updated_at timestamptz not null default now()
);

alter table public.profile_private enable row level security;

drop policy if exists "own private read" on public.profile_private;
create policy "own private read" on public.profile_private
  for select to authenticated using (auth.uid() = id or public.is_admin());

drop policy if exists "own private insert" on public.profile_private;
create policy "own private insert" on public.profile_private
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists "own private update" on public.profile_private;
create policy "own private update" on public.profile_private
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
