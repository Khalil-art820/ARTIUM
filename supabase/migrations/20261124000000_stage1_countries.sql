-- Stage 1 of docs/international-teacher-onboarding-plan.md: one row per
-- country with SEPARATE learner and teacher eligibility, an audit log of
-- every change to it, and a structured country on the profile.
--
--   1. countries: statuses are the source of truth, the booleans are derived
--      from them by a trigger so the two can never disagree.
--   2. admin_audit_log: generic (action / entity / entity_id / changes), so
--      later stages log commission, verification decisions, tax-data views
--      into the same place.
--   3. list_countries(): the only public read of countries.
--   4. profiles.country_code, and a learner cannot pick a country that is
--      closed to learners.
--
-- Vocabulary: "learner" is the paying member (role 'learner'), "teacher" is
-- a conservatory student who teaches (role 'student'). Learner-side columns
-- are never called student_*.
--
-- Run this in the Supabase SQL editor. Safe to re-run: the seed never
-- overwrites a row, so admin edits survive.
--
-- Deploy order: run this BEFORE deploying the stripe-checkout change (it
-- reads countries / profiles.country_code) and before the frontend that
-- calls list_countries().

-- ---------------------------------------------------------------------
-- 1. countries
-- ---------------------------------------------------------------------
create table if not exists public.countries (
  iso2 text primary key check (iso2 ~ '^[A-Z]{2}$'),
  name text not null,

  -- Learner side: may a paying member from here sign up, and pay?
  learner_status text not null default 'ENABLED'
    check (learner_status in ('ENABLED', 'PAYMENT_RESTRICTED', 'DISABLED')),
  learner_registration_enabled boolean not null default true,
  learner_payment_enabled boolean not null default true,

  -- Teacher side: registration (creating a profile) and paid lessons are
  -- separate. Only paid lessons depend on Stripe approval.
  teacher_status text not null default 'PENDING_STRIPE_APPROVAL'
    check (teacher_status in ('ENABLED', 'PENDING_STRIPE_APPROVAL', 'PENDING_LEGAL_REVIEW', 'DISABLED')),
  teacher_registration_enabled boolean not null default true,
  teacher_paid_lessons_enabled boolean not null default false,

  stripe_connect_supported boolean not null default false,
  -- 'pending' is "not looked at yet", never a refusal: nothing here says rejected.
  stripe_approval_status text not null default 'pending'
    check (stripe_approval_status in ('to_verify', 'confirmed', 'not_supported', 'pending')),
  -- Only filled in once confirmed in the Stripe Dashboard.
  payout_currency text check (payout_currency is null or payout_currency ~ '^[A-Za-z]{3}$'),

  -- Shown to teachers when asking for their tax / professional details.
  tax_identifier_description text,
  professional_registration_required boolean not null default false,
  manual_verification_required boolean not null default false,

  onboarding_notes text,
  last_verified_at timestamptz,
  admin_notes text,

  updated_at timestamptz not null default now(),
  updated_by uuid
);

-- Derived values, immutable identity, and who/when. A trigger rather than
-- generated columns because teacher_registration_enabled is a real admin
-- toggle that is only overridden in one case. Overwritten rather than
-- raised (like guard_profile_authority), so a form that sends the whole row
-- back can't fail on a field it never meant to change.
-- auth.uid() is null in the SQL editor, which leaves updated_by null.
create or replace function public.countries_derive()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    new.iso2 := old.iso2;
    new.name := old.name;
  end if;

  new.learner_registration_enabled := new.learner_status in ('ENABLED', 'PAYMENT_RESTRICTED');
  new.learner_payment_enabled := new.learner_status = 'ENABLED';
  new.teacher_paid_lessons_enabled := new.teacher_status = 'ENABLED';
  if new.teacher_status = 'DISABLED' then
    new.teacher_registration_enabled := false;
  elsif tg_op = 'UPDATE' and old.teacher_status = 'DISABLED' then
    -- Leaving DISABLED re-opens registration. Otherwise the forced false
    -- above would stick and a re-enabled country would stay closed until
    -- someone also flipped the toggle by hand.
    new.teacher_registration_enabled := true;
  end if;

  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

