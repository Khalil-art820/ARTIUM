-- Verifying a conservatory address without creating an account for it.
--
-- The old route borrowed Supabase's own one-time code: signInWithOtp against
-- the conservatory address, verifyOtp, then signOut. It worked, and it left
-- two things behind.
--
-- First, an account. signInWithOtp carries shouldCreateUser, so proving you
-- can read mail at a school registered that address as an Artium user. Anyone
-- who then signed up under the same address hit "User repeated signup", which
-- Supabase answers by sending no mail and returning something shaped like
-- success — a dead end with no explanation. The auth table also filled with
-- accounts nobody asked for, one per address ever checked.
--
-- Second, a session. The code briefly signed the visitor in as the
-- conservatory address before signing back out, which is a strange thing to
-- do to someone mid-signup and a strange thing to have to undo.
--
-- So the code becomes ours. It is a number in a table with an expiry, not an
-- identity, and checking it proves exactly one thing: whoever typed it can
-- read mail at that address.
--
-- Run this in the Supabase SQL editor.

create table if not exists conservatory_email_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  -- Never the code itself. This table is a list of live credentials until
  -- each one expires, and a leaked backup should not be a way in.
  code_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  -- Six digits is a million guesses in principle and far fewer in practice at
  -- one request per attempt, so the count is what makes the code small enough
  -- to type and still worth something.
  attempts int not null default 0,
  verified_at timestamptz
);

-- Two hot paths: find this address's newest code, and count how many have
-- been asked for lately.
create index if not exists conservatory_email_codes_email_idx
  on conservatory_email_codes (email, created_at desc);

-- No policies, deliberately. Row-level security with nothing granted denies
-- every client, and both functions that touch this table hold the service
-- role, which bypasses RLS. A code the browser can read is not a code.
alter table conservatory_email_codes enable row level security;

-- Codes are worthless once spent or expired, and keeping them is only a way
-- to lose them later. Called by the send function, which is the only thing
-- that runs often enough to matter and the only thing that needs the table
-- small.
create or replace function public.prune_conservatory_email_codes()
returns void
language sql
security definer
set search_path = public
as $$
  delete from conservatory_email_codes
   where created_at < now() - interval '1 day';
$$;

revoke all on function public.prune_conservatory_email_codes() from public;
