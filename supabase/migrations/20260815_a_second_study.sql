-- A student may name two instruments.
--
-- The second one gets its own nullable column rather than turning `instrument`
-- into an array. `instrument` keeps its exact meaning — the principal study —
-- so every existing row is already correct, nothing needs backfilling, and
-- anything still reading a single value (the verification screens, the admin
-- tables, any query written before today) keeps working unchanged.
--
-- Order is the student's: whichever instrument they chose first is the one in
-- `instrument`, and it is the one their profile is headed by.

alter table public.profiles
  add column if not exists instrument_2 text;

comment on column public.profiles.instrument is
  'Principal study. Always set for a student profile.';

comment on column public.profiles.instrument_2 is
  'Optional second study. Null when the student named only one instrument. Two is the maximum the signup form allows.';
