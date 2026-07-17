-- Promote Me (aclassicaltone) submissions + owner-only approval
-- Run this in the Supabase SQL editor.
-- The owner is identified by the email in the JWT. Change the address below
-- if the Artium owner account uses a different email.

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

-- A user can create their own submission.
create policy "promotions insert own" on promotions
  for insert with check (user_id = auth.uid());

-- A user can read their own submissions; the owner can read every submission.
-- Because only the owner's JWT satisfies the email check, pending submissions
-- are invisible to everyone except the owner.
create policy "promotions read own or owner" on promotions
  for select using (
    user_id = auth.uid()
    or lower(auth.jwt() ->> 'email') = 'ktannous0@gmail.com'
  );

-- Only the owner can approve / reject.
create policy "promotions owner update" on promotions
  for update using (
    lower(auth.jwt() ->> 'email') = 'ktannous0@gmail.com'
  );
