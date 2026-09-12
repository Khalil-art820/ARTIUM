-- Replaces the two-tier cancellation scheme (20260912000000) with a uniform,
-- platform-fixed three-tier ladder — see CANCEL_FULL_H / CANCEL_ZERO_H in
-- src/App.jsx and their mirror in supabase/functions/cancel-session. The
-- lock-window columns on teacher_rules (cancel_lock_hours, modify_lock_hours)
-- are left in place — harmless, just no longer read by cancel-session or the
-- client — only late_fee_pct is still a teacher-editable knob.
--
-- Also adds:
--   * lesson_sessions.status = 'no_show', for report-no-show's server-side
--     full refund when a learner reports a teacher didn't show up.
--   * cancellation_events, an abuse-guard log of late cancellations and
--     no-show reports, read by stripe-checkout to temporarily restrict a
--     serial late-canceller's bookings and by cancel-session to warn a
--     learner approaching that threshold.

-- ---------------------------------------------------------------------
-- 1. lesson_sessions: a real 'no_show' status.
-- ---------------------------------------------------------------------
alter table lesson_sessions drop constraint if exists lesson_sessions_status_check;
alter table lesson_sessions add constraint lesson_sessions_status_check
  check (status in ('teacher_proposed', 'student_proposed', 'confirmed', 'cancelled', 'no_show'));

-- ---------------------------------------------------------------------
-- 2. cancellation_events: service-role-only insert log. No client INSERT
--    policy at all — both cancel-session and report-no-show write these
--    rows with the service-role key, never the client directly, so there is
--    nothing for a crafted client request to forge (a learner padding their
--    own record, or hiding one, would defeat the whole point of the guard).
-- ---------------------------------------------------------------------
create table if not exists cancellation_events (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references profiles(id) on delete cascade,
  session_id uuid not null,
  kind text not null check (kind in ('late_cancel', 'no_show_report')),
  created_at timestamptz not null default now()
);

create index if not exists cancellation_events_learner_idx
  on cancellation_events (learner_id, kind, created_at);

alter table cancellation_events enable row level security;

drop policy if exists "Learner can read own cancellation events" on cancellation_events;
create policy "Learner can read own cancellation events"
  on cancellation_events for select
  using (auth.uid() = learner_id);

drop policy if exists "Admin can read all cancellation events" on cancellation_events;
create policy "Admin can read all cancellation events"
  on cancellation_events for select
  using (public.is_admin());

-- No insert/update/delete policy for any role — only the service role
-- (which bypasses RLS entirely) ever writes to this table.
