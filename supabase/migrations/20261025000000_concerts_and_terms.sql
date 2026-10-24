-- Sign-up step 7 (concerts & mobility) and Terms acceptance.
-- Run this BEFORE the app update that writes these columns.

-- Where a student can perform (continents) and what kind of performances.
-- concert_open / concert_fee already exist (20260819); a null concert_regions
-- marks a profile from before step 7, which the app treats as answered.
alter table public.profiles
  add column if not exists concert_regions text[] default '{}',
  add column if not exists concert_formats text[] default '{}';

-- When, and which version of, the Terms & Conditions were accepted.
-- Students and learners accept at sign-up; stamped once.
alter table public.profiles
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version text;
