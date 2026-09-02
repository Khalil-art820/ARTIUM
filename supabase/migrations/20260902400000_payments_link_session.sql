-- Links a lesson payment to the lesson_sessions row it's paying for, and
-- takes the `paid` tick away from the client.
--
-- Previously the learner's Pay button wrote lesson_sessions.paid = true
-- itself, before Stripe ever confirmed anything — a crafted client request
-- (or just closing the tab after the click but before paying) could mark a
-- session paid with no money moved. `paid` must now only ever be set by
-- stripe-webhook (service role, bypasses RLS/grants entirely) once
-- checkout.session.completed actually fires.

alter table payments
  add column if not exists lesson_session_id uuid references lesson_sessions(id) on delete set null;

-- Re-issue the authenticated column grant on lesson_sessions without `paid`.
-- (Grants aren't idempotent/patchable — re-running revoke+grant is the
-- correct "migration" here, same pattern the original grant used.) The
-- webhook writes lesson_sessions.paid using the service role key, which
-- bypasses grants and RLS entirely, so this doesn't affect it.
revoke update on lesson_sessions from authenticated;
grant update (status, proposed_by, session_date, session_time, details, updated_at)
  on lesson_sessions to authenticated;
