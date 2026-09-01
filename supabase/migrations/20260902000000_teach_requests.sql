-- Real teaching requests. Replaces the localStorage-only "teachRequests" /
-- "incomingRequests" pair for real (auth) accounts: a learner on one device
-- sending a request has to be visible to the teacher on another device.
--
-- Learner-side facts (name/instrument/bio/photo) are denormalized onto the
-- row at insert time rather than joined from profiles, because a teacher has
-- no RLS access to a learner's profile row (and shouldn't need any) — the
-- request itself is the only thing a teacher is allowed to read about the
-- learner who sent it.

create table if not exists teach_requests (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references profiles(id) on delete cascade,
  teacher_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  learner_name text,
  learner_instrument text,
  learner_bio text,
  learner_photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (learner_id, teacher_id)
);

alter table teach_requests enable row level security;

-- Learner sends a request for themselves, always starting pending. There is
-- no learner UPDATE policy: a re-request after a decline goes through the
-- same insert path (see upsert in sendTeachRequest), which is allowed to
-- touch the row it owns because it's the same command as the original
-- insert, not a separate update.
drop policy if exists "Learner can insert own teach request" on teach_requests;
create policy "Learner can insert own teach request"
  on teach_requests for insert
  with check (auth.uid() = learner_id and status = 'pending');

drop policy if exists "Learner can read own teach requests" on teach_requests;
create policy "Learner can read own teach requests"
  on teach_requests for select
  using (auth.uid() = learner_id);

drop policy if exists "Teacher can read own incoming requests" on teach_requests;
create policy "Teacher can read own incoming requests"
  on teach_requests for select
  using (auth.uid() = teacher_id);

-- Teachers flip status (accept/decline) — the only client update path.
drop policy if exists "Teacher can decide own incoming requests" on teach_requests;
create policy "Teacher can decide own incoming requests"
  on teach_requests for update
  using (auth.uid() = teacher_id)
  with check (auth.uid() = teacher_id);

-- No DELETE policy for anyone.
