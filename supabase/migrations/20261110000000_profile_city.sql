-- Home city (optional): only places a member on the globe, never shown on
-- their profile. Picked from a city search, so it always arrives with the
-- city centre's coordinates and a country; nobody's address is stored.
-- Members without one stay at their conservatory on the globe.
--
-- Run this in the Supabase SQL editor.

alter table public.profiles add column if not exists city_name text;
alter table public.profiles add column if not exists city_country text;
alter table public.profiles add column if not exists city_lat double precision;
alter table public.profiles add column if not exists city_lng double precision;

alter table public.profiles drop constraint if exists profiles_city_sane;
alter table public.profiles add constraint profiles_city_sane check (
  (city_name is null or char_length(city_name) <= 120)
  and (city_country is null or char_length(city_country) <= 80)
  and (city_lat is null or city_lat between -90 and 90)
  and (city_lng is null or city_lng between -180 and 180)
  -- a name and its coordinates come together or not at all
  and ((city_name is null) = (city_lat is null) and (city_lat is null) = (city_lng is null))
);

-- Should list the four columns.
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'profiles' and column_name like 'city\_%'
order by column_name;
