-- Connections between conservatory students.
--
-- A student taps "Connect" on another student's card; the other student gets
-- a notification and accepts or declines. Only accepted connections appear on
-- the requester's (and the addressee's) Network globe. Learners are not part
-- of this — both sides must be student profiles.
--
-- One row per pair, whichever way it was asked:
--   pending  — waiting on addressee_id
--   accepted — connected, both ways
-- Declining deletes the row (the requester just sees "Connect" again), and
-- either side can delete an accepted row to disconnect.
--
-- Run this in the Supabase SQL editor.

create table if not exists connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles(id) on delete cascade,
  addressee_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);

-- One row per pair regardless of direction.
create unique index if not exists connections_pair_uq
  on connections (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists connections_addressee_idx on connections (addressee_id, status);
create index if not exists connections_requester_idx on connections (requester_id, status);

alter table connections enable row level security;

drop policy if exists "See my connections" on connections;
create policy "See my connections"
  on connections for select to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "Send a connection request" on connections;
create policy "Send a connection request"
  on connections for insert to authenticated
  with check (auth.uid() = requester_id and status = 'pending');

-- Only the addressee answers; the trigger below pins what may change.
drop policy if exists "Answer a connection request" on connections;
create policy "Answer a connection request"
  on connections for update to authenticated
  using (auth.uid() = addressee_id)
  with check (auth.uid() = addressee_id);

-- Either side may withdraw a request, decline one, or disconnect.
drop policy if exists "Remove a connection" on connections;
create policy "Remove a connection"
  on connections for delete to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

revoke update on connections from authenticated;
grant update (status, responded_at) on connections to authenticated;

-- Students only, a sane daily limit, and accept is the only transition.
create or replace function public.enforce_connection()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from profiles where id = new.requester_id and role = 'student')
       or not exists (select 1 from profiles where id = new.addressee_id and role = 'student') then
      raise exception 'Connections are between conservatory students.';
    end if;
    if (select count(*) from connections
         where requester_id = new.requester_id and created_at > now() - interval '24 hours') >= 40 then
      raise exception 'You have sent a lot of requests today. Try again tomorrow.';
    end if;
    new.status := 'pending';
    new.responded_at := null;
    return new;
  end if;

  -- UPDATE: pending -> accepted, nothing else.
  if old.status <> 'pending' or new.status <> 'accepted' then
    raise exception 'A connection request can only be accepted.';
  end if;
  new.responded_at := now();
  return new;
end $$;

drop trigger if exists trg_enforce_connection on connections;
create trigger trg_enforce_connection
  before insert or update on connections
  for each row execute function public.enforce_connection();
