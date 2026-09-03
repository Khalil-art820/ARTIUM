-- The admin's "Delete week" wipes a Saturday's free-spotlight requests
-- outright. The original promotions policies covered insert/select/update
-- only, so deletion needs its own admin-scoped policy.
drop policy if exists "promotions admin delete" on promotions;
create policy "promotions admin delete" on promotions
  for delete using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin)
  );
