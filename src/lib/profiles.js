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
    // Document-proof signups stay unapproved (hidden from the map) until an
    // admin manually reviews the uploaded proof.
    approved: draft.verifyMethod === "document" ? false : true,
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
