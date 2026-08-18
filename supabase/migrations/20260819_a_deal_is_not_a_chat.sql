-- A deal is not a chat.
--
-- "Find a Concert Pianist" is a booking flow, not a message thread: a hirer
-- opens an inquiry, the two sides talk, one of them proposes terms, the other
-- accepts, and both sign. The talking and the terms are different kinds of
-- data with different rules — a chat message can be sent by mistake and lived
-- with, a fee cannot silently change after it was agreed — so they get
-- different tables. concert_messages is the conversation. concert_offers is
-- the ledger of what was actually proposed, version by version, none of them
-- ever overwritten. concert_inquiries is the envelope that holds both and
-- carries the one thing a chat message can't: a status, and eventually two
-- signatures.
--
-- The hirer side has no profiles row — booking a pianist doesn't require an
-- Artium account with a conservatory affiliation, only a name and an email,
-- taken from auth metadata at sign-in. That means concert_inquiries has to
-- carry hirer_name and hirer_email denormalised on the row itself: there is
-- nowhere else for the pianist's side of the UI to read them from.

create table if not exists public.concert_inquiries (
  id uuid primary key default gen_random_uuid(),
  hirer_id uuid not null,
  hirer_name text not null,
  hirer_email text not null,
  pianist_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  event_date date,
  location text not null,
  venue text,
  audience text,
  repertoire text,
  message text,
  budget text,
  status text not null default 'open'
    check (status in ('open', 'negotiating', 'agreed', 'confirmed', 'declined', 'cancelled')),
  hirer_signed_name text,
  hirer_signed_at timestamptz,
  pianist_signed_name text,
  pianist_signed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.concert_inquiries enable row level security;

-- This is a private negotiation between two named parties, not something a
-- third pianist or a browsing hirer should be able to read. Both sides need
-- update: the hirer signs their half, the pianist signs theirs, and either
-- can move status toward declined/cancelled. Only the hirer can open one —
-- a pianist doesn't get to invent a booking request from a client who never
-- sent one.
drop policy if exists "concert_inquiries participants select" on public.concert_inquiries;
create policy "concert_inquiries participants select" on public.concert_inquiries
  for select using (auth.uid() in (hirer_id, pianist_id));

drop policy if exists "concert_inquiries hirer insert" on public.concert_inquiries;
create policy "concert_inquiries hirer insert" on public.concert_inquiries
  for insert with check (auth.uid() = hirer_id);

drop policy if exists "concert_inquiries participants update" on public.concert_inquiries;
create policy "concert_inquiries participants update" on public.concert_inquiries
  for update using (auth.uid() in (hirer_id, pianist_id));

-- No delete policy. A negotiation record that either side could erase is not
-- a record — it's a claim that can be made to disappear when it's
-- inconvenient. Declining or cancelling is a status, not a deletion.

create table if not exists public.concert_messages (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.concert_inquiries(id) on delete cascade,
  sender_id uuid not null,
  body text,
  attachment_url text,
  attachment_name text,
  check (body is not null or attachment_url is not null),
  created_at timestamptz not null default now()
);

alter table public.concert_messages enable row level security;

drop policy if exists "concert_messages participants select" on public.concert_messages;
create policy "concert_messages participants select" on public.concert_messages
  for select using (
    exists (
      select 1 from public.concert_inquiries i
      where i.id = concert_messages.inquiry_id
        and auth.uid() in (i.hirer_id, i.pianist_id)
    )
  );

drop policy if exists "concert_messages participants insert" on public.concert_messages;
create policy "concert_messages participants insert" on public.concert_messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.concert_inquiries i
      where i.id = concert_messages.inquiry_id
        and auth.uid() in (i.hirer_id, i.pianist_id)
    )
  );

-- No delete, no update — a sent message is a sent message.

create table if not exists public.concert_offers (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.concert_inquiries(id) on delete cascade,
  version int not null,
  created_by uuid not null,
  event_date date not null,
  start_time text,
  venue text not null,
  duration_minutes int,
  program text not null,
  fee_eur numeric not null,
  travel text,
  equipment text,
  cancellation text,
  payment_schedule text,
  notes text,
  status text not null default 'proposed'
    check (status in ('proposed', 'accepted', 'declined', 'superseded')),
  unique (inquiry_id, version),
  created_at timestamptz not null default now()
);

