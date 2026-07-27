-- Machine-reading of uploaded enrolment proofs.
--
-- The verify-document edge function reads a student's proof document and
-- records what it SAYS, plus a few deterministic cross-checks. It never
-- touches `status` or profiles.approved — approval stays a human click.
-- Run this in the Supabase SQL editor.

alter table student_verifications
  add column if not exists extracted jsonb,
  add column if not exists extraction_status text default 'none',
  add column if not exists extraction_error text,
  add column if not exists document_sha256 text;

-- Added separately so re-running the migration is safe (there is no
-- "add constraint if not exists").
do $$ begin
  alter table student_verifications
    add constraint student_verifications_extraction_status_check
    check (extraction_status in ('none', 'running', 'done', 'failed'));
exception when duplicate_object then null; end $$;

-- The same file uploaded under two accounts is the cheapest fraud signal
-- there is, so the hash lookup needs to be fast.
create index if not exists student_verifications_document_sha256_idx
  on student_verifications (document_sha256)
  where document_sha256 is not null;

-- No new RLS policy: "sv read own or admin" already covers these columns,
-- and only the edge function (service role) ever writes them.
