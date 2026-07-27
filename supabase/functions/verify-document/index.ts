// Read a student's uploaded enrolment proof and record what it says.
//
// This function reports; it does not decide. It writes only to the
// `extracted` / `extraction_*` / `document_sha256` columns — never to
// `status`, never to profiles.approved. A model can tell you what a document
// claims, not whether the document is genuine, so approval stays a human
// click in the admin screen.
//
// The value is in the cross-checks, not the transcription: signup already
// pre-fills conservatory_name from the one the student picked, so the useful
// question is whether the document agrees with that claim.
//
// Deploy:  supabase functions deploy verify-document
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.115.0";

// supabase-js `functions.invoke` sends apikey and x-client-info alongside the
// Authorization header. Omitting them here fails the browser's preflight, and
// the request is blocked before it is ever sent — which surfaces in the UI as
// the misleading "Failed to send a request to the Edge Function".
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "claude-opus-4-8";

const IMAGE_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

const SYSTEM = `You read scanned enrolment documents for a music-conservatory network and report exactly what each document states.

You are producing evidence for a human reviewer, not a decision. Two rules follow from that:

1. Report only what is actually printed on the document. Never infer, complete, or correct a value from world knowledge — if a field is absent or illegible, return an empty string for it.
2. Do not assess whether the document is genuine. You cannot tell a real certificate from a well-made forgery, and pretending otherwise would mislead the reviewer. Report the contents; say so plainly in "notes" if something is unreadable, inconsistent, or oddly formatted, but do not offer a verdict on authenticity.

For conservatory_name, copy the institution's name as printed, including its language and spelling. Put the exact sentence or line you read it from in "evidence" so the reviewer can check your reading without opening the file.`;

const SCHEMA = {
  type: "object",
  properties: {
    document_type: {
      type: "string",
      enum: [
        "enrolment_certificate",
        "student_id_card",
        "tuition_receipt",
        "transcript",
        "acceptance_letter",
        "other",
        "unreadable",
      ],
      description: "What kind of document this is.",
    },
    student_name: {
      type: "string",
      description: "Full name of the student as printed. Empty string if absent.",
    },
    conservatory_name: {
      type: "string",
      description: "Institution name exactly as printed. Empty string if absent.",
    },
    conservatory_location: {
      type: "string",
      description: "City and/or country of the institution as printed. Empty string if absent.",
    },
    academic_year: {
      type: "string",
      description: "Academic year or enrolment dates as printed, e.g. '2025/2026'. Empty string if absent.",
    },
    evidence: {
      type: "string",
      description: "The verbatim line the conservatory name was read from.",
    },
    legible: {
      type: "boolean",
      description: "False if the scan is too poor to read with confidence.",
    },
    notes: {
      type: "string",
      description: "Anything the reviewer should look at directly. Empty string if nothing stands out.",
    },
  },
  required: [
    "document_type",
    "student_name",
    "conservatory_name",
    "conservatory_location",
    "academic_year",
    "evidence",
    "legible",
    "notes",
  ],
  additionalProperties: false,
};

/** Lowercase, strip accents and punctuation — enough to compare institution names across spellings. */
function norm(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining marks left by NFD
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** null means "can't tell" (one side is blank) — which is not the same as "no match". */
function looseMatch(a: string, b: string): boolean | null {
  const A = norm(a);
  const B = norm(b);
  if (!A || !B) return null;
  return A === B || A.includes(B) || B.includes(A);
}

/** btoa() on a whole file blows the argument limit, so feed it in chunks. */
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return json(
      { error: "Document reading is not configured yet — ANTHROPIC_API_KEY is not set on this project." },
      503,
    );
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: userError } = await anonClient.auth.getUser();
  if (userError || !user) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Everything below runs with the service role, so this check is the only
  // thing standing between a signed-in student and every proof document.
  const { data: profile } = await admin
    .from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return json({ error: "Admins only" }, 403);

  let verificationId = "";
  try {
    verificationId = (await req.json())?.verification_id || "";
  } catch {
    return json({ error: "Expected a JSON body" }, 400);
  }
  if (!verificationId) return json({ error: "verification_id is required" }, 400);

  const { data: row, error: rowError } = await admin
    .from("student_verifications").select("*").eq("id", verificationId).single();
  if (rowError || !row) return json({ error: "No such verification request" }, 404);
  if (!row.document_url) return json({ error: "This request has no document attached" }, 400);

  await admin.from("student_verifications")
    .update({ extraction_status: "running", extraction_error: null })
    .eq("id", verificationId);

  const fail = async (message: string, status = 500) => {
    await admin.from("student_verifications")
      .update({ extraction_status: "failed", extraction_error: message })
      .eq("id", verificationId);
    return json({ error: message }, status);
  };

  try {
    const { data: blob, error: dlError } = await admin.storage
      .from("student-proofs").download(row.document_url);
    if (dlError || !blob) return await fail(`Could not read the document: ${dlError?.message || "not found"}`);

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const sha256 = await sha256Hex(bytes);

    // Same file, different account — worth surfacing regardless of what the
    // document says.
    const { data: dupes } = await admin
      .from("student_verifications")
      .select("id, user_id, name")
      .eq("document_sha256", sha256)
      .neq("id", verificationId);
    const otherPeople = (dupes || []).filter((d) => d.user_id !== row.user_id);

    const ext = (row.document_name || row.document_url).split(".").pop()?.toLowerCase() || "";
    const isPdf = ext === "pdf" || (bytes[0] === 0x25 && bytes[1] === 0x50); // "%P"
    const imageType = IMAGE_TYPES[ext];
    if (!isPdf && !imageType) {
      return await fail(
        `Cannot read a .${ext || "?"} file — only PDF, JPEG, PNG, GIF and WebP can be machine-read.`,
        415,
      );
    }

    const data = toBase64(bytes);
    const filePart = isPdf
      ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data } }
      : { type: "image" as const, source: { type: "base64" as const, media_type: imageType as "image/jpeg", data } };

    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      thinking: { type: "adaptive" },
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [{
        role: "user",
        content: [
          filePart,
          { type: "text", text: "Read this document and report what it states." },
        ],
      }],
    });

    if (response.stop_reason === "refusal") {
      return await fail("The model declined to read this document.", 422);
    }
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return await fail("The model returned no readable result.");
    }
    const document = JSON.parse(textBlock.text);

    const extracted = {
      model: MODEL,
      read_at: new Date().toISOString(),
      document,
      checks: {
        claimed_conservatory: row.conservatory_name || "",
        conservatory_matches_claim: looseMatch(document.conservatory_name, row.conservatory_name || ""),
        claimed_name: row.name || "",
        name_matches_claim: looseMatch(document.student_name, row.name || ""),
        duplicate_document: {
          found: otherPeople.length > 0,
          others: otherPeople.map((d) => ({ id: d.id, name: d.name })),
        },
      },
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    };

    // Note what is NOT in this update: status, and profiles.approved.
    await admin.from("student_verifications")
      .update({ extracted, extraction_status: "done", extraction_error: null, document_sha256: sha256 })
      .eq("id", verificationId);

    return json(extracted);
  } catch (e) {
    return await fail(e instanceof Error ? e.message : String(e));
  }
});
