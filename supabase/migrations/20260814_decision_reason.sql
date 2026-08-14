-- Why a request was turned down.
--
-- Rejecting wrote a status and nothing else, so the applicant learned nothing
-- and neither did anyone reading the queue later. "Rejected" three weeks ago
-- tells you it happened; it does not tell you whether the document was
-- illegible, the school was already listed under another name, or the address
-- was personal — and those want different replies if the person writes back.
--
-- The same column carries the sentence the applicant is sent, so what they
-- were told and what was recorded cannot drift apart.
--
-- Run this in the Supabase SQL editor.

alter table student_verifications
  add column if not exists decision_reason text;

-- When the applicant was told, so a decision made before this existed — or one
-- where the mail failed — is distinguishable from one nobody was told about.
alter table student_verifications
  add column if not exists notified_at timestamptz;
