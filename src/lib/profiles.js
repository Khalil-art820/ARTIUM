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
    is_online: true,
    approved: true,
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
    teaching: { open: !!row.teaching_open, mode: row.teaching_mode || "", price: row.teaching_price || "" },
    online: row.is_online ?? true,
  };
}
