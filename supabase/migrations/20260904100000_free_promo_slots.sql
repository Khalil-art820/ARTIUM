-- aclassicaltone free weekly spotlight (Saturday 12:30 Europe/Paris)
--
-- Adds a second, free sub-flow to the existing `promotions` table (created by
-- 20260717_promotions.sql) alongside the paid €65 package. Existing rows are
-- untouched — they default to kind = 'paid', which is what they already are.

-- 1. New columns
alter table promotions add column if not exists kind text not null default 'paid';
alter table promotions add column if not exists slot_date date;
alter table promotions add column if not exists rejection_reason text;

-- 2. Keep the vocabulary closed, idempotently
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'promotions_kind_check'
  ) then
    alter table promotions
      add constraint promotions_kind_check check (kind in ('paid', 'free_weekly'));
  end if;
end $$;

-- 3. RLS — additive only. The table already has RLS enabled with:
--   - "promotions insert own"          (insert: user_id = auth.uid())
--   - "promotions read own or admin"   (select: own rows, or admin reads all)
--   - "promotions admin update"        (update: admin only)
-- Those stay exactly as they are — a user's own free/paid submissions and an
-- admin's full view both keep working unchanged. What's missing is a way for
-- ANY signed-in user (not just the submitter or an admin) to know which
-- Saturdays are already taken, so the slot picker can grey them out. The
-- winning video is going to be posted publicly on Instagram anyway, so
-- surfacing "this Saturday is spoken for" is not a new leak — this policy is
-- scoped tightly to kind = 'free_weekly' and status = 'approved' and reveals
-- nothing about anyone's pending or rejected submissions.
drop policy if exists "promotions read approved free slots" on promotions;
create policy "promotions read approved free slots"
  on promotions for select
  to authenticated
  using (kind = 'free_weekly' and status = 'approved');

-- Note: the auto-reject-on-approve behaviour (rejecting every other pending
-- free submission for the same Saturday when one is approved) is implemented
-- client-side in the admin screen, as two separate updates under the existing
-- "promotions admin update" policy — no new update policy is needed for that.
