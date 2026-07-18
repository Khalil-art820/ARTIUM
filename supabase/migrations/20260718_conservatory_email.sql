-- Store the one-time conservatory-email eligibility check on the profile.
-- The account login stays on the student's personal email; these columns just
-- record which conservatory address they verified at signup (proof they study
-- there), so losing the school inbox later never affects their login.
-- Run this in the Supabase SQL editor.

alter table profiles add column if not exists conservatory_email text;
alter table profiles add column if not exists conservatory_verified boolean not null default false;
