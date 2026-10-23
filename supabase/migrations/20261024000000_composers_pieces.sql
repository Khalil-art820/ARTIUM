-- Composers and their pieces, for suggestions in sign-up step 4 (and for the
-- Admin → Composers & pieces screen that manages them).
--
-- Seed data: the composers in the owner's sheet-music inventory (SHEET.pdf)
-- plus the step-3 composers; works lists from Open Opus and Wikidata, both
-- public domain (CC0). Loaded by the four seed files that follow this one.
--
-- Run this first in the Supabase SQL editor, then the seed files in order.

create extension if not exists pg_trgm;

create table if not exists public.composers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(btrim(name)) between 2 and 120),
  created_at timestamptz not null default now()
);

create table if not exists public.pieces (
  id uuid primary key default gen_random_uuid(),
  composer_id uuid not null references public.composers(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  created_at timestamptz not null default now(),
  unique (composer_id, title)
);

create index if not exists pieces_composer_idx on public.pieces (composer_id);
create index if not exists pieces_title_trgm on public.pieces using gin (title gin_trgm_ops);

alter table public.composers enable row level security;
alter table public.pieces enable row level security;

-- Everyone signed in reads (suggestions); only admins change the lists.
drop policy if exists "read composers" on public.composers;
create policy "read composers" on public.composers for select to authenticated using (true);
drop policy if exists "admins write composers" on public.composers;
create policy "admins write composers" on public.composers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "read pieces" on public.pieces;
create policy "read pieces" on public.pieces for select to authenticated using (true);
drop policy if exists "admins write pieces" on public.pieces;
create policy "admins write pieces" on public.pieces for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
