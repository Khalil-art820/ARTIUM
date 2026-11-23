-- Stage 0 of docs/international-teacher-onboarding-plan.md: close the safety
-- holes in the existing lesson payment flow before new onboarding is built
-- on top of it. Funds flow is NOT changed here (still destination charges).
--
--   1. A cancelled / no-show session can no longer be brought back to life
--      by a learner (refund-abuse path), and a learner can only confirm a
--      session the teacher proposed.
--   2. payments: 'expired' and 'disputed' statuses; at most one live payment
--      and at most one pending checkout per lesson session.
--   3. teachers_taking_payments(): which teachers can actually receive money,
--      readable by any signed-in member (teacher_payout_accounts itself is
--      owner-only).
--
-- Run this in the Supabase SQL editor.
--
-- Deploy order: run this when no Stripe Checkout is open if you can. Rows
-- created before this migration have no payment_intent metadata, but the
-- webhook still reconciles them: it matches checkout.session.completed by
-- the Checkout's metadata.payment_id (falling back to checkout_session_id),
-- and only moves a payment to 'paid' from pending/failed/expired.
--
-- Before running, check there are no sessions already paid twice (the unique
-- index in section 2 would refuse to build and need a manual refund first):
--   select lesson_session_id, count(*) from payments
--   where lesson_session_id is not null
--     and status in ('paid','partially_refunded','disputed')
--   group by 1 having count(*) > 1;

-- ---------------------------------------------------------------------
-- 1. lesson_sessions: terminal states stay terminal.
-- ---------------------------------------------------------------------
-- The learner UPDATE policy only checks the NEW status
-- (in 'confirmed','student_proposed'), so a learner could take a cancelled
-- or no_show row back to 'confirmed' and then report a no-show for a full
-- refund after a late cancellation. RLS can't see OLD, a trigger can.
--
-- Only signed-in clients (JWT role 'authenticated') are restricted. The
-- service role (cancel-session, report-no-show, the webhook) and the SQL
-- editor (no JWT claims at all) pass straight through. Same JWT-claims
-- technique as guard_paid_session_reschedule (20260912000000).
create or replace function public.guard_session_terminal()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  uid uuid := nullif(claims->>'sub', '')::uuid;
begin
  if claims->>'role' is distinct from 'authenticated' then
    return new;
  end if;

  -- Cancelled / no_show is final for everyone but the server.
  if old.status in ('cancelled', 'no_show') then
    raise exception 'A cancelled session cannot be changed.';
  end if;

  -- Cancelling and no-show reports go through the server (cancel-session,
  -- report-no-show), which applies the refund ladder. Writing the status
  -- straight from the app would cancel a paid lesson without refunding it.
  -- (Unpaid sessions are deleted by the app, not set to cancelled.)
  if new.status in ('cancelled', 'no_show') and new.status is distinct from old.status then
    raise exception 'Sessions are cancelled through Artium so refunds are applied.';
  end if;

  if uid = old.learner_id then
    -- A learner may change the date/time only as a counter-proposal. Moving
    -- it while confirming (or leaving the status alone) would let them pick
    -- a past slot on an unpaid session, pay, and report a no-show.
    if (new.session_date is distinct from old.session_date
        or new.session_time is distinct from old.session_time)
       and new.status is distinct from 'student_proposed' then
      raise exception 'A session''s time can only be changed as a counter-proposal.';
    end if;
    -- Learner confirms the teacher's proposal, or leaves a confirmed
    -- session confirmed. Confirming their own counter-proposal (the
    -- teacher's call) or anything else is refused.
    if new.status = 'confirmed' and old.status not in ('teacher_proposed', 'confirmed') then
      raise exception 'Only a session proposed by the teacher can be confirmed by the learner.';
    end if;
    -- Counter-proposal: from the teacher's proposal, an earlier counter, or
    -- a confirmed session (a paid one can only be moved this way, see
    -- guard_paid_session_reschedule).
    if new.status = 'student_proposed'
       and old.status not in ('teacher_proposed', 'student_proposed', 'confirmed') then
      raise exception 'This session cannot be counter-proposed.';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trg_guard_session_terminal on public.lesson_sessions;
create trigger trg_guard_session_terminal
  before update on public.lesson_sessions
  for each row execute function public.guard_session_terminal();

-- ---------------------------------------------------------------------
-- 2. payments: more statuses, and one payment per session.
-- ---------------------------------------------------------------------
-- Drop whatever status check(s) exist (the constraint has carried two names,
-- see 20261011000000) and put back one list that includes the new statuses.
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.payments'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%(status %'
  loop
    execute format('alter table public.payments drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.payments add constraint payments_status_check
  check (status in ('pending', 'paid', 'failed', 'refunded', 'partially_refunded', 'expired', 'disputed'));

-- Until now every click on "Pay" inserted a new pending row. Keep only the
-- newest pending row per session so the unique index below can be built.
update public.payments p
   set status = 'expired', updated_at = now()
 where p.status = 'pending'
   and p.lesson_session_id is not null
   and p.id not in (
     select distinct on (lesson_session_id) id
       from public.payments
      where status = 'pending' and lesson_session_id is not null
      order by lesson_session_id, created_at desc
   );

-- At most one money-holding payment per session...
create unique index if not exists payments_one_paid_per_session
  on public.payments (lesson_session_id)
  where lesson_session_id is not null
    and status in ('paid', 'partially_refunded', 'disputed');

-- ...and at most one open checkout per session.
create unique index if not exists payments_one_pending_per_session
  on public.payments (lesson_session_id)
  where lesson_session_id is not null
    and status = 'pending';

-- ---------------------------------------------------------------------
-- 3. Which teachers can take payments (for the learner-side booking UI).
-- ---------------------------------------------------------------------
-- teacher_payout_accounts is readable by its owner only, so a learner can't
-- see who is bookable. This answers just that, for a set of profiles at
-- once, and exposes nothing else about the account.
create or replace function public.teachers_taking_payments(p_ids uuid[])
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.profile_id
    from teacher_payout_accounts t
   where t.payout_status = 'ready'
     and t.profile_id = any(p_ids)
     and cardinality(p_ids) <= 500;
$$;

revoke all on function public.teachers_taking_payments(uuid[]) from public, anon;
grant execute on function public.teachers_taking_payments(uuid[]) to authenticated;

-- Should return 5 rows: 1 trigger, 2 indexes, 2 functions.
select 'trigger' as kind, tgname as name from pg_trigger where tgname = 'trg_guard_session_terminal'
union all
select 'index', indexname from pg_indexes
 where schemaname = 'public' and indexname in ('payments_one_paid_per_session', 'payments_one_pending_per_session')
union all
select 'function', routine_name from information_schema.routines
 where routine_schema = 'public' and routine_name in ('guard_session_terminal', 'teachers_taking_payments');