revoke all on function public.countries_derive() from public, anon, authenticated;

drop trigger if exists countries_derive on public.countries;
create trigger countries_derive
  before insert or update on public.countries
  for each row execute function public.countries_derive();

-- ---------------------------------------------------------------------
-- 2. admin_audit_log
-- ---------------------------------------------------------------------
-- Generic on purpose: entity + entity_id name what changed, changes holds
-- {field: {"from": x, "to": y}}. actor_id is null for the SQL editor and
-- the server (service role).
create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  changes jsonb
);

create index if not exists admin_audit_log_entity_idx
  on public.admin_audit_log (entity, entity_id, created_at desc);

alter table public.admin_audit_log enable row level security;

-- Admins read; nobody writes through the API. Writes come only from
-- security definer triggers/functions and the service role.
revoke all on public.admin_audit_log from anon, authenticated;
grant select on public.admin_audit_log to authenticated;

drop policy if exists "audit log admin read" on public.admin_audit_log;
create policy "audit log admin read" on public.admin_audit_log
  for select using (public.is_admin());

-- The one way to add a row, for triggers here and in later stages. Not
-- granted to anon/authenticated, otherwise anyone could forge history.
create or replace function public.write_audit_log(
  p_action text, p_entity text, p_entity_id text, p_changes jsonb
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.admin_audit_log (actor_id, action, entity, entity_id, changes)
  values (auth.uid(), p_action, p_entity, p_entity_id, p_changes);
$$;

-- Supabase's default privileges grant EXECUTE on new public functions to anon,
-- authenticated and service_role by name, so "from public" alone leaves this
-- callable through /rest/v1/rpc. Revoke the roles explicitly. The same goes
-- for the trigger functions below: harmless to call, but no reason to expose.
revoke all on function public.write_audit_log(text, text, text, jsonb) from public, anon, authenticated;

-- Only fields that really changed, and not the bookkeeping the countries
-- trigger rewrites on every save (updated_at / updated_by).
create or replace function public.countries_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changes jsonb;
begin
  select jsonb_object_agg(n.key, jsonb_build_object('from', o.value, 'to', n.value))
    into changes
  from jsonb_each(to_jsonb(new)) n
  join jsonb_each(to_jsonb(old)) o using (key)
  where n.value is distinct from o.value
    and n.key not in ('updated_at', 'updated_by');

  if changes is not null then
    perform public.write_audit_log('country.update', 'countries', new.iso2, changes);
  end if;
  return new;
end;
$$;

revoke all on function public.countries_audit() from public, anon, authenticated;

drop trigger if exists countries_audit on public.countries;
create trigger countries_audit
  after update on public.countries
  for each row execute function public.countries_audit();

-- ---------------------------------------------------------------------
-- 3. countries: row level security and the public read
-- ---------------------------------------------------------------------
alter table public.countries enable row level security;

revoke all on public.countries from anon, authenticated;
grant select, update on public.countries to authenticated;

drop policy if exists "countries admin read" on public.countries;
create policy "countries admin read" on public.countries
  for select using (public.is_admin());

drop policy if exists "countries admin update" on public.countries;
create policy "countries admin update" on public.countries
  for update using (public.is_admin()) with check (public.is_admin());
-- No insert or delete policy, and no grant: the 249 rows are fixed.

-- Signup can happen before the account exists, so anon may call this. It
-- returns only the eligibility flags: admin_notes, onboarding_notes and the
-- Stripe fields stay behind the admin-only policy.
create or replace function public.list_countries()
returns table (
  iso2 text,
  name text,
  learner_status text,
  learner_registration_enabled boolean,
  learner_payment_enabled boolean,
  teacher_status text,
  teacher_registration_enabled boolean,
  teacher_paid_lessons_enabled boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select c.iso2, c.name, c.learner_status, c.learner_registration_enabled,
         c.learner_payment_enabled, c.teacher_status,
         c.teacher_registration_enabled, c.teacher_paid_lessons_enabled
  from public.countries c
  order by c.name;
$$;

revoke all on function public.list_countries() from public;
grant execute on function public.list_countries() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Seed: all 249 ISO 3166-1 alpha-2 countries
-- ---------------------------------------------------------------------
-- ON CONFLICT DO NOTHING so a re-run never overwrites an admin's edit. The
-- booleans are filled in by the trigger.
--
-- [LEGAL] to review: the sanctions-driven defaults below. CU, IR, KP, SY
-- closed to learners and teachers; RU and BY can register as learners but
-- not pay, and teachers there wait for legal review. Sanctioned regions
-- inside a country (Crimea, Donetsk, Luhansk) can't be told apart by country
-- code; Stripe's own screening covers them.
--
-- Teachers: every other country starts at PENDING_STRIPE_APPROVAL with
-- registration open, so nobody is turned away from creating a profile.
-- The 33 candidates are flagged 'to_verify', NOT confirmed: Stripe's
-- published docs say cross-border Connect works there, but each must be
-- checked in the Stripe Dashboard before its teacher_status is set to
-- ENABLED. Iceland is deliberately not among them.
insert into public.countries (
  iso2, name, learner_status, teacher_status,
  stripe_connect_supported, stripe_approval_status, onboarding_notes,
  tax_identifier_description, professional_registration_required
)
select
  v.iso2, v.name,
  case
    when v.iso2 in ('CU', 'IR', 'KP', 'SY') then 'DISABLED'            -- [LEGAL]
    when v.iso2 in ('RU', 'BY') then 'PAYMENT_RESTRICTED'              -- [LEGAL]
    else 'ENABLED'
  end,
  case
    when v.iso2 in ('CU', 'IR', 'KP', 'SY') then 'DISABLED'            -- [LEGAL]
    when v.iso2 in ('RU', 'BY') then 'PENDING_LEGAL_REVIEW'            -- [LEGAL]
    else 'PENDING_STRIPE_APPROVAL'
  end,
  v.iso2 in ('US','CA','GB','CH','AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LI','LT','LU','MT','NL','NO','PL','PT','RO','SK','SI','ES','SE'),
  case when v.iso2 in ('US','CA','GB','CH','AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LI','LT','LU','MT','NL','NO','PL','PT','RO','SK','SI','ES','SE')
       then 'to_verify' else 'pending' end,
  case when v.iso2 in ('US','CA','GB','CH','AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LI','LT','LU','MT','NL','NO','PL','PT','RO','SK','SI','ES','SE')
       then 'Stripe Connect supported per Stripe''s published cross-border docs. Verify in the Stripe Dashboard before enabling.' end,
  case when v.iso2 = 'FR' then 'SIRET (business), numéro fiscal (personal)' end,
  v.iso2 = 'FR'
from (values
  ('AF', 'Afghanistan'),
  ('AX', 'Åland Islands'),
  ('AL', 'Albania'),
  ('DZ', 'Algeria'),
  ('AS', 'American Samoa'),
  ('AD', 'Andorra'),
  ('AO', 'Angola'),
  ('AI', 'Anguilla'),
  ('AQ', 'Antarctica'),
  ('AG', 'Antigua and Barbuda'),
  ('AR', 'Argentina'),
  ('AM', 'Armenia'),
  ('AW', 'Aruba'),
  ('AU', 'Australia'),
  ('AT', 'Austria'),
  ('AZ', 'Azerbaijan'),
  ('BS', 'Bahamas'),
  ('BH', 'Bahrain'),
  ('BD', 'Bangladesh'),
  ('BB', 'Barbados'),
  ('BY', 'Belarus'),
  ('BE', 'Belgium'),
  ('BZ', 'Belize'),
  ('BJ', 'Benin'),
  ('BM', 'Bermuda'),
  ('BT', 'Bhutan'),
  ('BO', 'Bolivia'),
  ('BQ', 'Bonaire, Sint Eustatius and Saba'),
  ('BA', 'Bosnia and Herzegovina'),
  ('BW', 'Botswana'),
  ('BV', 'Bouvet Island'),
  ('BR', 'Brazil'),
  ('IO', 'British Indian Ocean Territory'),
  ('BN', 'Brunei Darussalam'),
  ('BG', 'Bulgaria'),
  ('BF', 'Burkina Faso'),
  ('BI', 'Burundi'),
  ('CV', 'Cabo Verde'),
  ('KH', 'Cambodia'),
  ('CM', 'Cameroon'),
  ('CA', 'Canada'),
  ('KY', 'Cayman Islands'),
  ('CF', 'Central African Republic'),
  ('TD', 'Chad'),
  ('CL', 'Chile'),
  ('CN', 'China'),
  ('CX', 'Christmas Island'),
  ('CC', 'Cocos (Keeling) Islands'),
  ('CO', 'Colombia'),
  ('KM', 'Comoros'),
  ('CG', 'Congo'),
  ('CD', 'Congo, Democratic Republic of the'),
  ('CK', 'Cook Islands'),
  ('CR', 'Costa Rica'),
  ('CI', 'Côte d''Ivoire'),
  ('HR', 'Croatia'),
  ('CU', 'Cuba'),
  ('CW', 'Curaçao'),
  ('CY', 'Cyprus'),
  ('CZ', 'Czechia'),
  ('DK', 'Denmark'),
  ('DJ', 'Djibouti'),
  ('DM', 'Dominica'),
  ('DO', 'Dominican Republic'),
  ('EC', 'Ecuador'),
  ('EG', 'Egypt'),
  ('SV', 'El Salvador'),
  ('GQ', 'Equatorial Guinea'),
  ('ER', 'Eritrea'),
  ('EE', 'Estonia'),
  ('SZ', 'Eswatini'),
  ('ET', 'Ethiopia'),
  ('FK', 'Falkland Islands (Malvinas)'),
  ('FO', 'Faroe Islands'),
  ('FJ', 'Fiji'),
  ('FI', 'Finland'),
  ('FR', 'France'),
  ('GF', 'French Guiana'),
  ('PF', 'French Polynesia'),
  ('TF', 'French Southern Territories'),
  ('GA', 'Gabon'),
  ('GM', 'Gambia'),
  ('GE', 'Georgia'),
  ('DE', 'Germany'),
  ('GH', 'Ghana'),
  ('GI', 'Gibraltar'),
  ('GR', 'Greece'),
  ('GL', 'Greenland'),
  ('GD', 'Grenada'),
  ('GP', 'Guadeloupe'),
  ('GU', 'Guam'),
  ('GT', 'Guatemala'),
  ('GG', 'Guernsey'),
  ('GN', 'Guinea'),
  ('GW', 'Guinea-Bissau'),
  ('GY', 'Guyana'),
  ('HT', 'Haiti'),
  ('HM', 'Heard Island and McDonald Islands'),
  ('VA', 'Holy See'),
  ('HN', 'Honduras'),
  ('HK', 'Hong Kong'),
  ('HU', 'Hungary'),
  ('IS', 'Iceland'),
  ('IN', 'India'),
  ('ID', 'Indonesia'),
  ('IR', 'Iran'),
  ('IQ', 'Iraq'),
  ('IE', 'Ireland'),
  ('IM', 'Isle of Man'),
  ('IL', 'Israel'),
  ('IT', 'Italy'),
  ('JM', 'Jamaica'),
  ('JP', 'Japan'),
  ('JE', 'Jersey'),
  ('JO', 'Jordan'),
  ('KZ', 'Kazakhstan'),
  ('KE', 'Kenya'),
  ('KI', 'Kiribati'),
  ('KP', 'North Korea'),
  ('KR', 'South Korea'),
  ('KW', 'Kuwait'),
  ('KG', 'Kyrgyzstan'),
  ('LA', 'Laos'),
  ('LV', 'Latvia'),
  ('LB', 'Lebanon'),
  ('LS', 'Lesotho'),
  ('LR', 'Liberia'),
  ('LY', 'Libya'),
  ('LI', 'Liechtenstein'),
  ('LT', 'Lithuania'),
  ('LU', 'Luxembourg'),
  ('MO', 'Macao'),
  ('MG', 'Madagascar'),
  ('MW', 'Malawi'),
  ('MY', 'Malaysia'),
  ('MV', 'Maldives'),
  ('ML', 'Mali'),
  ('MT', 'Malta'),
  ('MH', 'Marshall Islands'),
  ('MQ', 'Martinique'),
  ('MR', 'Mauritania'),
  ('MU', 'Mauritius'),
  ('YT', 'Mayotte'),
  ('MX', 'Mexico'),
  ('FM', 'Micronesia'),
  ('MD', 'Moldova'),
  ('MC', 'Monaco'),
  ('MN', 'Mongolia'),
  ('ME', 'Montenegro'),
  ('MS', 'Montserrat'),
  ('MA', 'Morocco'),
  ('MZ', 'Mozambique'),
  ('MM', 'Myanmar'),
  ('NA', 'Namibia'),
  ('NR', 'Nauru'),
  ('NP', 'Nepal'),
  ('NL', 'Netherlands'),
  ('NC', 'New Caledonia'),
  ('NZ', 'New Zealand'),
  ('NI', 'Nicaragua'),
  ('NE', 'Niger'),
  ('NG', 'Nigeria'),
  ('NU', 'Niue'),
  ('NF', 'Norfolk Island'),
  ('MK', 'North Macedonia'),
  ('MP', 'Northern Mariana Islands'),
  ('NO', 'Norway'),
  ('OM', 'Oman'),
  ('PK', 'Pakistan'),
  ('PW', 'Palau'),
  ('PS', 'Palestine, State of'),
  ('PA', 'Panama'),
  ('PG', 'Papua New Guinea'),
  ('PY', 'Paraguay'),
  ('PE', 'Peru'),
  ('PH', 'Philippines'),
  ('PN', 'Pitcairn'),
  ('PL', 'Poland'),
  ('PT', 'Portugal'),
  ('PR', 'Puerto Rico'),
  ('QA', 'Qatar'),
  ('RE', 'Réunion'),
  ('RO', 'Romania'),
  ('RU', 'Russia'),
  ('RW', 'Rwanda'),
  ('BL', 'Saint Barthélemy'),
  ('SH', 'Saint Helena, Ascension and Tristan da Cunha'),
  ('KN', 'Saint Kitts and Nevis'),
  ('LC', 'Saint Lucia'),
  ('MF', 'Saint Martin (French part)'),
  ('PM', 'Saint Pierre and Miquelon'),
  ('VC', 'Saint Vincent and the Grenadines'),
  ('WS', 'Samoa'),
  ('SM', 'San Marino'),
  ('ST', 'Sao Tome and Principe'),
  ('SA', 'Saudi Arabia'),
  ('SN', 'Senegal'),
  ('RS', 'Serbia'),
  ('SC', 'Seychelles'),
  ('SL', 'Sierra Leone'),
  ('SG', 'Singapore'),
  ('SX', 'Sint Maarten (Dutch part)'),
  ('SK', 'Slovakia'),
  ('SI', 'Slovenia'),
  ('SB', 'Solomon Islands'),
  ('SO', 'Somalia'),
  ('ZA', 'South Africa'),
  ('GS', 'South Georgia and the South Sandwich Islands'),
  ('SS', 'South Sudan'),
  ('ES', 'Spain'),
  ('LK', 'Sri Lanka'),
  ('SD', 'Sudan'),
  ('SR', 'Suriname'),
  ('SJ', 'Svalbard and Jan Mayen'),
  ('SE', 'Sweden'),
  ('CH', 'Switzerland'),
  ('SY', 'Syria'),
  ('TW', 'Taiwan'),
  ('TJ', 'Tajikistan'),
  ('TZ', 'Tanzania'),
  ('TH', 'Thailand'),
  ('TL', 'Timor-Leste'),
  ('TG', 'Togo'),
  ('TK', 'Tokelau'),
  ('TO', 'Tonga'),
  ('TT', 'Trinidad and Tobago'),
  ('TN', 'Tunisia'),
  ('TR', 'Türkiye'),
  ('TM', 'Turkmenistan'),
  ('TC', 'Turks and Caicos Islands'),
  ('TV', 'Tuvalu'),
  ('UG', 'Uganda'),
  ('UA', 'Ukraine'),
  ('AE', 'United Arab Emirates'),
  ('GB', 'United Kingdom'),
  ('UM', 'United States Minor Outlying Islands'),
  ('US', 'United States'),
  ('UY', 'Uruguay'),
  ('UZ', 'Uzbekistan'),
  ('VU', 'Vanuatu'),
  ('VE', 'Venezuela'),
  ('VN', 'Viet Nam'),
  ('VG', 'Virgin Islands (British)'),
  ('VI', 'Virgin Islands (U.S.)'),
  ('WF', 'Wallis and Futuna'),
  ('EH', 'Western Sahara'),
  ('YE', 'Yemen'),
  ('ZM', 'Zambia'),
  ('ZW', 'Zimbabwe')
) as v(iso2, name)
on conflict (iso2) do nothing;

-- ---------------------------------------------------------------------
-- 5. profiles.country_code
-- ---------------------------------------------------------------------
-- Nothing structured existed: city_country (20261110000000) is free text for
-- the globe and is left alone. Null means "not given", which is every
-- existing member and is never restricted.
alter table public.profiles
  add column if not exists country_code text references public.countries(iso2);

-- Every learner has a country, and it is one learners may register from.
--   * 'country_required': a learner row is inserted without one, or an
--     update clears one. Without this a client could skip the check by
--     simply sending null.
--   * 'country_not_available': the country is closed to learners.
-- Checked only when country_code is inserted or changed (or role changes),
-- so existing learners with no country, or whose country is closed later,
-- can still save everything else. (UPDATE OF fires whenever the column is
-- in the SET list, hence the explicit comparisons.)
-- "Learner" here means any role other than 'student': profiles.role has no
-- CHECK constraint, and only 'student' and 'learner' exist in practice, so
-- an unexpected value must not be a way around the rule. Teachers are not
-- checked: their registration rule belongs to the teacher onboarding step.
-- Applies to every writer, admins included, so a closed country can't be
-- slipped in by hand either.
create or replace function public.guard_learner_country()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is not distinct from 'student' then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.country_code is not distinct from old.country_code
     and old.country_code is null then
    -- Untouched legacy null (including a role change): leave it alone.
    return new;
  end if;

  if tg_op = 'INSERT' or new.country_code is distinct from old.country_code then
    if new.country_code is null then
      raise exception 'country_required';
    end if;
    if not exists (
      select 1 from public.countries c
      where c.iso2 = new.country_code and c.learner_registration_enabled
    ) then
      raise exception 'country_not_available';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_learner_country() from public, anon, authenticated;

drop trigger if exists profiles_learner_country on public.profiles;
create trigger profiles_learner_country
  before insert or update of country_code, role on public.profiles
  for each row execute function public.guard_learner_country();

-- ---------------------------------------------------------------------
-- Verification. Should return one row:
--   countries = 249, learners_disabled = 4, learners_payment_restricted = 2,
--   teachers_disabled = 4, teachers_legal_review = 2, stripe_to_verify = 33,
--   teachers_paid_lessons_on = 0, fn_ok = true, profiles_column = true,
--   audit_anon_can_execute = false, audit_authenticated_can_execute = false
-- ---------------------------------------------------------------------
select
  (select count(*) from public.countries) as countries,
  (select count(*) from public.countries where learner_status = 'DISABLED') as learners_disabled,
  (select count(*) from public.countries where learner_status = 'PAYMENT_RESTRICTED') as learners_payment_restricted,
  (select count(*) from public.countries where teacher_status = 'DISABLED') as teachers_disabled,
  (select count(*) from public.countries where teacher_status = 'PENDING_LEGAL_REVIEW') as teachers_legal_review,
  (select count(*) from public.countries where stripe_approval_status = 'to_verify') as stripe_to_verify,
  (select count(*) from public.countries where teacher_paid_lessons_enabled) as teachers_paid_lessons_on,
  (select count(*) = 249 from public.list_countries()) as fn_ok,
  exists (select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'profiles'
            and column_name = 'country_code') as profiles_column,
  has_function_privilege('anon', 'public.write_audit_log(text,text,text,jsonb)', 'execute') as audit_anon_can_execute,
  has_function_privilege('authenticated', 'public.write_audit_log(text,text,text,jsonb)', 'execute') as audit_authenticated_can_execute;
