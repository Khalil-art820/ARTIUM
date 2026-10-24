-- Optional cleanup: the date-of-birth question was removed (2026-10-25) in
-- favour of an age declaration in the Terms, so profile_private is unused.
drop table if exists public.profile_private;
