-- When a verdict lands. The bell keys notifications on id:status:decided_at,
-- so resetting a submission to pending and deciding it again notifies again
-- (the old id:status key collided with the first verdict's and was silent).
alter table promotions add column if not exists decided_at timestamptz;
