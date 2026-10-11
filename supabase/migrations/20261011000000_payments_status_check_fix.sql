-- payments was created while a hand-made table of the same name still held
-- the constraint name payments_status_check, so its own inline status check
-- came out as payments_status_check1. 20260912 replaced
-- "payments_status_check" with a list that allows 'partially_refunded', but
-- left payments_status_check1 (pending/paid/failed/refunded) in force — every
-- partial refund's ledger write was rejected while Stripe refunded fine.
--
-- Drop every status check on payments that doesn't allow
-- 'partially_refunded', keeping the 20260912 one.
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.payments'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%(status %'
      and pg_get_constraintdef(oid) not ilike '%partially_refunded%'
  loop
    execute format('alter table public.payments drop constraint %I', r.conname);
  end loop;
end $$;
