-- Signed-in users only for mutual_connections(). Supabase grants EXECUTE on
-- new functions to anon by default, so revoking from PUBLIC wasn't enough.
-- (Nothing leaked: without a user, auth.uid() is null and it returns no rows.)
--
-- Run this in the Supabase SQL editor.

revoke execute on function public.mutual_connections() from anon;
grant execute on function public.mutual_connections() to authenticated;
