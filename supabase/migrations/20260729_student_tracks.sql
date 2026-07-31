-- Student recordings: the site's own sound bed.
--
-- Spotify embeds only ever play a 30-second preview chosen by Spotify, and
-- Instagram's catalogue is licensed to Meta, not to us. Both are dead ends for
-- audio on our own page. A student's own performance isn't: they own the
-- recording, so they can grant us permission directly.
--
-- rights_confirmed is the point of the whole table. It records that the
-- student ticked "this is my own performance and I give Artium permission to
-- play it" — that consent is what makes playing this audio lawful, so it is
-- NOT NULL and checked before anything goes live.
--
-- Note the wording is "my own performance", not "I own this music": a student
-- playing Bach owns everything that matters here, but a student playing a
-- living composer still leaves the composition's rights with its author. We
-- are asking them to vouch for the recording, which is theirs to vouch for.
--
-- Run this in the Supabase SQL editor.

create table if not exists student_tracks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  composer text default '',
  audio_url text not null,          -- storage path in the 'student-audio' bucket
  audio_name text default '',
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rights_confirmed boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists student_tracks_status_idx
  on student_tracks (status) where status = 'approved';

alter table student_tracks enable row level security;

-- Approved tracks are readable by anyone: the player runs for signed-out
-- visitors too, and an approved track is by definition meant to be heard.
-- A student can always see their own, pending or not.
do $$ begin
  create policy "tracks read approved or own" on student_tracks
    for select to anon, authenticated using (
      status = 'approved' or user_id = auth.uid()
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "tracks insert own" on student_tracks
    for insert to authenticated with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- A student may replace or withdraw their own track; only an admin decides
-- status. public.is_admin() rather than an inline EXISTS on profiles — see
-- 20260728_fix_profiles_admin_policy.sql for why that shape recurses.
do $$ begin
  create policy "tracks update own or admin" on student_tracks
    for update to authenticated using (user_id = auth.uid() or public.is_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "tracks delete own or admin" on student_tracks
    for delete to authenticated using (user_id = auth.uid() or public.is_admin());
exception when duplicate_object then null; end $$;

-- Public bucket, unlike student-proofs. A proof is private evidence read only
-- by an admin through a signed URL; a track is meant to be played by every
-- visitor, including signed-out ones, and expiring URLs would break playback
-- mid-track. Paths are random, so an unapproved file isn't discoverable — but
-- it is reachable by anyone holding the URL, which is the trade being made.
insert into storage.buckets (id, name, public)
  values ('student-audio', 'student-audio', true)
  on conflict (id) do nothing;

do $$ begin
  create policy "audio upload own" on storage.objects
    for insert to authenticated with check (bucket_id = 'student-audio');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "audio read all" on storage.objects
    for select to anon, authenticated using (bucket_id = 'student-audio');
exception when duplicate_object then null; end $$;
