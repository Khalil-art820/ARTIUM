/**
 * Whether this application has to wait for a human.
 *
 * Two kinds do. A document names a school we cannot check by machine, and a
 * domain request names one that is not on the roster at all — in both cases
 * the only thing that can settle it is somebody looking.
 *
 * It lives here, next to the row it decides, because it used to live only in
 * App.jsx while toDbProfile carried its own half-version of the same rule:
 * `verifyMethod === "document"`. A domain request comes through the email
 * door, so its verifyMethod is "otp", and the row went in already approved.
 * Signup still showed "under review" — that part read the full rule — so the
 * screen said one thing and the database another, and logging out and back in
 * let the applicant straight in.
 */
export function needsReview(draft) {
  return draft.verifyMethod === "document" || !!draft.domainReq;
}

export function toDbProfile(draft, id) {
  return {
    id,
    role: "student",
    name: draft.name,
    instrument: draft.instrument,
    conservatory_id: draft.conservatoryId,
    year: draft.years,
    bio: draft.bio,
    tastes: draft.tastes,
    pieces: draft.pieces,
    video_link: draft.videoLink,
    top: draft.top,
    flop: draft.flop,
    composer_day: draft.composerDay,
    photo_url: draft.photoUrl,
    cover_photo_url: draft.coverPhotoUrl || null,
    conservatory_email: draft.conservatoryEmail || null,
    conservatory_verified: !!draft.conservatoryVerified,
    is_online: true,
    // Anything awaiting a human stays unapproved, and so hidden from the map,
    // until that human clicks. One rule, shared with the screen that tells the
    // applicant they are waiting.
    approved: !needsReview(draft),
    teaching_open: draft.teaching.open,
    teaching_mode: draft.teaching.mode,
    teaching_price: draft.teaching.price,
  };
}

export function fromDbProfile(row) {
  return {
    id: row.id,
    name: row.name,
    instrument: row.instrument,
    conservatoryId: row.conservatory_id,
    year: row.year,
    bio: row.bio,
    tastes: row.tastes || [],
    pieces: row.pieces || [],
    videoLink: row.video_link,
    top: row.top,
    flop: row.flop,
    composerDay: row.composer_day,
    photoUrl: row.photo_url,
    coverPhotoUrl: row.cover_photo_url || "",
    conservatoryEmail: row.conservatory_email || "",
    conservatoryVerified: !!row.conservatory_verified,
    teaching: { open: !!row.teaching_open, mode: row.teaching_mode || "", price: row.teaching_price || "" },
    online: row.is_online ?? true,
  };
}
