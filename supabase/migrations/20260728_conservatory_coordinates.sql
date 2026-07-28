-- Coordinates for conservatories established from a document.
--
-- The globe places pins from the built-in CONSERVATORIES list, where every
-- entry carries lat/lng. A conservatory that arrives via an approved proof has
-- a name and an address but no coordinates, so there is nothing to place and
-- the student ends up approved but invisible on the map.
--
-- These are filled by geocoding the address at approval time. Nullable on
-- purpose: geocoding can fail or be skipped, and that must not block an
-- approval — it only means the pin appears once coordinates arrive.
--
-- Run this in the Supabase SQL editor.

alter table approved_conservatories
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists geocoded_at timestamptz,
  add column if not exists geocode_query text;
