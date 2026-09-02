-- Real per-session agenda notes. Replaces the two localStorage-only stores
-- that never talked to each other:
--   - teacher side: `artium_agenda_${teacherId}_${learnerId}_${sessionId}`
--     (agendaKey/saveAgenda/loadAgenda in TeacherLessonRoom)
--   - learner side: `artium_agenda_${teacherId}_demo-learner_${sessionId}`
--     (note the hardcoded "demo-learner" — every real learner was reading a
--     key no teacher ever wrote to, so an agenda a teacher wrote never
--     reached the actual learner it was meant for).
--
-- Shape, taken from both sides' localStorage usage: one plain-text note per
-- lesson session (not per teacher/learner pair, and not a list of entries —
-- saveAgenda always overwrites the single string for that session id, and
-- the learner side renders it as one read-only block). That maps directly
-- onto a row per lesson_sessions id, hence session_id is unique below and
-- writes are an upsert keyed on it, same as the UI's "Send agenda" /
-- "Update agenda" single-textarea model.
--
-- teacher_id/learner_id are denormalized off lesson_sessions (same
-- redundancy lesson_sessions itself accepts) purely so RLS here doesn't need
-- a subquery join for every row check.
--
-- Only the teacher writes: the learner's Agenda tab is explicitly rendered
-- read-only ("Agenda tab — confirmed sessions only (read-only for learner)"
-- in LessonRoom) — there is no learner-side save affordance anywhere in the
-- app today. So unlike lesson_sessions (which has a learner update policy
-- for counter-proposals), this table only grants the teacher INSERT/UPDATE.

create table if not exists agenda_notes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references lesson_sessions(id) on delete cascade,
  teacher_id uuid not null references profiles(id) on delete cascade,
  learner_id uuid not null references profiles(id) on delete cascade,
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id)
);

create index if not exists agenda_notes_pair_idx
  on agenda_notes (teacher_id, learner_id);

alter table agenda_notes enable row level security;

drop policy if exists "Participant can read own agenda notes" on agenda_notes;
create policy "Participant can read own agenda notes"
  on agenda_notes for select
  using (auth.uid() in (teacher_id, learner_id));

-- Teacher only: writes the first version of a session's agenda.
drop policy if exists "Teacher can insert own agenda notes" on agenda_notes;
create policy "Teacher can insert own agenda notes"
  on agenda_notes for insert
  with check (auth.uid() = teacher_id);

-- Teacher only: "Update agenda" overwrites the existing note (upsert on
-- session_id from the client). No learner update policy — see note above.
drop policy if exists "Teacher can update own agenda notes" on agenda_notes;
create policy "Teacher can update own agenda notes"
  on agenda_notes for update
  using (auth.uid() = teacher_id)
  with check (auth.uid() = teacher_id);

-- No delete policy: there's no "remove agenda" affordance in the UI today;
-- the row is cleaned up implicitly via the session_id FK's on delete cascade
-- when the session itself is cancelled/deleted.

-- Column-level grant: without this, the teacher UPDATE policy above would
-- also let the teacher rewrite session_id/teacher_id/learner_id on an
-- upsert conflict — only content (and its updated_at stamp) should ever
-- change after the row is created.
revoke update on agenda_notes from authenticated;
grant update (content, updated_at) on agenda_notes to authenticated;
