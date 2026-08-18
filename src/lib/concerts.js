import { supabase } from "./supabase";

/**
 * The five and a half stages of a booking. 'agreed' sits between negotiating
 * and confirmed on purpose: an accepted offer means the terms are settled,
 * but nobody has signed anything yet, and those are different facts. The
 * inquiry only reaches 'confirmed' through the database trigger that fires
 * once both signatures are down — nothing in this file sets it directly.
 */
export const INQUIRY_STATUS = {
  open: "open",
  negotiating: "negotiating",
  agreed: "agreed",
  confirmed: "confirmed",
  declined: "declined",
  cancelled: "cancelled",
};

/**
 * A hirer has no profiles row — booking a pianist doesn't require the
 * conservatory-affiliated account the rest of the app assumes — so their name
 * and email are taken from what they typed and carried denormalised on the
 * inquiry itself. Everything else maps camelCase straight to the matching
 * snake_case column.
 */
export async function createInquiry(fields) {
  const { data: userData } = await supabase.auth.getUser();
  const hirerId = userData?.user?.id;
  const { data, error } = await supabase
    .from("concert_inquiries")
    .insert({
      hirer_id: hirerId,
      hirer_name: fields.hirerName,
      hirer_email: fields.hirerEmail,
      pianist_id: fields.pianistId,
      event_type: fields.eventType,
      event_date: fields.eventDate || null,
      location: fields.location,
      venue: fields.venue || null,
      audience: fields.audience || null,
      repertoire: fields.repertoire || null,
      message: fields.message || null,
      budget: fields.budget || null,
    })
    .select()
    .single();
  return { data: data ? fromDbInquiry(data) : null, error: error ? error.message : null };
}

/**
 * 'hirer' and 'pianist' are the only two roles anyone can hold on an inquiry
 * — there's no third party allowed to list it, and RLS would refuse the read
 * anyway, but the filter here saves a round trip on the wrong half of the
 * table.
 */
export async function listInquiries(role) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData?.user?.id;
  const column = role === "pianist" ? "pianist_id" : "hirer_id";
  const { data, error } = await supabase
    .from("concert_inquiries")
    .select()
    .eq(column, uid)
    .order("created_at", { ascending: false });
  return { data: (data || []).map(fromDbInquiry), error: error ? error.message : null };
}

export async function getInquiry(id) {
  const { data, error } = await supabase
    .from("concert_inquiries")
    .select()
    .eq("id", id)
    .single();
  return { data: data ? fromDbInquiry(data) : null, error: error ? error.message : null };
}

export async function setInquiryStatus(id, status) {
  const { error } = await supabase
    .from("concert_inquiries")
    .update({ status })
    .eq("id", id);
  return { error: error ? error.message : null };
}

// The messages mapper the other two tables already had. Without it the rows
// crossed the boundary in snake_case and every camelCase read in the UI —
// senderId for alignment, attachmentUrl for rendering, createdAt for the
// timeline sort — was an undefined that broke quietly instead of loudly.
export function fromDbMessage(row) {
  return {
    id: row.id,
    inquiryId: row.inquiry_id,
    senderId: row.sender_id,
    body: row.body,
    attachmentUrl: row.attachment_url,
    attachmentName: row.attachment_name,
    createdAt: row.created_at,
  };
}

export async function listMessages(inquiryId) {
  const { data, error } = await supabase
    .from("concert_messages")
    .select()
    .eq("inquiry_id", inquiryId)
    .order("created_at", { ascending: true });
  return { data: (data || []).map(fromDbMessage), error: error ? error.message : null };
}

export async function sendMessage(inquiryId, { body, attachmentUrl, attachmentName } = {}) {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("concert_messages")
    .insert({
      inquiry_id: inquiryId,
      sender_id: userData?.user?.id,
      body: body || null,
      attachment_url: attachmentUrl || null,
      attachment_name: attachmentName || null,
    })
    .select()
    .single();
  return { data: data ? fromDbMessage(data) : null, error: error ? error.message : null };
}

/**
 * Mirrors uploadCoverVideo in App.jsx: same random-path shape, same public
 * bucket, same reasoning — an attachment in a negotiation has to render for
 * both sides without a signed URL expiring mid-conversation.
 */
