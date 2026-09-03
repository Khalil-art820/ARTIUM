-- The €65 aclassicaltone promotion price used to be hard-coded twice (App.jsx
-- and the stripe-checkout edge function) with no shared source of truth.
-- It now lives here; both readers fall back to 6500 if this row is missing.
insert into platform_settings (key, value)
values ('promo_total_cents', '{"cents": 6500}'::jsonb)
on conflict (key) do nothing;

-- platform_settings is service-role-only by default (RLS, zero policies).
-- The promo price is the one row the browser may read — it has to display
-- the price — so the policy is scoped to exactly that key, keeping the
-- commission rate and any future settings invisible to clients.
drop policy if exists "Anyone signed in can read the promo price" on platform_settings;
create policy "Anyone signed in can read the promo price"
  on platform_settings for select
  to authenticated
  using (key = 'promo_total_cents');
