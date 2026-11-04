-- Direct messages, Instagram style: replies, reactions, edits, unsend, and
-- "Seen" that reaches the sender.
--
-- Columns on direct_messages rather than new tables: a conversation is two
-- people, so a message has at most two reactions (one from each side), and
-- every change to a message lands on the same row. updated_at moves on every
-- change, so the app polls one cursor and sees new messages, edits, unsends,
-- reactions and read receipts alike.
--
-- Members still may update only read_at directly (the grant from
-- 20260902100000 stands). Everything else goes through the three functions
-- below, which check who is asking:
--   dm_edit    the sender, within 15 minutes, of a message not unsent
--   dm_unsend  the sender; the text is replaced so it is gone for both
--   dm_react   either side, on their own half of the reactions
--
-- Run this in the Supabase SQL editor.

alter table public.direct_messages
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists reply_to uuid references public.direct_messages(id) on delete set null,
  add column if not exists sender_reaction text,
  add column if not exists recipient_reaction text;

create index if not exists direct_messages_updated_idx on public.direct_messages (updated_at);

-- Every change moves updated_at.
create or replace function public.dm_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists direct_messages_touch on public.direct_messages;
create trigger direct_messages_touch
  before update on public.direct_messages
  for each row execute function public.dm_touch();

-- A new message starts clean: no edit, no unsend, no reactions, and a reply
-- only to a message in the same conversation.
create or replace function public.dm_clean_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.created_at := now();
  new.updated_at := now();
  new.read_at := null;
  new.edited_at := null;
  new.deleted_at := null;
  new.sender_reaction := null;
  new.recipient_reaction := null;
  if new.reply_to is not null and not exists (
    select 1 from direct_messages m
     where m.id = new.reply_to
       and ((m.sender_id = new.sender_id and m.recipient_id = new.recipient_id)
         or (m.sender_id = new.recipient_id and m.recipient_id = new.sender_id))
  ) then
    new.reply_to := null;
  end if;
  return new;
end;
$$;

revoke all on function public.dm_clean_insert() from public;

drop trigger if exists direct_messages_clean_insert on public.direct_messages;
create trigger direct_messages_clean_insert
  before insert on public.direct_messages
  for each row execute function public.dm_clean_insert();

create or replace function public.dm_edit(p_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body text := btrim(coalesce(p_body, ''));
begin
  if char_length(v_body) not between 1 and 4000 then
    raise exception 'A message needs between 1 and 4000 characters';
  end if;
  update direct_messages
     set body = v_body, edited_at = now()
   where id = p_id
     and sender_id = auth.uid()
     and deleted_at is null
     and created_at > now() - interval '15 minutes';
  if not found then
    raise exception 'This message can no longer be edited';
  end if;
end;
$$;

create or replace function public.dm_unsend(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update direct_messages
     set body = '·', deleted_at = now(), sender_reaction = null, recipient_reaction = null
   where id = p_id
     and sender_id = auth.uid()
     and deleted_at is null;
  if not found then
    raise exception 'This message can''t be unsent';
  end if;
end;
$$;

-- p_emoji null removes your reaction.
create or replace function public.dm_react(p_id uuid, p_emoji text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emoji text := nullif(btrim(coalesce(p_emoji, '')), '');
begin
  if v_emoji is not null and char_length(v_emoji) > 16 then
    raise exception 'Not a reaction';
  end if;
  update direct_messages
     set sender_reaction = case when sender_id = auth.uid() then v_emoji else sender_reaction end,
         recipient_reaction = case when recipient_id = auth.uid() then v_emoji else recipient_reaction end
   where id = p_id
     and (sender_id = auth.uid() or recipient_id = auth.uid())
     and deleted_at is null;
  if not found then
    raise exception 'Can''t react to this message';
  end if;
end;
$$;

revoke all on function public.dm_edit(uuid, text) from public, anon;
revoke all on function public.dm_unsend(uuid) from public, anon;
revoke all on function public.dm_react(uuid, text) from public, anon;
grant execute on function public.dm_edit(uuid, text) to authenticated;
grant execute on function public.dm_unsend(uuid) to authenticated;
grant execute on function public.dm_react(uuid, text) to authenticated;

-- Should list the six new columns.
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'direct_messages'
  and column_name in ('updated_at', 'edited_at', 'deleted_at', 'reply_to', 'sender_reaction', 'recipient_reaction')
order by column_name;
