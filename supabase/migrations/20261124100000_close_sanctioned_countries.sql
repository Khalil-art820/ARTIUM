-- Owner decision 2026-11-24: Cuba, Iran, North Korea, Syria, Russia and
-- Belarus are fully closed: no learner signup, no payment, no teaching.
-- Stage 1 (20261124000000) had left Russia and Belarus half-open (learners
-- could register but not pay; teachers waiting for legal review). The app
-- also stops listing closed countries in the country picker.
--
-- The countries_derive trigger turns the matching booleans off, and the
-- countries_audit trigger records each change in admin_audit_log (actor
-- "SQL editor / server").
--
-- Run this in the Supabase SQL editor.

update public.countries
   set learner_status = 'DISABLED',
       teacher_status = 'DISABLED',
       admin_notes = 'Closed by owner decision 2026-11-24 (EU sanctions / Stripe).'
 where iso2 in ('CU', 'IR', 'KP', 'SY', 'RU', 'BY')
   and (learner_status <> 'DISABLED'
        or teacher_status <> 'DISABLED'
        or admin_notes is distinct from 'Closed by owner decision 2026-11-24 (EU sanctions / Stripe).');

-- Should return 6 rows, every one: DISABLED, false, false, DISABLED, false, false.
select iso2, name,
       learner_status, learner_registration_enabled, learner_payment_enabled,
       teacher_status, teacher_registration_enabled, teacher_paid_lessons_enabled
  from public.countries
 where iso2 in ('CU', 'IR', 'KP', 'SY', 'RU', 'BY')
 order by name;