alter table public.concert_offers enable row level security;

drop policy if exists "concert_offers participants select" on public.concert_offers;
create policy "concert_offers participants select" on public.concert_offers
  for select using (
    exists (
      select 1 from public.concert_inquiries i
      where i.id = concert_offers.inquiry_id
        and auth.uid() in (i.hirer_id, i.pianist_id)
    )
  );

drop policy if exists "concert_offers participants insert" on public.concert_offers;
create policy "concert_offers participants insert" on public.concert_offers
  for insert with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.concert_inquiries i
      where i.id = concert_offers.inquiry_id
        and auth.uid() in (i.hirer_id, i.pianist_id)
    )
  );

-- Update is how an offer is accepted or declined — the other side flips its
-- status, they don't edit its terms. A changed fee is a new offer, which is
-- exactly what the version ledger below is for.
drop policy if exists "concert_offers participants update" on public.concert_offers;
create policy "concert_offers participants update" on public.concert_offers
  for update using (
    exists (
      select 1 from public.concert_inquiries i
      where i.id = concert_offers.inquiry_id
        and auth.uid() in (i.hirer_id, i.pianist_id)
    )
  );

-- No delete policy anywhere in this file: a negotiation record that can be
-- erased by one side is not a record.

-- ---------------------------------------------------------------------------
-- Server-side integrity. None of this is enforceable from the client, because
-- the client is exactly the party with a motive to get it wrong — a pianist
-- who wants their declined offer to look like it never happened, a hirer who
-- wants to un-sign after a change of heart.
-- ---------------------------------------------------------------------------

-- A new offer is always the next version for its inquiry, never a number the
-- client picked, and it always retires whatever was still on the table. Two
-- 'proposed' offers on the same inquiry would leave both sides answering a
-- different question, so the old one is superseded the moment the new one
-- lands. The inquiry itself moves from 'open' (nobody has proposed terms
-- yet) to 'negotiating' (someone has) the same moment — but only in that
-- direction; an inquiry already further along (agreed/confirmed/etc.) is left
-- alone, since a fresh offer against an agreed deal is a renegotiation, not a
-- reopening of day one.
create or replace function public.concert_offer_version_and_supersede()
returns trigger
language plpgsql
as $$
begin
  -- No new versions once either name is down. A signature is frozen by the
  -- signing guard, so if the terms could still move, the deal would later
  -- auto-confirm against words one party signed before they existed. Once
  -- signing has begun the offer is take it or leave it: complete it, or
  -- cancel the inquiry and open a fresh one.
  if exists (
    select 1 from public.concert_inquiries i
    where i.id = NEW.inquiry_id
      and (i.hirer_signed_at is not null or i.pianist_signed_at is not null)
  ) then
    raise exception 'signing has begun; complete the agreement or cancel to renegotiate';
  end if;

  select coalesce(max(version), 0) + 1 into NEW.version
    from public.concert_offers where inquiry_id = NEW.inquiry_id;

  update public.concert_offers
    set status = 'superseded'
    where inquiry_id = NEW.inquiry_id and status = 'proposed';

  return NEW;
end;
$$;

-- The open -> negotiating flip runs AFTER insert, not before. The status
-- guard on inquiries insists 'negotiating' is backed by an offer that
-- exists, and in a before-insert trigger the very first offer does not
-- exist yet — the flip would refute itself and the insert would fail.
create or replace function public.concert_offer_marks_negotiating()
returns trigger
language plpgsql
as $$
begin
  update public.concert_inquiries
    set status = 'negotiating'
    where id = NEW.inquiry_id and status = 'open';
  return NEW;
end;
$$;

drop trigger if exists concert_offer_marks_negotiating on public.concert_offers;
create trigger concert_offer_marks_negotiating
  after insert on public.concert_offers
  for each row execute function public.concert_offer_marks_negotiating();

