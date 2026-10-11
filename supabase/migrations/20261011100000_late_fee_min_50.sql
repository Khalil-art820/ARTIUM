-- Late-cancellation fee: 50% minimum (was 0–100). Lift any lower setting
-- first so the new check can be added, then enforce 50–100 in the database
-- so the bound doesn't depend on the app's slider.
update teacher_rules set late_fee_pct = 50, updated_at = now() where late_fee_pct < 50;

do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.teacher_rules'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%late_fee_pct%'
  loop
    execute format('alter table public.teacher_rules drop constraint %I', r.conname);
  end loop;
end $$;

alter table teacher_rules add constraint teacher_rules_late_fee_pct_check
  check (late_fee_pct between 50 and 100);
alter table teacher_rules alter column late_fee_pct set default 50;
