-- A conservatory that exists only so door A can be walked end to end.
--
-- Verifying by code needs an address at a school on the list, and there is no
-- way to hold one at a real conservatory you do not attend. This gives the
-- flow a school whose domain you own, so the code can actually be sent,
-- received and typed back.
--
-- It replaces the exception that used to live in App.jsx — one address waved
-- past emailMatchesConservatory for Juilliard. This is better for one reason:
-- it is data, not a line of code, so it cannot ship by accident. That is
-- exactly how `gmail.com` came to sit in Juilliard's domain list behind a
-- comment reading TEMP, remove, and reached production.
--
-- It touches no real school. art-ium.com verifies here and nowhere else;
-- Juilliard still refuses it. And a code is bound to the school it was issued
-- for, so proving this one proves only this one.
--
-- It is visible in the public list while it exists, which is why the name says
-- what it is. Delete it when you are done — see the bottom of this file.

-- ---------------------------------------------------------------------------
-- ADD
-- ---------------------------------------------------------------------------
insert into conservatory_roster (id, name, short, city, country, lat, lng, domains)
values (
  'artium-test',
  'Artium Test Conservatory',
  'Artium Test',
  'Beirut',
  'Lebanon',
  33.8938,
  35.5018,
  array['art-ium.com']
)
on conflict (id) do update
  set name = excluded.name, short = excluded.short, city = excluded.city,
      country = excluded.country, lat = excluded.lat, lng = excluded.lng,
      domains = excluded.domains;

-- Check it took, and that it did not leak into a real school:
--   select public.email_matches_conservatory('khalil@art-ium.com', 'artium-test');  -- true
--   select public.email_matches_conservatory('khalil@art-ium.com', 'juilliard');    -- false

-- ---------------------------------------------------------------------------
-- REMOVE — run this when testing is done
--
-- Three statements, because approving a request through it leaves the school
-- in two tables. decide() upserts approved_conservatories to carry the domain
-- onto the school, so "Artium Test Conservatory" exists there as well as in
-- the roster. Deleting only the roster row leaves the other behind, still
-- offered in the admin picker and still accepting art-ium.com.
--
-- Profiles first: they reference the school, and a profile left pointing at a
-- school that no longer exists sits on the map with nothing under it.
-- ---------------------------------------------------------------------------
-- delete from profiles                where conservatory_id = 'artium-test';
-- delete from approved_conservatories where name = 'Artium Test Conservatory';
-- delete from conservatory_roster     where id = 'artium-test';
--
-- Then the test accounts in Authentication → Users, or you are left with
-- logins that have no profile.
--
-- Check nothing survived:
--   select (select count(*) from conservatory_roster     where id = 'artium-test')                  as roster,
--          (select count(*) from approved_conservatories where name = 'Artium Test Conservatory')   as approved,
--          (select count(*) from profiles                where conservatory_id = 'artium-test')     as profiles;