drop trigger if exists concert_offer_version_and_supersede on public.concert_offers;
create trigger concert_offer_version_and_supersede
  before insert on public.concert_offers
  for each row execute function public.concert_offer_version_and_supersede();

-- Signing has two rules a browser can't be trusted to keep. First, a
-- signature can only be added on top of terms both sides actually accepted —
-- there has to be an 'accepted' offer on the inquiry, or a name typed into a
-- box means nothing. Second, a signature can't be taken back: once
-- *_signed_at is set, that column is frozen, because "confirmed, then
-- quietly un-confirmed" is how a booking disappears out from under the other
-- party. And once both names are down, the inquiry itself becomes
-- 'confirmed' — that's not a status either side chooses, it's a fact that
-- follows from two signatures existing.
create or replace function public.concert_inquiry_signing_guard()
returns trigger
language plpgsql
as $$
begin
  -- The parties are the record. Either one rewriting hirer_id or pianist_id
  -- would hand a live negotiation to somebody who was never in it.
  if NEW.hirer_id is distinct from OLD.hirer_id
     or NEW.pianist_id is distinct from OLD.pianist_id then
    raise exception 'inquiry parties cannot be reassigned';
  end if;

  if OLD.hirer_signed_at is not null and NEW.hirer_signed_at is distinct from OLD.hirer_signed_at then
    raise exception 'hirer signature cannot be changed once set';
  end if;
  if OLD.pianist_signed_at is not null and NEW.pianist_signed_at is distinct from OLD.pianist_signed_at then
    raise exception 'pianist signature cannot be changed once set';
  end if;

  -- Each side can only put down its own name. The RLS policy admits both
  -- participants to the row, so without this the pianist could write the
  -- hirer's first signature and self-confirm the booking. auth.uid() is
  -- null only for service-role writes, which are trusted by definition.
  if NEW.hirer_signed_at is not null and OLD.hirer_signed_at is null
     and auth.uid() is not null and auth.uid() <> NEW.hirer_id then
    raise exception 'only the hirer may sign as hirer';
  end if;
  if NEW.pianist_signed_at is not null and OLD.pianist_signed_at is null
     and auth.uid() is not null and auth.uid() <> NEW.pianist_id then
    raise exception 'only the pianist may sign as pianist';
  end if;

  if (NEW.hirer_signed_at is not null and OLD.hirer_signed_at is null)
     or (NEW.pianist_signed_at is not null and OLD.pianist_signed_at is null) then
    if not exists (
      select 1 from public.concert_offers
      where inquiry_id = NEW.id and status = 'accepted'
    ) then
      raise exception 'cannot sign an inquiry with no accepted offer';
    end if;
  end if;

  -- A status is a statement of fact, so each one is checked against the
  -- facts rather than against who is asking. Walking away (declined,
  -- cancelled) is always available; the forward states demand the thing
  -- they name actually exists; and nothing goes back to 'open', because a
  -- negotiation that has been walked away from is history, not a draft.
  if NEW.status is distinct from OLD.status then
    if NEW.status in ('declined','cancelled') then
      null;
    elsif NEW.status = 'negotiating' then
      if not exists (select 1 from public.concert_offers where inquiry_id = NEW.id) then
        raise exception 'negotiating requires an offer to exist';
      end if;
    elsif NEW.status = 'agreed' then
      if not exists (select 1 from public.concert_offers where inquiry_id = NEW.id and status = 'accepted') then
        raise exception 'agreed requires an accepted offer';
      end if;
    elsif NEW.status = 'confirmed' then
      if NEW.hirer_signed_at is null or NEW.pianist_signed_at is null then
        raise exception 'confirmed requires both signatures';
      end if;
    else
      raise exception 'an inquiry cannot return to %', NEW.status;
    end if;
  end if;

  if NEW.hirer_signed_at is not null and NEW.pianist_signed_at is not null then
    NEW.status := 'confirmed';
  end if;

  return NEW;
end;
$$;

