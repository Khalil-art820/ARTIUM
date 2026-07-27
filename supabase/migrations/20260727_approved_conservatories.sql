-- The document route's conservatory roster.
--
-- The built-in CONSERVATORIES list in the app is the *institutional-email*
-- roster: every entry is there because it has an email domain we can send a
-- code to. On the document route there is no domain to check, so offering
-- that same list invited a student to claim any school on it with nothing
-- but an upload behind the claim.
--
-- This table is the document route's list instead. It starts empty and grows
-- only when an admin approves a proof: the first student from a school
-- arrives with no conservatory selected and the document establishes which
-- one it is; once approved, later students can pick it from the list.
--
-- Run this in the Supabase SQL editor.

create table if not exists approved_conservatories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text default '',
  created_at timestamptz default now()
);

-- One row per institution. Plain (not lower()) so the admin screen can upsert
-- on it directly; the admin types the name, so near-duplicates are visible
-- and fixable in the list rather than silently merged.
create unique index if not exists approved_conservatories_name_key
  on approved_conservatories (name);

alter table approved_conservatories enable row level security;

-- Readable by anyone: the signup form needs this list before an account
-- exists, so it has to work for the anon role. Nothing here is private —
-- it is the set of schools already visible on the map.
create policy "ac read all" on approved_conservatories
  for select to anon, authenticated using (true);

-- Only an admin writes, and in practice only through the review screen.
create policy "ac admin write" on approved_conservatories
  for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
