-- Cities where a student can teach in person (sign-up step 6, shown when they
-- teach in person or both). Run this BEFORE the app update that writes it.
alter table public.profiles
  add column if not exists teaching_cities text[] not null default '{}';