export async function uploadConcertFile(file) {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `attachments/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from("concert-files")
    .upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) return { error: "Upload failed: " + error.message };
  // The PATH, not a URL. The bucket is private — a public URL for it serves
  // nothing — so the message row records where the file lives and the reader
  // exchanges that for a short-lived signed URL at render time.
  return { url: path, name: file.name };
}

/**
 * A path from a message row becomes something a browser can fetch.
 *
 * Signed rather than public because the bucket is private: rider PDFs and
 * contracts should not be fetchable by whoever holds a forwarded link, and a
 * public bucket serves its /object/public/ URLs without consulting RLS at
 * all — the flag, not the policy, is what decides. An hour of validity is
 * plenty: the conversation re-signs every time it renders, so expiry can
 * never strand a file mid-negotiation.
 *
 * Rows written before the bucket went private hold full https URLs; those
 * pass through untouched so old attachments keep rendering.
 */
export async function getAttachmentUrl(path) {
  if (!path) return { url: null, error: null };
  if (/^https:\/\//i.test(path)) return { url: path, error: null };
  const { data, error } = await supabase.storage
    .from("concert-files")
    .createSignedUrl(path, 3600);
  return { url: data?.signedUrl || null, error: error ? error.message : null };
}

export async function listOffers(inquiryId) {
  const { data, error } = await supabase
    .from("concert_offers")
    .select()
    .eq("inquiry_id", inquiryId)
    .order("version", { ascending: true });
  return { data: (data || []).map(fromDbOffer), error: error ? error.message : null };
}

/**
 * version is sent as 0 and immediately overwritten by the
 * concert_offer_version_and_supersede trigger, which also retires whatever
 * offer was still 'proposed' on this inquiry — the client picks the terms,
 * the database picks the number, so two people proposing at once can't
 * collide on the same version.
 */
export async function createOffer(inquiryId, fields) {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("concert_offers")
    .insert({
      inquiry_id: inquiryId,
      version: 0,
      created_by: userData?.user?.id,
      event_date: fields.eventDate,
      start_time: fields.startTime || null,
      venue: fields.venue,
      duration_minutes: fields.durationMinutes || null,
      program: fields.program,
      fee_eur: fields.feeEur,
      travel: fields.travel || null,
      equipment: fields.equipment || null,
      cancellation: fields.cancellation || null,
      payment_schedule: fields.paymentSchedule || null,
      notes: fields.notes || null,
    })
    .select()
    .single();
  return { data: data ? fromDbOffer(data) : null, error: error ? error.message : null };
}

/**
 * Accepting an offer is also the moment the inquiry itself becomes 'agreed'
 * — settled terms, not yet signed. That second write happens here rather
 * than in a trigger because a decline shouldn't touch the inquiry status at
 * all: a declined offer just means the conversation continues.
 */
export async function respondToOffer(offerId, response) {
  const { data: offer, error: fetchError } = await supabase
    .from("concert_offers")
    .select("inquiry_id")
    .eq("id", offerId)
    .single();
  if (fetchError) return { error: fetchError.message };

  const { error } = await supabase
    .from("concert_offers")
    .update({ status: response })
    .eq("id", offerId);
  if (error) return { error: error.message };

  if (response === "accepted") {
    const { error: statusError } = await setInquiryStatus(offer.inquiry_id, INQUIRY_STATUS.agreed);
    if (statusError) return { error: statusError };
  }

  return { error: null };
}

/**
 * Writes only this side's name and timestamp; the confirmed flip, the ban on
 * un-signing, and the requirement that an offer was actually accepted first
 * all live in the concert_inquiry_signing_guard trigger, not here — a client
 * that skipped this file entirely couldn't fake a signature by calling
 * .update() directly, because the same guard runs either way. The row is
 * re-selected so the caller can see whether the trigger just confirmed it.
 */
export async function signAgreement(inquiryId, role, signedName) {
  const now = new Date().toISOString();
  const patch = role === "pianist"
    ? { pianist_signed_name: signedName, pianist_signed_at: now }
    : { hirer_signed_name: signedName, hirer_signed_at: now };
  const { data, error } = await supabase
    .from("concert_inquiries")
    .update(patch)
    .eq("id", inquiryId)
    .select()
    .single();
  return { data: data ? fromDbInquiry(data) : null, error: error ? error.message : null };
}

export function fromDbInquiry(row) {
  return {
    id: row.id,
    hirerId: row.hirer_id,
    hirerName: row.hirer_name,
    hirerEmail: row.hirer_email,
    pianistId: row.pianist_id,
    eventType: row.event_type,
    eventDate: row.event_date,
    location: row.location,
    venue: row.venue,
    audience: row.audience,
    repertoire: row.repertoire,
    message: row.message,
    budget: row.budget,
    status: row.status,
    hirerSignedName: row.hirer_signed_name,
    hirerSignedAt: row.hirer_signed_at,
    pianistSignedName: row.pianist_signed_name,
    pianistSignedAt: row.pianist_signed_at,
    createdAt: row.created_at,
  };
}

export function fromDbOffer(row) {
  return {
    id: row.id,
    inquiryId: row.inquiry_id,
    version: row.version,
    createdBy: row.created_by,
    eventDate: row.event_date,
    startTime: row.start_time,
    venue: row.venue,
    durationMinutes: row.duration_minutes,
    program: row.program,
    feeEur: row.fee_eur,
    travel: row.travel,
    equipment: row.equipment,
    cancellation: row.cancellation,
    paymentSchedule: row.payment_schedule,
    notes: row.notes,
    status: row.status,
    createdAt: row.created_at,
  };
}
