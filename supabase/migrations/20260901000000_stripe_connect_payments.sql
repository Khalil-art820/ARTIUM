-- Stripe Connect payout accounts, configurable commission, and a payments
-- ledger. Replaces the hard-coded 11% fee and client-trusted amounts in the
-- stripe-checkout edge function with server-computed, auditable numbers.
--
-- Everything here is written by edge functions using the service role key.
-- Nothing in this file grants INSERT/UPDATE to authenticated or anon.

-- ---------------------------------------------------------------------
-- 1. Configurable commission
-- ---------------------------------------------------------------------
create table if not exists platform_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into platform_settings (key, value)
values ('artium_commission_rate', '{"rate": 0.10}'::jsonb)
on conflict (key) do nothing;

alter table platform_settings enable row level security;
-- No policies: nothing is granted to anon/authenticated, so the client can
-- never read or write this table. Edge functions use the service role,
-- which bypasses RLS entirely.

-- Per-teacher / per-category overrides. Empty for now; the checkout function
-- checks here first (most specific match: teacher_id + category, then
-- teacher_id only, then category only) and falls back to platform_settings.
create table if not exists commission_overrides (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references profiles(id) on delete cascade,
  category text,
  rate numeric not null,
  created_at timestamptz not null default now(),
  constraint commission_overrides_scope check (teacher_id is not null or category is not null)
);

alter table commission_overrides enable row level security;
-- No policies: service-role only, same as platform_settings.

-- ---------------------------------------------------------------------
-- 2. Teacher payout accounts (Stripe Connect Express)
-- ---------------------------------------------------------------------
create table if not exists teacher_payout_accounts (
  profile_id uuid primary key references profiles(id) on delete cascade,
  stripe_account_id text unique,
  stripe_onboarding_status text not null default 'not_started'
    check (stripe_onboarding_status in ('not_started', 'in_progress', 'complete')),
  payout_status text not null default 'none'
    check (payout_status in ('none', 'pending', 'ready', 'disabled')),
  country text,
  legal_name text,
  professional_status text,
  siret text,
  tax_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table teacher_payout_accounts enable row level security;

-- The owner can see their own payout status (for the "Set up payouts" UI).
-- No INSERT/UPDATE/DELETE policy for authenticated/anon: only the edge
-- functions (service role) write this table.
drop policy if exists "Owner can read own payout account" on teacher_payout_accounts;
create policy "Owner can read own payout account"
  on teacher_payout_accounts for select
  using (auth.uid() = profile_id);

-- ---------------------------------------------------------------------
-- 3. Payments ledger
-- ---------------------------------------------------------------------
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  checkout_session_id text unique,
  payment_intent_id text,
  payer_user_id uuid references profiles(id) on delete set null,
  teacher_profile_id uuid references profiles(id) on delete set null,
  kind text not null check (kind in ('lesson', 'promotion')),
  currency text not null default 'eur',
  gross_amount_cents integer not null,
  commission_cents integer not null,
  teacher_amount_cents integer not null,
  -- Actual Stripe processing fee, filled in from the balance transaction by
  -- the webhook once the charge settles. Never hard-coded, never estimated.
  stripe_fee_cents integer,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table payments enable row level security;

-- Payer and teacher can each see their own side of a payment. No client
-- writes: rows are created and updated only by the checkout and webhook
-- edge functions via the service role.
drop policy if exists "Payer can read own payments" on payments;
create policy "Payer can read own payments"
  on payments for select
  using (auth.uid() = payer_user_id);

drop policy if exists "Teacher can read own payments" on payments;
create policy "Teacher can read own payments"
  on payments for select
  using (auth.uid() = teacher_profile_id);
