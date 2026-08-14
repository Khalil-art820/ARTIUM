import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // Browser preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response("Unauthorized", { status: 401, headers: CORS });
  }

  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: userError } = await anonClient.auth.getUser();
  if (userError || !user) {
    return new Response("Unauthorized", { status: 401, headers: CORS });
  }

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // The uploaded proof goes first, and it has to go first.
  //
  // profiles now cascades from auth.users, so deleting the account takes the
  // profile, the verification requests, the tracks. Storage cascades from
  // none of it: a scanned student ID or a diploma sits in the student-proofs
  // bucket and outlives everything else about the person. Of everything held
  // about someone, that is the document they would least expect to survive a
  // deletion.
  //
  // Nothing in the file's own path says whose it is — it is uploaded during
  // signup, before there is an account to attribute it to — so the only link
  // is student_verifications.document_url. That row is about to be deleted by
  // the cascade, which is why the paths are collected before the user, not
  // after: the other order loses the only record of what to remove.
  //
  // Removing the file is reported but not fatal. An account deletion that
  // half-succeeds and returns an error leaves the person unsure whether they
  // still have an account, and re-running will not help — the user is gone by
  // then. A leftover file is a smaller wrong than that, and the query at the
  // bottom of this file finds them.
  const { data: proofRows, error: proofError } = await adminClient
    .from("student_verifications")
    .select("document_url")
    .eq("user_id", user.id);

  const paths = (proofRows || [])
    .map((r: { document_url: string | null }) => (r.document_url || "").trim())
    .filter((p: string) => p.length > 0);

  if (proofError) {
    console.error("could not list proofs for", user.id, proofError.message);
  } else if (paths.length > 0) {
    const { error: removeError } = await adminClient.storage.from("student-proofs").remove(paths);
    if (removeError) console.error("could not remove proofs for", user.id, removeError.message);
  }

  const { error } = await adminClient.auth.admin.deleteUser(user.id);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
