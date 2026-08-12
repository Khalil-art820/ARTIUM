-- Take the approval decision away from the browser.
--
-- Until now the app running on the applicant's own machine built the profile
-- row, decided `approved` and `conservatory_verified`, and posted both. The
-- database stored whatever arrived. That is a wristband the guest fills in on
-- the way to the door.
--
-- It produced four separate bugs in one week — a domain request writing
-- approved: true because two copies of one rule disagreed; a waiting screen
-- that Home walked around; a Google login that left the check reading null;
-- Google sign-in taken as proof of a school it never checked — and every fix
-- was a different place learning the same lesson. Underneath all four, anyone
-- who opens developer tools can still send approved: true and any conservatory
-- they like.
--
-- So the columns stop being the client's to set. A trigger overwrites them
-- from evidence the database can see for itself.
--
-- It overwrites rather than raising an exception on purpose. This runs on
-- every signup; if it is ever wrong about a case, the cost should be somebody
-- waiting for review, not nobody being able to create an account at all.
--
-- Run this in the Supabase SQL editor.

-- What the database can actually check, without knowing the roster:
--
--   1. A one-time code was sent to that address and typed back. That is a row
--      in conservatory_email_codes with verified_at set — written by the edge
--      function, which holds the service role, and unreachable from a browser.
--
--   2. The address is the account's own, already verified by Supabase. This is
--      the Google Workspace case: a student signed in with the address they
--      are claiming, and asking them for a code sent to the inbox they just
--      authenticated with would prove nothing new.
--
-- Anything else is a claim, and a claim waits for a human.
create or replace function public.enforce_profile_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(nullif(btrim(new.conservatory_email), ''));
  v_proved boolean := false;
begin
  -- Admins are the humans this whole mechanism defers to. The admin screen
  -- approves a document or a domain request by setting these columns, and that
  -- is the decision, not a claim about it.
  if public.is_admin() then
    return new;
  end if;

  -- Learners are piano enthusiasts, not students of anywhere. `approved` on
  -- their row is not a statement about a conservatory and there is nothing
  -- here to check.
  if new.role is distinct from 'student' then
    return new;
  end if;

  -- An edit is not a re-application. A student who changes their bio a year
  -- later still sends these columns, and the proof they were approved on —
  -- a one-time code — was pruned the day after they used it. Re-deciding here
  -- would quietly unapprove every long-standing member the first time they
  -- touched their profile.
  --
  -- So an update keeps what the row already had. The client cannot raise it
  -- and cannot lower it; only the two cases below reopen the question.
  if tg_op = 'UPDATE'
     and new.conservatory_id is not distinct from old.conservatory_id
     and lower(coalesce(new.conservatory_email, '')) is not distinct from lower(coalesce(old.conservatory_email, ''))
  then
    new.approved := old.approved;
    new.conservatory_verified := old.conservatory_verified;
    return new;
  end if;

  -- Changing which school you claim, or which address you claim it with, is a
  -- new claim and needs new proof. Otherwise a verified student could keep the
  -- verification and swap the conservatory underneath it.
  if v_email is not null then
    select true into v_proved
      from conservatory_email_codes c
     where c.email = v_email
       and c.verified_at is not null
       -- Codes are pruned after a day and signup follows verification by
       -- minutes. A window keeps an old proof from being reused much later.
       and c.verified_at > now() - interval '1 day'
     limit 1;

    if not coalesce(v_proved, false) then
      -- The account's own address, which Supabase verified at sign-in.
      select true into v_proved
        from auth.users u
       where u.id = new.id
         and lower(u.email) = v_email
       limit 1;
    end if;
  end if;

  new.conservatory_verified := coalesce(v_proved, false);
  -- Approval follows proof. A document or a domain request arrives with
  -- neither, and waits — which is what the review queue is for.
  new.approved := new.conservatory_verified;

  return new;
end;
$$;

revoke all on function public.enforce_profile_approval() from public;

drop trigger if exists profiles_enforce_approval on profiles;
create trigger profiles_enforce_approval
  before insert or update of approved, conservatory_verified, conservatory_email, conservatory_id
  on profiles
  for each row
  execute function public.enforce_profile_approval();

-- What this does NOT close, so it is not mistaken for finished:
--
-- The database cannot check that the address belongs to the conservatory the
-- applicant picked, because the roster of 109 schools and their domains is a
-- JavaScript array in the bundle. Postgres has never heard of Juilliard. So a
-- student who proves an address at school A can still select school B.
--
-- That is a far smaller hole than the one this closes — it requires
-- controlling a real institutional address rather than opening developer
-- tools — but it is the reason the roster wants to live in a table. That is
-- the next piece of work, not this one.
