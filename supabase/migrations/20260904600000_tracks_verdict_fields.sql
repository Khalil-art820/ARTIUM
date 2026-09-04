-- Recording verdicts join the spotlight pattern: a stored reason the student
-- sees, and a decided_at stamp the bell keys notifications on (so a reset
-- and re-decision notifies again).
alter table student_tracks add column if not exists rejection_reason text;
alter table student_tracks add column if not exists decided_at timestamptz;
