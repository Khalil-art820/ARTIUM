-- Four links, not one performance video.
--
-- video_link asked for a single URL and only accepted Instagram, Facebook or
-- YouTube — so a student with an Instagram account and a YouTube channel had
-- to choose, and one with a website had nowhere to put it. It also asked for
-- a *video*, which meant a link to a post rather than to the person.
--
-- One jsonb column rather than four text ones, because these are one thing —
-- where to find them — and they are read and written together everywhere.
-- Keys: instagram, facebook, youtube, website. Missing key means not given.

alter table public.profiles
  add column if not exists links jsonb not null default '{}'::jsonb;

comment on column public.profiles.links is
  'Where to find this student: {instagram, facebook, youtube, website}. Any key may be absent. Values are full URLs.';

-- Carry the existing single link into whichever slot its host names, so
-- nobody loses the URL they already gave us. Anything unrecognised is left
-- in video_link rather than guessed at.
update public.profiles
   set links = jsonb_strip_nulls(jsonb_build_object(
         'instagram', case when video_link ~* 'instagram\.com'            then video_link end,
         'facebook',  case when video_link ~* 'facebook\.com|fb\.(com|watch)' then video_link end,
         'youtube',   case when video_link ~* 'youtube\.com|youtu\.be'    then video_link end
       ))
 where coalesce(video_link, '') <> ''
   and links = '{}'::jsonb;

comment on column public.profiles.video_link is
  'DEPRECATED. Held one performance-video URL. Replaced by links; backfilled into it where the host was recognised.';
