-- Manual student verification (for conservatory students WITHOUT an
-- institutional email). They upload a proof document at signup; an admin
-- reviews it and approves/rejects. Run this in the Supabase SQL editor.

-- 1. Requests table
create table if not exists student_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text,
  personal_email text,
  document_url text,           -- storage path in the 'student-proofs' bucket
  document_name text,
  conservatory_id text,
  conservatory_name text,      -- admin confirms/edits during review
  conservatory_address text,   -- admin fills during review
  status text default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz default now()
);

alter table student_verifications enable row level security;

-- A user can create + read their own request; an admin can read all.
create policy "sv insert own" on student_verifications
  for insert with check (user_id = auth.uid());
create policy "sv read own or admin" on student_verifications
  for select using (
    user_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin)
  );
-- Only an admin can approve / reject / edit.
create policy "sv admin update" on student_verifications
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin)
  );

-- 2. Admins must be able to flip OTHER users' profiles.approved during review.
--    (The existing "update own" policy only covers a user's own row.)
create policy "profiles admin update all" on profiles
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin)
  );

-- 3. Private storage bucket for the proof documents.
insert into storage.buckets (id, name, public)
  values ('student-proofs', 'student-proofs', false)
  on conflict (id) do nothing;

-- Uploads happen during signup, before the account is confirmed, so the
-- uploader may be anonymous. (Prototype tradeoff: anyone can upload here.)
create policy "proofs upload" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'student-proofs');

-- Only an admin can read the documents (via short-lived signed URLs).
create policy "proofs admin read" on storage.objects
  for select using (
    bucket_id = 'student-proofs'
    and exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin)
  );
