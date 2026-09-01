-- Real lesson session proposals/planning. Replaces the two localStorage-only
-- stores that never talked to each other:
--   - teacher side: `artium_sessions_${teacherId}_${learnerId}`
--   - learner side: `artium_sessions_${teacherId}_demo-learner` (note the
--     hardcoded "demo-learner" — every real learner was reading a key no
--     teacher ever wrote to, so a proposal never reached the actual learner
--     it was meant for).
--
-- Session shape, taken straight from both sides' localStorage objects:
--   { id, date: "YYYY-MM-DD", time: "HH:MM", status, proposedBy, paid }
-- Status is one of "teacher_proposed" | "student_proposed" | "confirmed" —
-- there is no "cancelled" status anywhere in the app; cancelling a session
-- removes it from the array entirely (see cancelSession on both sides), so
-- this table gets a DELETE policy instead of a cancelled state.
-- "proposedBy" is stored on the wire as "teacher"/"student"; renamed to
-- "learner" here to match this table's own vocabulary (teacher_id/learner_id),
-- translated at the two call sites.
-- "recurring" (weekly/biweekly/monthly, teacher-proposal-time only) is never
-- read back after the initial batch of rows is created, so it isn't a real
-- column — it lives in `details` if a client wants to keep it around.

create table if not exists lesson_sessions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles(id) on delete cascade,
  learner_id uuid not null references profiles(id) on delete cascade,
  session_date date not null,
  session_time text not null,
  status text not null default 'teacher_proposed' check (status in ('teacher_proposed', 'student_proposed', 'confirmed')),
  proposed_by text not null default 'teacher' check (proposed_by in ('teacher', 'learner')),
  paid boolean not null default false,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lesson_sessions_thread_idx
  on lesson_sessions (teacher_id, learner_id, created_at);

alter table lesson_sessions enable row level security;

-- Only a teacher creates sessions (proposeSession); a learner never inserts
-- one directly — their "counter-proposal" is an UPDATE of the teacher's row,
-- same as the localStorage version (submitCounter mutates the existing
-- array entry, it doesn't add a new one).
drop policy if exists "Teacher can insert own session" on lesson_sessions;
create policy "Teacher can insert own session"
  on lesson_sessions for insert
  with check (auth.uid() = teacher_id);

drop policy if exists "Participant can read own sessions" on lesson_sessions;
create policy "Participant can read own sessions"
  on lesson_sessions for select
  using (auth.uid() in (teacher_id, learner_id));

-- Teacher: approve a counter, propose a new time, mark handled, etc. — every
-- status this table allows.
drop policy if exists "Teacher can update own sessions" on lesson_sessions;
create policy "Teacher can update own sessions"
  on lesson_sessions for update
  using (auth.uid() = teacher_id)
  with check (auth.uid() = teacher_id);

-- Learner: only ever moves a session to "confirmed" (approve) or
-- "student_proposed" (counter-propose a new time) — never back to
-- "teacher_proposed", which mirrors approveSession/submitCounter on the
-- learner side of LessonRoom exactly.
drop policy if exists "Learner can respond to own sessions" on lesson_sessions;
create policy "Learner can respond to own sessions"
  on lesson_sessions for update
  using (auth.uid() = learner_id)
  with check (auth.uid() = learner_id and status in ('confirmed', 'student_proposed'));

-- Both sides have a real "Cancel session" affordance that removes the row
-- outright (see cancelSession in both LessonRoom and TeacherLessonRoom).
-- Note this table has no server-side enforcement of the 24h/48h
-- cancel/modify locks the UI shows — those are client-side only, same trust
-- level the localStorage version already had.
drop policy if exists "Teacher can delete own sessions" on lesson_sessions;
create policy "Teacher can delete own sessions"
  on lesson_sessions for delete
  using (auth.uid() = teacher_id);

drop policy if exists "Learner can delete own sessions" on lesson_sessions;
create policy "Learner can delete own sessions"
  on lesson_sessions for delete
  using (auth.uid() = learner_id);

-- RLS can only gate which ROWS each policy applies to, not which columns —
-- without this grant, the learner UPDATE policy above would also let a
-- learner rewrite session_date/session_time/proposed_by/teacher_id on a
-- session they didn't propose. Teacher and learner legitimately touch an
-- overlapping-but-different set of columns (teacher: status, proposed_by,
-- session_date, session_time when re-proposing; learner: status,
-- proposed_by, session_date, session_time when countering; paid is learner-
-- only in the UI today, teacher never sets it) — Postgres grants can't be
-- scoped per-policy, so this is the union of both, same tradeoff
-- direct_messages already made for its single update policy.
revoke update on lesson_sessions from authenticated;
grant update (status, proposed_by, session_date, session_time, paid, details, updated_at)
  on lesson_sessions to authenticated;
