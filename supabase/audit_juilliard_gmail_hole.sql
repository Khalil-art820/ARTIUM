-- Who got in through the gmail.com hole.
--
-- Juilliard's entry in CONSERVATORIES carried domains ["juilliard.edu",
-- "gmail.com"] behind a comment reading TEMP, remove. It shipped. While it was
-- live, any Gmail address passed the domain check for Juilliard, and any
-- Google sign-in on a Gmail account was read as proof of studying there — no
-- code was ever sent.
--
-- Everyone affected is a real account with a real verified email. What is not
-- real is the claim that they study at Juilliard. So this does not delete
-- anyone; it puts the unproven ones back in the queue where a human decides.
--
-- Run STEP 1 first and read it. Only run STEP 2 if the list looks right.

-- ---------------------------------------------------------------------------
-- STEP 1 — look.
--
-- A verified Juilliard student whose conservatory address is not at Juilliard.
-- That combination could not have arisen any other way: the only route to
-- conservatory_verified on the email door is an address matching the school's
-- domains, and the only non-juilliard.edu domain ever listed was gmail.com.
-- ---------------------------------------------------------------------------
select
  p.id,
  p.name,
  p.conservatory_email,
  p.conservatory_verified,
  p.approved,
  u.email        as login_email,
  p.created_at
from profiles p
left join auth.users u on u.id = p.id
where p.conservatory_id = 'juilliard'
  and p.conservatory_verified is true
  and coalesce(p.conservatory_email, '') !~* '@([a-z0-9-]+\.)*juilliard\.edu$'
order by p.created_at;

-- Wider net, in case a Google signup left conservatory_email empty: it never
-- passed through the code panel, so nothing was written there.
select
  p.id, p.name, p.conservatory_email, p.approved, u.email as login_email, p.created_at
from profiles p
left join auth.users u on u.id = p.id
where p.conservatory_id = 'juilliard'
  and coalesce(p.conservatory_email, '') = ''
  and p.conservatory_verified is true
order by p.created_at;

-- ---------------------------------------------------------------------------
-- STEP 2 — put them back in the queue.
--
-- Only after reading step 1. Your own test accounts will be in that list;
-- delete those instead of reviewing them.
--
-- This clears the claim rather than the account. They keep their login, their
-- profile and everything they wrote; they stop being a verified Juilliard
-- student and stop appearing on the map until someone confirms it.
-- ---------------------------------------------------------------------------
-- update profiles
--    set conservatory_verified = false,
--        approved = false
--  where conservatory_id = 'juilliard'
--    and conservatory_verified is true
--    and coalesce(conservatory_email, '') !~* '@([a-z0-9-]+\.)*juilliard\.edu$';

-- If any of them are real students who simply used the wrong address, they can
-- verify again from the signup flow, or send the request form and be approved
-- by hand. Nothing is lost either way.
