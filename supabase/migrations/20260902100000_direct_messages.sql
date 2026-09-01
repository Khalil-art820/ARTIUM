-- Real direct messages. Replaces the two purely-local chat stores — the
-- top-level `conversations` React state (never persisted at all) and the
-- lesson room's per-teacher `artium_chat_${teacherId}_${learnerId}`
-- localStorage key (persisted, but only on the sending device, and never
-- read by the other side) — with one table both directions actually share.
--
-- One row per message, sender/recipient both real profiles rows. No thread
-- id: a "conversation" is just every row between two profile ids, grouped
-- client-side the same way the old sample data was already keyed (by the
-- other person's id).

create table if not exists direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references profiles(id) on delete cascade,
  recipient_id uuid not null references profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists direct_messages_thread_idx
  on direct_messages (sender_id, recipient_id, created_at);

create index if not exists direct_messages_unread_idx
  on direct_messages (recipient_id, read_at);

alter table direct_messages enable row level security;

drop policy if exists "Sender can insert own message" on direct_messages;
create policy "Sender can insert own message"
  on direct_messages for insert
  with check (auth.uid() = sender_id and sender_id <> recipient_id);

drop policy if exists "Participant can read own thread" on direct_messages;
create policy "Participant can read own thread"
  on direct_messages for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

-- Recipient marking their inbox read is the only update path — nobody edits
-- a sent message's body.
drop policy if exists "Recipient can mark own inbox read" on direct_messages;
create policy "Recipient can mark own inbox read"
  on direct_messages for update
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

-- No DELETE policy for anyone.
