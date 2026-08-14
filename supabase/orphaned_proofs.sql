-- Uploaded proofs with nobody left to belong to.
--
-- delete-account now removes a person's proof when they delete their account,
-- but two kinds of file still accumulate and neither has an owner to ask:
--
--   1. Abandoned signups. The document is uploaded at step 3, before there is
--      an account — that is why nothing in its path says whose it is. Someone
--      who uploads a student ID and then closes the tab leaves the file with
--      no verification row ever written.
--
--   2. Accounts deleted from the Supabase dashboard. That does not call the
--      edge function, so the cascade takes the profile and the verification
--      row while the file stays.
--
-- Both are scans of student IDs, enrolment certificates and diplomas: real
-- documents about real people, held for no reason and attached to nothing.
--
-- This lists them. It does not delete them — see the note at the bottom.

-- ---------------------------------------------------------------------------
-- What is in the bucket that nothing points at
-- ---------------------------------------------------------------------------
select o.name,
       round((o.metadata->>'size')::numeric / 1024) as kb,
       o.created_at,
       now()::date - o.created_at::date as days_old
  from storage.objects o
 where o.bucket_id = 'student-proofs'
   and not exists (
     select 1 from student_verifications v
      where v.document_url = o.name
   )
 order by o.created_at;

-- How much of it there is, next to what is legitimately held:
--
--   select
--     (select count(*) from storage.objects where bucket_id = 'student-proofs')      as files,
--     (select count(*) from student_verifications where coalesce(document_url,'') <> '') as referenced;

-- ---------------------------------------------------------------------------
-- Removing them
-- ---------------------------------------------------------------------------
-- Not with SQL. Deleting rows from storage.objects unlinks the file without
-- reliably removing the stored bytes, which is the wrong half of a deletion —
-- it would look done and leave the document.
--
-- Take the names from the query above and delete them through Storage in the
-- dashboard, or with the API, which removes both the row and the object:
--
--   supabase.storage.from('student-proofs').remove([ ...names ])
--
-- A pending request that has not been reviewed yet will not appear here — it
-- still has its verification row. Nothing listed above is waiting on you.
