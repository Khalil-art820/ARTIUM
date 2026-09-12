-- Server-side cancellation policy for PAID lesson sessions. Cancelling a paid
-- session now moves real money (refunds, reversed transfers, reversed
-- application fees) through the new cancel-session edge function, so the
-- rules that decide who gets how much back have to live in the database,
-- not in the "My Rules" sliders' local useState (see cancelLockH/
-- modifyLockH/cancelFeesPct in TeacherLessonRoom, which were pure unsaved
-- state before this migration).
--
-- Unpaid sessions and the modify-lock are untouched: cancelling an unpaid
-- session stays a client-side DELETE (no money moves), and "modify" stays a
-- client-side lock for now — only CANCELLATION of a PAID session goes
-- through the server.

-- ---------------------------------------------------------------------
-- 1. Per-teacher cancellation/modification rules
-- ---------------------------------------------------------------------
create table if not exists teacher_rules (
  profile_id uuid primary key references profiles(id) on delete cascade,
  cancel_lock_hours integer not null default 24 check (cancel_lock_hours between 1 and 168),
  modify_lock_hours integer not null default 48 check (modify_lock_hours between 1 and 168),
  late_fee_pct integer not null default 50 check (late_fee_pct between 0 and 100),
  updated_at timestamptz not null default now()
);

alter table teacher_rules enable row level security;

-- A learner has to be able to see a teacher's rules before booking (the
-- "Cancel free until Xh before" line in LessonRoom), so SELECT is open to
-- any authenticated user, not just the owner.
drop policy if exists "Any authenticated can read teacher rules" on teacher_rules;
create policy "Any authenticated can read teacher rules"
  on teacher_rules for select
  to authenticated
  using (true);

drop policy if exists "Teacher can insert own rules" on teacher_rules;
create policy "Teacher can insert own rules"
  on teacher_rules for insert
  with check (auth.uid() = profile_id);

drop policy if exists "Teacher can update own rules" on teacher_rules;
create policy "Teacher can update own rules"
  on teacher_rules for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

-- Column-level grant: the owner may only ever change the three value columns
-- (and their updated_at stamp) — never profile_id, same reasoning as
-- agenda_notes' content-only grant.
revoke update on teacher_rules from authenticated;
grant update (cancel_lock_hours, modify_lock_hours, late_fee_pct, updated_at)
  on teacher_rules to authenticated;

-- ---------------------------------------------------------------------
-- 2. lesson_sessions: a real 'cancelled' status, and paid rows can only
--    ever be cancelled by the server (service role), never deleted by a
--    client.
-- ---------------------------------------------------------------------
alter table lesson_sessions drop constraint if exists lesson_sessions_status_check;
alter table lesson_sessions add constraint lesson_sessions_status_check
  check (status in ('teacher_proposed', 'student_proposed', 'confirmed', 'cancelled'));

-- Cancelling a paid session is now a service-role UPDATE (status =
-- 'cancelled') done by the cancel-session edge function, after the refund
-- actually goes through — never a client-side DELETE. Re-scope both existing
-- delete policies to unpaid rows only, so a crafted client DELETE can't
-- remove a paid session's record (and the money trail with it) out from
-- under the server.
drop policy if exists "Teacher can delete own sessions" on lesson_sessions;
create policy "Teacher can delete own sessions"
  on lesson_sessions for delete
  using (auth.uid() = teacher_id and paid = false);

drop policy if exists "Learner can delete own sessions" on lesson_sessions;
create policy "Learner can delete own sessions"
  on lesson_sessions for delete
  using (auth.uid() = learner_id and paid = false);

-- ---------------------------------------------------------------------
-- 3. payments: track how much of a charge has actually been refunded, and
--    allow the ledger to say "some, but not all, of this came back".
-- ---------------------------------------------------------------------
alter table payments
  add column if not exists refunded_cents integer not null default 0;

alter table payments drop constraint if exists payments_status_check;
alter table payments add constraint payments_status_check
  check (status in ('pending', 'paid', 'failed', 'refunded', 'partially_refunded'));

-- ------------------------------------------------------------------
-- Security hardening (review finding): a learner could rewrite a PAID
-- session's date/time via a direct API call — legal under the counter-
-- propose grant — pushing the cancel-lock cutoff into the future and
-- turning a late cancellation into a full refund. This trigger permits a
-- learner's date change on a paid row ONLY as a proposal (status becomes
-- 'student_proposed', which cancel-session refuses to refund until the
-- teacher confirms the new time). The teacher and the service role are
-- unaffected.
create or replace function public.guard_paid_session_reschedule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid;
begin
  if old.paid
     and (new.session_date is distinct from old.session_date
          or new.session_time is distinct from old.session_time)
     and new.status = 'confirmed' then
    uid := nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::uuid;
    if uid is not null and uid = old.learner_id then
      raise exception 'A paid session''s time can only be moved as a proposal for the teacher to approve.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_paid_session_reschedule on lesson_sessions;
create trigger trg_guard_paid_session_reschedule
  before update on lesson_sessions
  for each row execute function public.guard_paid_session_reschedule();
