-- The first chat tables are no longer used: the app talks through
-- direct_messages. Their write rules are still live, and "Participants create
-- membership" lets anyone add themselves to any conversation, which then lets
-- them read it. Nothing writes to these tables, so the writes go. The tables
-- and what is in them stay.
--
-- Run this in the Supabase SQL editor.

drop policy if exists "Participants create membership" on public.conversation_participants;
drop policy if exists "Anyone create conversation" on public.conversations;
drop policy if exists "Participants send messages" on public.messages;

-- How much is in them, and who is in the old conversations.
select
  (select count(*) from public.conversations) as conversations,
  (select count(*) from public.conversation_participants) as participants,
  (select count(*) from public.messages) as messages;
