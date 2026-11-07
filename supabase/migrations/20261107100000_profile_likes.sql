-- Profile likes. One row per member who liked a profile; members can like
-- an approved student's profile once and take it back, never their own.
-- Who liked whom stays private: a member can read only their own likes, and
-- everyone else sees only the number (profile_like_count).
--
-- top_liked_profiles ranks approved students by likes, most first, for the
-- entry gate's six cards.
--
-- Run this in the Supabase SQL editor.

create table if not exists public.profile_likes (
  liker_id uuid not null references public.profiles(id) on delete cascade,
  liked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (liker_id, liked_id),
  check (liker_id <> liked_id)
);

create index if not exists profile_likes_liked_idx on public.profile_likes (liked_id);

alter table public.profile_likes enable row level security;

drop policy if exists "own likes read" on public.profile_likes;
create policy "own likes read" on public.profile_likes
  for select to authenticated using (liker_id = auth.uid());

drop policy if exists "own likes insert" on public.profile_likes;
create policy "own likes insert" on public.profile_likes
  for insert to authenticated
  with check (liker_id = auth.uid() and public.is_member()
              and exists (select 1 from profiles p where p.id = liked_id and p.approved and p.role = 'student'));

drop policy if exists "own likes delete" on public.profile_likes;
create policy "own likes delete" on public.profile_likes
  for delete to authenticated using (liker_id = auth.uid());

revoke all on public.profile_likes from anon;

create or replace function public.profile_like_count(p_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case when public.is_member() then (select count(*)::int from profile_likes where liked_id = p_id) else 0 end;
$$;

create or replace function public.top_liked_profiles(p_limit integer default 6)
returns table (profile_id uuid, likes integer)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, count(l.liker_id)::int as likes
    from profiles p
    join profile_likes l on l.liked_id = p.id
   where p.approved and p.role = 'student' and p.is_admin is not true
     and public.is_member()
   group by p.id
   order by likes desc, min(l.created_at) asc
   limit greatest(1, least(coalesce(p_limit, 6), 24));
$$;

revoke all on function public.profile_like_count(uuid) from public, anon;
revoke all on function public.top_liked_profiles(integer) from public, anon;
grant execute on function public.profile_like_count(uuid) to authenticated;
grant execute on function public.top_liked_profiles(integer) to authenticated;

-- Should read: true, then the two functions.
select relrowsecurity from pg_class where relname = 'profile_likes';
select routine_name from information_schema.routines
where routine_schema = 'public' and routine_name in ('profile_like_count', 'top_liked_profiles');
