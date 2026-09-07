-- The upload flow already measures each recording's length for the 2-minute
-- check; now it stores it, so the radio reads durations from the row instead
-- of probing every audio file's metadata on every device (a per-file fetch
-- that would not scale past a small catalogue). Older rows stay null and
-- keep the client-side probe as a fallback.
alter table student_tracks add column if not exists duration_seconds integer;
