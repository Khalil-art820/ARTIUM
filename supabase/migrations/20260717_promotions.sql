-- Promote Me (aclassicaltone) submissions + owner-only approval
-- Run this in the Supabase SQL editor.
--
-- Admin/owner is identified by profiles.is_admin (a role flag), NOT by email.
-- Grant yourself admin once (see the UPDATE at the bottom).

-- 1. Role flag on profiles
alter table profiles add column if not exists is_admin boolean not null default false;

-- 2. Submissions table
create table if not exists promotions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text,
  video_link text not null,
  provider text,
  caption text,
  proposed_date date,
  proposed_time text,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz default now()
);

alter table promotions enable row level security;

-- 3. Row-level security (the real access control — a hidden UI is not enough)

-- A user can create their own submission.
create policy "promotions insert own" on promotions
  for insert with check (user_id = auth.uid());

-- A user can read their own submissions; an admin can read every submission.
-- Because only admin rows satisfy the is_admin check, pending submissions are
-- invisible to everyone except admins.
create policy "promotions read own or admin" on promotions
  for select using (
    user_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin)
  );

-- Only an admin can approve / reject / reset.
create policy "promotions admin update" on promotions
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin)
  );

-- 4. Make yourself the admin (run once; replace the email if needed).
update profiles set is_admin = true
  where id = (select id from auth.users where lower(email) = 'ktannous0@gmail.com');