-- An offer's terms are what somebody signs against, so after insert they are
-- stone: changing the fee under an accepted offer is the quietest possible
-- fraud, and even on a live proposal the honest move is a new version, which
-- is what the ledger is for. Status is the only live column, and it obeys
-- three rules: an accepted offer never changes again, and nobody accepts
-- their own proposal — a deal needs a counterparty.
create or replace function public.concert_offer_guard()
returns trigger
language plpgsql
as $$
begin
  if NEW.inquiry_id  is distinct from OLD.inquiry_id
     or NEW.version    is distinct from OLD.version
     or NEW.created_by is distinct from OLD.created_by
     or NEW.event_date is distinct from OLD.event_date
     or NEW.start_time is distinct from OLD.start_time
     or NEW.venue      is distinct from OLD.venue
     or NEW.duration_minutes is distinct from OLD.duration_minutes
     or NEW.program    is distinct from OLD.program
     or NEW.fee_eur    is distinct from OLD.fee_eur
     or NEW.travel     is distinct from OLD.travel
     or NEW.equipment  is distinct from OLD.equipment
     or NEW.cancellation is distinct from OLD.cancellation
     or NEW.payment_schedule is distinct from OLD.payment_schedule
     or NEW.notes      is distinct from OLD.notes then
    raise exception 'offer terms are immutable; propose a new version instead';
  end if;
  if OLD.status = 'accepted' and NEW.status is distinct from OLD.status then
    raise exception 'an accepted offer cannot change status';
  end if;
  if NEW.status = 'accepted' and OLD.status is distinct from NEW.status
     and auth.uid() is not null and auth.uid() = OLD.created_by then
    raise exception 'the offer creator cannot accept their own offer';
  end if;
  return NEW;
end;
$$;

drop trigger if exists concert_offer_guard on public.concert_offers;
create trigger concert_offer_guard
  before update on public.concert_offers
  for each row execute function public.concert_offer_guard();

drop trigger if exists concert_inquiry_signing_guard on public.concert_inquiries;
create trigger concert_inquiry_signing_guard
  before update on public.concert_inquiries
  for each row execute function public.concert_inquiry_signing_guard();

-- ---------------------------------------------------------------------------
-- Pianist-side profile fields for the booking flow: whether they're taking
-- concert inquiries at all, and what they say their fee is.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists concert_open boolean not null default true,
  add column if not exists concert_fee  text;

comment on column public.profiles.concert_open is
  'Whether this pianist currently accepts concert booking inquiries. Defaults true; closing it hides them from "Find a Concert Pianist" without touching teaching_open.';

comment on column public.profiles.concert_fee is
  'Free text, not a number: "from €800", "€1,500–3,000". A fee for a concert booking is a starting point for the offer in concert_offers, not a fixed price, so it stays a string the pianist writes themselves.';

-- ---------------------------------------------------------------------------
-- Storage for chat and offer attachments. Public, same reasoning as
-- student-video: a photo of a venue or a signed rider has to render for both
-- parties without a signed URL expiring mid-negotiation, and paths are random
-- so a file isn't discoverable by guessing.
-- ---------------------------------------------------------------------------

-- Private, unlike student-video, and the difference is not the policy below
-- — it is this flag. A public bucket serves /object/public/ URLs without
-- consulting RLS at all, so an authenticated-only select policy on a public
-- bucket protects nothing. Riders and contracts are fetched through signed
-- URLs minted at render time instead: every open of the conversation signs
-- afresh, so nothing expires mid-negotiation and nothing leaks past a
-- forwarded link.
insert into storage.buckets (id, name, public)
  values ('concert-files', 'concert-files', false)
  on conflict (id) do update set public = false;

do $$ begin
  create policy "concert files upload own" on storage.objects
    for insert to authenticated with check (bucket_id = 'concert-files');
exception when duplicate_object then null; end $$;

do $$ begin
  -- authenticated only, unlike student-video: every legitimate reader of a
  -- rider or a contract is a signed-in party to some negotiation, so anon
  -- read would only ever serve a leaked link.
  create policy "concert files read all" on storage.objects
    for select to authenticated using (bucket_id = 'concert-files');
exception when duplicate_object then null; end $$;
