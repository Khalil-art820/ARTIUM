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

/**
 * Up to two instruments, kept in two columns rather than one array column.
 *
 * `instrument` stays exactly what it was — the principal study, the value
 * every existing row already holds and every existing query already reads —
 * and the second study goes in a nullable `instrument_2` beside it. Nothing
 * has to be backfilled and nothing that reads only `instrument` breaks.
 *
 * Order is the student's, not ours: whichever tile they pressed first is the
 * one their profile is headed by.
 */
export const MAX_INSTRUMENTS = 2;

export function instrumentsOf(source) {
  if (!source) return [];
  const list = Array.isArray(source.instruments)
    ? source.instruments
    : [source.instrument, source.instrument2];
  return list.filter(Boolean).slice(0, MAX_INSTRUMENTS);
}

export function toDbProfile(draft, id) {
  const [instrument, instrument2] = instrumentsOf(draft);
  return {
    id,
    role: "student",
    name: draft.name,
    instrument: instrument || null,
    instrument_2: instrument2 || null,
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
    // A URL into the student-video bucket, not the file. The cover photo it
    // replaces was a base64 data URI written straight into the row.
    cover_video_url: draft.coverVideoUrl || null,
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
    // Only meaningful while they are open to teaching, so closing the door
    // clears what was said behind it rather than leaving it to reappear.
    teaching_pitch: draft.teaching.open ? (draft.teaching.pitch || null) : null,
  };
}

export function fromDbProfile(row) {
  return {
    id: row.id,
    name: row.name,
    // Both shapes. `instruments` is what the app reads; `instrument` stays for
    // the principal study alone, which is what a row written before this
    // carried and what anything reading a single value still expects.
    instruments: instrumentsOf({ instrument: row.instrument, instrument2: row.instrument_2 }),
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
    coverVideoUrl: row.cover_video_url || "",
    conservatoryEmail: row.conservatory_email || "",
    conservatoryVerified: !!row.conservatory_verified,
    teaching: { open: !!row.teaching_open, mode: row.teaching_mode || "", price: row.teaching_price || "", pitch: row.teaching_pitch || "" },
    online: row.is_online ?? true,
  };
}
