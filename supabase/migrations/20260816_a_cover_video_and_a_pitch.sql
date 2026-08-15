-- A cover video, and something to say about teaching.
--
-- The cover photo was written into the profiles row as a base64 data URI —
-- the whole image, inline, in a text column. That was already the wrong place
-- for a photograph and it is an impossible one for twenty-five seconds of
-- video, so the video goes to object storage and the column holds a URL.
--
-- cover_photo_url is left where it is. Nothing writes it any more and nothing
-- reads it, but dropping a column is how you lose the only copy of something,
-- and these rows are small. It can go once the data URIs in it are confirmed
-- unwanted.

alter table public.profiles
  add column if not exists cover_video_url text,
  add column if not exists teaching_pitch  text;

comment on column public.profiles.cover_video_url is
  'Public URL of the student''s cover video in the student-video bucket. Null when they have not added one. Capped at 25 seconds by the client.';

comment on column public.profiles.teaching_pitch is
  'What the student says to a learner deciding whether to book them. Null unless they are open to teaching.';

comment on column public.profiles.cover_photo_url is
  'DEPRECATED. Held a base64 data URI of a cover image. Replaced by cover_video_url; nothing reads or writes this.';

-- Public, for the same reason the audio bucket is: a cover video is meant to
-- play for every visitor including signed-out ones, and a signed URL that
-- expires would break playback partway through. Paths are random, so a file
-- is not discoverable — but it is readable by anyone holding the URL, which
-- is the trade this makes.
insert into storage.buckets (id, name, public)
  values ('student-video', 'student-video', true)
  on conflict (id) do nothing;

do $$ begin
  create policy "cover video upload own" on storage.objects
    for insert to authenticated with check (bucket_id = 'student-video');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "cover video read all" on storage.objects
    for select to anon, authenticated using (bucket_id = 'student-video');
exception when duplicate_object then null; end $$;
