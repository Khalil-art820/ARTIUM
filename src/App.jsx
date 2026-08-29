      {/* The bottom strip of circles is gone. My Rules and My Planning are on
          the tab bar above, which is where the room's other destinations
          already were. */}

import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import {
  Search, Send,
  ChevronRight, Check, X, Instagram, Facebook, Youtube,
  Music2, Music, Users, MessageCircle, ArrowRight, ArrowLeft, Play, Pause,
  Pencil, Plus, Trash2, Home, Upload, Eye, EyeOff, ChevronLeft,
  Calendar, CreditCard, Video, Link2, Clock, Bell,
  Map, BookOpen, ListChecks, LayoutList, Megaphone, Check as CheckIcon, ShieldCheck, FileText, Lock,
  ScanLine, ArrowUpRight, Globe2, MapPin, GraduationCap, User, Paperclip,
  Compass, Briefcase, Feather, CheckCircle2,
} from "lucide-react";
import { useAuth } from "./contexts/AuthContext";
import { supabase } from "./lib/supabase";
import { toDbProfile, fromDbProfile, needsReview, instrumentsOf, MAX_INSTRUMENTS } from "./lib/profiles";
import {
  INQUIRY_STATUS, createInquiry, listInquiries, getInquiry, setInquiryStatus,
  listMessages, sendMessage as sendConcertMessage, uploadConcertFile,
  listOffers, createOffer, respondToOffer, signAgreement,
  getAttachmentUrl,
} from "./lib/concerts";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Tooltip, Popup, useMap } from "react-leaflet";
// ArtiumLanding and ArtiumHero (the two previous gates) are intentionally NOT
// imported: neither is rendered any more, and importing them pulls in their
// stylesheets, whose unscoped selectors (.stage, .hero, .rule, .trust …) leak
// into ArtiumGate — .stage{max-width:94vw} was clamping the gate's 840px
// stage on phones. The files stay on disk for reference.
import ArtiumGate from "./components/entrygate/ArtiumGate";
import WallOfComposers from "./pages/WallOfComposers";
// three.js is ~1.9MB of the bundle. Loading it lazily keeps it out of the
// initial download and out of the entry chunk, which otherwise blew past the
// service worker's 2MiB precache ceiling and failed the build.
const Globe = lazy(() => import("react-globe.gl"));
import "leaflet/dist/leaflet.css";

/* ---------------------------------------------------------------- */
/* THEME                                                              */
/* ---------------------------------------------------------------- */
// The whole app in the entry gate's key. These names were written for a
// white product — "ink" was the page, "ivory" was the text on it — so the
// words now read backwards, but they are threaded through several thousand
// lines and the roles they stand for have not changed. Renaming them is a
// separate job from re-tinting them; this is the re-tint.
// Re-themed to the entry gate's light system (ground #F4F4F3, ink #232A3B,
// gold #C9962E) — every screen built on C now reads as one continuum with
// the gate and the student landing rather than "the gate, then a dark
// app". Names are unchanged (ink/parchment/brass/etc. are still what every
// call site expects), only the values moved from "a lit room" to "the
// gate's page". Read each token's old comment before you assume its new
// value: ink/parchment were GROUNDS (dark), ivory/inkText were TEXT ON
// THOSE GROUNDS (was white, is now ink) — flipping both to the same thing
// would have erased the surface/text distinction that makes any of this
// legible.
const C = {
  ink: "#F4F4F3",              // the page — was the dark ground, now the gate's grey
  inkSoft: "#FFFFFF",          // a surface raised off it — was a lighter dark, now white
  inkLine: "rgba(176,146,98,0.30)",   // the gate's --contour
  parchment: "#FFFFFF",        // cards — was near-black, now white slabs
  parchmentDim: "#F2F2F0",     // a quieter card tone, off pure white
  parchmentLine: "rgba(176,146,98,0.18)",
  ivory: "#232A3B",            // primary text — was white-on-dark, now the gate's ink
  ivoryDim: "#6A7080",         // secondary text — the gate's --muted
  inkText: "#232A3B",
  inkTextDim: "#6A7080",
  brass: "#C9962E",            // the gate's --gold, replacing the champagne
  brassText: "#3A2E10",        // text sitting on the gold accent — the gate's own pill-text brown, not white (white-on-gold fails contrast at this lightness)
  brassLabel: "#B8862E",       // a deeper gold for inline links/labels on white
  brassDim: "rgba(201,150,46,0.14)",
  // Lifted for a dark ground before; now picked to hold up on white/cream
  // instead — the #B23B3B family the gate's own error text uses, and a
  // muted forest green with enough weight to read as text on cream.
  burgundy: "#B23B3B",
  forest: "#3F8B5C",
};

// The gate's card, as a style object — back to an actual white box now that
// the app is light again, not the white-tinted glass this was rebuilt as
// for the dark screens in between (that fill, and its black hairline/drop
// shadow, both need a dark ground to read against; on light they'd merge
// into the page the same way the white-on-white original did). Same rim
// recipe as .artium-su-card / the student landing's step pills: white
// fill, a warm contour border, a warm drop shadow.
const PANEL = {
  borderRadius: 18,
  border: "1px solid rgba(176,146,98,0.30)",
  background: "#FFFFFF",
  boxShadow: "0 20px 40px -22px rgba(150,115,55,0.38), inset 0 1px 0 #fff",
  padding: "18px 18px",
};

// The wordmark, set the way Stripe sets theirs: one heavy lowercase sans,
// tracked tight, in a single dark navy. Deliberately a system stack rather
// than 'Inter' — no web font is actually loaded, so 'Inter' silently falls
// back and the weight lands wherever the system default happens to be.
const FONT_WORDMARK = "-apple-system, 'SF Pro Display', BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
// The gate's pair, carried through the app: Cormorant for anything that
// behaves like a heading, Manrope for everything read as prose. Both are
// already loaded in index.html, so this costs no extra request.
const FONT_DISPLAY = "'Cormorant Garamond', 'Didot', 'Bodoni 72', Georgia, serif";
const FONT_BODY = "'Manrope', -apple-system, 'Segoe UI', Roboto, sans-serif";
const FONT_MONO = "'ui-monospace', monospace";

// Spotify playlist behind the music toggle. To change it, take just the id from
// a playlist share link — https://open.spotify.com/playlist/<ID>?si=... — and
// drop the si/pi query params, which identify the share session rather than the
// playlist. An empty string hides the music button everywhere.
//
// Note what the embed can and cannot do: there is no volume API, and listeners
// who are not signed in to Spotify in the same browser get 30-second previews
// behind a "Get Spotify" prompt rather than full tracks.
const SPOTIFY_PLAYLIST_ID = "3ydc8YZVqfFW1Dj681FMMe";

/**
 * The account that owns the admin screens.
 *
 * This is used for exactly one thing: skipping the prototype's fake audition
 * gate at signup, so the owner lands in the app instead of on a screen whose
 * own caption calls it "not part of the real product".
 *
 * It grants nothing. Admin is profiles.is_admin, and RLS decides what that can
 * read and write through public.is_admin() — a constant in a bundle everybody
 * can download could not grant it if we wanted it to. Whoever holds this
 * mailbox still has to own the row.
 */
const ADMIN_EMAIL = "ktannous0@gmail.com";
const isAdminEmail = (email) => (email || "").trim().toLowerCase() === ADMIN_EMAIL;

// One diameter for every round thing in a header — the avatar, the music
// button and the logo mark. They each carried their own number before, so
// they never quite lined up.
const HEADER_CONTROL = 32;

/**
 * Used to run on its own dark palette, separate from C — a lit room rather
 * than a white page. The whole app moved onto the entry gate's light
 * theme, so GATE now IS that theme (values below match C's and the real
 * gate's --gold #C9962E) rather than a second, contradicting palette.
 * Kept as its own object (not merged into C) only because call sites still
 * reference GATE.* by name throughout this file.
 */
const GATE = {
  bg: "#F4F4F3",
  card: "#FFFFFF",
  cardGlass: "rgba(176,146,98,0.05)",
  cardLine: "rgba(176,146,98,0.30)",
  // One gold now, matching the real gate's --gold — the "champagne vs.
  // deeper amber" distinction below belonged to the old dark room, where
  // hairlines needed to be paler than filled discs to both read on black.
  // On white, one gold carries both jobs.
  gold: "#C9962E",
  goldSolid: "#C9962E",
  goldSoft: "#B8862E",
  goldDeep: "#A67B24",
  text: "#232A3B",
  text2: "#3A4152",
  muted: "#6A7080",
  divider: "rgba(176,146,98,0.20)",
};
// Both loaded in index.html. The fallbacks are the elegant serifs Apple and
// Windows ship, so the gate still reads as intended in the moment before the
// web font lands — or if it never does.
const GATE_SERIF = "'Cormorant Garamond', 'Didot', 'Bodoni 72', Georgia, serif";
// The partner's own channels. Named, because the Instagram address was
// pasted inline in five places and the footer now needs two of them.
const ACT_INSTAGRAM = "https://www.instagram.com/aclassicaltone?igsh=MTZzdzk3bWo5OGdkbA==";
const ACT_FACEBOOK = "https://www.facebook.com/share/1Q4piEHHN7/";
const GATE_SANS = "'Manrope', -apple-system, 'Segoe UI', Roboto, sans-serif";

// Brass, not black: the reference's black was the only black in a header of
// brass and navy, and it dominated. The outlined shape is kept.
const MUSIC_BTN_INK = C.inkText; // black solid, per the user — was gold

/* ---- Promote Me (aclassicaltone) ---- */
const PROMO_PROVIDERS = [
  { name: "Google Drive", hosts: ["drive.google.com", "docs.google.com"] },
  { name: "Dropbox", hosts: ["dropbox.com", "db.tt"] },
  { name: "OneDrive", hosts: ["onedrive.live.com", "1drv.ms", "sharepoint.com"] },
  { name: "YouTube", hosts: ["youtube.com", "youtu.be", "m.youtube.com"] },
  { name: "WeTransfer", hosts: ["wetransfer.com", "we.tl"] },
];
function detectPromoProvider(url) {
  let host;
  try { host = new URL(url.trim()).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return null; }
  for (const p of PROMO_PROVIDERS) {
    if (p.hosts.some((h) => host === h || host.endsWith("." + h))) return p.name;
  }
  return null;
}
const PROMO_OFFER = [
  "Post + story on Instagram (with collaboration)",
  "Post + story on Facebook",
  "Your video kept in a special highlights folder under your name",
  "A dedicated caption — your bio or anything you choose",
  "Post on Threads",
];
const PROMO_BONUS = "A second free post";
const PROMO_RATE = 13;
const PROMO_TOTAL = PROMO_RATE * 5;

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

/* ---------------------------------------------------------------- */
/* BACKGROUND MUSIC (original synthesized ambient track)              */
/* ---------------------------------------------------------------- */

/* ---------------------------------------------------------------- */
/* DATA                                                                */
/* ---------------------------------------------------------------- */
const CONSERVATORIES = [
  { id: "juilliard", name: "The Juilliard School", short: "Juilliard", city: "New York", country: "USA", lat: 40.7736, lng: -73.9827, domains: ["juilliard.edu"] },
  { id: "curtis", name: "Curtis Institute of Music", short: "Curtis", city: "Philadelphia", country: "USA", lat: 39.9496, lng: -75.1717, domains: ["curtis.edu"] },
  { id: "nec", name: "New England Conservatory", short: "NEC", city: "Boston", country: "USA", lat: 42.3428, lng: -71.0857, domains: ["necmusic.edu"] },
  { id: "sfcm", name: "San Francisco Conservatory of Music", short: "SFCM", city: "San Francisco", country: "USA", lat: 37.7776, lng: -122.4196, domains: ["sfcm.edu"] },
  { id: "msm", name: "Manhattan School of Music", short: "MSM", city: "New York", country: "USA", lat: 40.8116, lng: -73.9465, domains: ["msmnyc.edu"] },
  { id: "cim", name: "Cleveland Institute of Music", short: "CIM", city: "Cleveland", country: "USA", lat: 41.5085, lng: -81.606, domains: ["cim.edu"] },
  { id: "colburn", name: "Colburn School", short: "Colburn", city: "Los Angeles", country: "USA", lat: 34.0549, lng: -118.2426, domains: ["colburnschool.edu"] },
  { id: "berklee", name: "Berklee College of Music", short: "Berklee", city: "Boston", country: "USA", lat: 42.3467, lng: -71.0872, domains: ["berklee.edu"] },
  { id: "eastman", name: "Eastman School of Music", short: "Eastman", city: "Rochester", country: "USA", lat: 43.1566, lng: -77.6088, domains: ["u.rochester.edu"] },
  { id: "jacobs", name: "Jacobs School of Music (Indiana)", short: "Jacobs", city: "Bloomington", country: "USA", lat: 39.1653, lng: -86.5264, domains: ["iu.edu"] },
  { id: "peabody", name: "Peabody Institute (Johns Hopkins)", short: "Peabody", city: "Baltimore", country: "USA", lat: 39.296, lng: -76.6169, domains: ["jhu.edu"] },
  { id: "oberlin", name: "Oberlin Conservatory of Music", short: "Oberlin", city: "Oberlin", country: "USA", lat: 41.2939, lng: -82.2171, domains: ["oberlin.edu"] },
  { id: "thornton", name: "Thornton School of Music (USC)", short: "Thornton", city: "Los Angeles", country: "USA", lat: 34.0224, lng: -118.2851, domains: ["usc.edu"] },
  { id: "bienen", name: "Bienen School of Music (Northwestern)", short: "Bienen", city: "Evanston", country: "USA", lat: 42.0451, lng: -87.6877, domains: ["u.northwestern.edu"] },
  { id: "rcm", name: "Royal College of Music", short: "RCM", city: "London", country: "UK", lat: 51.4991, lng: -0.1774, domains: ["rcm.ac.uk"] },
  { id: "ram", name: "Royal Academy of Music", short: "RAM", city: "London", country: "UK", lat: 51.5237, lng: -0.1585, domains: ["ram.ac.uk"] },
  { id: "guildhall", name: "Guildhall School of Music & Drama", short: "GSMD", city: "London", country: "UK", lat: 51.5197, lng: -0.0937, domains: ["gsmd.ac.uk"] },
  { id: "rncm", name: "Royal Northern College of Music", short: "RNCM", city: "Manchester", country: "UK", lat: 53.4718, lng: -2.235, domains: ["rncm.ac.uk"] },
  { id: "rcs", name: "Royal Conservatoire of Scotland", short: "RCS", city: "Glasgow", country: "UK", lat: 55.866, lng: -4.2547, domains: ["rcs.ac.uk"] },
  { id: "rbc", name: "Royal Birmingham Conservatoire", short: "RBC", city: "Birmingham", country: "UK", lat: 52.4862, lng: -1.8904, domains: ["mail.bcu.ac.uk"] },
  { id: "trinitylaban", name: "Trinity Laban Conservatoire", short: "TLM", city: "London", country: "UK", lat: 51.4826, lng: -0.0077, domains: ["trinitylaban.ac.uk"] },
  { id: "rwcmd", name: "Royal Welsh College of Music & Drama", short: "RWCMD", city: "Cardiff", country: "UK", lat: 51.4837, lng: -3.183, domains: ["rwcmd.ac.uk"] },
  { id: "eisler", name: "Hochschule für Musik Hanns Eisler Berlin", short: "Hanns Eisler", city: "Berlin", country: "Germany", lat: 52.517, lng: 13.396, domains: ["stud.hfm-berlin.de"] },
  { id: "udk", name: "Universität der Künste Berlin", short: "UdK", city: "Berlin", country: "Germany", lat: 52.51, lng: 13.327, domains: ["student.udk-berlin.de"] },
  { id: "hmtm", name: "Hochschule für Musik und Theater München", short: "HMTM", city: "Munich", country: "Germany", lat: 48.1449, lng: 11.571, domains: ["hmtm.de"] },
  { id: "hmtleipzig", name: "HMT Felix Mendelssohn Bartholdy Leipzig", short: "HMT Leipzig", city: "Leipzig", country: "Germany", lat: 51.3397, lng: 12.3731, domains: ["stud.hmt-leipzig.de"] },
  { id: "hfmtkoeln", name: "Hochschule für Musik und Tanz Köln", short: "HfMT Köln", city: "Cologne", country: "Germany", lat: 50.9375, lng: 6.9603, domains: ["hfmt-koeln.de"] },
  { id: "hmdkstuttgart", name: "HMDK Stuttgart", short: "HMDK", city: "Stuttgart", country: "Germany", lat: 48.7758, lng: 9.1829, domains: ["hmdk-stuttgart.de"] },
  { id: "hfmthamburg", name: "HfMT Hamburg", short: "HfMT Hamburg", city: "Hamburg", country: "Germany", lat: 53.5628, lng: 9.9877, domains: ["hfmt-hamburg.de"] },
  { id: "hfmdetmold", name: "Hochschule für Musik Detmold", short: "HfM Detmold", city: "Detmold", country: "Germany", lat: 51.9367, lng: 8.8794, domains: ["hfm-detmold.de"] },
  { id: "hfmwuerzburg", name: "Hochschule für Musik Würzburg", short: "HfM Würzburg", city: "Würzburg", country: "Germany", lat: 49.7913, lng: 9.9534, domains: ["hfm-wuerzburg.de"] },
  { id: "hfmweimar", name: "Hochschule für Musik Franz Liszt Weimar", short: "HfM Weimar", city: "Weimar", country: "Germany", lat: 50.9795, lng: 11.3235, domains: ["hfm-weimar.de"] },
  { id: "hfmkarlsruhe", name: "Hochschule für Musik Karlsruhe", short: "HfM Karlsruhe", city: "Karlsruhe", country: "Germany", lat: 49.0069, lng: 8.4037, domains: ["hfm-karlsruhe.de"] },
  { id: "hfmdresden", name: "HfM Carl Maria von Weber Dresden", short: "HfM Dresden", city: "Dresden", country: "Germany", lat: 51.0504, lng: 13.7373, domains: ["hfmdd.de"] },
  { id: "mdw", name: "mdw – University of Music Vienna", short: "mdw", city: "Vienna", country: "Austria", lat: 48.2082, lng: 16.3738, domains: ["student.mdw.ac.at"] },
  { id: "mozarteum", name: "Mozarteum University Salzburg", short: "Mozarteum", city: "Salzburg", country: "Austria", lat: 47.8095, lng: 13.055, domains: ["stud.moz.ac.at"] },
  { id: "kug", name: "Kunstuniversität Graz", short: "KUG", city: "Graz", country: "Austria", lat: 47.0707, lng: 15.4395, domains: ["student.kug.ac.at"] },
  { id: "muk", name: "MUK Privatuniversität Wien", short: "MUK", city: "Vienna", country: "Austria", lat: 48.2, lng: 16.37, domains: ["muk.ac.at"] },
  { id: "zhdk", name: "Zurich University of the Arts", short: "ZHdK", city: "Zurich", country: "Switzerland", lat: 47.389, lng: 8.517, domains: ["zhdk.ch"] },
  { id: "basel", name: "Musik-Akademie Basel (FHNW)", short: "Basel", city: "Basel", country: "Switzerland", lat: 47.5596, lng: 7.5886, domains: ["students.fhnw.ch"] },
  { id: "hemgeneve", name: "Haute École de Musique de Genève", short: "HEM Genève", city: "Geneva", country: "Switzerland", lat: 46.2044, lng: 6.1432, domains: ["etu.hesge.ch"] },
  { id: "hemu", name: "HEMU Vaud Valais Fribourg", short: "HEMU", city: "Lausanne", country: "Switzerland", lat: 46.5197, lng: 6.6323, domains: ["hemu-cl.ch"] },
  { id: "hslu", name: "Lucerne School of Music", short: "HSLU", city: "Lucerne", country: "Switzerland", lat: 47.0502, lng: 8.3093, domains: ["student.hslu.ch"] },
  { id: "hkb", name: "Bern Academy of the Arts", short: "HKB", city: "Bern", country: "Switzerland", lat: 46.948, lng: 7.4474, domains: ["students.bfh.ch"] },
  { id: "lugano", name: "Conservatorio della Svizzera italiana", short: "CSI Lugano", city: "Lugano", country: "Switzerland", lat: 46.0037, lng: 8.9511, domains: ["conservatorio.ch"] },
  { id: "cnsmdp", name: "Conservatoire de Paris (CNSMDP)", short: "CNSMDP", city: "Paris", country: "France", lat: 48.8894, lng: 2.3889, domains: ["cnsmdp.fr"] },
  { id: "cnsmdl", name: "Conservatoire de Lyon (CNSMDL)", short: "CNSMDL", city: "Lyon", country: "France", lat: 45.764, lng: 4.8357, domains: ["cnsmd-lyon.fr"] },
  { id: "hear", name: "Académie Supérieure de Musique de Strasbourg", short: "HEAR", city: "Strasbourg", country: "France", lat: 48.5734, lng: 7.7521, domains: ["hear.fr"] },
  { id: "milano", name: "Conservatorio Giuseppe Verdi di Milano", short: "Cons. Milano", city: "Milan", country: "Italy", lat: 45.4642, lng: 9.19, domains: ["stud.consmilano.it"] },
  { id: "santacecilia", name: "Conservatorio Santa Cecilia", short: "Santa Cecilia", city: "Rome", country: "Italy", lat: 41.9028, lng: 12.4964, domains: ["studenti.conservatoriosantacecilia.it"] },
  { id: "marcello", name: "Conservatorio Benedetto Marcello", short: "B. Marcello", city: "Venice", country: "Italy", lat: 45.4408, lng: 12.3155, domains: ["studenti.conservatoriomarcello.it"] },
  { id: "cherubini", name: "Conservatorio Luigi Cherubini", short: "Cherubini", city: "Florence", country: "Italy", lat: 43.7696, lng: 11.2558, domains: ["studenti.consfi.it"] },
  { id: "majella", name: "Conservatorio San Pietro a Majella", short: "S.P. a Majella", city: "Naples", country: "Italy", lat: 40.8518, lng: 14.2681, domains: ["studenti.sanpietroamajella.it"] },
  { id: "torino", name: "Conservatorio Giuseppe Verdi di Torino", short: "Cons. Torino", city: "Turin", country: "Italy", lat: 45.0703, lng: 7.6869, domains: ["conservatoriotorino.it"] },
  { id: "esmuc", name: "ESMUC Barcelona", short: "ESMUC", city: "Barcelona", country: "Spain", lat: 41.3684, lng: 2.15, domains: ["esmuc.cat"] },
  { id: "rcsmm", name: "Real Conservatorio Superior de Madrid", short: "RCSMM", city: "Madrid", country: "Spain", lat: 40.409, lng: -3.6929, domains: ["alumno.rcsmm.eu"] },
  { id: "musikene", name: "Musikene", short: "Musikene", city: "San Sebastián", country: "Spain", lat: 43.3183, lng: -1.9812, domains: ["musikene.net"] },
  { id: "csmaragon", name: "Conservatorio Superior de Aragón", short: "CSMA", city: "Zaragoza", country: "Spain", lat: 41.6488, lng: -0.8891, domains: ["alumnos.csmaragon.es"] },
  { id: "csmvalencia", name: "CSM Joaquín Rodrigo Valencia", short: "CSM Valencia", city: "Valencia", country: "Spain", lat: 39.4699, lng: -0.3763, domains: ["csmvalencia.es"] },
  { id: "cva", name: "Conservatorium van Amsterdam", short: "CvA", city: "Amsterdam", country: "Netherlands", lat: 52.388, lng: 4.8979, domains: ["student.ahk.nl"] },
  { id: "koncon", name: "Royal Conservatoire The Hague", short: "KC Den Haag", city: "The Hague", country: "Netherlands", lat: 52.0705, lng: 4.3007, domains: ["student.koncon.nl"] },
  { id: "codarts", name: "Codarts Rotterdam", short: "Codarts", city: "Rotterdam", country: "Netherlands", lat: 51.9244, lng: 4.4777, domains: ["student.codarts.nl"] },
  { id: "hku", name: "Utrecht Conservatory (HKU)", short: "HKU", city: "Utrecht", country: "Netherlands", lat: 52.0907, lng: 5.1214, domains: ["student.hku.nl"] },
  { id: "kcb", name: "Royal Conservatory of Brussels (KCB)", short: "KCB", city: "Brussels", country: "Belgium", lat: 50.841, lng: 4.355, domains: ["student.ehb.be"] },
  { id: "apantwerp", name: "Royal Conservatoire Antwerp", short: "AP Antwerp", city: "Antwerp", country: "Belgium", lat: 51.2194, lng: 4.4025, domains: ["student.ap.be"] },
  { id: "amkrakow", name: "Akademia Muzyczna w Krakowie", short: "AM Kraków", city: "Kraków", country: "Poland", lat: 50.0647, lng: 19.945, domains: ["amuz.krakow.pl"] },
  { id: "amgdansk", name: "Akademia Muzyczna w Gdańsku", short: "AM Gdańsk", city: "Gdańsk", country: "Poland", lat: 54.352, lng: 18.6466, domains: ["amuz.gda.pl"] },
  { id: "ampoznan", name: "Akademia Muzyczna w Poznaniu", short: "AM Poznań", city: "Poznań", country: "Poland", lat: 52.4064, lng: 16.9252, domains: ["amuz.edu.pl"] },
  { id: "amwroclaw", name: "Akademia Muzyczna we Wrocławiu", short: "AM Wrocław", city: "Wrocław", country: "Poland", lat: 51.1079, lng: 17.0385, domains: ["amkl.edu.pl"] },
  { id: "chopin", name: "Chopin University of Music (Warsaw)", short: "Chopin UM", city: "Warsaw", country: "Poland", lat: 52.2419, lng: 21.0087, domains: ["chopin.edu.pl"] },
  { id: "amkatowice", name: "Akademia Muzyczna w Katowicach", short: "AM Katowice", city: "Katowice", country: "Poland", lat: 50.2649, lng: 19.0238, domains: ["am.katowice.pl"] },
  { id: "amlodz", name: "Akademia Muzyczna w Łodzi", short: "AM Łódź", city: "Łódź", country: "Poland", lat: 51.7592, lng: 19.456, domains: ["amuz.lodz.pl"] },
  { id: "zagreb", name: "Muzička akademija u Zagrebu", short: "MA Zagreb", city: "Zagreb", country: "Croatia", lat: 45.815, lng: 15.9819, domains: ["student.unizg.hr", "muza.unizg.hr"] },
  { id: "ljubljana", name: "Akademija za glasbo Ljubljana", short: "AG Ljubljana", city: "Ljubljana", country: "Slovenia", lat: 46.0569, lng: 14.5058, domains: ["student.uni-lj.si"] },
  { id: "belgrade", name: "Fakultet muzičke umetnosti Beograd", short: "FMU Beograd", city: "Belgrade", country: "Serbia", lat: 44.7866, lng: 20.4489, domains: ["fmu.bg.ac.rs", "student.bg.ac.rs"] },
  { id: "sibelius", name: "Sibelius Academy (Uniarts Helsinki)", short: "Sibelius", city: "Helsinki", country: "Finland", lat: 60.1699, lng: 24.9384, domains: ["uniarts.fi"] },
  { id: "nmh", name: "Norwegian Academy of Music", short: "NMH", city: "Oslo", country: "Norway", lat: 59.949, lng: 10.718, domains: ["student.nmh.no"] },
  { id: "kmh", name: "Royal College of Music Stockholm", short: "KMH", city: "Stockholm", country: "Sweden", lat: 59.3626, lng: 18.0645, domains: ["student.kmh.se"] },
  { id: "dkdm", name: "Royal Danish Academy of Music", short: "DKDM", city: "Copenhagen", country: "Denmark", lat: 55.6761, lng: 12.5683, domains: ["dkdm.dk"] },
  { id: "liszt", name: "Liszt Ferenc Academy of Music", short: "Liszt Academy", city: "Budapest", country: "Hungary", lat: 47.5015, lng: 19.0658, domains: ["lisztacademy.hu", "student.lisztacademy.hu"] },
  { id: "hamu", name: "HAMU (Academy of Performing Arts Prague)", short: "HAMU", city: "Prague", country: "Czech Republic", lat: 50.0875, lng: 14.4155, domains: ["hamu.cz"] },
  { id: "schulich", name: "Schulich School of Music (McGill)", short: "Schulich", city: "Montreal", country: "Canada", lat: 45.5088, lng: -73.5773, domains: ["mail.mcgill.ca"] },
  { id: "glenngould", name: "The Glenn Gould School (RCM)", short: "Glenn Gould", city: "Toronto", country: "Canada", lat: 43.6702, lng: -79.3903, domains: ["rcmusic.ca"] },
  { id: "utoronto", name: "Faculty of Music (U of Toronto)", short: "UofT Music", city: "Toronto", country: "Canada", lat: 43.6677, lng: -79.3948, domains: ["mail.utoronto.ca"] },
  { id: "ubc", name: "UBC School of Music", short: "UBC Music", city: "Vancouver", country: "Canada", lat: 49.2606, lng: -123.246, domains: ["student.ubc.ca"] },
  { id: "sydney", name: "Sydney Conservatorium of Music", short: "Sydney Con", city: "Sydney", country: "Australia", lat: -33.86, lng: 151.216, domains: ["uni.sydney.edu.au"] },
  { id: "melbourne", name: "Melbourne Conservatorium of Music", short: "Melb Con", city: "Melbourne", country: "Australia", lat: -37.7963, lng: 144.9614, domains: ["student.unimelb.edu.au"] },
  { id: "queensland", name: "Queensland Conservatorium (Griffith)", short: "QLD Con", city: "Brisbane", country: "Australia", lat: -27.4747, lng: 153.0175, domains: ["griffithuni.edu.au"] },
  { id: "elder", name: "Elder Conservatorium (Adelaide)", short: "Elder", city: "Adelaide", country: "Australia", lat: -34.9205, lng: 138.6047, domains: ["student.adelaide.edu.au"] },
  { id: "nzsm", name: "Te Kōkī NZ School of Music", short: "NZSM", city: "Wellington", country: "New Zealand", lat: -41.29, lng: 174.768, domains: ["myvuw.ac.nz"] },
  { id: "tbilisi", name: "Tbilisi State Conservatoire", short: "Tbilisi Cons", city: "Tbilisi", country: "Georgia", lat: 41.697, lng: 44.8, domains: ["tsc.edu.ge", "conmusic.ge"] },
  { id: "yst", name: "Yong Siew Toh Conservatory (NUS)", short: "YST", city: "Singapore", country: "Singapore", lat: 1.303, lng: 103.773, domains: ["u.nus.edu", "ystmusic.nus.edu.sg"] },
  { id: "hkapa", name: "Hong Kong Academy for Performing Arts", short: "HKAPA", city: "Hong Kong", country: "Hong Kong", lat: 22.281, lng: 114.172, domains: ["stu.hkapa.edu"] },
  { id: "karts", name: "Korea National University of Arts", short: "K-ARTS", city: "Seoul", country: "South Korea", lat: 37.606, lng: 127.045, domains: ["karts.ac.kr"] },
  { id: "ccom", name: "Central Conservatory of Music", short: "CCOM", city: "Beijing", country: "China", lat: 39.9042, lng: 116.4074, domains: ["mail.ccom.edu.cn"] },
  { id: "shcm", name: "Shanghai Conservatory of Music", short: "SHCM", city: "Shanghai", country: "China", lat: 31.21, lng: 121.46, domains: ["student.shcmusic.edu.cn"] },
  { id: "cairocons", name: "Cairo Conservatoire (Academy of Arts)", short: "Cairo Cons", city: "Cairo", country: "Egypt", lat: 30.068, lng: 31.22, domains: ["academyofarts.edu.eg"] },
  { id: "helwan", name: "Faculty of Music Education (Helwan)", short: "Helwan", city: "Cairo", country: "Egypt", lat: 29.8419, lng: 31.3342, domains: ["hq.helwan.edu.eg"] },
  { id: "berkleeabudhabi", name: "Berklee Abu Dhabi", short: "Berklee AD", city: "Abu Dhabi", country: "United Arab Emirates", lat: 24.4539, lng: 54.3773, domains: ["berklee.edu"] },
  { id: "hima", name: "Higher Institute of Musical Arts", short: "HIMA", city: "Kuwait City", country: "Kuwait", lat: 29.3759, lng: 47.9774, domains: ["hima.edu.kw"] },
  { id: "lnhcm", name: "Lebanese National Higher Conservatory", short: "LNHCM", city: "Beirut", country: "Lebanon", lat: 33.8938, lng: 35.5018, domains: ["conservatory.gov.lb"] },
  { id: "yarmouk", name: "National Music Conservatory (Yarmouk)", short: "Yarmouk", city: "Irbid", country: "Jordan", lat: 32.5333, lng: 35.85, domains: ["yu.edu.jo"] },
  { id: "cnmad", name: "National Conservatory of Music (Rabat)", short: "CNMAD", city: "Rabat", country: "Morocco", lat: 34.0209, lng: -6.8416, domains: ["cnmad.ma"] },
  { id: "isamt", name: "Higher Institute of Music (Tunis)", short: "ISAMt", city: "Tunis", country: "Tunisia", lat: 36.8065, lng: 10.1815, domains: ["isamt.u-tunis.tn"] },
  { id: "uct", name: "South African College of Music (UCT)", short: "SACM", city: "Cape Town", country: "South Africa", lat: -33.957, lng: 18.461, domains: ["myuct.ac.za"] },
  { id: "ufs", name: "Odeion School of Music (UFS)", short: "Odeion", city: "Bloemfontein", country: "South Africa", lat: -29.108, lng: 26.187, domains: ["ufs4life.ac.za"] },
  { id: "stellenbosch", name: "Stellenbosch University Music", short: "SU Music", city: "Stellenbosch", country: "South Africa", lat: -33.9321, lng: 18.8602, domains: ["maties.sun.ac.za"] },
  { id: "wits", name: "Wits School of Arts (Music)", short: "Wits", city: "Johannesburg", country: "South Africa", lat: -26.1929, lng: 28.0305, domains: ["students.wits.ac.za"] },
];

const TASTE_OPTIONS = [
  "Bach", "Mozart", "Beethoven", "Schubert", "Chopin", "Schumann", "Brahms",
  "Liszt", "Debussy", "Ravel", "Rachmaninoff", "Scriabin", "Prokofiev",
  "Messiaen", "Handel", "Vivaldi", "Mahler", "Shostakovich", "Sibelius", "Fauré",
  "Stravinsky", "Bartók", "Saint-Saëns", "Dvořák", "Tchaikovsky", "Poulenc",
  "Baroque", "Classical Era", "Romantic Era", "Impressionism", "20th Century",
];

const PALETTE = [C.burgundy, C.forest, "#3B4A6B", "#8A5A2B", "#5B3A66"];
const colorFor = (seed) => {
  const s = String(seed).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return PALETTE[s % PALETTE.length];
};
const initials = (name) => name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

const SAMPLE_STUDENTS = [
  { id: "demo-teacher", name: "Marcus Feld", instrument: "Piano", conservatoryId: "juilliard", year: "Final year", bio: "Final-year pianist at Juilliard. Happiest inside a Chopin ballade.", tastes: ["Chopin", "Debussy"], pieces: [{ title: "Ballade No. 1", composer: "Chopin" }], links: {}, top: "", flop: "", photoUrl: null, coverVideoUrl: null, teaching: { open: true, mode: "online", price: "60", pitch: "Patient with beginners, blunt about fundamentals. We will spend the first lesson on how you sit before we play a note." }, status: "approved", online: true },
  { id: "elise", name: "Élise Marchand", instrument: "Piano", conservatoryId: "paris", year: "3rd year", bio: "Drawn to color and light at the keyboard — chasing the perfect pedal half-tone.", tastes: ["Debussy", "Ravel", "Impressionism", "Chopin"], pieces: [{ title: "Images, Book I", composer: "Debussy" }, { title: "Gaspard de la nuit", composer: "Ravel" }], links: { instagram: "https://instagram.com/elise.piano" }, top: "Just nailed the voicing in \"Reflets dans l'eau\" — finally sounds like water instead of notes.", flop: "Still wrestling with the tremolo passage in Gaspard, my wrist gives out after a few bars.", online: true },
  { id: "theo", name: "Théo Lambert", instrument: "Piano", conservatoryId: "paris", year: "1st year", bio: "Recovering organist, newly obsessed with counterpoint.", tastes: ["Bach", "Baroque", "Beethoven"], pieces: [{ title: "Goldberg Variations, BWV 988", composer: "Bach" }], links: {}, top: "Finished memorizing the Goldberg aria — it finally feels like home.", flop: "Variation 26 is destroying my left hand independence.", online: false },
  { id: "lukas", name: "Lukas Brunner", instrument: "Piano", conservatoryId: "vienna", year: "4th year", bio: "Viennese classicism is home turf, but I'm trying to loosen up rhythmically.", tastes: ["Beethoven", "Schubert", "Classical Era"], pieces: [{ title: "Sonata No. 23 'Appassionata'", composer: "Beethoven" }, { title: "Wanderer Fantasy", composer: "Schubert" }], links: { instagram: "https://instagram.com/lukas.keys" }, top: "Played the Appassionata finale up to tempo for the first time.", flop: "The Wanderer Fantasy's octave passages are still sloppy under pressure.", online: true },
  { id: "polina", name: "Polina Sokolova", instrument: "Piano", conservatoryId: "moscow", year: "Masters, 2nd year", bio: "Big hands, bigger chords. Competition season starts in March.", tastes: ["Rachmaninoff", "Scriabin", "Romantic Era"], pieces: [{ title: "Piano Concerto No. 3", composer: "Rachmaninoff" }, { title: "Sonata No. 5", composer: "Scriabin" }], links: {}, top: "Got through the first movement cadenza without cracking, for once.", flop: "Stamina is the real issue — my arms give out by the development section.", online: true },
  { id: "maya", name: "Maya Chen", instrument: "Piano", conservatoryId: "juilliard", year: "Final year", bio: "Trying to make Liszt sound inevitable instead of just difficult.", tastes: ["Liszt", "Prokofiev", "Romantic Era", "20th Century"], pieces: [{ title: "Mephisto Waltz No. 1", composer: "Liszt" }, { title: "Sonata No. 7", composer: "Prokofiev" }], links: { instagram: "https://instagram.com/mayachen.music" }, top: "Mephisto Waltz finally sounds dangerous instead of just difficult.", flop: "The Prokofiev's toccata movement keeps falling apart past a certain speed.", online: false },
  { id: "daniel", name: "Daniel Osei", instrument: "Piano", conservatoryId: "curtis", year: "2nd year", bio: "Chopin is the reason I started, Brahms is the reason I stayed.", tastes: ["Chopin", "Brahms"], pieces: [{ title: "Ballade No. 1, Op. 23", composer: "Chopin" }, { title: "Handel Variations, Op. 24", composer: "Brahms" }], links: { instagram: "https://instagram.com/daniel.plays" }, top: "Played the Ballade in masterclass and it actually went well.", flop: "The fugue at the end of the Handel Variations keeps tripping up my voicing.", online: true },
  { id: "freya", name: "Freya Whitlock", instrument: "Piano", conservatoryId: "rcm", year: "3rd year", bio: "Slowly working my way through Messiaen's bestiary of birdsong.", tastes: ["Debussy", "Messiaen", "Impressionism"], pieces: [{ title: "Vingt Regards (No. 6)", composer: "Messiaen" }], links: {}, top: "Cracked the bird calls in 'Regard des oiseaux' — they finally sound free, not mechanical.", flop: "The huge chord clusters are still bruising my hands.", online: false },
  { id: "wei", name: "Wei Zhang", instrument: "Piano", conservatoryId: "shanghai", year: "Masters, 1st year", bio: "Bach in the morning keeps the rest of the day honest.", tastes: ["Bach", "Chopin", "Baroque"], pieces: [{ title: "Italian Concerto, BWV 971", composer: "Bach" }], links: { instagram: "https://instagram.com/wei.z.piano" }, top: "Recorded a take of the Italian Concerto I'm actually proud of.", flop: "The third movement's perpetual motion still falls apart past 120bpm.", online: true },
  { id: "haruto", name: "Haruto Sato", instrument: "Piano", conservatoryId: "geidai", year: "4th year", bio: "Looking for practice partners who also hear color in sound.", tastes: ["Debussy", "Ravel", "Liszt"], pieces: [{ title: "Miroirs", composer: "Ravel" }], links: {}, top: "Just finished learning all five movements of Miroirs.", flop: "'Une barque sur l'ocean' still feels murky instead of fluid.", online: true },
  { id: "jiwoo", name: "Ji-woo Kang", instrument: "Piano", conservatoryId: "snu", year: "2nd year", bio: "Slow practice evangelist. Ask me about metronome marks.", tastes: ["Rachmaninoff", "Chopin", "Romantic Era"], pieces: [{ title: "24 Preludes, Op. 28", composer: "Chopin" }], links: { instagram: "https://instagram.com/jiwoo.kg" }, top: "Performed all 24 Preludes in one sitting for the first time.", flop: "No. 16 in B-flat minor is still too fast for my fingers to stay clean.", online: false },
  { id: "anneliese", name: "Anneliese Voss", instrument: "Piano", conservatoryId: "eisler", year: "3rd year", bio: "The Hammerklavier has humbled me twice now. Third time's the charm.", tastes: ["Bach", "Beethoven", "Brahms", "Baroque"], pieces: [{ title: "Sonata No. 29 'Hammerklavier'", composer: "Beethoven" }], links: {}, top: "Made it through the Hammerklavier fugue without stopping, for the first time ever.", flop: "The opening leap still misses about half the time.", online: true },
  { id: "nathan", name: "Nathan Boucher", instrument: "Piano", conservatoryId: "rcmt", year: "1st year", bio: "New to conservatory life, very open to repertoire suggestions.", tastes: ["Chopin", "Schumann", "Romantic Era"], pieces: [{ title: "Carnaval, Op. 9", composer: "Schumann" }], links: { instagram: "https://instagram.com/nateplayspiano" }, top: "Just started Carnaval and having a blast with the character pieces.", flop: "Eusebius vs. Florestan — I can't find the right contrast yet.", online: false },
  { id: "isla", name: "Isla Cooper", instrument: "Piano", conservatoryId: "sydney", year: "2nd year", bio: "Trying to find the line between precision and feel.", tastes: ["Ravel", "Debussy", "Prokofiev", "20th Century"], pieces: [{ title: "Sonatine", composer: "Ravel" }], links: { instagram: "https://instagram.com/isla.c.piano" }, top: "Finished my end-of-year recital and the Sonatine went better than I'd hoped.", flop: "Still chasing the right touch for the second movement's habanera rhythm.", online: true },
];

/* ---------------------------------------------------------------- */
/* MOCK COHORT — a full 25-student roster at Curtis, purely to see   */
/* how the map pin popup and the sidebar behave at volume. Delete    */
/* this array and its spread in the students useState to remove.     */
/* ---------------------------------------------------------------- */
const CURTIS_MOCK_STUDENTS = [
  { id: "curtis-amara", name: "Amara Okafor", instrument: "Violin", conservatoryId: "curtis", year: "3rd year", bio: "Chasing a bigger sound without losing the sweetness up high.", tastes: ["Brahms", "Bach", "Romantic Era"], pieces: [{ title: "Violin Concerto in D, Op. 77", composer: "Brahms" }], links: {}, top: "The double stops in the first movement finally ring instead of scratch.", flop: "Intonation in the cadenza still drifts when I get nervous.", online: true, teaching: { open: true, mode: "both", price: "42" } },
  { id: "curtis-sebastian", name: "Sebastián Ruiz", instrument: "Cello", conservatoryId: "curtis", year: "Masters, 1st year", bio: "Bach suites every morning, everything else after.", tastes: ["Bach", "Baroque", "Schumann"], pieces: [{ title: "Cello Suite No. 5, BWV 1011", composer: "Bach" }], links: {}, top: "Played the Sarabande from memory in class and nobody breathed.", flop: "The gigue keeps running away from me.", online: false, teaching: { open: true, mode: "online", price: "48" } },
  { id: "curtis-nora", name: "Nora Lindqvist", instrument: "Viola", conservatoryId: "curtis", year: "2nd year", bio: "Viola jokes welcome, I have better ones.", tastes: ["Brahms", "Schubert", "Romantic Era"], pieces: [{ title: "Sonata in F minor, Op. 120 No. 1", composer: "Brahms" }], links: {}, top: "Found a bow that finally suits my instrument.", flop: "Shifting into the top register still feels like guesswork.", online: true },
  { id: "curtis-kwame", name: "Kwame Boateng", instrument: "Double Bass", conservatoryId: "curtis", year: "4th year", bio: "Orchestral excerpts by day, jazz basement by night.", tastes: ["Beethoven", "Prokofiev", "20th Century"], pieces: [{ title: "Symphony No. 5, bass excerpts", composer: "Beethoven" }], links: {}, top: "Nailed the trio section from the Scherzo at audition tempo.", flop: "My thumb position work is still inconsistent.", online: true, teaching: { open: true, mode: "physical", price: "35" } },
  { id: "curtis-yuki", name: "Yuki Tanaka", instrument: "Flute", conservatoryId: "curtis", year: "1st year", bio: "Long tones are the whole personality, apparently.", tastes: ["Debussy", "Ravel", "Impressionism"], pieces: [{ title: "Syrinx", composer: "Debussy" }], links: {}, top: "Syrinx felt genuinely free for the first time this week.", flop: "Running out of air in the long phrases.", online: false, teaching: { open: true, mode: "online", price: "40" } },
  { id: "curtis-marta", name: "Marta Kowalczyk", instrument: "Clarinet", conservatoryId: "curtis", year: "3rd year", bio: "Reed hoarder. Ask me about cane, at your peril.", tastes: ["Mozart", "Brahms", "Classical Era"], pieces: [{ title: "Clarinet Concerto, K. 622", composer: "Mozart" }], links: {}, top: "Finally have a reed that survives more than one rehearsal.", flop: "The Adagio still sounds careful rather than simple.", online: true },
  { id: "curtis-idris", name: "Idris Rahman", instrument: "Oboe", conservatoryId: "curtis", year: "2nd year", bio: "Half my practice time is making reeds. The other half is regret.", tastes: ["Bach", "Baroque", "Mozart"], pieces: [{ title: "Oboe Concerto in D minor", composer: "Marcello" }], links: {}, top: "The Adagio finally sings instead of just sounding.", flop: "Reed making. Always the reed making.", online: false },
  { id: "curtis-chiara", name: "Chiara Bellini", instrument: "Bassoon", conservatoryId: "curtis", year: "Masters, 2nd year", bio: "The bassoon is a tenor, not a punchline.", tastes: ["Mozart", "Prokofiev", "20th Century"], pieces: [{ title: "Bassoon Concerto, K. 191", composer: "Mozart" }], links: {}, top: "Got through the whole concerto without a single cracked note.", flop: "Low register response is sluggish in a cold hall.", online: true, teaching: { open: true, mode: "both", price: "36" } },
  { id: "curtis-tomas", name: "Tomás Silva", instrument: "Trumpet", conservatoryId: "curtis", year: "1st year", bio: "Working on playing quietly, which nobody warned me was the hard part.", tastes: ["Bach", "20th Century"], pieces: [{ title: "Brandenburg Concerto No. 2", composer: "Bach" }], links: {}, top: "Hit the high register cleanly three days running.", flop: "Endurance drops off badly in the last movement.", online: true },
  { id: "curtis-annika", name: "Annika Hoffmann", instrument: "French Horn", conservatoryId: "curtis", year: "4th year", bio: "Chasing a warm sound that still carries over an orchestra.", tastes: ["Brahms", "Schumann", "Romantic Era"], pieces: [{ title: "Horn Trio, Op. 40", composer: "Brahms" }], links: {}, top: "The Adagio mesto came together in rehearsal last night.", flop: "Still cracking the exposed entrance in the finale.", online: false, teaching: { open: true, mode: "physical", price: "44" } },
  { id: "curtis-diego", name: "Diego Fernández", instrument: "Trombone", conservatoryId: "curtis", year: "3rd year", bio: "Legato on a slide instrument is a lifelong argument.", tastes: ["Mozart", "20th Century"], pieces: [{ title: "Tuba mirum, from Requiem", composer: "Mozart" }], links: {}, top: "My slide legato is finally starting to sound like a wind player.", flop: "Soft high entrances are still a coin flip.", online: true },
  { id: "curtis-leila", name: "Leila Haddad", instrument: "Harp", conservatoryId: "curtis", year: "2nd year", bio: "Yes, I have to carry it. No, it does not fit in an elevator.", tastes: ["Debussy", "Ravel", "Impressionism"], pieces: [{ title: "Danses sacrée et profane", composer: "Debussy" }], links: {}, top: "Pedal changes in the Danse profane are finally automatic.", flop: "Buzzing strings in the low register are driving me mad.", online: true, teaching: { open: true, mode: "both", price: "55" } },
  { id: "curtis-ruth", name: "Ruth Adeyemi", instrument: "Marimba", conservatoryId: "curtis", year: "1st year", bio: "Four mallets, endless patience, one very tired practice room.", tastes: ["Messiaen", "20th Century"], pieces: [{ title: "Rebonds B", composer: "Xenakis" }], links: {}, top: "Memorised the whole of Rebonds B this month.", flop: "My roll is still uneven on the softest dynamics.", online: false },
  { id: "curtis-jonas", name: "Jonas Berg", instrument: "Organ", conservatoryId: "curtis", year: "Masters, 1st year", bio: "Registration is composition. I will not be taking questions.", tastes: ["Bach", "Messiaen", "Baroque"], pieces: [{ title: "Passacaglia in C minor, BWV 582", composer: "Bach" }], links: {}, top: "Found a registration for the Passacaglia that finally builds properly.", flop: "Pedal accuracy falls apart in the final variations.", online: true },
  { id: "curtis-sofia", name: "Sofia Papadopoulos", instrument: "Voice", conservatoryId: "curtis", year: "3rd year", bio: "Lieder over opera, quietly and unfashionably.", tastes: ["Schubert", "Schumann", "Romantic Era"], pieces: [{ title: "Frauenliebe und -leben", composer: "Schumann" }], links: {}, top: "The last song finally sits in the voice without pushing.", flop: "German diction still slows my line down.", online: true, teaching: { open: true, mode: "online", price: "50" } },
  { id: "curtis-hector", name: "Héctor Álvarez", instrument: "Guitar", conservatoryId: "curtis", year: "2nd year", bio: "Transcribing lute music until somebody stops me.", tastes: ["Bach", "Baroque"], pieces: [{ title: "Lute Suite No. 4, BWV 1006a", composer: "Bach" }], links: {}, top: "The Prelude is up to tempo and still clean.", flop: "Nail shape is a constant, tedious science experiment.", online: false, teaching: { open: true, mode: "both", price: "33" } },
  { id: "curtis-mei", name: "Mei Lin", instrument: "Piano", conservatoryId: "curtis", year: "4th year", bio: "Accompanying half the school, which is the best ear training there is.", tastes: ["Schubert", "Brahms", "Romantic Era"], pieces: [{ title: "Four Impromptus, D. 899", composer: "Schubert" }], links: {}, top: "Sight-read an entire song recital and survived.", flop: "The third Impromptu still sounds rushed under pressure.", online: true, teaching: { open: true, mode: "both", price: "46" } },
  { id: "curtis-oscar", name: "Oscar Dubois", instrument: "Violin", conservatoryId: "curtis", year: "1st year", bio: "Scales, then Ysaÿe, then more scales.", tastes: ["Bach", "20th Century"], pieces: [{ title: "Sonata No. 3 'Ballade'", composer: "Ysaÿe" }], links: {}, top: "The Ballade's opening recitative finally has shape.", flop: "My left hand tenses up the moment anyone listens.", online: false },
  { id: "curtis-priya", name: "Priya Nair", instrument: "Cello", conservatoryId: "curtis", year: "2nd year", bio: "Chamber music is the reason I practise at all.", tastes: ["Schubert", "Brahms", "Romantic Era"], pieces: [{ title: "String Quintet in C, D. 956", composer: "Schubert" }], links: {}, top: "Our quartet got through the Adagio without anyone rushing.", flop: "Vibrato still narrows when the writing gets high.", online: true },
  { id: "curtis-finn", name: "Finn O'Sullivan", instrument: "Viola", conservatoryId: "curtis", year: "3rd year", bio: "Inner voices are where the harmony actually happens.", tastes: ["Bach", "Brahms", "Baroque"], pieces: [{ title: "Cello Suite No. 1 (viola transcription)", composer: "Bach" }], links: {}, top: "Transcribed the whole first suite and it suits the viola better.", flop: "String crossings in the Courante are still uneven.", online: true, teaching: { open: true, mode: "physical", price: "38" } },
  { id: "curtis-zara", name: "Zara Mahmood", instrument: "Flute", conservatoryId: "curtis", year: "Masters, 2nd year", bio: "Contemporary repertoire and extended techniques, mostly.", tastes: ["Messiaen", "20th Century", "Debussy"], pieces: [{ title: "Le merle noir", composer: "Messiaen" }], links: {}, top: "Multiphonics are finally reliable rather than lucky.", flop: "The fast final section is still a blur.", online: false },
  { id: "curtis-nikolai", name: "Nikolai Petrov", instrument: "Clarinet", conservatoryId: "curtis", year: "4th year", bio: "Orchestral auditions are the whole year, apparently.", tastes: ["Prokofiev", "Beethoven", "20th Century"], pieces: [{ title: "Symphony No. 5, clarinet excerpts", composer: "Prokofiev" }], links: {}, top: "Got a trial week with a regional orchestra.", flop: "My tone thins out at the very top of the register.", online: true, teaching: { open: true, mode: "online", price: "41" } },
  { id: "curtis-elena", name: "Elena Rossi", instrument: "Voice", conservatoryId: "curtis", year: "1st year", bio: "Learning that singing quietly is far harder than singing loudly.", tastes: ["Mozart", "Classical Era"], pieces: [{ title: "Le nozze di Figaro, 'Porgi amor'", composer: "Mozart" }], links: {}, top: "Held the opening phrase in one breath at last.", flop: "The passaggio is still an obvious seam.", online: true },
  { id: "curtis-samuel", name: "Samuel Adeleke", instrument: "Trumpet", conservatoryId: "curtis", year: "2nd year", bio: "Piccolo trumpet enthusiast, to everyone else's dismay.", tastes: ["Bach", "Baroque"], pieces: [{ title: "Cantata BWV 51", composer: "Bach" }], links: {}, top: "Made it through the whole cantata without splitting a note.", flop: "Piccolo intonation is unforgiving when I'm tired.", online: false },
  { id: "curtis-hanne", name: "Hanne Voss", instrument: "Timpani", conservatoryId: "curtis", year: "3rd year", bio: "Timpani principally, marimba when nobody is looking.", tastes: ["Beethoven", "Brahms", "Classical Era"], pieces: [{ title: "Symphony No. 9, timpani excerpts", composer: "Beethoven" }], links: {}, top: "My tuning between movements is quick and accurate now.", flop: "Still over-playing in the loud tutti passages.", online: true, teaching: { open: true, mode: "physical", price: "37" } },
];

const SAMPLE_CONVERSATIONS = {
  daniel: [
    { from: "them", text: "Hey! Caught the clip of your Ballade No. 1 on your profile — that coda is brutal." },
    { from: "me", text: "Thank you. Still a work in progress, the octaves are wearing my hands out." },
    { from: "them", text: "Same with my Handel Variations, the double notes near the end never get easier. What tempo are you taking the presto con fuoco at?" },
  ],
  polina: [
    { from: "them", text: "Are you also preparing for the spring competition season?" },
    { from: "me", text: "Yes — trying to get the second movement of the Rach 3 solid before then." },
    { from: "them", text: "That cadenza is no joke. Which version are you using, the ossia or the original?" },
  ],
};

// Read back verbatim wherever a student is summarised, so these are the
// phrases themselves rather than numbers needing a suffix at each call site.
// "5th year+" rather than "4+ years", which sat next to "4th year" and asked
// the fourth-years to decide which of two chips meant them. The plus now
// starts where the numbered chips stop.
const YEAR_OPTIONS = ["1st year", "2nd year", "3rd year", "4th year", "5th year+"];

// Level and year are two different questions that used to share one row of
// chips, so a Masters student in their second year had to pick which half of
// themselves to declare. They are separate now and combine freely — except
// that Graduated and a year are the same fact told two ways, so choosing one
// rules out the other. Graduated still takes a level: somebody who finished a
// doctorate is a graduate of it.
const LEVEL_OPTIONS = ["Masters", "Doctoral"];
const GRADUATED = "Graduated";

// Still one string, still the phrase read back verbatim wherever a student is
// summarised — "Masters, 2nd year" is the shape the sample profiles already
// used, and the shape a card wants. Structure lives in the form, not in the
// column, so nothing downstream and no existing row has to change.
function composeStudy({ levels = [], year = "", graduated = false }) {
  return [...levels, graduated ? GRADUATED : year].filter(Boolean).join(", ");
}

// The inverse, for reopening a saved answer in the form. The vocabulary is
// closed, so anything unrecognised — an older "4+ years", a sample student's
// "Final year" — simply does not light a chip rather than lighting a wrong one.
function parseStudy(years) {
  const parts = String(years || "").split(",").map((s) => s.trim()).filter(Boolean);
  return {
    levels: LEVEL_OPTIONS.filter((l) => parts.includes(l)),
    year: parts.find((p) => YEAR_OPTIONS.includes(p)) || "",
    graduated: parts.includes(GRADUATED),
  };
}

// The orchestra as the icon sheet draws it, in score order — strings, wind,
// brass, percussion, keyboard — rather than the shorter list that came before,
// which offered "Percussion" and "Horn" as though a timpanist and a marimba
// player were the same applicant.
//
// The sheet also draws guitar, mandolin and lute, and they are deliberately
// not here: this is the orchestra, and a conservatory's guitarists sit in a
// different department. Their drawings stay cut in public/instruments in case
// that changes.
//
// Icons are cut from tools/assets/INSTRUMENTS.png by tools/cut-instruments.py and
// live in public/instruments as transparent webp, so they sit on any
// background and the sheet stays the single source of the drawings.
//
// "Other" is gone. It was the escape hatch for a list that was missing things;
// with the full sheet the honest answer is here, and a free-text field on a
// value read back in half a dozen places only produced spellings nothing could
// group by.
const INSTRUMENTS = [
  { name: "Violin",        icon: "violin" },
  { name: "Viola",         icon: "viola" },
  { name: "Cello",         icon: "cello" },
  { name: "Double Bass",   icon: "double-bass" },
  { name: "Harp",          icon: "harp" },
  { name: "Flute",         icon: "flute" },
  { name: "Piccolo",       icon: "piccolo" },
  { name: "Oboe",          icon: "oboe" },
  { name: "English Horn",  icon: "english-horn" },
  { name: "Clarinet",      icon: "clarinet" },
  { name: "Bass Clarinet", icon: "bass-clarinet" },
  { name: "Bassoon",       icon: "bassoon" },
  { name: "Contrabassoon", icon: "contrabassoon" },
  { name: "French Horn",   icon: "french-horn" },
  { name: "Trumpet",       icon: "trumpet" },
  { name: "Cornet",        icon: "cornet" },
  { name: "Trombone",      icon: "trombone" },
  { name: "Euphonium",     icon: "euphonium" },
  { name: "Tuba",          icon: "tuba" },
  { name: "Timpani",       icon: "timpani" },
  { name: "Snare Drum",    icon: "snare-drum" },
  { name: "Bass Drum",     icon: "bass-drum" },
  { name: "Cymbals",       icon: "cymbals" },
  { name: "Triangle",      icon: "triangle" },
  { name: "Tambourine",    icon: "tambourine" },
  { name: "Glockenspiel",  icon: "glockenspiel" },
  { name: "Xylophone",     icon: "xylophone" },
  { name: "Marimba",       icon: "marimba" },
  { name: "Vibraphone",    icon: "vibraphone" },
  { name: "Tubular Bells", icon: "tubular-bells" },
  { name: "Celesta",       icon: "celesta" },
  { name: "Cimbalom",      icon: "cimbalom" },
  { name: "Piano",         icon: "piano" },
  { name: "Harpsichord",   icon: "harpsichord" },
  { name: "Organ",         icon: "organ" },
  { name: "Voice",         icon: "voice" },
];

const INSTRUMENT_ICON = Object.fromEntries(INSTRUMENTS.map((i) => [i.name, i.icon]));
const INSTRUMENT_OPTIONS = INSTRUMENTS.map((i) => i.name);

// Two, because a conservatory student with a second study is ordinary — the
// pianist who is also an organist, the clarinettist who plays bass clarinet in
// the wind band — and because the first instrument is still the one they are
// known by. A list of five is a CV, not a profile, and it makes every card in
// the app a paragraph.
//
// MAX_INSTRUMENTS and instrumentsOf come from lib/profiles, next to the two
// columns they map onto. instrumentsOf reads all three shapes a profile turns
// up in: the array a signup writes now, the single `instrument` string on rows
// written before this and on every sample student, and the column pair.

// Guitar, mandolin and lute left the picker, but their drawings are still cut
// from the sheet and still shipped, and a profile that named one before then
// still deserves its symbol rather than a gap where everyone else has a mark.
const RETIRED_INSTRUMENT_ICONS = { Guitar: "guitar", Mandolin: "mandolin", Lute: "lute" };

// Every drawing the app can put on screen, by the name a profile stores. Only
// what is in here renders: an unrecognised instrument gets no symbol, which is
// a quiet row, where guessing at a filename would be a broken image.
const ICON_FOR = { ...RETIRED_INSTRUMENT_ICONS, ...INSTRUMENT_ICON };

function instrumentIcons(p) {
  return instrumentsOf(p).map((name) => ICON_FOR[name]).filter(Boolean);
}

// "Violin & Piano". Ampersand rather than the interpunct the profile lines use
// between instrument and year, so that two instruments read as one answer to
// one question instead of as two more facts in the row.
function instrumentLabel(p) {
  return instrumentsOf(p).join(" & ");
}


// Every account shares one email across both registration paths (Supabase
// enforces this), so a duplicate-email signup error always means someone is
// trying to register twice — once as a piano enthusiast, once as a
// conservatory student (or the same path twice). Give a clear explanation
// instead of Supabase's generic message.
function friendlyAuthError(message) {
  if (/already registered/i.test(message)) {
    return "This email is already registered. You can't sign up as both a piano enthusiast and a conservatory student — try logging in instead.";
  }
  return message;
}

// profiles.id is a foreign key onto auth.users, so a profile can only be
// written for an account that exists. A browser holding a session for an
// account that has since been deleted fails that check, and Postgres reports
// it the only way it can: insert or update on table "profiles" violates
// foreign key constraint "profiles_id_fkey". Accurate, and no help at all to
// someone at the end of an eight-step signup.
//
// Easy to hit while testing, and it will happen in the wild too — anyone
// logged in on a second device when their account is removed. The session is
// the thing that is wrong, so it goes; retrying without dropping it just
// walks into the same constraint.
async function friendlyProfileError(error) {
  const message = String(error?.message || "");
  if (error?.code === "23503" || /profiles_id_fkey/i.test(message)) {
    await supabase.auth.signOut().catch(() => {});
    return "You were signed in as an account that no longer exists, so we've signed you out. Please start the signup again.";
  }
  return message;
}

const emptyDraft = () => ({
  id: null,
  email: "", password: "", confirmPassword: "",
  name: "", years: "", instruments: [],
  conservatoryId: null, conservatoryEmail: "", conservatoryVerified: false,
  // Which of the three doors they took on the conservatory step. verifyMethod
  // follows from it — "student_email" is the OTP route, the other two upload —
  // but the two document routes are not the same question, and the copy has to
  // know which: an enrolment certificate is not a diploma.
  applicant: "", // "" | "student_email" | "student_doc" | "graduate"
  // The email route's other way through: rather than falling back to a
  // document, a student whose school is missing — or whose domain has moved —
  // sends the school and the address they already hold, for an admin to
  // approve into the roster.
  domainReq: null, // { name, address, email } | null
  // A transfer in progress: the old school is still on the profile and the new
  // one is not proved yet, so the step is not finished and Next stays shut.
  transferPending: false,
  // Where a transfer started from, so Cancel can put it back. In the draft
  // and not in component state: the verification step unmounts every time
  // somebody steps Back, and losing this stranded them — see startTransfer.
  priorSchool: null,
  // A code that has actually been sent. Component state lost this on every
  // Back, so returning showed an empty form and a dead Send button while a
  // perfectly good code sat in the member's inbox.
  otpEmail: "", otpSent: false,
  verifyMethod: "otp", proofDocUrl: "", proofDocName: "",
  tastes: [],
  pieces: [],
  links: { instagram: "", facebook: "", youtube: "", website: "" },
  top: "", flop: "", composerDay: "",
  photoUrl: "",
  coverVideoUrl: "",
  teaching: { open: false, mode: "", price: "", pitch: "" },
});

/* ---------------------------------------------------------------- */
/* SMALL PIECES                                                       */
/* ---------------------------------------------------------------- */
function Staff({ tone = "dark", gap = 3 }) {
  const c = tone === "dark" ? C.inkLine : C.parchmentLine;
  return (
    <div className="w-full flex flex-col" style={{ gap }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} style={{ height: 1, width: "100%", background: c }} />
      ))}
    </div>
  );
}

// The wordmark's crescendo hairpin, in the brand brass. Worth knowing: this
// yellow sits at roughly 1.6:1 against white, well under the 3:1 a graphic
// needs to read reliably, so the hairpin is deliberately faint on pale
// surfaces. Chosen for brand consistency over contrast.
const HAIRPIN = C.brass;

// The app mark: a brass disc, a thin white ring inset from its edge, and the
// teaching figure from the entry gate's "Find a teacher" circle. Flip this to
// swap the two colours — the PWA icons in public/ are generated to match, so
// they have to be regenerated alongside it.
const LOGO_SWAPPED = false;
const LOGO_BG = LOGO_SWAPPED ? "#FFFFFF" : C.brass;
const LOGO_FG = LOGO_SWAPPED ? C.brass : "#FFFFFF";

// 3.png is an opaque plate, so it cannot be recoloured directly. teacher-mark.png
// is the same figure reduced to an alpha silhouette, which CSS can mask and tint.
const TEACHER_MARK = "/teacher-mark.png";

// `size` drives the wordmark; `markSize` the disc beside it. They were one
// value, which meant matching the disc to the avatar would have scaled the
// word "artium" with it.
/**
 * The mark's construction: a brass disc, a white ring inside it, a brass core
 * inside that, and whatever symbol you pass rendered on top in white.
 *
 * Shared by the logo and the music button so the two can't drift apart — the
 * ring proportions are the recognisable part, and they only read as the same
 * object if the numbers stay identical at every size.
 *
 * The app icon puts its white ring hard against the outer edge, where the
 * phone's wallpaper supplies the contrast. On a white page that ring would be
 * invisible, so a thin brass rim sits outside it — that rim is what makes the
 * white circle read at all.
 */
function RingedDisc({ size, children, style }) {
  const ring = Math.max(1, size * 0.06);
  const core = ring + Math.max(1.5, size * 0.12);
  return (
    <span
      style={{
        width: size, height: size, borderRadius: "50%", background: LOGO_BG,
        flexShrink: 0, position: "relative", display: "flex",
        alignItems: "center", justifyContent: "center", ...style,
      }}
    >
      <span style={{ position: "absolute", inset: ring, borderRadius: "50%", background: LOGO_FG }} />
      <span style={{ position: "absolute", inset: core, borderRadius: "50%", background: LOGO_BG }} />
      {/* Relative so it paints above the absolutely-positioned discs. */}
      <span style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {children}
      </span>
    </span>
  );
}

/**
 * The word on its own, without the disc mark. Its own component because the
 * header and the entry gate's circles both draw it, and "the same wordmark"
 * only stays true if there is one of it.
 */
function Wordmark({ fontSize, color, hairpin = HAIRPIN, className }) {
  // Hairpin geometry all derives from the type size, so the mark stays in
  // proportion at every size it is used at (18, 20 and 22 today).
  const hairpinHeight = Math.max(4, fontSize * 0.26);
  const hairpinOffset = Math.max(1, fontSize * 0.06);
  const hairpinStroke = Math.max(1, fontSize * 0.05);
  return (
    <span className={className} style={{ fontFamily: FONT_WORDMARK, color, fontSize, fontWeight: 800, letterSpacing: fontSize * -0.035, lineHeight: 1 }}>
      <span style={{ position: "relative", display: "inline-block" }}>
        art
        {/* preserveAspectRatio="none" stretches the hairpin to the width of
            "art"; non-scaling-stroke keeps the line an even weight despite it. */}
        <svg
          width="100%"
          height={hairpinHeight}
          viewBox="0 0 100 10"
          preserveAspectRatio="none"
          aria-hidden="true"
          style={{ position: "absolute", left: 0, top: "100%", marginTop: hairpinOffset, display: "block", overflow: "visible" }}
        >
          {/* Apex on the left, opening rightward: a crescendo. Reversing the
              two x values would make it a diminuendo. */}
          <path d="M 0 5 L 100 0.6 M 0 5 L 100 9.4" stroke={hairpin} strokeWidth={hairpinStroke} fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
      </span>
      ium
    </span>
  );
}

function Logo({ tone = "light", size = 20, markSize, slogan = false }) {
  const col = tone === "light" ? C.ivory : C.inkText;
  const fontSize = size * 0.9;
  const mark = markSize || size;
  return (
    <div className="flex items-center gap-2.5">
      <RingedDisc size={mark}>
        <span
          style={{
            display: "block",
            width: mark * 0.4, height: mark * 0.47, backgroundColor: LOGO_FG,
            WebkitMaskImage: `url('${TEACHER_MARK}')`, maskImage: `url('${TEACHER_MARK}')`,
            WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
            WebkitMaskSize: "contain", maskSize: "contain",
            WebkitMaskPosition: "center", maskPosition: "center",
          }}
        />
      </RingedDisc>
      <Wordmark fontSize={fontSize} color={col} />
      {slogan && (
        <span style={{ fontSize: 13, color: C.ivoryDim, fontWeight: 500, letterSpacing: 0.1, whiteSpace: "nowrap" }}>
          — A World Connected by Music
        </span>
      )}
    </div>
  );
}

/**
 * Registered members — a headcount of the network, not of who happens to be
 * connected this second. One component because it appears in three headers and
 * under "Explore Artium's Network", and four copies of a mark and a number is
 * how they stop matching.
 *
 * The live figure it replaced is not gone, it is in the admin screen: how many
 * people are connected right now is something the owner watches, not something
 * a visitor needs on every page.
 */
export function MemberCount({ count, mark = C.ivoryDim, figure = C.ivory }) {
  if (count == null) return null;
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: mark }}>
      <Users size={14} />
      <span style={{ color: figure, fontWeight: 600 }}>{count}</span>
    </span>
  );
}

function Chip({ active, onClick, children, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-3.5 py-2 rounded-full text-sm transition-colors"
      style={{
        fontFamily: FONT_BODY,
        // brassText, not inkText: inkText is the page's type colour, which is
        // white now — and white on champagne is a 1.6:1 chip.
        border: `1px solid ${active ? "transparent" : "rgba(176,146,98,0.30)"}`,
        background: active ? "linear-gradient(180deg, #EFD08A 0%, #DBAB4C 55%, #C9962E 100%)" : "rgba(176,146,98,0.06)",
        color: active ? C.brassText : C.ivoryDim,
        fontWeight: active ? 700 : 500,
        boxShadow: active ? "0 3px 14px rgba(233,200,141,0.20)" : "none",
        // Ruled out by another choice, not broken. Faded and unpressable, and
        // the chip that rules it out is lit right there to say why.
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.34 : 1,
      }}
    >
      {children}
    </button>
  );
}

function Avatar({ name, id, size = 44, online, photoUrl }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {photoUrl ? (
        <img
          src={photoUrl}
          alt=""
          className="w-full h-full rounded-full object-cover"
          style={{ border: `1px solid ${C.inkLine}` }}
        />
      ) : (
        <div
          className="w-full h-full rounded-full flex items-center justify-center"
          style={{ background: C.brass, color: C.brassText, fontFamily: FONT_DISPLAY, fontSize: size * 0.36 }}
        >
          {initials(name)}
        </div>
      )}
      {online && (
        <span
          className="absolute -bottom-0.5 -right-0.5 rounded-full"
          style={{ width: size * 0.28, height: size * 0.28, background: "#1A9E6E", border: `2px solid ${C.ink}` }}
        />
      )}
    </div>
  );
}

function PrimaryBtn({ children, onClick, disabled, full, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 ${full ? "w-full" : ""}`}
      style={{
        fontFamily: FONT_BODY, fontWeight: 500, fontSize: 15,
        background: disabled ? "rgba(176,146,98,0.15)" : C.brass,
        color: disabled ? "#6E6E6E" : C.brassText,
        border: "none",
        borderRadius: 8,
        padding: "10px 20px",
        boxShadow: disabled ? "none" : "0 2px 14px rgba(233,200,141,0.22)",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "opacity 0.15s",
        opacity: disabled ? 0.7 : 1,
      }}
    >
      {children} {Icon && <Icon size={15} />}
    </button>
  );
}

function GhostBtn({ children, onClick, icon: Icon, tone = "light", disabled, style: extraStyle }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      className="inline-flex items-center gap-2"
      style={{
        fontFamily: FONT_BODY, fontWeight: 500, fontSize: 15,
        color: C.ivory,
        background: C.parchment,
        border: `1px solid ${C.inkLine}`,
        borderRadius: 6,
        padding: "9px 18px",
        whiteSpace: "nowrap",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "default" : "pointer",
        transition: "border-color 0.15s",
        ...extraStyle,
      }}
    >
      {Icon && <Icon size={15} />} {children}
    </button>
  );
}

function HomeBtn({ onClick }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 text-sm" style={{ color: C.ivoryDim, fontFamily: FONT_BODY, fontWeight: 500 }}>
      <Home size={15} /> Home
    </button>
  );
}

// Icon only, everywhere. aria-label carries the accessible name in place of
// the caption this used to show.
// The brass fill used to appear only while playing, so at rest the control was
// a faint outline that read as disabled. It is now the resting state too —
// the icon alone says whether it is playing. Sized to HEADER_CONTROL so it
// matches the avatar and the logo mark across every header.
export function MusicBtn({ playing, onToggle, size = HEADER_CONTROL }) {
  if (!SPOTIFY_PLAYLIST_ID) return null;
  // Black ring, black glyph, both stroked — the reference is drawn in outline,
  // so nothing here is filled. Ring weight and glyph size are fractions of the
  // diameter, keeping the proportion if HEADER_CONTROL moves.
  const ring = Math.max(2, Math.round(size * 0.085));
  const glyph = Math.round(size * 0.46);
  return (
    <button
      onClick={onToggle}
      title={playing ? "Pause" : "Play"}
      aria-label={playing ? "Pause playlist" : "Play playlist"}
      style={{
        // The bell puck's own material — the old heavy dark ring made this
        // disc read larger than its equal-diameter neighbours.
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: size, height: size, padding: 0, boxSizing: "border-box",
        border: "1px solid rgba(255,255,255,.85)", borderRadius: "50%",
        background: "radial-gradient(circle at 35% 28%, #FFFFFF 0%, #FCF8EF 55%, #F1E8D6 100%)",
        boxShadow: "0 6px 10px -4px rgba(150,115,55,.38), 0 2px 4px rgba(150,115,55,.14), inset 0 2px 2px #fff, inset 0 -3px 5px rgba(176,146,98,.28)",
        cursor: "pointer", flexShrink: 0, lineHeight: 0,
      }}
    >
      {playing
        ? <Pause size={glyph} color={MUSIC_BTN_INK} strokeWidth={2.6} />
        : (
          // Solid triangle, not a chevron — a filled ▶ reads as play where
          // the stroked > read as "next" or a link.
          <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill={MUSIC_BTN_INK} aria-hidden="true" style={{ marginLeft: 2 }}>
            <path d="M8 5.5v13l11-6.5z" />
          </svg>
        )}
    </button>
  );
}

/* ---------------------------------------------------------------- */
/* SPOTIFY PLAYER (Iframe API)                                       */
/* ---------------------------------------------------------------- */
const SPOTIFY_IFRAME_API_SRC = "https://open.spotify.com/embed/iframe-api/v1";

function SpotifyPlayer({ open, controllerRef, onPlayingChange, onClose }) {
  const mountRef = useRef(null);

  useEffect(() => {
    if (!SPOTIFY_PLAYLIST_ID) return;

    let cancelled = false;

    function boot(IFrameAPI) {
      if (cancelled || !mountRef.current) return;
      IFrameAPI.createController(
        mountRef.current,
        { uri: `spotify:playlist:${SPOTIFY_PLAYLIST_ID}`, width: "100%", height: 152 },
        (controller) => {
          if (cancelled) return;
          controllerRef.current = controller;
          controller.addListener("playback_update", (e) => {
            onPlayingChange(!e.data.isPaused);
          });
        }
      );
    }

    if (window.Spotify && window.Spotify.Iframe) {
      // Already loaded by a previous mount (e.g. StrictMode double-invoke).
      boot(window.Spotify.Iframe);
    } else {
      const prevReady = window.onSpotifyIframeApiReady;
      window.onSpotifyIframeApiReady = (IFrameAPI) => {
        boot(IFrameAPI);
        if (typeof prevReady === "function") prevReady(IFrameAPI);
      };
      if (!document.querySelector(`script[src="${SPOTIFY_IFRAME_API_SRC}"]`)) {
        const script = document.createElement("script");
        script.src = SPOTIFY_IFRAME_API_SRC;
        script.async = true;
        document.body.appendChild(script);
      }
    }

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!SPOTIFY_PLAYLIST_ID) return null;

  return (
    <div
      style={{
        // Anchored under the header pill that opens it, rather than floating in
        // a corner: every bottom corner collides with the entry gate's triangle.
        position: "fixed", top: 72, right: 16, width: 320, zIndex: 60,
        background: "rgba(176,146,98,0.05)", border: `1px solid ${C.inkLine}`, borderRadius: 12,
        boxShadow: "0 8px 32px rgba(0,0,0,0.55)", padding: 8,
        opacity: open ? 1 : 0,
        visibility: open ? "visible" : "hidden",
        transform: open ? "translateY(0)" : "translateY(8px)",
        pointerEvents: open ? "auto" : "none",
        transition: "opacity 0.15s ease, transform 0.15s ease",
      }}
    >
      <button
        onClick={onClose}
        title="Close"
        style={{
          position: "absolute", top: 6, right: 6, width: 22, height: 22,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.2)", border: "none", borderRadius: "50%",
          cursor: "pointer", color: C.ivoryDim, zIndex: 1,
        }}
      >
        <X size={13} />
      </button>
      <div ref={mountRef} />
      {/* Embeds play 30-second previews unless the iframe can see a logged-in
          Premium session — and it reads that from a third-party cookie on
          open.spotify.com, which Safari blocks, Chrome increasingly blocks,
          and every private window blocks. Nothing here can change that, so
          say so: without this, a visitor hears 30 seconds and concludes the
          site is broken. */}
      <p style={{ margin: "8px 4px 2px", fontSize: 11, lineHeight: 1.45, color: C.ivoryDim, fontFamily: FONT_BODY }}>
        30-second previews.{" "}
        <a
          href={`https://open.spotify.com/playlist/${SPOTIFY_PLAYLIST_ID}`}
          target="_blank"
          rel="noreferrer"
          style={{ color: C.brassLabel, fontWeight: 700, textDecoration: "underline" }}
        >
          Open in Spotify
        </a>{" "}
        for full tracks.
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* WORLD MAP                                                          */
/* ---------------------------------------------------------------- */
const CONTINENTS = [
  "M0,53.8L14.1,58.3L13.9,59.8L15.7,60.5L15.1,58.6L22.6,59L28.1,61.4L20.8,62.8L20.7,65.3L19.6,65.8L11.2,64.1L10.5,63L4.6,62.9L3.1,62L3.7,61L0.3,61.7L1.6,62.9L0,63.9M1000,64L996.4,65.1L992.8,64.9L998.2,69L997.9,70.8L992.7,70.2L982.4,72.4L974.2,75.8L973.1,77L969.2,75.2L961.9,77.2L960.7,76.3L958,77.4L954.3,77L950,81.2L950.1,82.2L953.3,82.8L952.9,86.5L950.4,86.6L949.2,88.7L950.3,89.8L945.5,91.1L944.5,94L940.4,94.7L939.5,97.3L935.5,99.6L931.8,88.5L933.1,84.9L935.4,83.4L935.6,82.2L939.9,81.6L954.6,73.8L956.9,70.1L953.5,70.4L951.8,72.5L944.8,75.3L942.5,72.1L935.3,73L928.4,77.3L930.7,78.9L920.2,79.8L920.4,77.9L916.1,77.5L912.6,78.8L895,79.1L875.3,90.1L879.7,90.5L881.1,92.1L883.8,92.6L885.6,91.3L888.6,91.5L892.6,94.3L892.7,96.5L890.5,99.1L889.1,106.2L883.9,111.7L874.6,119.1L870.9,120.6L869.2,120.6L867.4,119.4L861,122.8L860.3,125.5L854.3,128.4L853.8,129.8L856.5,131.3L859.6,136L859.6,138.9L858.6,140.3L851.3,142.1L851.6,138.8L850.3,136.1L852.4,135.7L850.5,133.5L848,133.7L846.4,132.6L847.8,131.2L848.1,128.9L845.2,128L836.3,130.6L837.7,129.4L837.2,128.4L839.4,126.7L837.9,125.4L830.6,129.7L827.9,129.8L826.5,131L827.9,132.7L830.2,133.2L830.3,134.3L832.5,135L835.6,133.2L839.9,134.3L840.3,135.6L836.4,136.3L831,140.8L834,142.2L838.6,149L838.6,150.9L836.8,151.6L839.1,153.8L838,157.9L836.5,158.1L829.6,167.3L821.9,171.8L818.8,172.1L817.1,173.2L816.1,172.4L814.6,173.6L807.7,175.3L806.8,178L805.2,178.2L804.5,176.3L805.2,175.3L801.4,174.5L796.4,177.1L794.1,179.5L793.5,181.3L798.2,187.3L802.4,191L803.7,195.7L803.3,200.2L792.1,208L791.1,206.4L791.9,204.7L787.5,202.8L785,198.9L780.1,197.7L780.5,195.7L778,195.7L775.6,206.4L777.4,206.5L779.1,211L786,215.9L787.2,217.6L787.5,222.9L789.5,226.7L787.6,226.9L781.6,222.9L778.3,216.4L778,213.5L773.6,208.6L773.2,210.1L772.6,208.7L774.3,200.8L773.4,199.2L773.6,196.5L769.9,186.7L764.9,189.8L761.6,189L762.6,185.8L762,183.5L759.8,180.5L760.2,179.6L758.5,179.3L756.6,177.2L753.9,171.8L751.4,171.7L750.8,174.2L747.3,173.6L746.9,174.6L741.6,175.1L741.8,177L740.3,178.5L736.3,180.2L728.3,186.5L728.3,187.7L723.1,189.4L722.3,191.3L723,196.8L721.8,199.2L721.8,203.5L720.4,203.7L719.1,205.6L720,206.4L717.4,207.2L715.4,209.6L712.8,207.3L708,197.4L706.8,192.6L704.3,189.1L701.7,175.4L697.7,177L695.7,176.6L692.1,173.6L693.5,172.6L692.6,171.6L687.3,168.8L684.4,165L670.8,165.9L659.4,164.2L658.3,161.1L656.9,160.6L652,162.3L643.1,158.8L639.2,153L637.7,153.4L635.9,152.5L634.9,153.5L633.3,153.4L635.6,159.2L639.3,161.8L639.2,163.7L641.1,166.7L641.7,163.5L643.3,164.1L642.7,167.1L643.9,168.6L650,168.4L656.6,162.5L656.7,166.3L657.9,168L663.1,169.8L666.1,173L662.5,177.8L660.6,178.3L660.3,181.6L657.2,182.5L656.3,184.3L653.5,184.9L653.5,186L645.5,188.1L644.9,190.1L637.7,192.4L635.2,194.2L626.7,196L625,197.5L620.8,197.7L618.3,191.1L618.5,187.1L613.7,180.2L608.7,175.6L608.5,172.3L606.9,169.5L604.1,167.9L602.6,164.6L597.6,158.3L596.2,158.3L597,154.6L594.2,159.3L590.1,153.7L594.7,163.2L599.1,168.9L598.7,171L602.4,173.8L604.1,182.4L606.7,184L609.1,189.3L620.3,198.3L620.2,199.4L618.7,200L622.5,203.3L623.9,203.3L642,199.3L641.8,202.8L637.4,212.6L632.6,219.2L629.3,222.7L619.8,229.3L615.5,234.3L611.8,236.6L608.9,241.9L607.8,246.5L609.6,247.5L608.9,251.7L612.4,257.5L613.3,267.5L609.6,272.7L603.9,274.9L596.6,280.6L596.4,282.4L598.8,286.5L598.5,291.6L590.5,295.7L591.4,297L589.5,303.5L578.4,313.8L571.6,316.7L562.7,316.5L554.5,319L550.7,316.6L549.8,313.3L550.7,312.9L550.6,310.9L542.3,299.2L539.6,286.5L532.8,276.2L532.7,270.4L534.7,264.6L537.9,260.8L538,257.4L535.8,253.4L536.8,251.9L533.1,242.9L524.4,232.8L527.2,222.1L526.1,220.5L524.9,220L523.6,217.8L516.4,219.1L512,214L505.2,214.3L494.5,218L487.1,216.8L479.1,218.9L475,217.6L465.5,211.4L464,210.1L463.2,207.2L458.8,202.2L453.9,198.9L453.6,195.3L451,192.4L454.3,188.8L455.1,183.7L454.8,178.7L452.6,176.3L452.9,174.1L454.8,172L455.6,169.4L458.1,167.3L459.9,162.9L464.9,158.3L467.5,158.1L473.4,153.5L472.7,150.3L474.2,146.8L480.8,142.8L483.5,138.6L494,140.1L504.1,136.5L514.8,136.2L517.4,135.2L523.4,135.6L526.4,134.5L528.4,134.9L528.3,136.1L530.8,135.7L529.4,136.9L530.4,138.8L530,141L528.2,142.3L528.7,143.7L530.2,143.7L531.9,145.3L542.3,147.5L543.6,149.8L553,152.7L555.7,150.8L555.1,148.9L555.9,147.6L559.8,146.1L563.6,146.6L564.5,147.7L569.2,148.5L569.9,149.3L573.6,149.3L580.3,151.1L586,149.4L588,149.7L588.8,150.9L589.4,150.1L593.8,150.9L596,149.4L600,141.5L600.4,138.5L599.4,137.3L600.4,136.3L596.4,136L594.5,137.4L590.3,137.7L588.1,136.4L585.1,136.3L584.4,137.3L582.5,137.6L579.8,136.3L576.8,136.3L573.1,132.4L574.5,130.4L572.7,129.1L575.8,126.7L580.1,126.6L581.2,124.7L586.5,125L593.1,122.6L597.7,122.6L606.5,125.4L612.1,125.2L615.4,123.9L615.8,122.8L615.1,121L601.9,114.4L603.9,114L606.2,111.8L604.6,110.8L608.7,109.2L597.1,111.7L597.3,113.3L601.5,113.8L600.9,114.7L594.1,116.6L592.6,116.1L593.2,114.9L590.1,114.2L593.3,112.8L592.5,112.2L588.2,111.6L588,110.6L585.4,111L582.3,114.9L580.1,115.2L579.3,118.3L576.9,121.2L578.1,123.6L580.5,124.5L580,125.1L576.7,125.2L573.2,127.4L572.4,125.7L569.2,125.4L565.9,126L567.8,127.5L566.4,127.9L564.8,127.9L563.4,126.6L562.9,127.1L564.9,129.8L563.8,130.4L566.7,132.3L566.8,133.8L564.2,133.1L565,134.4L563.3,134.7L564.3,136.9L562.5,136.9L560.2,135.8L558.7,132.1L553.9,127.1L554.3,123.4L544.5,118.8L542.2,116.9L541.4,114.8L539.6,114.4L538.8,115.5L537.9,114.6L538.7,113.5L536.5,113.1L534.2,114L534.1,116L535,117.3L542.1,122.8L544.2,122.8L544.9,123.3L544.1,123.8L551.3,127.3L550.8,128.3L546.9,126.6L545.7,128.3L547.7,129.2L547.4,130.6L546.2,130.7L544.7,132.9L543.6,133.1L544.7,130.4L542.8,127.7L533.6,123.4L529.2,120.3L528.3,117.8L524.7,116.6L518.1,119.8L512.7,119.1L508.6,119.9L508.4,122.9L505.8,124.6L502.3,125.2L499.2,129.5L500.3,131L498.1,133.8L496,134.3L494,136.3L487.9,136.3L485.1,138.1L483.7,137.9L481.9,135.6L475.3,135.8L475.4,132.2L473.5,131L475.6,125.8L475,121.2L473.9,120L477.8,118.2L494.7,119L496.2,117.5L496.7,112.4L491.8,108.4L487.5,107.4L487.2,105.6L490.8,105L495.5,105.7L494.6,102.8L497.3,103.9L503.7,101.9L504.6,99.8L510.6,98.1L513.1,94.3L519.7,92.8L522.6,93.2L524.4,91.9L522.6,88.1L522.5,85.5L523.7,84L529.4,82.5L528.5,84.6L530.3,85.7L526.8,88.2L527.6,90.5L530.4,91.1L530.4,92L534.8,90.8L539.2,92.6L549,89.8L554.6,90.9L555.2,89.8L559.1,89L558.6,84.9L559.9,83.3L562.6,82.4L564.8,84.3L567,84.3L567.9,80.8L565.1,80.2L564.8,78.7L571.8,77.7L577.7,78L580.9,76.6L578,75.4L563.5,77.1L559.2,74.8L559.8,72.3L558.5,70L559.8,68.5L570.5,63.6L570.3,62.5L566.4,61.3L561.6,62L558.9,63.8L559.4,65.4L549.6,69.6L547.6,73.2L552.2,76.5L549.6,79.3L546.7,79.9L544.1,86.6L540.7,86.4L539.2,88.4L536,88.5L530.6,79.6L528.8,78L523.3,81L519.6,81.6L515.7,80.3L513.9,71.6L516.4,70L529.2,65.2L541,56.7L553.3,51.6L564,50.6L568.2,48.5L578.2,48.1L586.9,50L583.3,50.6L586.4,52.2L589.3,51.3L611.9,56.4L614.1,57.6L614.2,59.3L611.2,60.7L606.6,61.3L592.2,59.7L596.7,61.6L597.1,65.4L602.8,66.8L603.2,65.6L601.4,64.5L603.3,63.5L610,65.1L612.3,64.5L610.5,62.6L616.9,60.1L622.1,61.2L623.7,59.4L621.4,57.9L622.7,56.3L620.7,54.8L628.5,55.6L630.1,57L626.5,57.3L626.6,58.8L628.7,59.6L633,59.1L633.7,57.4L649.2,54L651.3,54.2L648.6,55.7L652,56L663.3,54L666.5,55.5L669.7,53.8L666.7,52.3L668.2,51.5L676.4,52.3L690.3,56L692.2,54.7L689.3,52.8L685.9,52.5L686.8,51.3L685.3,48.5L690.4,46.2L692.2,43.8L701.6,44L702.2,45.4L699.6,47.5L701.3,48.3L702.2,50.1L701.6,53.6L704.6,55.2L698,60.5L701.2,60.9L705.3,59.3L708.5,56.8L706.9,55.4L708.2,53.7L705.1,53.5L704.4,52.1L706.7,49.5L703.1,47.4L708,45.7L707.4,43.9L708.8,43.8L710.2,45.2L709.1,47.7L712.1,48.2L710.8,46.3L715.5,45.3L721.3,45.2L726.4,46.6L723.9,44.5L723.6,41.8L741.2,41.1L738.9,39.7L742.1,38L759,35.7L768.5,36L774.8,34.6L779.9,34.7L783.3,32.5L789.9,31.4L794.6,32.3L790.8,32.9L797.1,33.3L797.9,34.5L808.5,34L817,36.2L816.3,37.5L803.9,40.4L811.4,41.4L813.9,40.9L815.4,42.6L821,41.5L829.9,41.9L830.6,43.1L842.2,43.5L842.4,41.6L852.7,42L857.2,43.3L858.5,45L856.8,46.1L860.3,48.1L864.7,49.1L867.4,46.4L871.8,47.6L876.6,46.9L888.5,47.3L886.5,44.9L890.2,43.8L915.3,45.5L917.6,47L924.9,49L941.7,48.9L944,50L943.6,51.8L947.1,52.5L966.2,52.2L971,54.5L974.5,53.6L972.2,52L973.5,50.9L996.1,52.6M0,53.8Z",
  "M248.5,52.4L248.5,55L252.2,53L255.5,54.7L254.7,56.5L257.4,58.3L262.3,54.2L262.4,51.4L270.5,52L274.2,53.3L274.4,54.5L272.3,55.9L274.3,57.2L273.9,58.5L268.5,60.3L264.6,60.7L261.8,59.9L257.4,64.5L254.2,66.2L250.2,66.4L248,67.4L247.9,69.1L244.6,69.4L241.2,71.5L238.2,74.4L237,79.4L241.1,79.8L243.6,84.1L247.5,83.6L263.9,88.7L271.5,89.1L271,91.3L271.9,93.8L273.9,96.7L278,99.1L280.2,98.3L281.7,95.7L280.2,91.6L278.3,90.3L282.7,89.1L287.4,85.5L287.2,83.8L285.3,81.6L281.9,79.7L285.2,77L283,70.7L285,70.1L292.6,71.1L294.9,70.4L301.7,73.8L306.7,74L307.5,79.3L310.1,79.7L312.1,81.2L316.1,79.8L320.6,75.8L329.5,84.4L328.3,86L334.5,88.9L340.7,90.4L341.8,92.6L345.1,93.9L345.3,96.7L336.7,99.5L333.2,101.6L315.6,101.6L309.7,104.6L302.5,110.3L304.8,109.9L309.3,106.6L315.1,104.4L319.3,104.2L321.7,105.4L319.1,107.2L320.9,111.8L324.5,113.1L329.1,112.7L331.9,109.9L332.1,111.7L333.9,112.6L318.4,118.7L316.3,118.5L316.2,116.4L321,114.3L313.5,114.6L314,115.5L305.2,118.4L303.6,120L303.3,121.8L304.2,123.2L305.3,123.2L305,122.3L305.9,122.9L305.7,123.6L295.3,125.4L300.2,125.4L294.6,125.9L293.7,126.6L294.6,126.7L294,128.5L291.9,130.5L290.2,129.1L291.5,131.9L289.1,134.9L289.7,133L288.2,132.1L287.9,130L288,132.7L286.2,132.3L288.1,133.1L289.6,139.1L287.9,141L280.4,144.4L274.1,149.7L274.1,153.2L277.6,161.3L276.7,165.6L274.5,165.6L273,163.9L269.8,158.7L270.4,157L269.6,155.6L266.4,153.1L263.6,154.3L260,152.3L252.3,152.5L251.1,152.9L252.2,155.1L249.6,155.6L245.5,154.2L239.3,154.1L231.7,157.7L229.5,160L230.2,163.9L228.6,168L228.1,172.6L232.5,180.6L237.7,183.6L244.3,182.2L247.9,180.7L249.2,176.3L258.2,174.9L258.8,176.7L256.6,179.8L256,183.3L254.7,182.7L254.6,187.8L253,189.4L263.9,189.1L268.3,191L268.9,193.4L267.2,201.6L271.6,207L273.8,207.5L279,205.4L286.6,207.9L289.8,205.9L290.3,202.9L291.9,201.7L296.1,201.3L300.7,198.2L302.4,199L301.8,200.5L300.1,200.8L301,203.3L299.8,204.8L300.8,206.8L302,206.6L302.7,204.8L301.7,202L305.1,200.9L304.7,199.7L305.7,198.9L306.7,200.7L308.7,200.8L310.6,203L316,202.8L319.8,204.2L321.3,202.8L328.1,202.6L325.8,203.4L326.7,204.6L331,206L331.5,208.1L335.8,209.6L337.5,211.2L337.6,212.5L341.3,214.7L350.1,215.3L353.1,216.2L356.5,219.4L357.5,219.3L359.7,225.1L361.2,225.6L361.3,227.3L359.2,229.4L360,230.2L364.9,230.6L365,233.2L367.2,231.5L375.3,234L376.6,235.5L376.2,236.9L379.4,236.1L384.8,237.4L388.9,237.3L396.6,242.3L401.1,243.2L402.1,244L403.5,248.8L402.4,253L392.6,263.4L390.9,275.7L389.6,280.1L386.7,283.4L386.3,286.1L384,287.2L383.4,288.7L376,289.7L367.6,293.6L365.3,296.1L364.2,303.3L359.2,309.2L354.8,312.4L350.5,317.9L347.4,319.3L343.8,319.1L339.4,318.1L337.7,316.7L337.5,318L341,320.2L340.7,321.9L342.4,323.1L342.3,324.3L339.6,327.6L335.5,329L326.8,329.2L327.4,334L325.7,334.9L322.9,335.2L320.2,334.3L319.1,334.9L319.5,337.5L321.4,338.3L322.9,337.4L323.7,338.8L318.9,341.2L317.9,345.1L315.3,345.1L313.1,346.4L312.3,348.3L315,350.2L317.7,350.7L316.7,353L313.4,354.4L311.6,357.4L308,359.6L308.8,362.3L310.7,363.8L307.1,363.6L303.2,365.2L302.8,367.6L298.5,366.8L291.8,363.6L290,354.4L291.2,351.9L294.1,350L289.9,349.2L292.5,347L293.5,342.7L296.6,343.6L298,338.3L296.1,337.6L295.3,340.8L293.5,340.5L295.3,332.1L296.6,330.3L295.6,325L296.8,324.9L301.6,312.8L301.4,303.8L303,300.6L305.3,284.7L305.1,280.5L304.5,276.9L301.7,275.4L301.5,274.4L288.9,267.4L287.7,265.3L288.2,264.6L278.4,248.4L274.3,245.7L275.2,244.5L273.9,242.1L278.4,236.8L277.8,235.7L276.8,236.9L275.1,235.7L275.2,232.7L276.2,232.3L277.5,228L281,226.5L280.6,225.7L281.6,225.5L282.1,223.3L283.5,223.1L285.8,220.2L284.7,219.6L284.8,212.9L282.7,210.8L282.1,209.4L282.8,208.7L280.2,207L279,207.2L276.4,209.3L277.8,210.7L275.3,211.5L274.8,210L268,208.4L267.7,206.9L264,204.2L263.6,205.6L262.1,204.6L262.1,202.5L261.3,202.2L261.9,201.7L256.5,197L257.5,196.8L257,196L254.2,196.4L246.6,194.4L240.7,190.1L237,188.6L231.8,190L212.5,183.3L207,179L206.3,177.8L207.2,177.5L207.6,175.3L205.5,171.8L198.9,165.7L196.5,164.6L196.4,162.4L188.3,156L185.7,150.3L183.7,149.3L181.2,148.7L181.5,152.9L190,161.9L192.6,167.9L194,168L196.1,170.3L194.4,171.7L193.6,170.1L188.4,166.8L188.1,163.5L180.4,159.2L181.8,159.1L182.9,157L179.1,154.5L174.2,145.5L170.8,143L164.9,141.6L154.5,127L155,122.7L154.1,120.7L155.8,113.7L153.7,106.9L158,107.2L159.5,109.6L160.2,109L158.8,104.8L151,101.2L146,100.1L144.5,97.8L144.9,96.3L141.3,95.2L140.8,93.1L137.5,91.3L137.4,89.9L133.4,88.2L132.6,85.9L129.1,83.9L127.6,81.5L120.5,81.2L111.5,77.8L104,76.5L100.1,76.7L91.4,74.4L88.3,74.9L88.8,76.7L78.6,78.8L78.2,77.3L79.4,74.8L82.4,74L81.6,73.4L72.2,78.3L74.2,79.6L71.6,81.4L65.8,83.3L59.9,86.9L42.3,91L50.5,87.2L54,86.9L61.9,82.9L63.8,79.4L58.2,80.7L56.4,79.4L55.6,80.3L54.6,79L50.1,80.1L50.4,77.6L48.6,76.7L45,77.2L40.7,75.4L40.7,73.9L38.6,72.8L42.9,68.6L47,68.8L53.4,67L51.3,65.4L53.4,64.4L47.9,65.6L41.8,65.3L37.7,64.7L33,62.2L43.1,59.9L45.4,59.9L45,61.1L50.9,61L40.6,56.1L36.8,55.3L38.3,54L43.3,53.9L46.8,52.7L47.4,51.5L50.3,50.3L65.1,47.6L71.3,49.3L77.2,49L77,49.6L81.3,50L101.1,50.7L120.8,53.9L126.6,52.1L130.8,52.4L139.5,50.6L141.4,51.7L143.4,51.1L144.1,49.9L150.7,52.4L154.4,50.7L154.8,52.6L162.6,51.6L179.9,53.9L183.6,55.2L179.7,56.5L184.7,57L194.6,56.3L197.6,57.8L200.6,56.5L197.7,55.4L199.5,54.6L205.1,54.2L210.2,56.2L218.2,57.1L226.5,56.8L226.2,55.2L228.7,54.7L233,55.6L233,58L234.8,56L237,56.1L238.2,53.5L232,50.9L232.2,48.1L235.5,46.2L242,47.7L245.8,50.6L243.3,51.9L248.5,52.4Z",
  "M0,446.5L2.6,445L7.6,445.8L11.3,444.9L15.6,446L19.8,444.8L27.9,444.4L36.1,446.1L60.9,448.2L68.9,447.5L87.4,448.8L102.5,447.3L103.1,446.1L83.2,445.4L80.8,444.4L73.4,443.9L75.9,440.7L75.4,439.7L64.3,437.3L77.5,437L81.5,437.9L93.3,435.3L92.3,434.3L84.6,432.8L68.5,432.1L61,429.4L60.1,426.5L64,427.5L72.9,426.9L75.2,428L79.6,427.8L94.2,425.4L93.1,423.5L93.9,422.6L97.5,422.2L99.1,423L124.4,419.9L167.5,420.3L183.5,418.4L188.1,420.9L190.9,420.2L201.2,422.1L208.7,421.5L220.4,422.4L221.9,421.3L218.7,419.6L215.2,419.4L213.6,418.4L212,415.6L224.6,416.3L228.6,418L232.4,418.1L243.2,417L249.8,417.4L252.1,415.4L254.4,416.6L261.1,416.8L263.4,417.8L273.7,418.7L277,416.9L288.3,419L308.5,416.6L311.2,416L313.5,414.1L309.6,408.2L312.3,405.2L311.8,402.1L313.2,400.9L325,395.2L339.4,391.7L341,392.3L340,393.2L327.7,395.6L326,397.3L327.4,399.2L322.9,400L317.6,403.7L320,405.5L324.5,406.9L328.3,410.7L331.4,417L331,418.3L321.2,422.3L303.9,425.8L285.4,426L286.3,427L295.4,429.1L283.5,430.3L283.3,432.4L290.7,435.1L334.2,440.5L338.3,442.7L361.8,438.9L381.1,439.8L386.7,437.9L420.7,435.3L417.5,433.5L417.5,432.6L401,433.1L400.2,432.1L400.6,430.2L401.9,429.6L419.8,425.9L437.6,424.5L451.3,422L456.4,420.4L457.2,419.4L454.3,418.8L457.1,416.9L465.9,415L471.4,412.1L479.4,413.2L480.9,411.3L487.9,412.6L498.2,412L499.4,413.1L517.4,410.1L521.5,408.6L526.5,408.9L530,411L537.3,408.8L540.9,409L542,409.9L544.3,409L553.5,408.6L559.6,409.1L562.7,410.7L575.3,410.1L588.9,408L594.1,405.1L607.4,408.3L616.6,405.3L629.2,402.8L631.8,403.1L641,400.9L643.9,399.3L651.5,398.2L656.5,398.6L663.2,402L670.6,403.7L673.3,403.8L677.9,402.3L691.4,403.6L693.5,406.9L693.2,408.1L688.4,409.7L688.7,410.7L691.8,410.6L688.7,413.6L694.1,414.7L697.3,414.2L705.2,408.6L715.7,407.5L719.8,404.6L729.9,401.8L741,401.6L744.4,399.2L746.7,401.1L749.1,401.6L766.1,402.2L777,401.9L785.6,397.6L794.9,401.1L806.2,400.5L815.6,398.4L821.1,400.5L832.9,401.9L842.3,399.9L857.8,400.6L874.3,399.2L875.2,396.9L876.9,397.6L879.5,400.7L881.8,401.1L904.1,401L907.3,403.5L913.4,404.8L923.6,406L928.6,405.2L935.6,407.3L942.2,407.9L948.8,410.4L964.7,411L975.6,413.2L970.2,418.2L961.4,420.1L956.2,422.8L954.4,424.8L954.1,426.9L957.6,429.8L962.8,430.1L963.9,431.3L949.3,432.3L943.9,436.9L954.7,440.6L969.1,443L970.6,444.2L981.2,445.7L988.8,445.1L995.2,445.9M0,446.5Z",
  "M898.8,265.2L899.8,267.2L901.6,266.2L903.8,268.3L906.6,278.4L913.5,282.1L915.8,287.1L916.9,286.5L918,287.6L918.7,287.2L919.2,290L924.6,294.6L925.4,296.6L925.3,299.7L926.6,301.8L925.2,309L923.5,313.2L921.4,314.4L917.6,321.2L916.7,325.6L912,326.6L906.4,329.8L902.4,328.2L902.9,326.8L898.9,329.2L890.7,327.2L888.9,325.6L887.7,322.4L883.7,321L884.6,319.8L883.9,317.9L882.5,319.6L880.1,320.1L883,316L882.8,314.1L878.8,317.1L877.7,319.2L875.6,318.1L875.7,316.8L872.5,313.9L873,313.4L864.8,310.5L850.4,312.3L845.1,314.2L843.5,316.6L833,316.8L827.8,319.6L824,319.5L819.5,317.4L819.6,315.9L821.4,315L821.4,310.8L819.6,305.3L814.8,296.7L816,297.8L815.1,295.5L817.3,297.2L815,292.3L817.1,285.6L817.3,287.5L818.5,285.8L824.2,282.9L835.7,280.3L839.6,276.5L839.8,274.1L841.7,271.9L842.9,274.1L844.1,273.6L843.1,272.4L843.9,271.2L845.2,271.7L845.5,269.8L849.1,266.4L850.3,266.7L853,265.3L856.6,268L860.1,268.3L859.5,266.9L862.8,262L868.3,261L868.2,259.7L866.2,258.8L867.7,258.4L875.8,261.3L879.1,260.3L880.4,261.6L877.7,264.1L876.4,268.3L889.5,275.3L891.3,274.4L893.6,268.4L893.1,265L894.8,258.2L895.9,257.3L896.7,258.5L898.7,262.8L898.8,265.2Z",
  "M424.7,16.6L442.1,18.6L437,19.6L412.8,20.4L422.6,20.1L431,21L436.4,20.2L438.7,21.1L435.6,22.6L456.2,20.7L464.5,21.2L466.1,22.3L453.2,24.7L444.3,25.1L450.7,25.2L445.3,28.7L445.4,31.6L448.7,33.3L439.8,34.2L444.9,35.5L445.6,37.7L442.6,37.9L446.2,40.1L440,40.3L443.2,41.4L442.3,42.3L434.5,42.7L438,44.4L438.1,45.5L432.6,44.5L431.1,45.2L438.5,47.4L439.6,49.4L434.6,49.9L429,47.5L430,49.2L426.8,50.5L437.9,50.8L422.9,55L411.7,55.9L405,59.6L389.4,62.7L387,64.3L387,66.1L385.6,67.8L381.1,69.8L382.2,71.8L379.5,76.4L375.6,76.6L371.5,74.5L365.9,74.5L356.6,67.4L354.8,63.4L350.9,61.1L351.9,59.2L350.1,58.3L352.8,55.3L357,54.4L358.7,51.3L351.5,52.9L348.1,52.1L347.9,50.4L349,49L357.3,49.7L350,47.2L344.9,46.9L348,44.5L340.8,39.1L337.2,38.1L337.3,37L329.8,35.5L309.7,35.6L301.7,33.2L314.5,32.3L296.4,30.6L296.8,29.6L317.5,27.1L318.5,26.2L311,25.3L327.1,22.2L326,21L341.1,20L352.7,20.7L360,19.3L376.3,21.3L369.7,19.9L370.1,18.8L379.4,17.3L402.5,16.2L424.7,16.6Z",
  "M0,272.3M996.5,273.5L996.1,272.5L998.4,271.9M0.6,270.9L0,272.3Z",
  "M259.6,43L261.7,44.6L264.3,42.6L271.3,41.5L276.1,44.2L275.7,45.8L283.8,44.1L293.8,46.6L294.2,47.7L299.3,47.1L302.2,48.8L311.3,50.8L314,53.2L308.9,54.4L319.8,56.6L323.8,59L328.2,59.1L327.3,60.9L322.5,63.9L314.7,60.3L311.1,60.7L310.7,62.1L318.6,65.5L320.4,68L319.4,69.8L308.9,67.1L316.2,71.7L302.7,69.2L299.3,68L300.3,67.3L292.1,64.7L292.2,65.5L284.1,65.9L281.8,65L283.6,63.1L294.6,62.7L293.6,61.8L298.2,58L297.4,56.9L292.1,54.8L286.5,53.9L288.3,53.3L280.7,50.7L274.2,51.8L253.7,50.1L251.4,49.2L254.3,48L250.3,48L249.4,45.4L251.6,43.1L254.4,42.1L261.6,41.4L259.6,43Z",
  "M309.7,17.6L323.1,18.1L328.2,18.8L328.1,19.5L312.1,21.7L318.1,21.7L307,24L302.3,26.1L286.4,27.3L290.2,27.6L288.3,28.1L290.6,29.3L278.4,32.7L283.6,33.8L276.2,35.3L251.4,34.6L251.1,33.3L256.2,32.8L254.8,30.9L264,31.8L260.2,30.2L255.7,29.7L262.8,28.1L263.6,27.2L259.7,26.2L258.5,24.9L268.3,25.3L272.6,24.4L256.7,24.2L251.8,23.4L245.6,20.7L262.5,18.8L268.9,19.6L271.1,18.2L279.7,17.6L309.7,17.6Z",
  "M872.6,232.9L873.4,237.1L876.3,238.6L878.6,235.9L881.8,234.4L884.2,234.3L901.6,239.9L905.1,242.5L905.5,244L910.1,245.5L910.8,246.9L908.2,247.2L908.9,248.9L911.3,250.6L913.1,253.3L914.7,253.2L914.6,254.3L918.9,256.3L918.6,257L910.9,255.9L905.7,250.6L902.1,249.5L898,251.1L898.4,253L896.2,253.8L891.8,253.3L889.3,251.2L886.5,250.7L882.3,251.5L883.4,249.4L885.2,248.7L883.1,243.8L875.5,241.4L871.3,239L869.4,240.5L868.8,238.5L866.6,237.2L871.6,236.3L871.4,235.7L867.3,235.7L866.2,234.1L863.7,233.7L862.6,232.4L867.7,230.9L872.2,232L872.6,232.9Z",
  "M827.4,225.3L830.5,227.7L827.3,228L826.4,232.1L823.8,233.8L822.6,240.3L822.2,239.3L819.1,240.5L818,238.9L814.6,238L811.3,238.9L810.3,237.7L806.2,237.5L805.7,234.1L803,231.2L803,226.6L804.6,224.9L806.7,225.7L808.8,225.3L809.4,223.1L813.9,222.1L824.2,212.3L825.4,212.3L826.9,214.7L831.1,216.2L830.9,217.2L829,217.3L829.5,218.6L827.4,219.4L825.9,221.7L827.9,224.2L827.4,225.3Z",
  "M182.9,43.1L181.5,44.3L187.7,43.6L191.5,44.8L194.7,43.5L197.2,44.4L199.5,46.9L200.9,45.8L198.9,43.2L204.1,43.2L207.2,44.3L209.8,48.6L219.5,51L219.2,52.2L214.6,52.4L216.4,53.4L215.5,54.3L205.7,53.2L185.2,54.9L183.7,53.6L177.5,53.2L174.1,51.2L187.7,50.2L172.5,49.7L171,48.8L177.5,47.8L168.3,47.1L172.6,44.2L180,42.6L182.9,43.1Z",
  "M639,264.6L639.9,270.1L639.4,270.9L638.5,269.4L638,270.1L638.3,273.1L630.8,293.7L626.1,295.4L622.3,293.9L620.1,286.4L623.3,281.3L622.1,274.5L623.5,271.4L628.6,270.3L632.5,267.3L633,264.9L634.1,265.2L636.7,260.8L639,264.6Z",
  "M0,47.2M1000,49L996.9,49.1L996.5,48.3M0,47.2Z",
  "M636.4,124.5L637.8,126.3L640,127.1L637.7,127.3L635.7,130.8L636.7,134L641.2,135.8L649.5,135.5L649.7,130.5L647.5,129.6L648.2,127.8L646.4,127.7L647,125.5L649.6,126.2L652,125.3L649.2,122.4L647,123L646.7,124.9L645.8,120.6L642.6,119.8L639.7,116L642.4,116.2L642.5,114.4L647.3,114.3L647.3,110.3L642.2,109.8L636.4,111.4L635.1,112.9L632.4,113.4L629.7,116L632.2,118.4L631.9,120.1L636.4,124.5Z",
  "M793.9,245L790.9,245L785,240.8L775.7,229.5L773.9,225.3L764.9,217.3L764.7,216L770.8,216.6L779.6,224.6L782.4,224.7L788.4,229.7L787.3,231.8L789.9,232.8L791.4,236L793.4,236.2L794.7,237.8L793.9,245Z",
  "M491.7,80.2L488.7,82.9L494.6,82.6L493.8,84.7L491.3,87L494.2,87.1L496.9,90.4L498.8,90.8L501.3,94.7L504.7,95.2L504.3,96.9L502.9,97.6L504,98.9L501.5,100.3L491.8,100.4L490,101.6L487.4,101.3L485.4,102.3L484,101.8L488,99.1L490.5,98.6L486.2,98.2L485.4,97.1L488.3,96.3L486.8,95L487.3,93.3L491.4,93.5L491.8,92L489.9,90.4L486.5,90L485.9,89.3L486.9,88.1L486,87.4L484.5,88.6L484.3,86.2L482.9,84.9L483.9,82.2L486.1,80.2L491.7,80.2Z",
  "M891.6,135.1L890.6,137.1L891,138.4L889.6,140.2L886,141.4L881.2,141.6L877.2,144.5L875.3,143.5L875.2,141.6L863.8,143.4L866.7,145.3L864.8,149.6L863,150.7L861.7,149.7L862.4,147.4L859.5,144.9L862.1,144.1L868.4,139.5L873.9,138.7L876.9,139.2L879.8,134.7L881.6,135.9L887.3,132.3L889,129.2L888.6,126.3L889.7,124.7L892.7,124.3L894.2,127.8L894.1,129.9L891.6,132.4L891.6,135.1Z",
  "M659.8,49.3L649.1,49.2L648.4,48L643.3,47.3L642.9,46L645.8,45.4L645.7,44L651.2,41.8L648.6,41.5L655.3,39.3L654.5,38.1L669.9,35.1L683.9,33.7L689.3,33.4L691.3,34.4L671.1,37.7L662.4,40.1L653.9,45.1L654.5,47.2L659.8,49.3Z",
  "M459.7,60.2L459.1,61.8L462.2,63.6L458.6,65.5L448.2,67.7L436.8,66.5L439.5,65.4L433.5,64.2L438.4,63.7L438.3,62.9L432.4,62.3L434.3,60.7L438.5,60.3L442.8,62L447.1,60.6L450.6,61.4L455.1,60L459.7,60.2Z",
  "M374.6,429.5L378,430.6L379.6,434.5L359.8,437.1L349.5,436.1L350,435L358.4,433.5L364.8,429.5L374.6,429.5Z",
  "M165.4,47.5L158.1,48.8L156.6,47.7L150.2,46.3L155.7,41.7L153,40.1L173.5,40.4L179.1,42.2L168.8,44.7L165.4,46.5L165.4,47.5Z",
  "M258.3,26.4L261.6,27.2L252.7,29.9L247.8,30.1L242,29.8L239,28.7L239.1,27.8L241.3,27.1L236.2,27.2L231.4,25.2L235.2,23.2L238.1,23.1L236.8,22.5L243.3,22.3L246.9,23.7L256.1,24.7L258.3,26.4Z",
  "M237,33L245.5,33.8L247.9,34.6L247.3,35.6L252.3,36.8L274.6,36.5L277.6,37.5L278.2,38.5L272.4,39.8L255.1,39.9L243.3,38.7L242,36.1L239.2,35L230.2,33.9L231.3,32.8L237,33Z",
  "M550.7,26.3L559.8,28.2L552.9,29.2L551.3,31.1L548.9,31.6L547.6,33.7L544.2,33.8L538.2,32.2L540.7,31.3L531.2,28.4L529,26.4L536.6,25.5L538.1,26.4L542.1,26.4L543.1,25.5L547.2,25.4L550.7,26.3Z",
  "M980.6,334.6L981.2,335.6L983.2,334.6L984,335.7L984,336.7L979.7,340.8L980.8,342.1L976.3,343.1L973.9,347.3L970.4,349.2L963,348.1L962.5,347.2L964,345.3L973.7,340L978,334.7L980,333.5L980.6,334.6Z",
  "M847.9,226.4L845.7,228.9L843.6,229.4L833.8,229.4L833.4,231.3L835.9,233.6L837.4,232.4L842.6,231.6L842.4,232.7L841.2,232.4L837.5,234.9L840.1,238.1L839.6,239L842.1,242L842.1,243.6L840.6,244.4L839.5,243.5L840.9,241.4L838.2,242.4L837.5,241.7L837.8,240.7L835.8,239.2L836,236.7L834.2,237.5L834.5,244.1L831.6,243.7L832.4,241.4L831.9,238.9L830.8,238.9L829.9,237.2L833.4,228.6L835.8,226.7L841.5,227.8L844.7,227.7L847.4,225.8L847.9,226.4Z",
  "M344.1,100.5L342.2,102.7L344,101.8L345.9,102.4L344.9,103.3L351.5,104.1L350.6,106L352.5,105.6L353.8,108.5L352.6,110.8L349.5,110.4L350.1,108.3L349.3,108L346.1,110.2L344.5,110.1L346.4,108.9L343.7,108.3L335.4,108.3L334.9,107.6L336.7,106.7L335.5,106L337.8,104.5L340.7,100.4L344.8,98.1L346.1,98.2L344.1,100.5Z",
  "M199.4,35.3L200.5,36.2L205.9,35.9L206.4,37.1L204.7,38.3L184,39.9L183.7,39L189.5,37.9L173,37.8L179.4,34.6L197,37.1L193.1,34.7L195.6,33.7L198.5,34L199.4,35.3Z",
  "M777.6,28.4L771.5,28.7L763.8,28L759.2,27L757.1,25.2L753.3,24.7L760.5,22.9L766.5,22.4L771.9,23.6L778.3,26.1L777.6,28.4Z",
  "M985,322.4L987,325.1L987.1,323.3L988.4,324L988.8,326L991,326.8L992.9,327L994.5,326L995.9,326.3L995.2,328.6L994.4,330.1L992.2,330L991.5,330.8L991.8,331.9L988.9,335.5L986.8,336.5L986.3,335.9L985.1,335.5L986.7,333.4L985.8,332L982.8,331L982.9,330L984.9,329.2L985.4,327.2L985.3,325.5L984.1,323.8L984.2,323.4L980.7,320L979.5,318.2L980.6,318L982.1,319.5L984.2,320.1L985,322.4Z",
  "M309.9,411.3L310.2,412.5L308.9,414.4L302.6,415.3L298.9,415.2L300.3,414.2L293.9,414.9L291.8,414.2L291.6,413.1L296.6,411.8L299.8,411.9L300.6,410.6L300.7,407.6L302.3,406.4L304.9,406L306.3,407L309.9,411.3Z",
  "M311.8,367.6L315.4,369.2L319.3,369.8L318.1,371.1L315.4,371.2L314,370.3L313.1,371.3L310.7,372.1L307.7,371.8L305.7,371.1L302.8,370.7L299.3,369.3L296.4,367.9L292.6,365L294.9,365.6L298.8,367.3L302.5,368.2L303.9,367L304.8,365.3L307.4,364.2L309.4,364.5L311.8,367.6Z",
  "M801.7,247.3L807.1,247.6L807.7,246.5L812.8,247.8L813.8,249.4L818,249.9L821.4,251.4L818.2,252.4L815.2,251.3L809.8,251.2L801.9,249.5L800.8,249.8L795.7,248.8L795.2,247.7L792.7,247.5L794.6,245.1L798,245.2L801.3,246.4L801.7,247.3Z",
  "M899,100.3L901.8,104.8L897.7,104L896,107.7L898.7,110.3L898.6,112.1L896.5,110.6L894.7,112.5L894.2,110.4L894.5,107.9L894.2,105.1L894.8,103.2L894.9,99.8L893.3,97.3L893.6,93.8L896.1,92.6L895,91.4L896.3,91.1L897.9,95.2L897.9,97.7L899,100.3Z",
  "M278.7,171.8L279.8,172.8L282.4,172.5L287.4,175.8L290,176.3L289.8,177L291.9,177.1L294,178.2L293.6,178.8L291.8,179.1L284,179.3L285.9,177.8L284.7,177.2L283,177L282,176.3L281.3,174.8L279.8,174.9L277.2,174.2L276.3,173.7L272.7,173.3L271.8,172.8L272.8,172.2L270.1,172L268.1,173.3L266.9,173.4L266.5,174L265.1,174.3L264,174L265.4,173.3L266,172.3L267.3,171.8L271.5,170.7L276.1,171L278.7,171.8Z",
  "M899.7,117.1L901.7,117.7L903.7,116.6L904.3,119.4L900.2,120.1L897.7,122.7L893.4,120.9L891.8,123.7L888.8,123.8L888.4,121.2L889.8,119.3L892.7,119.1L893.5,115.6L894.4,113.6L897.6,116.3L899.7,117.1Z",
  "M837,182.7L838.7,183.4L839.6,182.8L839.8,183.4L839.4,184.5L840.3,186.3L839.6,188.4L837.9,189.3L837.5,191.3L838.1,193.4L839.6,193.7L840.8,193.4L844.3,194.8L844,196.2L844.9,196.8L844.7,198L842.5,196.7L841.5,195.4L840.8,196.3L839,194.8L836.5,195.1L835.1,194.6L835.2,193.5L836.1,192.9L835.3,192.3L834.9,193.2L833.5,191.7L833.1,190.6L833,188.2L834.1,189L834.4,185L835.3,182.7L837,182.7Z",
  "M481.1,96.4L476.2,98L472.3,97.6L474.5,94.9L473.1,92.3L479,89.1L481.3,89L484.3,90.6L482.8,92.3L483.2,94.2L481.1,96.4Z",
  "M221.2,41.3L224.5,41.8L229.5,41.5L230.2,42.2L227.6,43.5L231.8,44.6L231.3,46.9L226.8,47.9L224.1,47.6L222.2,46.7L215.3,44.7L215.3,43.9L221,44.2L217.9,42.5L221.2,41.3Z",
  "M903,36.9L900.8,38.8L890.6,38.7L886,39.3L880.5,37.7L882,35.9L885.6,35.4L893,35.5L903,36.9Z",
  "M851,208.5L851.5,211.6L850.5,214L849.5,211.4L848.2,212.7L849.1,214.5L848.3,215.7L845.1,214.3L844.3,212.4L845.1,211.2L843.4,210L842.5,211L841.2,210.9L839.1,212.4L838.7,211.6L839.8,209.5L843,207.8L844,208.9L846.1,208.2L846.6,207.1L848.5,207L848.4,205.1L850.6,206.3L851,208.5Z",
  "M570.7,24.5L576.1,25.4L572,26.8L564,27.1L555.8,26.7L555.3,26L551.3,25.9L548.2,24.7L556.8,24L560.9,24.6L563.7,23.9L570.7,24.5Z",
  "M263.4,62.2L264,63.3L265.4,62.9L273.2,65.3L273.5,66.5L275.5,66.3L277.5,67.1L275,68L270.7,67.3L269.1,66.2L266.4,67.5L262.4,68.9L261.5,67.4L257.7,67.6L260.1,66.4L260.5,64.3L261.4,62L263.4,62.2Z",
  "M903.9,334.2L906.6,335.1L910.2,334.3L911.9,334.5L912.1,337.5L911.2,338.4L910.9,340.4L909.9,339.7L908,341.5L905.7,341.3L904,339.1L903.6,337.4L902,335.2L902.1,334L903.9,334.2Z",
  "M241.1,44L238.1,45.9L235,45.8L233.2,43.6L233.3,42.3L234.7,41.2L237.5,40.5L243.3,40.6L248.6,41.3L244.4,43.5L241.1,44Z",
  "M298.4,179.2L300.8,179.6L301.1,179.2L303.3,179.2L305,179.9L305.7,179.8L306.2,180.7L307.7,180.6L307.6,181.4L308.9,181.5L310.2,182.4L309.2,183.5L307.9,182.9L305.7,182.9L305.2,183.4L304.1,183.5L303.7,182.9L302.8,183.3L301.7,185L301,184.6L300.8,183.9L299,183.5L296,183.4L294.7,183.9L293.2,183.1L293.4,182.3L298.1,182.9L299.1,182.3L297.8,181.2L297.8,180.2L296.1,179.8L296.7,179.1L298.4,179.2Z",
  "M226.4,33.9L228.5,35.1L228.6,36.4L227.3,38.3L222.8,38.6L219.8,38.2L219.8,36.7L215.3,36.9L215.1,34.9L218.1,35L222.3,34.1L226.2,34.3L226.4,33.9Z",
  "M177.2,31.6L176.8,33.5L174.7,34.4L172.1,34.5L166.9,35.6L162.5,36L158.7,35.5L163.5,33.6L169.2,31.9L173.4,32L177.2,31.6Z",
  "M725.6,214.2L723.2,214.7L721.9,212.7L721.4,209L722.6,204.9L724.6,206.3L727.2,210.8L726.8,213.4L725.6,214.2Z",
  "M791.9,29.9L776.2,30.9L781.3,27.5L783.6,27.2L792.7,28.8L791.9,29.9Z",
  "M334.5,434.5L332.9,437L327.1,436.7L320.9,436.8L317.4,435.9L315.9,435.1L328.1,435.4L331.6,433.5L334.5,434.5Z",
  "M156.9,106L155.5,106.4L151,105.2L150.1,104.3L147.6,103.4L147.1,102.7L144.3,102.2L143.2,100.8L143.5,100.3L150.7,101.5L153,103.6L155.8,104.6L156.9,106Z",
  "M222.1,29.8L223.1,30.9L218.6,30.6L214,29.8L207.8,29.7L210.5,28.9L207.2,28.3L207,27.3L219.9,28.6L222.1,29.8Z",
  "M57.8,433.2L52.4,433.5L48.8,432.6L45.2,430.9L46.9,429.9L52.1,430.3L57,432L57.8,433.2Z",
  "M287.9,43.2L288.2,43.9L282.2,43.8L279.2,44.1L275.3,42.6L275.5,41.7L276.8,41.5L283.2,41.8L287.9,43.2Z",
  "M922.2,244L920.7,244.2L920.3,244.9L917.3,246.1L915.9,246.1L912,244.7L912.2,243.9L914.7,244.3L916.2,244.1L916.7,242.8L917.1,242.8L917.3,244.1L918.9,243.9L919.7,243.1L921.2,242.2L920.9,240.7L922.6,240.6L923.2,241L923.1,242.4L922.2,244Z",
  "M836.6,171.8L835.4,173.9L833.9,171.7L833.6,169.8L835.3,167.3L837.5,165.4L838.8,166.1L836.6,171.8Z",
  "M225.1,413.8L228.1,414.2L231.1,413.9L232.8,415.3L220,415.3L217.2,414.8L215.8,413.7L217.5,413.3L225.1,413.8Z",
  "M806.5,182.3L804.1,183.5L801.8,182.7L801.7,180.5L803.1,179.3L806.1,178.6L807.7,178.7L808.4,179.7L807.1,180.8L806.5,182.3Z",
  "M234.3,53.4L232.6,54.3L228.8,53.5L226.6,53.8L222.8,52.6L225.2,51.9L227.2,50.7L231.8,51.9L234.3,53.4Z",
  "M543.1,132.3L542.1,134.3L542.5,135.1L541.9,136.4L539.8,135.5L534.5,133.9L534.9,132.6L538.2,132.8L543.1,132.3Z",
  "M525.6,124.7L527.2,126.5L526.9,129.9L525.6,129.7L524.5,130.6L523.4,129.9L523.3,126.8L522.7,125.3L524.2,125.5L525.6,124.7Z",
  "M845.7,255.9L843.3,256.5L842.9,256.2L843.2,255.3L844.4,253.7L847.1,252.7L847.5,252.1L852.7,251.1L853.7,251.5L852.7,252.2L847.5,254L845.7,255.9Z",
  "M642,24.2L635.8,24.7L635.4,25.1L632.2,25.5L629.2,24.9L630.8,24.1L624.6,24L634.2,23.6L634.8,24.2L636.4,23.6L639,23.2L643.1,23.8L642,24.2Z",
  "M240,38.4L238.5,39.4L234.4,39.2L231.1,38.5L232.5,37.4L236.5,36.7L239,37.6L240,38.4Z",
  "M568.7,31L562.5,32.1L557.6,31.5L559.5,30.8L557.8,30L563.6,29.5L564.7,30.5L568.7,31Z",
  "M233.8,30.5L229.7,31.1L227.4,30.5L226.2,29.5L226,28.4L231.2,28.7L234.6,29.6L233.8,30.5Z",
  "M337.4,360.6L339.6,361.7L338.8,362.6L335,363.4L333.8,362.5L331.4,363.7L330,362.5L333.3,361L335.7,361.6L337.4,360.6Z",
  "M857.5,227.1L857.3,229.3L855.9,229.1L855.5,230.6L856.6,232L855.8,232.3L854.7,230.7L853.9,227.4L854.4,225.4L855.4,224.4L855.6,225.8L857.2,226.1L857.5,227.1Z",
  "M964.2,286.6L963.2,287.2L959.6,285.4L956,282.2L955.6,281.4L956.8,281.4L958.4,282.3L964.2,286.6Z",
  "M918.7,38.1L915.5,39.1L911,38.9L905.9,37.9L906.5,37.1L918.7,38.1Z",
  "M874,142.7L874.3,143.6L872.8,145.2L871.6,144.3L870.2,144.9L869.5,146.4L867.7,145.7L867.7,144.5L869.2,143L870.8,143.3L872,142.2L874,142.7Z",
  "M289.3,58.4L286.1,58.5L285.5,57.3L286.6,55.8L289.2,55.5L291.4,56.2L291.4,57.3L291.1,57.6L289.3,58.4Z",
  "M75,84L72.2,85L70.8,84.4L70.4,83.2L74.4,81.9L76.2,82L77.4,82.8L75,84Z",
  "M848.6,198.9L849.4,201.8L847.3,201.1L848,203.5L846.7,204.1L846.6,202.3L845.7,202.2L845.3,200.6L846.9,200.8L846.9,199.9L845.2,197.9L847.8,198L848.6,198.9Z",
  "M193.9,31.4L188.7,32.2L184.6,31.3L186.9,30.5L190.9,30.3L194.9,30.7L193.9,31.4Z",
  "M844.4,203.7L843.4,204.6L842.5,206.2L841.7,206.9L839.9,205.2L841.2,203.8L841.5,202.2L843,202L842.6,203.8L844.7,201.3L844.4,203.7Z",
  "M898.9,42.9L888.5,42.5L891.1,41.5L894.6,41.3L898.6,42.2L898.9,42.9Z",
  "M131.4,91.9L134,91.7L133.2,94.6L135.6,96.6L134.5,96.6L132.8,95.5L131.8,94.3L130.4,93.5L129.9,92.4L130.1,91.6L131.4,91.9Z",
  "M163.3,417.8L166.9,418.2L170.2,417.8L168.6,418.7L166,419.3L162.2,419.1L159.4,418.2L160,417.4L163.3,417.8Z",
  "M862.4,237.9L863.4,239.9L861.1,238.8L855.3,238.7L855.9,237.3L859.4,237.2L862.4,237.9Z",
  "M695.2,357L691,357.2L690.9,355.8L691.5,354.3L693.3,355.1L695.9,355.4L696,355.9L695.2,357Z",
  "M535.2,87.9L533.6,90L530.7,88.5L530.3,87.4L534.4,86.6L535.2,87.9Z",
  "M841.4,250.7L841,252.1L836.8,252.8L833.1,252.5L833.1,251.6L835.3,251.1L837.1,251.8L838.9,251.6L841.4,250.7Z",
  "M0,47.2L0.4,47.1L2.7,47.1L6.7,47.9L6.5,48.2L3.6,48.8L0,49L0,47.2Z",
  "M827.5,250.7L828.5,251.4L830.2,251.2L830.9,252.2L825.8,253.1L824.3,253.1L825.2,251.6L826.8,251.6L827.5,250.7Z",
  "M209.7,42.4L207.3,44.1L202.9,42.3L203.9,41.9L207.6,41.8L209.7,42.4Z",
  "M829.2,206.2L825.5,208.6L826.8,206.8L828.8,205.3L830.5,203.5L832,200.9L832.5,203L830.6,204.4L829.2,206.2Z",
  "M286.4,184.3L285.5,184.8L284,184.4L282.4,183.4L282.7,182.8L283.9,182.7L286.4,183L287.9,183.6L288.3,184.3L286.4,184.3Z",
  "M526.6,122.3L525.6,124.3L524.4,123.7L523.7,122L524.3,121.1L526.1,120.1L526.6,122.3Z",
  "M272.5,69.7L269.3,71.1L267.3,71.1L266.7,70.4L268.8,69.2L272.6,69.2L272.5,69.7Z",
  "M23,67L24.7,67.5L26.4,67.2L28.7,67.9L31.4,68.2L31.2,68.5L29.1,69.1L27,68.5L25.9,68L23.5,68.2L22.8,68L23,67Z",
  "M838.6,199.6L840.2,200.4L842,200.4L841.9,201.5L840.7,202.5L838.9,203.3L838.8,202.1L839,200.8L838.6,199.6Z",
  "M925.4,241.5L924.5,242.2L924,240.7L923.3,239.7L920.5,237.8L918.5,237L919.3,236.4L922.9,238.3L924,239.4L925.1,240.2L925.4,241.5Z",
  "M596,138.8L594.2,139.9L594.5,140.6L591.6,141.7L590.2,141.3L589.6,140.3L591.1,140.2L591.5,139.6L593.5,139.6L596,138.8Z",
  "M995.5,274.3L996.4,275.1L996,276.4L994.3,276.7L992.7,276.4L992.5,275.3L993.5,274.4L994.8,274.7L995.5,274.3Z",
  "M328.3,104.5L327,104.6L323.4,103.8L320.8,102.5L321.7,102.3L325.4,103L328.2,104L328.3,104.5Z",
  "M67.9,181.2L67.5,181.7L66.8,181.3L66.9,180.6L66.5,179.6L66.6,179.4L67.1,178.9L66.9,178.4L67.1,178.2L68.8,178.9L69.3,179.2L70,180.1L69.9,180.3L67.9,181.2Z",
  "M565.8,138.8L567.4,139.6L569.5,139.5L571.6,139.6L571.5,140.1L573,139.8L572.7,140.5L568.7,140.8L568.7,140.3L565.3,139.8L565.8,138.8Z",
  "M933,247.4L932.2,247.7L931,246.7L929.8,245.1L929.2,243.1L929.6,242.9L929.9,243.6L930.7,244.2L932.1,245.8L933.4,246.7L933,247.4Z",
  "M323.2,111L325.2,111.4L327.7,111.3L326.4,112.4L325.4,112.5L321.8,111.4L321.1,110.6L322.2,109.8L323.2,111Z",
  "M835.3,256.2L834.1,256.2L830.5,254.4L833.1,253.9L834.5,254.7L835.5,255.5L835.3,256.2Z",
  "M195.4,29.1L192,29.6L187.4,29.6L187.4,29.3L190.3,28.5L195.4,29.1Z",
  "M317.8,183.4L317.1,184.1L313.4,184.1L313.2,183L313.6,182.7L315.9,182.7L317.3,182.9L317.8,183.4Z",
  "M837.6,196.6L836.8,198.8L835.6,197.5L834.2,195.6L836.6,195.7L837.6,196.6Z",
  "M40.1,76.9L38.4,77.3L36.5,76.8L34.9,76.1L37.6,75.7L39.8,75.9L40.1,76.9Z",
  "M284.6,169.3L283.9,169.4L283.2,167.9L282.2,167.2L282.8,165.6L283.6,165.7L284.6,167.8L284.6,169.3Z",
  "M239.3,31.9L238.1,32L232.9,31.8L232.1,31.1L237.7,31.1L239.7,31.6L239.3,31.9Z",
  "M151.2,417.8L155.5,418.8L150.2,418.4L146.4,417.7L148.5,417.2L151.2,417.8Z",
  "M330.7,204.2L328.4,204.4L327.9,204.2L328.7,203.5L328.7,202.5L330.3,202.2L330.8,202.3L330.7,204.2Z",
  "M853.5,238.8L852.4,239.7L850.5,239.2L850,238.1L852.8,238L853.5,238.8Z",
  "M279.8,71.2L278.7,72.5L277.5,72.3L276.8,71.5L278,70.6L279.1,70.6L279.8,71.2Z",
  "M944.1,251.3L944.2,251.8L942,250.7L940.5,249.8L939.5,249L939.9,248.7L941.2,249.3L943.4,250.5L944.1,251.3Z",
  "M874.2,245.9L872.8,247.6L872.5,245.7L873.6,243.9L874.2,244.7L874.2,245.9Z",
  "M946.8,255.2L945.7,255.3L944,255L943.4,254.6L943.6,253.6L945.4,254L946.4,254.6L946.8,255.2Z",
  "M949.1,254.5L948.7,255L946.6,252.8L946.1,251.3L947,251.3L948,253.3L949.1,254.5Z",
  "M964.2,268.2L964.6,270.2L963.9,269.9L963.3,270L962.9,269.3L962.9,267.4L964.2,268.2Z",
  "M283.8,162.1L280.8,162.5L280.6,161.5L281.9,161.3L283.8,161.4L283.8,162.1Z",
  "M950.3,256.8L951.1,257.7L949.2,257.7L948.1,256.1L949.8,256.7L950.3,256.8Z",
  "M286.1,162L285.6,163.9L285.1,163.5L285.2,162.2L283.9,161.2L283.9,160.9L286.1,162Z",
];

function MapTitle() {
  return (
    <div className="px-5 pt-4 pb-2">
      <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 600, color: C.ivory, letterSpacing: 0.2, lineHeight: 1.4 }}>
        The Artium Network <span style={{ color: C.ivoryDim, fontWeight: 400 }}>— Bridging Musicians Worldwide</span>
      </h3>
    </div>
  );
}

const TILE_URL = "https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";
const TILE_SUBDOMAINS = ["0", "1", "2", "3"];
const TILE_ATTRIBUTION = '&copy; <a href="https://www.google.com/maps" target="_blank" rel="noreferrer">Google</a>';

function consPinIcon({ active, hasStudents, hasTeacher }) {
  const w = active ? 18 : 14;
  const h = Math.round(w * 1.28);
  const pinColor = hasTeacher ? "#C0392B" : hasStudents ? "#27AE60" : "#ffffff";
  const strokeColor = hasTeacher ? "#8B1A1A" : hasStudents ? "#1E8449" : "#aaaaaa";
  const glow = active
    ? `filter:drop-shadow(0 0 6px ${pinColor}99) drop-shadow(0 2px 3px rgba(0,0,0,0.7));`
    : `filter:drop-shadow(0 1px 3px rgba(0,0,0,0.5));`;
  return L.divIcon({
    className: "artium-pin",
    html: `
      <div style="position:relative; width:${w}px; height:${h}px; ${glow}">
        <svg width="${w}" height="${h}" viewBox="0 0 24 30" style="display:block;">
          <path d="M12 0C5.4 0 0 5 0 11.4 0 19.6 12 30 12 30s12-10.4 12-18.6C24 5 18.6 0 12 0z"
            fill="${pinColor}" stroke="${strokeColor}" stroke-width="1.5" />
          <circle cx="12" cy="11.5" r="4" fill="${pinColor === "#ffffff" ? "#1a1a1a" : "white"}" opacity="0.9" />
        </svg>
      </div>
    `,
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
  });
}

// The roster shown when a conservatory is picked. Shared by the flat map's
// Leaflet popup and the globe's overlay panel so the two cannot drift apart.
function ConsRosterCard({ cons, roster, canViewRoster, onOpenStudent, onLockedClick, maxListHeight = 165 }) {
  if (!canViewRoster) {
    return (
      <div style={{ fontFamily: FONT_BODY, minHeight: 100, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, padding: "2px 0" }}>
        <Lock size={16} color={C.ivoryDim} />
        <p style={{ fontSize: 12, color: C.ivoryDim, margin: 0 }}>Sign up to see who studies here</p>
        <button
          onClick={() => onLockedClick && onLockedClick()}
          style={{ fontSize: 12, fontWeight: 700, color: C.brassText, background: C.brass, border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}
        >
          Create an account
        </button>
      </div>
    );
  }
  return (
    <div style={{ fontFamily: FONT_BODY, minWidth: 230 }}>
      <div style={{ borderBottom: `1px solid ${C.inkLine}`, paddingBottom: 8, marginBottom: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: C.ivory, margin: 0 }}>{cons.short}</p>
        <p style={{ fontSize: 11, color: C.ivoryDim, margin: "2px 0 0" }}>{roster.length} student{roster.length === 1 ? "" : "s"}</p>
      </div>
      {roster.length === 0 ? (
        <p style={{ fontSize: 12, color: C.ivoryDim, margin: 0 }}>No students yet.</p>
      ) : (
        <div className="lg-scroll" style={{ maxHeight: maxListHeight, overflowY: "auto" }}>
          {[...roster]
            .sort((a, b) => Number(!!b.teaching?.open) - Number(!!a.teaching?.open))
            .map((s) => (
              <button
                key={s.id}
                onClick={() => onOpenStudent(s.id)}
                style={{
                  width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 10,
                  padding: "7px 4px", background: "transparent", border: "none", cursor: "pointer", borderRadius: 8,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.16)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <Avatar name={s.name} id={s.id} size={32} photoUrl={s.photoUrl} online={s.online} />
                <div className="min-w-0">
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.ivory, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.name}
                  </p>
                  {s.teaching?.open ? (
                    <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.brassLabel }}>{instrumentLabel(s)}</span>
                      <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", background: C.brass, color: C.brassText, padding: "1px 6px", borderRadius: 999 }}>
                        teaches
                      </span>
                      {s.teaching.price != null && (
                        <span style={{ fontSize: 11, color: C.ivoryDim }}>· €{s.teaching.price}</span>
                      )}
                    </p>
                  ) : (
                    <p style={{ fontSize: 11, color: C.ivoryDim, fontWeight: 400, margin: 0 }}>{instrumentLabel(s)}</p>
                  )}
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

// The Mercator world is square — 256 * 2^z px on both axes — but these map
// frames are much wider than they are tall. Fit the world to the container's
// WIDTH so all 360° of longitude shows exactly once: fitting the height
// instead leaves the world narrower than the frame, and Leaflet fills the
// leftover space by repeating the map. The frame then crops top and bottom,
// which is the half of a Mercator projection worth losing anyway.
function FitWorldToWidth() {
  const map = useMap();
  useEffect(() => {
    const apply = () => {
      const w = map.getSize().x;
      if (!w) return;
      const z = Math.log2(w / 256);
      if (!Number.isFinite(z)) return;
      map.setMinZoom(z);
      if (map.getZoom() < z - 1e-6) map.setZoom(z, { animate: false });
    };
    // A single measurement on mount is unreliable — the container frequently
    // has no width yet at that point, leaving the map at zoom 1 with the world
    // narrower than the frame. Observing the element covers both the initial
    // layout and later resizes.
    // Deferred by a tick: Leaflet does its own work in response to
    // invalidateSize, and re-fitting inside that same turn gets overwritten.
    let queued = 0;
    const ro = new ResizeObserver(() => {
      map.invalidateSize();
      clearTimeout(queued);
      queued = setTimeout(apply, 0);
    });
    ro.observe(map.getContainer());
    map.on("resize", apply);
    apply();
    return () => { ro.disconnect(); clearTimeout(queued); map.off("resize", apply); };
  }, [map]);
  return null;
}

/* ---------------------------------------------------------------- */
/* GLOBE                                                            */
/* ---------------------------------------------------------------- */
// react-globe.gl needs explicit pixel dimensions — it will not derive them
// from a percentage-sized parent — so the wrapper is measured and the numbers
// are handed down.
function useMeasured() {
  const ref = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}

// Rough centroids, purely for orientation — without them the globe is a
// featureless sphere the moment you spin away from a coastline you recognise.
// OrbitControls does 60/speed seconds per revolution, so these two are a pair:
// one full turn, then still.
const GLOBE_SPIN_MS = 20000;   // one full revolution on arrival, then still

const GLOBE_CONTINENTS = [
  { label: "NORTH AMERICA", lat: 46, lng: -100 },
  { label: "SOUTH AMERICA", lat: -14, lng: -59 },
  { label: "EUROPE", lat: 52, lng: 17 },
  { label: "AFRICA", lat: 3, lng: 21 },
  { label: "ASIA", lat: 46, lng: 89 },
  { label: "OCEANIA", lat: -25, lng: 134 },
];

function GlobeMap({ selectedId, onSelect, studentsByCons, height = 640, onOpenStudent, canViewRoster = false, onLockedClick, extraCons = [] }) {
  // Built-in schools plus any established from an approved document. Only
  // geocoded ones can be placed, so the rest are filtered out rather than
  // landing at 0,0 in the Gulf of Guinea.
  const ALL_CONS = React.useMemo(
    () => [...CONSERVATORIES, ...extraCons.filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng))],
    [extraCons],
  );
  const [wrapRef, { w, h }] = useMeasured();
  const globeRef = useRef(null);
  // A phone frame is narrow and short: keeping the desktop height and camera
  // distance pushed the globe well past the viewport.
  const compact = w > 0 && w < 700;
  const frameHeight = compact ? 380 : height;

  const allStudents = Object.values(studentsByCons).flat();
  const totalTeachers = allStudents.filter((s) => s.teaching && s.teaching.open).length;
  const pinned = ALL_CONS.filter((c) => (studentsByCons[c.id] || []).length > 0);
  const cons = ALL_CONS.find((c) => c.id === selectedId);
  const roster = selectedId ? studentsByCons[selectedId] || [] : [];

  // onGlobeReady is the only reliable signal that the three.js scene exists.
  // Calling pointOfView or controls() before it lands is silently dropped,
  // which is why the phone kept ending up at the desktop camera distance on
  // some loads and not others.
  const [ready, setReady] = useState(false);
  // Read inside the timeout below without restarting the intro.
  const selectedRef = useRef(null);
  selectedRef.current = selectedId;

  useEffect(() => {
    if (!ready) return;
    const controls = globeRef.current.controls();
    controls.enableZoom = true;
    // The texture is 4096x2048. Closer than ~165 and you are magnifying pixels,
    // so the floor sits where detail actually runs out rather than letting the
    // user zoom into blur.
    controls.minDistance = 165;
    controls.maxDistance = 520;
  }, [ready]);

  // One full revolution on arrival to show the globe is live and draggable,
  // then it holds still.
  //
  // Done with two animated pointOfView calls rather than the obvious routes,
  // both of which were tried and neither of which moves this scene:
  // OrbitControls.autoRotate does nothing (forcing it true leaves
  // getAzimuthalAngle() pinned at 0, since nothing calls controls.update() per
  // frame), and per-frame pointOfView writes with duration 0 get overridden.
  // The animated form is the path that demonstrably works — it is what swings
  // the globe round to a pin. Two halves because a single +360 request has the
  // same bearing as standing still.
  useEffect(() => {
    if (!ready) return;
    const g = globeRef.current;
    const { lat, lng, altitude } = g.pointOfView();
    const half = GLOBE_SPIN_MS / 2;
    g.pointOfView({ lat, lng: lng + 180, altitude }, half);
    const t = setTimeout(() => {
      // Skip the second half if a pin was picked meanwhile; that has its own
      // camera move and should not be fought.
      if (!selectedRef.current) g.pointOfView({ lat, lng: lng + 360, altitude }, half);
    }, half);
    return () => clearTimeout(t);
  }, [ready]);

  // A narrow phone viewport needs the camera further back or the sphere
  // overflows its frame.
  useEffect(() => {
    if (!ready) return;
    globeRef.current.pointOfView({ lat: 20, lng: 10, altitude: compact ? 2.7 : 1.6 }, 0);
  }, [ready, compact]);

  // Bring the picked conservatory round to face the camera.
  useEffect(() => {
    if (!ready || !cons) return;
    globeRef.current.pointOfView({ lat: cons.lat, lng: cons.lng, altitude: compact ? 2.4 : 1.7 }, 900);
  }, [ready, cons, compact]);

  const markers = pinned.map((c) => ({
    ...c,
    hasTeacher: (studentsByCons[c.id] || []).some((s) => s.teaching && s.teaching.open),
  }));

  return (
    <div
      ref={wrapRef}
      className="artium-globe"
      style={{ width: "100%", height: frameHeight, position: "relative", background: C.inkSoft, overflow: "hidden" }}
    >
      {w > 0 && h > 0 && (
        <Suspense fallback={
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_BODY, fontSize: 12, color: C.ivoryDim }}>
            Loading globe…
          </div>
        }>
        <Globe
          ref={globeRef}
          width={w}
          height={h}
          onGlobeReady={() => setReady(true)}
          globeImageUrl="/earth-blue-marble.jpg"
          backgroundColor="rgba(0,0,0,0)"
          atmosphereColor={C.brass}
          atmosphereAltitude={0.18}
          showGraticules
          labelsData={GLOBE_CONTINENTS}
          labelLat="lat"
          labelLng="lng"
          labelText="label"
          labelSize={compact ? 1.5 : 1.1}
          labelDotRadius={0}
          labelColor={() => "rgba(255,255,255,0.75)"}
          labelResolution={2}
          labelAltitude={0.008}
          htmlElementsData={markers}
          htmlLat="lat"
          htmlLng="lng"
          htmlAltitude={0.01}
          htmlTransitionDuration={0}
          htmlElement={(d) => {
            const el = document.createElement("div");
            el.style.cssText = "cursor:pointer; pointer-events:auto; transform:translate(-50%,-100%);";
            el.title = `${d.name} — ${(studentsByCons[d.id] || []).length} student(s)`;
            const fill = d.hasTeacher ? "#C0392B" : "#2E7D50";
            const active = d.id === selectedId;
            el.innerHTML = `
              <svg width="${active ? 26 : 20}" height="${active ? 33 : 25}" viewBox="0 0 24 30">
                <path d="M12 0C5.4 0 0 5 0 11.4 0 19.6 12 30 12 30s12-10.4 12-18.6C24 5 18.6 0 12 0z"
                  fill="${fill}" stroke="${active ? C.brass : "#ffffff"}" stroke-width="${active ? 2.5 : 1.5}" />
                <circle cx="12" cy="11.5" r="4" fill="white" opacity="0.9" />
              </svg>`;
            el.onclick = () => onSelect(d.id);
            return el;
          }}
        />
        </Suspense>
      )}

      {cons && (
        <div
          style={{
            position: "absolute", top: 12, left: 12, width: 268, zIndex: 5,
            background: "rgba(176,146,98,0.05)", border: `1px solid ${C.inkLine}`, borderRadius: 12,
            boxShadow: "0 8px 32px rgba(0,0,0,0.55)", padding: "10px 12px",
          }}
        >
          <button
            onClick={() => onSelect(null)}
            title="Close"
            style={{
              position: "absolute", top: 6, right: 6, width: 22, height: 22, display: "flex",
              alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.2)",
              border: "none", borderRadius: "50%", cursor: "pointer", color: C.ivoryDim,
            }}
          >
            <X size={13} />
          </button>
          <ConsRosterCard
            cons={cons} roster={roster} canViewRoster={canViewRoster}
            onOpenStudent={onOpenStudent} onLockedClick={onLockedClick}
            maxListHeight={Math.max(140, frameHeight - 220)}
          />
        </div>
      )}

      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 4,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        background: "rgba(176,146,98,0.05)", borderTop: `1px solid ${C.inkLine}`, padding: "7px 12px", pointerEvents: "none",
      }}>
        {/* Same two pin marks the flat map's legend used — without them the
            colours on the globe have nothing to key against. */}
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.ivoryDim, fontFamily: FONT_BODY, whiteSpace: "nowrap" }}>
          <svg width="10" height="13" viewBox="0 0 24 30" style={{ flexShrink: 0 }}>
            <path d="M12 0C5.4 0 0 5 0 11.4 0 19.6 12 30 12 30s12-10.4 12-18.6C24 5 18.6 0 12 0z" fill="#2E7D50" stroke="#ffffff" strokeWidth="1.5" />
            <circle cx="12" cy="11.5" r="4" fill="white" opacity="0.9" />
          </svg>
          <svg width="10" height="13" viewBox="0 0 24 30" style={{ flexShrink: 0 }}>
            <path d="M12 0C5.4 0 0 5 0 11.4 0 19.6 12 30 12 30s12-10.4 12-18.6C24 5 18.6 0 12 0z" fill="#C0392B" stroke="#ffffff" strokeWidth="1.5" />
            <circle cx="12" cy="11.5" r="4" fill="white" opacity="0.9" />
          </svg>
          {compact
            ? `(${pinned.length}) conservatories`
            : `(${pinned.length}) conservator${pinned.length !== 1 ? "ies" : "y"} · drag to spin`}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.ivoryDim, fontFamily: FONT_BODY, whiteSpace: "nowrap" }}>
          <svg width="10" height="13" viewBox="0 0 24 30" style={{ flexShrink: 0 }}>
            <path d="M12 0C5.4 0 0 5 0 11.4 0 19.6 12 30 12 30s12-10.4 12-18.6C24 5 18.6 0 12 0z" fill="#C0392B" stroke="#ffffff" strokeWidth="1.5" />
            <circle cx="12" cy="11.5" r="4" fill="white" opacity="0.9" />
          </svg>
          {compact
            ? `(${totalTeachers}) teaching`
            : `includes (${totalTeachers}) student${totalTeachers !== 1 ? "s" : ""} open to teaching`}
        </span>
      </div>
    </div>
  );
}

function WorldMap({ selectedId, onSelect, studentsByCons, height = "100%", interactive = false, flatTop = false, onOpenStudent, canViewRoster = false, onLockedClick }) {
  const allStudents = Object.values(studentsByCons).flat();
  const totalJoined = allStudents.length;
  const totalTeachers = allStudents.filter(s => s.teaching && s.teaching.open).length;
  const pinnedCons = CONSERVATORIES.filter(c => (studentsByCons[c.id] || []).length > 0).length;
  return (
    <div className="artium-map" style={{ width: "100%", height, position: "relative", ...(flatTop ? { borderRadius: 0 } : {}) }}>
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        zIndex: 1000, display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8,
        background: C.parchment,
        borderTop: "1px solid #E6EBF1",
        padding: "7px 12px",
        pointerEvents: "none",
        flexWrap: "wrap",
        rowGap: 3,
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.ivoryDim, fontFamily: FONT_BODY, whiteSpace: "nowrap" }}>
          <svg width="10" height="13" viewBox="0 0 24 30" style={{ flexShrink: 0 }}>
            <path d="M12 0C5.4 0 0 5 0 11.4 0 19.6 12 30 12 30s12-10.4 12-18.6C24 5 18.6 0 12 0z" fill="#27AE60" stroke="#1E8449" strokeWidth="1.5" />
            <circle cx="12" cy="11.5" r="4" fill="white" opacity="0.9" />
          </svg>
          <svg width="10" height="13" viewBox="0 0 24 30" style={{ flexShrink: 0, marginLeft: -2 }}>
            <path d="M12 0C5.4 0 0 5 0 11.4 0 19.6 12 30 12 30s12-10.4 12-18.6C24 5 18.6 0 12 0z" fill="#C0392B" stroke="#8B1A1A" strokeWidth="1.5" />
            <circle cx="12" cy="11.5" r="4" fill="white" opacity="0.9" />
          </svg>
          ({pinnedCons}) conservator{pinnedCons !== 1 ? "ies" : "y"}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.ivoryDim, fontFamily: FONT_BODY, whiteSpace: "nowrap" }}>
          <svg width="10" height="13" viewBox="0 0 24 30" style={{ flexShrink: 0 }}>
            <path d="M12 0C5.4 0 0 5 0 11.4 0 19.6 12 30 12 30s12-10.4 12-18.6C24 5 18.6 0 12 0z" fill="#C0392B" stroke="#8B1A1A" strokeWidth="1.5" />
            <circle cx="12" cy="11.5" r="4" fill="white" opacity="0.9" />
          </svg>
          includes ({totalTeachers}) student{totalTeachers !== 1 ? "s" : ""} open to teaching
        </span>
      </div>
      <MapContainer
        center={[22, 0]}
        zoom={1}
        // zoomSnap 0 so FitWorldToWidth's fractional zoom is honoured exactly;
        // anything coarser rounds down and the world stops filling the frame.
        zoomSnap={0}
        zoomDelta={0.5}
        // Leaflet fades tiles in by animating inline opacity, and that fade
        // stalls at 0 when the zoom is fractional — tiles load, get their
        // loaded class, and stay invisible. Nothing here needs the fade.
        fadeAnimation={false}
        minZoom={1}
        maxZoom={9}
        // Longitude gets slack so a popup on an edge pin (Sydney) can auto-pan
        // into view. Tiles wrap, so panning past 180° shows the next copy of
        // the world rather than bare background — the repetition that looked
        // wrong before came from the world being narrower than the frame, not
        // from wrapping itself.
        maxBounds={[[-85, -260], [85, 260]]}
        maxBoundsViscosity={1}
        scrollWheelZoom={interactive}
        style={{ width: "100%", height: "100%", background: "#e8eaed" }}
      >
        <FitWorldToWidth />
        <TileLayer url={TILE_URL} subdomains={TILE_SUBDOMAINS} attribution="" keepBuffer={6} updateWhenIdle={false} updateWhenZooming={false} />
        {CONSERVATORIES.map((cons) => {
          const n = (studentsByCons[cons.id] || []).length;
          if (n === 0) return null;
          const active = selectedId === cons.id;
          const roster = studentsByCons[cons.id] || [];
          return (
            <Marker
              key={cons.id}
              position={[cons.lat, cons.lng]}
              icon={consPinIcon({ active, hasStudents: true, hasTeacher: (studentsByCons[cons.id] || []).some(s => s.teaching && s.teaching.open) })}
              eventHandlers={{
                click: () => onSelect(cons.id),
                // Leaflet sizes the popup and decides how far to pan the map at
                // open time, before React has rendered the roster into it — so a
                // long list gets clipped off the top of the map. Re-measuring on
                // the next tick, once the children are committed, re-pans it.
                popupopen: (e) => setTimeout(() => e.popup.update(), 0),
              }}
            >
              <Tooltip direction="top" offset={[0, -28]}>
                <span style={{ fontFamily: FONT_BODY, fontWeight: 600 }}>{cons.short}</span>
                <br />
                <span style={{ fontFamily: FONT_MONO, fontSize: 11 }}>
                  {cons.city}, {cons.country} · {n} student{n === 1 ? "" : "s"}
                </span>
              </Tooltip>
              {onOpenStudent && (
                <Popup maxWidth={300} minWidth={260} closeButton autoPan>
                  {/* 165px because the flat map's maxBounds stop it panning far
                      enough to reveal a taller popup above a pin. The globe has
                      no such constraint and passes a larger cap. */}
                  <ConsRosterCard
                    cons={cons} roster={roster} canViewRoster={canViewRoster}
                    onOpenStudent={onOpenStudent} onLockedClick={onLockedClick}
                    maxListHeight={165}
                  />
                </Popup>
              )}
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* APP                                                                 */
/* ---------------------------------------------------------------- */
const ACCESS_KEY = "artium_access_v1";
const SITE_PASSWORD = "artium2025";

function AccessGate({ onUnlock }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  function attempt() {
    if (value.trim() === SITE_PASSWORD) { onUnlock(); }
    else { setError(true); setValue(""); }
  }
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.inkSoft, fontFamily: FONT_BODY, padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400, background: "rgba(176,146,98,0.05)", border: `1px solid ${C.inkLine}`, borderRadius: 12, padding: 40, boxShadow: "0 4px 24px rgba(0,0,0,0.28)" }}>
        <div style={{ marginBottom: 28 }}>
          <Logo size={22} markSize={HEADER_CONTROL} />
          <p style={{ color: C.ivoryDim, fontSize: 14, marginTop: 12 }}>Private beta — enter access key to continue.</p>
        </div>
        <input
          type="password"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(false); }}
          onKeyDown={(e) => e.key === "Enter" && attempt()}
          placeholder="Access key"
          autoComplete="off"
          autoFocus
          style={{ ...inputStyle, boxSizing: "border-box", border: `1px solid ${error ? C.burgundy : C.inkLine}`, marginBottom: 8 }}
        />
        {error && <p style={{ color: C.burgundy, fontSize: 13, marginBottom: 12 }}>Incorrect key — try again.</p>}
        <button
          onClick={attempt}
          style={{ marginTop: 12, width: "100%", background: C.brass, color: C.brassText, border: "none", borderRadius: 10, padding: "12px 0", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
        >Continue</button>
      </div>
    </div>
  );
}

/* =========================================================
   AUTH PROMPT — one signup for the whole app.

   Sits between the access gate and the entry gate: nobody reaches the four
   role cards signed out any more. Deliberately its own small self-styled
   screen rather than reusing the dark signup-flow chrome — it draws in the
   entry gate's own light key (grey ground, ink/gold, Jost/Playfair) since
   it is the first thing anyone sees past the access key, and it is the one
   auth surface every role shares. Only two Supabase calls: signUp /
   signInWithPassword / signInWithOAuth, the same ones every role flow used
   to call itself — nothing new, just moved up front and shared.
========================================================= */
function AuthWordmark({ size = 24 }) {
  return (
    <span
      aria-label="ARTIUM"
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Jost', system-ui, sans-serif", fontWeight: 500,
        fontSize: size, letterSpacing: "0.02em", color: "#232A3B",
      }}
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 15 15" aria-hidden="true" style={{ marginRight: 2 }}>
        <path d="M7.5 0.9 L1.4 14.4 M7.5 0.9 L13.6 14.4" stroke="currentColor" strokeWidth="2.85" fill="none" />
      </svg>
      <span aria-hidden="true">RTIUM</span>
    </span>
  );
}

function AuthPrompt() {
  const AP_INK = "#232A3B", AP_GOLD = "#C9962E", AP_BG = "#F4F4F3", AP_MUTED = "#6B7280";
  const [mode, setMode] = useState("signup"); // "signup" | "login"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleGoogle() {
    setError(""); setSubmitting(true);
    // No artium_google_role here on purpose — that key is how a role flow's
    // own Google button (mid-signup) says "come back and open this door".
    // This button has no door to remember; a bare Google session with no
    // pending role lands back on the entry gate, exactly like a returning
    // signed-in visitor with no role yet.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) { setError(error.message); setSubmitting(false); }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!email.trim()) { setError("Enter your email."); return; }
    if (mode === "signup") {
      if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
      if (password !== confirmPassword) { setError("Passwords don't match."); return; }
      setSubmitting(true);
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
      setSubmitting(false);
      if (error) { setError(friendlyAuthError(error.message)); return; }
      // Supabase fakes success for an address that already has an account
      // (see the same check in submitApplication) rather than saying so —
      // an empty identities array on a sessionless result is that fake.
      if (data.user && !data.session && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setError("An account already exists for this email. Log in instead.");
        return;
      }
      if (!data.session) { setCheckEmail(true); return; }
      // A session now exists — the app's own auth listener picks this up
      // and swaps this screen for the entry gate; nothing left to do here.
    } else {
      setSubmitting(true);
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setSubmitting(false);
      if (error) { setError(friendlyAuthError(error.message)); return; }
    }
  }

  const fieldStyle = {
    marginTop: 6, width: "100%", boxSizing: "border-box", border: "1px solid rgba(35,42,59,0.18)",
    borderRadius: 8, padding: "10px 12px", fontSize: 14, fontFamily: "inherit", color: AP_INK, background: "#FDFDFC",
  };
  const labelStyle = { display: "block", fontSize: 12.5, fontWeight: 600, color: AP_INK };

  if (checkEmail) {
    return (
      <div style={{ minHeight: "100vh", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: AP_BG, fontFamily: "'Jost', system-ui, sans-serif", padding: 24 }}>
        <div style={{ width: "100%", maxWidth: 400, textAlign: "center" }}>
          <AuthWordmark />
          <p style={{ marginTop: 22, fontFamily: "'Playfair Display', serif", fontSize: 21, color: AP_INK }}>Check your email</p>
          <p style={{ marginTop: 10, fontSize: 14, color: AP_MUTED, lineHeight: 1.6 }}>
            We sent a confirmation link to <b style={{ color: AP_INK }}>{email}</b>. Follow it, then come back here and log in.
          </p>
          <button
            onClick={() => { setCheckEmail(false); setMode("login"); setPassword(""); setConfirmPassword(""); setError(""); }}
            style={{ marginTop: 20, background: "none", border: "none", padding: 0, color: AP_GOLD, fontWeight: 700, fontSize: 14, cursor: "pointer" }}
          >
            Back to log in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: AP_BG, fontFamily: "'Jost', system-ui, sans-serif", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <AuthWordmark />
          <p style={{ marginTop: 12, fontFamily: "'Playfair Display', serif", fontWeight: 500, fontSize: 21, color: AP_INK }}>
            {mode === "signup" ? "Join Artium" : "Welcome back"}
          </p>
          <p style={{ marginTop: 6, fontSize: 13.5, color: AP_MUTED, lineHeight: 1.5 }}>
            {mode === "signup" ? "One account for the whole Artium community." : "Log in to your Artium account."}
          </p>
        </div>
        <div style={{ background: "#FFFFFF", border: "1px solid rgba(35,42,59,0.1)", borderRadius: 16, padding: "26px 24px", boxShadow: "0 10px 40px rgba(35,42,59,0.08)" }}>
          <button
            type="button"
            onClick={handleGoogle}
            disabled={submitting}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              background: "#FFFFFF", color: AP_INK, border: "1px solid rgba(35,42,59,0.18)",
              borderRadius: 10, padding: "11px 16px", fontSize: 14.5, fontWeight: 500,
              cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.7 : 1,
            }}
          >
            <GoogleMark size={18} />
            {mode === "signup" ? "Sign up with Google" : "Continue with Google"}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0" }}>
            <div style={{ flex: 1, height: 1, background: "rgba(35,42,59,0.12)" }} />
            <span style={{ fontSize: 11, letterSpacing: 0.5, color: AP_MUTED }}>OR</span>
            <div style={{ flex: 1, height: 1, background: "rgba(35,42,59,0.12)" }} />
          </div>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={labelStyle}>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" style={fieldStyle} />
            </label>
            <label style={labelStyle}>
              Password
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
                style={fieldStyle}
              />
            </label>
            {mode === "signup" && (
              <label style={labelStyle}>
                Confirm password
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" style={fieldStyle} />
              </label>
            )}
            {error && <p style={{ margin: 0, fontSize: 13, color: "#B3261E", lineHeight: 1.5 }}>{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              style={{
                marginTop: 4, width: "100%", background: AP_GOLD, color: "#3A2E10", border: "none",
                borderRadius: 999, padding: "12px 0", fontSize: 14.5, fontWeight: 700,
                cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "Please wait…" : "Continue"}
            </button>
          </form>
        </div>
        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13.5, color: AP_MUTED }}>
          {mode === "signup" ? "Already have an account?" : "New to Artium?"}{" "}
          <button
            type="button"
            onClick={() => { setError(""); setMode(mode === "signup" ? "login" : "signup"); }}
            style={{ background: "none", border: "none", padding: 0, color: AP_GOLD, fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}
          >
            {mode === "signup" ? "Log in" : "Sign up"}
          </button>
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [unlocked, setUnlocked] = useState(() => localStorage.getItem(ACCESS_KEY) === "1");
  const [onlineCount, setOnlineCount] = useState(1);
  const { user: authUser, profile: authProfile, loading: authLoading, setProfile: setAuthProfile } = useAuth();
  // Signed in, and a human has not yet said yes. Read from the row the server
  // returned rather than from anything signup assembled, so it cannot be
  // talked out of by the client. `=== false` on purpose: a profile still
  // loading, or a learner with no such column, is not someone being made to
  // wait.
  const awaitingReview = authProfile?.approved === false;
  // What is actually on screen, as opposed to where the app last decided to
  // put you. Every branch below reads this rather than `screen`, so an
  // account still waiting on a human sees one thing and only one thing.
  //
  // Guarding screens one at a time did not work and was never going to: I
  // blocked "app", so Home went to "landing" instead, which draws a
  // signed-in header and a card leading back in. Every screen is a door and
  // the list only grows. Collapsing them to a single expression means a new
  // screen is covered the day it is written, by nobody remembering anything.
  const [screen, setScreen] = useState("entry");
  const view = awaitingReview ? "pendingReview" : screen;
  // The document's own colour is set in index.css now that every screen is
  // dark; this used to flip it per screen and no longer has anything to say.
  const [appTab, setAppTab] = useState(() => localStorage.getItem("artium_app_tab") || "map");
  const setAppTabPersist = (tab) => { localStorage.setItem("artium_app_tab", tab); setAppTab(tab); };
  const [teacherRoomView, setTeacherRoomView] = useState("students");
  // The pianist's side of "Find a Concert Pianist" — a booking inbox that
  // only ever exists for someone who plays piano, mirroring how Lessons only
  // shows up for someone who teaches.
  const [pianistInquiries, setPianistInquiries] = useState([]);
  const [pianistOfferAttention, setPianistOfferAttention] = useState({});
  const [activeConcertInquiryId, setActiveConcertInquiryId] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [previewOnly, setPreviewOnly] = useState(false);
  const [authError, setAuthError] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  // Which student route is in play: "otp" verifies an institutional email,
  // "document" uploads proof for manual review. It starts at "otp" and the
  // verification step switches it if they say they have no institutional
  // address — the entry gate used to decide this, back when there was a card
  // for each.
  // Signing in with Google leaves the page entirely and comes back, which
  // wipes React state, so the route has to survive in sessionStorage the same
  // way the Google role already does. Without this, every Google signup
  // silently landed on the institutional-email route.
  const [verifyMethod, setVerifyMethod] = useState(() => sessionStorage.getItem("artium_verify_method") || "otp");
  React.useEffect(() => { sessionStorage.setItem("artium_verify_method", verifyMethod); }, [verifyMethod]);
  // Which door they came through. The concert-pianist card lands on the same
  // landing page as the student card, so the page alone cannot know what
  // Sign Up should open — this flag is that memory, and it sits in
  // sessionStorage for the same reason verifyMethod does: a reload on the
  // landing page would otherwise quietly turn a hirer into a student.
  const [pianistEntry, setPianistEntry] = useState(() => sessionStorage.getItem("artium_entry_pianist") === "1");
  React.useEffect(() => { sessionStorage.setItem("artium_entry_pianist", pianistEntry ? "1" : "0"); }, [pianistEntry]);

  const [students, setStudents] = useState(() => seedTeaching([...SAMPLE_STUDENTS, ...CURTIS_MOCK_STUDENTS]));
  const [myProfile, setMyProfile] = useState(null);

  // Returning signed-in user: load their profile and skip straight to the app
  // (conservatory students) or the teacher map (piano-enthusiast learners).
  // Newly-confirmed user (clicked the email link): their profiles row doesn't
  // exist yet — create it now from the draft we stashed in their auth metadata
  // at signup time (stored server-side, so it survives the confirmation link
  // Realtime presence — track how many browser tabs are on the site
  useEffect(() => {
    if (!unlocked) return;
    const channel = supabase.channel("online_users", { config: { presence: { key: crypto.randomUUID() } } });
    channel
      .on("presence", { event: "sync" }, () => {
        setOnlineCount(Object.keys(channel.presenceState()).length);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await channel.track({ online_at: new Date().toISOString() });
      });
    return () => { supabase.removeChannel(channel); };
  }, [unlocked]);

  // being opened in a different browser/device than the one used to sign up).
  useEffect(() => {
    if (authLoading) return;
    // The hirer's whole account lives in auth metadata — no profiles row, so
    // authProfile never resolves for them and the branches below would never
    // fire. Caught here, first, the same way the learner and student routes
    // are caught by what did load.
    if (authUser?.user_metadata?.role === "concert_hirer") {
      if (["entry", "landing", "login", "confirmEmail", "hirerSignup"].includes(screen)) {
        setScreen("hirerApp");
      }
      return;
    }
    if (authProfile) {
      if (authProfile.role === "learner") {
        setLearnerProfile({ name: authProfile.name, location: authProfile.location, instrument: authProfile.instrument, bio: authProfile.bio });
        setLearnerLoggedOut(false);
        if (["entry", "landing", "login", "confirmEmail", "learnerSignup"].includes(screen)) {
          setScreen("learnerMap");
        }
        return;
      }
      const me = fromDbProfile(authProfile);
      setMyProfile(me);
      setPreviewOnly(false);
      // The owner administers the network rather than appearing in it. Every
      // other account already fails to see them — the roster query filters
      // is_admin — so this is the one place left that put them on a map: their
      // own copy, added locally without ever going through that query.
      if (authProfile.is_admin !== true) {
        setStudents((arr) => [...arr.filter((s) => s.id !== me.id), me]);
      }
      if (authProfile.approved === false) {
        // Document-proof student still awaiting manual review.
        if (["entry", "landing", "login", "confirmEmail"].includes(screen)) setScreen("pendingReview");
      } else if (screen === "entry" || screen === "landing" || screen === "login" || screen === "confirmEmail") {
        // Default view is the full conservatory list now; the welcome
        // block's own-conservatory row is the shortcut into the roster.
        setScreen("app");
        // Come back to the tab they were on. appTab already initialises from
        // localStorage, so pinning "map" here didn't just ignore the saved
        // tab — it overwrote it, which is why Admin could never survive a
        // refresh. The demo path has always restored it correctly.
        const savedTab = localStorage.getItem("artium_app_tab") || "map";
        const stillAdmin = authProfile.is_admin === true;
        setAppTabPersist(savedTab === "admin" && !stillAdmin ? "map" : savedTab);
      }
      return;
    }
    if (authUser) {
      const pendingStudent = authUser.user_metadata?.pendingProfile;
      const pendingLearner = authUser.user_metadata?.pendingLearner;
      if (pendingStudent) {
        supabase.from("profiles").insert(toDbProfile(pendingStudent, authUser.id)).select().single().then(async ({ data: insertedProfile, error }) => {
          if (error) { setAuthError(error.message); return; }
          // Same reason as the other two inserts: the context fetched a
          // profile that did not exist yet, so it must be told about this one.
          if (insertedProfile) setAuthProfile(insertedProfile);
          supabase.auth.updateUser({ data: { pendingProfile: null } });
          const isDoc = needsReview(pendingStudent);
          if (isDoc) { await insertVerificationRequest(authUser.id, pendingStudent); }
          const me = { id: authUser.id, name: pendingStudent.name, instruments: instrumentsOf(pendingStudent), conservatoryId: pendingStudent.conservatoryId, year: pendingStudent.years, bio: pendingStudent.bio, tastes: pendingStudent.tastes, pieces: pendingStudent.pieces, links: pendingStudent.links || {}, top: pendingStudent.top, flop: pendingStudent.flop, photoUrl: pendingStudent.photoUrl, teaching: pendingStudent.teaching, online: true };
          setMyProfile(me);
          if (isDoc) { setScreen("pendingReview"); return; }
          if (!isAdminEmail(authUser.email)) {
            setStudents((arr) => [...arr.filter((s) => s.id !== me.id), me]);
          }
          setScreen("app");
          setAppTabPersist("map");
        });
      } else if (pendingLearner) {
        supabase.from("profiles").insert({ id: authUser.id, role: "learner", name: pendingLearner.name, location: pendingLearner.location, instrument: pendingLearner.instrument, bio: pendingLearner.motivation, approved: true }).then(({ error }) => {
          if (error) { setAuthError(error.message); return; }
          supabase.auth.updateUser({ data: { pendingLearner: null } });
          setLearnerProfile({ name: pendingLearner.name, location: pendingLearner.location, instrument: pendingLearner.instrument, bio: pendingLearner.motivation });
          setScreen("learnerMap");
        });
      } else {
        // Google OAuth user with no profile yet — route to signup flow to collect info.
        // Use the ref (read at mount) as primary so the key is available even if
        // the auth effect fires after sessionStorage was already cleared.
        const googleRole = pendingGoogleRoleRef.current || sessionStorage.getItem("artium_google_role");
        if (googleRole) {
          pendingGoogleRoleRef.current = "";
          sessionStorage.removeItem("artium_google_role");
          const googleName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || "";
          if (googleRole === "learner") {
            setLearnerGoogleName(googleName);
            setScreen("learnerSignup");
          } else {
            // Restore the route they picked before the OAuth round-trip. The
            // draft still carries emptyDraft()'s "otp", so this has to be set
            // explicitly rather than left to the spread.
            const savedMethod = sessionStorage.getItem("artium_verify_method") || "otp";
            setVerifyMethod(savedMethod);
            // Signing in with Google leaves the site and comes back, so this
            // runs on a fresh page: the draft in memory is empty, and
            // spreading it kept nothing. Someone who filled six steps and then
            // reached for the Google button lost all of it — the one path
            // where the saved copy existed and nothing read it.
            const saved = readSavedDraft();
            setDraft((d) => ({
              ...d,
              ...(saved ? saved.draft : {}),
              verifyMethod: savedMethod,
              // Their own answer wins; Google's name is only a starting point.
              name: (saved?.draft?.name || "").trim() || googleName,
              // The account is the Google one, whatever they typed earlier.
              email: authUser.email || "",
              password: "__google__", confirmPassword: "__google__",
            }));
            setResumed(!!saved);
            setEditingProfile(false);
            setStep(1);
            setScreen("signup");
          }
        }
      }
    }
    // Anyone still holding a demo session from before the personas were
    // removed would otherwise be restored into an account that no longer
    // exists, so the key is cleared rather than read.
    if (!authProfile && !authUser) localStorage.removeItem("artium_demo_session");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, authProfile, authUser]);

  // Pull in any real conservatory-student signups so they show up on the map
  // alongside the sample data (learner accounts aren't conservatory students).
  useEffect(() => {
    supabase.from("profiles").select("*").eq("approved", true).eq("role", "student").neq("is_admin", true).then(({ data, error }) => {
      if (error || !data) return;
      const real = data.map(fromDbProfile);
      const realIds = new Set(real.map((r) => r.id));
      setStudents((arr) => [...arr.filter((s) => !realIds.has(s.id)), ...real]);
    });
  }, []);

  const [learnerProfile, setLearnerProfile] = useState(null);
  const [learnerLoggedOut, setLearnerLoggedOut] = useState(false);
  const [studentLoggedOut, setStudentLoggedOut] = useState(false);
  const [learnerGoogleName, setLearnerGoogleName] = useState("");
  // Read Google role eagerly on mount so it's available before auth state fires
  const pendingGoogleRoleRef = React.useRef(sessionStorage.getItem("artium_google_role") || "");
  const [teachRequests, setTeachRequests] = useState(() => {
    try { return JSON.parse(localStorage.getItem("teachRequests") || "{}"); } catch { return {}; }
  });

  // Cross-tab sync: when teacher accepts/declines in their tab, update learner's state live
  React.useEffect(() => {
    function onStorage(e) {
      if (e.key === "teachRequests") {
        try {
          const updated = JSON.parse(e.newValue || "{}");
          setTeachRequests(updated);
          // If teacher just accepted, open a welcome message from them
          Object.entries(updated).forEach(([tid, status]) => {
            if (status === "accepted") {
              setConversations((c) => c[tid] ? c : { ...c, [tid]: [
                { from: "them", text: "Hi! I accepted your request — looking forward to teaching you. When works for a first session?" },
              ]});
            }
          });
        } catch {}
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const [draft, setDraft] = useState(emptyDraft());
  // The verification step can switch the route mid-signup. Mirror it back so
  // the sessionStorage copy above stays true: if they switch and then go back
  // a step to sign in with Google, the OAuth round-trip restores from that
  // copy, and a stale one would drop them back on the email route.
  React.useEffect(() => {
    if (draft.verifyMethod) setVerifyMethod(draft.verifyMethod);
  }, [draft.verifyMethod]);
  const [step, setStep] = useState(0);

  const [selectedConsId, setSelectedConsId] = useState(null);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [profileBack, setProfileBack] = useState("map");

  // Every school the map knows about beyond the bundled list: the roster in
  // the database, and conservatories established from an approved document.
  //
  // The roster half is why a student could sit at a school showing zero
  // students. Signup was moved onto conservatory_roster, so people are filed
  // under roster ids like 'artium-test'; the map was still composing the
  // bundled array with approved_conservatories, whose ids are uuids. The card
  // on the map and the student on the profile were two different rows for the
  // same school, and nothing matched.
  //
  // Composed the same way signup composes it — roster first, then approved
  // rows that are not already the same school by name — so a school approved
  // for a new domain patches the entry it belongs to rather than appearing
  // beside it.
  const [docCons, setDocCons] = useState([]);
  React.useEffect(() => {
    let live = true;
    Promise.all([
      supabase.from("conservatory_roster").select("id, name, short, city, country, lat, lng, domains"),
      supabase.from("approved_conservatories").select("id, name, address, lat, lng"),
    ]).then(([rosterRes, approvedRes]) => {
      if (!live) return;
      const builtIn = new Set(CONSERVATORIES.map((c) => c.id));
      const seen = new Set(CONSERVATORIES.map((c) => normalizeName(c.name)));
      const out = [];
      for (const c of rosterRes.data || []) {
        if (builtIn.has(c.id)) continue;          // already in the bundle
        out.push({ ...c, domains: Array.isArray(c.domains) ? c.domains : [] });
        seen.add(normalizeName(c.name));
      }
      for (const c of approvedRes.data || []) {
        if (seen.has(normalizeName(c.name))) continue;
        out.push(asConservatory(c));
        seen.add(normalizeName(c.name));
      }
      setExtraCons(out);
      setDocCons(out);
    });
    return () => { live = false; };
  }, []);

  const [conversations, setConversations] = useState(SAMPLE_CONVERSATIONS);
  const [activeChatId, setActiveChatId] = useState(null);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);

  const [musicOn, setMusicOn] = useState(false);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const spotifyRef = useRef(null);
  function toggleMusic() {
    if (!musicOn) setMusicOn(true);
    try {
      spotifyRef.current?.togglePlay();
    } catch {
      // Controller may not be ready yet on the very first click.
    }
  }

  const studentsByCons = students.reduce((acc, s) => {
    (acc[s.conservatoryId] = acc[s.conservatoryId] || []).push(s);
    return acc;
  }, {});

  // Seven tabs only ever exist for a pianist — the same rule that already
  // governs Lessons.
  const isPianistUser = !!myProfile && instrumentsOf(myProfile).includes("Piano");

  useEffect(() => {
    if (!isPianistUser) return;
    let live = true;
    const refresh = () => listInquiries("pianist").then(({ data }) => { if (live && data) setPianistInquiries(data); });
    refresh();
    const id = setInterval(refresh, 15000);
    return () => { live = false; clearInterval(id); };
  }, [isPianistUser]);

  // Same shape as the hirer's dot: a proposed offer the pianist did not
  // create is theirs to answer.
  useEffect(() => {
    if (!isPianistUser) { setPianistOfferAttention({}); return; }
    const negotiating = pianistInquiries.filter((q) => q.status === "negotiating");
    if (!negotiating.length) { setPianistOfferAttention({}); return; }
    let live = true;
    Promise.all(negotiating.map((q) => listOffers(q.id).then(({ data }) => [q.id, data || []])))
      .then((pairs) => {
        if (!live) return;
        const map = {};
        for (const [id, list] of pairs) {
          const latest = [...list].reverse().find((o) => o.status === "proposed");
          map[id] = !!(latest && latest.createdBy !== myProfile?.id);
        }
        setPianistOfferAttention(map);
      });
    return () => { live = false; };
  }, [isPianistUser, pianistInquiries, myProfile?.id]);

  // Same rule as the boolean below, counted rather than tested — the network
  // header's bell reads a number ("2 concert hiring requests"), the Concerts
  // tab just needs to know whether to light up at all. The ids alongside the
  // count are what let the bell tell a request it has already shown apart
  // from a new one — each inquiry's own .id, the same id BookingsList/
  // ConcertConversation already key off.
  const pianistAttentionIds = pianistInquiries.filter((q) =>
    (q.status === "agreed" && !q.pianistSignedAt) || pianistOfferAttention[q.id]).map((q) => q.id);
  const pianistAttentionCount = pianistAttentionIds.length;
  const pianistNeedsAttention = pianistAttentionCount > 0;

  // Admin is now strictly profiles.is_admin — a real, signed-in account. The
  // demo teacher used to count too, which put the tab on screen while every
  // query behind it ran unauthenticated and came back empty.
  const isAdmin = authProfile?.is_admin === true;

  // Takes no argument on purpose: it is wired straight to onClick handlers in
  // several places, so a positional verifyMethod would receive a click event.
  // Keeping an unfinished signup.
  //
  // Nothing is created until the last step, so closing the tab at step six
  // threw away a photo, a video link, three composers and a repertoire, with
  // no warning and no trace. Whoever that was, we never knew they tried.
  //
  // Two things are deliberately not kept. The password, because a plain-text
  // password sitting in localStorage is a worse problem than the one being
  // solved — they set it again on the first step, where they set it anyway.
  // And the photo, if it is a data URL, because a few of those exhaust the
  // quota and then nothing saves at all.
  const DRAFT_KEY = "artium_signup_draft_v1";
  const DRAFT_MAX_AGE_DAYS = 30;
  const [resumed, setResumed] = useState(false);

  function readSavedDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      const saved = JSON.parse(raw);
      if (!saved?.draft) return null;
      const age = (Date.now() - (saved.at || 0)) / 86400000;
      if (age > DRAFT_MAX_AGE_DAYS) { localStorage.removeItem(DRAFT_KEY); return null; }
      return saved;
    } catch { return null; }
  }
  function clearSavedDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    setResumed(false);
  }

  // Saved as they go, not on leaving: beforeunload is unreliable on phones,
  // where the tab is closed by the operating system rather than the person.
  useEffect(() => {
    if (screen !== "signup" || editingProfile) return;
    // An untouched form is not progress worth restoring.
    if (!draft.email && !draft.name && !instrumentsOf(draft).length) return;
    const { password, confirmPassword, photoUrl, ...rest } = draft;
    const body = { at: Date.now(), step, draft: { ...rest, photoUrl: String(photoUrl || "").startsWith("data:") ? "" : photoUrl } };
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(body)); } catch {}
  }, [screen, editingProfile, draft, step]);

  // One signup for the whole app: by the time this runs there is always a
  // session (the access gate no longer lets anyone this far signed out —
  // see AuthPrompt), so there is no separate account-creation step left to
  // open. "__google__" already meant "authenticated, nothing to collect
  // here" for the one case that used to reach this mid-flow, a Google
  // redirect; "__authed__" is the same idea for an email/password session
  // started at the prompt, kept as a distinct sentinel so StepConservatory's
  // Google-domain auto-verify (which really does mean Google) isn't fooled
  // by a plain email account that happens to share a school's domain.
  function freshAuthedDraft() {
    const viaGoogle = authUser?.app_metadata?.provider === "google";
    const sentinel = viaGoogle ? "__google__" : "__authed__";
    return {
      ...emptyDraft(),
      verifyMethod,
      email: authUser?.email || "",
      name: authUser?.user_metadata?.full_name || authUser?.user_metadata?.name || "",
      password: sentinel,
      confirmPassword: sentinel,
    };
  }
  function startApply() {
    if (authUser && authProfile?.role === "learner") {
      setAuthError("You're already registered as a piano enthusiast with this account. You can't also sign up as a conservatory student — log out first if you want to create a separate account with a different email.");
      return;
    }
    const saved = readSavedDraft();
    const authed = freshAuthedDraft();
    // instruments last, and through the reader: a draft saved before the field
    // became a list carries a bare `instrument` string that would otherwise
    // spread straight past the empty array and lose their answer. The saved
    // copy never has a usable password (that was never kept), so the fresh
    // session's own sentinel always wins over it.
    setDraft(saved
      ? { ...authed, ...saved.draft, instruments: instrumentsOf(saved.draft), name: (saved.draft.name || "").trim() || authed.name, email: authed.email, password: authed.password, confirmPassword: authed.confirmPassword }
      : authed);
    setResumed(!!saved);
    setStep(0);
    setEditingProfile(false);
    setAuthError("");
    setScreen("signup");
  }
  function startLogin() {
    setAuthError("");
    setScreen("login");
  }
  async function handleLogin(email, password) {
    setAuthError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
  }
  async function handleLogout() {
    await supabase.auth.signOut();
    localStorage.removeItem("artium_demo_session");
    localStorage.removeItem("artium_app_tab");
    setMyProfile(null);
    setStudents((arr) => arr.filter((s) => s.id !== myProfile?.id));
    setStudentLoggedOut(true);
    setScreen("landing");
    setAppTabPersist("map");
  }
  function startPreview() {
    setPreviewOnly(true);
    setScreen("app");
    setAppTabPersist("map");
  }
  function goHome() {
    setScreen("landing");
    setSelectedStudentId(null);
    setAppTabPersist("map");
  }

  /**
   * Where the bottom bar sends you, from wherever you pressed it.
   *
   * Home is the landing page, not a tab — it is the way out of the app rather
   * than a place inside it. Everything else is a tab of the app, so pressing
   * one from the landing page has to open the app first; that is the case the
   * old in-page bar could not handle, because it only existed once you were
   * already there.
   *
   * A guest is only ever offered Home and Network, but the prompt stays for
   * the case where a signed-out student's profile has not loaded yet.
   */
  function goToTab(k) {
    if (k === "home") { goHome(); return; }
    setSelectedStudentId(null);
    if (k === "map") {
      setSelectedConsId(null);
      setAppTabPersist("map");
      setScreen("app");
      return;
    }
    if (!myProfile) { setShowGuestPrompt(true); return; }
    setAppTabPersist(k);
    setScreen("app");
  }
  // One account, one role. Since accounts are now shared across the whole
  // app, an already-classified account (a student, a learner, or a hirer —
  // the hirer check reads auth metadata directly because a hirer has no
  // profiles row at all) that lands back on the entry gate and taps a
  // *different* card is sent to the home it already has instead of being
  // walked into a role flow that would try to insert a second profiles row
  // under the same id and fail on the primary key. The only way back here
  // with an existing role is a manual "back" (e.g. from Composers) — the
  // boot effect's own auto-redirect only fires on auth state changing, not
  // on every screen change.
  function accountHomeScreen() {
    if (authUser?.user_metadata?.role === "concert_hirer") return "hirerApp";
    if (authProfile?.role === "learner") return "learnerMap";
    if (authProfile) return "app";
    return null;
  }
  // Always "otp" from the gate now. The email route is the default and the
  // document route is the fallback offered inside the verification step, so
  // the gate no longer decides — but the argument stays, because this is also
  // where a caller that does know the route would set it.
  function chooseStudent(method) {
    if (myProfile) { setScreen("app"); setAppTabPersist("map"); return; }
    const home = accountHomeScreen();
    if (home) { setScreen(home); if (home === "app") setAppTabPersist("map"); return; }
    setVerifyMethod(method);
    setPianistEntry(false);
    setScreen("landing");
  }
  // The concert-pianist card. For now it lands on the same landing page as
  // the student card — the content is shared deliberately — and the flag is
  // what diverges later: Sign Up from a pianist entry opens the hirer's
  // signup instead of the student audition.
  function choosePianist() {
    if (myProfile) { setScreen("app"); setAppTabPersist("map"); return; }
    const home = accountHomeScreen();
    if (home) { setScreen(home); if (home === "app") setAppTabPersist("map"); return; }
    setPianistEntry(true);
    setScreen("landing");
  }
  function chooseLearner() {
    if (learnerProfile) { setScreen("learnerMap"); return; }
    const home = accountHomeScreen();
    if (home) { setScreen(home); if (home === "app") setAppTabPersist("map"); return; }
    if (learnerLoggedOut) { startLogin(); return; }
    setLearnerProfile(null); setAuthError(""); setScreen("learnerSignup");
  }
  async function submitLearner({ name, location, email, password, instrument, motivation }) {
    setAuthError("");
    if (authUser) {
      // Already authenticated at the prompt (Google or email) — just write
      // the profile row against the live session, whichever way it signed in.
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { setAuthError("Session expired. Please try again."); return; }
      const { error: insertError } = await supabase.from("profiles").insert({ id: authUser.id, role: "learner", name, location, instrument, bio: motivation, approved: true });
      if (insertError) { setAuthError(await friendlyProfileError(insertError)); return; }
      setLearnerGoogleName("");
      setLearnerProfile({ name, location, instrument, bio: motivation });
      setLearnerLoggedOut(false);
      setScreen("learnerMap");
      return;
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { pendingLearner: { name, location, instrument, motivation } } },
    });
    if (error) { setAuthError(friendlyAuthError(error.message)); return; }
    if (data.session && data.user) {
      const { error: insertError } = await supabase.from("profiles").insert({ id: data.user.id, role: "learner", name, location, instrument, bio: motivation, approved: true });
      if (insertError) { setAuthError(await friendlyProfileError(insertError)); return; }
      await supabase.auth.updateUser({ data: { pendingLearner: null } });
      setLearnerProfile({ name, location, instrument, bio: motivation });
      setLearnerLoggedOut(false);
      setScreen("learnerMap");
    } else {
      setLearnerProfile({ name, location, instrument, bio: motivation });
      setPendingEmail(email);
      setScreen("confirmEmail");
    }
  }
  function backToEntry() { setLearnerGoogleName(""); setScreen("entry"); }
  function sendTeachRequest(teacherId) {
    setTeachRequests((r) => {
      const next = { ...r, [teacherId]: "pending" };
      localStorage.setItem("teachRequests", JSON.stringify(next));
      return next;
    });
    // Also write learner profile so the teacher's tab can see who's requesting
    const lp = learnerProfile;
    if (lp) {
      const existing = JSON.parse(localStorage.getItem("incomingRequests") || "{}");
      existing[teacherId] = existing[teacherId] || [];
      if (!existing[teacherId].find((r) => r.learnerId === "demo-learner")) {
        existing[teacherId].push({ learnerId: "demo-learner", name: lp.name, instrument: lp.instrument, bio: lp.bio, status: "pending" });
      }
      localStorage.setItem("incomingRequests", JSON.stringify(existing));
    }
  }
  function goToProfile() {
    if (!myProfile) return;
    setScreen("app");
    setAppTabPersist("profile");
    setSelectedStudentId(null);
  }
  function update(partial) { setDraft((d) => ({ ...d, ...partial })); }
  function toggleTaste(t) {
    setDraft((d) => ({ ...d, tastes: d.tastes.includes(t) ? d.tastes.filter((x) => x !== t) : [...d.tastes, t] }));
  }

  async function insertVerificationRequest(userId, d) {
    // The id may come from either roster: the built-in list (if they reached
    // this route with one already picked) or the admin-approved one. Blank is
    // the normal case now — the document establishes the school.
    let cons = findConservatory(d.conservatoryId);
    if (!cons && d.conservatoryId) {
      const { data } = await supabase.from("approved_conservatories")
        .select("name, address").eq("id", d.conservatoryId).maybeSingle();
      if (data) cons = { name: data.name, city: "", country: "", address: data.address };
    }
    // Two shapes of request share this queue. A domain request carries no
    // document and names its own school, so it takes the student's answers
    // rather than a row from a roster they could not find.
    const req = d.domainReq;
    await supabase.from("student_verifications").insert({
      user_id: userId,
      name: d.name,
      personal_email: d.email,
      kind: req ? "domain_request" : "document",
      document_url: req ? "" : d.proofDocUrl,
      document_name: req ? "" : d.proofDocName,
      conservatory_id: req ? null : d.conservatoryId,
      conservatory_email: req ? req.email : "",
      conservatory_name: req ? req.name : (cons?.name || ""),
      conservatory_address: req ? req.address : (cons ? (cons.address ?? `${cons.city}, ${cons.country}`) : ""),
      status: "pending",
    });
  }
  async function submitApplication() {
    setAuthError("");
    if (editingProfile) {
      const { error } = await supabase.from("profiles").update(toDbProfile(draft, myProfile.id)).eq("id", myProfile.id);
      if (error) { setAuthError(error.message); return; }
      const updated = { ...myProfile, ...draft };
      setMyProfile(updated);
      setStudents((arr) => arr.map((s) => (s.id === myProfile.id ? updated : s)));
      setScreen("app"); setAppTabPersist("profile");
    } else if (authUser) {
      // Security-review hardening: key this branch on the session alone. The
      // old sentinel test left a fringe state (authed, existing profile row,
      // email-password sentinel) that would fall through to the legacy
      // signUp call and send the literal sentinel as a password — harmless
      // but wrong. Authenticated means never signUp again, full stop.
      // Already signed in, no profile yet: finish by writing one.
      //
      // Written as the Google case, because that was the only way to arrive
      // here authenticated. It is not: someone who submitted, confirmed their
      // email and then came back to finish is signed in too, with a password.
      // They fell through to signUp, which refused an email that already had
      // an account and told them to log in — which they had just done. The
      // last step of signup was a wall, reached only by people who had already
      // got further than most.
      // .select() and hand the row to the auth context. It fetches a profile
      // only when the session changes, and a Google account is signed in
      // before its profile exists — so the fetch finds nothing, authProfile
      // stays null for the rest of the session, and anything reading it for
      // the truth about approval reads null instead of false. That is what
      // let a Google signup walk past the review gate while the row in the
      // database plainly said approved: false.
      const { data: insertedProfile, error: insertError } = await supabase
        .from("profiles").insert(toDbProfile(draft, authUser.id)).select().single();
      if (insertError) { setAuthError(await friendlyProfileError(insertError)); return; }
      if (insertedProfile) setAuthProfile(insertedProfile);
      clearSavedDraft();
      if (needsReview(draft)) { await insertVerificationRequest(authUser.id, draft); }
      setDraft((d) => ({ ...d, id: authUser.id }));
      finishSignup(authUser.id, authUser.email || draft.email, needsReview(draft) ? "document" : draft.verifyMethod);
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: draft.email,
        password: draft.password,
        options: { data: { pendingProfile: draft } },
      });
      if (error) { setAuthError(friendlyAuthError(error.message)); return; }
      // Supabase will not say "that address is taken" — that would let anyone
      // test whether a given person has an account — so it returns a
      // user-shaped object, sends no mail, and looks exactly like success.
      // Its own logs call this "User repeated signup"; an empty identities
      // array is how the client sees the same thing.
      //
      // Reaching it is not an edge case, because we register the address
      // ourselves twice over: the conservatory one-time code is sent with
      // shouldCreateUser, and Google sign-in creates an account outright. Use
      // either with the address you later sign up under and you arrive
      // already registered, through a door we opened.
      if (data.user && !data.session && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setAuthError("An account already exists for this email — from Google sign-in, or from verifying a conservatory address. Log in instead, or sign up with a different address.");
        return;
      }
      if (data.session && data.user) {
        // Email confirmation is off — we already have an active session, insert right away.
        const { data: insertedProfile, error: insertError } = await supabase
          .from("profiles").insert(toDbProfile(draft, data.user.id)).select().single();
        if (insertError) { setAuthError(await friendlyProfileError(insertError)); return; }
        if (insertedProfile) setAuthProfile(insertedProfile);
        clearSavedDraft();
        await supabase.auth.updateUser({ data: { pendingProfile: null } });
        if (needsReview(draft)) { await insertVerificationRequest(data.user.id, draft); }
        setDraft((d) => ({ ...d, id: data.user.id }));
        finishSignup(data.user.id, data.user.email || draft.email, needsReview(draft) ? "document" : draft.verifyMethod);
      } else {
        // Email confirmation required — the draft is stored server-side in the
        // user's auth metadata, so it's picked up after confirming on any device.
        // The account exists and the answers now live in its auth metadata, so
        // the local copy has done its job; keeping it only risks restoring it
        // over a signup that is already finished.
        clearSavedDraft();
        setPendingEmail(draft.email);
        setScreen("confirmEmail");
      }
    }
  }
  /**
   * Where a finished signup lands: waiting for a human, or straight in.
   *
   * "Straight in" used to mean the prototype's audition gate — "Your audition
   * is under review", with a Simulate acceptance button underneath admitting
   * it was scaffolding. Only the owner skipped it. But a student who has just
   * had a code delivered to their conservatory address is verified, and the
   * row written a moment ago says approved: true, so there was nothing left to
   * review. The screen invented a wait that no longer existed and then offered
   * a button to end it.
   *
   * The id is passed rather than read from draft: setDraft has only just been
   * queued, so draft.id is still undefined at this point.
   */
  function finishSignup(userId, email, verifyMethod) {
    if (verifyMethod === "document") { setScreen("pendingReview"); return; }
    enterApp(userId, email);
  }
  function enterApp(userId, email) {
    const me = { id: userId || draft.id, name: draft.name || "Your name", instruments: instrumentsOf(draft), conservatoryId: draft.conservatoryId, year: draft.years || "Current student", bio: draft.bio, tastes: draft.tastes, pieces: draft.pieces, links: draft.links || {}, top: draft.top, flop: draft.flop, photoUrl: draft.photoUrl, teaching: draft.teaching, online: true };
    setMyProfile(me);
    // Same reason as the roster add in the auth effect: the owner does not
    // appear on the map they administer. The email is passed in because this
    // runs before the profile has been read back, so is_admin is not known yet.
    if (!isAdminEmail(email || draft.email)) {
      setStudents((arr) => [...arr.filter((s) => s.id !== me.id), me]);
    }
    setPreviewOnly(false);
    setScreen("app"); setAppTabPersist("map");
  }
  function editProfile() {
    setDraft({ ...emptyDraft(), ...myProfile, instruments: instrumentsOf(myProfile), years: myProfile.year || "", pieces: myProfile.pieces || [], tastes: myProfile.tastes || [], composerDay: myProfile.composerDay || "" });
    setStep(0); setEditingProfile(true); setScreen("signup");
  }
  function openStudent(id, from) { setSelectedStudentId(id); setProfileBack(from); }
  function backFromProfile() { setSelectedStudentId(null); setAppTabPersist(profileBack === "chat" ? "messages" : "map"); }
  function openChat(id) {
    setConversations((c) => (c[id] ? c : { ...c, [id]: [] }));
    setActiveChatId(id); setSelectedStudentId(null); setAppTabPersist("messages");
  }
  function sendMessage(text) {
    if (!text.trim() || !activeChatId) return;
    setConversations((c) => ({ ...c, [activeChatId]: [...(c[activeChatId] || []), { from: "me", text }] }));
    const replies = [
      "Completely agree — want to run it together sometime this week?",
      "That's exactly the section I'm stuck on too.",
      "Send me a clip when you've got a take you like.",
      "I usually slow it down to half tempo first, helps a lot.",
      "Let's set up a call and compare fingerings.",
    ];
    setTimeout(() => {
      setConversations((c) => ({ ...c, [activeChatId]: [...(c[activeChatId] || []), { from: "them", text: replies[Math.floor(Math.random() * replies.length)] }] }));
    }, 1400);
  }

  if (!unlocked) return <AccessGate onUnlock={() => { localStorage.setItem(ACCESS_KEY, "1"); setUnlocked(true); }} />;

  // One signup for the whole app: nothing past the access gate is reachable
  // signed out any more. authLoading is the brief window before getSession()
  // resolves on first paint (the session itself persists across reloads, so
  // this is never more than a flash) — a plain matching-ground placeholder
  // avoids a flash of the auth prompt for someone who is about to turn out
  // to already be signed in. Keyed on authUser alone, not on `screen`: a
  // sign-out anywhere in the app clears authUser and this same check sends
  // them straight back here, whatever screen they were last on.
  if (authLoading) return <div style={{ minHeight: "100vh", width: "100%", background: "#F4F4F3" }} />;
  if (!authUser) return <AuthPrompt />;

  // The one avatar, wherever the header has a slot for it: a student/hirer's
  // own uploaded photo first, then whatever Google put in the session
  // (avatar_url for most accounts, picture on a couple of older token
  // shapes), then initials off whatever name is known yet — falling back to
  // the email, since a brand-new account between the prompt and finishing a
  // role's own name field has nothing else to show.
  const accountPhotoUrl = myProfile?.photoUrl || authProfile?.photo_url || authUser?.user_metadata?.avatar_url || authUser?.user_metadata?.picture || null;
  const accountName = myProfile?.name || learnerProfile?.name || authProfile?.name || authUser?.user_metadata?.full_name || authUser?.user_metadata?.name || authUser?.email || "";

  return (
    // Every screen runs on the gate's light ground now (C.ink === #F4F4F3),
    // so this wrapper is one flat fill everywhere instead of a per-screen
    // ternary — no more dark-shell/light-gate seam to paper over. Still its
    // own style rather than just omitting the wrapper background: the
    // wrapper rounds up to a whole pixel where a screen lands on a
    // fraction, and a phone's safe area / rubber-band scroll both reveal
    // whatever is underneath, so it still needs to be filled with the same
    // tone as the screens themselves.
    <div style={{ fontFamily: FONT_BODY, background: C.ink, minHeight: "100%", width: "100%" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=DM+Serif+Display&family=Fraunces:opsz,wght@9..144,500&display=swap');
        * { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
        .lg-pulse { animation: lgpulse 2.2s ease-out infinite; transform-origin: center; }
        @keyframes lgpulse { 0% { opacity:0.9; transform:scale(0.6);} 100% { opacity:0; transform:scale(2.4);} }
        .lg-fade { animation: lgfade 0.3s ease both; }
        @keyframes lgfade { from { opacity:0; transform:translateY(6px);} to { opacity:1; transform:translateY(0);} }
        .lg-blink { animation: lgblink 1.6s ease-in-out infinite; }
        @keyframes lgblink { 0%,100% { opacity:1;} 50% { opacity:0.25;} }
        .lg-scroll::-webkit-scrollbar { width: 4px; }
        .lg-scroll::-webkit-scrollbar-thumb { background: #E6EBF1; border-radius: 2px; }
        .lg-split-map { display: grid; grid-template-columns: 1fr; }
        .lg-split-chat { display: grid; grid-template-columns: 1fr; }
        @media (min-width: 768px) {
          .lg-split-map { grid-template-columns: 1fr 380px; }
          .lg-split-chat { grid-template-columns: 300px 1fr; }
        }
        @media (max-width: 767px) {
          .lg-split-map > :last-child { max-height: 45vh !important; overflow-y: auto; -webkit-overflow-scrolling: touch; }
        }
        input[type=range].artium-slider { -webkit-appearance: none; appearance: none; height: 2px !important; outline: none; border-radius: 2px; }
        input[type=range].artium-slider::-webkit-slider-thumb { -webkit-appearance: none !important; appearance: none !important; width: 7px !important; height: 7px !important; border-radius: 50% !important; background: #000 !important; cursor: pointer !important; border: none !important; }
        input[type=range].artium-slider::-moz-range-thumb { width: 7px !important; height: 7px !important; border-radius: 50% !important; background: #000 !important; border: none !important; cursor: pointer !important; }

        /* ---- Entry gate: Dark Prestige --------------------------------
           Steinway black, gold at the edges, and as little else as the screen
           can carry. Every surface floats; nothing is outlined heavily. */
        .artium-gx {
          /* Not 100%: a percentage min-height needs a parent with a definite
             height, and every wrapper above this one is auto, so it resolved
             to nothing and the gate stopped short of the fold. dvh over vh
             because mobile browser chrome moves — vh is the tallest the
             viewport ever gets, which puts the footer under the address bar. */
          position: relative; min-height: 100vh; min-height: 100dvh;
          display: flex; flex-direction: column;
          background:
            radial-gradient(120% 80% at 50% -10%, #17181C 0%, transparent 60%),
            linear-gradient(180deg, #131417 0%, #0F1012 45%, #0B0C0E 100%);
          color: #FFFFFF;
          font-family: 'Manrope', -apple-system, 'Segoe UI', Roboto, sans-serif;
          overflow: hidden;
        }

        /* Backdrop: the photograph, a scrim to sit type on, then dust and
           grain. The staves, the conductor and the scattered notes used to be
           drawn in CSS here — the photograph carries all three, so they are
           gone rather than doubled. */
        .artium-gx-bd { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
        .artium-gx-bd > * { position: absolute; }
        /* top, not center: everything in the photograph — the conductor, the
           hall, the notes — lives in its upper third, and the lower two thirds
           are all but pure black. Anchoring the top keeps the subject behind
           the headline at every viewport height, and the dead area falls where
           the cards are, which is what makes it dead space well spent. */
        /* The photograph is a variable because the gate and the landing use
           different frames of the same hall — the landing's is the one with
           the lit floor, which the pin has to stand on. */
        .artium-gx-photo {
          inset: 0;
          background: var(--gx-photo, url('/gate-hall.webp')) center top / cover no-repeat;
        }
        /* Light over the photograph, heavy under the cards. The reference
           leaves the hall clearly legible behind the headline, so this veils
           rather than hides — but it closes to near-solid by the foot, so the
           cards sit on ground of one tone instead of on whatever the
           photograph happens to be doing at that scroll position. */
        .artium-gx-scrim {
          inset: 0;
          background: linear-gradient(180deg,
            rgba(15,16,18,0.30) 0%, rgba(15,16,18,0.18) 22%,
            rgba(15,16,18,0.34) 48%, rgba(15,16,18,0.72) 78%,
            rgba(15,16,18,0.92) 100%);
        }
        /* Grain. An SVG turbulence rather than an image — no request, and it
           tiles at any size without banding. */
        .artium-gx-grain {
          inset: 0; opacity: 0.035; mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)'/%3E%3C/svg%3E");
        }
        /* Dust in the light. Slow enough to be felt rather than watched. */
        .artium-gx-dust {
          width: 3px; height: 3px; border-radius: 50%;
          background: rgba(239,208,155,0.5);
          animation: artiumDust linear infinite;
        }
        @keyframes artiumDust {
          0%   { transform: translateY(0) translateX(0); opacity: 0; }
          12%  { opacity: 0.55; }
          88%  { opacity: 0.5; }
          100% { transform: translateY(-88vh) translateX(22px); opacity: 0; }
        }

        .artium-gx > *:not(.artium-gx-bd) { position: relative; z-index: 1; }

        /* ---- header ---- */
        .artium-gx-bar {
          display: flex; align-items: center; justify-content: space-between;
          width: 100%; max-width: 460px; margin: 0 auto;
          padding: calc(18px + env(safe-area-inset-top, 0px)) 24px 6px;
          flex-shrink: 0;
        }
        .artium-gx-bar-right { display: flex; align-items: center; gap: 16px; }
        /* The reference draws this ring as a hairline. MusicBtn sizes its
           border at 8.5% of the diameter for the white header, where it is a
           black ring that has to hold its own against the page; here that is
           three times too heavy, so the weight is overridden rather than the
           component's default changed. */
        .artium-gx-bar button[aria-label*="playlist"] {
          border: 1px solid rgba(239,208,155,0.62) !important;
          width: 34px !important; height: 34px !important;
          transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease;
        }
        .artium-gx-bar button[aria-label*="playlist"] svg { stroke: #EFD09B; }
        .artium-gx-bar button[aria-label*="playlist"]:hover {
          transform: scale(1.05);
          border-color: #EFD09B !important;
          box-shadow: 0 0 18px rgba(239,208,155,0.28);
        }
        /* Mark and number are one reading, so they are one colour. */
        .artium-gx-count { display: flex; align-items: center; gap: 7px; color: #FFFFFF; font-size: 15px; font-weight: 600; }
        .artium-gx-count svg { color: #FFFFFF; }

        /* ---- hero ---- */
        .artium-gx-main {
          flex: 1; width: 100%; max-width: 460px; margin: 0 auto;
          padding: 26px 24px 34px;
          display: flex; flex-direction: column; align-items: center;
        }
        /* The hero, remeasured against the reference. Everything here was
           running large: the eyebrow 178px wide against 118, the headline's
           first line 290 against 209, the tagline 182 against 151. Most of the
           eyebrow's excess was tracking, not type size — 0.34em is a lot of
           air across seventeen characters — so the letter-spacing comes down
           further than the size does. */
        .artium-gx-eyebrow {
          margin: 0; font-size: 10px; font-weight: 600; letter-spacing: 0.08em;
          text-transform: uppercase; color: #E6DAB0;
        }
        .artium-gx-h1 {
          margin: 16px 0 0; text-align: center; color: #FFFFFF;
          font-family: 'Cormorant Garamond', 'Didot', 'Bodoni 72', Georgia, serif; font-weight: 700;
          font-size: clamp(29px, 9.56vw, 40px); line-height: 1.05;
          letter-spacing: 0.005em;
        }
        .artium-gx-tag {
          margin: 14px 0 0; font-size: 13.3px; font-weight: 500; line-height: 1.6;
          color: #CFCFCF;
        }
        /* Divider: a hairline that fades out both ways, pinched by a lozenge. */
        .artium-gx-rule { display: flex; align-items: center; gap: 12px; margin: 26px 0 32px; width: 190px; }
        .artium-gx-rule span { flex: 1; height: 1px; background: linear-gradient(90deg, transparent, rgba(239,208,155,0.65)); }
        .artium-gx-rule span:last-child { background: linear-gradient(90deg, rgba(239,208,155,0.65), transparent); }
        .artium-gx-rule i { width: 5px; height: 5px; background: #EFD09B; transform: rotate(45deg); flex-shrink: 0; }

        /* ---- the trio ------------------------------------------------
           Measured off the reference rather than approximated. Every number
           below is a fraction of --tw, the stage's width, so the composition
           is the reference at any size:

             side circle      326/997 = 0.3270      centre  363 x 381
             side centre dx   335.5/997 = 0.3365    orbit R 281/997 = 0.2818
             side centre dy   +41 below the centre's, 0.0411
             stage height     595/997 = 0.5968

           The three overlap by ~9px at the reference's scale and the centre
           sits 41 higher than its flanks — that offset is what makes it read
           as enthroned rather than merely bigger. Absolute positioning,
           because flexbox cannot express overlap and a vertical offset at
           once.

           The stage breaks out of the padded column: the reference gives the
           trio 92% of its frame, which is wider than the gate's 460 reading
           column. */
        /* No breakout maths: the gate's main is a centred flex column, and a
           flex item wider than its column already overflows evenly on both
           sides. Shifting it as well moved it twice. */
        .artium-gx-stage {
          --tw: min(96vw, 680px);
          position: relative; width: var(--tw); height: calc(var(--tw) * 0.5955);
          flex-shrink: 0;
        }

        /* The orbit the whole composition hangs from: the node sits at its
           top, the closing dot at its bottom, and the two small dots where it
           passes the flanking circles. Behind everything. */
        /* Two arcs, not a ring. The reference draws the orbit only in the
           open air between the circles: each arc stops dead on the dot where
           it meets a flank's rim, and nothing is drawn across the cards. A
           full circle behind translucent glass showed through them. */
        .artium-gx-orbit {
          position: absolute; left: 50%; top: 51.47%;
          width: 56.48%; aspect-ratio: 1; transform: translate(-50%, -50%);
          overflow: visible; pointer-events: none;
        }
        .artium-gx-orbit path {
          fill: none; stroke: rgba(239,208,155,0.34); stroke-width: 1;
          vector-effect: non-scaling-stroke;
        }
        /* Above the circles, not beneath them: sitting on a flank's rim, half
           of each upper dot was being swallowed by the card it rests on. */
        .artium-gx-dot {
          position: absolute; width: 1.31%; aspect-ratio: 1; border-radius: 50%;
          background: #EFD09B; transform: translate(-50%, -50%);
          pointer-events: none; z-index: 3;
        }
        .artium-gx-node {
          position: absolute; left: 50%; top: 4.05%;
          width: 4.82%; aspect-ratio: 1; transform: translate(-50%, -50%);
          border-radius: 50%; border: 1.4px solid rgba(239,208,155,0.65);
          /* Opaque, and above the arcs: the reference shows the orbit meeting
             this ring and stopping, not running behind the bust. */
          background: #14151A; color: #EFD09B; z-index: 3;
          display: flex; align-items: center; justify-content: center;
          pointer-events: none;
        }
        /* The reference's bust dominates its ring — roughly seven tenths of the
           inner width, not half. */
        .artium-gx-node svg { width: 76%; height: 76%; }
        /* The dashed stems: node down to the centre circle, centre circle
           down to the closing dot. */
        .artium-gx-stem {
          position: absolute; left: 50%; width: 0;
          border-left: 1px dashed rgba(239,208,155,0.42);
          transform: translateX(-50%); pointer-events: none;
        }
        .artium-gx-stem--top { top: 8.62%; height: 9.9%; }
        .artium-gx-stem--bot { top: 83.5%; height: 14.55%; }

        .artium-gx-cc {
          position: absolute; transform: translate(-50%, -50%);
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; text-align: center;
          border-radius: 50%; cursor: pointer; font: inherit; color: inherit;
          border: 1px solid rgba(239,208,155,0.22);
          background:
            radial-gradient(125% 125% at 26% 8%,
              rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.058) 34%,
              rgba(255,255,255,0.024) 64%, rgba(255,255,255,0.008) 86%,
              rgba(255,255,255,0) 100%),
            rgba(19,20,25,0.96);
          box-shadow: 0 18px 45px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.09);
          transition: transform .4s cubic-bezier(.22,1,.36,1), border-color .35s ease, box-shadow .35s ease;
        }
        .artium-gx-cc:focus-visible { outline: 1px solid #EFD09B; outline-offset: 5px; }
        /* These are centred by transform, so they cannot share the entrance
           animation: artiumRise ends on transform none, and a filled
           animation outranks the element's own transform, so every circle
           snapped to its top-left corner and hover scale stopped working.
           They fade in on the same stagger instead, leaving transform to
           positioning and hover. */
        .artium-gx-cc.artium-gx-in { animation-name: artiumFadeIn; }
        @keyframes artiumFadeIn { from { opacity: 0; } to { opacity: 1; } }

        /* Flanks. 33.65% either side of the mid, and 4.11% lower. */
        /* top is a percentage of the stage's height (343/595), not of its
           width — percentages on top resolve against the containing block's
           height, and mixing the two is how the flanks ended up above their
           mark. */
        /* Wider and lower than before, so their inner edges run 24px (at the
           reference's scale) under the centre's ring — the reference tucks
           them beneath it, which is what makes the trio read as fused rather
           than as three shapes set side by side. */
        .artium-gx-cc--side {
          width: 32.50%; height: calc(var(--tw) * 0.3820); top: 57.05%;
          padding: 0 3.2%; z-index: 1;
          border-width: 1.6px; border-color: rgba(239,208,155,0.42);
        }
        .artium-gx-cc--left  { left: 17%; }
        .artium-gx-cc--right { left: 83%; }
        @keyframes artiumOrbit { to { transform: rotate(360deg); } }

        /* The throne: 363 x 381, so a whisker taller than wide — not the
           elongated ellipse it was. Above its flanks, and the only ring that
           is lit. */
        /* height off --tw, not a percentage: a percentage height resolves
           against the stage's height, which would make the throne 85px
           instead of 143 and turn the circle into a letterbox. */
        .artium-gx-cc--hero {
          width: 38.50%; height: calc(var(--tw) * 0.4050); left: 50%; top: 51.47%;
          padding: 0 4%; z-index: 2;
          border: 1.5px solid rgba(239,208,155,0.85);
          box-shadow:
            0 0 46px rgba(239,208,155,0.20), 0 22px 55px rgba(0,0,0,0.5),
            inset 0 0 24px rgba(239,208,155,0.08), inset 0 1px 0 rgba(255,255,255,0.12);
        }
        .artium-gx-cc:hover { transform: translate(-50%, -50%) scale(1.035); border-color: rgba(239,208,155,0.6); }
        .artium-gx-cc--hero:hover {
          border-color: rgba(239,208,155,1);
          box-shadow:
            0 0 60px rgba(239,208,155,0.26), 0 26px 62px rgba(0,0,0,0.55),
            inset 0 0 28px rgba(239,208,155,0.10), inset 0 1px 0 rgba(255,255,255,0.14);
        }

        /* Type scales with the stage, but with floors: at a 390 phone the
           stage is 374 and the reference's own ratios would put the body at
           7.3px. The floors hold it legible; below 620 the flanks' body copy
           is dropped entirely rather than shrunk past reading, because at
           1:2.7 there is no size at which those four lines both fit the
           circle and can be read. */
        /* Marks scale with the stage like everything else: 52/997 on the
           flanks, 60/997 in the centre. */
        /* Measured off the reference: every mark is 0.067 of the stage wide —
           conductor 66x71, piano 67x71, cap 67x43. They were at 0.052 and
           0.060, which is the whole of why they read as small. */
        .artium-gx-cc-mark { display: block; flex-shrink: 0; width: max(23px, calc(var(--tw) * 0.067)); height: auto; }
        .artium-gx-cc-eyebrow {
          font-family: 'Cormorant Garamond', 'Didot', 'Bodoni 72', Georgia, serif;
          font-weight: 600; line-height: 1; color: #FFFFFF; margin-top: 3%;
          font-size: max(9px, calc(var(--tw) * 0.0221));
        }
        .artium-gx-cc-title {
          font-family: 'Cormorant Garamond', 'Didot', 'Bodoni 72', Georgia, serif;
          font-weight: 700; color: #FFFFFF; line-height: 1.16; margin-top: 2%;
        }
        .artium-gx-cc--hero .artium-gx-cc-title { font-size: max(12px, calc(var(--tw) * 0.0341)); }
        .artium-gx-cc--side .artium-gx-cc-title { font-size: max(12px, calc(var(--tw) * 0.0271)); }
        /* Not a bare lozenge: the reference sets a hairline either side of it,
           the same rule that divides the hero above. */
        .artium-gx-cc-rule {
          display: flex; align-items: center; justify-content: center;
          gap: 5%; width: 62%; margin-top: 4%;
        }
        .artium-gx-cc-rule i { flex: 1; height: 1px; background: linear-gradient(90deg, transparent, rgba(239,208,155,0.55)); }
        .artium-gx-cc-rule i:last-child { background: linear-gradient(90deg, rgba(239,208,155,0.55), transparent); }
        .artium-gx-cc-rule b {
          width: max(4px, calc(var(--tw) * 0.0055)); aspect-ratio: 1;
          background: #EFD09B; transform: rotate(45deg); flex-shrink: 0;
        }
        .artium-gx-cc-desc {
          margin: 4% 0 0; font-weight: 500; color: #9C9C9C; line-height: 1.45;
          font-size: max(9px, calc(var(--tw) * 0.0191));
        }
        /* The reference carries the flanks' copy at every size, so it stays.
           Its own ratio puts it at 7.1px on a 390 screen; the floor holds it
           at 8, which is the largest that fits four lines inside a 118 x 136
           ellipse. */
        .artium-gx-cc--side .artium-gx-cc-desc { font-size: max(8px, calc(var(--tw) * 0.0191)); margin-top: 3%; }
        .artium-gx-go {
          margin-top: 5%; width: max(22px, calc(var(--tw) * 0.0461)); aspect-ratio: 1;
          border-radius: 50%; flex-shrink: 0;
          background: linear-gradient(160deg, #E3BB7A, #C99A55);
          color: #0F1012; display: flex; align-items: center; justify-content: center;
          transition: transform .3s ease, box-shadow .3s ease;
        }
        .artium-gx-go svg { width: 52%; height: 52%; }
        .artium-gx-cc:hover .artium-gx-go { transform: scale(1.1); box-shadow: 0 0 22px rgba(239,208,155,0.45); }

        /* ---- the trust bar ----
           One bar, three columns, hairlines between — 846/997 = 0.849 of the
           stage wide in the reference. It keeps that on any screen wide
           enough to read three columns; narrower than 620 it stacks, because
           three columns of 105px cannot carry this copy. */
        /* 846/997 of the stage in the reference — so it reads as sitting
           under the trio rather than as a separate slab. */
        .artium-gx-trust {
          /* 870/995 of the trio in the reference, and the trio is 96vw. */
          --tb: min(83.9vw, 585px);
          /* Centred by the column's align-items, not by auto margins.
             --tb is measured in vw, which counts the scrollbar, while this
             sits in a box with 24px of padding either side — so on a phone the
             bar is a few pixels wider than the space it occupies. Auto margins
             cannot centre an over-wide box: with no free space they resolve to
             zero and the whole overflow goes to the right, which is why it sat
             a few pixels right of the trio above it. align-items overflows
             evenly, which is how the trio has always centred. */
          width: var(--tb); margin: 26px 0 0; border-radius: 20px;
          border: 1px solid rgba(239,208,155,0.16);
          background: rgba(255,255,255,0.03);
          -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px);
          box-shadow: 0 14px 34px rgba(0,0,0,0.35);
          display: flex; flex-direction: row;
        }
        /* Three columns at every width, as the reference has it — it stacked
           below 620 before. Three columns of ~109px on a phone is the whole
           constraint on the type here, hence the floors. */
        .artium-gx-trust-item {
          flex: 1 1 0; min-width: 0; display: flex; align-items: center;
          gap: max(7px, calc(var(--tb) * 0.030)); padding: max(11px, calc(var(--tb) * 0.038)) max(9px, calc(var(--tb) * 0.032));
          text-align: left;
        }
        .artium-gx-trust-item + .artium-gx-trust-item { border-left: 1px solid rgba(255,255,255,0.09); }
        .artium-gx-trust-item svg { flex-shrink: 0; color: #E3BB7A; width: max(19px, calc(var(--tb) * 0.062)); height: auto; }
        /* Gold, not white: the reference sets the headings in the same
           champagne as the marks and the body beneath them in grey. */
        .artium-gx-trust-t { margin: 0; font-weight: 700; color: #E8C88A; line-height: 1.3; font-size: max(9.5px, calc(var(--tb) * 0.0292)); }
        .artium-gx-trust-d { margin: 2px 0 0; font-weight: 500; color: #9C9C9C; line-height: 1.4; font-size: max(8.5px, calc(var(--tb) * 0.0263)); }

        /* ---- login ---- */
        .artium-gx-note { margin: 34px 0 0; font-size: 14px; font-weight: 500; color: #8B8B8B; }
        .artium-gx-login {
          /* Sized to its text now: 16px of "Log in" with 10px of air above and
             below. Filled in the same amber as the cards' arrows, so the two
             ways forward on this screen are one colour.
             Below the 44px touch-target guideline by design — asked for
             twice, and the button is 318 wide, so it is only short in the
             axis that is easiest to hit. */
          margin-top: 14px; width: 93%; height: 36px;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          border-radius: 18px; cursor: pointer;
          border: 1px solid transparent;
          background: linear-gradient(160deg, #E3BB7A, #C99A55);
          color: #0F1012; font: inherit; font-size: 16px; font-weight: 600;
          transition: background .3s ease, box-shadow .3s ease, transform .3s ease;
        }
        .artium-gx-login:hover {
          background: linear-gradient(160deg, #EFCB8C, #D4A75F);
          box-shadow: 0 0 30px rgba(239,208,155,0.32); transform: scale(1.015);
        }
        .artium-gx-login:focus-visible { outline: 1px solid #EFD09B; outline-offset: 4px; }

        /* ---- footer ---- */
        /* One row, as the reference has it: the lockup, a rule, then the
           credit — 360px across and 30 tall. It was two stacked rows here,
           which read as a footer with a logo above it rather than as a single
           line of small print. */
        /* ---- footer ----
           Two rows under a ruled line, per the reference: the partnership and
           the social marks on the first, the small print and the copyright on
           the second, with a hairline between them. Measured off the
           reference at 768 wide, where the content spans 703 of it — the same
           91% this column already gives at 390.

           The reference's own type would scale to about 7.6px on a phone, so
           the sizes here are floored at what can be read and grow with the
           column from there. */
        .artium-gx-foot {
          flex-shrink: 0; width: 100%; max-width: 460px; margin: 0 auto;
          padding: 0 20px calc(16px + env(safe-area-inset-bottom, 0px));
          display: flex; flex-direction: column;
        }
        /* The ruled line that opens the footer: a hairline the full width with
           a lozenge set into its middle. */
        .artium-gx-foot-top {
          position: relative; height: 1px; width: 100%;
          background: rgba(255,255,255,0.10); margin-bottom: 16px;
        }
        .artium-gx-foot-top::after {
          content: ''; position: absolute; left: 50%; top: 50%;
          width: 6px; height: 6px; background: #EFD09B;
          transform: translate(-50%, -50%) rotate(45deg);
        }
        .artium-gx-foot-row {
          display: flex; align-items: center; justify-content: space-between;
          gap: 10px 16px; flex-wrap: wrap;
        }
        .artium-gx-foot-line { height: 1px; background: rgba(255,255,255,0.08); margin: 14px 0; }

        .artium-gx-partner {
          display: inline-flex; align-items: baseline; gap: 9px;
          font-size: 10.5px; font-weight: 500; color: #7C7C7C; line-height: 1;
        }
        /* Set in the gate's serif, in the gold the reference samples at
           #DAB688 — this is a name, not a link that happens to be here. */
        .artium-gx-partner b {
          color: #EFD09B; font-weight: 600; line-height: 1;
          font-family: 'Cormorant Garamond', 'Didot', 'Bodoni 72', Georgia, serif;
          font-size: 20px; letter-spacing: 0.01em;
        }

        /* The social marks, ringed as the reference draws them. */
        .artium-gx-social { display: inline-flex; align-items: center; gap: 9px; }
        .artium-gx-social a {
          width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
          border: 1px solid rgba(239,208,155,0.45); color: #E3BB7A;
          display: inline-flex; align-items: center; justify-content: center;
          transition: border-color .25s ease, color .25s ease, box-shadow .25s ease, transform .25s ease;
        }
        .artium-gx-social a:hover {
          border-color: #EFD09B; color: #EFD09B; transform: scale(1.06);
          box-shadow: 0 0 16px rgba(239,208,155,0.24);
        }

        .artium-gx-foot-links { display: inline-flex; align-items: center; gap: 9px; flex-wrap: wrap; }
        .artium-gx-foot-links span { font-size: 10.5px; font-weight: 500; color: #7C7C7C; line-height: 1.4; }
        .artium-gx-foot-links i { color: #4E4E4E; font-style: normal; font-size: 10px; }
        /* Grey, not gold — the reference samples it at #747575, the same tone
           as the links to its left. */
        .artium-gx-copy { font-size: 10px; font-weight: 500; color: #6E6E6E; line-height: 1.4; }

        /* ---- signup ------------------------------------------------------
           The eight steps, in the gate's language — the same grey ground,
           the same white/contour card, the same gold. */
        .artium-su {
          position: relative; min-height: 100vh; min-height: 100dvh;
          background: #F4F4F3;
          color: #232A3B; font-family: 'Jost', -apple-system, 'Segoe UI', Roboto, sans-serif;
        }
        /* The step's content sits on the gate's card: white, a contour
           border, a warm shadow — the same rim recipe as the gate's own
           cards/medallion and the student landing's step pills. */
        .artium-su-card {
          border-radius: 22px; padding: 22px 20px;
          border: 1px solid rgba(176,146,98,0.30);
          background: #FFFFFF;
          box-shadow: 0 20px 40px -22px rgba(150,115,55,0.38), inset 0 1px 0 #fff;
        }
        /* The stepper. A ring carrying "n of m" with the title beside it and
           the step after this one named underneath — so the flow answers
           "where am I", "what is this" and "what is coming" in one glance,
           which a bare rail of segments could only answer the first of. */
        /* Instrument tiles. auto-fill rather than a fixed column count, so the
           grid keeps roughly 84px cells and simply fits more per row as the
           screen widens — three on a small phone, eight on a laptop, without a
           breakpoint for each. */
        .artium-inst-grid {
          display: grid; gap: 8px;
          grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
        }
        .artium-inst {
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          padding: 10px 6px 8px; border-radius: 14px; cursor: pointer;
          border: 1px solid rgba(176,146,98,0.22);
          background: #FFFFFF;
          transition: border-color .16s ease, background .16s ease, transform .16s ease;
        }
        .artium-inst img {
          width: 38px; height: 38px; object-fit: contain;
          opacity: 0.72; transition: opacity .16s ease;
          /* The drawings are gold already; unselected they simply sit back. */
        }
        .artium-inst span {
          font-family: 'Jost', -apple-system, sans-serif;
          font-size: 10.5px; font-weight: 600; line-height: 1.25; text-align: center;
          color: #6A7080; transition: color .16s ease;
        }
        .artium-inst:hover:not(:disabled) { border-color: rgba(201,150,46,0.45); background: #FCFAF5; }
        .artium-inst:hover:not(:disabled) img { opacity: 0.9; }
        /* Two already chosen. Faded rather than hidden — the sheet is the point
           of this grid, and removing thirty-four drawings to say "not now"
           would cost more than the greying does. */
        .artium-inst:disabled { cursor: default; opacity: 0.34; }
        .artium-inst--on {
          border-color: rgba(201,150,46,0.65);
          background: rgba(201,150,46,0.10);
          box-shadow: 0 0 0 1px rgba(201,150,46,0.22) inset;
        }
        .artium-inst--on img { opacity: 1; }
        .artium-inst--on span { color: #232A3B; }
        @media (max-width: 380px) {
          .artium-inst-grid { grid-template-columns: repeat(auto-fill, minmax(74px, 1fr)); }
          .artium-inst img { width: 32px; height: 32px; }
        }
        .artium-su-head { display: flex; align-items: center; gap: 15px; margin-top: 22px; }
        .artium-su-ring { position: relative; width: 62px; height: 62px; flex-shrink: 0; }
        .artium-su-ring svg { width: 100%; height: 100%; display: block; }
        .artium-su-ring svg circle { transition: stroke-dashoffset .5s cubic-bezier(.22,1,.36,1); }
        .artium-su-ring span {
          position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
          font-family: 'Jost', -apple-system, sans-serif; font-size: 11.5px; font-weight: 700;
          color: #232A3B; letter-spacing: 0.01em; white-space: nowrap;
        }
        .artium-su-head-text { min-width: 0; flex: 1; }
        .artium-su-title {
          margin: 0; color: #232A3B; line-height: 1.12;
          font-family: 'Playfair Display', serif;
          font-weight: 600; font-size: clamp(21px, 6.4vw, 30px);
        }
        .artium-su-next {
          margin: 5px 0 0; font-size: 11.5px; font-weight: 500; color: #6A7080; line-height: 1.35;
        }
        .artium-su-next b { color: #B8862E; font-weight: 600; }

        /* Back and Next, pinned. On a form this long the action should not
           have to be scrolled to. */
        .artium-su-nav {
          position: sticky; bottom: 0; z-index: 20; margin-top: 22px;
          display: flex; align-items: center; gap: 11px;
          padding: 12px 24px calc(14px + env(safe-area-inset-bottom, 0px));
          background: linear-gradient(180deg, rgba(244,244,243,0) 0%, rgba(244,244,243,0.92) 26%, #F4F4F3 100%);
        }
        .artium-su-back {
          flex: 0 0 auto; padding: 12px 22px; border-radius: 999px; cursor: pointer;
          border: 1px solid rgba(176,146,98,0.30); background: #FFFFFF;
          color: #3A4152; font: inherit; font-size: 14px; font-weight: 600;
          transition: border-color .25s ease, color .25s ease, background .25s ease;
        }
        .artium-su-back:hover { border-color: rgba(201,150,46,0.55); color: #C9962E; background: #FCFAF5; }
        .artium-su-next-btn {
          flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          padding: 13px 22px; border-radius: 999px; border: none; cursor: pointer;
          background: linear-gradient(180deg, #EFD08A 0%, #DBAB4C 55%, #C9962E 100%); color: #3A2E10;
          font: inherit; font-size: 15px; font-weight: 700;
          box-shadow: 0 12px 24px -10px rgba(176,126,31,0.55);
          transition: background .3s ease, box-shadow .3s ease, transform .2s ease;
        }
        .artium-su-next-btn:hover:not(:disabled) { background: linear-gradient(180deg, #F4DBA0 0%, #E4BB63 55%, #D3A63B 100%); transform: translateY(-1px); }
        .artium-su-next-btn:disabled {
          background: rgba(176,146,98,0.15); color: #9A9A9A;
          box-shadow: none; cursor: not-allowed;
        }


        /* The globe on the conservatory step, framed as the network page
           frames it. Height-relative ring, for the same reason as there. */
        .artium-su-globe { position: relative; width: 100%; margin: 0 0 14px; }
        .artium-su-globe .artium-aw-ring--a { height: 86%; }

        /* One pin at a time on the signup globe, lit and then let go. Every
           school pinned at once was a pile; one arriving somewhere new every
           few seconds says the same thing — this is a network with reach —
           and reads as alive rather than as clutter. The fade is on the pin
           itself so it is already leaving before the next one lands. */
        @keyframes artiumPinBlink {
          0%   { opacity: 0; transform: translate(-50%, -100%) scale(0.72); }
          14%  { opacity: 1; transform: translate(-50%, -100%) scale(1); }
          76%  { opacity: 1; transform: translate(-50%, -100%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -100%) scale(0.9); }
        }
        .artium-roampin { animation: artiumPinBlink 3s ease-in-out forwards; }

        /* The three doors. Each is one tap and says plainly what it will ask
           for, so the choice is made on facts the visitor already knows about
           themselves rather than on jargon about verification methods. */
        .artium-su-doors { display: flex; flex-direction: column; gap: 10px; }
        .artium-su-door {
          display: flex; align-items: center; gap: 13px; width: 100%;
          padding: 14px 15px; border-radius: 16px; cursor: pointer; text-align: left;
          border: 1px solid rgba(176,146,98,0.25); background: #FFFFFF;
          color: inherit; font: inherit;
          transition: border-color .25s ease, background .25s ease, transform .25s ease;
        }
        .artium-su-door:hover { border-color: rgba(201,150,46,0.5); background: #FCFAF5; transform: translateY(-2px); }
        .artium-su-door-i {
          width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
          border: 1px solid rgba(201,150,46,0.45); color: #C9962E;
          display: flex; align-items: center; justify-content: center;
        }
        .artium-su-door-t {
          margin: 0; font-family: 'Playfair Display', serif;
          font-weight: 600; font-size: 16px; color: #232A3B; line-height: 1.2;
        }
        .artium-su-door-d { margin: 3px 0 0; font-size: 11.5px; color: #6A7080; line-height: 1.45; }
        /* The chosen door, restated at the top of the panel it opened, with
           the way back out. */
        .artium-su-chosen {
          display: flex; align-items: center; gap: 11px; margin-bottom: 14px;
          padding: 11px 14px; border-radius: 14px;
          border: 1px solid rgba(201,150,46,0.35); background: rgba(201,150,46,0.07);
        }
        .artium-su-chosen p { margin: 0; font-size: 12.5px; color: #B8862E; font-weight: 600; line-height: 1.35; }
        .artium-su-change {
          margin-left: auto; flex-shrink: 0; padding: 6px 12px; border-radius: 999px;
          border: 1px solid rgba(176,146,98,0.30); background: none; color: #6A7080;
          font: inherit; font-size: 11.5px; font-weight: 600; cursor: pointer;
        }
        .artium-su-change:hover { border-color: rgba(201,150,46,0.55); color: #C9962E; }

        /* ---- forms ------------------------------------------------------
           The signup fields are styled inline, which cannot express :focus,
           a placeholder colour, or what the browser does to an autofilled
           input. All three live here. */
        input::placeholder, textarea::placeholder { color: #9A9A9A; opacity: 1; }
        input:focus, textarea:focus, select:focus {
          border-color: rgba(201,150,46,0.55) !important;
          box-shadow: 0 0 0 3px rgba(201,150,46,0.14) !important;
        }
        /* Chrome paints autofilled fields a solid pale yellow and sets the
           text near-black — on this light theme both are already close to
           what the field wants, so only the caret/text colour is forced
           back to ink rather than faking the fill too. */
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-text-fill-color: #232A3B;
          -webkit-box-shadow: 0 0 0 1000px #FFFFFF inset;
          caret-color: #232A3B;
          transition: background-color 9999s ease-out 0s;
        }
        /* The date and time pickers ship a black glyph — correct as-is on a
           light ground, so no inversion needed any more. */
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="time"]::-webkit-calendar-picker-indicator { cursor: pointer; }
        select option { background: #FFFFFF; color: #232A3B; }

        /* ---- Artium's World -------------------------------------------
           The network page, in the gate's language. Matte black ground, the
           globe floating on it, and everything below set on the same glass
           and champagne the entry gate uses. */
        .artium-aw {
          position: relative; min-height: 100vh; min-height: 100dvh;
          background: #F4F4F3;
          color: #232A3B; font-family: 'Jost', -apple-system, 'Segoe UI', Roboto, sans-serif;
          display: flex; flex-direction: column; overflow-x: hidden;
          padding-bottom: calc(62px + env(safe-area-inset-bottom, 0px));
        }
        .artium-aw-in { width: 100%; max-width: 560px; margin: 0 auto; padding: 0 18px; }

        .artium-aw-bar {
          display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
          padding: calc(12px + env(safe-area-inset-top, 0px)) 18px 10px;
          width: 100%; max-width: 560px; margin: 0 auto;
        }
        .artium-aw-round {
          width: 34px; height: 34px; border-radius: 50%; padding: 0; flex-shrink: 0;
          border: 1px solid rgba(176,146,98,0.45); background: #FFFFFF;
          color: #C9962E; cursor: pointer;
          display: inline-flex; align-items: center; justify-content: center;
          transition: border-color .25s ease, box-shadow .25s ease, transform .25s ease;
        }
        .artium-aw-round:hover { border-color: #C9962E; box-shadow: 0 4px 16px rgba(150,115,55,0.26); transform: scale(1.05); }
        .artium-aw-bar-right { display: flex; align-items: center; justify-content: flex-end; gap: 12px; }
        .artium-aw-count { display: inline-flex; align-items: center; gap: 6px; color: #232A3B; font-size: 14px; font-weight: 600; }

        /* Network page's own top row, landing-style: ivory puck back button,
           the gate's crossbar-less-A wordmark, a passive member count (not a
           chip) and the avatar. Sits above "Welcome, {name}" now, the same
           position the gate and the landing header hold theirs. Distinct
           classes from the artium-lp and artium-aw-round families on
           purpose — this bar is drawn by the page below (App's map tab
           render), not by Landing or by MapScreen's old internal header,
           and restyling artium-aw-round itself would have reached every
           back button that class draws across signup, messages and
           profile too. */
        .artium-net-bar {
          display: flex; align-items: center; gap: 11px;
          width: 100%; max-width: 560px; margin: 0 auto;
          position: relative; z-index: 320;
          padding: calc(12px + env(safe-area-inset-top, 0px)) 18px 10px;
        }
        .artium-net-puck {
          width: 34px; height: 34px; flex-shrink: 0; border-radius: 50%; padding: 0;
          display: inline-flex; align-items: center; justify-content: center;
          color: #232A3B; cursor: pointer; position: relative;
          background: radial-gradient(circle at 35% 28%, #FFFFFF 0%, #FCF8EF 55%, #F1E8D6 100%);
          border: 1px solid rgba(255,255,255,.85);
          box-shadow:
            0 8px 14px -4px rgba(150,115,55,.38),
            0 2px 4px rgba(150,115,55,.14),
            inset 0 2px 2px #fff,
            inset 0 -3px 5px rgba(176,146,98,.28);
          transition: box-shadow .25s ease, transform .25s ease;
        }
        .artium-net-puck:hover { box-shadow: 0 10px 18px -4px rgba(150,115,55,.42), 0 2px 4px rgba(150,115,55,.16), inset 0 2px 2px #fff, inset 0 -3px 5px rgba(176,146,98,.28); }
        .artium-net-word {
          font-family: 'Jost', system-ui, sans-serif;
          font-size: 19px; font-weight: 600; color: #232A3B;
          letter-spacing: .18em; text-transform: uppercase;
          display: inline-flex; align-items: center; white-space: nowrap;
        }
        .artium-net-word svg { width: .72em; height: .72em; margin-right: .2em; display: block; }
        .artium-net-right { display: flex; align-items: center; gap: 12px; margin-left: auto; }
        .artium-net-count { display: inline-flex; align-items: center; gap: 7px; color: #6A7080; font-size: 14px; font-weight: 400; cursor: default; }
        .artium-net-count svg { color: #6A7080; }
        .artium-net-bell-badge {
          position: absolute; top: -3px; right: -3px; min-width: 16px; height: 16px; padding: 0 3px;
          border-radius: 999px; display: flex; align-items: center; justify-content: center;
          background: linear-gradient(180deg, #EFD08A 0%, #DBAB4C 55%, #C9962E 100%);
          color: #3A2E10; font-size: 10px; font-weight: 700; border: 1px solid #fff;
        }

        /* Eyebrow with a rule running out either side. */
        .artium-aw-eyebrow {
          display: flex; align-items: center; gap: 12px; margin: 6px 0 0;
          font-size: 10px; font-weight: 600; letter-spacing: 0.24em;
          text-transform: uppercase; color: #B8862E; white-space: nowrap;
        }
        .artium-aw-eyebrow i { flex: 1; height: 1px; background: linear-gradient(90deg, transparent, rgba(201,150,46,0.5)); }
        .artium-aw-eyebrow i:last-child { background: linear-gradient(90deg, rgba(201,150,46,0.5), transparent); }
        .artium-aw-h1 {
          /* Matched to the landing's "Every Conservatory. One Network." */
          margin: 10px 0 0; text-align: center; color: #232A3B;
          font-family: 'Playfair Display', serif;
          font-weight: 500; font-size: clamp(20px, 6.0vw, 30px);
          line-height: 1.16; letter-spacing: 0.005em;
        }
        .artium-aw-sub { margin: 8px 0 0; text-align: center; font-size: 12.5px; font-weight: 500; color: #6A7080; line-height: 1.5; }

        /* The globe, and the gold orbits the reference draws around it. The
           rings are CSS ellipses rather than geometry in the scene: they sit
           in front of and behind nothing, so three.js has no opinion worth
           having here, and a rotated border is one line. */
        .artium-aw-stage { position: relative; width: 100%; margin: 6px 0 0; }
        /* Sized off the stage's HEIGHT: a width-relative ring on a stage
           wider than it is tall runs off both edges of the phone. */
        .artium-aw-ring {
          position: absolute; left: 50%; top: 52%; pointer-events: none;
          border: 1px solid rgba(201,150,46,0.30); border-radius: 50%;
          transform-style: preserve-3d;
        }
        .artium-aw-ring--a { height: 84%; aspect-ratio: 1; transform: translate(-50%,-50%) rotateX(75deg) rotate(-14deg); border-color: rgba(201,150,46,0.40); }
        .artium-aw-ring--b { height: 97%; aspect-ratio: 1; transform: translate(-50%,-50%) rotateX(71deg) rotate(13deg); border-color: rgba(201,150,46,0.22); }
        .artium-aw-glow {
          position: absolute; left: 50%; top: 50%; width: 96%; height: 96%;
          transform: translate(-50%,-50%); border-radius: 50%; pointer-events: none;
          box-shadow: 0 0 70px 12px rgba(201,150,46,0.10);
        }

        /* Stats: three columns, hairlines between, as the reference draws. */
        /* The count bar per the reference: one white outer slab holding
           three soft ivory inner slabs, gold hairlines between them; each
           cell stacks a tinted disc with its gold mark, a serif figure, a
           letter-spaced caps label, and a short gold dash beneath. */
        .artium-aw-stats {
          display: flex; align-items: stretch; gap: 13px; margin-top: 4px;
          border-radius: 26px; padding: 12px;
          background: #FFFFFF; border: 1px solid rgba(176,146,98,0.22);
          box-shadow: 0 18px 34px -18px rgba(150,115,55,0.38), inset 0 1px 0 #fff;
        }
        .artium-aw-stat {
          flex: 1 1 0; min-width: 0; padding: 14px 4px 12px; text-align: center;
          position: relative; border-radius: 20px;
          background: linear-gradient(180deg, #FDFCFA 0%, #F7F4EE 100%);
          box-shadow: inset 0 1px 1px #fff, inset 0 -2px 5px rgba(176,146,98,.10);
        }
        .artium-aw-stat + .artium-aw-stat::before {
          content: ""; position: absolute; left: -7px; top: 14%; bottom: 14%;
          width: 1px; background: rgba(201,150,46,.35);
        }
        .artium-aw-stat-row { display: flex; flex-direction: column; align-items: center; gap: 9px; }
        .artium-aw-stat-tile {
          width: 48px; height: 48px; border-radius: 50%; flex-shrink: 0;
          display: inline-flex; align-items: center; justify-content: center;
          background: radial-gradient(circle at 38% 30%, rgba(201,150,46,.10), rgba(201,150,46,.20));
          color: #C9962E;
        }
        .artium-aw-stat-n {
          font-family: 'Playfair Display', serif;
          font-size: 25px; font-weight: 700; color: #232A3B; line-height: 1;
          font-variant-numeric: tabular-nums;
        }
        .artium-aw-stat-l {
          margin: 6px 0 0; font-size: 10.5px; font-weight: 600; color: #565B66;
          letter-spacing: .13em; text-transform: uppercase;
        }
        .artium-aw-stat-l::after {
          content: ""; display: block; width: 36px; height: 4px; border-radius: 2px;
          margin: 9px auto 0; background: #C9962E;
        }

        /* Segmented control. The active half is the gold pill the gate fills
           its buttons with; the track is a light ground rather than dark
           glass. */
        .artium-aw-seg {
          display: flex; margin-top: 14px; padding: 4px; gap: 4px;
          border-radius: 999px; border: 1px solid rgba(176,146,98,0.30);
          background: #F2F2F0;
        }
        .artium-aw-seg button {
          flex: 1 1 0; padding: 9px 6px; border: none; border-radius: 999px; cursor: pointer;
          background: transparent; color: #6A7080; font: inherit; font-size: 12.5px; font-weight: 600;
          transition: background .3s ease, color .3s ease, box-shadow .3s ease;
        }
        .artium-aw-seg button[data-on="1"] {
          background: linear-gradient(180deg, #EFD08A 0%, #DBAB4C 55%, #C9962E 100%); color: #3A2E10;
          box-shadow: 0 4px 16px rgba(176,126,31,0.35);
        }

        .artium-aw-find { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
        .artium-aw-field {
          flex: 1; min-width: 0; display: flex; align-items: center; gap: 9px;
          height: 44px; padding: 0 15px; border-radius: 999px;
          border: 1px solid rgba(176,146,98,0.30); background: #FFFFFF;
        }
        .artium-aw-field svg { color: #6A7080; flex-shrink: 0; }
        .artium-aw-field input {
          flex: 1; min-width: 0; background: none; border: none; outline: none;
          color: #232A3B; font: inherit; font-size: 15.5px;
        }
        .artium-aw-field input::placeholder { color: #9A9A9A; }
        .artium-aw-filter {
          width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0; padding: 0;
          border: 1px solid rgba(201,150,46,0.55); background: #FFFFFF; color: #C9962E;
          display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
          transition: border-color .25s ease, box-shadow .25s ease;
        }
        .artium-aw-filter:hover { border-color: #C9962E; box-shadow: 0 4px 16px rgba(150,115,55,0.25); }
        .artium-aw-filter[data-on="1"] {
          background: linear-gradient(180deg, #EFD08A 0%, #DBAB4C 55%, #C9962E 100%);
          color: #3A2E10; border-color: transparent;
          box-shadow: 0 4px 16px rgba(176,126,31,0.35);
        }
        .artium-aw-hint { margin: 14px 0 0; text-align: center; font-size: 17.5px; font-weight: 500; color: #6A7080; line-height: 1.5; }

        /* The slab under the stats — a compass in a gold tile, a bold line
           over a muted one. Same cream/gold wash as the mock, a fine gold
           hairline instead of the stats bar's neutral one so it reads as
           its own quieter surface rather than a fourth stat cell. */
        .artium-aw-explore {
          display: flex; align-items: center; gap: 12px; margin-top: 14px;
          padding: 14px 16px; border-radius: 16px;
          background: linear-gradient(135deg, rgba(201,150,46,0.10) 0%, rgba(201,150,46,0.04) 100%);
          border: 1px solid rgba(201,150,46,0.35);
        }
        .artium-aw-explore-tile {
          width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
          display: inline-flex; align-items: center; justify-content: center;
          background: rgba(201,150,46,0.16); color: #C9962E;
        }
        .artium-aw-explore-copy { min-width: 0; }
        .artium-aw-explore-copy b { display: block; font-size: 14.5px; font-weight: 700; color: #232A3B; line-height: 1.35; }
        .artium-aw-explore-copy span { display: block; margin-top: 2px; font-size: 13px; font-weight: 500; color: #6A7080; line-height: 1.4; }

        .artium-aw-listhead { display: flex; align-items: center; gap: 9px; margin: 22px 0 12px; }
        .artium-aw-listhead h2 {
          margin: 0; font-family: 'Playfair Display', serif;
          font-weight: 700; font-size: 21px; color: #232A3B; line-height: 1;
        }
        .artium-aw-listhead span { font-size: 11.5px; color: #6A7080; }
        .artium-aw-sort {
          margin-left: auto; display: inline-flex; align-items: center; gap: 6px;
          height: 34px; padding: 0 12px; border-radius: 999px; cursor: pointer;
          border: 1px solid rgba(176,146,98,0.30); background: #FFFFFF;
          color: #6A7080; font: inherit; font-size: 12px; font-weight: 500;
        }

        .artium-aw-list { display: flex; flex-direction: column; gap: 9px; }
        .artium-aw-row {
          display: flex; align-items: center; gap: 13px; width: 100%;
          padding: 11px 13px; border-radius: 16px; cursor: pointer; text-align: left;
          border: 1px solid rgba(176,146,98,0.25);
          background: #FFFFFF;
          color: inherit; font: inherit;
          transition: border-color .25s ease, background .25s ease, transform .25s ease;
        }
        .artium-aw-row:hover { border-color: rgba(201,150,46,0.5); background: #FCFAF5; transform: translateY(-2px); }
        /* A monogram, not a logo: the schools have no marks in this project,
           and admins can add more at any time — a lettered tile is the one
           treatment that covers every row without a missing-image hole. */
        .artium-aw-mono {
          width: 58px; height: 44px; border-radius: 10px; flex-shrink: 0;
          border: 1px solid rgba(176,146,98,0.30); background: #F4F4F3;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Playfair Display', serif;
          font-weight: 600; font-size: 13px; letter-spacing: 0.02em; color: #B8862E;
          text-align: center; line-height: 1.05; padding: 0 4px; overflow: hidden;
        }
        .artium-aw-row-body { flex: 1; min-width: 0; }
        .artium-aw-row-t {
          margin: 0; font-family: 'Playfair Display', serif;
          font-weight: 600; font-size: 16px; color: #232A3B; line-height: 1.2;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .artium-aw-sort[data-on="1"] { border-color: rgba(201,150,46,0.55); color: #C9962E; }
        .artium-aw-row-c { margin: 3px 0 0; display: flex; align-items: center; gap: 4px; font-size: 11.5px; color: #6A7080; }
        .artium-aw-row-c svg { color: #6A7080; flex-shrink: 0; }
        .artium-aw-badge {
          flex-shrink: 0; min-width: 52px; padding: 6px 8px; border-radius: 11px; text-align: center;
          border: 1px solid rgba(176,146,98,0.25); background: #F4F4F3;
        }
        .artium-aw-badge b { display: block; font-size: 15px; font-weight: 700; color: #232A3B; line-height: 1; }
        .artium-aw-badge span { display: block; margin-top: 3px; font-size: 9.5px; color: #6A7080; }
        .artium-aw-row > svg:last-child { color: #9A9A9A; flex-shrink: 0; }
        /* The instrument, drawn. It sits between the name and the chevron, and
           it is the one gold thing in the row, so it needs no label. */
        /* A fixed width, not a shrink-to-fit one: it makes the drawings and
           their captions line up as a column down the roster, so the eye runs
           straight down the instruments instead of tracking a ragged edge. */
        .artium-aw-inst {
          flex-shrink: 0; width: 64px;
          display: flex; flex-direction: column; align-items: center; gap: 3px;
        }
        .artium-aw-inst-art { display: flex; align-items: center; gap: 6px; }
        .artium-aw-inst-name {
          font-family: 'Jost', -apple-system, sans-serif;
          font-size: 9.5px; font-weight: 600; letter-spacing: 0.02em;
          line-height: 1.2; text-align: center;
          color: rgba(150,115,55,0.85);
          /* Two lines, so "Double Bass" and "Tubular Bells" wrap inside the
             column rather than widening it and stealing the name's room. */
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
          overflow: hidden;
        }
        /* Reads as an offer at a glance — the one filled, warm thing in a row
           of outlines — without being the size of a button. */
        .artium-aw-teach {
          flex-shrink: 0; margin-right: 2px;
          font-size: 8.5px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase;
          padding: 2px 7px; border-radius: 999px;
          background: linear-gradient(180deg, #EFD08A 0%, #DBAB4C 55%, #C9962E 100%); color: #3A2E10;
        }
        .artium-aw-inst img {
          width: 54px; height: 54px; object-fit: contain; display: block;
          /* Gold line art already has full contrast on white — none of the
             black-ground "lift it off the dark" halo trick this used to need
             is wanted here, so this is a plain, quiet drop-shadow for a
             touch of depth rather than three stacked glows. */
          opacity: 1;
          filter: drop-shadow(0 1px 2px rgba(150,115,55,0.25));
          transition: filter .25s ease, transform .25s ease;
        }
        .artium-aw-row:hover .artium-aw-inst img {
          filter: drop-shadow(0 2px 4px rgba(150,115,55,0.35));
          transform: scale(1.04);
        }
        /* Two fit in the width of one and a half rather than pushing the row
           wider — the name is what must not be squeezed. */
        .artium-aw-inst[data-two="1"] { width: 94px; }
        .artium-aw-inst[data-two="1"] .artium-aw-inst-art { gap: 1px; }
        .artium-aw-inst[data-two="1"] img { width: 42px; height: 42px; }
        @media (max-width: 380px) {
          .artium-aw-inst { width: 56px; }
          .artium-aw-inst img { width: 46px; height: 46px; }
          .artium-aw-inst[data-two="1"] { width: 78px; }
          .artium-aw-inst[data-two="1"] img { width: 36px; height: 36px; }
        }
        .artium-aw-empty { padding: 26px 4px; text-align: center; font-size: 12.5px; color: #6A7080; }

        /* Bottom bar. Fixed, because the reference has it pinned and this page
           scrolls a long way. Every screen is light now, so the base rule
           IS the floating inset slab the mock draws (rounded corners, warm
           shadow) rather than a full-width dark bar with a separate
           "--light" variant — the modifier class below is kept (redundant,
           re-applies the same values) rather than removed, since the
           BottomTabs "light" prop and its call site are still wired to it
           and touching that was more risk than the duplication is worth. */
        .artium-aw-tabs {
          /* Glued to the screen's bottom edge, full bleed — no inset, no
             corners, no gap; the safe area is padded inside the bar. */
          position: fixed; z-index: 40;
          display: flex; align-items: stretch;
          left: 0; right: 0; bottom: 0;
          border-radius: 0;
          padding-bottom: env(safe-area-inset-bottom, 0px);
          background: linear-gradient(180deg, #FCFCFB 0%, #F2F2F0 70%, #EAEAE8 100%);
          border: none; border-top: 1px solid rgba(176,146,98,.30);
          box-shadow: 0 -8px 22px -14px rgba(150,115,55,.35), inset 0 1px 0 #fff;
        }
        .artium-aw-tabs button {
          flex: 1 1 0; display: flex; flex-direction: column; align-items: center; gap: 3px;
          padding: 9px 2px 8px; border: none; background: none; cursor: pointer;
          color: #6A7080; font: inherit; font-size: 9.5px; font-weight: 500;
          transition: color .25s ease;
        }
        .artium-aw-tabs button[data-on="1"] { color: #C9962E; }
        .artium-aw-tabs button[data-on="1"]::after {
          content: ''; position: absolute; bottom: calc(env(safe-area-inset-bottom, 0px) + 2px);
          width: 22px; height: 2px; border-radius: 2px; background: #C9962E;
        }
        .artium-aw-tabs button { position: relative; }
        /* Anything the fixed bar can cover reserves its height. One number,
           one place, so a screen added later inherits the clearance by taking
           the class rather than by remembering the arithmetic. */
        .artium-has-tabs { padding-bottom: calc(62px + env(safe-area-inset-bottom, 0px)); }

        /* Redundant with the base rule above now that every screen is
           light (kept rather than removed — see the comment on the base
           rule). */
        .artium-aw-tabs--light {
          left: 14px; right: 14px;
          bottom: calc(10px + env(safe-area-inset-bottom, 0px));
          padding-bottom: 0;
          border-radius: 24px;
          background: linear-gradient(180deg, #FCFCFB 0%, #F2F2F0 70%, #EAEAE8 100%);
          border: 1px solid rgba(176,146,98,.30);
          border-top: 1px solid rgba(176,146,98,.30);
          box-shadow: 0 14px 30px -14px rgba(150,115,55,.38), inset 0 1px 0 #fff;
        }
        .artium-aw-tabs--light button { color: #6A7080; }
        .artium-aw-tabs--light button[data-on="1"] { color: #C9962E; }
        .artium-aw-tabs--light button[data-on="1"]::after { background: #C9962E; }

        /* Profile top: identity left, cover video right, the video column
           lined up with the repertoire card in the grid underneath. */
        .artium-pf-top {
          display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
          align-items: start; margin-bottom: 12px;
        }
        /* Nothing to put on the right — a public profile with no video — so
           the identity block takes the width rather than leaving a hole. */
        .artium-pf-top[data-solo="1"] { grid-template-columns: 1fr; }
        /* One column under a laptop: side by side, the video is too small to
           watch and the name too narrow to read. */
        @media (max-width: 900px) {
          .artium-pf-top { grid-template-columns: 1fr; }
        }

        /* ---- entrance ---- */
        /* The hero settles, then the cards arrive in order. Short distances and
           a soft curve: at this weight of design, movement should be noticed
           only in its absence. */
        @keyframes artiumRise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        .artium-gx-in { opacity: 0; animation: artiumRise .85s cubic-bezier(.22,1,.36,1) forwards; }
        .artium-gx-in--1 { animation-delay: .05s; }
        .artium-gx-in--2 { animation-delay: .16s; }
        .artium-gx-in--3 { animation-delay: .27s; }
        .artium-gx-in--4 { animation-delay: .40s; }
        .artium-gx-in--5 { animation-delay: .52s; }
        .artium-gx-in--6 { animation-delay: .64s; }
        .artium-gx-in--7 { animation-delay: .76s; }

        @media (max-width: 340px) { .artium-gx-pair { flex-direction: column; } }
        @media (prefers-reduced-motion: reduce) {
          .artium-gx-in { opacity: 1; animation: none; }
          .artium-gx-dust { animation: none; opacity: 0; }
          /* The rings hold their position rather than vanishing — they are
             part of the drawing, and only their turning is the motion. */
          .artium-gx-orb::before, .artium-gx-orb::after { animation: none; }
          .artium-gx-card, .artium-gx-go, .artium-gx-login { transition: none; }
          .artium-gx-card:hover { transform: none; }
          .artium-gx-card:hover .artium-gx-go { transform: none; }
          .artium-gx-login:hover { transform: none; }
        }

        .artium-map, .artium-map .leaflet-container { border-radius: inherit; }
        /* OSM ships one set of tiles and they are already drawn for a light
           page — the invert/hue-rotate that used to fake a dark map here is
           gone; the tiles render in their own natural colors now, which is
           what the whole app's light ground wants anyway. */
        .artium-map .leaflet-container { background: #F4F4F3; }
        /* Not scoped to .artium-map: the zoom control lives in its own pane,
           and the signup's map (the globe on the conservatory step) does
           not carry that class. */
        .leaflet-control-zoom a, .leaflet-bar a {
          background: #FFFFFF !important; color: #232A3B !important;
          border-bottom-color: rgba(176,146,98,0.25) !important;
        }
        .leaflet-control-zoom a:hover, .leaflet-bar a:hover { background: #FCFAF5 !important; color: #C9962E !important; }
        .leaflet-bar { border: 1px solid rgba(176,146,98,0.30) !important; box-shadow: 0 4px 14px rgba(150,115,55,0.20) !important; }
        .leaflet-popup-content-wrapper, .leaflet-popup-tip { background: #FFFFFF !important; color: #232A3B !important; }
        .artium-map .leaflet-control-zoom { border: 1px solid #E6EBF1 !important; box-shadow: 0 2px 8px rgba(0,0,0,0.32) !important; border-radius: 8px !important; overflow: hidden; }
        .artium-map .leaflet-control-zoom a { background: #FFFFFF !important; color: #0A2540 !important; border-color: #E6EBF1 !important; font-weight: 600 !important; }
        .artium-map .leaflet-control-zoom a:hover { background: #F6F9FC !important; }
        .artium-map .leaflet-control-attribution { display: none !important; }
        .artium-map .leaflet-tooltip { background: #FFFFFF !important; border: 1px solid #E6EBF1 !important; color: #0A2540 !important; border-radius: 10px !important; box-shadow: 0 4px 20px rgba(0,0,0,0.48) !important; padding: 8px 14px !important; font-family: Inter, sans-serif !important; font-size: 13px !important; }
        .artium-map .leaflet-tooltip-top:before { border-top-color: #E6EBF1 !important; }
        .artium-map .leaflet-popup-content-wrapper { background: #FFFFFF !important; border: 1px solid #E6EBF1 !important; border-radius: 12px !important; box-shadow: 0 4px 20px rgba(0,0,0,0.48) !important; padding: 0 !important; }
        /* width:auto overrides the inline width Leaflet computes, which also
           defeats its minWidth prop — so the floor has to be set here too, or
           the short locked-state card collapses to a narrow column. */
        .artium-map .leaflet-popup-content { margin: 10px 12px !important; width: auto !important; min-width: 232px !important; font-family: Inter, sans-serif !important; }
        .artium-map .leaflet-popup-tip { background: #FFFFFF !important; border: 1px solid #E6EBF1 !important; }
        .artium-map .leaflet-popup-close-button { color: #425466 !important; }
        .artium-pin { background: transparent !important; border: none !important; }

        /* Affordance for the pin. The card that held it is gone, so every
           signal is on the pin itself: it rises on hover and bobs at rest. The
           bob moved to the wrapper — the globe and the count sit on top of the
           artwork and have to rise with it, not stay behind while it moves. */
        .artium-explore { transition: transform .2s ease; }
        .artium-explore:active { transform: translateY(-1px); }
        .artium-explore:focus-visible { outline: 2px solid #FFC629; outline-offset: 6px; border-radius: 14px; }
        .artium-globepin { position: relative; display: block; transition: transform .2s ease; animation: artiumBob 3.2s ease-in-out infinite; }
        .artium-explore:hover .artium-globepin { animation: none; transform: translateY(-6px) scale(1.05); }
        @keyframes artiumBob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }

        /* Measured off the artwork: the window sits 52.95% across, 35.3% down,
           and is 69.8% of the pin's width. The globe has to cover the one
           printed into the image, so its white disc reaches the ring — a
           smaller one would leave the painted globe showing around it.
           aspect-ratio because the WebGL canvas inside fills this box
           absolutely and no longer gives it a height of its own. */
        .artium-globepin-globe {
          position: absolute; left: 52.95%; top: 35.3%;
          width: 69.8%; aspect-ratio: 1 / 1;
          transform: translate(-50%, -50%);
          pointer-events: none;
        }

        /* In the pin's body, under the globe. Sized off the same viewport
           measure as the pin so the two scale together, and held on one line
           with a thousands separator so five figures still fit the taper. */
        .artium-globepin-count {
          position: absolute; left: 52.95%; top: 68%;
          transform: translate(-50%, -50%);
          display: flex; flex-direction: column; align-items: center; gap: 3px;
          color: #FFFFFF; white-space: nowrap; pointer-events: none;
        }
        .artium-globepin-count > svg { width: min(18px, 3.02vw); height: auto; display: block; }
        .artium-globepin-count-n { font-weight: 400; font-size: min(17px, 2.9vw); line-height: 1; letter-spacing: -0.01em; }

        /* Points at the pin from its left, nudging toward it — the push says
           "press this" the way the bob alone never quite did. Anchored to the
           pin wrapper so it rides the bob and the hover lift with it, and
           off the right edge of its own box so the gap stays put while the
           nudge moves the hand. 35.3% is the globe's centre, measured off the
           artwork — the hand points at the globe, not at the pin's middle. */
        .artium-globepin-hand-col {
          position: absolute; right: calc(100% + 12px); top: 35.3%;
          transform: translate(0, -50%);
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          pointer-events: none;
        }
        .artium-globepin-hand {
          animation: artiumPoint 1.3s ease-in-out infinite;
        }
        .artium-globepin-hand svg { width: min(36px, 6.2vw); height: auto; }
        @keyframes artiumPoint {
          0%, 100% { transform: translate(0, 0); }
          55%      { transform: translate(9px, 0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .artium-globepin { animation: none; }
          .artium-globepin-hand { animation: none; }
          .artium-explore:hover .artium-globepin { transform: none; }
        }

        /* ---- Landing: the gate's world, continued ---------------------
           The screen straight after the gate cannot look like a different
           product, so it takes the gate's ground, palette, type and backdrop
           outright — GateBackdrop is the same component — and only the layout
           here is new. */
        .artium-lp {
          position: relative; min-height: 100vh; min-height: 100dvh;
          display: flex; flex-direction: column;
          background:
            radial-gradient(120% 60% at 50% -8%, #17181C 0%, transparent 60%),
            linear-gradient(180deg, #131417 0%, #0F1012 38%, #0B0C0E 100%);
          color: #FFFFFF;
          font-family: 'Manrope', -apple-system, 'Segoe UI', Roboto, sans-serif;
          overflow-x: hidden;
        }
        .artium-lp > *:not(.artium-gx-bd) { position: relative; z-index: 1; }
        /* The rule above flattens every child to z 1 at (0,2,0) specificity,
           which silently beat the bar's own z-index and let the pin paint
           over the open notification panel. This (0,2,0) rule sits later,
           so the header actually rises. */
        .artium-lp > .artium-lp-bar { z-index: 320; }
        /* The photograph belongs to the hero, not to the whole scroll. Pinned
           to the top with a viewport's height it has faded into the base
           gradient by the time the steps begin; left at inset 0 it would
           stretch the length of the page and the conductor would stand three
           storeys tall behind the small print. */
        /* Sized to the photograph's own aspect, not to the viewport. It is
           863x820 — nearly square — and cover on a tall narrow box scaled it
           until only the dark middle was left in frame: the hall cropped off
           one side, the notes off the other, and what remained looked like a
           plain gradient. At its own ratio it fits the width exactly and
           nothing is lost. */
        .artium-lp .artium-gx-bd { height: auto; aspect-ratio: 863 / 820; bottom: auto; }
        /* Lighter than the gate's. That photograph is lit — a conductor, a
           balcony, a wall of notes — and needs holding back off the type.
           This one is a dark room with a lit floor, and the gate's scrim
           pushed what little it has to nothing. It still closes hard at the
           foot, where the steps begin. */
        .artium-lp .artium-gx-scrim {
          background: linear-gradient(180deg,
            rgba(15,16,18,0.18) 0%, rgba(15,16,18,0.09) 28%,
            rgba(15,16,18,0.24) 62%, rgba(15,16,18,0.74) 88%,
            rgba(15,16,18,0.95) 100%);
        }

        .artium-lp-bar {
          display: flex; align-items: center; gap: 11px;
          width: 100%; max-width: 560px; margin: 0 auto; flex-shrink: 0;
          padding: calc(14px + env(safe-area-inset-top, 0px)) 20px 4px;
          /* Above the pin/stage: the bell's dropdown lives in this bar, and
             without a stacking context of its own the globe, pin and halo
             painted later in the DOM rise over the open panel. */
          position: relative; z-index: 320;
        }
        /* No ring, and an arrow rather than a chevron. Ringed-chevron-left next
           to ringed-chevron-right made two different controls — go back, and
           play the music — into near-twins that differed only in which way the
           mark pointed. Dropping the ring separates them by silhouette, which
           is read before direction. */
        .artium-lp-back {
          display: flex; align-items: center; justify-content: center;
          width: 30px; height: 34px; flex-shrink: 0; padding: 0; margin-left: -4px;
          border: none; background: none; color: #B9B9B9; cursor: pointer;
          transition: color .25s ease, transform .25s ease;
        }
        .artium-lp-back:hover { color: #EFD09B; transform: translateX(-2px); }
        /* On the light landing the bare gray chevron vanished into the
           ground — it wears the pucks' ivory disc now, 34px like the bell,
           and leads home to the entry gate. */
        .artium-lp--light .artium-lp-back {
          width: 34px; height: 34px; margin-left: 0; border-radius: 50%;
          color: #232A3B;
          background: radial-gradient(circle at 35% 28%, #FFFFFF 0%, #FCF8EF 55%, #F1E8D6 100%);
          border: 1px solid rgba(255,255,255,.85);
          box-shadow: 0 6px 10px -4px rgba(150,115,55,.38), 0 2px 4px rgba(150,115,55,.14), inset 0 2px 2px #fff, inset 0 -3px 5px rgba(176,146,98,.28);
        }
        .artium-lp--light .artium-lp-back:hover { color: #232A3B; transform: none; }
        .artium-lp-right { display: flex; align-items: center; gap: 12px; margin-left: auto; }
        .artium-lp-cta {
          border: none; border-radius: 999px; padding: 9px 17px; cursor: pointer;
          background: linear-gradient(160deg, #E3BB7A, #C99A55);
          color: #0F1012; font-family: inherit; font-size: 13px; font-weight: 700;
          white-space: nowrap; flex-shrink: 0;
          transition: background .3s ease, box-shadow .3s ease, transform .3s ease;
        }
        .artium-lp-cta:hover {
          background: linear-gradient(160deg, #EFCB8C, #D4A75F);
          box-shadow: 0 0 26px rgba(239,208,155,0.35); transform: scale(1.04);
        }

        .artium-lp-main {
          flex: 1; width: 100%; max-width: 560px; margin: 0 auto;
          padding: 14px 24px calc(28px + env(safe-area-inset-bottom, 0px));
          display: flex; flex-direction: column; align-items: center;
        }
        .artium-lp-h1, .artium-lp-h2 {
          margin: 0; text-align: center; color: #FFFFFF;
          font-family: 'Cormorant Garamond', 'Didot', 'Bodoni 72', Georgia, serif;
          font-weight: 700; line-height: 1.16; letter-spacing: 0.005em;
        }
        .artium-lp-h1 { font-size: clamp(20px, 6.0vw, 30px); }
        .artium-lp-h2 { font-size: clamp(21px, 6.4vw, 32px); }

        /* The pin stands in its own pool of light. Two layers: a broad halo
           behind it, and a low ellipse under its point standing in for the
           ground it is stuck into. */
        .artium-lp-stage { position: relative; display: flex; justify-content: center; width: 100%; }
        .artium-lp-stage::before {
          content: ''; position: absolute; left: 50%; top: 44%;
          width: 116%; height: 74%; transform: translate(-50%, -50%);
          background: radial-gradient(ellipse at center, rgba(239,208,155,0.13), rgba(239,208,155,0.05) 42%, transparent 70%);
          pointer-events: none;
        }
        .artium-lp-stage::after {
          content: ''; position: absolute; left: 50%; bottom: 2%;
          width: 84%; height: 13%; transform: translateX(-50%);
          background: radial-gradient(ellipse at center, rgba(239,208,155,0.42), rgba(239,208,155,0.10) 38%, transparent 72%);
          pointer-events: none; filter: blur(2px);
        }
        .artium-lp-cap { margin: 0; font-size: 12.5px; font-style: italic; color: #9A9A9A; line-height: 1.5; text-align: center; }
        .artium-lp-cap b { color: #EFD09B; font-weight: 600; }

        /* ---- the five steps ---- */
        .artium-lp-steps { width: 100%; display: flex; flex-direction: column; gap: 12px; }
        .artium-lp-step {
          display: flex; align-items: center; gap: 13px;
          padding: 15px 15px; border-radius: 20px; text-align: left;
          border: 1px solid rgba(239,208,155,0.16);
          /* The gate's card light, at the smaller scale these run to. */
          background:
            radial-gradient(135% 120% at 5% -6%,
              rgba(255,255,255,0.085) 0%, rgba(255,255,255,0.055) 32%,
              rgba(255,255,255,0.028) 62%, rgba(255,255,255,0.010) 86%,
              rgba(255,255,255,0.004) 100%),
            linear-gradient(180deg, rgba(255,255,255,0.010) 58%, rgba(0,0,0,0.06) 100%);
          -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px);
          box-shadow: 0 14px 34px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.10);
          transition: border-color .3s ease, box-shadow .3s ease, transform .3s ease;
        }
        .artium-lp-step:hover {
          border-color: rgba(239,208,155,0.4); transform: translateY(-3px);
          box-shadow: 0 20px 46px rgba(0,0,0,0.5), 0 0 22px rgba(239,208,155,0.10),
                      inset 0 1px 0 rgba(255,255,255,0.14);
        }
        .artium-lp-num {
          width: 35px; height: 35px; border-radius: 50%; flex-shrink: 0;
          border: 1px solid rgba(239,208,155,0.5); color: #EFD09B;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Cormorant Garamond', 'Didot', 'Bodoni 72', Georgia, serif;
          font-size: 17px; font-weight: 600; line-height: 1;
          /* Cormorant sets old-style figures by default, where 1 is a short
             serifed stroke that reads as a capital I — so step one looked like
             step "I" while 2 and 3 were fine. Lining figures are what a
             numbered list needs. */
          font-variant-numeric: lining-nums;
          font-feature-settings: "lnum" 1;
        }
        .artium-lp-step-body { flex: 1; min-width: 0; }
        .artium-lp-step-t {
          margin: 0; color: #FFFFFF; line-height: 1.25;
          font-family: 'Cormorant Garamond', 'Didot', 'Bodoni 72', Georgia, serif;
          font-weight: 700; font-size: 16px;
        }
        .artium-lp-step-d { margin: 5px 0 0; font-size: 12px; font-weight: 500; line-height: 1.5; color: #8B8B8B; }
        .artium-lp-step-d a { color: #E6DAB0; font-weight: 600; text-decoration: none; }
        .artium-lp-step-d a:hover { color: #EFD09B; text-decoration: underline; }
        /* Line art, quieter than the number but not ghostly. 0.42 read as
           blur, not restraint — a thin gold line on near-black needs its
           full edge to look drawn rather than smudged. */
        .artium-lp-step-i { flex-shrink: 0; display: flex; color: rgba(239,208,155,0.66); }
        .artium-lp-err { margin: 0; max-width: 460px; text-align: center; font-size: 13px; line-height: 1.5; color: #E5A0A0; }

        /* ================================================================
           LANDING — LIGHT VARIANT (student/graduate screen, one tap off the
           gate). Everything below is scoped under .artium-lp--light so the
           base .artium-lp/.artium-gx-* rules above (still used by the dark
           screens: signup flow, map, network, etc.) are completely
           untouched — this is a pure additive, higher-specificity override,
           not a rename/fork of the shared classes. Palette lifted from
           src/components/entrygate/artium-gate.css's :root tokens:
             ground #F4F4F3 · ink #232A3B · muted #6A7080 · gold #C9962E
             contour rgba(176,146,98,.30) · warm-shadow rgba(150,115,55,.38)
           Titles: Playfair Display 500. Everything else: Jost 300-600.
           Forked/overridden shared classes (all via this one scope, nothing
           renamed): .artium-lp itself, .artium-gx-bd (hidden — no photo
           backdrop any more), .artium-lp-back/-cta, the playlist button's
           [aria-label*="playlist"] rule, .artium-gx-count, .artium-lp-h1/
           -h2, .artium-gx-rule, .artium-lp-stage::before/::after,
           .artium-lp-cap, .artium-lp-step*, .artium-lp-err, and
           .artium-gx-foot* (footer). .artium-aw-tabs (the bottom bar) has
           its own sibling-scoped .artium-aw-tabs--light variant near its
           base rules above — it's rendered once at the app shell, a
           sibling of .artium-lp rather than a descendant, so it can't be
           reached by .artium-lp--light's descendant scoping and needed a
           "light" prop on <BottomTabs> instead. */
        .artium-lp--light {
          background: #F4F4F3;
          color: #232A3B;
          font-family: 'Jost', system-ui, sans-serif;
        }
        .artium-lp--light .artium-gx-bd { display: none; }

        /* The user's artwork (colonnade fading upper-left, gold staff +
           notes upper-right, dotted world map + orbit rings lower half —
           already re-grounded to this page's own #F4F4F3), behind the
           header through the pin block. Fixed-ish height rather than the
           image's own 1114x1412 aspect-ratio: at this box's full page
           width that ratio would run to 1500px+ tall on a wide desktop
           viewport, covering the steps too — clamp keeps it phone-height
           on narrow screens (where the artwork's own composition already
           puts the map band under the pin, per the mock) and caps how
           tall it gets on wide ones. .artium-lp-bd is a dedicated class
           (not the shared .artium-gx-bd) specifically so the generic
           ".artium-lp > *:not(.artium-gx-bd) { position:relative;
           z-index:1 }" rule above doesn't fight this element's own
           absolute/z-index:0 — this rule wins on source order (both are
           two-class-equivalent specificity, this one is later). Position/
           height are a first pass — worth eyeballing background-position
           against the mock and nudging. */
        .artium-lp--light .artium-lp-bd {
          position: absolute; top: 0; left: 0; width: 100%;
          height: clamp(520px, 92vw, 760px);
          background: url('/landing-backdrop.jpg') top center / cover no-repeat;
          pointer-events: none; z-index: 0;
        }
        .artium-lp--light .artium-lp-bd::after {
          content: '';
          position: absolute; left: 0; right: 0; bottom: 0; height: 40%;
          background: linear-gradient(180deg, rgba(244,244,243,0) 0%, #F4F4F3 90%);
        }

        /* "HOW IT WORKS" eyebrow over "Simple, from day one." — the mock
           splits what used to be one two-line serif block into a small
           gold caps label plus the serif line, matching the gate's own
           eyebrow-over-title pattern. */
        .artium-lp--light .artium-lp-eyebrow {
          text-align: center;
          font-family: 'Jost', system-ui, sans-serif;
          font-size: 13px; font-weight: 500; letter-spacing: .3em;
          text-transform: uppercase; color: #C9962E;
          margin-bottom: 8px;
        }

        .artium-lp--light .artium-lp-back {
          width: 34px; height: 34px; margin-left: 0;
          border-radius: 50%; color: #232A3B;
          background: radial-gradient(circle at 35% 28%, #FFFFFF 0%, #FCF8EF 55%, #F1E8D6 100%);
          border: 1px solid rgba(255,255,255,.85);
          box-shadow:
            0 8px 14px -4px rgba(150,115,55,.38),
            0 2px 4px rgba(150,115,55,.14),
            inset 0 2px 2px #fff,
            inset 0 -3px 5px rgba(176,146,98,.28);
        }
        .artium-lp--light .artium-lp-back:hover { color: #C9962E; transform: none; }

        /* The wordmark: ink caps, the gate's crossbar-less "A" (see the
           header markup in Landing()'s JSX). */
        .artium-lp--light .artium-lp-word {
          font-family: 'Jost', system-ui, sans-serif;
          font-size: 22px; font-weight: 600; color: #232A3B;
          letter-spacing: .2em; text-transform: uppercase;
          display: inline-flex; align-items: center;
        }
        .artium-lp--light .artium-lp-word-a { width: .72em; height: .72em; margin-right: .2em; display: block; }

        /* The legacy playlist-button overrides that lived here forced the
           landing's play disc to 36px with !important — the one page where
           play and bell refused to match. The play button is a plain
           .artium-net-puck now; nothing bespoke remains. */

        /* Member count: the gate's passive flat stat, not a chip. */
        .artium-lp--light .artium-gx-count { color: #6A7080; font-weight: 400; }
        .artium-lp--light .artium-gx-count svg { color: #6A7080; }

        /* Sign Up / Log in: the gate's gold pill CTA. */
        .artium-lp--light .artium-lp-cta {
          background: linear-gradient(180deg, #EFD08A 0%, #DBAB4C 55%, #C9962E 100%);
          color: #3A2E10; font-weight: 600;
          box-shadow:
            0 12px 20px -8px rgba(176,126,31,.55),
            inset 0 2px 2px rgba(255,255,255,.7),
            inset 0 -3px 5px rgba(140,95,15,.30);
        }
        .artium-lp--light .artium-lp-cta:hover {
          background: linear-gradient(180deg, #F4DBA0 0%, #E4BB63 55%, #D3A63B 100%);
          box-shadow:
            0 14px 24px -8px rgba(176,126,31,.6),
            inset 0 2px 2px rgba(255,255,255,.8),
            inset 0 -3px 5px rgba(140,95,15,.32);
        }

        .artium-lp--light .artium-lp-h1,
        .artium-lp--light .artium-lp-h2 {
          color: #232A3B;
          font-family: 'Playfair Display', serif;
          font-weight: 500;
        }
        .artium-lp--light .artium-gx-rule span { background: linear-gradient(90deg, transparent, rgba(201,150,46,.55)); }
        .artium-lp--light .artium-gx-rule span:last-child { background: linear-gradient(90deg, rgba(201,150,46,.55), transparent); }
        .artium-lp--light .artium-gx-rule i { background: #C9962E; }

        /* Pin's halo: a warm gold glow instead of champagne-on-black, tuned
           down since a light ground needs far less to read as a pool of
           light — the same values on white looked like a stain. */
        .artium-lp--light .artium-lp-stage::before {
          background: radial-gradient(ellipse at center, rgba(201,150,46,.14), rgba(201,150,46,.05) 42%, transparent 70%);
        }
        .artium-lp--light .artium-lp-stage::after {
          background: radial-gradient(ellipse at center, rgba(201,150,46,.32), rgba(201,150,46,.08) 38%, transparent 72%);
        }
        .artium-lp--light .artium-lp-cap { color: #6A7080; }
        .artium-lp--light .artium-lp-cap b { color: #C9962E; }

        /* Pin's headcount: ink, not the white styled for the old dark pin. */
        .artium-lp--light .artium-globepin-count { color: #4A505C; }
        .artium-lp--light .artium-globepin-count > svg { width: min(21px, 3.5vw); }
        .artium-lp--light .artium-globepin-count-n { font-size: min(20px, 3.4vw); }

        /* The manicule's ivory puck disc — see the redrawn hand SVG in the
           JSX (circular cuff + extended index + three curled fingers).
           Position/animation are untouched (still the base rule, left of
           the pin, same nudge-toward-it motion); this only adds the disc
           material and recolors the currentColor stroke gold. */
        .artium-lp--light .artium-globepin-hand {
          width: min(66px, 17vw); height: min(66px, 17vw);
          border-radius: 50%;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 2px;
          background: radial-gradient(circle at 35% 28%, #FFFFFF 0%, #FCF8EF 55%, #F1E8D6 100%);
          border: 1px solid rgba(255,255,255,.85);
          box-shadow:
            0 8px 14px -4px rgba(150,115,55,.38),
            0 2px 4px rgba(150,115,55,.14),
            inset 0 2px 2px #fff,
            inset 0 -3px 5px rgba(176,146,98,.28);
          color: #C9962E;
        }
        .artium-lp--light .artium-globepin-hand svg { width: 55%; height: 55%; }
        .artium-lp--light .artium-globepin-register {
          font-family: 'Jost', sans-serif; font-size: min(10.5px, 2.8vw);
          font-weight: 600; letter-spacing: .02em; color: #C9962E;
          line-height: 1; white-space: nowrap;
        }

        /* ---- the five steps: pure-white slabs with the gate's
           double-slab rim (outer contour + inner keyline + inset panel
           groove), gold Playfair numbered pucks, mock's type scale. ---- */
        .artium-lp--light .artium-lp-step {
          position: relative;
          padding: 16px 14px; gap: 12px;
          /* Matched to how the gate cards actually RENDER on a phone: the
             stage scales to ~0.4, so its 62-unit corners read ~25px, the
             keyline sits ~1px in, the panel ~4px — fine and smooth. The
             pills draw unscaled, so they take those rendered values. */
          border-radius: 24px;
          background: #F4F4F3;
          border: 1px solid rgba(176,146,98,.32);
          -webkit-backdrop-filter: none; backdrop-filter: none;
          box-shadow: 0 10px 12px -6px rgba(150,115,55,.26), 0 3px 4px -2px rgba(150,115,55,.13);
        }
        .artium-lp--light .artium-lp-step::before {
          /* platekey at rendered scale: a hairline just inside the contour */
          content: ""; position: absolute; inset: 1px; border-radius: 23px;
          border: 1px solid rgba(255,255,255,.92); pointer-events: none;
        }
        .artium-lp--light .artium-lp-step::after {
          /* panel at rendered scale: shallow inset, fine edge, soft groove */
          content: ""; position: absolute; inset: 4px; border-radius: 20px;
          border: 1px solid rgba(255,255,255,.75);
          box-shadow:
            0 1px 1px rgba(150,110,50,.30),
            inset 0 0 0 1px rgba(255,255,255,.6);
          background: linear-gradient(180deg, rgba(176,146,98,0) 62%, rgba(176,146,98,.10) 100%);
          pointer-events: none;
        }
        .artium-lp--light .artium-lp-step > * { position: relative; z-index: 1; }
        .artium-lp--light .artium-lp-step:hover {
          border-color: rgba(201,150,46,.55); transform: translateY(-3px);
          box-shadow: 0 26px 46px -22px rgba(150,115,55,.44);
        }
        .artium-lp--light .artium-lp-num {
          width: 46px; height: 46px; font-size: 21px; font-weight: 600;
          border: 1px solid rgba(255,255,255,.85); color: #C9962E;
          background: radial-gradient(circle at 35% 28%, #FFFFFF 0%, #FCF8EF 55%, #F1E8D6 100%);
          box-shadow:
            0 6px 10px -4px rgba(150,115,55,.34),
            inset 0 2px 2px #fff,
            inset 0 -2px 4px rgba(176,146,98,.24);
          font-family: 'Playfair Display', serif;
        }
        .artium-lp--light .artium-lp-step-t {
          /* Exactly the conservatory-list title voice (The Juilliard School):
             Baskerville bold, raised seventeen percent at the user's ask. */
          color: #232A3B; font-family: 'Libre Baskerville', serif;
          font-weight: 700; font-size: 15px; line-height: 1.2;
        }
        .artium-lp--light .artium-lp-step-d {
          /* The conservatory card's location voice (New York, USA). */
          margin-top: 6px; color: #6A7080; font-weight: 400;
          font-size: 14px; line-height: 1.45;
        }
        .artium-lp--light .artium-lp-step-d a { color: #B8862E; }
        .artium-lp--light .artium-lp-step-d a:hover { color: #C9962E; }
        .artium-lp--light .artium-lp-step-i { color: #C9962E; }

        .artium-lp--light .artium-lp-err { color: #B23B3B; }

        /* ---- footer: the entry gate's current footer, ported ----
           "OUR PARTNERS" centered, the avatar lockup flush-left beneath
           it (one <a> to the Instagram profile) — not the old "In
           partnership with aclassicaltone" + social-puck row, which is
           why this uses new .artium-lp-partner* classes rather than
           overriding .artium-gx-partner/.artium-gx-social (still exactly
           as they were, unused by this screen's markup now, intact for
           whatever dark screen still renders them). */
        .artium-lp--light .artium-gx-foot-top { background: rgba(176,146,98,.30); }
        .artium-lp--light .artium-gx-foot-top::after { background: #C9962E; }
        .artium-lp--light .artium-gx-foot-line { background: rgba(176,146,98,.20); }
        .artium-lp--light .artium-lp-partner {
          display: flex; flex-direction: column; align-items: flex-start;
          gap: 6px; width: 100%;
        }
        .artium-lp--light .artium-lp-partner-lbl {
          align-self: center;
          font-size: 19px; font-weight: 700; color: #2A3142;
          text-transform: uppercase; letter-spacing: .04em;
          margin-bottom: 10px;
        }
        .artium-lp--light .artium-lp-partner-avatar {
          display: inline-flex; flex-direction: column; align-items: center;
          gap: 7px; text-decoration: none; line-height: 0;
        }
        .artium-lp--light .artium-lp-partner-avatar img {
          border-radius: 50%; display: block;
          box-shadow:
            0 8px 14px -4px rgba(150,115,55,.38),
            0 2px 4px rgba(150,115,55,.14);
          border: 1px solid rgba(255,255,255,.85);
        }
        .artium-lp--light .artium-lp-partner-name {
          font-family: 'Jost', system-ui, sans-serif;
          font-size: 12.5px; font-weight: 400; letter-spacing: .02em;
          color: #6A7080; line-height: 1; text-transform: lowercase;
        }
        .artium-lp--light .artium-gx-foot-links span { color: #6A7080; }
        .artium-lp--light .artium-gx-foot-links i { color: #B0AEA8; }
        .artium-lp--light .artium-gx-copy { color: #8A8D93; }

      `}</style>

      <SpotifyPlayer
        open={musicOn}
        controllerRef={spotifyRef}
        onPlayingChange={setMusicPlaying}
        onClose={() => setMusicOn(false)}
      />

      {showGuestPrompt && (
        <SignupPromptModal
          onClose={() => setShowGuestPrompt(false)}
          onSignup={() => { setShowGuestPrompt(false); startApply(); }}
        />
      )}

      {view === "entry" && <ArtiumGate onLearner={chooseLearner} onStudent={() => chooseStudent("otp")} onPianist={choosePianist} onLogin={startLogin} onComposers={() => setScreen("composers")} learnerProfile={learnerProfile} learnerLoggedOut={learnerLoggedOut} studentLoggedIn={!!myProfile} musicOn={musicPlaying} onMusicToggle={toggleMusic} memberCount={Object.values(studentsByCons).flat().length} avatarPhotoUrl={accountPhotoUrl} avatarName={accountName} bellSlot={myProfile ? (
        <NotificationBell
          myProfile={myProfile}
          puck
          networkFeeds
          hireCount={pianistAttentionCount}
          hireIds={pianistAttentionIds}
          onGoToLessonRoom={() => { setScreen("app"); setAppTabPersist("lessons"); }}
          onGoToConcerts={() => { setScreen("app"); setAppTabPersist("concerts"); }}
          onGoToComposers={() => setScreen("composers")}
          onGoToNews={() => {}}
          authUser={authUser}
          isAdmin={isAdmin}
          onGoToAdmin={() => { setScreen("app"); setAppTabPersist("admin"); }}
        />
      ) : null} memberChips={(() => {
        const chips = [];
        if (myProfile) chips.push({ name: myProfile.name, meta: [myProfile.instrument, findConservatory(myProfile.conservatoryId)?.city].filter(Boolean).join(" · ") || "Conservatory student", photoUrl: accountPhotoUrl });
        const other = students.find((st) => st.id !== myProfile?.id && st.photoUrl);
        if (other) chips.push({ name: other.name, meta: [other.instrument, findConservatory(other.conservatoryId)?.city].filter(Boolean).join(" · "), photoUrl: other.photoUrl });
        return chips;
      })()} onAvatar={myProfile ? goToProfile : (learnerProfile ? () => setScreen("learnerMap") : undefined)} onLogout={async () => {
        // Logging out re-arms the gate tour: the next login meets the
        // card-by-card introduction again, per the user's request.
        try { localStorage.removeItem("artium_gate_tour_v1"); } catch { /* private mode */ }
        await supabase.auth.signOut().catch(() => {});
      }} />}
      {view === "composers" && <WallOfComposers onBack={backToEntry} />}
      {view === "learnerSignup" && <LearnerSignup onSubmit={submitLearner} onBack={backToEntry} authUser={authUser} error={authError} />}
      {view === "learnerMap" && (
        <LearnerScreen
          learner={learnerProfile}
          teachers={students.filter((s) => s.teaching && s.teaching.open)}
          teachRequests={teachRequests}
          onSendRequest={sendTeachRequest}
          conversations={conversations}
          activeChatId={activeChatId}
          setActiveChatId={setActiveChatId}
          onSend={sendMessage}
          onBack={backToEntry}
          onUpdateProfile={(updates) => setLearnerProfile((p) => ({ ...p, ...updates }))}
          onLogout={async () => { await supabase.auth.signOut(); localStorage.removeItem("artium_demo_session"); setLearnerProfile(null); setLearnerLoggedOut(true); setScreen("entry"); }}
          onDeleteAccount={async () => {
            await supabase.rpc("delete_own_account");
            await supabase.auth.signOut();
            setLearnerProfile(null);
            setLearnerLoggedOut(false);
            setScreen("entry");
          }}
          memberCount={Object.values(studentsByCons).flat().length}
          musicOn={musicPlaying}
          onMusicToggle={toggleMusic}
        />
      )}

      {view === "landing" && <Landing onApply={pianistEntry ? () => { setAuthError(""); setScreen("hirerSignup"); } : startApply} onBack={backToEntry} onPreview={startPreview} onProfile={goToProfile} onLogin={startLogin} myProfile={myProfile} studentLoggedOut={studentLoggedOut} musicOn={musicPlaying} onMusicToggle={toggleMusic} error={authError} onGoToLessonRoom={() => { setScreen("app"); setAppTabPersist("lessons"); }} studentsByCons={studentsByCons} avatarPhotoUrl={accountPhotoUrl} avatarName={accountName} hireCount={pianistAttentionCount} hireIds={pianistAttentionIds} onGoToConcerts={() => { setScreen("app"); setAppTabPersist("concerts"); }} onGoToComposers={() => setScreen("composers")} authUser={authUser} isAdmin={isAdmin} onGoToAdmin={() => { setScreen("app"); setAppTabPersist("admin"); }} />}
      {view === "hirerSignup" && (
        <HirerSignup
          authUser={authUser}
          onBack={() => setScreen("landing")}
          onDone={() => { setPianistEntry(false); setScreen("hirerApp"); }}
        />
      )}
      {view === "hirerApp" && (
        <HirerApp
          authUser={authUser}
          students={students}
          onHome={goHome}
          onLogout={handleLogout}
          musicOn={musicPlaying}
          onMusicToggle={toggleMusic}
        />
      )}
      {view === "login" && <LoginScreen onSubmit={handleLogin} onBack={goHome} error={authError}
        unfinished={!!readSavedDraft()} onResume={startApply} />}
      {view === "signup" && (
        <SignupFlow
          draft={draft} update={update} toggleTaste={toggleTaste} step={step} setStep={setStep}
          editing={editingProfile} onSubmit={submitApplication} authError={authError}
          resumed={resumed} onStartFresh={() => { clearSavedDraft(); setDraft(freshAuthedDraft()); setStep(0); }}
          onCancel={() => setScreen(editingProfile ? "app" : "landing")}
          onHome={goHome}
        />
      )}
      {view === "confirmEmail" && <ConfirmEmail email={pendingEmail} onLogin={startLogin} onHome={goHome} pendingReview={needsReview(draft)} />}
      {/* An account still waiting on a human cannot render the app, whatever
          screen state says.

          Routing to pendingReview on sign-in was never enough. That effect
          runs when the session changes, and every way back out of this screen
          changes the screen instead: Home sets "landing", and chooseStudent
          then sees a myProfile and sends them to "app" without asking whether
          it was approved. So the wait was a screen you were put on, not a
          state you were in, and any button that moved you was a way through.

          Deciding it here — from the profile the server sent, at the moment
          of drawing — means there is one answer and nothing to route around.
          Note it reads authProfile, not myProfile: myProfile is assembled
          locally during signup and says what the applicant claimed. */}
      {view === "pendingReview" && (
        <PendingReview onHome={awaitingReview ? undefined : goHome} onLogout={handleLogout} />
      )}
      {view === "app" && (
        <AppShell
          appTab={appTab} setAppTab={setAppTab} myProfile={myProfile}
          onApply={startApply} onHome={goHome} musicOn={musicPlaying} onMusicToggle={toggleMusic}
          onGuestTabClick={() => setShowGuestPrompt(true)} memberCount={Object.values(studentsByCons).flat().length} previewOnly={previewOnly}
          hideTabs={!!selectedStudentId || !!activeConcertInquiryId}
          bare={appTab === "map" && !selectedStudentId}
          authUser={authUser}
          isAdmin={isAdmin}
          onGoToAdmin={() => { setSelectedStudentId(null); setAppTabPersist("admin"); }}
          onGoToLessonRoom={() => { setSelectedStudentId(null); setAppTabPersist("lessons"); }}
          onBack={
            selectedStudentId ? backFromProfile :
            appTab === "concerts" && activeConcertInquiryId ? () => setActiveConcertInquiryId(null) :
            appTab === "messages" ? () => setAppTabPersist("map") :
            appTab === "profile" ? () => setAppTabPersist("map") :
            appTab === "concerts" ? () => setAppTabPersist("map") :
            appTab === "lessons" && teacherRoomView !== "students" ? () => setTeacherRoomView("students") :
            appTab === "lessons" ? () => setAppTabPersist("map") :
            appTab === "promote" ? () => setAppTabPersist("map") :
            appTab === "admin" ? () => setAppTabPersist("map") :
            () => setScreen("landing")
          }
          backLabel={null}
        >
          {/* Only Admin survives here. Map, Promote Me and Lesson Room were
              this strip's reason to exist, and they are in the bottom bar now
              — leaving them would be the same three destinations twice on one
              screen, disagreeing about which is current.

              Admin stays off the bar deliberately: it belongs to two people,
              and a tab everybody sees for a room almost nobody can open is
              worse than a strip the two of them learn. */}
          {myProfile && !selectedStudentId && isAdmin && (
            <div className="flex" style={{ borderBottom: `1px solid ${C.inkLine}`, background: "rgba(176,146,98,0.05)" }}>
              {[
                { key: "admin", label: "Admin", Icon: ShieldCheck },
              ].map(({ key, label, Icon }) => (
                <button key={key} onClick={() => setAppTabPersist(key)}
                  style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "8px 4px 6px", fontWeight: appTab === key ? 600 : 400, fontSize: 12, color: appTab === key ? C.ivory : C.ivoryDim, borderBottom: appTab === key ? `2px solid ${C.brass}` : "2px solid transparent", background: "transparent", border: "none", cursor: "pointer" }}>
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
          )}
          {appTab === "map" && !selectedStudentId && (
            <>
              {/* Landing's own header, first thing on the page — back puck,
                  wordmark, passive member count, bell, avatar — same
                  sizes/materials, just under this page's own class names
                  (.artium-net-*) since it's drawn here rather than by
                  Landing itself. "Welcome, {name}" used to sit above this;
                  it moves below, same as it sits below the header on every
                  other screen the gate draws. */}
              <header className="artium-net-bar">
                <button className="artium-net-puck" onClick={goHome} aria-label="Back">
                  <ChevronLeft size={17} strokeWidth={2} />
                </button>
                <span className="artium-net-word" aria-label="ARTIUM">
                  <svg viewBox="0 0 15 15" aria-hidden="true">
                    <path d="M7.5 0.9 L1.4 14.4 M7.5 0.9 L13.6 14.4" stroke="currentColor" strokeWidth="2.85" fill="none" />
                  </svg>
                  <span aria-hidden="true">RTIUM</span>
                </span>
                <span className="artium-net-right">
                  <span className="artium-net-count" title="Members" aria-label={`${Object.values(studentsByCons).flat().length} members`}>
                    <Users size={15} strokeWidth={1.8} />
                    {Object.values(studentsByCons).flat().length}
                  </span>
                  {/* The bell's own button, glyph swapped for the play
                      triangle — same position as the landing header. */}
                  <button
                    className="artium-net-puck"
                    onClick={toggleMusic}
                    title={musicPlaying ? "Pause" : "Play"}
                    aria-label={musicPlaying ? "Pause playlist" : "Play playlist"}
                  >
                    {musicPlaying ? (
                      <Pause size={15} color={C.inkText} strokeWidth={2.4} />
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill={C.inkText} aria-hidden="true" style={{ marginLeft: 2 }}>
                        <path d="M8 5.5v13l11-6.5z" />
                      </svg>
                    )}
                  </button>
                  {myProfile && (
                    <NotificationBell
                      myProfile={myProfile}
                      puck
                      networkFeeds
                      hireCount={pianistAttentionCount}
                      hireIds={pianistAttentionIds}
                      onGoToLessonRoom={() => { setSelectedStudentId(null); setAppTabPersist("lessons"); }}
                      onGoToConcerts={() => { setSelectedStudentId(null); setAppTabPersist("concerts"); }}
                      onGoToComposers={() => setScreen("composers")}
                      // Classical Events has no news feed yet — nowhere to
                      // send a click. Marking the feed seen is still a real
                      // action (it is what would clear the badge once there
                      // is somewhere to read), so it stays wired.
                      onGoToNews={() => {}}
                      authUser={authUser}
                      isAdmin={isAdmin}
                      onGoToAdmin={() => { setSelectedStudentId(null); setAppTabPersist("admin"); }}
                    />
                  )}
                  {myProfile ? (
                    <button onClick={goToProfile} title="My profile" style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                      <Avatar name={myProfile.name} id="me" size={HEADER_CONTROL} photoUrl={myProfile.photoUrl} online />
                    </button>
                  ) : (
                    <Avatar name={accountName || "?"} id="me" size={HEADER_CONTROL} photoUrl={accountPhotoUrl} />
                  )}
                </span>
              </header>
              {myProfile && (
                <div className="px-6 pt-2 pb-2">
                  {/* Back to the plain block by request — the white card and
                      the GOOD TO SEE YOU eyebrow are reversed; what survives
                      of that round: the corrected pill marks, the columned
                      hall beside the conservatory, and its newer text voice. */}
                  <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 600, color: C.inkText, marginLeft: -3 }}>
                    Welcome, {myProfile.name.split(" ")[0]}
                    <span aria-hidden="true" style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 30, height: 30, borderRadius: "50%", marginLeft: 8,
                      verticalAlign: "middle", position: "relative", top: -4,
                      background: "radial-gradient(circle at 35% 28%, #FFFFFF 0%, #FCF8EF 55%, #F1E8D6 100%)",
                      boxShadow: "0 4px 8px -3px rgba(150,115,55,.35), inset 0 1px 1px #fff",
                      fontSize: 15, lineHeight: 1,
                    }}>{"\uD83D\uDC4B"}</span>
                  </h2>
                  <button
                    onClick={() => {
                      if (!myProfile.conservatoryId) return;
                      setSelectedConsId(myProfile.conservatoryId);
                      // The roster renders far below the globe — without this
                      // scroll a successful tap looks like nothing happened.
                      setTimeout(() => {
                        document.querySelector(".artium-aw-listhead")?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }, 60);
                    }}
                    title="See who studies at your conservatory"
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 16, background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit", margin: "16px auto 0" }}
                  >
                    <span style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 34, height: 34, borderRadius: "50%",
                      background: "radial-gradient(circle at 35% 28%, #FFFFFF 0%, #FCF8EF 55%, #F1E8D6 100%)",
                      boxShadow: "0 6px 10px -4px rgba(150,115,55,.38), 0 2px 4px rgba(150,115,55,.14), inset 0 2px 2px #fff, inset 0 -3px 5px rgba(176,146,98,.28)",
                      color: C.brass, flexShrink: 0,
                    }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M12 2.5 2.8 7.2v1.6h18.4V7.2L12 2.5zM4.2 10.3h2.4v7.2H4.2zM10.8 10.3h2.4v7.2h-2.4zM17.4 10.3h2.4v7.2h-2.4zM2.8 19h18.4v2H2.8z" />
                      </svg>
                    </span>
                    <span style={{ fontFamily: FONT_BODY, fontSize: 17.5, fontWeight: 500, color: "#565B66" }}>
                      {myProfile.conservatoryId
                        ? (findConservatory(myProfile.conservatoryId)?.name || "Conservatory")
                        : "Conservatory student"}
                    </span>
                  </button>
                  <div style={{ display: "flex", flexWrap: "nowrap", justifyContent: "center", gap: 5, marginTop: 12 }}>
                    {(myProfile.year || "").split(",").map((t) => t.trim()).filter(Boolean).map((label) => {
                      const low = label.toLowerCase();
                      const isYear = /year/.test(low);
                      const isDoc = /doctor|phd/.test(low);
                      return (
                        <span key={label} style={{
                          display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
                          background: "#FFFFFF", border: `1px solid ${C.inkLine}`,
                          borderRadius: 999, padding: "4px 9px",
                          fontFamily: FONT_BODY, fontSize: 11, fontWeight: 600, color: C.inkText,
                          boxShadow: "0 4px 8px -4px rgba(150,115,55,.25)",
                        }}>
                          {isYear ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.brass} strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 20v-6M12 20v-10M18 20V6" /></svg>
                          ) : isDoc ? (
                            <FileText size={12} strokeWidth={1.8} style={{ color: C.brass }} />
                          ) : (
                            <GraduationCap size={12} strokeWidth={1.8} style={{ color: C.brass }} />
                          )}
                          {label}
                        </span>
                      );
                    })}
                    {myProfile.teaching?.open && (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
                        background: "#FFFFFF", border: `1px solid ${C.inkLine}`,
                        borderRadius: 999, padding: "4px 9px",
                        fontFamily: FONT_BODY, fontSize: 11, fontWeight: 600, color: C.inkText,
                        boxShadow: "0 4px 8px -4px rgba(150,115,55,.25)",
                      }}>
                        <span style={{ color: C.brass, display: "inline-flex" }}><IconTeacher size={12} /></span>
                        Open to teach
                      </span>
                    )}
                  </div>
                </div>
              )}
              <MapScreen
                students={students} studentsByCons={studentsByCons}
                selectedConsId={selectedConsId} setSelectedConsId={setSelectedConsId}
                onOpenStudent={(id) => openStudent(id, "map")}
                isGuest={!myProfile}
                onGuestClick={() => setShowGuestPrompt(true)}
                // Unapproved students are routed to the pendingReview screen and
                // never reach the map at all, so the approved check here is
                // belt-and-braces — the popup's locked state shouldn't normally
                // be reachable by a signed-in student.
                canViewRoster={!!myProfile && authProfile?.approved !== false}
                extraCons={docCons}
              />
            </>
          )}
          {appTab === "messages" && !selectedStudentId && (
            <Messages
              students={students} conversations={conversations} activeChatId={activeChatId}
              setActiveChatId={setActiveChatId} onSend={sendMessage}
              onOpenProfile={(id) => openStudent(id, "chat")}
              myProfile={myProfile}
              onBack={() => setAppTabPersist("map")}
            />
          )}
          {appTab === "profile" && !selectedStudentId && myProfile && (
            <MyProfile profile={myProfile} onEdit={editProfile} onLogout={handleLogout}
              onUpdateCoverVideo={async (coverVideoUrl) => {
                await supabase.from("profiles").update({ cover_video_url: coverVideoUrl || null }).eq("id", myProfile.id);
                const updated = { ...myProfile, coverVideoUrl };
                setMyProfile(updated);
                setStudents((arr) => arr.map((s) => (s.id === myProfile.id ? updated : s)));
              }}
              onDeleteAccount={async () => {
              await supabase.rpc("delete_own_account");
              await supabase.auth.signOut();
              setMyProfile(null);
              setStudents((arr) => arr.filter((s) => s.id !== myProfile?.id));
              setLearnerLoggedOut(false);
              setStudentLoggedOut(false);
              setScreen("landing");
              setAppTabPersist("map");
            }} onBack={() => setAppTabPersist("map")} />
          )}
          {appTab === "promote" && !selectedStudentId && myProfile && (
            <PromoteMe myProfile={myProfile} authUser={authUser} />
          )}
          {appTab === "admin" && !selectedStudentId && isAdmin && (
            <AdminScreen authUser={authUser} onlineCount={onlineCount} />
          )}
          {appTab === "lessons" && !selectedStudentId && myProfile && (
            <TeacherLessonRoom teacherId={myProfile.id} roomView={teacherRoomView} setRoomView={setTeacherRoomView} />
          )}
          {appTab === "concerts" && !selectedStudentId && myProfile && isPianistUser && (
            activeConcertInquiryId ? (
              <ConcertConversation
                inquiryId={activeConcertInquiryId} role="pianist" myId={myProfile.id} myName={myProfile.name}
                otherName={pianistInquiries.find((q) => q.id === activeConcertInquiryId)?.hirerName}
                students={students}
                onBack={() => setActiveConcertInquiryId(null)}
              />
            ) : (
              <div style={{ padding: "24px 0 0" }}>
                <div className="px-6 pb-2">
                  <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 600, color: C.ivory, margin: 0 }}>Concerts</h2>
                  <p style={{ fontSize: 13, color: C.ivoryDim, marginTop: 4 }}>Hirers who have reached out about a booking.</p>
                </div>
                <BookingsList inquiries={pianistInquiries} role="pianist" students={students} onOpen={setActiveConcertInquiryId} />
              </div>
            )
          )}
          {selectedStudentId && myProfile && (
            <StudentProfile
              student={students.find((s) => s.id === selectedStudentId)}
              conservatory={findConservatory(students.find((s) => s.id === selectedStudentId)?.conservatoryId)}
              onBack={backFromProfile}
              onMessage={myProfile?.id === selectedStudentId ? null : () => openChat(selectedStudentId)}
              locked={previewOnly && !myProfile}
              onApply={startApply}
            />
          )}
        </AppShell>
      )}
      {/* One bar, drawn last so it sits over whatever screen is beneath it.
          Not on the gate. Not on signup, login or confirm-email either: those
          carry their own Back/Next footer, and stacking a tab bar under it
          would be two answers to "what now" in the same eighty pixels.
          Not on pendingReview, whose whole point is that nothing is reachable
          yet — a bar there would be five buttons that bounce off the approval
          check, which is the Saved problem again. */}
      {view === "app" && (
        <BottomTabs
          items={
            !myProfile ? GUEST_TABS :
            isPianistUser
              // Concerts sits after Lessons and before Profile — one more
              // room off the same corridor, not a second app bolted on.
              ? [...STUDENT_TABS.slice(0, 5), { k: "concerts", label: "Concerts", Icon: Music2, attention: pianistNeedsAttention }, STUDENT_TABS[5]]
              : STUDENT_TABS
          }
          // Nothing is lit on the landing page but Home, and nothing at all
          // while a student profile is open over the app — that is a page you
          // reached from a tab, not a tab.
          active={selectedStudentId ? "" : appTab}
          onTab={goToTab}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* LANDING                                                             */
/* ---------------------------------------------------------------- */
/**
 * The turning globe in the landing pin — the same real globe the map screen
 * runs, not a drawing of one. Same texture, same brass atmosphere, same
 * graticules, so the pin previews exactly what tapping it opens.
 *
 * Rotation is a rAF loop pumping controls.update() with autoRotate on.
 * GlobeMap's comment records that autoRotate "does nothing" — that is because
 * nothing there drives update(); the flag only takes effect while something
 * pumps it, which is also what lets this stop cleanly on unmount.
 */
function PinGlobe() {
  const wrapRef = useRef(null);
  const globeRef = useRef(null);
  const [size, setSize] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize(Math.round(el.getBoundingClientRect().width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (!ready) return;
    const g = globeRef.current;
    const controls = g.controls();
    controls.enableZoom = false;
    controls.enableRotate = false;
    controls.enablePan = false;
    // Altitude keeps the atmosphere inside the square canvas: at 1.6 the
    // camera sees ~121 units half-height against the glow's 118, so the halo
    // fades out before the canvas edge instead of being cut square by it.
    g.pointOfView({ lat: 18, lng: 0, altitude: 1.6 }, 0);
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.55;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf;
    const tick = () => { controls.update(); raf = requestAnimationFrame(tick); };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [ready]);
  return (
    // The white disc is the wrapper itself, so the sphere sits in the
    // artwork's ring the way the painted globe did, and covers it entirely.
    <span ref={wrapRef} style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(176,146,98,0.05)", overflow: "hidden" }}>
      {size > 0 && (
        <Suspense fallback={null}>
          <Globe
            ref={globeRef}
            width={size}
            height={size}
            onGlobeReady={() => setReady(true)}
            globeImageUrl="/earth-blue-marble.jpg"
            backgroundColor="rgba(0,0,0,0)"
            atmosphereColor={C.brass}
            atmosphereAltitude={0.18}
            showGraticules
          />
        </Suspense>
      )}
    </span>
  );
}

/* ---- the step marks -------------------------------------------------
   Drawn, not picked. lucide has a file, a globe and a pair of people, and
   at a glance those stand in for the reference's marks — but they are not
   them. The reference's first mark is a document with a folded corner
   carrying a person's bust and two rules beneath it, which is a CV, not a
   text file; its second is a globe with a hollow pin over its shoulder,
   not a globe; its third is three figures with the middle one larger, not
   two of a size. The difference between those pairs is the difference
   between "a profile" and "a document", so they are drawn.

   One language across all five: a 24 box, 1.5 stroke, round caps and
   joins, nothing filled. strokeWidth comes in as a prop so the row can
   set it once. */
const IconBox = ({ size = 34, strokeWidth = 1.5, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" style={{ display: "block" }}>{children}</svg>
);
const IconStage = ({ size = 34 }) => (
  // The entry gate card 02's proscenium stage, verbatim: solid gold arch,
  // swagged curtains, floor bar.
  <svg width={size} height={size} viewBox="0 0 96 96" fill="currentColor" aria-hidden="true">
    <path d="M12 22a36 14 0 0 1 72 0v4H12v-4z" />
    <path d="M20 26c12 4 16 18 8 30-5 8-9 12-9 20h-9c0-10 5-16 5-26 0-10-3-16 5-24z" />
    <path d="M76 26c-12 4-16 18-8 30 5 8 9 12 9 20h9c0-10-5-16-5-26 0-10 3-16-5-24z" />
    <rect x="14" y="80" width="68" height="8" rx="4" />
  </svg>
);
const IconProfileDoc = (p) => (
  // Softer, rounder profile mark: a person in a rounded badge with a small
  // sparkle — replaces the boxy dog-eared document at the user's request.
  <IconBox {...p}>
    <rect x="3.4" y="3.4" width="17.2" height="17.2" rx="6" />
    <circle cx="12" cy="10" r="2.6" />
    <path d="M7.4 17.6c.7-2.4 2.5-3.6 4.6-3.6s3.9 1.2 4.6 3.6" />
    <path d="M17.4 5.9l.5 1.1 1.1.5-1.1.5-.5 1.1-.5-1.1-1.1-.5 1.1-.5z" />
  </IconBox>
);
const IconGlobePin = (p) => (
  <IconBox {...p}>
    {/* A complete globe, with the pin's clearance carved by a mask rather
        than by ending the globe's arcs early. The earlier version stopped
        the circle where the pin would sit, which at 36px read as the icon
        being cut off. Here every globe line is whole; the mask erases a
        stroke-width halo around the pin's silhouette, so the pin sits in
        front with the clean gap the reference has, on any background. */}
    <defs>
      <mask id="artium-gpin-m" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
        <rect width="24" height="24" fill="#fff" />
        <path d="M18.2 2.5a3.7 3.7 0 0 1 3.7 3.7c0 2.6-3.7 7.4-3.7 7.4s-3.7-4.8-3.7-7.4a3.7 3.7 0 0 1 3.7-3.7z"
          fill="#000" stroke="#000" strokeWidth="3" />
      </mask>
    </defs>
    <g mask="url(#artium-gpin-m)">
      <circle cx="10.4" cy="12.8" r="8.1" />
      <path d="M2.5 9.9h15.8M2.5 15.7h15.8" />
      <ellipse cx="10.4" cy="12.8" rx="3.6" ry="8.1" />
    </g>
    <path d="M18.2 2.5a3.7 3.7 0 0 1 3.7 3.7c0 2.6-3.7 7.4-3.7 7.4s-3.7-4.8-3.7-7.4a3.7 3.7 0 0 1 3.7-3.7z" />
    <circle cx="18.2" cy="6.2" r="1.35" />
  </IconBox>
);
const IconThreePeople = (p) => (
  <IconBox {...p}>
    <circle cx="12" cy="8.1" r="3.1" />
    <path d="M5.9 20.1a6.1 6.1 0 0 1 12.2 0z" />
    <circle cx="4.6" cy="10.6" r="2.1" />
    <path d="M1.2 19.2a3.6 3.6 0 0 1 3.1-4.4" />
    <circle cx="19.4" cy="10.6" r="2.1" />
    <path d="M22.8 19.2a3.6 3.6 0 0 0-3.1-4.4" />
  </IconBox>
);
// The teaching man — the mark that used to be the artium logo. A silhouette
// through the same PNG mask the gate's conductor uses, so it is the mark
// itself rather than a redrawing of it. currentColor through backgroundColor,
// so it takes the row's gold like its stroked neighbours.
const IconTeacher = ({ size = 34 }) => (
  <span aria-hidden="true" style={{
    display: "block", width: size * 0.84, height: size, backgroundColor: "currentColor",
    WebkitMaskImage: `url('${TEACHER_MARK}')`, maskImage: `url('${TEACHER_MARK}')`,
    WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
    WebkitMaskSize: "contain", maskSize: "contain",
    WebkitMaskPosition: "center", maskPosition: "center",
  }} />
);
const IconMegaphone = (p) => (
  <IconBox {...p}>
    <path d="M3.4 9.6v4.1a1.9 1.9 0 0 0 1.9 1.9h1.8l9.6 4.3V5.3L7.1 9.6H5.3a1.9 1.9 0 0 0-1.9 1.9z" />
    <path d="M7.1 15.6v3.6a1.8 1.8 0 0 0 3.6 0v-2" />
    <path d="M19.6 9.4a3.6 3.6 0 0 1 0 5.7" />
  </IconBox>
);

function Landing({ onApply, onBack, onPreview, onProfile, onLogin, myProfile, studentLoggedOut, musicOn, onMusicToggle, error, onGoToLessonRoom, studentsByCons, hireCount = 0, hireIds = [], onGoToConcerts, onGoToComposers, authUser, isAdmin, onGoToAdmin, avatarPhotoUrl, avatarName }) {
  const memberCount = Object.values(studentsByCons).flat().length;
  const steps = [
    { n: "1", t: "Build your profile", Icon: IconProfileDoc,
      d: "Add your conservatory, repertoire, and a performance video to stand out." },
    { n: "2", t: "Join the map", Icon: IconGlobePin,
      d: "Your pin appears on the global map under your conservatory alongside current students." },
    { n: "3", t: "Connect worldwide", Icon: IconThreePeople,
      d: "Message students at any conservatory in the world, directly." },
    { n: "4", t: "Earn while you teach", Icon: IconTeacher,
      d: "Accept tutoring requests from music enthusiasts and set your own rate." },
    { n: "5", t: "Perform in concerts", Icon: IconStage,
      d: "Get hired to play in concerts, events and private engagements." },
    { n: "6", t: "Marketing and Advertising", Icon: IconMegaphone,
      d: <>Claim your promotional video on <a href="https://www.instagram.com/aclassicaltone?igsh=MTZzdzk3bWo5OGdkbA==" target="_blank" rel="noreferrer">aclassicaltone</a> (may be subject to fees, as per our partnership agreement).</> },
  ];
  return (
    // Re-skinned into the gate's current light theme (grey ground, ink/gold,
    // Playfair + Jost) — this used to be "the gate's world, continued" in the
    // old dark-prestige language, but the gate itself has since moved to a
    // light theme and this screen hadn't followed. artium-lp--light scopes
    // every override below so the shared .artium-gx-*/.artium-lp-* classes
    // this markup still uses stay untouched for the screens that are still
    // dark by design (signup flow, map, network, etc.) — see the CSS block
    // for the full list of what got scoped-overridden vs. left alone.
    <div className="artium-lp artium-lp--light">
      {/* Not <GateBackdrop> (that's the old dark hall photo, gone). The
          user's own artwork instead — colonnade/staff/dotted-map,
          re-grounded to the page's own grey — sitting behind the header
          through the pin block, the way the gate backs its own hero.
          .artium-lp-bd is a dedicated class, not the shared .artium-gx-bd,
          so it isn't caught by that class's dark-screen styling or by the
          .artium-lp--light .artium-gx-bd{display:none} safety net above. */}
      <div className="artium-lp-bd" aria-hidden="true" />

      <header className="artium-lp-bar">
        {/* Everyone can walk back to the entry gate — this was guest-only,
            which read as "no back button" to every signed-in user. Same
            puck as the welcome page's back control. */}
        <button onClick={onBack} className="artium-net-puck" aria-label="Back to the entrance">
          <ChevronLeft size={17} strokeWidth={2} />
        </button>
        {/* The gate's actual current lockup (ink caps, crossbar-less A) —
            not <GateLogo>, which is the OLD dark gate's champagne pin+serif
            mark and colors itself inline (can't be re-themed by CSS). Same
            "A" glyph as src/components/entrygate/ArtiumGate.jsx's header. */}
        <span className="artium-lp-word" aria-label="ARTIUM">
          <svg className="artium-lp-word-a" viewBox="0 0 15 15" aria-hidden="true">
            <path d="M7.5 0.9 L1.4 14.4 M7.5 0.9 L13.6 14.4" stroke="currentColor" strokeWidth="2.85" fill="none" />
          </svg>
          <span aria-hidden="true">RTIUM</span>
        </span>
        <div className="artium-lp-right">
          {/* Count first, then play, bell, avatar — and the play disc IS a
              .artium-net-puck now, the bell's own class, so the two can
              never drift apart in size or material again. */}
          <span className="artium-gx-count">
            <Users size={16} strokeWidth={1.8} />
            {memberCount}
          </span>
          {onMusicToggle && (
            <button
              className="artium-net-puck"
              onClick={onMusicToggle}
              title={musicOn ? "Pause" : "Play"}
              aria-label={musicOn ? "Pause playlist" : "Play playlist"}
            >
              {musicOn ? (
                <Pause size={15} color={C.inkText} strokeWidth={2.4} />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill={C.inkText} aria-hidden="true" style={{ marginLeft: 2 }}>
                  <path d="M8 5.5v13l11-6.5z" />
                </svg>
              )}
            </button>
          )}
          {myProfile && (
            <NotificationBell
              myProfile={myProfile}
              puck
              networkFeeds
              hireCount={hireCount}
              hireIds={hireIds}
              onGoToLessonRoom={onGoToLessonRoom}
              onGoToConcerts={onGoToConcerts}
              onGoToComposers={onGoToComposers}
              onGoToNews={() => {}}
              authUser={authUser}
              isAdmin={isAdmin}
              onGoToAdmin={onGoToAdmin}
            />
          )}
          {myProfile ? (
            <button onClick={onProfile} title="My profile" style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
              <Avatar name={myProfile.name} id="me" size={HEADER_CONTROL} photoUrl={myProfile.photoUrl} online />
            </button>
          ) : (
            // One account for the whole app: even mid-way through a role
            // flow (before there's a profiles row to hang the button above
            // off), the session behind this screen already has a face —
            // Google's photo, or initials off whatever name is known yet.
            <Avatar name={avatarName || "?"} id="me" size={HEADER_CONTROL} photoUrl={avatarPhotoUrl} />
          )}
        </div>
      </header>

      <main className="artium-lp-main">
        <h1 className="artium-lp-h1">Every Conservatory.<br />One Network.</h1>
        <div className="artium-gx-rule" aria-hidden="true"><span /><i /><span /></div>

        {/* The intro card is gone and its call to action moved to the header
            pill, so auth errors render on their own rather than inside it. */}
        {error && <p className="artium-lp-err">{error}</p>}

        {/* The pin is the button — the circular card it used to sit in is
            gone, so there is nothing between it and the page. */}
        <button
            type="button"
            onClick={myProfile ? onPreview : (studentLoggedOut ? onLogin : onApply)}
            className="artium-explore"
            aria-label={myProfile ? `Explore Artium's network — ${memberCount} members` : (studentLoggedOut ? "Log in" : "Sign up")}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: 12, padding: 0, border: "none", background: "none",
              cursor: "pointer", font: "inherit", textAlign: "center", width: "100%",
            }}
          >
          <span className="artium-lp-stage">
            {/* Taller than it is wide (0.669), so sized by height — a square box
                would letterbox it. The globe and the count are positioned
                against this wrapper, so it has to be the thing that moves. */}
            <span className="artium-globepin" style={{ height: "min(299px, 50.7vw)", aspectRatio: "560 / 837" }}>
              {/* glo-pin-ivory: the artwork duotoned ivory (highlights
                  #FDFBF6 to shadows #C9BBA2) — glo-pin.png's body reads
                  pure amber (#FDBC02) against the mock's cream tones,
                  wrong the same way glo-pin-ink was wrong on the old dark
                  ground. */}
              <img
                src="/glo-pin-ivory.png"
                alt=""
                width={560}
                height={837}
                style={{ display: "block", height: "100%", width: "auto" }}
              />
              <span className="artium-globepin-globe" aria-hidden="true">
                <PinGlobe />
              </span>
              {/* A manicule — the printer's pointing hand — in an ivory
                  puck disc per the mock (see /tmp/hand_crop.png): a
                  circular wrist cuff at the left feeding into an extended
                  index finger pointing right at the pin, with three
                  shorter curled fingers stacked below it. currentColor so
                  the light variant's puck styling can recolor it gold
                  without touching this markup. */}
              <span className="artium-globepin-hand-col" aria-hidden="true">
                <span className="artium-globepin-hand">
                  <img src="/hand-manicule.png" alt="" style={{ display: "block", width: "42%", height: "auto" }} />
                  {!myProfile && (
                    <span className="artium-globepin-register">{studentLoggedOut ? "Log in" : "Register"}</span>
                  )}
                </span>
              </span>
              <span className="artium-globepin-count">
                <Users />
                {/* Grouped thousands: this reads as a headcount, and five
                    figures unseparated read as a serial number. */}
                <span className="artium-globepin-count-n">{memberCount.toLocaleString()}</span>
              </span>
            </span>
          </span>
        </button>

        {/* Mock splits this into a small caps eyebrow over the serif line,
            not one two-line serif block — .artium-lp-h2 stays exactly the
            weight/size of .artium-lp-h1, only the wrapper's margin moved
            up to it since the eyebrow now carries the top gap. */}
        <div style={{ marginTop: 40 }}>
          <div className="artium-lp-eyebrow">How it works</div>
          <h2 className="artium-lp-h2">Simple, from day one.</h2>
        </div>
        <div className="artium-gx-rule" aria-hidden="true"><span /><i /><span /></div>

        <div className="artium-lp-steps">
          {steps.map((s) => (
            <div key={s.n} className="artium-lp-step">
              <span className="artium-lp-num">{s.n}</span>
              <span className="artium-lp-step-body">
                <h3 className="artium-lp-step-t">{s.t}</h3>
                <p className="artium-lp-step-d">{s.d}</p>
              </span>
              <span className="artium-lp-step-i" aria-hidden="true">
                <s.Icon size={44} strokeWidth={1.3} />
              </span>
            </div>
          ))}
        </div>
      </main>

      {/* The entry gate's current footer language, ported — "OUR PARTNERS"
          centered over a flush-left avatar lockup, not the old "In
          partnership with aclassicaltone" + social-puck row. New
          .artium-lp-partner* classes (not the shared .artium-gx-partner/
          .artium-gx-social, which stay exactly as they are for the dark
          screens that still use them) since the structure itself is
          different, not just the color. */}
      <footer className="artium-gx-foot">
        <div className="artium-gx-foot-top" aria-hidden="true" />
        <div className="artium-lp-partner">
          <span className="artium-lp-partner-lbl">Our partners</span>
          <a
            className="artium-lp-partner-avatar"
            href={ACT_INSTAGRAM}
            target="_blank"
            rel="noreferrer"
            aria-label="aclassicaltone on Instagram"
          >
            <img src="/partner-aclassicaltone.png" alt="" width="54" height="54" />
            <span className="artium-lp-partner-name">aclassicaltone</span>
          </a>
        </div>
        <div className="artium-gx-foot-line" aria-hidden="true" />
        <div className="artium-gx-foot-row">
          <span className="artium-gx-foot-links">
            <span>About Us</span><i aria-hidden="true">•</i>
            <span>Help Center</span><i aria-hidden="true">•</i>
            <span>Contact</span>
          </span>
          <span className="artium-gx-copy">© 2026 Artium. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* HIRER SIGNUP — Find a Concert Pianist                              */
/* ---------------------------------------------------------------- */
/**
 * Signup for the third audience: people hiring a pianist, not joining as
 * musicians. Four steps, because a hirer's questions are not a student's —
 * no audition, no conservatory, no repertoire history. Instead: who is
 * engaging, for what occasion, in what format, at what budget. The flow
 * borrows the student signup's whole visual language (roman stepper,
 * progress bars, chips, paper ground) so it reads as the same institution
 * asking different questions.
 *
 * On submit the account is created with the engagement carried in the auth
 * metadata (role: "concert_hirer") — no profiles row and no new tables, so
 * nothing here can collide with the students' schema while the concert
 * side of the product is still forming.
 */
/**
 * The stepper's ring: an arc of champagne over a faint track, with "n of m"
 * inside it. Rotated -90deg so the arc starts at twelve rather than three,
 * and the dash offset carries the whole animation — no width to transition,
 * so it cannot be knocked out of step by a reflow.
 */
function StepRing({ step, total, size = 62 }) {
  const R = 19.5, CIRC = 2 * Math.PI * R;
  const done = Math.max(0, Math.min(1, (step + 1) / total));
  return (
    <span className="artium-su-ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 44 44" aria-hidden="true">
        <circle cx="22" cy="22" r={R} fill="none" stroke="rgba(176,146,98,0.30)" strokeWidth="3" />
        <circle
          cx="22" cy="22" r={R} fill="none" stroke="#E9C88D" strokeWidth="3" strokeLinecap="round"
          strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - done)}
          transform="rotate(-90 22 22)"
        />
      </svg>
      <span>{step + 1} of {total}</span>
    </span>
  );
}

// "Create your account" is gone: one signup for the whole app means
// HirerSignup, like every other role flow, is only ever opened by someone
// who already has a session (see AuthPrompt / App's accountHomeScreen
// guard). What used to be step 0 (email/password) is simply not asked any
// more — the three real questions shift down to fill its place.
const HIRER_STEPS = ["Who's hiring", "The engagement", "Review & send"];
const HIRER_ORG = ["Individual", "Concert venue", "Orchestra", "Festival", "Agency", "Other"];
const HIRER_OCCASION = ["Concert", "Recital", "Wedding", "Corporate event", "Recording session", "Other"];
const HIRER_FORMAT = ["Solo recital", "Accompanist", "Chamber ensemble"];
const HIRER_BUDGET = ["Up to €500", "€500–1,500", "€1,500–5,000", "€5,000+", "To be discussed"];

function HirerSignup({ authUser, onBack, onDone }) {
  const [step, setStep] = useState(0);
  const [d, setD] = useState({
    name: "", org: "",
    occasion: "", city: "", date: "", format: "", budget: "", notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  // The leave-confirm modal below was carried over from the student flow —
  // without this state or the onCancel prop it expected, so the component
  // crashed on its very first render and the concert door never opened.
  const [confirmLeave, setConfirmLeave] = useState(false);
  const up = (patch) => setD((v) => ({ ...v, ...patch }));
  const anythingFilled = Object.values(d).some((v) => String(v).trim() !== "");

  const canNext = [
    d.name.trim().length > 1 && !!d.org,
    !!d.occasion && d.city.trim().length > 1 && !!d.format && !!d.budget,
    true,
  ][step];

  async function submit() {
    setErr(""); setSubmitting(true);
    // The engagement rides in the auth metadata: no profiles row, so the
    // hirer cannot trip the students' RLS or show up on the map. The
    // account already exists (whoever is filling this in got here through
    // AuthPrompt) — this attaches the hiring metadata to that same session
    // rather than creating a new one.
    const { error } = await supabase.auth.updateUser({
      data: {
        role: "concert_hirer", hirer_name: d.name.trim(), org_type: d.org,
        occasion: d.occasion, city: d.city.trim(), date: d.date.trim(),
        format: d.format, budget: d.budget, notes: d.notes.trim(),
      },
    });
    setSubmitting(false);
    if (error) { setErr(error.message); return; }
    setDone(true);
  }

  if (done) {
    return (
      <div className="min-h-full" style={{ background: C.ink, color: C.ivory, fontFamily: FONT_BODY }}>
        <div className="max-w-xl mx-auto px-6" style={{ paddingTop: 96, textAlign: "center" }}>
          <div style={{ width: 58, height: 58, margin: "0 auto 20px", borderRadius: "50%", border: `1.5px solid ${C.brass}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CheckIcon size={26} color={C.brass} />
          </div>
          <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 600, margin: 0 }}>You're in</h2>
          <p className="text-sm" style={{ color: C.ivoryDim, lineHeight: 1.6, marginTop: 14 }}>
            Your account is ready — browse the pianists on the network and contact the ones
            who fit <b>{d.occasion || "your event"}</b>{d.city ? <> in <b>{d.city}</b></> : null}.
          </p>
          <div style={{ marginTop: 26 }}>
            <PrimaryBtn onClick={onDone}>Browse pianists</PrimaryBtn>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="artium-su">
      {confirmLeave && (
        <div
          className="fixed z-50 flex items-center justify-center"
          style={{ inset: 0, background: "rgba(0,0,0,0.7)" }}
          onClick={() => setConfirmLeave(false)}
        >
          <div
            className="rounded-2xl p-7 max-w-sm w-full mx-4 lg-fade"
            style={{ background: C.inkSoft, border: `1px solid ${C.inkLine}`, color: C.ivory }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 21, fontWeight: 600 }}>Are you sure you want to leave?</h3>
            <p className="text-sm" style={{ margin: "8px 0 0", color: C.ivoryDim, lineHeight: 1.6 }}>
              What you've filled in here isn't saved yet — leaving now means starting the form again.
            </p>
            <div style={{ display: "flex", gap: 9, marginTop: 18 }}>
              {/* Staying is the safe answer, so it is the easy one to hit and
                  the one the eye lands on. Leaving is a choice, not a default. */}
              <button
                onClick={() => setConfirmLeave(false)}
                style={{ flex: 1, padding: "10px 14px", borderRadius: 999, border: "none", background: "linear-gradient(180deg, #EFD08A 0%, #DBAB4C 55%, #C9962E 100%)", color: C.brassText, fontFamily: FONT_BODY, fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}
              >
                Keep filling it in
              </button>
              <button
                onClick={() => { setConfirmLeave(false); onBack(); }}
                style={{ flex: "0 0 auto", padding: "10px 16px", borderRadius: 999, border: `1px solid ${C.inkLine}`, background: "rgba(176,146,98,0.05)", color: C.ivoryDim, fontFamily: FONT_BODY, fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="max-w-3xl mx-auto px-6" style={{ paddingTop: "calc(20px + env(safe-area-inset-top, 0px))" }}>
        <div className="flex items-center gap-3">
          <button onClick={step === 0 ? (anythingFilled ? () => setConfirmLeave(true) : onBack) : () => setStep(step - 1)} className="artium-aw-round" aria-label="Back">
            <ChevronLeft size={17} strokeWidth={2} />
          </button>
          <GateLogo word={20} />
        </div>
        <div className="artium-su-head">
          <StepRing step={step} total={HIRER_STEPS.length} />
          <span className="artium-su-head-text">
            <h2 className="artium-su-title">{HIRER_STEPS[step]}</h2>
            {HIRER_STEPS[step + 1] && <p className="artium-su-next">Next: <b>{HIRER_STEPS[step + 1]}</b></p>}
          </span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 pt-7 pb-10 lg-fade" key={step}>
        <div className="artium-su-card">
        {step === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 520 }}>
            <Field label="Your name">
              <input style={inputStyle} value={d.name} onChange={(e) => up({ name: e.target.value })} placeholder="Full name" autoComplete="name" />
            </Field>
            <Field label="You're hiring as">
              <div className="flex flex-wrap gap-2">
                {HIRER_ORG.map((o) => (
                  <Chip key={o} active={d.org === o} onClick={() => up({ org: o })}>{o}</Chip>
                ))}
              </div>
            </Field>
          </div>
        )}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 560 }}>
            <Field label="The occasion">
              <div className="flex flex-wrap gap-2">
                {HIRER_OCCASION.map((o) => (
                  <Chip key={o} active={d.occasion === o} onClick={() => up({ occasion: o })}>{o}</Chip>
                ))}
              </div>
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="City">
                <input style={inputStyle} value={d.city} onChange={(e) => up({ city: e.target.value })} placeholder="e.g. Vienna" />
              </Field>
              <Field label="Date (or roughly when)">
                <input style={inputStyle} value={d.date} onChange={(e) => up({ date: e.target.value })} placeholder="e.g. 14 May 2027 — or 'flexible'" />
              </Field>
            </div>
            <Field label="Format">
              <div className="flex flex-wrap gap-2">
                {HIRER_FORMAT.map((o) => (
                  <Chip key={o} active={d.format === o} onClick={() => up({ format: o })}>{o}</Chip>
                ))}
              </div>
            </Field>
            <Field label="Budget">
              <div className="flex flex-wrap gap-2">
                {HIRER_BUDGET.map((o) => (
                  <Chip key={o} active={d.budget === o} onClick={() => up({ budget: o })}>{o}</Chip>
                ))}
              </div>
            </Field>
            <Field label="Anything the pianist should know? (optional)">
              <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 80, lineHeight: 1.6 }} value={d.notes} onChange={(e) => up({ notes: e.target.value })} placeholder="Repertoire wishes, the venue's piano, rehearsal plans…" />
            </Field>
          </div>
        )}
        {step === 2 && (
          <div style={{ maxWidth: 560 }}>
            <div style={{ background: "rgba(176,146,98,0.05)", border: `1px solid ${C.inkLine}`, borderRadius: 12, padding: "18px 22px", display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                ["Account", authUser?.email || ""],
                ["Hiring as", `${d.name} — ${d.org}`],
                ["Engagement", `${d.occasion} · ${d.city}${d.date ? " · " + d.date : ""}`],
                ["Format", d.format],
                ["Budget", d.budget],
                d.notes ? ["Notes", d.notes] : null,
              ].filter(Boolean).map(([k, v]) => (
                <div key={k} style={{ display: "flex", gap: 14 }}>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.brassLabel, letterSpacing: 0.5, width: 92, flexShrink: 0, paddingTop: 2 }}>{k.toUpperCase()}</span>
                  <span style={{ fontSize: 14, lineHeight: 1.5 }}>{v}</span>
                </div>
              ))}
            </div>
            <p className="text-sm" style={{ color: C.ivoryDim, lineHeight: 1.6, marginTop: 16 }}>
              We come back with a shortlist of conservatory pianists who fit the
              engagement — you choose who to talk to. Nothing is booked until
              you agree it with the pianist.
            </p>
            {err && <p className="text-sm" style={{ color: C.burgundy, marginTop: 12 }}>{err}</p>}
          </div>
        )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto artium-su-nav">
        {step > 0 && <button className="artium-su-back" onClick={() => setStep(step - 1)}>Back</button>}
        {step < HIRER_STEPS.length - 1 ? (
          <button className="artium-su-next-btn" disabled={!canNext} onClick={() => setStep(step + 1)}>
            Next <ChevronRight size={17} strokeWidth={2.2} />
          </button>
        ) : (
          <button className="artium-su-next-btn" disabled={submitting} onClick={submit}>
            {submitting ? "Sending…" : "Send request"}
            <ArrowRight size={17} strokeWidth={2.2} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* FIND A CONCERT PIANIST — Discover, Contact, Negotiate, Book        */
/* ---------------------------------------------------------------- */
/**
 * The whole booking runs on one idea: the Deal and the Chat are different
 * things. Messages are conversation — cheap, ordered, disposable in spirit.
 * Offers are the record — versioned, structured, never edited once sent.
 * They share a timeline on screen because that is how the two actually
 * unfold together, but an offer is never a chat bubble with a fee inside it.
 * That is what would let two people disagree about what they agreed to.
 */
const CONCERT_EVENT_TYPES = ["Concert", "Recital", "Wedding", "Corporate event", "Festival", "Other"];

const INQUIRY_STATUS_LABEL = {
  open: "Open", negotiating: "Negotiating", agreed: "Agreed",
  confirmed: "Confirmed", declined: "Declined", cancelled: "Cancelled",
};
const INQUIRY_STATUS_COLOR = {
  open: C.brassLabel, negotiating: C.brassLabel, agreed: C.forest,
  confirmed: "#1A9E6E", declined: C.burgundy, cancelled: C.ivoryDim,
};

function StatusPill({ status }) {
  const label = INQUIRY_STATUS_LABEL[status] || status || "Open";
  const color = INQUIRY_STATUS_COLOR[status] || C.ivoryDim;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "4px 10px", borderRadius: 999, border: `1px solid ${color}`, color, flexShrink: 0 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      {label}
    </span>
  );
}

function fmtConcertDate(d) {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); }
  catch { return d; }
}
function fmtEUR(n) {
  const v = Number(n);
  return Number.isFinite(v) ? `€${v.toLocaleString()}` : null;
}

/**
 * Pinned above the chat for the life of the conversation. Whoever opens this
 * thread a week later — hirer, pianist, either — reads the engagement before
 * they read a single message, because the messages assume it.
 */
function EventSummaryCard({ inquiry }) {
  const bits = [
    fmtConcertDate(inquiry.eventDate), inquiry.location, inquiry.venue,
    inquiry.audience ? `${inquiry.audience} guests` : null, inquiry.budget,
  ].filter(Boolean);
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 5, background: C.parchment, borderBottom: `1px solid ${C.inkLine}`, padding: "14px 18px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 17, fontWeight: 600, color: C.ivory }}>{inquiry.eventType || "Concert engagement"}</p>
        <p style={{ margin: "3px 0 0", fontSize: 12.5, color: C.ivoryDim }}>{bits.join(" · ") || "Details to follow"}</p>
      </div>
      <StatusPill status={inquiry.status} />
    </div>
  );
}

function ConcertMessageBubble({ m, mine }) {
  const isImage = /\.(png|jpe?g|gif|webp)(\?|$)/i.test(m.attachmentName || m.attachmentUrl || "");
  // The row stores a storage PATH, not a URL — the bucket is private, so the
  // path is exchanged for a short-lived signed URL here, at render. That also
  // keeps the injection door shut: the column is text either party can write
  // through the API, and what lands in the href is only ever what Supabase
  // signed (or, for rows written while the bucket was public, an https URL —
  // anything else stays null and renders nothing).
  const [attachmentHref, setAttachmentHref] = useState(null);
  useEffect(() => {
    let live = true;
    if (!m.attachmentUrl) { setAttachmentHref(null); return; }
    getAttachmentUrl(m.attachmentUrl).then(({ url }) => {
      if (live) setAttachmentHref(url && /^https:\/\//i.test(url) ? url : null);
    });
    return () => { live = false; };
  }, [m.attachmentUrl]);
  return (
    <div style={{ maxWidth: "78%", alignSelf: mine ? "flex-end" : "flex-start", display: "flex", flexDirection: "column", gap: 6 }}>
      {m.body && (
        <div className="px-3.5 py-2 rounded-2xl text-sm" style={{ background: mine ? C.brass : C.inkSoft, color: mine ? C.brassText : C.ivory, fontWeight: mine ? 500 : 400 }}>
          {m.body}
        </div>
      )}
      {attachmentHref && (
        isImage ? (
          <a href={attachmentHref} target="_blank" rel="noreferrer">
            <img src={attachmentHref} alt={m.attachmentName || ""} style={{ maxWidth: 220, borderRadius: 12, border: `1px solid ${C.inkLine}`, display: "block" }} />
          </a>
        ) : (
          <a href={attachmentHref} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 10, border: `1px solid ${C.inkLine}`, background: "rgba(176,146,98,0.07)", color: C.ivory, textDecoration: "none", fontSize: 12.5 }}>
            <FileText size={14} /> {m.attachmentName || "Attachment"}
          </a>
        )
      )}
    </div>
  );
}

const OFFER_FIELDS = [
  ["eventDate", "Date"], ["startTime", "Time"], ["venue", "Venue"],
  ["durationMinutes", "Duration"], ["program", "Program"], ["travel", "Travel"],
  ["equipment", "Equipment"], ["cancellation", "Cancellation"], ["paymentSchedule", "Payment schedule"],
  ["notes", "Notes"],
];

/**
 * An offer in the timeline, structured rather than typed — the terms are
 * data, not prose, so nobody has to re-read three paragraphs to find out
 * what changed between v2 and v3. Every version stays on screen: superseded
 * ones collapse to a line rather than disappearing, because the record of
 * who proposed what, in what order, is the whole point of keeping it apart
 * from the chat.
 */
function OfferCard({ offer, isMine, expanded, onToggle, onAccept, onDecline, onCounter }) {
  const superseded = offer.status === "superseded";
  if (superseded && !expanded) {
    return (
      <button onClick={onToggle} style={{ alignSelf: "center", textAlign: "left", background: "transparent", border: `1px dashed ${C.inkLine}`, borderRadius: 999, padding: "7px 16px", color: C.ivoryDim, fontFamily: FONT_MONO, fontSize: 11.5, cursor: "pointer" }}>
        v{offer.version} · superseded — view
      </button>
    );
  }
  const rows = OFFER_FIELDS
    .map(([k, label]) => [label, k === "durationMinutes" ? (offer[k] ? `${offer[k]} min` : null) : offer[k]])
    .filter(([, v]) => v);
  const fee = fmtEUR(offer.feeEur);
  const statusColor = offer.status === "accepted" ? "#1A9E6E" : offer.status === "declined" ? C.burgundy : offer.status === "superseded" ? C.ivoryDim : C.brassLabel;
  return (
    <div style={{ alignSelf: "stretch", border: `1px solid ${offer.status === "proposed" ? C.brass : C.inkLine}`, borderRadius: 14, padding: "16px 18px", background: C.parchment, opacity: superseded ? 0.6 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.06em", color: C.brassLabel }}>OFFER · V{offer.version}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: statusColor }}>{offer.status}</span>
          {superseded && <button onClick={onToggle} style={{ background: "none", border: "none", color: C.ivoryDim, fontSize: 11, cursor: "pointer", padding: 0 }}>Collapse</button>}
        </div>
      </div>
      {fee && (
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 10 }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.ivoryDim, letterSpacing: "0.04em", width: 116, flexShrink: 0, textTransform: "uppercase" }}>Fee</span>
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 27, fontWeight: 700, color: C.brassLabel, lineHeight: 1 }}>{fee}</span>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map(([label, v]) => (
          <div key={label} style={{ display: "flex", gap: 14 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.ivoryDim, letterSpacing: "0.04em", width: 116, flexShrink: 0, textTransform: "uppercase", paddingTop: 2 }}>{label}</span>
            <span style={{ fontSize: 14, color: C.ivory, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{v}</span>
          </div>
        ))}
      </div>
      {offer.status === "proposed" && !isMine && (
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <PrimaryBtn onClick={onAccept}>Accept</PrimaryBtn>
          <GhostBtn onClick={onDecline}>Decline</GhostBtn>
          <GhostBtn onClick={onCounter}>Counter</GhostBtn>
        </div>
      )}
      {offer.status === "proposed" && isMine && (
        <p style={{ marginTop: 12, marginBottom: 0, fontSize: 12, color: C.ivoryDim }}>Sent — waiting on their response.</p>
      )}
    </div>
  );
}

/** Same fields createOffer expects, camelCase, the fee reusing the € prefix
 * pattern from the teaching-price field elsewhere in signup. */
function OfferForm({ initial, onSubmit, onCancel, submitting }) {
  const [f, setF] = useState(() => ({
    eventDate: initial?.eventDate || "", startTime: initial?.startTime || "", venue: initial?.venue || "",
    durationMinutes: initial?.durationMinutes || "", program: initial?.program || "", feeEur: initial?.feeEur || "",
    travel: initial?.travel || "", equipment: initial?.equipment || "", cancellation: initial?.cancellation || "",
    paymentSchedule: initial?.paymentSchedule || "", notes: initial?.notes || "",
  }));
  const up = (patch) => setF((v) => ({ ...v, ...patch }));
  const canSubmit = f.eventDate.trim() && f.venue.trim() && f.feeEur;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Date"><input type="date" style={inputStyle} value={f.eventDate} onChange={(e) => up({ eventDate: e.target.value })} /></Field>
        <Field label="Start time"><input type="time" style={inputStyle} value={f.startTime} onChange={(e) => up({ startTime: e.target.value })} /></Field>
      </div>
      <Field label="Venue"><input style={inputStyle} value={f.venue} onChange={(e) => up({ venue: e.target.value })} placeholder="Concert hall, address…" /></Field>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Duration (minutes)">
          <input style={inputStyle} value={f.durationMinutes} inputMode="numeric" placeholder="e.g. 90"
            onChange={(e) => up({ durationMinutes: e.target.value.replace(/[^0-9]/g, "") })} />
        </Field>
        <Field label="Fee">
          <div className="flex items-center gap-2">
            <span style={{ color: C.ivoryDim, fontSize: 16 }}>€</span>
            <input style={{ ...inputStyle, maxWidth: 160 }} value={f.feeEur} inputMode="numeric" placeholder="e.g. 1200"
              onChange={(e) => up({ feeEur: e.target.value.replace(/[^0-9]/g, "") })} />
          </div>
        </Field>
      </div>
      <Field label="Program"><textarea style={{ ...inputStyle, resize: "vertical", minHeight: 70, lineHeight: 1.6 }} value={f.program} onChange={(e) => up({ program: e.target.value })} placeholder="Repertoire for the evening…" /></Field>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Travel (optional)"><input style={inputStyle} value={f.travel} onChange={(e) => up({ travel: e.target.value })} placeholder="Covered, self-arranged…" /></Field>
        <Field label="Equipment (optional)"><input style={inputStyle} value={f.equipment} onChange={(e) => up({ equipment: e.target.value })} placeholder="Grand piano provided…" /></Field>
      </div>
      <Field label="Cancellation policy (optional)"><input style={inputStyle} value={f.cancellation} onChange={(e) => up({ cancellation: e.target.value })} placeholder="e.g. 50% refundable up to 14 days before" /></Field>
      <Field label="Payment schedule (optional)"><input style={inputStyle} value={f.paymentSchedule} onChange={(e) => up({ paymentSchedule: e.target.value })} placeholder="e.g. 30% deposit, balance on the day" /></Field>
      <Field label="Notes (optional)"><textarea style={{ ...inputStyle, resize: "vertical", minHeight: 60, lineHeight: 1.6 }} value={f.notes} onChange={(e) => up({ notes: e.target.value })} /></Field>
      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
        <PrimaryBtn onClick={() => canSubmit && onSubmit(f)} disabled={!canSubmit || submitting}>{submitting ? "Sending…" : "Send offer"}</PrimaryBtn>
        <GhostBtn onClick={onCancel}>Cancel</GhostBtn>
      </div>
    </div>
  );
}

/**
 * Once an offer is accepted, this replaces the Make-offer button. The
 * document card is the review step's aesthetic carried over — a key/value
 * block on a slightly raised surface — because signing is that same kind of
 * moment: read it once, plainly, before you commit to it.
 */
function AgreementPanel({ inquiry, role, myName, onSign, signing, acceptedOffer }) {
  const [name, setName] = useState(myName || "");
  if (inquiry.status !== "agreed" && inquiry.status !== "confirmed") return null;

  const mySignedAt = role === "hirer" ? inquiry.hirerSignedAt : inquiry.pianistSignedAt;
  const mySignedName = role === "hirer" ? inquiry.hirerSignedName : inquiry.pianistSignedName;
  const theirSignedAt = role === "hirer" ? inquiry.pianistSignedAt : inquiry.hirerSignedAt;
  const theirSignedName = role === "hirer" ? inquiry.pianistSignedName : inquiry.hirerSignedName;
  const theirPossessive = role === "hirer" ? "the pianist's" : "the hirer's";
  const fee = fmtEUR(acceptedOffer?.feeEur) || inquiry.budget;
  const dateStr = (d) => d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";

  if (inquiry.status === "confirmed") {
    return (
      <div style={{ background: "#FFFFFF", border: `1px solid ${C.brass}`, borderRadius: 16, padding: "22px", margin: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ width: 30, height: 30, borderRadius: "50%", border: `1.5px solid ${C.brass}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <CheckIcon size={15} color={C.brass} />
          </span>
          <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 19, fontWeight: 600, color: C.ivory }}>Booking confirmed</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[["Date", fmtConcertDate(inquiry.eventDate || acceptedOffer?.eventDate)], ["Location", inquiry.location], ["Fee", fee], ["Status", "Confirmed"]]
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} style={{ display: "flex", gap: 14 }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.brassLabel, letterSpacing: "0.04em", width: 78, flexShrink: 0 }}>{k.toUpperCase()}</span>
                <span style={{ fontSize: 14, color: C.ivory }}>{v}</span>
              </div>
            ))}
        </div>
        <p style={{ marginTop: 14, marginBottom: 0, fontSize: 12.5, color: C.ivoryDim, lineHeight: 1.6 }}>You will receive a confirmation email with the details.</p>
        <p style={{ marginTop: 6, marginBottom: 0, fontSize: 11.5, color: C.ivoryDim }}>Deposit and payment are arranged per the payment schedule above.</p>
      </div>
    );
  }

  return (
    <div style={{ background: C.parchment, border: `1px solid ${C.brass}`, borderRadius: 16, padding: "20px 22px", margin: 16 }}>
      <p style={{ margin: 0, fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.06em", color: C.brassLabel }}>AGREEMENT</p>
      <p style={{ margin: "10px 0 0", fontSize: 14, color: C.ivory, lineHeight: 1.7 }}>
        I agree to the terms above and wish to proceed with the booking.
      </p>
      {mySignedAt ? (
        <p style={{ marginTop: 14, marginBottom: 0, fontSize: 13, color: "#1A9E6E", fontWeight: 600 }}>
          Signed — {mySignedName}, {dateStr(mySignedAt)}
        </p>
      ) : (
        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input style={{ ...inputStyle, maxWidth: 280 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Type your full name to sign" />
          <PrimaryBtn onClick={() => name.trim() && onSign(name.trim())} disabled={!name.trim() || signing}>{signing ? "Signing…" : "Confirm & Sign"}</PrimaryBtn>
        </div>
      )}
      <p style={{ marginTop: 12, marginBottom: 0, fontSize: 12.5, color: C.ivoryDim }}>
        {theirSignedAt ? `Signed — ${theirSignedName}, ${dateStr(theirSignedAt)}` : `Awaiting ${theirPossessive} signature`}
      </p>
    </div>
  );
}

/**
 * The heart of the booking. One thread per inquiry, the event summary pinned
 * above it, offers and messages interleaved in one timeline below it, and
 * whichever of Make-an-offer or the Agreement panel is live pinned beneath
 * that. Polled every five seconds — there is no realtime channel for this
 * table, and a booking conversation tolerates a five-second lag in a way a
 * lesson chat would not.
 */
function ConcertConversation({ inquiryId, role, myId, myName, otherName, students, onBack }) {
  const [inquiry, setInquiry] = useState(null);
  const [messages, setMessages] = useState([]);
  const [offers, setOffers] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [counterFrom, setCounterFrom] = useState(null);
  const [signing, setSigning] = useState(false);
  const [expandedOffers, setExpandedOffers] = useState({});
  const [submittingOffer, setSubmittingOffer] = useState(false);
  const fileRef = useRef(null);
  const endRef = useRef(null);

  const refresh = React.useCallback(async () => {
    const [{ data: inq }, { data: msgs }, { data: offs }] = await Promise.all([
      getInquiry(inquiryId), listMessages(inquiryId), listOffers(inquiryId),
    ]);
    if (inq) setInquiry(inq);
    if (msgs) setMessages(msgs);
    if (offs) setOffers(offs);
  }, [inquiryId]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length, offers.length]);

  async function handleSend() {
    if (!text.trim() || sending) return;
    setSending(true);
    await sendConcertMessage(inquiryId, { body: text.trim() });
    setText("");
    setSending(false);
    refresh();
  }

  // Every write in this room can be refused by a trigger — that is the whole
  // point of the triggers — so a refusal has to say so. Before this, a
  // rejected click just refreshed and looked identical to nothing happening,
  // which teaches people the button is broken rather than the action illegal.
  const [actionErr, setActionErr] = useState("");

  async function handleAttach(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    const { url, name, error } = await uploadConcertFile(file);
    setUploading(false);
    if (error || !url) { setActionErr(error || "Upload failed."); return; }
    const { error: sendErr } = await sendConcertMessage(inquiryId, { body: "", attachmentUrl: url, attachmentName: name || file.name });
    setActionErr(sendErr || "");
    refresh();
  }

  // No status write here: the after-insert trigger flips open -> negotiating
  // itself, and a second manual write was one more thing able to drift.
  async function submitOffer(fields) {
    setSubmittingOffer(true);
    const { error } = await createOffer(inquiryId, fields);
    setSubmittingOffer(false);
    if (error) { setActionErr(error); return; }
    setActionErr("");
    setShowOfferForm(false);
    setCounterFrom(null);
    refresh();
  }

  async function respond(offerId, status) {
    const { error } = await respondToOffer(offerId, status);
    setActionErr(error || "");
    refresh();
  }

  async function sign(signedName) {
    setSigning(true);
    const { data, error } = await signAgreement(inquiryId, role, signedName);
    setSigning(false);
    setActionErr(error || "");
    if (data) setInquiry(data);
    refresh();
  }

  // Walking away. Declining is the pianist's word, withdrawing the hirer's —
  // same column, different verb, and the difference is what the other party
  // reads into it. Two clicks, because one click next to a chat box is how a
  // negotiation ends by accident.
  const [confirmLeaveDeal, setConfirmLeaveDeal] = useState(false);
  async function leaveDeal() {
    const status = role === "pianist" ? INQUIRY_STATUS.declined : INQUIRY_STATUS.cancelled;
    const { error } = await setInquiryStatus(inquiryId, status);
    setActionErr(error || "");
    setConfirmLeaveDeal(false);
    refresh();
  }

  if (!inquiry) return <div style={{ padding: 48, textAlign: "center", color: C.ivoryDim, fontSize: 13 }}>Loading…</div>;

  const currentProposed = [...offers].reverse().find((o) => o.status === "proposed");
  const acceptedOffer = [...offers].reverse().find((o) => o.status === "accepted");
  const timeline = [
    ...messages.map((m) => ({ type: "message", at: m.createdAt, key: `m${m.id}`, data: m })),
    ...offers.map((o) => ({ type: "offer", at: o.createdAt, key: `o${o.id}`, data: o })),
  ].sort((a, b) => new Date(a.at) - new Date(b.at));

  const closed = ["confirmed", "declined", "cancelled"].includes(inquiry.status);
  // Once either name is down the terms are no longer negotiable — the
  // database refuses new versions — so the button that would try disappears
  // rather than offering an action the trigger will bounce.
  const signingStarted = !!(inquiry.hirerSignedAt || inquiry.pianistSignedAt);
  const offerBtnLabel = currentProposed && currentProposed.createdBy !== myId ? "Make a counter-offer" : "Make an offer";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.ink }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: `1px solid ${C.inkLine}`, flexShrink: 0 }}>
        <button onClick={onBack} className="artium-aw-round" aria-label="Back"><ChevronLeft size={17} strokeWidth={2} /></button>
        <p style={{ margin: 0, flex: 1, fontSize: 14, fontWeight: 600, color: C.ivory }}>{otherName || (role === "hirer" ? "The pianist" : "The hirer")}</p>
        {!closed && !confirmLeaveDeal && (
          <button onClick={() => setConfirmLeaveDeal(true)}
            style={{ background: "none", border: "none", cursor: "pointer", color: C.ivoryDim, fontFamily: FONT_BODY, fontSize: 12, fontWeight: 600, padding: 0 }}>
            {role === "pianist" ? "Decline inquiry" : "Withdraw inquiry"}
          </button>
        )}
        {!closed && confirmLeaveDeal && (
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: C.ivoryDim }}>Are you sure?</span>
            <button onClick={leaveDeal}
              style={{ fontSize: 12, fontWeight: 700, padding: "5px 10px", borderRadius: 999, border: "none", background: "#c0392b", color: "#fff", cursor: "pointer" }}>
              Yes, {role === "pianist" ? "decline" : "withdraw"}
            </button>
            <button onClick={() => setConfirmLeaveDeal(false)}
              style={{ fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 999, border: `1px solid ${C.inkLine}`, background: "none", color: C.ivoryDim, cursor: "pointer" }}>
              Keep talking
            </button>
          </span>
        )}
      </div>

      <div className="lg-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <EventSummaryCard inquiry={inquiry} />
        <div style={{ padding: "16px 16px 8px", display: "flex", flexDirection: "column", gap: 14 }}>
          {timeline.length === 0 && <p style={{ textAlign: "center", color: C.ivoryDim, fontSize: 13, marginTop: 24 }}>Say hello and introduce the engagement.</p>}
          {timeline.map((item) => item.type === "message" ? (
            <ConcertMessageBubble key={item.key} m={item.data} mine={item.data.senderId === myId} />
          ) : (
            <OfferCard
              key={item.key}
              offer={item.data}
              isMine={item.data.createdBy === myId}
              expanded={!!expandedOffers[item.data.id]}
              onToggle={() => setExpandedOffers((v) => ({ ...v, [item.data.id]: !v[item.data.id] }))}
              onAccept={() => respond(item.data.id, "accepted")}
              onDecline={() => respond(item.data.id, "declined")}
              onCounter={() => { setCounterFrom(item.data); setShowOfferForm(true); }}
            />
          ))}
          <div ref={endRef} />
        </div>
        <AgreementPanel inquiry={inquiry} role={role} myName={myName} onSign={sign} signing={signing} acceptedOffer={acceptedOffer} />
      </div>

      {showOfferForm && (
        <div style={{ borderTop: `1px solid ${C.inkLine}`, padding: 16, maxHeight: "62vh", overflowY: "auto", flexShrink: 0 }}>
          <p style={{ margin: "0 0 12px", fontFamily: FONT_DISPLAY, fontSize: 17, fontWeight: 600, color: C.ivory }}>{counterFrom ? "Counter-offer" : "Make an offer"}</p>
          <OfferForm
            initial={counterFrom || { eventDate: inquiry.eventDate, venue: inquiry.venue }}
            submitting={submittingOffer}
            onSubmit={submitOffer}
            onCancel={() => { setShowOfferForm(false); setCounterFrom(null); }}
          />
        </div>
      )}

      {actionErr && (
        <p style={{ margin: 0, padding: "10px 16px", borderTop: `1px solid ${C.inkLine}`, fontSize: 12.5, color: C.burgundy, flexShrink: 0 }}>{actionErr}</p>
      )}

      {!showOfferForm && !closed && !signingStarted && (
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.inkLine}`, flexShrink: 0 }}>
          <PrimaryBtn full onClick={() => setShowOfferForm(true)}>{offerBtnLabel}</PrimaryBtn>
        </div>
      )}

      {!closed && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderTop: `1px solid ${C.inkLine}`, flexShrink: 0 }}>
          <button onClick={() => fileRef.current?.click()} disabled={uploading} className="artium-aw-round" aria-label="Attach file">
            <Paperclip size={16} strokeWidth={2} />
          </button>
          <input ref={fileRef} type="file" style={{ display: "none" }} onChange={handleAttach} />
          <input style={{ ...inputStyle, flex: 1 }} value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }} placeholder="Write a message…" />
          <button onClick={handleSend} disabled={sending || !text.trim()} className="rounded-full p-3" style={{ background: C.brass, opacity: sending || !text.trim() ? 0.6 : 1 }}>
            <Send size={16} color={C.brassText} />
          </button>
        </div>
      )}
    </div>
  );
}

/** Same row component either side of the deal — a hirer scanning who they've
 * contacted and a pianist scanning who's contacted them are reading the same
 * shape of fact: a person, an event, where it stands. */
function BookingsList({ inquiries, role, students, onOpen }) {
  if (!inquiries.length) {
    return (
      <div style={{ padding: "60px 24px", textAlign: "center" }}>
        <p style={{ color: C.ivoryDim, fontSize: 14 }}>
          {role === "hirer" ? "No inquiries yet — contact a pianist from the Pianists tab." : "No concert inquiries yet."}
        </p>
      </div>
    );
  }
  return (
    <div className="artium-aw-list" style={{ padding: "16px 16px 32px" }}>
      {inquiries.map((inq) => {
        const other = role === "hirer" ? students.find((s) => s.id === inq.pianistId) : null;
        const otherName = role === "hirer" ? (other?.name || "Pianist") : (inq.hirerName || "Hirer");
        return (
          <button key={inq.id} className="artium-aw-row" onClick={() => onOpen(inq.id)}>
            <Avatar name={otherName} id={inq.id} size={42} photoUrl={other?.photoUrl} />
            <span className="artium-aw-row-body">
              <p className="artium-aw-row-t">{otherName}</p>
              <p className="artium-aw-row-c">{[inq.eventType, fmtConcertDate(inq.eventDate)].filter(Boolean).join(" · ") || "Details pending"}</p>
            </span>
            <StatusPill status={inq.status} />
            <ChevronRight size={17} strokeWidth={2} />
          </button>
        );
      })}
    </div>
  );
}

/**
 * The hirer's Pianists tab — the network page's language (eyebrow, display
 * heading, stats row, rows) without the globe, because a hirer is not
 * browsing conservatories, they're browsing pianists.
 */
function PianistDiscover({ students, onOpen }) {
  const [q, setQ] = useState("");
  const consCount = new Set(students.map((p) => p.conservatoryId).filter(Boolean)).size;
  const availableCount = students.filter((p) => p.online).length;
  const needle = q.trim().toLowerCase();
  const rows = students.filter((p) => {
    if (!needle) return true;
    const cons = findConservatory(p.conservatoryId);
    return `${p.name} ${cons?.name || ""} ${cons?.city || ""}`.toLowerCase().includes(needle);
  });

  return (
    <div className="artium-aw">
      <header className="artium-aw-bar">
        <span />
        <GateLogo word={21} />
        <span className="artium-aw-bar-right">
          <span className="artium-aw-count"><Users size={16} strokeWidth={1.8} />{students.length}</span>
        </span>
      </header>

      <div className="artium-aw-in">
        <p className="artium-aw-eyebrow"><i />Find a Concert Pianist<i /></p>
        <h1 className="artium-aw-h1">Book a Pianist for Your Stage</h1>
        <p className="artium-aw-sub">Conservatory pianists, ready to perform.</p>

        <div className="artium-aw-stats">
          <div className="artium-aw-stat">
            <span className="artium-aw-stat-n"><User size={15} strokeWidth={2} />{students.length}</span>
            <p className="artium-aw-stat-l">Pianists</p>
          </div>
          <div className="artium-aw-stat">
            <span className="artium-aw-stat-n"><MapPin size={15} strokeWidth={2} />{consCount}</span>
            <p className="artium-aw-stat-l">Conservatories</p>
          </div>
          <div className="artium-aw-stat">
            <span className="artium-aw-stat-n"><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#1A9E6E", display: "inline-block" }} />{availableCount}</span>
            <p className="artium-aw-stat-l">Available now</p>
          </div>
        </div>

        <div className="artium-aw-find">
          <span className="artium-aw-field">
            <Search size={15} strokeWidth={2} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or conservatory…" />
          </span>
        </div>

        <div className="artium-aw-listhead">
          <h2>Pianists</h2>
          <span>{rows.length} result{rows.length === 1 ? "" : "s"}</span>
        </div>
        <div className="artium-aw-list">
          {rows.length === 0 && <p className="artium-aw-empty">{students.length === 0 ? "No pianists on the network yet — the conservatories are filling in." : "No pianist matches that search."}</p>}
          {rows.map((p) => {
            const cons = findConservatory(p.conservatoryId);
            return (
              <button key={p.id} className="artium-aw-row" onClick={() => onOpen(p.id)}>
                <Avatar name={p.name} id={p.id} size={42} photoUrl={p.photoUrl} online={p.online} />
                <span className="artium-aw-row-body">
                  <p className="artium-aw-row-t">{p.name}</p>
                  <p className="artium-aw-row-c"><span aria-hidden="true" style={{ fontSize: 11, lineHeight: 1 }}>{"\uD83D\uDCCD"}</span>{[cons?.name, cons?.city].filter(Boolean).join(", ") || "Conservatory pianist"}</p>
                </span>
                {p.concertFee ? <span className="artium-aw-teach">€{p.concertFee}</span> : <span style={{ fontSize: 11, color: C.ivoryDim, flexShrink: 0 }}>Fee on request</span>}
                {instrumentIcons(p).length > 0 && (
                  <span className="artium-aw-inst" data-two={instrumentIcons(p).length > 1 ? "1" : "0"}>
                    <span className="artium-aw-inst-art" aria-hidden="true">
                      {instrumentIcons(p).map((icon) => <img key={icon} src={`/instruments/${icon}.webp`} alt="" loading="lazy" />)}
                    </span>
                  </span>
                )}
                <ChevronRight size={17} strokeWidth={2} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * The pianist's profile as a hirer reads it — same top-of-page shape as
 * StudentProfile (identity left, cover video right), but no lesson or
 * teaching UI: a hirer is looking at the concert stage, not the practice
 * room, and the CTA says so.
 */
function HirerPianistProfile({ student, conservatory, onBack, onContact }) {
  if (!student) return null;
  const Row = ({ label, children }) => (
    <div style={{ background: "rgba(176,146,98,0.05)", border: `1px solid ${C.inkLine}`, borderRadius: 10, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: C.brassLabel, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
      <div style={{ fontSize: 15, color: C.ivory, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px" }}>
      <button onClick={onBack} className="artium-aw-round" style={{ marginBottom: 20 }} aria-label="Back"><ChevronLeft size={17} strokeWidth={2} /></button>
      <div className="artium-pf-top" data-solo={student.coverVideoUrl ? "0" : "1"}>
        <div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 28 }}>
            <div style={{ marginTop: 4 }}><Avatar name={student.name} id={student.id} size={64} photoUrl={student.photoUrl} online={student.online} /></div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: C.ivory, margin: 0, lineHeight: 1.3 }}>{student.name}</h2>
              <p style={{ fontSize: 13, color: C.ivoryDim, margin: "3px 0 0" }}>Concert pianist</p>
              {conservatory && <p style={{ fontSize: 13, color: C.ivoryDim, margin: "1px 0 0" }}>{conservatory.name}, {conservatory.city}</p>}
            </div>
            <div style={{ flexShrink: 0 }}>
              <PrimaryBtn onClick={onContact} icon={ArrowRight}>Contact &amp; Book</PrimaryBtn>
            </div>
          </div>
          {student.bio && <p style={{ fontSize: 15, color: C.ivoryDim, lineHeight: 1.75, marginBottom: 24 }}>{student.bio}</p>}
          <ProfileLinks links={student.links} />
        </div>
        {student.coverVideoUrl && <Row label="Cover video"><CoverVideo url={student.coverVideoUrl} /></Row>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {(student.pieces || []).length > 0 && (
          <Row label="Current repertoire">
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
              {student.pieces.map((p, i) => (
                <div key={i} style={{ fontSize: 14, color: C.ivory }}>
                  <span style={{ fontWeight: 600 }}>{p.title}</span>
                  <span style={{ color: C.ivoryDim }}> — {p.composer}</span>
                </div>
              ))}
            </div>
          </Row>
        )}
        {(student.tastes || []).length > 0 && (
          <Row label="Preferences">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
              {student.tastes.map((t) => <span key={t} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, border: `1px solid ${C.inkLine}`, color: C.ivory, background: C.inkSoft }}>{t}</span>)}
            </div>
          </Row>
        )}
      </div>
    </div>
  );
}

/** One screen, prefilled from the auth metadata the hirer already gave at
 * signup so the second ask is short. Submitting is where the Deal object
 * begins — everything after this lives in createInquiry's row, not in state
 * that could be lost on a refresh. */
function ConcertInquiryForm({ pianist, hirerMeta, onSubmit, onCancel, submitting }) {
  const [f, setF] = useState(() => ({
    eventType: CONCERT_EVENT_TYPES.includes(hirerMeta?.occasion) ? hirerMeta.occasion : "",
    eventDate: "", location: hirerMeta?.city || "", venue: "",
    audience: "", repertoire: "", message: hirerMeta?.notes || "", budget: hirerMeta?.budget || "",
  }));
  const up = (patch) => setF((v) => ({ ...v, ...patch }));
  const canSubmit = !!f.eventType && !!f.eventDate && f.location.trim().length > 0;
  const firstName = pianist?.name?.split(" ")[0] || "the pianist";

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "32px 24px 60px" }}>
      <button onClick={onCancel} className="artium-aw-round" style={{ marginBottom: 20 }} aria-label="Back"><ChevronLeft size={17} strokeWidth={2} /></button>
      <p style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.06em", color: C.brassLabel, margin: "0 0 6px" }}>CONTACT {firstName.toUpperCase()}</p>
      <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 600, color: C.ivory, margin: "0 0 24px" }}>Tell us about the engagement</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <Field label="Event type">
          <div className="flex flex-wrap gap-2">
            {CONCERT_EVENT_TYPES.map((o) => <Chip key={o} active={f.eventType === o} onClick={() => up({ eventType: o })}>{o}</Chip>)}
          </div>
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Date"><input type="date" style={inputStyle} value={f.eventDate} onChange={(e) => up({ eventDate: e.target.value })} /></Field>
          <Field label="Expected audience (optional)"><input style={inputStyle} value={f.audience} onChange={(e) => up({ audience: e.target.value.replace(/[^0-9]/g, "") })} placeholder="e.g. 200" inputMode="numeric" /></Field>
        </div>
        <Field label="Location — city, country"><input style={inputStyle} value={f.location} onChange={(e) => up({ location: e.target.value })} placeholder="e.g. Vienna, Austria" /></Field>
        <Field label="Venue (optional)"><input style={inputStyle} value={f.venue} onChange={(e) => up({ venue: e.target.value })} placeholder="Concert hall, address…" /></Field>
        <Field label="Desired repertoire (optional)"><textarea style={{ ...inputStyle, resize: "vertical", minHeight: 80, lineHeight: 1.6 }} value={f.repertoire} onChange={(e) => up({ repertoire: e.target.value })} placeholder="Anything specific you'd like performed…" /></Field>
        <Field label="Message">
          <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 100, lineHeight: 1.6 }} value={f.message} onChange={(e) => up({ message: e.target.value })}
            placeholder={`Introduce yourself and the occasion to ${firstName}…`} />
        </Field>
        <Field label="Budget (optional)">
          <div className="flex flex-wrap gap-2">
            {HIRER_BUDGET.map((o) => <Chip key={o} active={f.budget === o} onClick={() => up({ budget: f.budget === o ? "" : o })}>{o}</Chip>)}
          </div>
        </Field>
        <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
          <PrimaryBtn onClick={() => canSubmit && onSubmit(f)} disabled={!canSubmit || submitting}>{submitting ? "Sending…" : "Send inquiry"}</PrimaryBtn>
          <GhostBtn onClick={onCancel}>Cancel</GhostBtn>
        </div>
      </div>
    </div>
  );
}

/**
 * The hirer's whole world: two tabs, Pianists and Bookings, plus Home. No
 * Messages and no Profile — a hirer never messages anyone outside a booking
 * thread, and their one fact worth editing (name, event) lives in the
 * inquiry form each time, not behind a settings screen.
 *
 * Self-contained the way LearnerScreen is: its own tab state, its own
 * bottom bar, reusing BottomTabs rather than the app-wide one so a hirer
 * session never has to thread its screen through App()'s own routing.
 */
function HirerApp({ authUser, students, onHome }) {
  const meta = authUser?.user_metadata || {};
  const hirerName = meta.hirer_name || "";
  const hirerEmail = authUser?.email || "";
  const myId = authUser?.id;

  const [tab, setTab] = useState("pianists");
  const [selectedPianistId, setSelectedPianistId] = useState(null);
  const [composing, setComposing] = useState(false);
  const [activeInquiryId, setActiveInquiryId] = useState(null);
  const [inquiries, setInquiries] = useState([]);
  const [offerAttention, setOfferAttention] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const pianists = React.useMemo(
    () => students.filter((s) => instrumentsOf(s).includes("Piano") && s.concertOpen !== false),
    [students]
  );
  const selectedPianist = students.find((s) => s.id === selectedPianistId);

  const refreshInquiries = React.useCallback(() => {
    listInquiries("hirer").then(({ data }) => { if (data) setInquiries(data); });
  }, []);
  useEffect(() => {
    refreshInquiries();
    const id = setInterval(refreshInquiries, 15000);
    return () => clearInterval(id);
  }, [refreshInquiries]);

  // A proposed offer the pianist sent, not yet answered. Cheap enough to
  // check on every poll: this only runs for threads actually in negotiation.
  useEffect(() => {
    const negotiating = inquiries.filter((q) => q.status === "negotiating");
    if (!negotiating.length) { setOfferAttention({}); return; }
    let live = true;
    Promise.all(negotiating.map((q) => listOffers(q.id).then(({ data }) => [q.id, data || []])))
      .then((pairs) => {
        if (!live) return;
        const map = {};
        for (const [id, list] of pairs) {
          const latest = [...list].reverse().find((o) => o.status === "proposed");
          map[id] = !!(latest && latest.createdBy !== myId);
        }
        setOfferAttention(map);
      });
    return () => { live = false; };
  }, [inquiries, myId]);

  const needsAttention = inquiries.some((q) => (q.status === "agreed" && !q.hirerSignedAt) || offerAttention[q.id]);

  async function submitInquiry(f) {
    if (!selectedPianist) return;
    setSubmitting(true);
    const { data } = await createInquiry({
      hirerName, hirerEmail, pianistId: selectedPianist.id,
      eventType: f.eventType, eventDate: f.eventDate, location: f.location, venue: f.venue,
      audience: f.audience, repertoire: f.repertoire, message: f.message, budget: f.budget,
    });
    setSubmitting(false);
    if (!data) return;
    setComposing(false);
    setSelectedPianistId(null);
    refreshInquiries();
    setActiveInquiryId(data.id);
    setTab("bookings");
  }

  const items = [
    { k: "pianists", label: "Pianists", Icon: Music2 },
    { k: "bookings", label: "Bookings", Icon: BookOpen, attention: needsAttention },
    { k: "home", label: "Home", Icon: Home },
  ];

  const overlayOpen = !!activeInquiryId || composing || !!selectedPianistId;

  return (
    <div className="min-h-full flex flex-col artium-has-tabs" style={{ background: C.inkSoft, color: C.ivory }}>
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {activeInquiryId ? (
          <ConcertConversation
            inquiryId={activeInquiryId} role="hirer" myId={myId} myName={hirerName}
            otherName={students.find((s) => s.id === inquiries.find((q) => q.id === activeInquiryId)?.pianistId)?.name}
            students={students}
            onBack={() => { setActiveInquiryId(null); refreshInquiries(); }}
          />
        ) : composing && selectedPianist ? (
          <ConcertInquiryForm pianist={selectedPianist} hirerMeta={meta} submitting={submitting}
            onSubmit={submitInquiry} onCancel={() => setComposing(false)} />
        ) : selectedPianistId ? (
          <HirerPianistProfile student={selectedPianist} conservatory={findConservatory(selectedPianist?.conservatoryId)}
            onBack={() => setSelectedPianistId(null)} onContact={() => setComposing(true)} />
        ) : tab === "pianists" ? (
          <PianistDiscover students={pianists} onOpen={setSelectedPianistId} />
        ) : (
          <div style={{ padding: "24px 0 0" }}>
            <div className="px-6 pb-2">
              <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 600, color: C.ivory, margin: 0 }}>Bookings</h2>
              <p style={{ fontSize: 13, color: C.ivoryDim, marginTop: 4 }}>Every pianist you've reached out to.</p>
            </div>
            <BookingsList inquiries={inquiries} role="hirer" students={students} onOpen={setActiveInquiryId} />
          </div>
        )}
      </div>
      {!overlayOpen && (
        <BottomTabs items={items} active={tab} onTab={(k) => { if (k === "home") { onHome(); return; } setTab(k); }} />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* SIGNUP FLOW                                                        */
/* ---------------------------------------------------------------- */
const STEP_LABELS = ["Introduce yourself", "Choose your conservatory", "Your musical voice", "Current repertoire", "Top | Flop | Composer", "Teaching", "Review and submit"];

function SignupFlow({ draft, update, toggleTaste, step, setStep, editing, onSubmit, onCancel, onHome, authError, resumed, onStartFresh }) {
  const [submitting, setSubmitting] = useState(false);
  // Asked before leaving, because Leave is one tap from a form somebody has
  // been filling for several minutes and the button gives no clue what it
  // costs. The answer — nothing — is the whole reason to ask.
  const [confirmLeave, setConfirmLeave] = useState(false);
  // One signup for the whole app: everyone who reaches this flow now arrives
  // already authenticated (see AuthPrompt / startApply's freshAuthedDraft),
  // so the account-creation step this used to open on never has anything to
  // collect — it is skipped exactly the way `editing` already skips it for
  // someone updating an existing profile. "__google__"/"__authed__" are the
  // two sentinels a fresh draft's password can hold now (real Google auth,
  // or an email/password session from the prompt); a blank password only
  // happens if this is ever reached without going through startApply.
  const skipAccountStep = editing || draft.password === "__google__" || draft.password === "__authed__";
  const labels = skipAccountStep ? STEP_LABELS : ["Create your account", ...STEP_LABELS];
  const lastStep = labels.length - 1;
  const idx = skipAccountStep ? step : step - 1;
  const stepValid = [
    !skipAccountStep ? draft.email.trim().length > 3 && draft.password.length >= 6 && draft.password === draft.confirmPassword : null,
    draft.name.trim().length > 1 && instrumentsOf(draft).length > 0,
    // On the document route the upload is what gates the step — a conservatory
    // may not be selectable yet, since the approved list starts empty.
    // No Google bypass on the document route: signing in with Google says
    // nothing about whether they study anywhere.
    // No door chosen, nothing to validate yet — the step is a question at
    // that point, not a form.
    (editing || !!draft.applicant) && (draft.verifyMethod === "document"
      ? (editing || !!draft.proofDocUrl)
      // A sent domain request is a complete answer on the email route: they
      // have given us a school and an address at it, and the rest is ours.
      // `password === "__google__"` used to sit alongside conservatoryVerified
      // here, which let any Google account past this step with any school
      // selected — the same hole as the banner, and it would have waved
      // through anyone who reached step 4 regardless of what step 3 showed.
      // A Google address that does belong to the school now sets
      // conservatoryVerified itself, so this only has to ask the one question.
      // `editing` normally waves this step through, because an existing member
      // already proved their school. A transfer in progress is the exception:
      // they have asked to move and not yet proved the new one, so saving now
      // would send them to a school they never confirmed — and the database
      // would unapprove them for it.
      : !draft.transferPending
        && (!!draft.domainReq
          || (!!draft.conservatoryId && (editing || draft.conservatoryVerified)))),
    draft.tastes.length >= 3,
    draft.pieces.length >= 1,
    true,
    !draft.teaching.open || !!draft.teaching.mode,
    true,
  ].filter((v) => v !== null);
  const canNext = stepValid[step];
  // Saving from the header skips the remaining steps, so it has to answer for
  // all of them rather than just the one on screen — otherwise the shortcut
  // becomes a way to save a profile the long route would have refused, and an
  // unfinished transfer is one of the things it would let through.
  const canSaveAll = editing && stepValid.every(Boolean);

  async function handleSubmit() {
    setSubmitting(true);
    await onSubmit();
    setSubmitting(false);
  }

  return (
    <div className="artium-su">
      {confirmLeave && (
        <div
          className="fixed z-50 flex items-center justify-center"
          style={{ inset: 0, background: "rgba(0,0,0,0.7)" }}
          onClick={() => setConfirmLeave(false)}
        >
          <div
            className="rounded-2xl p-7 max-w-sm w-full mx-4 lg-fade"
            style={{ background: C.inkSoft, border: `1px solid ${C.inkLine}`, color: C.ivory }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 21, fontWeight: 600 }}>Are you sure you want to leave?</h3>
            <p className="text-sm" style={{ margin: "8px 0 0", color: C.ivoryDim, lineHeight: 1.6 }}>
              Everything you filled in is still here. You just have to sign up again, or log in, to carry on.
            </p>
            <div style={{ display: "flex", gap: 9, marginTop: 18 }}>
              {/* Staying is the safe answer, so it is the easy one to hit and
                  the one the eye lands on. Leaving is a choice, not a default. */}
              <button
                onClick={() => setConfirmLeave(false)}
                style={{ flex: 1, padding: "10px 14px", borderRadius: 999, border: "none", background: "linear-gradient(180deg, #EFD08A 0%, #DBAB4C 55%, #C9962E 100%)", color: C.brassText, fontFamily: FONT_BODY, fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}
              >
                Keep filling it in
              </button>
              <button
                onClick={() => { setConfirmLeave(false); onCancel(); }}
                style={{ flex: "0 0 auto", padding: "10px 16px", borderRadius: 999, border: `1px solid ${C.inkLine}`, background: "rgba(176,146,98,0.05)", color: C.ivoryDim, fontFamily: FONT_BODY, fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="max-w-3xl mx-auto px-6" style={{ paddingTop: "calc(20px + env(safe-area-inset-top, 0px))" }}>
        {/* Wraps rather than clips: the back button, the wordmark and two
            pills do not fit on one line on a small phone, and Save was
            running off the right edge with nothing to scroll to. */}
        <div className="flex items-center gap-3" style={{ flexWrap: "wrap", rowGap: 8 }}>
          {/* Back walks the steps and stops at the first one. It used to leave
              the flow from step one, so the same button that had meant "go
              back a step" seven times suddenly meant "abandon this" — one tap
              past the beginning and the signup was gone.

              Editing keeps the old behaviour: Cancel sits beside it there, so
              leaving is already spoken for and the first step is where you
              came in. */}
          <button
            onClick={step === 0 ? (editing ? onCancel : undefined) : () => setStep(step - 1)}
            disabled={step === 0 && !editing}
            className="artium-aw-round"
            aria-label={step === 0 ? "You're on the first step" : "Back a step"}
            style={step === 0 && !editing ? { opacity: 0.35, cursor: "default" } : undefined}
          >
            <ChevronLeft size={17} strokeWidth={2} />
          </button>
          {/* The gate's lockup, so the flow reads as the same product the
              visitor just came through rather than a form it handed them to. */}
          <GateLogo word={20} />
          {/* A way out, now that Back no longer is one.
              Quiet on purpose: it sits opposite the step ring rather than
              beside the wordmark, so it reads as an exit rather than an
              invitation. And it says what happens next — leaving costs
              nothing, because the answers are kept. */}
          {!editing && (
            <button
              onClick={() => setConfirmLeave(true)}
              title="Your answers are saved — you can pick this up later"
              style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 600, color: C.ivoryDim, background: "rgba(176,146,98,0.07)", border: `1px solid ${C.inkLine}`, borderRadius: 999, padding: "7px 15px", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              Leave
            </button>
          )}
          {editing && (
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={onCancel} style={{ fontSize: 12.5, fontWeight: 600, color: C.ivoryDim, background: "rgba(176,146,98,0.07)", border: `1px solid ${C.inkLine}`, borderRadius: 999, padding: "7px 15px", cursor: "pointer" }}>
                Cancel
              </button>
              {/* Changing one line of a bio meant clicking Next through six
                  steps to reach a save. This is the same submit the last step
                  makes, just reachable from wherever they are. */}
              <button
                onClick={handleSubmit}
                disabled={!canSaveAll || submitting}
                title={canSaveAll ? undefined : "Finish the highlighted step before saving"}
                style={{
                  fontSize: 12.5, fontWeight: 700, borderRadius: 999, padding: "7px 15px",
                  border: "none", whiteSpace: "nowrap",
                  cursor: canSaveAll && !submitting ? "pointer" : "not-allowed",
                  color: canSaveAll ? C.brassText : C.ivoryDim,
                  background: canSaveAll ? "linear-gradient(180deg, #EFD08A 0%, #DBAB4C 55%, #C9962E 100%)" : "rgba(176,146,98,0.05)",
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? "Saving…" : "Save changes"}
              </button>
            </div>
          )}
        </div>
        {/* Said once, on the step they land on. Restoring someone's answers
            without telling them is its own small unpleasantness — they wonder
            where it came from, and whether it is really theirs. */}
        {resumed && !editing && (
          <div style={{ marginTop: 14, padding: "11px 13px", borderRadius: 12, border: "1px solid rgba(239,208,155,0.35)", background: "rgba(239,208,155,0.06)" }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.brassLabel }}>Picked up where you left off</p>
            <p className="text-sm" style={{ margin: "4px 0 0", color: C.ivoryDim, lineHeight: 1.5 }}>
              Everything you filled in is still here. Set your password again — it's the one thing we don't keep — and carry on.
            </p>
            <button onClick={onStartFresh} style={{ marginTop: 8, padding: 0, background: "none", border: "none", color: C.brassLabel, fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>
              Start again from scratch
            </button>
          </div>
        )}
        <div className="artium-su-head">
          <StepRing step={step} total={labels.length} />
          <span className="artium-su-head-text">
            <h2 className="artium-su-title">{labels[step]}</h2>
            {labels[step + 1] && <p className="artium-su-next">Next: <b>{labels[step + 1]}</b></p>}
          </span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 pt-7 pb-10 lg-fade" key={step}>
        <div className="artium-su-card">
        {!skipAccountStep && step === 0 && <StepAccount draft={draft} update={update} error={authError} />}
        {idx === 0 && <StepIntro draft={draft} update={update} />}
        {idx === 1 && <StepConservatory draft={draft} update={update} editing={editing} />}
        {idx === 2 && <StepTastes draft={draft} toggleTaste={toggleTaste} />}
        {idx === 3 && <StepPieces draft={draft} update={update} />}
        {idx === 4 && <StepTopFlop draft={draft} update={update} />}
        {idx === 5 && <StepTeaching draft={draft} update={update} />}
        {idx === 6 && <StepReview draft={draft} />}
        </div>
      </div>

      {/* Shown wherever the submit that produced it can be pressed. It used to
          be gated on the last step, which was true of signup and false of
          editing — the header's Save changes is reachable from every step, so
          a rejected save set this and rendered nothing. The button said
          "Saving…", settled back, and the screen stayed put with no reason
          given, which reads as a save that worked and a page that would not
          leave. A write that fails has to say so from wherever it was made. */}
      {(editing || step === lastStep) && authError && (
        <div className="max-w-3xl mx-auto px-6 pb-4">
          <p className="text-sm" style={{ color: C.burgundy }}>{authError}</p>
        </div>
      )}

      <div className="max-w-3xl mx-auto artium-su-nav">
        {step > 0 && (
          <button className="artium-su-back" onClick={() => setStep(step - 1)}>Back</button>
        )}
        {step < lastStep ? (
          <button className="artium-su-next-btn" disabled={!canNext} onClick={() => setStep(step + 1)}>
            Next <ChevronRight size={17} strokeWidth={2.2} />
          </button>
        ) : (
          <button className="artium-su-next-btn" disabled={submitting} onClick={handleSubmit}>
            {submitting ? "Submitting…" : editing ? "Save changes" : "Submit application"}
            {editing ? <Check size={17} strokeWidth={2.2} /> : <ArrowRight size={17} strokeWidth={2.2} />}
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block mb-5">
      <span className="block mb-2" style={{ fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 600, letterSpacing: "0.01em", color: "#CFCFCF" }}>{label}</span>
      {children}
    </label>
  );
}
// The gate's field: glass over the page with a hairline, not a white card
// re-tinted. The focus ring is a CSS rule further down — an inline style
// cannot express :focus.
const inputStyle = { width: "100%", background: "#FFFFFF", border: "1px solid rgba(176,146,98,0.30)", borderRadius: 11, padding: "12px 15px", color: "#232A3B", fontFamily: FONT_BODY, fontSize: 15, outline: "none", boxShadow: "none" };

function PasswordField({ value, onChange, placeholder, autoComplete }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        style={{ ...inputStyle, paddingRight: 42 }}
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete || "off"}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute"
        style={{ right: 12, top: "50%", transform: "translateY(-50%)", color: C.ivoryDim, lineHeight: 0 }}
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function PhotoUpload({ name, photoUrl, onChange }) {
  const inputRef = useRef(null);
  function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  }
  return (
    <div className="flex items-center gap-4 mb-7">
      <Avatar name={name || "?"} photoUrl={photoUrl} size={72} />
      <div>
        <button
          type="button"
          onClick={() => inputRef.current && inputRef.current.click()}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm"
          style={{ fontFamily: FONT_BODY, fontWeight: 600, color: C.ivory, border: `1px solid ${C.inkLine}` }}
        >
          <Upload size={14} /> {photoUrl ? "Change photo" : "Upload photo"}
        </button>
        {photoUrl && (
          <button type="button" onClick={() => onChange("")} className="ml-3 text-sm" style={{ color: C.ivoryDim }}>
            Remove
          </button>
        )}
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        {/* No caption. "Upload photo" already reads as an offer rather than a
            demand, and the file picker enforces the format itself. */}
      </div>
    </div>
  );
}

const COVER_VIDEO_MAX_SECONDS = 25;

// Long enough for a real answer, short enough that a profile card can show it
// whole. Past this it stops being a pitch and becomes a page.
const TEACHING_PITCH_MAX = 400;

/**
 * Reads a video file's duration before anything is uploaded.
 *
 * Metadata only — the browser fetches the header, not the file — so a long
 * video is refused in the moment it is chosen rather than after a minute of
 * upload. NaN when the browser cannot decode it, which is treated as "let it
 * through": a codec this browser cannot read is not evidence of length, and
 * the storage limit will catch anything genuinely enormous.
 */
function videoDuration(file) {
  return new Promise((resolve) => {
    const el = document.createElement("video");
    el.preload = "metadata";
    el.onloadedmetadata = () => { URL.revokeObjectURL(el.src); resolve(el.duration); };
    el.onerror = () => resolve(NaN);
    el.src = URL.createObjectURL(file);
  });
}

/**
 * The cover video: twenty-five seconds at the top of a profile.
 *
 * It replaces a cover photo that was stored as a base64 data URI inside the
 * profiles row. That was survivable for an image and impossible for video, so
 * the file goes to the student-video bucket and the row keeps a URL.
 *
 * A second of tolerance on the limit, because a phone that was asked for
 * twenty-five seconds hands back 25.04 and refusing that is arguing with the
 * recording rather than with the person.
 */
function CoverVideoUpload({ value, onChange, uploader }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setErr("");

    const seconds = await videoDuration(file);
    if (Number.isFinite(seconds) && seconds > COVER_VIDEO_MAX_SECONDS + 1) {
      setErr(`That clip is ${Math.round(seconds)} seconds. Trim it to ${COVER_VIDEO_MAX_SECONDS} or under — pick the moment you would want seen first.`);
      return;
    }

    setBusy(true);
    const result = await uploader(file);
    setBusy(false);
    if (result.error) { setErr(result.error); return; }
    onChange(result.url);
  }

  return (
    <div>
      {value ? (
        <div style={{ position: "relative", width: "100%", borderRadius: 10, overflow: "hidden", background: "#000" }}>
          <video src={value} controls playsInline preload="metadata" style={{ width: "100%", display: "block", maxHeight: 260, background: "#000" }} />
          <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 6 }}>
            <button type="button" onClick={() => inputRef.current && inputRef.current.click()}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
              style={{ background: "rgba(0,0,0,0.55)", color: "#fff", border: "none", cursor: "pointer", backdropFilter: "blur(4px)" }}>
              <Upload size={11} /> Replace
            </button>
            <button type="button" onClick={() => { setErr(""); onChange(""); }}
              className="rounded-full px-3 py-1.5 text-xs font-semibold"
              style={{ background: "rgba(0,0,0,0.55)", color: "#fff", border: "none", cursor: "pointer", backdropFilter: "blur(4px)" }}>
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button type="button" disabled={busy} onClick={() => inputRef.current && inputRef.current.click()}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-5 text-sm"
          style={{ border: `1.5px dashed ${C.inkLine}`, color: C.ivoryDim, background: "transparent", cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
          <Upload size={15} /> {busy ? "Uploading…" : "Upload cover video"}
        </button>
      )}
      <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={handleFile} />
      {err
        ? <p className="text-xs mt-1.5" style={{ color: C.burgundy }}>{err}</p>
        : <p className="text-xs mt-1.5" style={{ color: C.ivoryDim, fontFamily: FONT_MONO }}>Optional — up to {COVER_VIDEO_MAX_SECONDS} seconds, shown at the top of your profile.</p>}
    </div>
  );
}

/**
 * Puts a cover video in the student-video bucket and returns its public URL.
 *
 * A random path, so one profile's video is not guessable from another's, and
 * the bucket is public so playback needs no session and no URL that expires
 * partway through a clip.
 */
async function uploadCoverVideo(file) {
  const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
  const path = `covers/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from("student-video")
    .upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) return { error: "Upload failed: " + error.message };
  return { url: supabase.storage.from("student-video").getPublicUrl(path).data.publicUrl };
}

/**
 * The teaching cell: the terms, then the pitch under them.
 *
 * Mode and price say what a lesson costs and where it happens; neither says
 * anything about the lesson. Two different questions, so two lines rather
 * than one run-on — and the pitch is quieter than the terms, because a
 * learner scanning for "€45 online" should still find it first.
 */
function TeachingCell({ teaching }) {
  const terms = teaching?.open
    ? `${teaching.mode === "online" ? "Online" : teaching.mode === "in-person" ? "In-person" : "Online & in-person"} · €${teaching.price}/session`
    : "Not offering lessons";
  return (
    <>
      <div>{terms}</div>
      {teaching?.open && teaching.pitch && (
        <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.6, color: C.ivoryDim, whiteSpace: "pre-wrap" }}>
          {teaching.pitch}
        </p>
      )}
    </>
  );
}

/**
 * The video as a profile shows it. Muted and loopable but never autoplaying:
 * a page that starts making noise on arrival is a page people close.
 */
function CoverVideo({ url }) {
  if (!url) return null;
  return (
    <div style={{ borderRadius: 10, overflow: "hidden", background: "#000" }}>
      <video src={url} controls playsInline preload="metadata"
        style={{ width: "100%", display: "block", maxHeight: 420, background: "#000" }} />
    </div>
  );
}

// Google's mark on its own. GoogleBtn draws the same paths inline; this
// pulls them out so the "signed up with Google" panel can show the provider
// without offering a button that would start the redirect again.
function GoogleMark({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={{ flexShrink: 0, display: "block" }}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

function GoogleBtn({ label = "Continue with Google", role = "student" }) {
  const [loading, setLoading] = useState(false);
  async function handleClick() {
    setLoading(true);
    sessionStorage.setItem("artium_google_role", role);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  }
  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        background: "rgba(176,146,98,0.05)", color: C.ivory, border: `1px solid ${C.inkLine}`,
        borderRadius: 6, padding: "10px 16px", fontSize: 14, fontWeight: 500,
        boxShadow: "0 1px 2px rgba(0,0,0,0.16)",
        cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
      {loading ? "Redirecting…" : label}
    </button>
  );
}

function Divider() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0" }}>
      <div style={{ flex: 1, height: 1, background: "#E6EBF1" }} />
      <span style={{ fontSize: 11, fontFamily: FONT_MONO, color: "#8898AA" }}>OR</span>
      <div style={{ flex: 1, height: 1, background: "#E6EBF1" }} />
    </div>
  );
}

function StepAccount({ draft, update, error }) {
  const mismatch = draft.confirmPassword.length > 0 && draft.password !== draft.confirmPassword;
  const isGoogle = draft.password === "__google__";
  return (
    <div>
      <p className="text-sm" style={{ color: C.ivoryDim, lineHeight: 1.6 }}>
        Use a personal email you'll always have access to — this is your login,
        so it keeps working after you graduate.
      </p>
      {/* The two routes, named here rather than sprung on them at step III.
          Which one applies is the visitor's own fact about themselves, and
          knowing it now is what stops the document route feeling like a
          rejection when they reach it. */}
      <div className="mb-6" style={{ marginTop: 14, borderRadius: 14, border: `1px solid ${C.inkLine}`, background: "rgba(176,146,98,0.05)", padding: "13px 15px" }}>
        <p style={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: 0.5, color: C.brassLabel, margin: 0 }}>
          PROVING YOU'RE A CONSERVATORY MUSICIAN
        </p>
        <p className="text-sm" style={{ color: C.ivoryDim, lineHeight: 1.55, margin: "8px 0 0" }}>
          You'll do this on a later step, whichever fits you:
        </p>
        <ul style={{ margin: "9px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 7 }}>
          {[
            ["With an institutional student email", "we send a one-time code to your @conservatory address."],
            ["Without one", "upload a student ID, enrolment certificate or tuition receipt — or, if you've graduated, your diploma."],
          ].map(([t, d]) => (
            <li key={t} className="text-sm" style={{ color: C.ivoryDim, lineHeight: 1.55, display: "flex", gap: 9 }}>
              <span aria-hidden="true" style={{ color: C.brass, flexShrink: 0, marginTop: 1 }}>·</span>
              <span><b style={{ color: C.ivory, fontWeight: 600 }}>{t}</b> — {d}</span>
            </li>
          ))}
        </ul>
      </div>
      {/* Signed up through Google, there is no password to show — and the
          draft's "__google__" is a sentinel meaning exactly that, not a
          credential. Rendering it into a password box put a string the
          visitor never typed in front of them, in the one field where a
          value you do not recognise is alarming. This step reports the
          account instead. */}
      {isGoogle ? (
        <div style={{ borderRadius: 14, border: `1px solid rgba(26,158,110,0.45)`, background: "rgba(26,158,110,0.07)", padding: "15px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <GoogleMark />
          <span style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: C.ivory }}>Signed up with Google</p>
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: C.ivoryDim, overflow: "hidden", textOverflow: "ellipsis" }}>
              {draft.email || "your Google account"}
            </p>
          </span>
          <CheckIcon size={18} color="#1A9E6E" style={{ marginLeft: "auto", flexShrink: 0 }} />
        </div>
      ) : (
      <>
      <GoogleBtn label="Sign up with Google" />
      <Divider />
      <Field label="Personal email">
        <input style={inputStyle} type="email" value={draft.email} onChange={(e) => update({ email: e.target.value })} placeholder="you@gmail.com" autoComplete="off" />
      </Field>
      <Field label="Password">
        <PasswordField value={draft.password} onChange={(e) => update({ password: e.target.value })} placeholder="At least 6 characters" autoComplete="new-password" />
      </Field>
      <Field label="Confirm password">
        <PasswordField value={draft.confirmPassword} onChange={(e) => update({ confirmPassword: e.target.value })} placeholder="Re-enter your password" autoComplete="new-password" />
      </Field>
      {mismatch && <p className="text-sm" style={{ color: C.burgundy }}>Passwords don't match.</p>}
      </>
      )}
      {error && <p className="text-sm" style={{ color: C.burgundy }}>{error}</p>}
    </div>
  );
}

function StepIntro({ draft, update }) {
  const picked = instrumentsOf(draft);
  const full = picked.length >= MAX_INSTRUMENTS;
  // The chips are a view of draft.years, not a second copy of it. Parsing on
  // every render rather than holding state means a restored draft, a profile
  // opened for editing and a fresh form all light the same chips without
  // anything having to remember to sync.
  const study = parseStudy(draft.years);
  const setStudy = (next) => update({ years: composeStudy(next) });
  return (
    <div>
      <PhotoUpload name={draft.name} photoUrl={draft.photoUrl} onChange={(photoUrl) => update({ photoUrl })} />
      <Field label="Full name">
        <input style={inputStyle} value={draft.name} onChange={(e) => update({ name: e.target.value })} placeholder="Your full name" />
      </Field>
      {/* Chips rather than a text box. The value is read back in half a dozen
          places — rosters, profiles, the lesson room — so it is stored as the
          phrase that reads correctly there ("2nd year"), not as a bare digit
          that would come out as "2 · Chopin, Ravel". */}
      <Field label="What is your current level and year of study?">
        {/* Two rows because they are two answers. Level is a free multi-select
            — a Masters and a doctorate are both things a person can be partway
            through — while the row beneath it holds the one mutually exclusive
            set: a year, or Graduated, never both.

            Graduated sits at the end of that second row rather than in a group
            of its own, because that placement is the rule. It is the last stop
            on the same line the years run along, and standing there greys the
            years out. */}
        <div className="flex flex-wrap gap-2">
          {LEVEL_OPTIONS.map((l) => (
            <Chip
              key={l}
              active={study.levels.includes(l)}
              onClick={() => setStudy({
                ...study,
                levels: study.levels.includes(l) ? study.levels.filter((x) => x !== l) : [...study.levels, l],
              })}
            >{l}</Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" style={{ marginTop: 8 }}>
          {YEAR_OPTIONS.map((y) => (
            <Chip
              key={y}
              active={study.year === y}
              disabled={study.graduated}
              onClick={() => setStudy({ ...study, year: study.year === y ? "" : y })}
            >{y}</Chip>
          ))}
          <Chip
            active={study.graduated}
            onClick={() => setStudy({ ...study, graduated: !study.graduated, year: "" })}
          >{GRADUATED}</Chip>
        </div>
      </Field>
      {/* Thirty-six instruments read as a wall of words; the drawings are what
          the eye finds first, so a cellist stops scanning at the cello. Tiles
          rather than chips for the same reason — a chip is sized for a word.

          The icons are line art on transparent ground, so an unselected tile
          shows them at three-quarter strength and the chosen one at full, and
          nothing needs a second colour. */}
      {/* Two allowed, and the second is opt-in rather than asked for: the label
          stays a single question and the hint underneath is what changes as
          they choose. Nobody is prompted to find a second instrument they do
          not have.

          At two, the remaining tiles are disabled rather than silently inert —
          a tile that looks pressable and does nothing reads as a bug — and the
          hint says which two are chosen, so the way out is deselecting one of
          them and not hunting for a cleared state. */}
      <Field label="Which instrument do you play?">
        <div className="artium-inst-grid">
          {INSTRUMENTS.map(({ name, icon }) => {
            const on = picked.includes(name);
            const blocked = !on && full;
            return (
              <button
                key={name}
                type="button"
                disabled={blocked}
                onClick={() => update({ instruments: on ? picked.filter((n) => n !== name) : [...picked, name] })}
                className={`artium-inst${on ? " artium-inst--on" : ""}`}
                aria-pressed={on}
              >
                <img src={`/instruments/${icon}.webp`} alt="" loading="lazy" />
                <span>{name}</span>
              </button>
            );
          })}
        </div>
        <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.ivoryDim, margin: "10px 0 0" }}>
          {full
            ? `${picked.join(" and ")} — deselect one to change it.`
            : picked.length === 1
              ? "Add a second if you play one, or carry on."
              : "You can pick a second one too."}
        </p>
      </Field>
      <div className="mt-2">
        {/* Four fields, not one. The old single field asked for a performance
            video and took only Instagram, Facebook or YouTube — so a student
            with an Instagram account and a YouTube channel had to choose one,
            and a website had nowhere to go at all.

            Each is checked against its own host as it is typed, because a
            YouTube URL in the Instagram row is a link that quietly sends
            visitors somewhere they did not ask to go. All four optional: this
            is where to find them, and some are found in one place. */}
        <Field label="Where can people find you?">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {LINK_FIELDS.map((f) => {
              const value = (draft.links || {})[f.key] || "";
              const ok = linkFieldValid(f, value);
              return (
                <div key={f.key}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span title={f.label} style={{ color: ok ? C.ivoryDim : C.burgundy, display: "flex", flexShrink: 0, width: 18, justifyContent: "center" }}>
                      <f.Icon size={16} strokeWidth={1.9} />
                    </span>
                    <input
                      style={{ ...inputStyle, borderColor: ok ? undefined : C.burgundy }}
                      value={value}
                      onChange={(e) => update({ links: { ...(draft.links || {}), [f.key]: e.target.value } })}
                      placeholder={f.placeholder}
                      inputMode="url"
                      aria-label={f.label}
                    />
                  </div>
                  {!ok && (
                    <p style={{ margin: "4px 0 0 28px", fontFamily: FONT_BODY, fontSize: 12, color: C.burgundy }}>
                      {f.key === "website"
                        ? "That doesn't look like a web address."
                        : `That isn't a ${f.label} link.`}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </Field>
        <p className="-mt-4" style={{ fontFamily: FONT_BODY, fontSize: 12, fontWeight: 500, color: "#7C7C7C" }}>
          All optional — add the ones you use.
        </p>
      </div>
    </div>
  );
}

/**
 * Turn a conservatory's name + address into coordinates so it can be placed
 * on the globe. Nominatim (OpenStreetMap) needs no key and is well inside its
 * usage policy here — this runs once per approval, by hand, not per pageview.
 *
 * Returns null rather than throwing: geocoding failing must never block an
 * approval. The pin simply waits for coordinates.
 */
async function geocodeConservatory(name, address) {
  const attempts = [[name, address].filter(Boolean).join(", "), address, name].filter(Boolean);
  for (const q of attempts) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
        { headers: { Accept: "application/json" } },
      );
      if (!res.ok) continue;
      const hits = await res.json();
      const hit = hits?.[0];
      if (!hit) continue;
      const lat = parseFloat(hit.lat);
      const lng = parseFloat(hit.lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng, query: q };
    } catch {
      // Network or CORS failure — fall through to the next, less specific query.
    }
  }
  return null;
}

// Schools the bundle has never heard of: the roster table, and rows approved
// from a request. Kept here so a lookup by id finds them wherever a student's
// school is drawn.
//
// Every one of these sites used CONSERVATORIES.find directly, so a student at
// a database-only school rendered as the fallback word "Conservatory" — on
// their own profile, on their card in a roster, in the lesson room. It was
// already true of every approved school before the roster moved into Postgres;
// moving it made it true of more of them.
//
// A module-level array rather than a context because two of the callers are
// plain functions, not components, and a hook cannot reach them. App refreshes
// it in the same tick as the state that re-renders everything below.
let EXTRA_CONS = [];
function setExtraCons(list) { EXTRA_CONS = list || []; }
function findConservatory(id) {
  if (!id) return undefined;
  return CONSERVATORIES.find((c) => c.id === id) || EXTRA_CONS.find((c) => c.id === id);
}

/** An approved_conservatories row, shaped like a built-in CONSERVATORIES entry. */
function asConservatory(row) {
  const [city = "", country = ""] = (row.address || "").split(",").map((s) => s.trim());
  return {
    id: row.id,
    name: row.name,
    short: row.name,
    city,
    country,
    lat: row.lat,
    lng: row.lng,
    domains: [],          // no institutional domain — that's why it came via a document
    fromDocument: true,
  };
}

// Proving a conservatory address, without registering it as an account.
//
// This used to be supabase.auth.signInWithOtp — Supabase's own one-time code,
// borrowed. It carries shouldCreateUser, so checking an address created an
// Artium account under it, and anyone who then signed up with that address was
// turned away as a repeat. It also signed the visitor in as the conservatory
// address for a moment before signing them back out, mid-signup.
//
// Ours does neither. The code is a row with an expiry, checked server-side,
// and the answer is a yes or a no.
//
// Both are called before the visitor has a session, so both edge functions are
// deployed with --no-verify-jwt and reached with the anon key alone.
// conservatoryId is which school the applicant picked, and the server refuses
// to send a code to an address that does not belong to it. Omitted on the
// domain-request route, where the school is not on any list yet.
async function sendConservatoryCode(email, conservatoryId) {
  const { data, error } = await supabase.functions.invoke("send-conservatory-code", {
    body: { email: String(email).trim().toLowerCase(), conservatory_id: conservatoryId || null },
  });
  // invoke() reports a non-2xx as a generic FunctionsHttpError, and the useful
  // sentence — the rate limit, the free-mail refusal — is in the body it
  // carries. Read that first and fall back only if there is nothing there.
  if (error) {
    const detail = await error.context?.json?.().catch(() => null);
    return { error: detail?.error || "Could not send the code. Please try again." };
  }
  if (data?.error) return { error: data.error };
  return {};
}

async function verifyConservatoryCode(email, code) {
  const { data, error } = await supabase.functions.invoke("verify-conservatory-code", {
    body: { email: String(email).trim().toLowerCase(), code: String(code).trim() },
  });
  if (error) {
    const detail = await error.context?.json?.().catch(() => null);
    return { error: detail?.error || "That code didn't match. Please check and try again." };
  }
  if (data?.error) return { error: data.error };
  return {};
}

// Two names for the same school, as typed by two different people.
//
// Used to decide whether an approved row is a school we already know. Accents
// and case are the whole point: an admin approving "Ecole Normale" for a
// built-in "École Normale" would otherwise create a second entry, and the
// student would be shown both with no way to tell which one accepts them.
// NFD splits a letter from its accent so the accent can be dropped.
function normalizeName(s) {
  return String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();
}

function emailMatchesConservatory(email, cons) {
  if (!cons) return false;
  const m = String(email).trim().toLowerCase().match(/@(.+)$/);
  if (!m) return false;
  const host = m[1];
  return cons.domains.some((d) => host === d.toLowerCase() || host.endsWith("." + d.toLowerCase()));
}

// The addresses people reach for when a form asks for an email, none of which
// belong to an institution.
const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "hotmail.com",
  "hotmail.fr", "outlook.com", "outlook.fr", "live.com", "icloud.com",
  "me.com", "aol.com", "proton.me", "protonmail.com", "gmx.com", "gmx.de",
  "mail.com", "yandex.com", "qq.com", "163.com", "orange.fr", "free.fr",
  "wanadoo.fr", "web.de", "t-online.de",
]);

// A personal-mail domain on a school's entry turns every account at that
// provider into a verified student there — the check does exactly what it is
// told, and what it was told was wrong. One of these shipped: the Juilliard
// row carried "gmail.com" behind a comment reading TEMP, remove. It survived
// the comment, a code review and a deploy, and it made every gmail address a
// Juilliard student and every Google sign-in proof of studying there.
//
// The roster is a hundred-odd hand-written lines and the next one will be just
// as invisible, so it is checked rather than watched for.
if (import.meta.env.DEV) {
  for (const c of CONSERVATORIES) {
    const personal = (c.domains || []).filter((d) => FREE_MAIL.has(String(d).toLowerCase()));
    if (personal.length) {
      console.error(
        `[artium] ${c.name} lists a personal-mail domain (${personal.join(", ")}). ` +
        `Anyone with an address there would verify as a student of it. Remove it from CONSERVATORIES.`,
      );
    }
  }
}

const DOOR_LABEL = {
  student_email: "Student, with a conservatory email",
  student_doc: "Student, without a conservatory email",
  graduate: "Graduate",
};

function StepConservatory({ draft, update, editing }) {
  const [q, setQ] = useState("");
  const [email, setEmail] = useState(draft.otpEmail || draft.conservatoryEmail || "");
  const [codeSent, setCodeSent] = useState(!!draft.otpSent);
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [err, setErr] = useState("");

  const [uploading, setUploading] = useState(false);

  // Transferring is re-applying, not editing a field. The whole verification
  // step reopens — doors, list, code — and the school only moves once the new
  // one is proved. Abandoning halfway leaves the member exactly as they were,
  // which is why the old answers are kept rather than cleared.
  // Both halves of a transfer now live in the draft. They used to disagree:
  // transferPending persisted and priorSchool did not, so stepping Back and
  // forward again left the flag set with nothing backing it — Next stayed
  // blocked, the code panel vanished because `proving` went false, and Change
  // did nothing because `applicant` fell back to the edit-mode default the
  // moment chooseDoor cleared it. Three dead ends from one lost variable.
  const priorSchool = draft.priorSchool || null;
  const changingSchool = priorSchool !== null;

  function startTransfer() {
    setQ(""); setEmail(""); setCode(""); setCodeSent(false); setErr("");
    // transferPending holds the Next button until the new school is proved.
    // Without it an unfinished transfer could be saved, and the database would
    // then unapprove them for a school they never confirmed.
    update({
      priorSchool: {
        applicant: draft.applicant, verifyMethod: draft.verifyMethod,
        conservatoryId: draft.conservatoryId, conservatoryEmail: draft.conservatoryEmail,
        conservatoryVerified: draft.conservatoryVerified, domainReq: draft.domainReq,
        proofDocUrl: draft.proofDocUrl, proofDocName: draft.proofDocName,
      },
      applicant: "", verifyMethod: "otp", conservatoryId: "", conservatoryEmail: "",
      conservatoryVerified: false, domainReq: null, proofDocUrl: "", proofDocName: "",
      otpEmail: "", otpSent: false,
      transferPending: true,
    });
  }

  function cancelTransfer() {
    update({ ...priorSchool, priorSchool: null, transferPending: false, otpEmail: "", otpSent: false });
    setQ(""); setEmail(priorSchool.conservatoryEmail || ""); setCode(""); setCodeSent(false); setErr("");
  }

  const isGoogle = draft.password === "__google__";
  const isDoc = draft.verifyMethod === "document";

  // Whether this step is actually asking for proof.
  //
  // Every panel below was written as `!editing`, because an existing member
  // re-treading signup had already proved their school and being asked again
  // would be noise. A transfer breaks that: they pick the new school and then
  // nothing appears — no code panel, no upload, no way to prove anything —
  // because the screen still believes proof is behind them.
  const proving = !editing || changingSchool;
  // Mid-transfer the doors have to be askable again — someone who has since
  // graduated is not on the route they arrived by — so the edit-mode default
  // steps aside until a door is chosen.
  const applicant = draft.applicant || (editing && !changingSchool ? (isDoc ? "student_doc" : "student_email") : "");

  // The document route gets its own roster. The built-in CONSERVATORIES list
  // exists because each entry has an email domain we can send a code to —
  // which proves nothing on a route where there is no institutional email.
  // Here the list is only what an admin has already vouched for, so it starts
  // empty and the document itself establishes the school.
  // One pin, moving. A school every three seconds beats 110 at once: the
  // point of the globe here is reach, not a map you are meant to read.
  const [showReq, setShowReq] = useState(false);
  const [reqName, setReqName] = useState("");
  const [reqAddress, setReqAddress] = useState("");
  const [reqEmail, setReqEmail] = useState("");
  const reqDomain = (String(reqEmail).trim().toLowerCase().match(/@([^@\s]+\.[^@\s]+)$/) || [])[1] || "";
  // A gmail address proves nothing about a conservatory, and it is the most
  // likely thing to be typed here by mistake.
  const reqFreeMail = FREE_MAIL.has(reqDomain);
  const reqReady = reqName.trim().length > 1 && reqAddress.trim().length > 1 && !!reqDomain && !reqFreeMail;

  // A request used to be granted on an address the student merely typed, and
  // approving it set conservatory_verified on their profile — so a human
  // confirming a school also, silently, certified a person nobody had
  // checked. Anyone could name a real conservatory, claim any address at it
  // and be let in as a verified student of it.
  //
  // The two checks are different questions and both have to be asked. The
  // code proves the address is theirs; the admin proves the address belongs
  // to a conservatory. Neither alone is enough, and only the first can be
  // done by machine — so it happens here, before the request is worth
  // sending. The same one-time code as the main route, and the same
  // throwaway session, discarded the moment it has served.
  const [reqCode, setReqCode] = useState("");
  const [reqCodeSent, setReqCodeSent] = useState(false);
  const [reqSending, setReqSending] = useState(false);
  const [reqVerifying, setReqVerifying] = useState(false);
  const [reqVerified, setReqVerified] = useState(false);
  const [reqErr, setReqErr] = useState("");

  // Editing the address after a code has gone out invalidates everything that
  // followed from it — otherwise you could verify one address and send
  // another.
  function editReqEmail(v) {
    setReqEmail(v);
    setReqCodeSent(false); setReqCode(""); setReqVerified(false); setReqErr("");
  }

  async function sendReqCode() {
    setReqErr(""); setReqSending(true);
    const { error } = await sendConservatoryCode(reqEmail);
    setReqSending(false);
    if (error) { setReqErr(error); return; }
    setReqCodeSent(true);
  }

  async function verifyReqCode() {
    setReqErr(""); setReqVerifying(true);
    const { error } = await verifyConservatoryCode(reqEmail, reqCode);
    setReqVerifying(false);
    if (error) { setReqErr(error); return; }
    setReqVerified(true);
  }

  const [roamAt, setRoamAt] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setRoamAt((n) => n + 1), 3000);
    return () => clearInterval(t);
  }, []);

  // Loaded on both doors now, not just the document one. An approved school
  // is a school: once an admin has confirmed it, it belongs on whichever
  // route can actually check it.
  const [approvedCons, setApprovedCons] = useState([]);
  React.useEffect(() => {
    let live = true;
    supabase.from("approved_conservatories").select("id, name, address, domains, lat, lng").order("name")
      .then(({ data }) => { if (live) setApprovedCons(data || []); });
    return () => { live = false; };
  }, []);

  // The roster, from the database rather than the copy compiled into this
  // bundle.
  //
  // The server refuses to send a code to an address that does not belong to
  // the chosen school, and it reads the table to decide. If this screen kept
  // deciding from the bundled array the two would drift the moment a domain
  // was corrected — the correction would take effect server-side while the
  // browser went on greying out the button for an address the server would
  // have accepted, and the student would be stuck with no way to tell why.
  //
  // The bundled array stays as the fallback. It is what the app has always
  // used, so an unreachable table costs the newest domain corrections rather
  // than the whole signup.
  const [dbRoster, setDbRoster] = useState(null);
  React.useEffect(() => {
    let live = true;
    supabase.from("conservatory_roster").select("id, name, short, city, country, lat, lng, domains").order("name")
      .then(({ data, error }) => {
        if (!live) return;
        if (error || !data || data.length === 0) { setDbRoster(null); return; }
        setDbRoster(data.map((c) => ({ ...c, domains: Array.isArray(c.domains) ? c.domains : [] })));
      });
    return () => { live = false; };
  }, []);
  const roster = dbRoster || CONSERVATORIES;

  // Approved rows in the shape of a built-in entry, so every reader
  // downstream — emailMatchesConservatory, the placeholder, the roster row —
  // keeps working without learning about a second kind of conservatory.
  // A built-in wins on id collision; nothing else can collide.
  // The built-in list is the base; approved rows are patches on top of it, not
  // a second list stapled to the end.
  //
  // Concatenating them duplicated any school that already existed. A student
  // whose conservatory changed its email domain sends the new one, an admin
  // approves it, and a row appears named "Curtis Institute of Music" — while
  // Curtis is a built-in, living in a JavaScript array the database has never
  // heard of. Nothing could catch it: the approve function merges on conflict
  // (name), which only sees other approved rows, and the filter below skipped
  // rows by *id*, so a UUID never matched the string "curtis".
  //
  // The student then saw Curtis twice, and the one listed first was the old
  // entry that rejects their address — the exact problem the request form is
  // there to solve, appearing not to have worked.
  //
  // So a matching row folds its domains into the school instead of adding
  // another. Both addresses verify, which is also what a school running two
  // domains through a migration needs.
  const { approvedShaped, conservatories } = React.useMemo(() => {
    // Plain objects rather than Map: this file imports lucide's Map icon at
    // the top, which shadows the global, so `new Map()` constructs an icon and
    // the screen dies with "Map is not a constructor".
    const byId = new Set(roster.map((c) => c.id));
    const byName = Object.create(null);
    for (const c of roster) byName[normalizeName(c.name)] = c.id;
    const extraDomains = Object.create(null);   // built-in id -> domains from approved rows
    const shaped = [];

    for (const row of approvedCons || []) {
      if (byId.has(row.id)) continue;
      const domains = (Array.isArray(row.domains) ? row.domains : []).map((d) => String(d).toLowerCase());
      const builtInId = byName[normalizeName(row.name)];
      if (builtInId) {
        // Only the domains are taken. Name, city and coordinates on the
        // built-in are curated; a request form's free text is not an
        // improvement on them.
        extraDomains[builtInId] = [...(extraDomains[builtInId] || []), ...domains];
        continue;
      }
      shaped.push({
        id: row.id, name: row.name, short: row.name, domains,
        city: row.address || "", country: "", address: row.address || "",
        lat: row.lat, lng: row.lng, approved: true,
      });
    }

    const touched = Object.keys(extraDomains);
    // An approved row exists because someone told us the roster is out of
    // date, so where one carries domains it replaces the roster's rather than
    // adding to them — matching conservatory_domains() in the database. The
    // two must agree: this decides whether the button is enabled, that decides
    // whether the code is sent, and a disagreement is a student staring at a
    // live button that fails.
    const merged = touched.length === 0 ? roster : roster.map((c) => {
      const extra = extraDomains[c.id];
      if (!extra || extra.length === 0) return c;
      return { ...c, domains: [...new Set(extra.map((d) => d.toLowerCase()))] };
    });

    return { approvedShaped: shaped, conservatories: merged };
  }, [approvedCons, roster]);

  // Three doors, three rosters, and the line between them is the domain.
  //
  // A school arrives one of two ways, and how it arrived is what it can
  // prove. Approved from a request — name, address, student email — it has a
  // domain, so we can check an address against it. Approved from someone's
  // scanned certificate, it has none, and listing it on the email route would
  // let a student pick it and "verify" with any address at all.
  //
  // So the school follows its domain: with one it joins the email list, and
  // it must NOT also sit on the without-an-email list, where it would offer a
  // route we can check as though we could not. Graduates are the exception —
  // they prove themselves with a diploma either way, so the domain decides
  // nothing and they see every school we know of.
  const withDomain = (c) => c.domains.length > 0;
  const emailPool = React.useMemo(
    () => [...conservatories, ...approvedShaped.filter(withDomain)],
    [approvedShaped, conservatories],
  );
  const docPool = React.useMemo(
    () => approvedShaped.filter((c) => !withDomain(c)),
    [approvedShaped],
  );
  const gradPool = React.useMemo(
    () => [...conservatories, ...approvedShaped],
    [approvedShaped, conservatories],
  );

  const pool = !isDoc ? emailPool : applicant === "graduate" ? gradPool : docPool;

  // The globe roams whatever the open door can offer, so a school approved
  // yesterday has a pin today. The without-an-email list is the one that can
  // legitimately be empty — nobody has been approved from a document yet —
  // and a globe with nothing on it reads as broken rather than as new, so it
  // falls back to roaming everything.
  const roamable = React.useMemo(() => {
    const src = pool.length ? pool : gradPool;
    return src.filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng));
  }, [pool, gradPool]);
  const roamPin = roamable.length ? roamable[roamAt % roamable.length] : null;

  const selectedCons = pool.find((c) => c.id === draft.conservatoryId);
  // One search string for every door: the graduate list mixes built-ins, which
  // carry city and country, with approved rows, which carry a single address.
  const results = pool.filter((c) => `${c.name} ${c.city || ""} ${c.country || ""} ${c.address || ""}`
    .toLowerCase().includes(q.toLowerCase()));
  const domainOk = selectedCons && emailMatchesConservatory(email, selectedCons);
  const verified = draft.conservatoryVerified;

  // Signing in with Google proves one address: the Google account's own. It
  // was being read as proof of whichever school you then picked, so a gmail
  // account plus a tap on Juilliard produced "Verified via Google" and a
  // verified Juilliard student. The account is real; the claim about the
  // school was never checked.
  //
  // It is still proof when the address belongs to the school — a conservatory
  // on Google Workspace is exactly the case worth keeping, and asking that
  // student for a code sent to the address they just signed in with would be
  // theatre. So the shortcut survives, but only against the same test any
  // typed address has to pass.
  const googleProvesSchool = isGoogle && emailMatchesConservatory(draft.email, selectedCons);

  // Whatever proved it, one flag records it, so nothing downstream has to know
  // which route was taken or remember to make an exception for this one.
  useEffect(() => {
    if (googleProvesSchool && !draft.conservatoryVerified) {
      update({ conservatoryEmail: draft.email, conservatoryVerified: true, transferPending: false, priorSchool: null });
    }
  }, [googleProvesSchool, draft.conservatoryVerified, draft.email]);

  function pickConservatory(id) {
    update({ conservatoryId: id, conservatoryVerified: false });
    setCodeSent(false); setCode(""); setErr("");
  }

  // Clearing the conservatory is not tidiness, it is required: the two routes
  // read from different rosters — the built-in list, where every school has a
  // known email domain, and the admin-approved list — so an id carried across
  // would point at a school the other roster has never heard of. The proof and
  // the verified email go too, since neither means anything on the far side.
  // One entry point for all three doors. Clearing the conservatory is not
  // tidiness: the routes read from different rosters — the built-in list,
  // where every school has a known email domain, and the admin-approved one —
  // so an id carried across would point at a school the other has never heard
  // of. The proof and the verified address go too, since neither means
  // anything on the far side.
  function chooseDoor(kind) {
    setQ(""); setEmail(""); setCode(""); setCodeSent(false); setErr("");
    update({
      applicant: kind,
      verifyMethod: kind === "student_email" ? "otp" : "document",
      conservatoryId: "", conservatoryVerified: false, conservatoryEmail: "",
      proofDocUrl: "", proofDocName: "",
      otpEmail: "", otpSent: false,
    });
  }

  function switchMethod(method) {
    setQ(""); setEmail(""); setCode(""); setCodeSent(false); setErr("");
    update(method === "document"
      ? { verifyMethod: "document", conservatoryId: "", conservatoryVerified: false, conservatoryEmail: "", otpEmail: "", otpSent: false }
      : { verifyMethod: "otp", conservatoryId: "", conservatoryVerified: false, proofDocUrl: "", proofDocName: "", otpEmail: "", otpSent: false });
  }

  async function uploadProof(file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setErr("File too large (max 10 MB)."); return; }
    setErr(""); setUploading(true);
    const ext = (file.name.split(".").pop() || "dat").toLowerCase();
    const path = `proofs/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("student-proofs").upload(path, file, { upsert: false, contentType: file.type || undefined });
    setUploading(false);
    if (error) { setErr("Upload failed: " + error.message); return; }
    // A document is the applicant's part done, even though approval waits on
    // a human — so the step is finished and Next opens.
    update({ proofDocUrl: path, proofDocName: file.name, transferPending: false, priorSchool: null });
  }

  async function sendCode() {
    setErr(""); setSending(true);
    const { error } = await sendConservatoryCode(email, draft.conservatoryId);
    setSending(false);
    if (error) { setErr(error); return; }
    setCodeSent(true);
    update({ otpEmail: email.trim(), otpSent: true });
  }

  async function verifyCode() {
    setErr(""); setVerifying(true);
    const { error } = await verifyConservatoryCode(email, code);
    setVerifying(false);
    if (error) { setErr(error); return; }
    update({ conservatoryEmail: email.trim(), conservatoryVerified: true, transferPending: false, priorSchool: null, otpEmail: "", otpSent: false });
  }

  return (
    <div>
      {/* The network page's globe, not the flat map this used to carry — the
          two screens show the same world and should look like it. Pins are
          only the schools that can actually be placed; the rest would land at
          0,0 in the Gulf of Guinea. */}
      <div className="artium-su-globe">
        <span className="artium-aw-glow" aria-hidden="true" />
        <span className="artium-aw-ring artium-aw-ring--a" aria-hidden="true" />
        <WorldGlobe pins={roamPin ? [roamPin] : []} selectedId={null} onSelect={() => {}} height={230} roaming />
      </div>

      {/* Editing a profile is not re-applying to a conservatory.

          The step used to offer the whole list here, so a member could change
          school from the edit screen. Since approval moved into the database
          that no longer grants anything — the trigger sees conservatory_id
          change, finds no code verified for the new school, and drops them to
          unapproved — but it would drop them silently, off the map and into
          the review queue, for what looked like editing a field.

          Nobody transfers conservatory often enough to want a self-service
          button that costs them their verification. It is a conversation, and
          the admin screen is where it happens. */}
      {changingSchool && (
        <div className="mt-2 mb-3 rounded-2xl" style={{ border: `1px solid ${C.brass}`, background: C.inkSoft, padding: "14px 16px" }}>
          <p className="text-sm" style={{ margin: 0, color: C.ivory, fontWeight: 600 }}>
            Moving from {priorSchool.conservatoryId ? (pool.find((c) => c.id === priorSchool.conservatoryId)?.name || "your conservatory") : "your conservatory"}
          </p>
          <p className="text-sm" style={{ margin: "5px 0 0", color: C.ivoryDim, lineHeight: 1.55 }}>
            Nothing changes until you've proved the new school. If you upload a
            document instead of verifying by code, you'll be off the map until we
            confirm it.
          </p>
          {/* Next is held shut until the new school is proved, and a greyed
              button with no reason beside it reads as a broken screen rather
              than a rule. Say which. */}
          <p className="text-sm" style={{ margin: "8px 0 0", color: C.brassLabel, fontWeight: 600, lineHeight: 1.55 }}>
            {draft.conservatoryVerified || draft.proofDocUrl || draft.domainReq
              ? "Proved — you can continue."
              : !draft.conservatoryId
                ? "Pick the new school below to continue."
                : codeSent
                  ? "Enter the code we emailed you to continue."
                  : "Verify the new school below to continue."}
          </p>
          <button
            onClick={cancelTransfer}
            style={{ marginTop: 9, padding: 0, background: "none", border: "none", cursor: "pointer", color: C.brassLabel, fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700 }}
          >
            Keep my current conservatory
          </button>
        </div>
      )}

      {editing && selectedCons && !changingSchool ? (
        <div className="mt-2 rounded-2xl" style={{ border: `1px solid ${C.inkLine}`, background: "rgba(176,146,98,0.05)", padding: "16px 18px" }}>
          {/* The tick rides with the label rather than the name: beside a
              school called "The Juilliard School" it was taking the width the
              name needed and pushing it onto a third line. */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.brassLabel, letterSpacing: 0.5, margin: 0 }}>YOUR CONSERVATORY</p>
            {verified ? <CheckIcon size={15} strokeWidth={2.6} color="#1A9E6E" /> : null}
          </div>
          {/* The school name and a long institutional address do not fit
              beside a monogram at phone width — "The Juilliard School" broke
              over three lines and the email ran past the card. The monogram
              keeps the top row with the tick; everything textual gets the
              full width underneath. */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <ConsAvatar cons={selectedCons} />
            <p style={{ flex: 1, minWidth: 0, margin: 0, fontFamily: FONT_DISPLAY, fontSize: 17, fontWeight: 600, color: C.ivory, lineHeight: 1.25 }}>
              {selectedCons.name}
            </p>
          </div>
          <p className="text-sm" style={{ margin: 0, color: C.ivoryDim, lineHeight: 1.5, overflowWrap: "anywhere" }}>
            <span aria-hidden="true" style={{ fontSize: 11, marginRight: 4 }}>{"\uD83D\uDCCD"}</span>
            {[selectedCons.city, selectedCons.country].filter(Boolean).join(", ") || selectedCons.address || ""}
          </p>
          {draft.conservatoryEmail && (
            <p className="text-sm" style={{ margin: "3px 0 0", color: C.ivoryDim, overflowWrap: "anywhere" }}>
              {draft.conservatoryEmail}
            </p>
          )}
          <p className="text-sm" style={{ margin: "12px 0 0", color: C.ivoryDim, lineHeight: 1.55 }}>
            This is the school you verified. Changing it means proving the new one,
            the same way you proved this one.
          </p>
          <button
            onClick={startTransfer}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, padding: 0, background: "none", border: "none", cursor: "pointer", color: C.brassLabel, fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700 }}
          >
            I've transferred to another conservatory <ArrowRight size={14} />
          </button>
        </div>
      ) : !applicant ? (
        <div className="artium-su-doors">
          {[
            { k: "student_email", Icon: ScanLine, t: "I'm a student with a conservatory email",
              d: "Fastest — we send a one-time code to your institutional address." },
            { k: "student_doc", Icon: FileText, t: "I'm a student without one",
              d: "Upload a student ID, enrolment certificate or tuition receipt." },
            { k: "graduate", Icon: GraduationCap, t: "I've graduated",
              d: "Upload your diploma, or a transcript naming your conservatory." },
          ].map(({ k, Icon, t, d }) => (
            <button key={k} className="artium-su-door" onClick={() => chooseDoor(k)}>
              <span className="artium-su-door-i"><Icon size={18} strokeWidth={1.8} /></span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <p className="artium-su-door-t">{t}</p>
                <p className="artium-su-door-d">{d}</p>
              </span>
              <ChevronRight size={17} strokeWidth={2} style={{ color: "#6E6E6E", flexShrink: 0 }} />
            </button>
          ))}
        </div>
      ) : (
      <>
      <div className="artium-su-chosen">
        <CheckIcon size={16} strokeWidth={2.4} color="#EFD09B" style={{ flexShrink: 0 }} />
        <p>{DOOR_LABEL[applicant]}</p>
        <button className="artium-su-change" onClick={() => chooseDoor("")}>Change</button>
      </div>

      <span className="artium-aw-field" style={{ marginBottom: 12 }}>
        <Search size={15} strokeWidth={2} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by school, city, or country" />
      </span>

      {results.length === 0 ? (
        <p className="artium-aw-empty">
          {applicant === "student_doc" ? "No approved conservatory matches that search." : "No conservatory matches that search."}
        </p>
      ) : (
        <div className="artium-aw-list" style={{ maxHeight: 268, overflowY: "auto" }}>
          {results.map((c) => {
            const on = draft.conservatoryId === c.id;
            return (
              <button key={c.id} className="artium-aw-row" onClick={() => pickConservatory(c.id)}
                style={on ? { borderColor: "rgba(239,208,155,0.55)", background: "rgba(239,208,155,0.07)" } : undefined}>
                <ConsAvatar cons={c} />
                <span className="artium-aw-row-body">
                  <p className="artium-aw-row-t">{c.name}</p>
                  <p className="artium-aw-row-c">
                    <span aria-hidden="true" style={{ fontSize: 11, lineHeight: 1 }}>{"\uD83D\uDCCD"}</span>
                    {/* Keyed on the row, not the door: the graduate list holds
                        both kinds, and a school approved from a document has
                        no domain to show. */}
                    {[
                      [c.city, c.country].filter(Boolean).join(", ") || c.address || "Approved conservatory",
                      c.domains.length ? "@" + c.domains[0] : "",
                    ].filter(Boolean).join(" · ")}
                  </p>
                </span>
                {on
                  ? <CheckIcon size={17} strokeWidth={2.4} color="#EFD09B" />
                  : <ChevronRight size={17} strokeWidth={2} />}
              </button>
            );
          })}
        </div>
      )}

      {/* Not finding your school is not a failure state, and the old copy only
          said so once the list came back empty — which never happens on the
          email route, where 110 schools are listed and yours simply is not
          one of them. Said plainly, always. */}
      <div style={{ marginTop: 14, borderRadius: 14, border: `1px solid ${C.inkLine}`, background: "rgba(176,146,98,0.05)", padding: "13px 15px" }}>
        <p className="text-sm" style={{ margin: 0, color: C.ivory, fontWeight: 600, fontSize: 13 }}>
          {isDoc ? "Can't find your conservatory?" : "Can't find your conservatory, or having trouble with your email?"}
        </p>
        <p className="text-sm" style={{ margin: "5px 0 0", color: C.ivoryDim, lineHeight: 1.55 }}>
          {isDoc
            ? "You don't have to pick one. The list only holds schools we've already confirmed — upload your document below and we'll add yours from it, and it appears on the map once approved."
            : "Send us the name of your conservatory and the student email it gave you, and we'll approve it by hand. Schools change their email domain and this list can fall behind — no document needed."}
        </p>
        {!isDoc && !showReq && !draft.domainReq && (
          <button
            onClick={() => setShowReq(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 9, padding: 0, background: "none", border: "none", cursor: "pointer", color: C.brassLabel, fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700 }}
          >
            Send your conservatory and email <ArrowRight size={14} />
          </button>
        )}
      </div>

      {/* Sent, waiting on an admin. Kept in the draft rather than written
          straight to the table: nothing about this student exists in the
          database until the last step, and a request with no account behind
          it is a row nobody can approve anyone from. */}
      {!isDoc && draft.domainReq && (
        <div className="mt-4" style={{ borderRadius: 16, border: "1px solid rgba(26,158,110,0.45)", background: "rgba(26,158,110,0.07)", padding: "15px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <CheckIcon size={17} strokeWidth={2.4} color="#1A9E6E" style={{ flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: C.ivory }}>We'll check this with you</p>
            <button className="artium-su-change" onClick={() => { update({ domainReq: null }); setShowReq(true); }}>Edit</button>
          </div>
          <p className="text-sm" style={{ margin: "8px 0 0", color: C.ivoryDim, lineHeight: 1.55 }}>
            <b style={{ color: C.ivory, fontWeight: 600 }}>{draft.domainReq.name}</b>
            {draft.domainReq.address ? <> — {draft.domainReq.address}</> : null}
            <br />{draft.domainReq.email}
          </p>
          <p className="text-sm" style={{ margin: "8px 0 0", color: C.ivoryDim, lineHeight: 1.55 }}>
            Finish signing up and we'll review it. Once approved, your conservatory
            joins the list and the map, and your account is approved with it.
          </p>
        </div>
      )}

      {/* The request. Name, address, and the address they already hold — the
          three things an admin needs to add a school to the roster. */}
      {!isDoc && showReq && !draft.domainReq && (
        <div className="mt-4" style={{ borderRadius: 16, border: `1px solid ${C.brass}`, background: C.inkSoft, padding: "16px 16px" }}>
          <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.brassLabel, letterSpacing: 0.5, marginBottom: 8 }}>ASK US TO ADD YOUR CONSERVATORY</p>
          <p className="text-sm" style={{ color: C.ivoryDim, marginBottom: 14, lineHeight: 1.55 }}>
            Tell us the school and the student address you hold there. We'll send that
            address a code to confirm it's yours, then check the school by hand — no
            document needed.
          </p>
          <Field label="Conservatory name">
            <input style={inputStyle} value={reqName} onChange={(e) => setReqName(e.target.value)} placeholder="e.g. Royal Danish Academy of Music" />
          </Field>
          <Field label="Address or city">
            <input style={inputStyle} value={reqAddress} onChange={(e) => setReqAddress(e.target.value)} placeholder="e.g. Rosenørns Allé 22, Copenhagen" />
          </Field>
          <Field label="Your student email at that conservatory">
            <input style={inputStyle} type="email" value={reqEmail} onChange={(e) => editReqEmail(e.target.value)} placeholder="you@school.edu" autoComplete="off" disabled={reqVerified} />
          </Field>
          {reqEmail && !reqDomain && (
            <p className="text-sm" style={{ color: C.burgundy, margin: "-8px 0 12px" }}>That doesn't look like an email address.</p>
          )}
          {reqDomain && reqFreeMail && (
            <p className="text-sm" style={{ color: C.burgundy, margin: "-8px 0 12px" }}>
              That's a personal address. We need the one your conservatory gave you.
            </p>
          )}
          {/* Three phases, one at a time: prove the address, then send it.
              The request is only worth a human's attention once we know the
              person actually holds the address they are claiming. */}
          {!reqCodeSent && !reqVerified && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                className="artium-su-next-btn"
                style={{ flex: "0 0 auto", fontSize: 14, padding: "11px 20px" }}
                disabled={!reqReady || reqSending}
                onClick={sendReqCode}
              >
                {reqSending ? "Sending…" : "Send verification code"}
              </button>
              <button className="artium-su-change" style={{ marginLeft: 0 }} onClick={() => setShowReq(false)}>Cancel</button>
            </div>
          )}

          {reqCodeSent && !reqVerified && (
            <div>
              <p className="text-sm" style={{ color: C.ivoryDim, marginBottom: 8 }}>Enter the code sent to <b>{reqEmail.trim()}</b>.</p>
              <input
                style={{ width: "100%", maxWidth: 260, padding: "12px 16px", borderRadius: 10, border: `1.5px solid ${C.inkLine}`, background: "rgba(176,146,98,0.05)", color: C.ivory, fontFamily: FONT_MONO, fontSize: 22, fontWeight: 600, letterSpacing: 8, textAlign: "center", outline: "none", boxSizing: "border-box" }}
                value={reqCode}
                onChange={(e) => { setReqCode(e.target.value.replace(/\D/g, "").slice(0, 10)); setReqErr(""); }}
                placeholder="••••••••" inputMode="numeric" autoFocus />
              <div className="flex items-center gap-3" style={{ marginTop: 12 }}>
                <PrimaryBtn disabled={reqCode.length < 6 || reqVerifying} onClick={verifyReqCode}>{reqVerifying ? "Verifying…" : "Verify address"}</PrimaryBtn>
                <button onClick={sendReqCode} disabled={reqSending} style={{ fontSize: 13, color: C.brassLabel, background: "none", border: "none", cursor: "pointer" }}>Resend code</button>
              </div>
            </div>
          )}

          {reqVerified && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <CheckIcon size={18} color="#1A9E6E" />
                <p style={{ fontSize: 14, color: "#1A9E6E", fontWeight: 600, margin: 0 }}>Address confirmed</p>
              </div>
              <p className="text-sm" style={{ color: C.ivoryDim, marginBottom: 12, lineHeight: 1.55 }}>
                We know the address is yours. Now we check that it belongs to the conservatory you named — that part is done by hand.
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  className="artium-su-next-btn"
                  style={{ flex: "0 0 auto", fontSize: 14, padding: "11px 20px" }}
                  disabled={!reqReady}
                  onClick={() => {
                    update({ domainReq: { name: reqName.trim(), address: reqAddress.trim(), email: reqEmail.trim() }, transferPending: false, priorSchool: null });
                    setShowReq(false);
                  }}
                >
                  Send for approval
                </button>
                <button className="artium-su-change" style={{ marginLeft: 0 }} onClick={() => setShowReq(false)}>Cancel</button>
              </div>
            </div>
          )}
          {reqErr && <p className="text-sm" style={{ color: C.burgundy, marginTop: 10 }}>{reqErr}</p>}
        </div>
      )}

      {/* Document proof upload (no institutional email path). Deliberately not
          gated on a selection: with an empty approved list there would be
          nothing to select, and the document is what establishes the school.
          Nor on !isGoogle — a Google account proves an email address, not
          enrolment, so the Google shortcut that skips OTP doesn't apply. */}
      {proving && isDoc && (
        <div className="mt-5 rounded-2xl" style={{ border: `1px solid ${draft.proofDocUrl ? "#1A9E6E" : C.brass}`, background: C.inkSoft, padding: "18px 18px" }}>
          <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.brassLabel, letterSpacing: 0.5, marginBottom: 8 }}>{applicant === "graduate" ? "UPLOAD YOUR DIPLOMA" : "UPLOAD YOUR PROOF"}</p>
          {/* Split by where the person is, not by document type. A graduate
              hunting for a "proof of enrolment" they no longer have was the
              old copy's dead end — the card at the gate now says Student |
              Graduate, and this is the step that has to honour it. */}
          {/* The door already said which of them this person is, so the panel
              asks for that one thing rather than listing both and making them
              find their own row again. */}
          <p className="text-sm" style={{ color: C.ivoryDim, marginBottom: 12, lineHeight: 1.55 }}>
            {applicant === "graduate"
              ? <>Your <b style={{ color: C.ivory, fontWeight: 600 }}>diploma</b>, or a transcript naming the conservatory{selectedCons ? <> — {selectedCons.name}</> : null}.</>
              : <>A <b style={{ color: C.ivory, fontWeight: 600 }}>student ID card</b>, <b style={{ color: C.ivory, fontWeight: 600 }}>enrolment certificate</b> or <b style={{ color: C.ivory, fontWeight: 600 }}>tuition receipt</b>{selectedCons ? <> from {selectedCons.name}</> : null}.</>}
          </p>
          <p className="text-sm" style={{ color: C.ivoryDim, marginBottom: 12, lineHeight: 1.55 }}>
            Our team reviews it by hand before granting access
            {selectedCons ? "" : ", and confirms your conservatory from the document"}.
          </p>
          {draft.proofDocUrl ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <CheckIcon size={18} color="#1A9E6E" />
              <span style={{ fontSize: 14, color: "#1A9E6E", fontWeight: 600 }}>{draft.proofDocName || "Document uploaded"}</span>
              <label style={{ fontSize: 13, color: C.brassLabel, cursor: "pointer" }}>
                Replace
                <input type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={(e) => uploadProof(e.target.files?.[0])} />
              </label>
            </div>
          ) : (
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", borderRadius: 10, border: `1.5px dashed ${C.inkLine}`, background: "rgba(176,146,98,0.05)", cursor: uploading ? "default" : "pointer", color: C.ivory, fontWeight: 600, fontSize: 14 }}>
              <Upload size={16} /> {uploading ? "Uploading…" : "Choose a file"}
              <input type="file" accept="image/*,application/pdf" style={{ display: "none" }} disabled={uploading} onChange={(e) => uploadProof(e.target.files?.[0])} />
            </label>
          )}
          <p className="text-xs" style={{ color: C.ivoryDim, marginTop: 10, fontFamily: FONT_MONO }}>Image or PDF · max 10 MB · kept private, seen only by our review team.</p>
          {err && <p className="text-sm" style={{ color: C.burgundy, marginTop: 10 }}>{err}</p>}
        </div>
      )}

      {/* Conservatory email verification (OTP path) */}
      {selectedCons && !googleProvesSchool && proving && !isDoc && (
        <div className="mt-5 rounded-2xl" style={{ border: `1px solid ${verified ? "#1A9E6E" : C.brass}`, background: C.inkSoft, padding: "18px 18px" }}>
          <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.brassLabel, letterSpacing: 0.5, marginBottom: 8 }}>VERIFY YOUR {(selectedCons.short || selectedCons.name).toUpperCase()} STUDENT EMAIL</p>
          {verified ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CheckIcon size={18} color="#1A9E6E" />
              <p style={{ fontSize: 14, color: "#1A9E6E", fontWeight: 600, margin: 0 }}>{draft.conservatoryEmail} verified</p>
            </div>
          ) : (
            <>
              <p className="text-sm" style={{ color: C.ivoryDim, marginBottom: 10 }}>
                Enter your <b>@{selectedCons.domains[0]}</b> address. We'll email you a code to confirm you study there.
              </p>
              <input style={inputStyle} type="email" value={email} disabled={codeSent}
                onChange={(e) => { setEmail(e.target.value); setErr(""); }}
                placeholder={`you@${selectedCons.domains[0]}`} autoComplete="off" />
              {email && !domainOk && (
                <p className="text-sm" style={{ color: C.burgundy, marginTop: 6 }}>
                  This must be a {selectedCons.name} address ({selectedCons.domains.map((d) => "@" + d).join(" or ")}).
                </p>
              )}

              {!codeSent ? (
                <div style={{ marginTop: 12 }}>
                  <PrimaryBtn disabled={!domainOk || sending} onClick={sendCode}>{sending ? "Sending…" : "Send verification code"}</PrimaryBtn>
                </div>
              ) : (
                <div style={{ marginTop: 12 }}>
                  <p className="text-sm" style={{ color: C.ivoryDim, marginBottom: 8 }}>Enter the code sent to <b>{email}</b>.</p>
                  <input
                    style={{ width: "100%", maxWidth: 260, padding: "12px 16px", borderRadius: 10, border: `1.5px solid ${C.inkLine}`, background: "rgba(176,146,98,0.05)", color: C.ivory, fontFamily: FONT_MONO, fontSize: 22, fontWeight: 600, letterSpacing: 8, textAlign: "center", outline: "none", boxSizing: "border-box" }}
                    value={code}
                    onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 10)); setErr(""); }}
                    placeholder="••••••••" inputMode="numeric" autoFocus />
                  <div className="flex items-center gap-3" style={{ marginTop: 12 }}>
                    <PrimaryBtn disabled={code.length < 6 || verifying} onClick={verifyCode}>{verifying ? "Verifying…" : "Verify & continue"}</PrimaryBtn>
                    <button onClick={sendCode} disabled={sending} style={{ fontSize: 13, color: C.brassLabel, background: "none", border: "none", cursor: "pointer" }}>Resend code</button>
                  </div>
                </div>
              )}
              {err && <p className="text-sm" style={{ color: C.burgundy, marginTop: 10 }}>{err}</p>}
            </>
          )}
        </div>
      )}
      {selectedCons && googleProvesSchool && proving && (
        <div className="mt-5 rounded-2xl" style={{ border: `1px solid #1A9E6E`, background: C.inkSoft, padding: "14px 18px", display: "flex", alignItems: "center", gap: 8 }}>
          <CheckIcon size={18} color="#1A9E6E" />
          <p style={{ fontSize: 14, color: "#1A9E6E", fontWeight: 600, margin: 0 }}>Verified via Google ({draft.email})</p>
        </div>
      )}

      {/* The way out, at the bottom, where the dead end is.
          "Keep my current conservatory" already existed — in the banner at the
          top of a step that scrolls a long way, so by the time somebody is
          staring at a disabled Next and a code they do not want to enter, the
          only escape is off-screen behind everything they just read. An exit
          is no use where the trouble is not. */}
      {changingSchool && !draft.conservatoryVerified && !draft.proofDocUrl && !draft.domainReq && (
        <div className="mt-5 rounded-2xl" style={{ border: `1px solid ${C.inkLine}`, background: "rgba(176,146,98,0.05)", padding: "14px 16px" }}>
          <p className="text-sm" style={{ margin: 0, color: C.ivoryDim, lineHeight: 1.55 }}>
            Changed your mind? Nothing has moved yet — your conservatory is still
            the one you had.
          </p>
          <button
            onClick={cancelTransfer}
            style={{ marginTop: 8, padding: 0, background: "none", border: "none", cursor: "pointer", color: C.brassLabel, fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700 }}
          >
            Keep my current conservatory
          </button>
        </div>
      )}

      </>
      )}
    </div>
  );
}

function StepTastes({ draft, toggleTaste }) {
  const [showOther, setShowOther] = useState(false);
  const [otherText, setOtherText] = useState("");
  const customTastes = draft.tastes.filter((t) => !TASTE_OPTIONS.includes(t));
  function addOther() {
    const v = otherText.trim();
    if (!v) return;
    if (!draft.tastes.includes(v)) toggleTaste(v);
    setOtherText("");
  }
  return (
    <div>
      <p className="text-sm mb-5" style={{ color: C.ivoryDim }}>Select at least three — composers and/or eras you gravitate toward, as a listener or a performer. ({draft.tastes.length} selected)</p>
      <div className="flex flex-wrap gap-2">
        {TASTE_OPTIONS.map((t) => (
          <Chip key={t} active={draft.tastes.includes(t)} onClick={() => toggleTaste(t)}>{t}</Chip>
        ))}
        {customTastes.map((t) => (
          <Chip key={t} active onClick={() => toggleTaste(t)}>{t}</Chip>
        ))}
        <Chip active={showOther} onClick={() => setShowOther((v) => !v)}>Other</Chip>
      </div>
      {showOther && (
        <div className="mt-4 flex items-center gap-2">
          <input
            style={inputStyle}
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOther(); } }}
            placeholder="Type a composer, era, or style, then press Enter"
            autoFocus
          />
          <button onClick={addOther} className="rounded-xl px-4 py-3 flex items-center justify-center shrink-0" style={{ background: C.brass, color: C.inkText }}>
            <Plus size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

function StepPieces({ draft, update }) {
  const [title, setTitle] = useState("");
  const [composer, setComposer] = useState("");
  function add() {
    if (!title.trim() || !composer.trim()) return;
    update({ pieces: [...draft.pieces, { title, composer }] });
    setTitle(""); setComposer("");
  }
  function remove(i) { update({ pieces: draft.pieces.filter((_, idx) => idx !== i) }); }
  return (
    <div>
      <p className="text-sm mb-5" style={{ color: C.ivoryDim }}>What are you currently working on in lessons or on your own?</p>
      <div className="grid gap-2 mb-5" style={{ gridTemplateColumns: "1fr 1fr auto" }}>
        <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Piece title" />
        <input style={inputStyle} value={composer} onChange={(e) => setComposer(e.target.value)} placeholder="Composer" />
        <button onClick={add} className="rounded-xl px-4 flex items-center justify-center" style={{ background: C.brass, color: C.inkText }}><Plus size={18} /></button>
      </div>
      <div className="flex flex-col gap-2">
        {draft.pieces.map((p, i) => (
          <div key={i} className="flex items-center justify-between rounded-xl px-4 py-3" style={{ border: `1px solid ${C.inkLine}` }}>
            <div>
              <span style={{ fontFamily: FONT_MONO, color: C.brassLabel, fontSize: 11 }}>No. {i + 1}</span>
              <p style={{ fontWeight: 600, fontSize: 14 }}>{p.title}</p>
              <p style={{ fontSize: 12, color: C.ivoryDim }}>{p.composer}</p>
            </div>
            <button onClick={() => remove(i)}><Trash2 size={15} color={C.ivoryDim} /></button>
          </div>
        ))}
        {draft.pieces.length === 0 && <p className="text-sm" style={{ color: C.ivoryDim }}>Nothing added yet.</p>}
      </div>
    </div>
  );
}

function StepTopFlop({ draft, update }) {
  return (
    <div>
      <p className="text-sm mb-7" style={{ color: C.ivoryDim, lineHeight: 1.6 }}>
        A quick, honest snapshot of where you are right now — the kind of thing only another musician really gets.
      </p>
      <Field label="Top — what's going well right now">
        <textarea
          rows={3}
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
          value={draft.top}
          onChange={(e) => update({ top: e.target.value })}
          placeholder="Whatever's been a win lately, big or small — finishing an exam, finally nailing a piece…"
        />
      </Field>

      <Field label="Flop — what you're struggling with right now">
        <textarea
          rows={3}
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
          value={draft.flop}
          onChange={(e) => update({ flop: e.target.value })}
          placeholder="Whatever's been hard lately — a technical passage, a wall you keep hitting. This isn't graded."
        />
      </Field>

      <Field label="If you could spend a day with any composer in history, who would it be — and why?">
        <textarea
          rows={3}
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
          value={draft.composerDay}
          onChange={(e) => update({ composerDay: e.target.value })}
          placeholder="Bach, to ask him about the Goldberg Variations. Satie, just to see what a Tuesday looks like for him…"
        />
      </Field>
    </div>
  );
}

function StepReview({ draft }) {
  const cons = findConservatory(draft.conservatoryId);

  const Card = ({ label, children }) => (
    <div style={{ background: "rgba(176,146,98,0.05)", border: `1px solid ${C.inkLine}`, borderRadius: 10, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: C.brassLabel, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
      <div style={{ fontSize: 14, color: C.ivory, lineHeight: 1.6 }}>{children}</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 24 }}>
        <div style={{ marginTop: 4 }}><Avatar name={draft.name || "?"} photoUrl={draft.photoUrl} size={60} /></div>
        <div>
          <p style={{ fontSize: 20, fontWeight: 700, color: C.ivory, margin: 0 }}>{draft.name || "—"}</p>
          <p style={{ fontSize: 13, color: C.ivoryDim, margin: "3px 0 0" }}>{[instrumentLabel(draft), draft.years].filter(Boolean).join(" · ")}</p>
          {cons && <p style={{ fontSize: 13, color: C.ivoryDim, margin: "1px 0 0" }}>{cons.name}, {cons.city}</p>}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {draft.tastes.length > 0 && (
          <Card label="Musical preferences">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {draft.tastes.map((t) => (
                <span key={t} style={{ fontSize: 12, padding: "2px 9px", borderRadius: 20, border: `1px solid ${C.inkLine}`, color: C.ivory, background: C.inkSoft }}>{t}</span>
              ))}
            </div>
          </Card>
        )}
        {draft.pieces.length > 0 && (
          <Card label="Current repertoire">
            {draft.pieces.map((p, i) => (
              <div key={i}><span style={{ fontWeight: 600 }}>{p.title}</span><span style={{ color: C.ivoryDim }}> — {p.composer}</span></div>
            ))}
          </Card>
        )}
        {draft.top && <Card label="Recent win">{draft.top}</Card>}
        {draft.flop && <Card label="Current challenge">{draft.flop}</Card>}
        <Card label="Teaching"><TeachingCell teaching={draft.teaching} /></Card>
        {draft.composerDay && <Card label="A day with a composer">{draft.composerDay}</Card>}
      </div>
    </div>
  );
}

function PendingReview({ onHome, onLogout }) {
  return (
    <div className="min-h-full flex flex-col" style={{ background: C.ink, color: C.ivory }}>
      <div className="px-6 py-4 flex items-center gap-5">
        <Logo size={18} />
        {/* No way home while an application is open. Home was the bypass:
            it dropped you on the landing page, which draws a signed-in header
            and offers a card that walks back into the app. There is nowhere
            for this button to go that is not either this screen again or a
            hole, so it is only drawn when a caller has somewhere to send it.
            Log out, below, is the way out. */}
        {onHome && <HomeBtn onClick={onHome} />}
      </div>
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-md text-center lg-fade">
          <div className="mx-auto mb-6 rounded-full flex items-center justify-center" style={{ width: 64, height: 64, border: `1px solid ${C.brass}` }}>
            <FileText color={C.brass} size={26} />
          </div>
          {/* Three kinds of application land here and the old copy described
              only one of them: a graduate is not enrolled anywhere, and a
              domain request uploads nothing at all, so "the proof you
              uploaded" was simply untrue for two of the three. Written to be
              true of all three instead of threading the kind down — the
              screen is also reached on session restore, where the draft is
              gone and there would be nothing to thread. */}
          <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 600 }}>Your application is under review</h2>
          <p className="mt-3 text-sm" style={{ color: C.ivoryDim, lineHeight: 1.6 }}>
            Thanks! We're checking what you sent us to confirm your conservatory. Once approved, your student profile goes live and you'll get full access. This usually takes 1–2 days.
          </p>
          <div className="mt-8">
            <button onClick={onLogout} style={{ fontSize: 13, fontWeight: 600, color: C.ivoryDim, background: "none", border: `1px solid ${C.inkLine}`, borderRadius: 8, padding: "8px 18px", cursor: "pointer" }}>Log out</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// The dead end this screen used to be: no link arrives, and there is nothing
// to do but wait for something that is never coming. The usual cause is that
// the address already has an account — signing up again is not an error to
// Supabase, because saying "that email is taken" would let anyone test
// whether a given person has an account, so it sends nothing and returns
// something that looks like success.
//
// Reading that from the response is guesswork and I got it wrong: keying off
// an empty identities array rejected an address that had just been deleted
// from Auth, and a false positive here blocks signup completely, which is far
// worse than the silence it was meant to fix. So we no longer infer. Resend
// asks the server to do the one thing in question, and the server's own
// answer — including "already confirmed" — is the truth we could not deduce.
function ConfirmEmail({ email, onLogin, onHome, pendingReview }) {
  const [resending, setResending] = useState(false);
  const [note, setNote] = useState(null);

  async function resend() {
    setNote(null); setResending(true);
    const { error } = await supabase.auth.resend({ type: "signup", email });
    setResending(false);
    setNote(error
      ? { bad: true, text: /already|confirmed/i.test(error.message)
          ? "This address is already confirmed — log in instead."
          : error.message }
      : { bad: false, text: "Sent again. It can take a minute to arrive." });
  }

  return (
    <div className="min-h-full flex flex-col" style={{ background: C.ink, color: C.ivory }}>
      <div className="px-6 py-4 flex items-center gap-5">
        <Logo size={18} />
        <HomeBtn onClick={onHome} />
      </div>
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-md text-center lg-fade">
          <div className="mx-auto mb-6 rounded-full flex items-center justify-center lg-blink" style={{ width: 64, height: 64, border: `1px solid ${C.brass}` }}>
            <Music2 color={C.brass} size={26} />
          </div>
          <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 600 }}>Check your inbox</h2>
          <p className="mt-3 text-sm" style={{ color: C.ivoryDim, lineHeight: 1.6 }}>
            We sent a confirmation link to <strong style={{ color: C.ivory }}>{email}</strong>. Click it to activate your account — your profile will be created automatically as soon as you do.
          </p>
          {/* Someone who sent a document or a domain request has one more step
              after this one, and the line above reads like the last. Said here
              rather than left as a surprise on the next screen — and it is
              also the honest answer to "why am I not in yet". */}
          {pendingReview && (
            <p className="mt-3 text-sm" style={{ color: C.ivoryDim, lineHeight: 1.6 }}>
              After that, we check the conservatory you gave us by hand. You'll be on the map once that's done — usually 1–2 days.
            </p>
          )}
          <p className="mt-6 text-sm" style={{ color: C.ivoryDim }}>
            Didn't get it? <button onClick={resend} disabled={resending} style={{ color: C.brassLabel, fontWeight: 600 }}>{resending ? "Sending…" : "Send it again"}</button>
          </p>
          {note && (
            <p className="mt-2 text-sm" style={{ color: note.bad ? C.burgundy : "#1A9E6E", lineHeight: 1.55 }}>{note.text}</p>
          )}
          <p className="mt-4 text-sm" style={{ color: C.ivoryDim }}>
            Already confirmed? <button onClick={onLogin} style={{ color: C.brassLabel, fontWeight: 600 }}>Log in</button>
          </p>
        </div>
      </div>
    </div>
  );
}

function LoginScreen({ onSubmit, onBack, error, unfinished, onResume }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  async function handleSubmit() {
    setSubmitting(true);
    await onSubmit(email, password);
    setSubmitting(false);
  }
  return (
    <div className="min-h-full flex flex-col" style={{ background: C.inkSoft, color: C.ivory }}>
      <div style={{ background: "rgba(176,146,98,0.05)", borderBottom: `1px solid ${C.inkLine}`, padding: "0 32px", height: 60, display: "flex", alignItems: "center" }}>
        <button onClick={onBack} style={{ color: C.ivoryDim, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: 0, marginRight: 12 }}>
          <ChevronLeft size={18} />
        </button>
        <Logo size={20} />
      </div>
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md lg-fade" style={{ background: "rgba(176,146,98,0.05)", border: `1px solid ${C.inkLine}`, borderRadius: 12, padding: 40, boxShadow: "0 4px 24px rgba(0,0,0,0.28)" }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.3, marginBottom: 4 }}>Welcome back</h2>
          <p style={{ color: C.ivoryDim, fontSize: 15, marginBottom: 24 }}>Log in to your Artium account.</p>

          {/* Someone who abandoned signup has no account, and no way of knowing
              it: nothing is created until the last of eight steps. Log in is
              the obvious button on the gate, so they press it, are told the
              email is not registered, and conclude they signed up already and
              something is broken. This is the one case where the person cannot
              tell which door is theirs, so the door says so. */}
          {unfinished && (
            <div style={{ marginBottom: 22, padding: "13px 15px", borderRadius: 12, border: "1px solid rgba(239,208,155,0.35)", background: "rgba(239,208,155,0.06)" }}>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: C.brassLabel }}>You didn't finish signing up</p>
              <p className="text-sm" style={{ margin: "4px 0 0", color: C.ivoryDim, lineHeight: 1.5 }}>
                There's no account yet — it's only created at the last step. Everything you filled in is still here.
              </p>
              <button onClick={onResume} style={{ marginTop: 10, padding: "8px 16px", borderRadius: 999, border: "none", background: "linear-gradient(180deg, #EFD08A 0%, #DBAB4C 55%, #C9962E 100%)", color: C.brassText, fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Carry on where you left off
              </button>
            </div>
          )}
          <GoogleBtn />
          <Divider />
          <Field label="Email address">
            <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </Field>
          <Field label="Password">
            <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" />
          </Field>
          {error && <p style={{ fontSize: 13, color: C.burgundy, marginBottom: 16 }}>{error}</p>}
          <PrimaryBtn full disabled={submitting || !email || !password} onClick={handleSubmit} icon={ArrowRight}>
            {submitting ? "Logging in…" : "Continue"}
          </PrimaryBtn>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* APP SHELL                                                          */
/* ---------------------------------------------------------------- */
function LearnerProfileModal({ learner, onClose }) {
  if (!learner) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "rgba(176,146,98,0.05)", borderRadius: 16, padding: 32, width: 340, maxWidth: "90vw", boxShadow: "0 16px 48px rgba(0,0,0,0.18)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <Avatar name={learner.name} id={learner.learnerId} size={56} />
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: C.ivory, margin: 0 }}>{learner.name}</p>
            <p style={{ fontSize: 13, color: C.ivoryDim, margin: "3px 0 0" }}>{learner.instrument}</p>
          </div>
        </div>
        {learner.bio && (
          <p style={{ fontSize: 13, color: C.ivory, lineHeight: 1.6, margin: "0 0 20px", padding: "12px 14px", background: C.inkSoft, borderRadius: 10 }}>{learner.bio}</p>
        )}
        <button onClick={onClose} style={{ width: "100%", padding: "10px", borderRadius: 10, fontSize: 13, fontWeight: 600, background: C.inkSoft, border: "none", color: C.ivoryDim, cursor: "pointer" }}>Close</button>
      </div>
    </div>
  );
}

/**
 * networkFeeds ("You have N teaching requests" / "N concert hiring
 * requests" / "N new posts in Tomorrow's Composers" / "N news in Classical
 * Events") is the student network header's own reading of this bell — a
 * feed launcher rather than the inline accept/decline cards below. It's
 * opt-in (a prop, not a rewrite of the default) so Landing's and the app
 * shell's headers, which still want the old per-request cards, are
 * untouched.
 *
 * Teaching requests and concert hiring requests are read off real pending
 * state (incomingRequests / hireCount) — a signature or a reply is what
 * clears those, not opening the bell, so their counts are NOT gated by the
 * last-seen stamps below (stamping just marks the visit; the badge tracks
 * truth). Composer posts and Classical Events have no timestamped feed to
 * read yet, so their counts are hardcoded 0 with the last-seen plumbing
 * wired and ready — see artium_seen_composers_v1 / artium_seen_news_v1.
 */
function markFeedSeen(key) {
  try { localStorage.setItem(key, String(Date.now())); } catch { /* private mode */ }
}

// Read as an id list; anything else (missing key, corrupt JSON, private
// mode) reads back empty rather than throwing.
function readAckIds(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

// A stamped timestamp, read back as a number (0 if never stamped).
function readTs(key) {
  const v = Number(localStorage.getItem(key));
  return Number.isFinite(v) ? v : 0;
}

function NotificationBell({ myProfile, onGoToLessonRoom, authUser, isAdmin, onGoToAdmin, networkFeeds, puck, hireCount = 0, hireIds = [], onGoToConcerts, onGoToComposers, onGoToNews }) {
  const [open, setOpen] = React.useState(false);
  const [viewingLearner, setViewingLearner] = React.useState(null);
  const [pending, setPending] = React.useState(() => {
    try {
      const all = JSON.parse(localStorage.getItem("incomingRequests") || "{}");
      return (all[myProfile?.id] || []).filter((r) => r.status === "pending");
    } catch { return []; }
  });
  const [promoPending, setPromoPending] = React.useState([]);
  // "New since last acknowledged" for the two request feeds — a list of ids
  // (incomingRequests has no numeric id, but each entry is deduped by
  // learnerId when it's written, so learnerId is the stable per-request key;
  // pianist inquiries already carry a real .id). Opening the panel, or
  // pressing "Mark all as read", replaces these wholesale with whatever is
  // pending right now — which both quiets the badge for everything on
  // screen AND is the prune: an id that has since been accepted/declined
  // and dropped out of `pending`/`hireIds` is never written back, so this
  // list can't grow past what's currently pending.
  const [ackTeachIds, setAckTeachIds] = React.useState(() => readAckIds("artium_ack_teach_v1"));
  const [ackHireIds, setAckHireIds] = React.useState(() => readAckIds("artium_ack_hire_v1"));
  // Composers/news split the same way, but by two timestamps instead of one
  // set of ids (there's no per-item id for either feed, just a publish
  // time). The ROW stamp (artium_seen_*) only moves on an actual visit — a
  // row click navigating to the page. The BADGE's own ack stamp
  // (artium_ackts_*) moves the moment the panel is opened or "Mark all as
  // read" is pressed, same trigger as the two request feeds above. So
  // opening the bell quiets the badge, but the row keeps reading "3 new
  // posts" until the student actually goes and looks — the two stamps are
  // deliberately different clocks.
  const [seenComposersTs, setSeenComposersTs] = React.useState(() => readTs("artium_seen_composers_v1"));
  const [seenNewsTs, setSeenNewsTs] = React.useState(() => readTs("artium_seen_news_v1"));
  const [ackComposersTs, setAckComposersTs] = React.useState(() => readTs("artium_ackts_composers_v1"));
  const [ackNewsTs, setAckNewsTs] = React.useState(() => readTs("artium_ackts_news_v1"));
  const ref = React.useRef(null);

  function stampTs(key, setter) {
    const now = Date.now();
    try { localStorage.setItem(key, String(now)); } catch { /* private mode */ }
    setter(now);
  }

  function acknowledgeAll() {
    if (!networkFeeds) return;
    const teachIds = pending.map((r) => r.learnerId);
    try {
      localStorage.setItem("artium_ack_teach_v1", JSON.stringify(teachIds));
      localStorage.setItem("artium_ack_hire_v1", JSON.stringify(hireIds));
    } catch { /* private mode */ }
    setAckTeachIds(teachIds);
    setAckHireIds(hireIds);
    // Ack-only — the row's own seen stamp is untouched here, and only moves
    // when a row is actually clicked through (see NetworkRow's onVisit).
    stampTs("artium_ackts_composers_v1", setAckComposersTs);
    stampTs("artium_ackts_news_v1", setAckNewsTs);
  }

  // Admin-only: pending promotion submissions (Supabase for real, localStorage for demo)
  React.useEffect(() => {
    if (!isAdmin) { setPromoPending([]); return; }
    let alive = true;
    async function load() {
      if (authUser?.id) {
        const { data } = await supabase.from("promotions").select("*").eq("status", "pending").order("created_at", { ascending: true });
        if (alive) setPromoPending(data || []);
      } else {
        try { setPromoPending(JSON.parse(localStorage.getItem("artium_promotions") || "[]").filter((p) => p.status === "pending")); } catch {}
      }
    }
    load();
    const id = setInterval(load, 4000);
    return () => { alive = false; clearInterval(id); };
  }, [isAdmin, authUser?.id]);

  React.useEffect(() => {
    function onStorage(e) {
      if (e.key === "incomingRequests") {
        try {
          const all = JSON.parse(e.newValue || "{}");
          setPending((all[myProfile?.id] || []).filter((r) => r.status === "pending"));
        } catch {}
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [myProfile?.id]);

  // Also poll localStorage every 2s (same-tab updates don't fire storage event)
  React.useEffect(() => {
    const id = setInterval(() => {
      try {
        const all = JSON.parse(localStorage.getItem("incomingRequests") || "{}");
        setPending((all[myProfile?.id] || []).filter((r) => r.status === "pending"));
      } catch {}
    }, 2000);
    return () => clearInterval(id);
  }, [myProfile?.id]);

  React.useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!myProfile) return null;

  // The network header's own count: exactly the four feeds, nothing else —
  // promoPending is an admin concern, orthogonal to a student's four rows,
  // so it never inflates this badge even when both are true at once.
  //
  // The badge itself is "new since acknowledged", not "pending" — teach/hire
  // rows keep showing the full pending count (pending.length / hireCount)
  // regardless, but the BADGE only counts pending items whose id hasn't been
  // acknowledged yet (see acknowledgeAll above).
  //
  // Composers/news mirror that split with timestamps instead of ids: no
  // client-side feed exists yet for either (WallOfComposers is a static
  // list, there is no news source at all), so these arrays are empty and
  // both counts stay latent 0s — but the shape is real. ROW count reads
  // against the row's own seen stamp, which only advances on an actual
  // visit (NetworkRow's onVisit, below); BADGE count reads against the ack
  // stamp, which advances on opening the panel or "Mark all as read", same
  // as the request feeds.
  const composerPosts = []; // { createdAt: number }[] — no feed to read yet
  const newsItems = []; // { createdAt: number }[] — no feed to read yet
  const composerCount = composerPosts.filter((p) => p.createdAt > seenComposersTs).length;
  const newsCount = newsItems.filter((p) => p.createdAt > seenNewsTs).length;
  const composerBadgeCount = composerPosts.filter((p) => p.createdAt > ackComposersTs).length;
  const newsBadgeCount = newsItems.filter((p) => p.createdAt > ackNewsTs).length;
  const newTeachCount = pending.filter((r) => !ackTeachIds.includes(r.learnerId)).length;
  const newHireCount = hireIds.filter((id) => !ackHireIds.includes(id)).length;
  const feedTotal = newTeachCount + newHireCount + composerBadgeCount + newsBadgeCount;
  const totalCount = networkFeeds ? feedTotal : pending.length + promoPending.length;

  // A ~40px tinted tile, its icon, a title over a status line, and a
  // right-aligned count in the tile's own colour — the mock's row, not the
  // single sentence the first pass drew. `count` here is always the true
  // pending/row figure, never the "new" figure the badge tracks — a row you
  // already opened once still shows "2 requests" until one is actually
  // answered, it just stops being what lit the bell.
  // onVisit is the composers/news rows' own extra step: a click-through is
  // both the row's seen stamp (markFeedSeen, below — read by composerCount/
  // newsCount above) and the badge's ack stamp (onVisit — read by
  // composerBadgeCount/newsBadgeCount), since actually visiting the page
  // acknowledges the badge too. The request rows don't pass onVisit; they
  // have nothing else to stamp on click.
  function NetworkRow({ icon, tileBg, tileColor, title, count, activeText, inactiveText, seenKey, onGo, onVisit }) {
    const active = count > 0;
    return (
      <button
        onClick={() => { markFeedSeen(seenKey); onVisit && onVisit(); setOpen(false); onGo && onGo(); }}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 12, textAlign: "left",
          padding: "13px 16px", border: "none", borderBottom: `1px solid ${C.inkLine}`,
          background: "transparent", cursor: "pointer", fontFamily: FONT_BODY,
        }}
      >
        <span style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: tileBg, color: tileColor, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {icon}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: C.ivory, lineHeight: 1.3 }}>{title}</p>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: C.ivoryDim, lineHeight: 1.3 }}>{active ? activeText : inactiveText}</p>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: active ? tileColor : C.ivoryDim }}>{count}</span>
          <ChevronRight size={15} color={C.ivoryDim} />
        </span>
      </button>
    );
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <LearnerProfileModal learner={viewingLearner} onClose={() => setViewingLearner(null)} />
      <button
        onClick={() => setOpen((o) => {
          const next = !o;
          // Opening is looking — everything on screen counts as seen the
          // moment the panel is up, same as "Mark all as read" does
          // explicitly. Closing acknowledges nothing new.
          if (next) acknowledgeAll();
          return next;
        })}
        aria-label="Notifications"
        className={puck ? "artium-net-puck" : undefined}
        style={puck ? undefined : { position: "relative", background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <Bell size={puck ? 15 : 20} strokeWidth={puck ? 2 : 1.8} color={puck ? "currentColor" : (totalCount > 0 ? C.brass : C.ivoryDim)} />
        {totalCount > 0 && (
          <span
            className={puck ? "artium-net-bell-badge" : undefined}
            style={puck ? undefined : { position: "absolute", top: 0, right: 0, width: 16, height: 16, borderRadius: "50%", background: "#E53E3E", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}
          >
            {totalCount}
          </span>
        )}
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 320, background: networkFeeds ? "#FFFFFF" : "rgba(176,146,98,0.05)", borderRadius: networkFeeds ? 20 : 12, boxShadow: networkFeeds ? "0 20px 40px -22px rgba(150,115,55,0.38), inset 0 1px 0 #fff" : "0 8px 32px rgba(0,0,0,0.14)", border: `1px solid ${C.inkLine}`, zIndex: 200, overflow: "hidden", maxHeight: 460, overflowY: "auto" }}>
          {networkFeeds ? (
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.inkLine}`, display: "flex", alignItems: "center", gap: 8 }}>
              <Bell size={14} color={C.brass} />
              <p style={{ flex: 1, minWidth: 0, margin: 0, fontSize: 17, fontWeight: 600, color: C.ivory }}>Notifications</p>
              {/* Genuinely redundant with opening the panel now — opening
                  already acknowledges everything below — but harmless, and
                  it's the explicit, expected control the mock draws. */}
              <button
                onClick={acknowledgeAll}
                style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: C.brass, fontSize: 12.5, fontWeight: 600, padding: 0, flexShrink: 0 }}
              >
                <CheckCircle2 size={13} strokeWidth={2} /> Mark all as read
              </button>
            </div>
          ) : (
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.inkLine}` }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: C.ivory, margin: 0 }}>Notifications</p>
            </div>
          )}
          {/* Owner-only: promotion approval requests, in either panel format */}
          {promoPending.map((p) => (
            <div key={p.id} style={{ padding: "12px 16px", background: "#EEF4FF", borderBottom: `1px solid ${C.inkLine}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: C.brassDim, color: C.brass, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Megaphone size={18} /></div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: C.ivory, margin: "0 0 2px" }}>{p.name} submitted a promo video</p>
                  <p style={{ fontSize: 12, color: C.ivoryDim, margin: 0 }}>{p.provider} · awaiting your approval</p>
                </div>
              </div>
              <button onClick={() => { setOpen(false); onGoToAdmin && onGoToAdmin(); }}
                style={{ width: "100%", padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 700, background: C.brass, border: "none", color: C.brassText, cursor: "pointer" }}>
                Review &amp; approve
              </button>
            </div>
          ))}
          {networkFeeds ? (
            <>
              <NetworkRow
                icon={<GraduationCap size={18} strokeWidth={2} />}
                tileBg="rgba(201,150,46,0.14)" tileColor={C.brass}
                title="Teaching requests"
                count={pending.length}
                activeText={`${pending.length} new request${pending.length === 1 ? "" : "s"}`}
                inactiveText="You have 0 new requests"
                seenKey="artium_seen_teach_v1"
                onGo={onGoToLessonRoom}
              />
              <NetworkRow
                icon={<Briefcase size={18} strokeWidth={2} />}
                tileBg="rgba(139,109,196,0.14)" tileColor="#8B6DC4"
                title="Concert hiring requests"
                count={hireCount}
                activeText={`${hireCount} new request${hireCount === 1 ? "" : "s"}`}
                inactiveText="You have 0 new requests"
                seenKey="artium_seen_hire_v1"
                onGo={onGoToConcerts}
              />
              <NetworkRow
                icon={<Feather size={18} strokeWidth={2} />}
                tileBg="rgba(63,139,92,0.14)" tileColor={C.forest}
                title="Tomorrow's Composers"
                count={composerCount}
                activeText={`${composerCount} new post${composerCount === 1 ? "" : "s"}`}
                inactiveText="0 new posts"
                seenKey="artium_seen_composers_v1"
                onGo={onGoToComposers}
                onVisit={() => stampTs("artium_ackts_composers_v1", setAckComposersTs)}
              />
              <NetworkRow
                icon={<Calendar size={18} strokeWidth={2} />}
                tileBg="rgba(178,59,59,0.14)" tileColor={C.burgundy}
                title="Classical Events"
                count={newsCount}
                activeText={`${newsCount} new update${newsCount === 1 ? "" : "s"}`}
                inactiveText="0 new updates"
                seenKey="artium_seen_news_v1"
                onGo={onGoToNews}
                onVisit={() => stampTs("artium_ackts_news_v1", setAckNewsTs)}
              />
              {/* No destination exists for this yet — the four rows above
                  are the whole list, so "view all" has nowhere further to
                  go. Kept per the mock as an inert link rather than dropped,
                  ready to wire once there is a fuller notifications screen. */}
              <div style={{ padding: "11px 16px", textAlign: "center" }}>
                <button onClick={() => {}} style={{ background: "none", border: "none", cursor: "pointer", color: C.brass, fontSize: 12.5, fontWeight: 600, padding: 0 }}>
                  View all notifications ›
                </button>
              </div>
            </>
          ) : totalCount === 0 ? (
            <p style={{ fontSize: 13, color: C.ivoryDim, padding: "16px", margin: 0 }}>No new notifications</p>
          ) : (
            pending.map((r) => (
              <div key={r.learnerId} style={{ padding: "12px 16px", background: "#FFF8E7", borderBottom: `1px solid ${C.inkLine}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <Avatar name={r.name} id={r.learnerId} size={38} />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: C.ivory, margin: "0 0 2px" }}>{r.name} wants lessons</p>
                    <p style={{ fontSize: 12, color: C.ivoryDim, margin: 0 }}>{r.instrument}</p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setOpen(false); setViewingLearner(r); }}
                    style={{ flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "transparent", border: `1.5px solid ${C.inkLine}`, color: C.ivoryDim, cursor: "pointer" }}>
                    View profile
                  </button>
                  <button onClick={() => { setOpen(false); onGoToLessonRoom(); }}
                    style={{ flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 700, background: C.brass, border: "none", color: C.brassText, cursor: "pointer" }}>
                    Accept / Decline
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function AppShell({ children, appTab, setAppTab, myProfile, onApply, onHome, musicOn, onMusicToggle, onBack, backLabel, onGuestTabClick, memberCount, previewOnly, hideTabs, onGoToLessonRoom, authUser, isAdmin, onGoToAdmin, bare }) {
  const tabs = [];
  // bare: the page inside draws its own header and its own bottom bar, so the
  // shell's white chrome would sit on it as a second, lighter header.
  if (bare) return <div className="min-h-full flex flex-col">{children}</div>;
  return (
    // Room for the fixed bottom bar. The bare branch needs none: the page it
    // wraps is the Network screen, which already reserves the same height.
    <div className="min-h-full flex flex-col artium-has-tabs" style={{ background: C.inkSoft, color: C.ivory }}>
      <div className="px-6 flex items-center gap-4" style={{ height: 60, background: "rgba(176,146,98,0.05)", borderBottom: `1px solid ${C.inkLine}` }}>
        <div className="flex items-center gap-3">
          {(previewOnly || onBack) && (
            <button onClick={previewOnly ? onHome : onBack} style={{ color: C.ivoryDim, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 2, padding: 0 }}>
              <ChevronLeft size={18} />
              {backLabel && <span style={{ fontSize: 13, fontWeight: 500 }}>{backLabel}</span>}
            </button>
          )}
          <Logo size={20} markSize={HEADER_CONTROL} />
        </div>
        {!previewOnly && !hideTabs && (
          <div className="flex items-center gap-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => t.locked ? onGuestTabClick() : setAppTab(t.id)}
                className="inline-flex items-center gap-1.5"
                style={{
                  fontFamily: FONT_BODY, fontWeight: 500, fontSize: 14,
                  background: appTab === t.id ? C.brassDim : "transparent",
                  color: appTab === t.id ? C.brass : C.ivoryDim,
                  border: "none",
                  borderRadius: 6, padding: "6px 14px",
                  opacity: t.locked ? 0.5 : 1,
                  cursor: t.locked ? "default" : "pointer",
                }}
              >
                <t.icon size={14} /> {t.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <MusicBtn playing={musicOn} onToggle={onMusicToggle} />
          <MemberCount count={memberCount} />
          {myProfile && <NotificationBell myProfile={myProfile} onGoToLessonRoom={onGoToLessonRoom} authUser={authUser} isAdmin={isAdmin} onGoToAdmin={onGoToAdmin} />}
          {!myProfile ? (
            !previewOnly && <PrimaryBtn onClick={onApply}>Sign up</PrimaryBtn>
          ) : (
            <button onClick={hideTabs ? undefined : () => setAppTab("profile")} title={hideTabs ? undefined : "My profile"}
              style={{ background: "none", border: "none", padding: 0, cursor: hideTabs ? "default" : "pointer" }}>
              <Avatar name={myProfile.name} id="me" size={HEADER_CONTROL} photoUrl={myProfile.photoUrl} online />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* MAP SCREEN                                                          */
/* ---------------------------------------------------------------- */
function SignupPromptModal({ onClose, onSignup }) {
  return (
    <div
      className="fixed z-50 flex items-center justify-center"
      style={{ inset: 0, background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl p-8 max-w-sm w-full mx-4 text-center lg-fade"
        style={{ background: C.inkSoft, border: `1px solid ${C.inkLine}`, color: C.ivory }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-5 flex items-center justify-center rounded-full" style={{ width: 56, height: 56, background: C.brass }}>
          <Users size={24} color={C.inkText} />
        </div>
        <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 600 }}>Sign up to connect</h3>
        <p className="mt-3 text-sm" style={{ color: C.ivoryDim, lineHeight: 1.6 }}>
          Create your Artium profile to browse pianists, view their repertoire, and message students at conservatories around the world.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <PrimaryBtn onClick={onSignup} icon={ArrowRight}>Sign up — it's free</PrimaryBtn>
          <button onClick={onClose} className="text-sm" style={{ color: C.ivoryDim }}>Not now</button>
        </div>
      </div>
    </div>
  );
}

/**
 * The globe for Artium's World. Its own component rather than GlobeMap with
 * more props: that one carries a white roster card, a legend bar and a
 * two-tone pin scheme, none of which belong on this page.
 *
 * The texture is public/earth-artium.jpg, built by tools/make-earth-night.py
 * from NASA's Blue Marble and Black Marble — city lights screened over a
 * dimmed day pass, so the night side is lit without the oceans going flat.
 */
// pinScale: the network page pins a handful of schools that actually have
// students; the signup step pins every one that can be placed, and 110 pins
// at the same size is a pile rather than a constellation.
/**
 * Groups pins that would land on top of each other at the current altitude.
 *
 * Measured against the real list: 109 conservatories carry coordinates, and at
 * world zoom 96 of them overlap something — the European cell alone stacks 41.
 * Drawn as individual pins that is not a map, it is a smear, and the school
 * underneath is unreachable however carefully you aim.
 *
 * The cell grows and shrinks with altitude, so zooming in splits groups apart
 * rather than revealing a fixed, arbitrary set. Longitude cells widen away
 * from the equator because meridians converge: a fixed degree width would
 * group Oslo and Helsinki far more eagerly than Nairobi and Kampala.
 *
 * The selected school is never folded into a group. Whatever else the map is
 * doing, the thing you just chose stays visible and stays clickable.
 */
function clusterPins(pins, altitude, selectedId) {
  const cell = Math.min(18, Math.max(0.35, altitude * 5));
  // A plain object, not a Map: this module imports lucide-react's Map icon,
  // which shadows the global and turns `new Map()` into "Map is not a
  // constructor" at render. Null-prototype so a school id can never collide
  // with something inherited from Object.
  const groups = Object.create(null);
  const out = [];

  for (const p of pins) {
    if (p.id === selectedId) { out.push({ kind: "pin", ...p }); continue; }
    const cosLat = Math.max(0.15, Math.cos((p.lat * Math.PI) / 180));
    const lngCell = Math.min(60, cell / cosLat);
    const key = `${Math.floor(p.lat / cell)}:${Math.floor(p.lng / lngCell)}`;
    if (groups[key]) groups[key].push(p); else groups[key] = [p];
  }

  for (const members of Object.values(groups)) {
    if (members.length === 1) { out.push({ kind: "pin", ...members[0] }); continue; }
    const n = members.length;
    out.push({
      kind: "cluster",
      id: `cluster:${members.map((m) => m.id).sort().join(",")}`,
      lat: members.reduce((a, m) => a + m.lat, 0) / n,
      lng: members.reduce((a, m) => a + m.lng, 0) / n,
      schools: n,
      count: members.reduce((a, m) => a + (m.count || 0), 0),
      members,
    });
  }
  return out;
}

// The roster writes country names the way people say them; Natural Earth
// writes them the way an atlas does. Five disagree, and an unmatched name is
// a country that silently never gets labelled.
const COUNTRY_ALIASES = {
  "UK": "United Kingdom",
  "USA": "United States of America",
  "Czech Republic": "Czechia",
  "Hong Kong": "China",       // no separate admin-0 feature; the label reads China
  "Singapore": null,          // a city state, too small to carry a name at this scale
};

// How close the camera may come. Nearer than this and the earth texture is a
// brown blur — there is no more detail in the image to reveal, so the zoom
// would only be showing its own limits.
const GLOBE_MIN_ALTITUDE = 0.45;

function WorldGlobe({ pins, selectedId, onSelect, onCluster, height = 320, pinScale = 1, roaming = false }) {
  const [wrapRef, { w, h }] = useMeasured();
  const globeRef = useRef(null);
  const [ready, setReady] = useState(false);
  // Drives the clustering. Kept in state rather than read on demand because
  // the marks have to be recomputed when it changes, and rounded so a slow
  // pinch does not rebuild every pin on every frame it moves a hair.
  const [altitude, setAltitude] = useState(2.3);
  // Where the camera is over. Needed to drop names behind the horizon, which
  // otherwise bleed around the limb and sit on the back of the sphere.
  const [pov, setPov] = useState({ lat: 22, lng: 12 });

  useEffect(() => {
    if (!ready || !globeRef.current) return;
    const g = globeRef.current;
    // Europe forward, as the reference frames it, and tilted a little so the
    // globe reads as a sphere rather than a disc.
    g.pointOfView({ lat: 22, lng: 12, altitude: 2.3 }, 0);
    const c = g.controls();
    if (!c) return;
    c.autoRotate = true;
    c.autoRotateSpeed = 0.28;
    // Zoom, within bounds. The globe's radius is 100, so distance is
    // (altitude + 1) * 100.
    c.enableZoom = true;
    c.minDistance = (1 + GLOBE_MIN_ALTITUDE) * 100;
    c.maxDistance = 440;
    c.zoomSpeed = 0.7;
    // Once somebody takes hold of it, stop turning. A globe that keeps
    // rotating under the hand is one you have to fight to read.
    const stop = () => { c.autoRotate = false; };
    c.addEventListener("start", stop);
    return () => c.removeEventListener("start", stop);
  }, [ready]);

  const marks = React.useMemo(
    () => clusterPins(pins, altitude, selectedId),
    [pins, altitude, selectedId]
  );

  // Borders and names, fetched rather than imported: 174KB of geometry in the
  // bundle would be paid for by every screen in the app, and only this one
  // draws a globe. It arrives a beat after the earth does, which is the right
  // order — the sphere is what somebody is waiting for.
  const [countries, setCountries] = useState([]);
  useEffect(() => {
    let alive = true;
    fetch("/countries.geo.json")
      .then((r) => r.json())
      .then((d) => { if (alive) setCountries(d.features || []); })
      .catch(() => {});   // borders are a nicety; a failed fetch leaves a working globe
    return () => { alive = false; };
  }, []);

  /**
   * The names, and the two rules that keep them from becoming a thicket.
   *
   * First: this is a network map, not an atlas. Naming all 177 countries put
   * type over places with nothing in them and crowded out the pins, which are
   * the only reason anybody opened the screen. Only countries the network is
   * actually in get named — at full roster that is 36, not 177, and every one
   * of them says something.
   *
   * Second: even 36 collide, because nineteen of them are in Europe. So they
   * are placed in order of how much of the network they hold, and a name is
   * dropped if it lands within `minSep` of one already placed. Greedy, one
   * pass, the way a cartographer resolves the same problem: the important
   * label wins the space and the crowded-out one simply waits for a zoom
   * level where it fits.
   *
   * Labels behind the horizon are dropped too. They were bleeding around the
   * limb and sitting on the far side of the sphere, which read as clutter with
   * no cause.
   */
  const labels = React.useMemo(() => {
    if (!countries.length || !pins.length) return [];
    // Nothing at all from far out. At world zoom the pins and their counts are
    // the story, a name would have to be twenty degrees from its neighbour to
    // fit, and the handful that survived that read as an arbitrary five. Names
    // are for when somebody has come down to look at a region.
    if (altitude > 1.2) return [];

    const anchors = Object.create(null);
    for (const f of countries) anchors[f.properties.name] = f.properties;

    // Weight each country by the students behind it, so the label that
    // survives a collision is the one carrying more of the network.
    const weight = Object.create(null);
    for (const p of pins) {
      const name = COUNTRY_ALIASES[p.country] || p.country;
      if (!name || !anchors[name]) continue;
      weight[name] = (weight[name] || 0) + (p.count || 1);
    }

    const rad = Math.PI / 180;
    const centre = { lat: pov.lat * rad, lng: pov.lng * rad };
    // How far apart two names must sit. Wider when far out, where a degree is
    // worth few pixels and everything bunches toward the limb.
    const minSep = Math.max(4, Math.min(26, altitude * 9));

    const placed = [];
    const candidates = Object.keys(weight).sort((a, b) => weight[b] - weight[a]);

    for (const name of candidates) {
      const a = anchors[name];
      // Front of the sphere only, against the real horizon rather than a
      // guessed constant. From altitude h above a unit sphere the visible cap
      // ends where cos(angle) = 1/(1+h) — 72° out at world zoom, 46° when
      // close. A fixed cutoff was labelling the United States and China while
      // the camera was over Europe, because at that altitude they are behind
      // the edge of the world.
      const cosAngle =
        Math.sin(centre.lat) * Math.sin(a.lat * rad) +
        Math.cos(centre.lat) * Math.cos(a.lat * rad) * Math.cos((a.lng - pov.lng) * rad);
      if (cosAngle < 1 / (1 + altitude)) continue;

      const clash = placed.some((q) => {
        const dLat = q.lat - a.lat;
        const dLng = (q.lng - a.lng) * Math.cos(a.lat * rad);
        return Math.hypot(dLat, dLng) < minSep;
      });
      if (clash) continue;

      placed.push({ lat: a.lat, lng: a.lng, text: name });
    }
    return placed;
  }, [countries, pins, altitude, pov]);

  // Fixed degrees of surface arc: the name is painted on the map, so it grows
  // as you come in and shrinks as you pull back, the way the coastline under
  // it does.
  //
  // It used to scale with altitude, on the reasoning that halving the height
  // doubles what a degree covers on screen. That is wrong — screen size goes
  // as 1/(1+altitude), not 1/altitude — so scaling the degrees as well made
  // names grow the further out you went: 10.9px pulled back and 4.9px up
  // close, which is backwards, and it was the far view that ended up crowded.
  //
  // Held constant, and calibrated against the screen rather than guessed at.
  //
  // Rendered height in pixels is 0.070 * labelSize * stageHeight / (1+alt) —
  // fitted to two measured renders, one at 0.62 on a world view and one at
  // 1.6 zoomed in, which agree on the constant to within 2%. My arithmetic
  // before that was out by a factor of two in the same direction both times,
  // which is why each "smaller" pass still came back too big: 1.6 was not the
  // 11px I claimed, it was 23px, larger than any type on the page.
  //
  // 0.75 puts a name at ~7px where names first appear and ~11px at the
  // closest the camera goes. Small enough to be scenery on arrival, ordinary
  // by the time somebody is actually reading a region.
  const labelSize = 0.75;

  /**
   * Zoom into a group — or, when zoom cannot help, hand it to the list.
   *
   * Zoom alone is not an answer to congestion. Measured on the real roster,
   * the two Brussels conservatories are 0.001° apart, about a hundred metres;
   * NEC and Berklee 0.004°; the three London schools inside 0.04°. No altitude
   * this globe can reach separates those, so a badge that only ever zoomed
   * would eventually stop responding and look broken.
   *
   * So it asks first: re-cluster these members at the altitude the zoom would
   * arrive at, and only fly there if that actually breaks them apart. When it
   * would not, the group opens in the list below the map, which can show
   * schools sharing a street as easily as schools sharing a continent.
   */
  function handleCluster(d) {
    const g = globeRef.current;
    if (!g) return;
    const target = Math.max(GLOBE_MIN_ALTITUDE, altitude * 0.42);
    const wouldSplit = clusterPins(d.members, target, null).length > 1;
    if (!wouldSplit) { onCluster && onCluster(d.members); return; }
    const c = g.controls();
    if (c) c.autoRotate = false;
    g.pointOfView({ lat: d.lat, lng: d.lng, altitude: target }, 700);
  }

  return (
    <div ref={wrapRef} style={{ width: "100%", height, position: "relative" }}>
      {w > 0 && h > 0 && (
        <Suspense fallback={null}>
          <Globe
            ref={globeRef}
            width={w}
            height={h}
            onGlobeReady={() => setReady(true)}
            onZoom={(pov) => {
              // Two decimal places: enough to re-cluster when the view really
              // changes, coarse enough not to thrash React while dragging.
              const a = Math.round(pov.altitude * 100) / 100;
              setAltitude((prev) => (Math.abs(prev - a) > 0.005 ? a : prev));
              const lat = Math.round(pov.lat * 10) / 10;
              const lng = Math.round(pov.lng * 10) / 10;
              setPov((prev) => (prev.lat !== lat || prev.lng !== lng ? { lat, lng } : prev));
            }}
            // 4096x2048 Blue Marble against the 2048x1024 that was here: at
            // the altitudes zoom now reaches, the old one ran out of pixels
            // before the camera ran out of travel, and the earth went soft
            // exactly where somebody had gone looking for detail.
            globeImageUrl="/earth-blue-marble.jpg"
            // Relief. A height map costs one texture and does what no amount
            // of resolution does on its own — the Andes, the Himalaya and the
            // Atlas catch the light and the sphere stops reading as a printed
            // ball.
            bumpImageUrl="/earth-topology.png"
            backgroundColor="rgba(0,0,0,0)"
            atmosphereColor="#EFD09B"
            atmosphereAltitude={0.17}
            // Borders in the same champagne as everything else, and no fill:
            // a filled country would sit over the satellite image, which is
            // the thing worth looking at.
            polygonsData={countries}
            polygonAltitude={0.004}
            polygonCapColor={() => "rgba(0,0,0,0)"}
            polygonSideColor={() => "rgba(0,0,0,0)"}
            polygonStrokeColor={() => "rgba(239,208,155,0.55)"}
            polygonsTransitionDuration={0}
            // Names, biggest country first, more of them the closer you get.
            labelsData={labels}
            labelLat="lat"
            labelLng="lng"
            labelText="text"
            labelSize={labelSize}
            labelDotRadius={0}
            labelIncludeDot={false}
            labelColor={() => "rgba(255,247,230,0.82)"}
            labelResolution={2}
            labelAltitude={0.008}
            labelsTransitionDuration={0}
            htmlElementsData={marks}
            htmlLat="lat"
            htmlLng="lng"
            htmlAltitude={0.012}
            htmlTransitionDuration={0}
            htmlElement={(d) => {
              const el = document.createElement("div");
              el.style.cssText = "cursor:pointer;pointer-events:auto;transform:translate(-50%,-100%);";
              if (roaming) el.className = "artium-roampin";

              if (d.kind === "cluster") {
                // A disc, not a pin: it marks an area rather than a place, and
                // a pin's point would be claiming a precision it does not have.
                const size = Math.round(Math.min(40, 24 + d.schools * 0.7) * pinScale);
                el.title = `${d.schools} conservatories, ${d.count} student${d.count === 1 ? "" : "s"} — click to open`;
                el.style.transform = "translate(-50%,-50%)";
                el.innerHTML = `
                  <div style="
                    width:${size}px;height:${size}px;border-radius:50%;
                    display:flex;align-items:center;justify-content:center;
                    background:radial-gradient(circle at 38% 32%, #F6E3BC, #D5A860);
                    border:1.5px solid rgba(255,255,255,0.55);
                    box-shadow:0 0 0 ${Math.round(size * 0.16)}px rgba(239,208,155,0.16), 0 3px 10px rgba(0,0,0,0.55);
                    color:#241A0E;font-family:'Manrope',sans-serif;
                    font-size:${Math.round(size * 0.38)}px;font-weight:800;line-height:1;
                  ">${d.schools}</div>`;
                el.onclick = () => handleCluster(d);
                return el;
              }

              el.title = d.count == null ? d.name : `${d.name} — ${d.count} student${d.count === 1 ? "" : "s"}`;
              const on = d.id === selectedId;
              const size = Math.round((on ? 26 : 21) * pinScale);
              // The gate's pin, at map scale: solid champagne with the window
              // punched through by evenodd.
              el.innerHTML = `
                <svg width="${size}" height="${size * 1.32}" viewBox="0 0 28 37" style="display:block;filter:drop-shadow(0 2px 6px rgba(0,0,0,.6))">
                  <path fill-rule="evenodd" fill="${on ? "#FFFFFF" : "#EFD09B"}"
                    d="M14 .9C6.82.9 1.4 6.28 1.4 13.2c0 3.35 1.3 6.36 3.2 9.36 1.6 2.53 3.63 5.02 5.53 7.62 1.35 1.85 2.6 3.72 3.28 5.98a.62.62 0 0 0 1.18 0c.68-2.26 1.93-4.13 3.28-5.98 1.9-2.6 3.93-5.09 5.53-7.62 1.9-3 3.2-6.01 3.2-9.36C26.6 6.28 21.18.9 14 .9zm0 7.68a5.04 5.04 0 1 0 0 10.08 5.04 5.04 0 0 0 0-10.08z" />
                </svg>`;
              el.onclick = () => onSelect(d.id);
              return el;
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

/**
 * A teacher, as a row. Deliberately the same object the conservatory roster
 * uses — avatar, name, a line of facts, the instrument drawn, a chevron — so
 * the two halves of the app do not each invent their own idea of what a
 * person looks like in a list.
 *
 * What differs is the line: a student browsing the network wants the level
 * and year, a learner choosing a teacher wants the price and whether it is
 * online. That is the whole difference, so that is all that changes.
 */
function TeacherRow({ t, onOpen }) {
  const c = findConservatory(t.conservatoryId);
  const icons = instrumentIcons(t);
  const terms = [teachingModeLabel(t.teaching?.mode), c ? c.city : ""].filter(Boolean).join(" · ");
  return (
    <button className="artium-aw-row" onClick={onOpen}>
      <span style={{ flexShrink: 0 }}>
        <Avatar name={t.name} id={t.id} size={42} photoUrl={t.photoUrl} online={t.online} />
      </span>
      <span className="artium-aw-row-body">
        <p className="artium-aw-row-t" style={{ fontSize: 15 }}>{t.name}</p>
        <p className="artium-aw-row-c">
          {t.teaching?.price && <span className="artium-aw-teach">€{t.teaching.price}</span>}
          {terms}
        </p>
      </span>
      {icons.length > 0 && (
        <span className="artium-aw-inst" data-two={icons.length > 1 ? "1" : "0"}>
          <span className="artium-aw-inst-art" aria-hidden="true">
            {icons.map((icon) => <img key={icon} src={`/instruments/${icon}.webp`} alt="" loading="lazy" />)}
          </span>
          <span className="artium-aw-inst-name">{instrumentLabel(t)}</span>
        </span>
      )}
      <ChevronRight size={17} strokeWidth={2} />
    </button>
  );
}

// A monogram for the row tiles. "short" exists on the built-in schools; the
// admin-approved ones carry only a full name, and slicing the first three
// characters off "Conservatoire a rayonnement regional de Lyon" gives "Con"
// — or, with the accent, a single stray letter. Initials of the words that
// carry meaning read as a crest instead.
const MONO_SKIP = new Set(["de","du","des","la","le","les","of","the","and","a","an","and","for","el","di","der","das","und","musik","music","school","institute","conservatory","conservatoire","conservatorium","academy"]);
function consMonogram(c) {
  if (c.short) return c.short;
  const words = String(c.name || "").split(/[\s\-']+/).filter(Boolean);
  const keep = words.filter((w) => !MONO_SKIP.has(w.toLowerCase().replace(/[^a-z]/g, "")));
  const src = keep.length ? keep : words;
  const initials = src.map((w) => w[0]).join("").toUpperCase().slice(0, 4);
  return initials || "—";
}

/* The conservatory's real face: a photograph fetched from its Wikipedia
   page (public/cons/<id>.jpg, 109 schools covered at build time), shown in
   the monogram tile's exact footprint; if an id has no photo — a future
   school, a failed load — the old text monogram steps back in. */
function ConsAvatar({ cons }) {
  const [broken, setBroken] = React.useState(false);
  if (!cons?.id || broken) {
    return <span className="artium-aw-mono">{consMonogram(cons || {})}</span>;
  }
  return (
    <span className="artium-aw-mono" style={{ padding: 0 }}>
      <img
        src={`/cons/${cons.id}.jpg`}
        alt=""
        loading="lazy"
        onError={() => setBroken(true)}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", borderRadius: 9 }}
      />
    </span>
  );
}

function MapScreen({ students, studentsByCons, selectedConsId, setSelectedConsId, onOpenStudent, isGuest, onGuestClick, canViewRoster, extraCons = [] }) {
  const ALL_CONS = React.useMemo(() => [...CONSERVATORIES, ...extraCons], [extraCons]);
  const cons = ALL_CONS.find((c) => c.id === selectedConsId);
  const roster = selectedConsId ? studentsByCons[selectedConsId] || [] : [];
  const [q, setQ] = useState("");
  // Off by default: the reference lists the schools in their own order, and
  // sorting alphabetically by country buries the well-known ones behind
  // whichever country happens to start with an A.
  // The schools behind one badge on the globe, when zooming could not tell
  // them apart. Brussels' two conservatories are a hundred metres from each
  // other; no altitude separates them, but a list has no trouble at all.
  const [areaIds, setAreaIds] = useState(null);

  const allStudents = Object.values(studentsByCons).flat();
  const teacherCount = allStudents.filter((s) => s.teaching && s.teaching.open).length;

  // Only geocoded schools can be pinned; the rest would land at 0,0 in the
  // Gulf of Guinea. Pins are the schools that actually have someone on them.
  const pins = React.useMemo(() => ALL_CONS
    .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng) && (studentsByCons[c.id] || []).length > 0)
    .map((c) => ({ ...c, count: (studentsByCons[c.id] || []).length })), [ALL_CONS, studentsByCons]);

  const rows = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    // Always every conservatory now — Teaching Opportunities was the only
    // other mode, and it lived here for the conservatory students' own
    // network page. It never touched the learner's "Find a teacher" screen,
    // which is its own component (LearnerScreen) with its own teacher-only
    // list, so removing it here is safe to do in just this one place.
    let list = ALL_CONS;
    if (areaIds) {
      const keep = new Set(areaIds);
      list = list.filter((c) => keep.has(c.id));
    }
    if (needle) {
      list = list.filter((c) => `${c.name} ${c.city || ""} ${c.country || ""}`.toLowerCase().includes(needle));
    }
    // Schools with students rise to the top; the empty ones keep their
    // order below. Two filters rather than a sort comparator so the
    // original ordering inside each group is untouched.
    const populated = list.filter((c) => (studentsByCons[c.id] || []).length > 0);
    const empty = list.filter((c) => (studentsByCons[c.id] || []).length === 0);
    return [...populated, ...empty];
  }, [ALL_CONS, studentsByCons, q, areaIds]);

  const nf = (n) => n.toLocaleString();

  return (
    <div className="artium-aw">
      <div className="artium-aw-in">
        <p className="artium-aw-eyebrow"><i />The Artium Network<i /></p>
        <h1 className="artium-aw-h1">Bridging Musicians<br />Worldwide</h1>

        <div className="artium-aw-stage">
          <span className="artium-aw-glow" aria-hidden="true" />
          <span className="artium-aw-ring artium-aw-ring--a" aria-hidden="true" />
          <span className="artium-aw-ring artium-aw-ring--b" aria-hidden="true" />
          <WorldGlobe pins={pins} selectedId={selectedConsId} onSelect={setSelectedConsId}
            onCluster={(members) => { setSelectedConsId(null); setAreaIds(members.map((m) => m.id)); }}
            height={300} />
        </div>

        <div className="artium-aw-stats">
          <div className="artium-aw-stat">
            <span className="artium-aw-stat-row">
              <span className="artium-aw-stat-tile"><MapPin size={16} strokeWidth={2} /></span>
              <span className="artium-aw-stat-n">{nf(ALL_CONS.length)}</span>
            </span>
            <p className="artium-aw-stat-l">Conservatories</p>
          </div>
          <div className="artium-aw-stat">
            <span className="artium-aw-stat-row">
              <span className="artium-aw-stat-tile"><GraduationCap size={17} strokeWidth={2} /></span>
              <span className="artium-aw-stat-n">{nf(allStudents.length)}</span>
            </span>
            <p className="artium-aw-stat-l">Students</p>
          </div>
          <div className="artium-aw-stat">
            <span className="artium-aw-stat-row">
              <span className="artium-aw-stat-tile"><IconTeacher size={16} /></span>
              <span className="artium-aw-stat-n">{nf(teacherCount)}</span>
            </span>
            <p className="artium-aw-stat-l">Open to teaching</p>
          </div>
        </div>

        {/* The slab the mock draws under the stats — a compass, and the
            page's own copy for what the globe above is for. Replaces the
            old plain caption in exactly this one spot. */}
        <div className="artium-aw-explore">
          <span className="artium-aw-explore-tile"><Compass size={18} strokeWidth={1.8} /></span>
          <span className="artium-aw-explore-copy">
            <b>Explore the world and connect with talent.</b>
            <span>Tap a pin on the map to discover who's studying nearby.</span>
          </span>
        </div>

        {cons ? (
          <>
            <div className="artium-aw-listhead">
              <button className="artium-aw-sort" style={{ marginLeft: 0 }} onClick={() => setSelectedConsId(null)}>
                <ArrowLeft size={13} /> All conservatories
              </button>
            </div>
            <div className="artium-aw-row" style={{ cursor: "default", marginBottom: 12 }}>
              <ConsAvatar cons={cons} />
              <span className="artium-aw-row-body">
                <p className="artium-aw-row-t" style={{ fontSize: 13, fontFamily: "'Libre Baskerville', serif", fontWeight: 700 }}>{cons.name}</p>
                <p className="artium-aw-row-c" style={{ fontSize: 14 }}><span aria-hidden="true" style={{ fontSize: 11, lineHeight: 1 }}>{"\uD83D\uDCCD"}</span>{[cons.city, cons.country].filter(Boolean).join(", ")}</p>
              </span>
              <span className="artium-aw-badge"><b>{roster.length}</b><span>student{roster.length === 1 ? "" : "s"}</span></span>
            </div>
            <div className="artium-aw-list">
              {roster.length === 0 && <p className="artium-aw-empty">No students from this conservatory yet.</p>}
              {roster.map((st) => (
                <button key={st.id} className="artium-aw-row" onClick={() => { if (isGuest) { onGuestClick(); return; } onOpenStudent(st.id); }}>
                  <span style={{ filter: isGuest && st.id !== "me" ? "blur(4px)" : "none", pointerEvents: "none", flexShrink: 0 }}>
                    <Avatar name={st.name} id={st.id} size={42} photoUrl={st.photoUrl} online={st.online} />
                  </span>
                  <span className="artium-aw-row-body">
                    <p className="artium-aw-row-t" style={{ fontSize: 15, filter: isGuest && st.id !== "me" ? "blur(5px)" : "none" }}>
                      {st.name}{st.id === "me" && <span style={{ color: "#E6DAB0" }}> (you)</span>}
                    </p>
                    <p className="artium-aw-row-c" style={{ filter: isGuest && st.id !== "me" ? "blur(4px)" : "none" }}>
                      {/* Ahead of the year, because it is the only thing in the
                          line somebody might be scanning the roster to find.
                          Teaching is an offer, not a detail. */}
                      {st.teaching?.open && <span className="artium-aw-teach">Teaches</span>}
                      {/* Where two favourite composers used to sit. They were
                          the same handful of names down the whole roster —
                          Chopin, Ravel, Debussy — so they separated nobody.
                          Level and year do: it is how a student reads another
                          student, and it is already one phrase. */}
                      {st.year}
                    </p>
                  </span>
                  {/* The drawing, not the word: at a glance down the roster the
                      instrument is what you are scanning for, and the sheet
                      already draws all of them. The name stays on the profile
                      the row opens.

                      Two shrink to sit side by side rather than one being
                      chosen over the other — data-two is what does it, so a
                      single instrument keeps the size it has here today. */}
                  {instrumentIcons(st).length > 0 && (
                    <span className="artium-aw-inst" data-two={instrumentIcons(st).length > 1 ? "1" : "0"}>
                      <span className="artium-aw-inst-art" aria-hidden="true">
                        {instrumentIcons(st).map((icon) => (
                          <img key={icon} src={`/instruments/${icon}.webp`} alt="" loading="lazy" />
                        ))}
                      </span>
                      {/* The drawing is what the eye lands on; the word is what
                          settles it. A cornet and a trumpet are the same
                          silhouette at this size, and a marimba and a xylophone
                          are the same drawing twice. */}
                      <span className="artium-aw-inst-name">{instrumentLabel(st)}</span>
                    </span>
                  )}
                  <ChevronRight size={17} strokeWidth={2} />
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            {areaIds && (
              <div className="artium-aw-listhead">
                <button className="artium-aw-sort" style={{ marginLeft: 0 }} onClick={() => setAreaIds(null)}>
                  <ArrowLeft size={13} /> All conservatories
                </button>
                <span>{areaIds.length} in this area</span>
              </div>
            )}
            {/* Search lives here now, beside the heading it actually filters
                — not floating above the page where it kept rendering (and
                looking clickable) over the roster view below, which never
                read it. The old text "Country" toggle and the round sort
                button beside the field are both gone at the user's request. */}
            <div className="artium-aw-listhead">
              {/* The heading is gone at the user's request — the search
                  field owns the whole row now. */}
              <span className="artium-aw-field">
                <Search size={16} strokeWidth={2} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search for a conservatory or city..." />
              </span>
            </div>
            <div className="artium-aw-list">
              {rows.length === 0 && (
                <p className="artium-aw-empty">No conservatory matches that search.</p>
              )}
              {rows.map((c) => {
                const n = (studentsByCons[c.id] || []).length;
                return (
                  <button key={c.id} className="artium-aw-row" onClick={() => setSelectedConsId(c.id)}>
                    <ConsAvatar cons={c} />
                    <span className="artium-aw-row-body">
                      <p className="artium-aw-row-t" style={{ fontSize: 13, fontFamily: "'Libre Baskerville', serif", fontWeight: 700 }}>{c.name}</p>
                      <p className="artium-aw-row-c" style={{ fontSize: 14 }}><span aria-hidden="true" style={{ fontSize: 11, lineHeight: 1 }}>{"\uD83D\uDCCD"}</span>{[c.city, c.country].filter(Boolean).join(", ")}</p>
                    </span>
                    <span className="artium-aw-badge"><b>{n}</b><span>student{n === 1 ? "" : "s"}</span></span>
                    <ChevronRight size={17} strokeWidth={2} />
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

    </div>
  );
}

/* ---------------------------------------------------------------- */
/* BOTTOM TABS                                                         */
/* ---------------------------------------------------------------- */
/**
 * The app's one navigation, drawn on every screen but the entry gate.
 *
 * It began inside the Network page as that page's own bottom bar, which meant
 * the rest of the app navigated by a strip of text tabs under the header and
 * the two never agreed on where you were. Lifting it out is the whole point:
 * one bar, one active state, in the same place on every screen.
 *
 * Not on the gate, and not in the signup flow or the login screen — those are
 * one-way funnels that carry their own Back/Next footer at the bottom of the
 * screen, and a second bar under it would be two answers to "what now".
 *
 * Saved is gone. It was drawn from the reference and never had a feature
 * behind it, so it was a fifth of the bar that did nothing when pressed.
 * Promote and Lessons take the space, since those were reachable only from
 * the strip that this replaces.
 */
function BottomTabs({ items, active, onTab, light }) {
  return (
    <nav className={`artium-aw-tabs${light ? " artium-aw-tabs--light" : ""}`}>
      {items.map(({ k, label, Icon, attention }) => (
        <button key={k} data-on={k === active ? "1" : "0"} onClick={() => onTab(k)} aria-label={label}>
          <span style={{ position: "relative", display: "inline-flex" }}>
            <Icon size={19} strokeWidth={1.7} />
            {/* A booking waiting on a signature, or an offer waiting on a
                response, is the one thing on this tab that costs something if
                it sits — everything else can wait for a visit. */}
            {attention && (
              <span style={{ position: "absolute", top: -2, right: -3, width: 8, height: 8, borderRadius: "50%", background: C.brass, border: `1.5px solid ${C.ink}` }} />
            )}
          </span>
          {label}
        </button>
      ))}
    </nav>
  );
}

// Short labels deliberately. Six tabs share 375px on a narrow phone —
// seven for a pianist, who also carries Concerts — so
// "Promote Me" and "Lesson Room" would wrap to two lines and make the bar
// taller than the content it sits under. Admin stays on the header strip:
// it belongs to two people, not to the bar everybody sees.
const STUDENT_TABS = [
  { k: "home", label: "Home", Icon: Home },
  { k: "map", label: "Network", Icon: Globe2 },
  { k: "messages", label: "Messages", Icon: MessageCircle },
  { k: "promote", label: "Promote", Icon: Megaphone },
  { k: "lessons", label: "Lessons", Icon: BookOpen },
  { k: "profile", label: "Profile", Icon: User },
];

// A guest has no messages and no profile, so the bar does not offer them.
// What is left is the two things they can actually do, which is also the
// honest shape of the app before signing up.
const GUEST_TABS = [
  { k: "home", label: "Home", Icon: Home },
  { k: "map", label: "Network", Icon: Globe2 },
];

/* ---------------------------------------------------------------- */
/* STUDENT PROFILE                                                     */
/* ---------------------------------------------------------------- */
/**
 * The four places a student can be found.
 *
 * It used to be one field asking for a performance video, which accepted only
 * Instagram, Facebook or YouTube — so somebody with an Instagram account and
 * a YouTube channel had to pick one, and somebody with a website had nowhere
 * to put it. And it asked for a video, which is a post; these ask for the
 * person.
 *
 * `host` is what the value must contain to be that platform, so a YouTube URL
 * pasted into the Instagram field is caught where it is typed rather than
 * silently sending visitors somewhere unexpected. Website takes anything that
 * looks like a domain, because that is the whole point of it.
 */
const LINK_FIELDS = [
  { key: "instagram", label: "Instagram", Icon: Instagram, placeholder: "instagram.com/yourhandle",   host: /instagram\.com/i },
  { key: "facebook",  label: "Facebook",  Icon: Facebook,  placeholder: "facebook.com/yourpage",      host: /facebook\.com|fb\.(com|watch|me)/i },
  { key: "youtube",   label: "YouTube",   Icon: Youtube,   placeholder: "youtube.com/@yourchannel",   host: /youtube\.com|youtu\.be/i },
  { key: "website",   label: "Website",   Icon: Globe2,    placeholder: "yourname.com",               host: /^[^\s]+\.[a-z]{2,}/i },
];

// People type "instagram.com/x", not "https://instagram.com/x". Without a
// scheme the browser reads it as a path and sends them to a page on artium.
function href(url) {
  const v = String(url || "").trim();
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

function linkFieldValid(field, value) {
  const v = String(value || "").trim();
  if (!v) return true;
  return field.host.test(v.replace(/^https?:\/\//i, ""));
}

/**
 * The links as a profile shows them: one row of named buttons, only for the
 * ones given. Named rather than bare icons — a row of glyphs makes the reader
 * decode four marks to find the one they want.
 */
function ProfileLinks({ links }) {
  const given = LINK_FIELDS.filter((f) => (links || {})[f.key]);
  if (given.length === 0) {
    return <p style={{ fontSize: 13, color: C.ivoryDim, marginBottom: 24 }}>No links shared.</p>;
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
      {given.map(({ key, label, Icon }) => (
        <a key={key} href={href(links[key])} target="_blank" rel="noreferrer"
          style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "8px 13px", borderRadius: 999,
            border: `1px solid ${C.inkLine}`, background: "rgba(176,146,98,0.05)",
            color: C.ivory, textDecoration: "none",
            fontFamily: FONT_BODY, fontSize: 13, fontWeight: 500,
          }}>
          <Icon size={14} strokeWidth={1.8} />
          {label}
        </a>
      ))}
    </div>
  );
}


function StudentProfile({ student, conservatory, onBack, onMessage, locked, onApply }) {
  if (!student) return null;

  const Row = ({ label, children }) => (
    <div style={{ background: "rgba(176,146,98,0.05)", border: `1px solid ${C.inkLine}`, borderRadius: 10, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: C.brassLabel, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
      <div style={{ fontSize: 15, color: C.ivory, lineHeight: 1.6 }}>{children}</div>
    </div>
  );

  const profileCards = (
    <>
      {/* Same two columns as the owner's own view: who they are on the left,
          the cover video on the right. One profile shape, whoever is reading. */}
      <div className="artium-pf-top" data-solo={student.coverVideoUrl ? "0" : "1"}>
      <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 28 }}>
        <div style={{ marginTop: 4 }}>
          <Avatar name={student.name} id={student.id} size={64} photoUrl={student.photoUrl} online={student.online} />
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.ivory, margin: 0, lineHeight: 1.3 }}>{student.name}</h2>
          <p style={{ fontSize: 13, color: C.ivoryDim, margin: "3px 0 0", lineHeight: 1.5 }}>
            {[instrumentLabel(student), student.year].filter(Boolean).join(" · ")}
          </p>
          {conservatory && <p style={{ fontSize: 13, color: C.ivoryDim, margin: "1px 0 0" }}>{conservatory.name}, {conservatory.city}</p>}
        </div>
        <div style={{ flexShrink: 0 }}>
          {locked ? (
            <PrimaryBtn onClick={onApply} icon={ArrowRight}>Sign up to message {student.name.split(" ")[0]}</PrimaryBtn>
          ) : onMessage ? (
            <PrimaryBtn onClick={onMessage} icon={MessageCircle}>Message</PrimaryBtn>
          ) : null}
        </div>
      </div>

      {student.bio && (
        <p style={{ fontSize: 15, color: C.ivoryDim, lineHeight: 1.75, marginBottom: 24 }}>{student.bio}</p>
      )}

      <ProfileLinks links={student.links} />
      </div>
      {student.coverVideoUrl && (
        <Row label="Cover video"><CoverVideo url={student.coverVideoUrl} /></Row>
      )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {(student.tastes || []).length > 0 && (
          <Row label="Musical preferences">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
              {student.tastes.map((t) => (
                <span key={t} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, border: `1px solid ${C.inkLine}`, color: C.ivory, background: C.inkSoft }}>{t}</span>
              ))}
            </div>
          </Row>
        )}
        {(student.pieces || []).length > 0 && (
          <Row label="Current repertoire">
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
              {student.pieces.map((p, i) => (
                <div key={i} style={{ fontSize: 14, color: C.ivory }}>
                  <span style={{ fontWeight: 600 }}>{p.title}</span>
                  <span style={{ color: C.ivoryDim }}> — {p.composer}</span>
                </div>
              ))}
            </div>
          </Row>
        )}
        {student.top && <Row label="Recent win">{student.top}</Row>}
        {student.flop && <Row label="Current challenge">{student.flop}</Row>}
        <Row label="Teaching"><TeachingCell teaching={student.teaching} /></Row>
        {student.composerDay && <Row label="A day with a composer">{student.composerDay}</Row>}
      </div>
    </>
  );

  // The cover photo used to make this a split page: a tall image pinned down
  // one side and the cards squeezed into what was left. The video sits in the
  // column instead, above the cards, so there is one profile layout rather
  // than two depending on what somebody uploaded.
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px" }}>
      {profileCards}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* MY PROFILE                                                         */
/* ---------------------------------------------------------------- */
function MyProfile({ profile, onEdit, onLogout, onDeleteAccount, onBack, onUpdateCoverVideo }) {
  const cons = findConservatory(profile.conservatoryId);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const Row = ({ label, children }) => (
    <div style={{ background: "rgba(176,146,98,0.05)", border: `1px solid ${C.inkLine}`, borderRadius: 10, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: C.brassLabel, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
      <div style={{ fontSize: 15, color: C.ivory, lineHeight: 1.6 }}>{children}</div>
    </div>
  );


  /* ── Cards column (shared between both layout variants) ── */
  const cards = (
    <>
      {/* The top of the page is two columns: who they are on the left, the
          cover video on the right, its column lined up with the repertoire
          card below it. The video is the largest thing on the profile and it
          reads as a header rather than as another fact about them. */}
      <div className="artium-pf-top">
      <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 16 }}>
          <div style={{ marginTop: 4 }}>
            <Avatar name={profile.name} id="me" size={64} photoUrl={profile.photoUrl} online />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: C.ivory, margin: 0, lineHeight: 1.3 }}>{profile.name}</h2>
            <p style={{ fontSize: 13, color: C.ivoryDim, margin: "3px 0 0", lineHeight: 1.5 }}>
              {[instrumentLabel(profile), profile.year].filter(Boolean).join(" · ")}
            </p>
            {cons && <p style={{ fontSize: 13, color: C.ivoryDim, margin: "1px 0 0" }}>{cons.name}, {cons.city}</p>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <GhostBtn onClick={onEdit} icon={Pencil}>Edit</GhostBtn>
          {onLogout && <GhostBtn onClick={onLogout}>Log out</GhostBtn>}
          {onDeleteAccount && !confirmDelete && (
            <GhostBtn onClick={() => setConfirmDelete(true)} style={{ color: "#c0392b", borderColor: "#c0392b" }}>Delete account</GhostBtn>
          )}
          {confirmDelete && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: C.ivoryDim }}>Are you sure?</span>
              <button onClick={async () => { setDeleting(true); await onDeleteAccount(); setDeleting(false); }} disabled={deleting}
                style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, fontWeight: 600, background: "#c0392b", color: "#fff", border: "none", cursor: "pointer", opacity: deleting ? 0.6 : 1 }}>
                {deleting ? "Deleting…" : "Yes, delete"}
              </button>
              <button onClick={() => setConfirmDelete(false)}
                style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, border: `1px solid ${C.inkLine}`, color: C.ivoryDim, background: "none", cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bio */}
      {profile.bio && (
        <p style={{ fontSize: 15, color: C.ivoryDim, lineHeight: 1.75, marginBottom: 24 }}>{profile.bio}</p>
      )}

      {/* Video link */}
      <ProfileLinks links={profile.links} />
      </div>
      <Row label="Cover video">
        <CoverVideoUpload
          value={profile.coverVideoUrl}
          onChange={(url) => onUpdateCoverVideo && onUpdateCoverVideo(url)}
          uploader={uploadCoverVideo}
        />
      </Row>
      </div>

      {/* Data grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {(profile.tastes || []).length > 0 && (
          <Row label="Musical preferences">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
              {profile.tastes.map((t) => (
                <span key={t} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, border: `1px solid ${C.inkLine}`, color: C.ivory, background: C.inkSoft }}>{t}</span>
              ))}
            </div>
          </Row>
        )}
        {(profile.pieces || []).length > 0 && (
          <Row label="Current repertoire">
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
              {profile.pieces.map((p, i) => (
                <div key={i} style={{ fontSize: 14, color: C.ivory }}>
                  <span style={{ fontWeight: 600 }}>{p.title}</span>
                  <span style={{ color: C.ivoryDim }}> — {p.composer}</span>
                </div>
              ))}
            </div>
          </Row>
        )}
        {profile.top && <Row label="Recent win">{profile.top}</Row>}
        {profile.flop && <Row label="Current challenge">{profile.flop}</Row>}
        <Row label="Teaching"><TeachingCell teaching={profile.teaching} /></Row>
        {profile.composerDay && <Row label="A day with a composer">{profile.composerDay}</Row>}
      </div>
    </>
  );

  // One column. The cover photo made this a split page — a tall image pinned
  // down the left and the cards crowded into what was left — and with the
  // photo gone there is nothing to pin. The video is a card in the grid now,
  // not chrome around it.
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>
      {cards}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* MESSAGES                                                            */
/* ---------------------------------------------------------------- */
function Messages({ students, conversations, activeChatId, setActiveChatId, onSend, onOpenProfile, myProfile, onBack }) {
  const ids = Object.keys(conversations);
  const active = students.find((s) => s.id === activeChatId);
  const [text, setText] = useState("");
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [conversations, activeChatId]);

  return (
    <div className="lg-split-chat h-full" style={{ minHeight: 520 }}>
      <div className="lg-scroll overflow-y-auto" style={{ borderRight: `1px solid ${C.inkLine}` }}>
        <div className="px-5 pt-5 pb-2">
          <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.ivoryDim }}>CONVERSATIONS</p>
        </div>
        {ids.length === 0 && <p className="px-5 text-sm" style={{ color: C.ivoryDim }}>Message someone from the map to start a thread.</p>}
        {ids.map((id) => {
          const s = students.find((st) => st.id === id);
          if (!s) return null;
          const last = conversations[id][conversations[id].length - 1];
          return (
            <button key={id} onClick={() => setActiveChatId(id)} className="w-full text-left flex items-center gap-3 px-5 py-3" style={{ background: activeChatId === id ? "rgba(201,162,75,0.08)" : "transparent" }}>
              <Avatar name={s.name} id={s.id} size={38} photoUrl={s.photoUrl} online={s.online} />
              <div className="min-w-0 flex-1">
                <p style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</p>
                <p className="truncate" style={{ fontSize: 11, color: C.ivoryDim }}>{last ? last.text : "Say hello"}</p>
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex flex-col">
        {!active ? (
          <div className="flex-1 flex items-center justify-center"><p style={{ color: C.ivoryDim, fontSize: 13 }}>Select a conversation</p></div>
        ) : (
          <>
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${C.inkLine}` }}>
              <div className="flex items-center gap-3">
                <button onClick={() => setActiveChatId(null)} className="text-xs flex items-center gap-1" style={{ color: C.ivoryDim }}><ArrowLeft size={13} /> Back</button>
                <button onClick={() => onOpenProfile(active.id)} className="flex items-center gap-3">
                  <Avatar name={active.name} id={active.id} size={34} photoUrl={active.photoUrl} online={active.online} />
                  <p style={{ fontSize: 14, fontWeight: 600 }}>{active.name}</p>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto lg-scroll px-5 py-4 flex flex-col gap-2">
              {(conversations[active.id] || []).map((m, i) => (
                <div key={i} className="px-4 py-2.5 rounded-2xl text-sm" style={{ maxWidth: "75%", alignSelf: m.from === "me" ? "flex-end" : "flex-start", background: m.from === "me" ? C.brass : C.inkSoft, color: m.from === "me" ? C.brassText : C.ivory, fontWeight: m.from === "me" ? 500 : 400 }}>
                  {m.text}
                </div>
              ))}
              <div ref={endRef} />
            </div>
            <div className="px-5 py-4 flex items-center gap-2" style={{ borderTop: `1px solid ${C.inkLine}` }}>
              <input
                style={{ ...inputStyle, flex: 1 }}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { onSend(text); setText(""); } }}
                placeholder={`Message ${active.name.split(" ")[0]}…`}
              />
              <button onClick={() => { onSend(text); setText(""); }} className="rounded-full p-3" style={{ background: C.brass }}><Send size={16} color={C.inkText} /></button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


/* ---------------------------------------------------------------- */
/* TEACHING + LEARNER MARKETPLACE                                     */
/* ---------------------------------------------------------------- */
function teachingModeLabel(mode) {
  return mode === "online" ? "Online lessons"
    : mode === "physical" ? "In-person lessons"
    : mode === "both" ? "Online & in-person"
    : "—";
}

// Which sample students offer lessons (seeded so the learner map isn't empty).
const TEACHING_SEED = {
  elise:  { open: true, mode: "both",     price: "45" },
  lukas:  { open: true, mode: "physical", price: "40" },
  polina: { open: true, mode: "online",   price: "60" },
  maya:   { open: true, mode: "both",     price: "70" },
  daniel: { open: true, mode: "physical", price: "38" },
  wei:    { open: true, mode: "online",   price: "32" },
  isla:   { open: true, mode: "both",     price: "50" },
  "demo-teacher": { open: true, mode: "online", price: "60" },
};
function seedTeaching(arr) {
  return arr.map((s) => ({
    ...s,
    // TEACHING_SEED wins, then any teaching declared on the student itself, so
    // fixtures can carry their own rates without a second lookup table.
    teaching: TEACHING_SEED[s.id] || s.teaching || { open: false, mode: "", price: "" },
  }));
}

// Pin a teacher at their conservatory's location, nudged a little so people
// at the same school don't land exactly on top of each other.
function teacherPin(student) {
  const cons = findConservatory(student.conservatoryId);
  if (!cons) return { x: 500, y: 230, cons: null };
  const h = String(student.id).split("").reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const jx = ((h % 7) - 3) * 4;
  const jy = (((h >> 2) % 7) - 3) * 4;
  return { x: cons.x + jx, y: cons.y + jy, cons };
}

/* ---- Student signup: teaching step ---- */
function StepTeaching({ draft, update }) {
  const t = draft.teaching;
  const setT = (partial) => update({ teaching: { ...t, ...partial } });
  return (
    <div>
      <p className="text-sm mb-6" style={{ color: C.ivoryDim, lineHeight: 1.6 }}>
        Artium also connects piano enthusiasts with conservatory students who teach.
        Let learners know whether you're available — and on your terms.
      </p>
      <Field label="Are you open to teaching?">
        <div className="flex flex-wrap gap-2">
          <Chip active={t.open} onClick={() => setT({ open: true })}>Yes, I'd like to teach</Chip>
          <Chip active={!t.open} onClick={() => setT({ open: false, mode: "", price: "" })}>Not right now</Chip>
        </div>
      </Field>
      {t.open && (
        <>
          <Field label="How do you teach?">
            <div className="flex flex-wrap gap-2">
              <Chip active={t.mode === "physical"} onClick={() => setT({ mode: "physical" })}>In person</Chip>
              <Chip active={t.mode === "online"} onClick={() => setT({ mode: "online" })}>Online</Chip>
              <Chip active={t.mode === "both"} onClick={() => setT({ mode: "both" })}>Both</Chip>
            </div>
          </Field>
          <Field label="Price per session (optional)">
            <div className="flex items-center gap-2">
              <span style={{ color: C.ivoryDim, fontSize: 16 }}>€</span>
              <input
                style={{ ...inputStyle, maxWidth: 160 }}
                value={t.price}
                onChange={(e) => setT({ price: e.target.value.replace(/[^0-9]/g, "") })}
                placeholder="e.g. 45"
                inputMode="numeric"
              />
              <span style={{ color: C.ivoryDim, fontSize: 13 }}>per session</span>
            </div>
          </Field>
          {/* Mode and price say what a lesson costs and where it happens.
              Neither says anything about the lesson, and a learner choosing
              between two pianists at €45 online has nothing to choose on.
              This is that. Asked as a question rather than labelled "bio",
              because "tell us about your teaching" produces a paragraph about
              the teacher and this produces one about the student's hour. */}
          <Field label="What would a first lesson with you be like?">
            <textarea
              style={{ ...inputStyle, resize: "vertical", minHeight: 96, lineHeight: 1.6 }}
              value={t.pitch || ""}
              maxLength={TEACHING_PITCH_MAX}
              onChange={(e) => setT({ pitch: e.target.value })}
              placeholder="How you teach, who you are good with, what you would start on. A learner is deciding whether to book you."
            />
            <p className="text-xs mt-1.5" style={{ color: C.ivoryDim, fontFamily: FONT_MONO }}>
              Optional · {(t.pitch || "").length}/{TEACHING_PITCH_MAX}
            </p>
          </Field>
        </>
      )}
    </div>
  );
}

/**
 * The dark-theme lockup: a pin and the wordmark, both gold. Its own component
 * rather than Logo with another tone, because Logo's disc is a filled brass
 * coin — right on a white header, a bright blot on a dark one.
 *
 * The ring is gone. It was a container for a mark that did not need one: the
 * pin already reads as a single closed silhouette, and the circle around it
 * only added a second, competing one. Without it the mark can be taller —
 * a pin is a vertical shape, and a circle was forcing it to be square.
 */
function GateLogo({ word = 27, markScale = 1.0 }) {
  // Optical centring, against the mark. align-items: center lands the word's
  // bounding box dead on the mark's centre — measured, it is exact — but the
  // box is not what the eye reads. "artium" is bottom-heavy: all of its mass
  // is in the x-height, with only the t's stem and the i's dot above. Its
  // centre of mass sits 0.089em below the box's centre, so geometric centring
  // makes it look like it has sagged. Raising it by that much aligns the
  // weight instead of the box.
  //
  // The figure is the vertical centroid of the rendered glyphs — drawn to a
  // canvas and weighted by coverage — not a number from the font's metrics,
  // which would not survive falling back to Didot or Georgia.
  const OPTICAL = -word * 0.089;
  const markH = word * 1.16 * markScale;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: Math.round(word * 0.30) }}>
      {/* Redrawn rather than rescaled. The old pin was a circle with a cone
          hung off it — a shoulder where the two met, and a point that arrived
          too abruptly. This one is a single continuous curve from the tip:
          the flanks leave the point at a shallower angle and only turn over
          near the crown, which is what gives a pin its drop shape instead of
          its balloon shape. The window is 0.40 of the head's width, the
          proportion the reference draws, and evenodd is what makes it a hole
          rather than a disc painted on top. */}
      <svg
        width={markH * 0.70} height={markH} viewBox="0 0 28 40"
        aria-hidden="true" style={{ display: "block", flexShrink: 0 }}
      >
        <path
          fillRule="evenodd"
          d="M14 0.9C6.82 0.9 1.4 6.28 1.4 13.2c0 3.35 1.3 6.36 3.2 9.36 1.6 2.53 3.63 5.02 5.53 7.62 1.35 1.85 2.6 3.72 3.28 5.98a.62.62 0 0 0 1.18 0c.68-2.26 1.93-4.13 3.28-5.98 1.9-2.6 3.93-5.09 5.53-7.62 1.9-3 3.2-6.01 3.2-9.36C26.6 6.28 21.18.9 14 .9zm0 7.68a5.04 5.04 0 1 0 0 10.08 5.04 5.04 0 0 0 0-10.08z"
          fill={GATE.gold}
        />
      </svg>
      {/* Deliberately not the shared Wordmark. That one is the brand lockup —
          heavy grotesque, negative tracking, crescendo hairpin — and it is
          correct everywhere else in the app. The gate is set in Cormorant, and
          the reference sets the word in the same serif as the headline with no
          hairpin under it, so it is drawn here rather than bent into shape
          through props. */}
      <span style={{
        fontFamily: GATE_SERIF, fontWeight: 600, fontSize: word,
        letterSpacing: word * 0.005, lineHeight: 1, color: GATE.gold,
        transform: `translateY(${OPTICAL.toFixed(2)}px)`,
      }}>artium</span>
    </span>
  );
}

/**
 * Everything behind the gate's content, all of it under 8%: two staves at
 * opposing angles, the conductor standing off the left edge, a few notes, a
 * drift of dust, and a film of grain over the lot. Inline positions rather
 * than classes — each element is placed once and never reused, so a rule per
 * item would be a rule read once.
 */
function GateBackdrop({ photo }) {
  // Spread across the width, each on its own clock so they never pulse
  // together — the give-away that dust is really a loop.
  const dust = [
    { left: "12%", dur: 34, delay: 0, size: 3 },
    { left: "28%", dur: 46, delay: 6, size: 2 },
    { left: "47%", dur: 39, delay: 14, size: 3 },
    { left: "63%", dur: 52, delay: 3, size: 2 },
    { left: "78%", dur: 42, delay: 19, size: 3 },
    { left: "91%", dur: 48, delay: 11, size: 2 },
  ];
  return (
    <div className="artium-gx-bd" aria-hidden="true" style={photo ? { "--gx-photo": `url('${photo}')` } : undefined}>
      <div className="artium-gx-photo" />
      <div className="artium-gx-scrim" />
      {dust.map((d) => (
        <span key={d.left} className="artium-gx-dust"
          style={{ left: d.left, bottom: "-6px", width: d.size, height: d.size,
                   animationDuration: `${d.dur}s`, animationDelay: `-${d.delay}s` }} />
      ))}
      <div className="artium-gx-grain" />
    </div>
  );
}

/**
 * A circle card in the entry gate: everything — icon, serif title, a line of
 * copy, the filled arrow — lives inside the circle, and the whole circle is
 * the button. hero renders the lit student ellipse; the rest are the dialled
 * side medallions. The copy has a budget: a circle's usable width collapses
 * away from its diameter, so descriptions stay to two short clauses.
 */
function GateCircle({ onClick, icon, eyebrow, title, desc, step, hero, side }) {
  return (
    <button
      onClick={onClick}
      className={`artium-gx-cc ${hero ? "artium-gx-cc--hero" : `artium-gx-cc--side artium-gx-cc--${side}`} artium-gx-in artium-gx-in--${step}`}
    >
      {icon}
      {eyebrow && <span className="artium-gx-cc-eyebrow">{eyebrow}</span>}
      <span className="artium-gx-cc-title">{title}</span>
      {!hero && <span className="artium-gx-cc-rule" aria-hidden="true"><i /><b /><i /></span>}
      <span className="artium-gx-cc-desc">{desc}</span>
      <span className="artium-gx-go" aria-hidden="true">
        <ArrowRight strokeWidth={2.1} />
      </span>
    </button>
  );
}

function EntryGate({ onLearner, onStudent, onPianist, onLogin, learnerProfile, learnerLoggedOut, studentLoggedIn, musicOn, onMusicToggle, memberCount }) {
  const singleCard = !!learnerProfile || learnerLoggedOut || studentLoggedIn;
  const showLearner = !studentLoggedIn;
  const showStudent = !singleCard || studentLoggedIn;
  // The full trio only in the fresh state. In every reduced state — a learner
  // profile on this device, a logged-out learner, a signed-in student — the
  // gate collapses to the one card that continues their story.
  const fullTrio = showLearner && showStudent && !singleCard;

  // The conductor is the logo's own mark, painted through a mask rather than
  // drawn: it arrives as artwork with its own colours, and here it has to be
  // gold like everything else.
  const conductor = (
    <span
      className="artium-gx-cc-mark"
      style={{
        aspectRatio: "34 / 41", backgroundColor: GATE.gold,
        WebkitMaskImage: `url('${TEACHER_MARK}')`, maskImage: `url('${TEACHER_MARK}')`,
        WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
        WebkitMaskSize: "contain", maskSize: "contain",
        WebkitMaskPosition: "center", maskPosition: "center",
      }}
    />
  );
  // Drawn, not lucide's GraduationCap. The reference cap is a solid silhouette
  // and lucide's is an outline — and an outline path filled in collapses into
  // a blot, because its shape is the stroke's centreline, not the form. Board,
  // crown and tassel as three filled pieces.
  const cap = (
    <svg className="artium-gx-cc-mark" viewBox="0 0 24 24" aria-hidden="true" style={{ aspectRatio: "1" }}>
      <path d="M12 3.4 23 8.7 12 14 1 8.7z" fill={GATE.gold} />
      <path d="M6.6 11.05 12 13.65l5.4-2.6v4.02c0 .43-.26.82-.7 1.08-1.1.66-2.79 1.05-4.7 1.05s-3.6-.39-4.7-1.05c-.44-.26-.7-.65-.7-1.08z" fill={GATE.gold} />
      <path d="M20.7 10.15a.62.62 0 0 1 .62.62v4.06a.62.62 0 0 1-1.24 0v-4.06c0-.34.28-.62.62-.62z" fill={GATE.gold} />
      <circle cx="20.7" cy="16.1" r="1.15" fill={GATE.gold} />
    </svg>
  );
  // A grand piano in silhouette, side on with the lid up — the reference's
  // mark for the concert card. Filled pieces like the cap: rim, raised lid,
  // keybed and three legs, so it reads at 40px where an outline would fuzz.
  const piano = (
    <svg className="artium-gx-cc-mark" viewBox="0 0 100 107" aria-hidden="true" style={{ aspectRatio: "100 / 107" }}>
      <g fill={GATE.gold}>
        {/* Traced row by row off the reference. Two things this kept getting
            wrong: the lid and the case are separate planes with ground
            between them, and the prop is a dark line CUT THROUGH the lid,
            not a gold one laid over it — hence evenodd and the second
            subpath. The lid's apex is at the top right and it widens
            down-left; the bent side bulges to x=93 around a third of the way
            down, which is what makes it a grand rather than a wedge. */}
        <path
          fillRule="evenodd"
          d="M70 19.5 85.5 19.5C90 21 93.5 28 93.5 37c0 8-4.5 14.5-11.5 17.5L76 56.5 23 58.5zM69.3 26.5 71.8 26.5 77.3 50 74.8 50z"
        />
        {/* the case: rounded keyboard end at the left, tail sweeping right */}
        <path d="M18 66c0-4.5 3-7 7-7h49c8 0 15 2.5 20 7 3.5 3 5 6 3.5 8-1.5 2.2-5.5 2.5-9.5 2.5L26 77c-5 0-8-3-8-7z" />
        {/* four legs, the nearer ones longer, on castors */}
        <path d="M29 76.5h4.2V95H29zM45 76.5h5v20h-5zM67 76.5h6v26h-6zM89.5 74h3v18h-3z" />
        <rect x="27.4" y="93" width="7.4" height="2.5" rx="1.25" />
        <rect x="42.6" y="94.6" width="9.8" height="2.6" rx="1.3" />
        <rect x="64.6" y="100.8" width="10.8" height="2.8" rx="1.4" />
      </g>
    </svg>
  );

  return (
    <div className="artium-gx">
      <GateBackdrop />

      <header className="artium-gx-bar artium-gx-in artium-gx-in--1">
        {/* 30 is 27 plus 12%. The ring stays at the 34 that already matched. */}
        <GateLogo word={30} />
        <div className="artium-gx-bar-right">
          <MusicBtn playing={musicOn} onToggle={onMusicToggle} />
          {memberCount != null && (
            <span className="artium-gx-count">
              <Users size={17} strokeWidth={1.8} />
              {memberCount}
            </span>
          )}
        </div>
      </header>

      <main className="artium-gx-main">
        <p className="artium-gx-eyebrow artium-gx-in artium-gx-in--1">Welcome to Artium</p>
        <h1 className="artium-gx-h1 artium-gx-in artium-gx-in--2">Your Classical<br />Music World</h1>
        <p className="artium-gx-tag artium-gx-in artium-gx-in--3">Connect. Learn. Elevate.</p>

        <div className="artium-gx-rule artium-gx-in artium-gx-in--3" aria-hidden="true">
          <span /><i /><span />
        </div>

        {/* Three audiences now: students in the lit centre, and the two ways
            in from outside — learning from them, hiring them — either side.
            The stem above the centre (bust, dashed drop) is the reference's
            way of saying "this one is you". */}
        <div className="artium-gx-stage artium-gx-in artium-gx-in--4">
          {fullTrio && (
            <>
              {/* The orbit the composition hangs from. Its top carries the
                  node, its foot the closing dot, and the two dots mark where
                  it passes behind the flanking circles. */}
              <svg className="artium-gx-orbit" viewBox="0 0 100 100" aria-hidden="true">
                {/* Both arcs end exactly where the orbit meets a flank's rim,
                    which is where the reference puts the dots. */}
                <path d="M 5.86 26.52 A 50 50 0 0 1 94.14 26.52" />
                <path d="M 89.20 81.04 A 50 50 0 0 1 10.80 81.04" />
              </svg>
              <span className="artium-gx-dot" style={{ left: "25.07%", top: "29.20%" }} aria-hidden="true" />
              <span className="artium-gx-dot" style={{ left: "74.93%", top: "29.20%" }} aria-hidden="true" />
              <span className="artium-gx-dot" style={{ left: "50%", top: "98.90%" }} aria-hidden="true" />
              <span className="artium-gx-node" aria-hidden="true">
                {/* Solid, not stroked: at 18px a two-line outline reads as a
                    smudge, and this mark is a full stop on the orbit. */}
                <svg viewBox="0 0 24 24" fill="currentColor">
                  {/* Traced off the reference at 5x. The body is an oval — 42
                      wide by 25 tall there, widest across its middle and
                      tapering at both ends — not the arch with a flat foot
                      this had. There is clear ground between it and the head,
                      and the pair fills about four fifths of the ring rather
                      than half. */}
                  <circle cx="12" cy="5.6" r="5.5" />
                  <ellipse cx="12" cy="18.6" rx="9" ry="5.4" />
                </svg>
              </span>
              <span className="artium-gx-stem artium-gx-stem--top" aria-hidden="true" />
              <span className="artium-gx-stem artium-gx-stem--bot" aria-hidden="true" />
            </>
          )}

          {fullTrio && (
            <GateCircle
              side="left"
              step={5}
              onClick={onLearner}
              icon={conductor}
              title="Find a Teacher"
              desc="Discover and connect with top conservatory musicians and inspiring teachers."
            />
          )}

          {showStudent ? (
            <GateCircle
              hero
              step={4}
              onClick={onStudent}
              icon={cap}
              eyebrow={studentLoggedIn ? null : "I'm a"}
              title={studentLoggedIn ? "Continue" : <>Conservatory<br />Student | Graduate</>}
              desc="Learn, connect with peers, access resources, and grow."
            />
          ) : showLearner && (
            <GateCircle
              hero
              step={4}
              onClick={onLearner}
              icon={conductor}
              title={learnerLoggedOut ? "Log in" : "Find a Teacher"}
              desc="Discover and connect with top conservatory musicians and inspiring teachers."
            />
          )}

          {fullTrio && (
            <GateCircle
              side="right"
              step={6}
              onClick={onPianist}
              icon={piano}
              title="Find a Concert Pianist"
              desc="Hire talented conservatory pianists for your concert, event or project."
            />
          )}
        </div>

        {fullTrio && (
          <div className="artium-gx-trust artium-gx-in artium-gx-in--7">
            {[
              { t: "Trusted Community", d: "Verified conservatory students & musicians",
                i: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="9.2" cy="8.2" r="3" /><path d="M3.2 19.4a6 6 0 0 1 12 0" /><circle cx="17.4" cy="9.4" r="2.3" /><path d="M16.3 14.9a4.6 4.6 0 0 1 5 4.5" /></svg> },
              { t: "Safe & Secure", d: "Private, secure and reliable platform",
                i: <ShieldCheck size={22} strokeWidth={1.6} /> },
              { t: "Grow Together", d: "Opportunities, collaborations and real connections",
                i: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 20v-4M9.3 20v-8M14.6 20V7M19.9 20V3.5" /></svg> },
            ].map((f) => (
              <div key={f.t} className="artium-gx-trust-item">
                {f.i}
                <span>
                  <p className="artium-gx-trust-t">{f.t}</p>
                  <p className="artium-gx-trust-d">{f.d}</p>
                </span>
              </div>
            ))}
          </div>
        )}

        {(studentLoggedIn || learnerProfile) ? (
          <p className="artium-gx-note artium-gx-in artium-gx-in--7">
            {studentLoggedIn ? "Logged in as a conservatory student" : <>Logged in as {learnerProfile.name}</>}
          </p>
        ) : (
          // Returning users had no way back in from here. "Log in" only ever
          // appeared once this browser had seen someone log out, so on a new
          // device — or a private window — every route led to signup and there
          // was no way to an existing account.
          <>
            <p className="artium-gx-note artium-gx-in artium-gx-in--7">Already have an account?</p>
            <button onClick={onLogin} className="artium-gx-login artium-gx-in artium-gx-in--7">
              Log in <ArrowRight size={17} strokeWidth={2} />
            </button>
          </>
        )}
      </main>

      <footer className="artium-gx-foot artium-gx-in artium-gx-in--7">
        <div className="artium-gx-foot-top" aria-hidden="true" />
        <div className="artium-gx-foot-row">
          {/* The name is no longer the link — the ringed marks beside it are,
              so it loses the radical tile it was carrying. */}
          <span className="artium-gx-partner">
            In partnership with <b>aclassicaltone</b>
          </span>
          <span className="artium-gx-social">
            <a href={ACT_INSTAGRAM} target="_blank" rel="noreferrer" aria-label="aclassicaltone on Instagram">
              <Instagram size={15} strokeWidth={1.7} />
            </a>
            <a href={ACT_FACEBOOK} target="_blank" rel="noreferrer" aria-label="aclassicaltone on Facebook">
              <Facebook size={15} strokeWidth={1.7} />
            </a>
          </span>
        </div>
        <div className="artium-gx-foot-line" aria-hidden="true" />
        <div className="artium-gx-foot-row">
          {/* Rendered as text, not as links: there is nowhere for them to go
              yet, and a footer link that does nothing when tapped is worse
              than one that does not invite the tap. */}
          <span className="artium-gx-foot-links">
            <span>About Us</span><i aria-hidden="true">•</i>
            <span>Help Center</span><i aria-hidden="true">•</i>
            <span>Contact</span>
          </span>
          <span className="artium-gx-copy">© 2026 Artium. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}

/* ---- Learner: signup form ---- */
function LearnerSignup({ onSubmit, onBack, error, authUser }) {
  // One signup for the whole app: whoever reaches this screen already has a
  // session (the access gate no longer lets anyone this far signed out —
  // see AuthPrompt), so there is no account step here any more — just the
  // one real question this flow ever asked on top of it.
  const [forWhom, setForWhom] = useState("");

  // "for me" fields
  const [name, setName] = useState(authUser?.user_metadata?.full_name || authUser?.user_metadata?.name || "");
  const [location, setLocation] = useState("");
  const [instrument, setInstrument] = useState("");
  const [instrumentOther, setInstrumentOther] = useState("");
  const [motivation, setMotivation] = useState("");

  // "on behalf" fields
  const [learnerName, setLearnerName] = useState("");
  const [learnerAge, setLearnerAge] = useState("");
  const [learnerLocation, setLearnerLocation] = useState("");
  const [learnerInstrument, setLearnerInstrument] = useState("");
  const [learnerInstrumentOther, setLearnerInstrumentOther] = useState("");
  const [learnerLevel, setLearnerLevel] = useState("");
  const [learnerGoals, setLearnerGoals] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const isForOther = forWhom === "other";

  const resolvedInstrument = instrument === "Other" ? instrumentOther.trim() : instrument;
  const resolvedLearnerInstrument = learnerInstrument === "Other" ? learnerInstrumentOther.trim() : learnerInstrument;

  const readySelf = name.trim().length > 1 && location.trim().length > 1 && resolvedInstrument.length > 0 && motivation.trim().length > 5;
  const readyOther = learnerName.trim().length > 1 && learnerLocation.trim().length > 1 && resolvedLearnerInstrument.length > 0 && learnerGoals.trim().length > 5;
  const ready = forWhom !== "" && (isForOther ? readyOther : readySelf);

  async function handleSubmit() {
    setSubmitting(true);
    const submitName = isForOther ? learnerName.trim() : name.trim();
    const submitLocation = isForOther ? learnerLocation.trim() : location.trim();
    const submitInstrument = isForOther ? resolvedLearnerInstrument : resolvedInstrument;
    const submitMotivation = isForOther
      ? `On behalf of ${learnerName.trim()}${learnerAge ? ` (age ${learnerAge})` : ""}. Level: ${learnerLevel || "beginner"}. Goals: ${learnerGoals.trim()}`
      : motivation.trim();
    // email/password no longer come from this form — submitLearner writes
    // against the session that got them here.
    await onSubmit({ name: submitName, location: submitLocation, email: authUser?.email || "", password: "", instrument: submitInstrument, motivation: submitMotivation });
    setSubmitting(false);
  }

  return (
    <div className="min-h-full" style={{ background: C.ink, color: C.ivory }}>
      <div className="max-w-2xl mx-auto px-6 pt-8">
        <div className="flex items-center gap-3">
          <button onClick={onBack} style={{ color: C.ivoryDim, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: 0 }}>
            <ChevronLeft size={18} />
          </button>
          <Logo slogan />
        </div>
        <h2 className="artium-su-title" style={{ marginTop: 22 }}>
          {isForOther ? "About the learner" : "Tell us about you"}
        </h2>
        <p className="mt-2" style={{ color: C.ivoryDim, fontSize: 15, lineHeight: 1.6 }}>
          {isForOther
            ? "Tell us about the person you're registering. This helps us find the right teacher for them."
            : "We'll show conservatory musicians who give lessons near you."}
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <>
            <Field label="Who is this registration for?">
              <div style={{ display: "flex", gap: 10 }}>
                {[
                  { value: "self", label: "For me" },
                  { value: "other", label: "On behalf of someone (e.g. my child)" },
                ].map((opt) => (
                  <button key={opt.value} onClick={() => setForWhom(opt.value)}
                    style={{
                      flex: 1, padding: "12px 8px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                      border: `1.5px solid ${forWhom === opt.value ? C.brass : "#444"}`,
                      background: forWhom === opt.value ? "rgba(74,171,140,0.1)" : "transparent",
                      color: forWhom === opt.value ? C.brass : C.ivoryDim,
                      cursor: "pointer", textAlign: "center", lineHeight: 1.4,
                    }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </Field>
        </>
        {forWhom === "" ? null : isForOther ? (
          /* ── On behalf of someone ── */
          <>
            <Field label="Learner's full name">
              <input style={inputStyle} value={learnerName} onChange={(e) => setLearnerName(e.target.value)} placeholder="e.g. Sophie" autoComplete="off" autoFocus />
            </Field>
            <Field label="Learner's age">
              <input style={inputStyle} value={learnerAge} onChange={(e) => setLearnerAge(e.target.value)} placeholder="e.g. 10" autoComplete="off" />
            </Field>
            <Field label="Where is the learner based?">
              <input style={inputStyle} value={learnerLocation} onChange={(e) => setLearnerLocation(e.target.value)} placeholder="City, country" autoComplete="off" />
            </Field>
            <Field label="Which instrument would they like to learn?">
              <select style={{ ...inputStyle, background: C.inkSoft }} value={learnerInstrument} onChange={(e) => setLearnerInstrument(e.target.value)}>
                <option value="">Select an instrument…</option>
                {INSTRUMENT_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                <option value="Other">Other</option>
              </select>
              {learnerInstrument === "Other" && (
                <input style={{ ...inputStyle, marginTop: 8 }} value={learnerInstrumentOther} onChange={(e) => setLearnerInstrumentOther(e.target.value)} placeholder="Please specify…" autoFocus />
              )}
            </Field>
            <Field label="Current level">
              <select style={{ ...inputStyle, background: C.inkSoft }} value={learnerLevel} onChange={(e) => setLearnerLevel(e.target.value)}>
                <option value="">Select a level…</option>
                {["Complete beginner", "Early beginner", "Intermediate", "Advanced"].map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </Field>
            <Field label="Goals and expectations">
              <textarea
                style={{ ...inputStyle, resize: "vertical", minHeight: 100, lineHeight: 1.6 }}
                value={learnerGoals}
                onChange={(e) => setLearnerGoals(e.target.value)}
                placeholder="What do you hope they'll achieve? Any specific goals, pieces, or timeline in mind?"
              />
            </Field>
            {error && <p className="text-sm mb-4" style={{ color: C.burgundy }}>{error}</p>}
            <div className="mt-2">
              <PrimaryBtn disabled={!ready || submitting} onClick={handleSubmit} icon={ArrowRight}>
                {submitting ? "Submitting…" : "Find a teacher"}
              </PrimaryBtn>
            </div>
          </>
        ) : (
          /* ── For myself ── */
          <>
            <Field label="Your full name">
              <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" autoComplete="off" autoFocus />
            </Field>
            <Field label="Where are you based?">
              <input style={inputStyle} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, country" autoComplete="off" />
            </Field>
            <Field label="Which instrument would you like to learn?">
              <select style={{ ...inputStyle, background: C.inkSoft }} value={instrument} onChange={(e) => setInstrument(e.target.value)}>
                <option value="">Select an instrument…</option>
                {INSTRUMENT_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                <option value="Other">Other</option>
              </select>
              {instrument === "Other" && (
                <input style={{ ...inputStyle, marginTop: 8 }} value={instrumentOther} onChange={(e) => setInstrumentOther(e.target.value)} placeholder="Please specify…" autoFocus />
              )}
            </Field>
            <Field label="Why do you want to learn, and what are your expectations?">
              <textarea
                style={{ ...inputStyle, resize: "vertical", minHeight: 100, lineHeight: 1.6 }}
                value={motivation}
                onChange={(e) => setMotivation(e.target.value)}
                placeholder="Tell the teacher about your goals, experience level, and what you're hoping to achieve…"
              />
            </Field>
            {error && <p className="text-sm mb-4" style={{ color: C.burgundy }}>{error}</p>}
            <div className="mt-2">
              <PrimaryBtn disabled={!ready || submitting} onClick={handleSubmit} icon={ArrowRight}>
                {submitting ? "Submitting…" : "Find my teacher"}
              </PrimaryBtn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---- Map of teachers (gold pins) ---- */
function TeacherMap({ teachers, selectedId, onSelect, height = 520 }) {
  return (
    <svg viewBox="0 0 1000 460" style={{ width: "100%", height, display: "block" }}>
      <defs>
        <pattern id="lg-dots-t" width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="rgba(0,0,0,0.03)" />
        </pattern>
      </defs>
      <rect width="1000" height="460" fill="url(#lg-dots-t)" />
      {[80, 160, 230, 300, 380].map((y) => (
        <line key={y} x1="0" x2="1000" y1={y} y2={y} stroke="rgba(0,0,0,0.03)" strokeWidth="1" />
      ))}
      {CONTINENTS.map((d, i) => (
        <path key={i} d={d} fill={C.parchmentDim} opacity="0.16" stroke={C.parchmentDim} strokeOpacity="0.3" />
      ))}
      {teachers.map((t) => {
        const p = teacherPin(t);
        const active = selectedId === t.id;
        return (
          <g key={t.id} transform={`translate(${p.x},${p.y})`} style={{ cursor: "pointer" }} onClick={() => onSelect(t.id)}>
            {active && <circle r="11" fill="none" stroke={C.brass} strokeWidth="1" className="lg-pulse" />}
            <circle r={active ? 6 : 4.5} fill={C.brass} fillOpacity={active ? 1 : 0.8} stroke={C.ink} strokeWidth="1.2" />
          </g>
        );
      })}
    </svg>
  );
}

/* ---- Learner home: map + request + chat ---- */
function LearnerScreen({ learner, teachers, teachRequests, onSendRequest, conversations, activeChatId, setActiveChatId, onSend, onBack, onUpdateProfile, onLogout, onDeleteAccount, memberCount, musicOn, onMusicToggle }) {
  const [appTab, setAppTab] = useState("map");
  const [selectedConsId, setSelectedConsId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [activeLessonTeacherId, setActiveLessonTeacherId] = useState(null);
  const [learnerRoomView, setLearnerRoomView] = useState("teachers"); // "teachers" | "planning"
  const [learnerOpenMonths, setLearnerOpenMonths] = useState({});
  const selected = teachers.find((t) => t.id === selectedId);
  const status = selectedId ? teachRequests[selectedId] : undefined;
  const acceptedTeachers = teachers.filter((t) => teachRequests[t.id] === "accepted");
  const activeLessonTeacher = teachers.find((t) => t.id === activeLessonTeacherId) || acceptedTeachers[0] || null;

  // profile editing state
  const [editName, setEditName] = useState(learner?.name || "");
  const [editLocation, setEditLocation] = useState(learner?.location || "");
  const [saved, setSaved] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState("");

  async function payForLesson(teacher) {
    setPayLoading(true);
    setPayError("");
    const price = parseFloat(String(teacher.teaching?.price).replace(/[^0-9.]/g, "")) || 0;
    if (!price) { setPayError("This teacher hasn't set a lesson price yet."); setPayLoading(false); return; }
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            teacherId: teacher.id,
            teacherName: teacher.name,
            amount: price,
            currency: "eur",
            stripeAccountId: teacher.stripeAccountId || null,
            successUrl: window.location.origin + "?payment=success",
            cancelUrl: window.location.origin + "?payment=cancel",
          }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data?.url) throw new Error(data?.error || "Could not start checkout");
      window.location.href = data.url;
    } catch (e) {
      setPayError(e.message);
      setPayLoading(false);
    }
  }
  const [deleteError, setDeleteError] = useState("");

  // Group teachers by conservatory for WorldMap
  const teachersByCons = teachers.reduce((acc, t) => {
    if (t.conservatoryId) { (acc[t.conservatoryId] = acc[t.conservatoryId] || []).push(t); }
    return acc;
  }, {});

  const consRoster = selectedConsId ? (teachersByCons[selectedConsId] || []) : [];
  const cons = findConservatory(selectedConsId);

  // One pin per conservatory that actually has somebody teaching, carrying the
  // count — the same shape the network page feeds the globe, so clustering,
  // the counted badges and the country names all work here unchanged.
  const teacherPins = React.useMemo(() => Object.entries(teachersByCons)
    .map(([id, list]) => {
      const c = findConservatory(id);
      if (!c || !Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return null;
      return { ...c, count: list.length };
    })
    .filter(Boolean), [teachersByCons]);

  // Set by a cluster that zoom could not split, exactly as on the network map.
  const [areaIds, setAreaIds] = useState(null);

  // The schools that have somebody teaching, each carrying its count. This is
  // what the list shows first — the teachers themselves are one level down,
  // behind whichever school you choose, which is also what the pins do.
  const teacherCons = React.useMemo(() => {
    const keep = areaIds ? new Set(areaIds) : null;
    return Object.entries(teachersByCons)
      .filter(([id, list]) => list.length > 0 && (!keep || keep.has(id)))
      .map(([id, list]) => {
        const c = findConservatory(id);
        return c ? { ...c, teacherCount: list.length } : null;
      })
      .filter(Boolean)
      // Most teachers first: the school a learner is likeliest to find
      // somebody at is the one worth reading first.
      .sort((a, b) => b.teacherCount - a.teacherCount || (a.name || "").localeCompare(b.name || ""));
  }, [teachersByCons, areaIds]);

  const onlineTeacherCount = teachers.filter((t) => t.online).length;

  function selectTeacher(id) {
    setSelectedId(id);
    setActiveChatId(id);
  }

  function saveProfile() {
    onUpdateProfile({ name: editName.trim(), location: editLocation.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const learnerProfile = learner ? { name: learner.name, photoUrl: learner.photoUrl } : null;

  return (
    <AppShell
      appTab={appTab} setAppTab={setAppTab}
      myProfile={learnerProfile}
      musicOn={musicOn} onMusicToggle={onMusicToggle}
      memberCount={memberCount}
      onBack={selectedId ? () => setSelectedId(null) : appTab === "lesson" && learnerRoomView !== "teachers" ? () => setLearnerRoomView("teachers") : appTab !== "map" ? () => setAppTab("map") : onBack}
      hideTabs={!!selectedId}
    >
      {/* The learner's own strip is gone the same way the student's went: its
          two destinations are in the bottom bar at the foot of this screen,
          and the same place on every screen is the point of having one bar.

          Lesson Room still only appears once a teacher has accepted them —
          before that it is a room with nothing in it. */}

      {/* The same screen the conservatory students get, because it is the same
          world seen from the other side. It was a flat Leaflet tile map with
          the library's own zoom buttons and a two-column split, next to a
          globe — one product with two ideas of what a map is.

          Everything here is the network page's: the stage and its rings, the
          eyebrow and display heading, the counted stats, the rows. Which also
          means the learner inherits the work done there — satellite imagery,
          relief, borders, zoom, and pins that group instead of piling up. */}
      {appTab === "map" && !selectedId && (
        <div className="artium-aw-in" style={{ paddingTop: 18, paddingBottom: 28 }}>
          <p className="artium-aw-eyebrow"><i />Find a teacher<i /></p>
          <h1 className="artium-aw-h1">{learner ? `Welcome, ${learner.name.split(" ")[0]}` : "Find a teacher"}</h1>
          <p className="artium-aw-sub">
            {teachers.length} conservatory student{teachers.length === 1 ? "" : "s"} offering lessons
            {learner && learner.location ? ` · you're in ${learner.location}` : ""}.
          </p>

          <div className="artium-aw-stage">
            <span className="artium-aw-glow" aria-hidden="true" />
            <span className="artium-aw-ring artium-aw-ring--a" aria-hidden="true" />
            <span className="artium-aw-ring artium-aw-ring--b" aria-hidden="true" />
            <WorldGlobe
              pins={teacherPins}
              selectedId={selectedConsId}
              onSelect={setSelectedConsId}
              onCluster={(members) => { setSelectedConsId(null); setAreaIds(members.map((m) => m.id)); }}
              height={300}
            />
          </div>

          <div className="artium-aw-stats">
            <div className="artium-aw-stat">
              <span className="artium-aw-stat-n"><User size={15} strokeWidth={2} />{teachers.length}</span>
              <p className="artium-aw-stat-l">Teachers</p>
            </div>
            <div className="artium-aw-stat">
              <span className="artium-aw-stat-n"><MapPin size={15} strokeWidth={2} />{teacherPins.length}</span>
              <p className="artium-aw-stat-l">Conservatories</p>
            </div>
            <div className="artium-aw-stat">
              <span className="artium-aw-stat-n"><Globe2 size={15} strokeWidth={2} />{onlineTeacherCount}</span>
              <p className="artium-aw-stat-l">Online now</p>
            </div>
          </div>

          <p className="artium-aw-hint">Explore the world map and pick a pin to see who teaches there.</p>

          {cons ? (
            <>
              <div className="artium-aw-listhead">
                <button className="artium-aw-sort" style={{ marginLeft: 0 }} onClick={() => setSelectedConsId(null)}>
                  <ArrowLeft size={13} /> All teachers
                </button>
              </div>
              <div className="artium-aw-row" style={{ cursor: "default", marginBottom: 12 }}>
                <ConsAvatar cons={cons} />
                <span className="artium-aw-row-body">
                  <p className="artium-aw-row-t">{cons.name}</p>
                  <p className="artium-aw-row-c"><span aria-hidden="true" style={{ fontSize: 11, lineHeight: 1 }}>{"\uD83D\uDCCD"}</span>{[cons.city, cons.country].filter(Boolean).join(", ")}</p>
                </span>
                <span className="artium-aw-badge"><b>{consRoster.length}</b><span>teacher{consRoster.length === 1 ? "" : "s"}</span></span>
              </div>
              <div className="artium-aw-list">
                {consRoster.length === 0 && <p className="artium-aw-empty">No teachers from this conservatory yet.</p>}
                {consRoster.map((t) => <TeacherRow key={t.id} t={t} onOpen={() => selectTeacher(t.id)} />)}
              </div>
            </>
          ) : (
            <>
              {areaIds && (
                <div className="artium-aw-listhead">
                  <button className="artium-aw-sort" style={{ marginLeft: 0 }} onClick={() => setAreaIds(null)}>
                    <ArrowLeft size={13} /> All conservatories
                  </button>
                  <span>{areaIds.length} in this area</span>
                </div>
              )}
              {/* Schools first, teachers second. A flat list of everyone
                  teaching is a list of strangers in no order — twenty-two now
                  and hundreds later — while the school is the thing a learner
                  already has an opinion about, and the thing the pins on the
                  globe are. It also makes the list and the map agree: both are
                  places, and clicking either one opens the same roster. */}
              <div className="artium-aw-listhead">
                <h2>Conservatories</h2>
                <span>{teacherCons.length} result{teacherCons.length === 1 ? "" : "s"}</span>
              </div>
              <div className="artium-aw-list">
                {teacherCons.length === 0 && <p className="artium-aw-empty">No one is teaching here yet.</p>}
                {teacherCons.map((c) => (
                  <button key={c.id} className="artium-aw-row" onClick={() => setSelectedConsId(c.id)}>
                    <ConsAvatar cons={c} />
                    <span className="artium-aw-row-body">
                      <p className="artium-aw-row-t">{c.name}</p>
                      <p className="artium-aw-row-c"><span aria-hidden="true" style={{ fontSize: 11, lineHeight: 1 }}>{"\uD83D\uDCCD"}</span>{[c.city, c.country].filter(Boolean).join(", ")}</p>
                    </span>
                    <span className="artium-aw-badge">
                      <b>{c.teacherCount}</b><span>teacher{c.teacherCount === 1 ? "" : "s"}</span>
                    </span>
                    <ChevronRight size={17} strokeWidth={2} />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {(appTab === "map" || (appTab === "lesson" && selectedId === activeLessonTeacher?.id)) && selectedId && selected && (() => {
        const selCons = findConservatory(selected.conservatoryId);
        const Row = ({ label, children }) => (
          <div style={{ background: "rgba(176,146,98,0.05)", border: `1px solid ${C.inkLine}`, borderRadius: 10, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.brassLabel, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
            <div style={{ fontSize: 15, color: C.inkText, lineHeight: 1.6 }}>{children}</div>
          </div>
        );
        return (
          <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 28 }}>
              <div style={{ marginTop: 4 }}>
                <Avatar name={selected.name} id={selected.id} size={64} photoUrl={selected.photoUrl} online={selected.online} />
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: C.inkText, margin: 0, lineHeight: 1.3 }}>{selected.name}</h2>
                <p style={{ fontSize: 13, color: C.ivoryDim, margin: "3px 0 0", lineHeight: 1.5 }}>
                  {[instrumentLabel(selected), selected.year].filter(Boolean).join(" · ")}
                </p>
                {selCons && <p style={{ fontSize: 13, color: C.ivoryDim, margin: "1px 0 0" }}>{selCons.name}, {selCons.city}</p>}
              </div>
              <div style={{ flexShrink: 0 }}>
                {status === "accepted" ? (
                  <span style={{ fontSize: 12, color: C.brassLabel, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><Check size={13} /> Accepted</span>
                ) : status === "pending" ? (
                  <span style={{ fontSize: 12, color: C.ivoryDim, fontStyle: "italic" }}>Request sent…</span>
                ) : (
                  <PrimaryBtn onClick={() => onSendRequest(selected.id)} icon={Send}>Send teaching request</PrimaryBtn>
                )}
              </div>
            </div>

            {/* Bio */}
            {selected.bio && (
              <p style={{ fontSize: 15, color: C.ivoryDim, lineHeight: 1.75, marginBottom: 24 }}>{selected.bio}</p>
            )}

            {/* Video link card */}
            <ProfileLinks links={selected.links} />

            {/* Data grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {(selected.tastes || []).length > 0 && (
                <Row label="Musical preferences">
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                    {selected.tastes.map((t) => (
                      <span key={t} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, border: `1px solid ${C.inkLine}`, color: C.inkText, background: C.inkSoft }}>{t}</span>
                    ))}
                  </div>
                </Row>
              )}
              {(selected.pieces || []).length > 0 && (
                <Row label="Current repertoire">
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                    {selected.pieces.map((p, i) => (
                      <div key={i}>
                        <span style={{ fontWeight: 600, color: C.inkText }}>{p.title}</span>
                        <span style={{ color: C.ivoryDim }}> — {p.composer}</span>
                      </div>
                    ))}
                  </div>
                </Row>
              )}
              {selected.top && <Row label="Recent win">{selected.top}</Row>}
              {selected.flop && <Row label="Current challenge">{selected.flop}</Row>}
              <Row label="Teaching"><TeachingCell teaching={selected.teaching} /></Row>
            </div>

            {status === "accepted" && (
              <div className="mt-6 rounded-xl p-4 text-sm" style={{ background: C.inkSoft, border: `1px solid ${C.inkLine}`, color: C.ivoryDim, display: "flex", alignItems: "center", gap: 8 }}>
                <Check size={13} color={C.brass} />
                <span>{selected.name.split(" ")[0]} accepted — open <button onClick={() => setAppTab("lesson")} style={{ background: "none", border: "none", padding: 0, color: C.brassLabel, fontWeight: 600, cursor: "pointer", fontSize: "inherit" }}>Lesson Room</button> to get started.</span>
              </div>
            )}
            {status === "pending" && (
              <div className="mt-6 rounded-xl p-4 text-sm" style={{ background: C.inkSoft, border: `1px solid ${C.inkLine}`, color: C.ivoryDim }}>
                <p className="lg-blink">Request sent — waiting for {selected.name.split(" ")[0]} to accept…</p>
              </div>
            )}
          </div>
        );
      })()}

      {appTab === "lesson" && (() => {
        if (!activeLessonTeacher) return null;
        if (selectedId === activeLessonTeacher.id) return null;

        // ── My Planning view ──
        if (learnerRoomView === "planning") {
          const MOCK_LEARNER_PLANNING = acceptedTeachers.map((t) => ({
            teacher: { id: t.id, name: t.name, instrument: instrumentLabel(t), price: parseFloat(String(t.teaching?.price).replace(/[^0-9.]/g, "")) || 60 },
            sessions: [
              { id: `s1-${t.id}`, date: "2026-07-20", time: "10:00", status: "confirmed", paid: true },
              { id: `s2-${t.id}`, date: "2026-08-05", time: "14:00", status: "teacher_proposed", paid: false },
              { id: `s3-${t.id}`, date: "2026-08-18", time: "11:00", status: "confirmed", paid: false },
            ],
          }));
          const allSessions = MOCK_LEARNER_PLANNING.flatMap(({ teacher, sessions }) =>
            sessions.map((s) => ({ ...s, teacher }))
          ).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
          const byMonth = {};
          allSessions.forEach((s) => { const k = s.date.slice(0, 7); (byMonth[k] = byMonth[k] || []).push(s); });
          const STATUS_LABEL = { confirmed: "Confirmed", teacher_proposed: "Awaiting confirm", student_proposed: "Pending", cancelled: "Cancelled" };
          const STATUS_COLOR = { confirmed: "#1A9E6E", teacher_proposed: C.brass, student_proposed: "#E07B00", cancelled: "#c0392b" };
          return (
            <div style={{ padding: "16px 20px 32px", background: C.parchment, minHeight: "100%" }}>
              {Object.entries(byMonth).map(([monthKey, sessions]) => {
                const spent = sessions.filter((s) => s.status === "confirmed" && s.paid).reduce((sum, s) => sum + s.teacher.price, 0);
                const [y, m] = monthKey.split("-");
                const monthLabel = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
                const isOpen = !!learnerOpenMonths[monthKey];
                return (
                  <div key={monthKey} style={{ marginBottom: 12, border: `1px solid ${C.inkLine}`, borderRadius: 10, overflow: "hidden" }}>
                    <button onClick={() => setLearnerOpenMonths((p) => ({ ...p, [monthKey]: !p[monthKey] }))}
                      style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 16px", background: C.inkSoft, border: "none", cursor: "pointer" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.ivory }}>{monthLabel}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {spent > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: "#1A9E6E" }}>€{spent} spent</span>}
                        <span style={{ fontSize: 11, color: C.ivoryDim }}>{sessions.length} session{sessions.length !== 1 ? "s" : ""}</span>
                        <span style={{ fontSize: 14, color: C.ivoryDim }}>{isOpen ? "▲" : "▼"}</span>
                      </span>
                    </button>
                    {isOpen && (
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: "#FAFAFA" }}>
                            {["Teacher", "Date · Time", "Status", "Amount"].map((h) => (
                              <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: C.brassLabel, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${C.inkLine}` }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sessions.map((s, i) => {
                            const dt = new Date(s.date + "T" + s.time);
                            const amount = s.status === "confirmed" && s.paid ? `€${s.teacher.price}` : "—";
                            return (
                              <tr key={i} style={{ borderBottom: `1px solid ${C.inkLine}`, background: i % 2 === 0 ? "transparent" : "rgba(176,146,98,0.05)" }}>
                                <td style={{ padding: "9px 12px" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <Avatar name={s.teacher.name} id={s.teacher.id} size={26} />
                                    <div>
                                      <p style={{ margin: 0, fontWeight: 600, color: C.brassLabel, fontSize: 12 }}>{s.teacher.name}</p>
                                      <p style={{ margin: 0, fontSize: 10, color: C.ivoryDim }}>{s.teacher.instrument}</p>
                                    </div>
                                  </div>
                                </td>
                                <td style={{ padding: "9px 12px", color: C.ivory }}>{dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · {s.time}</td>
                                <td style={{ padding: "9px 12px" }}>
                                  <span style={{ fontSize: 11, fontWeight: 600, color: STATUS_COLOR[s.status] || C.ivoryDim }}>{STATUS_LABEL[s.status] || s.status}</span>
                                </td>
                                <td style={{ padding: "9px 12px", fontWeight: 700, color: amount === "—" ? C.ivoryDim : "#1A9E6E" }}>{amount}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          );
        }

        // ── Teachers view (default) ──
        return (
          <div style={{ padding: "0 0 32px", background: C.parchment, minHeight: "100%" }}>
            <div style={{ padding: "20px 20px 0", background: C.parchment }}>
              <p style={{ fontSize: 13, color: C.ivoryDim, margin: "0 0 16px", textAlign: "center" }}>
                {acceptedTeachers.length} active teacher{acceptedTeachers.length !== 1 ? "s" : ""}
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "12px 0 16px" }}>
                {acceptedTeachers.map((t) => (
                  <button key={t.id} onClick={() => setActiveLessonTeacherId(t.id)}
                    style={{ padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: t.id === activeLessonTeacher.id ? 700 : 500, border: t.id === activeLessonTeacher.id ? `2px solid ${C.brass}` : "none", background: "rgba(176,146,98,0.05)", color: t.id === activeLessonTeacher.id ? C.ivory : C.ivoryDim, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.06)" }}>
                    {t.name.split(" ")[0]}
                  </button>
                ))}
              </div>
              <button onClick={() => selectTeacher(activeLessonTeacher.id)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "rgba(176,146,98,0.05)", borderRadius: 12, border: "none", boxShadow: "0 1px 6px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)", marginBottom: 16, width: "100%", cursor: "pointer", textAlign: "left" }}>
                <Avatar name={activeLessonTeacher.name} id={activeLessonTeacher.id} size={40} photoUrl={activeLessonTeacher.photoUrl} online={activeLessonTeacher.online} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: C.ivory, margin: 0 }}>{activeLessonTeacher.name}</p>
                  <p style={{ fontSize: 12, color: C.ivoryDim, margin: "2px 0 0" }}>{instrumentLabel(activeLessonTeacher)} · {activeLessonTeacher.year}</p>
                </div>
                <ChevronRight size={16} color={C.ivoryDim} />
              </button>
            </div>
            <div style={{ margin: "0 20px 20px", background: "rgba(176,146,98,0.05)", borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.06)", overflow: "hidden", minHeight: 320 }}>
              <LessonRoom
                teacher={activeLessonTeacher}
                messages={conversations[activeLessonTeacher.id] || []}
                onSend={onSend}
                onPayLesson={payForLesson}
                payLoading={payLoading}
                payError={payError}
              />
            </div>
            {/* Bottom nav — My Planning */}
            <div style={{ display: "flex", justifyContent: "center", gap: 40, padding: "20px 20px 12px", background: "rgba(176,146,98,0.05)", borderTop: `1px solid ${C.inkLine}` }}>
              {[{ v: "planning", Icon: LayoutList, label: "My Planning" }].map(({ v, Icon, label }) => (
                <button key={v} onClick={() => setLearnerRoomView(v)}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: C.ivoryDim }}>
                  <div style={{ width: 52, height: 52, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(176,146,98,0.05)", border: "2px solid transparent", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07)" }}>
                    <Icon size={22} color={C.ivoryDim} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {appTab === "profile" && (() => {
        const Row = ({ label, children }) => (
          <div style={{ background: "rgba(176,146,98,0.05)", border: `1px solid ${C.inkLine}`, borderRadius: 10, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.brassLabel, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
            <div style={{ fontSize: 15, color: C.inkText, lineHeight: 1.6 }}>{children}</div>
          </div>
        );
        return (
          <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px" }}>
            {/* Header */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 16 }}>
                <div style={{ marginTop: 4 }}>
                  <Avatar name={learner?.name || ""} id="me-learner" size={64} online />
                </div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: C.inkText, margin: 0, lineHeight: 1.3 }}>{learner?.name}</h2>
                  {learner?.instrument && <p style={{ fontSize: 13, color: C.ivoryDim, margin: "3px 0 0" }}>{learner.instrument}</p>}
                  {learner?.location && <p style={{ fontSize: 13, color: C.ivoryDim, margin: "1px 0 0" }}>{learner.location}</p>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <GhostBtn onClick={() => setEditingProfile(true)} icon={Pencil}>Edit</GhostBtn>
                {onLogout && <GhostBtn onClick={onLogout}>Log out</GhostBtn>}
                {onDeleteAccount && !confirmDelete && (
                  <GhostBtn onClick={() => setConfirmDelete(true)} style={{ color: "#c0392b", borderColor: "#c0392b" }}>Delete account</GhostBtn>
                )}
                {confirmDelete && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: C.ivoryDim }}>Are you sure?</span>
                    <button onClick={async () => { setDeleting(true); await onDeleteAccount(); setDeleting(false); }} disabled={deleting}
                      style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, fontWeight: 600, background: "#c0392b", color: "#fff", border: "none", cursor: "pointer", opacity: deleting ? 0.6 : 1 }}>
                      {deleting ? "Deleting…" : "Yes, delete"}
                    </button>
                    <button onClick={() => setConfirmDelete(false)}
                      style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, border: `1px solid ${C.inkLine}`, color: C.ivoryDim, background: "none", cursor: "pointer" }}>
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Bio / motivation */}
            {learner?.bio && (
              <p style={{ fontSize: 15, color: C.ivoryDim, lineHeight: 1.75, marginBottom: 24 }}>{learner.bio}</p>
            )}

            {/* Info cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {learner?.instrument && <Row label="Instrument">{learner.instrument}</Row>}
              {learner?.location && <Row label="Location">{learner.location}</Row>}
            </div>

            {/* Edit form (inline) */}
            {editingProfile && (
              <div className="mt-8 flex flex-col gap-5">
                <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 600, color: C.inkText, margin: 0 }}>Edit profile</h3>
                <div>
                  <label className="block mb-1.5 text-xs" style={{ fontFamily: FONT_MONO, color: C.ivoryDim }}>FULL NAME</label>
                  <input value={editName} onChange={(e) => { setEditName(e.target.value); setSaved(false); }}
                    className="w-full rounded-xl px-4 py-3 text-sm"
                    style={{ background: C.inkSoft, border: `1px solid ${C.inkLine}`, color: C.inkText, outline: "none" }}
                    placeholder="Your name" />
                </div>
                <div>
                  <label className="block mb-1.5 text-xs" style={{ fontFamily: FONT_MONO, color: C.ivoryDim }}>LOCATION</label>
                  <input value={editLocation} onChange={(e) => { setEditLocation(e.target.value); setSaved(false); }}
                    className="w-full rounded-xl px-4 py-3 text-sm"
                    style={{ background: C.inkSoft, border: `1px solid ${C.inkLine}`, color: C.inkText, outline: "none" }}
                    placeholder="City, Country" />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { saveProfile(); setEditingProfile(false); }} disabled={!editName.trim() || !editLocation.trim()}
                    className="rounded-xl py-3 px-6 text-sm font-semibold"
                    style={{ background: C.brass, color: C.inkText, opacity: !editName.trim() || !editLocation.trim() ? 0.5 : 1 }}>
                    {saved ? "Saved ✓" : "Save changes"}
                  </button>
                  <button onClick={() => setEditingProfile(false)}
                    className="rounded-xl py-3 px-6 text-sm"
                    style={{ border: `1px solid ${C.inkLine}`, color: C.ivoryDim, background: "transparent" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}
      {/* Hidden only while a teacher's profile is open over the Lesson Room —
          that page has its own way back and no tab of its own to light. */}
      {!(selectedId && appTab === "lesson") && (
        <BottomTabs
          items={[
            { k: "home", label: "Home", Icon: Home },
            { k: "map", label: "Teachers", Icon: Map },
            ...(Object.values(teachRequests).some((s) => s === "accepted")
              ? [{ k: "lesson", label: "Lessons", Icon: BookOpen }]
              : []),
          ]}
          active={selectedId ? "" : appTab}
          onTab={(k) => {
            if (k === "home") { onBack(); return; }
            setSelectedId(null);
            setAppTab(k);
          }}
        />
      )}
    </AppShell>
  );
}

function VideoSessionTab({ sessions, teacher, zoomLink, meetLink }) {
  const now = Date.now();
  const nextSession = sessions
    .filter((s) => s.status === "confirmed" && s.paid && new Date(s.date + "T" + s.time).getTime() > now)
    .sort((a, b) => new Date(a.date + "T" + a.time) - new Date(b.date + "T" + b.time))[0];

  let nextBanner = null;
  if (nextSession) {
    const dt = new Date(nextSession.date + "T" + nextSession.time);
    const dateStr = dt.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
    const hoursUntil = Math.round((dt.getTime() - now) / (1000 * 60 * 60));
    const countdown = hoursUntil < 24
      ? `In ${hoursUntil} hour${hoursUntil !== 1 ? "s" : ""}`
      : `In ${Math.round(hoursUntil / 24)} day${Math.round(hoursUntil / 24) !== 1 ? "s" : ""}`;
    nextBanner = (
      <div style={{ borderRadius: 12, padding: "14px 16px", background: "#DFF2E8", border: "1px solid #A8D5B5" }}>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#1A9E6E", margin: "0 0 4px" }}>Next session</p>
        <p style={{ fontSize: 15, fontWeight: 700, color: C.inkText, margin: 0 }}>{dateStr} at {nextSession.time}</p>
        <p style={{ fontSize: 12, color: "#1A9E6E", margin: "3px 0 0" }}>{countdown} · Paid ✓</p>
      </div>
    );
  } else {
    nextBanner = (
      <div style={{ borderRadius: 12, padding: "14px 16px", background: C.inkSoft, border: `1px solid ${C.inkLine}` }}>
        <p style={{ fontSize: 13, color: C.ivoryDim, margin: 0 }}>No upcoming paid session — confirm and pay a session in Schedule & Payments first.</p>
      </div>
    );
  }

  return (
    <div className="p-5 flex flex-col gap-4">
      {nextBanner}

      {/* Zoom card */}
      <div style={{ border: `1px solid ${C.inkLine}`, borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#2D8CFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Video size={16} color="#fff" />
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: C.inkText, margin: 0 }}>Zoom</p>
        </div>
        {zoomLink ? (
          <a href={zoomLink} target="_blank" rel="noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#2D8CFF", textDecoration: "none" }}>
            <Link2 size={13} /> Join Zoom meeting
          </a>
        ) : (
          <p style={{ fontSize: 13, color: C.ivoryDim, margin: 0, fontStyle: "italic" }}>
            Awaiting your teacher's Zoom link…
          </p>
        )}
      </div>

      {/* Google Meet card */}
      <div style={{ border: `1px solid ${C.inkLine}`, borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#34A853", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Video size={16} color="#fff" />
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: C.inkText, margin: 0 }}>Google Meet</p>
        </div>
        {meetLink ? (
          <a href={meetLink} target="_blank" rel="noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#34A853", textDecoration: "none" }}>
            <Link2 size={13} /> Join Google Meet
          </a>
        ) : (
          <p style={{ fontSize: 13, color: C.ivoryDim, margin: 0, fontStyle: "italic" }}>
            Awaiting your teacher's Google Meet link…
          </p>
        )}
      </div>

      {/* LiveKit card */}
      <div style={{ border: `1px solid ${C.inkLine}`, borderRadius: 12, padding: 16, opacity: 0.7 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: C.brass, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Video size={16} color="#fff" />
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.inkText, margin: 0 }}>LiveKit</p>
            <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 20, background: C.brassDim, color: C.brassLabel, fontWeight: 700 }}>COMING SOON</span>
          </div>
        </div>
        <p style={{ fontSize: 12, color: C.ivoryDim, lineHeight: 1.6, margin: 0 }}>
          In-app HD video sessions. Connect a LiveKit account to enable.
        </p>
      </div>
    </div>
  );
}

function LessonRoom({ teacher, messages, onSend, onPayLesson, payLoading, payError }) {
  const [tab, setTab] = useState("chat");
  const lsKey = teacher ? `artium_sessions_${teacher.id}_demo-learner` : null;
  const chatLsKey = teacher ? `artium_chat_${teacher.id}_demo-learner` : null;

  // Live chat sync from localStorage
  const [localMsgs, setLocalMsgs] = useState(() => {
    if (chatLsKey) {
      try {
        const s = JSON.parse(localStorage.getItem(chatLsKey) || "null");
        if (s) return s.map((m) => m.from === "learner" ? { ...m, from: "me" } : m.from === "teacher" ? { ...m, from: "them" } : m);
      } catch {}
    }
    return null;
  });
  React.useEffect(() => {
    if (!chatLsKey) return;
    function sync() {
      try {
        const s = JSON.parse(localStorage.getItem(chatLsKey) || "null");
        if (s) setLocalMsgs(s.map((m) => m.from === "learner" ? { ...m, from: "me" } : m.from === "teacher" ? { ...m, from: "them" } : m));
      } catch {}
    }
    const id = setInterval(sync, 1500);
    window.addEventListener("storage", sync);
    return () => { clearInterval(id); window.removeEventListener("storage", sync); };
  }, [chatLsKey]);

  function sendLearnerMsg(text) {
    if (!text.trim()) return;
    // Store with "learner" tag so teacher can flip perspective; display as "me"
    const stored = JSON.parse(localStorage.getItem(chatLsKey) || "null") || [];
    const nextStored = [...stored, { from: "learner", text }];
    if (chatLsKey) localStorage.setItem(chatLsKey, JSON.stringify(nextStored));
    // Display: "me" for learner view
    setLocalMsgs((prev) => [...(prev || []), { from: "me", text }]);
  }

  // Map stored messages to learner display perspective
  const activeMessages = (localMsgs || messages || []).map((m) =>
    m.from === "learner" ? { ...m, from: "me" } : m.from === "teacher" ? { ...m, from: "them" } : m
  );
  const themMsgCount = activeMessages.filter(m => m.from === "them").length;
  const [lastSeenCount, setLastSeenCount] = useState(themMsgCount);
  const unreadCount = Math.max(0, themMsgCount - lastSeenCount);
  React.useEffect(() => { if (tab === "chat") setLastSeenCount(themMsgCount); }, [tab, themMsgCount]);

  const [sessions, setSessions] = useState(() => {
    if (lsKey) {
      try { const s = JSON.parse(localStorage.getItem(lsKey) || "null"); if (s) return s; } catch {}
    }
    return [
      { id: 0, date: "2026-07-05", time: "10:00", status: "confirmed", proposedBy: "teacher", paid: true },
      { id: 1, date: "2026-07-15", time: "16:00", status: "teacher_proposed", proposedBy: "teacher", paid: false },
      { id: 2, date: "2026-07-12", time: "18:00", status: "confirmed", proposedBy: "teacher", paid: true },
    ];
  });

  // Live sync: teacher writes sessions → learner tab reacts
  React.useEffect(() => {
    if (!lsKey) return;
    function sync() {
      try {
        const s = JSON.parse(localStorage.getItem(lsKey) || "null");
        if (s) setSessions(s);
      } catch {}
    }
    const id = setInterval(sync, 2000);
    window.addEventListener("storage", sync);
    return () => { clearInterval(id); window.removeEventListener("storage", sync); };
  }, [lsKey]);

  function persistSessions(next) {
    if (lsKey) localStorage.setItem(lsKey, JSON.stringify(next));
    setSessions(next);
  }
  const [counterDate, setCounterDate] = useState({});
  const [counterTime, setCounterTime] = useState({});
  const [showCounter, setShowCounter] = useState({});
  const [confirmCancelId, setConfirmCancelId] = useState(null);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [zoomLink, setZoomLink] = useState("");
  const [meetLink, setMeetLink] = useState("");
  const [zoomSaved, setZoomSaved] = useState(false);
  const [learnerSessionDetailTab, setLearnerSessionDetailTab] = useState({});
  const [learnerAgenda, setLearnerAgenda] = useState({});
  React.useEffect(() => {
    if (!teacher) return;
    function syncAgenda() {
      const updated = {};
      sessions.forEach(s => {
        const key = `artium_agenda_${teacher.id}_demo-learner_${s.id}`;
        const val = localStorage.getItem(key);
        if (val !== null) updated[s.id] = val;
      });
      setLearnerAgenda(updated);
    }
    syncAgenda();
    const id = setInterval(syncAgenda, 2000);
    window.addEventListener("storage", syncAgenda);
    return () => { clearInterval(id); window.removeEventListener("storage", syncAgenda); };
  }, [teacher, sessions.length]);

  const tabs = [
    { id: "chat", label: "Chat", Icon: MessageCircle },
    { id: "schedule", label: "Schedule & Payments", Icon: Calendar },
    { id: "video", label: "Video Session", Icon: Video },
  ];

  function approveSession(id) {
    const next = sessions.map((s) => s.id === id ? { ...s, status: "confirmed" } : s);
    persistSessions(next);
  }

  function submitCounter(id) {
    const d = counterDate[id]; const t = counterTime[id];
    if (!d || !t) return;
    const next = sessions.map((s) => s.id === id ? { ...s, date: d, time: t, status: "student_proposed", proposedBy: "student" } : s);
    persistSessions(next);
    setShowCounter((prev) => ({ ...prev, [id]: false }));
  }

  function timeUntil(s) {
    return new Date(s.date + "T" + s.time).getTime() - Date.now();
  }
  function cancelLocked(s) { return s.status === "confirmed" && timeUntil(s) < 24 * 60 * 60 * 1000; }
  function modifyLocked(s) { return s.status === "confirmed" && timeUntil(s) < 48 * 60 * 60 * 1000; }

  function cancelSession(id) {
    persistSessions(sessions.filter((s) => s.id !== id));
  }

  return (
    <div style={{ overflow: "hidden", background: C.parchment }}>
      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: `1px solid ${C.inkLine}`, background: "rgba(176,146,98,0.05)" }}>
        {tabs.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "10px 4px", fontSize: 11, fontWeight: tab === id ? 700 : 400, color: tab === id ? C.ivory : C.ivoryDim, background: "none", border: "none", cursor: "pointer", borderBottom: tab === id ? `2px solid ${C.brass}` : "2px solid transparent" }}>
            <div style={{ position: "relative", display: "inline-flex" }}>
              <Icon size={15} />
              {id === "chat" && unreadCount > 0 && (
                <span style={{ position: "absolute", top: -6, right: -6, minWidth: 14, height: 14, borderRadius: 7, background: C.brass, color: C.brassText, fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>{unreadCount}</span>
              )}
            </div>
            {label}
          </button>
        ))}
      </div>

      {/* Chat */}
      {tab === "chat" && (
        <div>
          <div className="lg-scroll overflow-y-auto px-4 py-3 flex flex-col gap-2" style={{ maxHeight: 280 }}>
            {activeMessages.length === 0 && <p style={{ fontSize: 13, color: C.ivoryDim, textAlign: "center", padding: "24px 0" }}>Start the conversation with {teacher.name.split(" ")[0]}</p>}
            {activeMessages.map((m, i) => (
              <div key={i} className="px-3.5 py-2 rounded-2xl text-sm" style={{ maxWidth: "80%", alignSelf: m.from === "me" ? "flex-end" : "flex-start", background: m.from === "me" ? C.brass : C.inkSoft, color: m.from === "me" ? C.brassText : C.inkText }}>
                {m.text}
              </div>
            ))}
          </div>
          <div className="px-3 py-3 flex items-center gap-2" style={{ borderTop: `1px solid ${C.inkLine}` }}>
            <input style={{ flex: 1, background: C.inkSoft, border: `1px solid ${C.inkLine}`, borderRadius: 12, padding: "10px 14px", fontSize: 14, color: C.inkText, outline: "none" }}
              placeholder={`Message ${teacher.name.split(" ")[0]}…`}
              onKeyDown={(e) => { if (e.key === "Enter" && e.target.value.trim()) { sendLearnerMsg(e.target.value); e.target.value = ""; } }} />
            <button onClick={(e) => { const inp = e.currentTarget.previousSibling; if (inp.value.trim()) { sendLearnerMsg(inp.value); inp.value = ""; } }}
              className="rounded-full p-3" style={{ background: C.brass, flexShrink: 0 }}>
              <Send size={15} color={C.brassText} />
            </button>
          </div>
        </div>
      )}

      {/* Schedule & Pay */}
      {tab === "schedule" && (() => {
        const sel = sessions.find((s) => s.id === selectedSessionId);
        return (
          <div>
            {/* Horizontal scroll strip of square cards */}
            <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "16px 0 12px", scrollbarWidth: "none" }}>
              {sessions.length === 0 && (
                <p style={{ fontSize: 13, color: C.ivoryDim, padding: "0 4px" }}>No sessions yet — ask {teacher.name.split(" ")[0]} in Chat to schedule one.</p>
              )}
              {sessions.map((s) => {
                const dt = new Date(s.date + "T" + s.time);
                const isConfirmed = s.status === "confirmed";
                const isSelected = s.id === selectedSessionId;
                return (
                  <button key={s.id} onClick={() => setSelectedSessionId(isSelected ? null : s.id)}
                    style={{ flexShrink: 0, width: 110, height: 110, borderRadius: 14, border: isSelected ? `2px solid ${C.brass}` : `1px solid ${isConfirmed ? "#A8D5B5" : C.inkLine}`, background: isConfirmed ? "rgba(26,158,110,0.10)" : "rgba(176,146,98,0.06)", display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "space-between", padding: 12, cursor: "pointer", boxShadow: isSelected ? `0 0 0 3px ${C.brassDim}` : "none", transition: "box-shadow 0.15s" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: isConfirmed ? "#1A9E6E" : "#D4810A" }}>
                        {isConfirmed ? "Confirmed" : "Awaiting"}
                      </span>
                      {s.paid && <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", background: "#1A9E6E", borderRadius: 20, padding: "2px 6px" }}>Paid</span>}
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <p style={{ fontSize: 18, fontWeight: 800, color: C.inkText, margin: 0, lineHeight: 1 }}>{dt.getDate()}</p>
                      <p style={{ fontSize: 11, color: C.ivoryDim, margin: "2px 0 0" }}>{dt.toLocaleDateString("en-GB", { month: "short" })} · {s.time}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Detail panel for selected session */}
            {sel && (() => {
              const dt = new Date(sel.date + "T" + sel.time);
              const isConfirmed = sel.status === "confirmed";
              const isPending = sel.status === "teacher_proposed";
              const isCounter = showCounter[sel.id];
              return (
                <div style={{ borderTop: `1px solid ${C.inkLine}`, padding: "16px 4px 8px" }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: C.inkText, margin: "0 0 2px" }}>
                    {dt.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} at {sel.time}
                  </p>
                  {sel.proposedBy === "student" && <p style={{ fontSize: 11, color: C.brassLabel, margin: "0 0 10px" }}>Your counter-proposal — awaiting teacher</p>}

                  {isPending && !isCounter && (
                    <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                      <button onClick={() => approveSession(sel.id)}
                        style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 13px", borderRadius: 8, background: "#1A9E6E", color: "#fff", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}>
                        <Check size={12} /> Approve
                      </button>
                      <button onClick={() => setShowCounter((prev) => ({ ...prev, [sel.id]: true }))}
                        style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 13px", borderRadius: 8, background: "none", border: `1px solid ${C.inkLine}`, color: C.ivoryDim, fontSize: 12, cursor: "pointer" }}>
                        Suggest another time
                      </button>
                    </div>
                  )}

                  {(isPending && isCounter) || (isConfirmed && showCounter[sel.id]) ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                      <p style={{ fontSize: 12, color: C.ivoryDim, margin: 0 }}>
                        {isConfirmed ? "Suggest a new time (requires teacher re-confirmation):" : "Suggest a different time:"}
                      </p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input type="date" value={counterDate[sel.id] || ""} onChange={(e) => setCounterDate((p) => ({ ...p, [sel.id]: e.target.value }))}
                          style={{ flex: 1, background: C.inkSoft, border: `1px solid ${C.inkLine}`, borderRadius: 9, padding: "8px 10px", fontSize: 13, color: C.inkText, outline: "none" }} />
                        <input type="time" value={counterTime[sel.id] || ""} onChange={(e) => setCounterTime((p) => ({ ...p, [sel.id]: e.target.value }))}
                          style={{ flex: 1, background: C.inkSoft, border: `1px solid ${C.inkLine}`, borderRadius: 9, padding: "8px 10px", fontSize: 13, color: C.inkText, outline: "none" }} />
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => submitCounter(sel.id)} disabled={!counterDate[sel.id] || !counterTime[sel.id]}
                          style={{ flex: 1, padding: "8px 0", borderRadius: 9, background: C.brass, color: C.brassText, fontSize: 13, fontWeight: 600, border: "none", cursor: !counterDate[sel.id] || !counterTime[sel.id] ? "not-allowed" : "pointer", opacity: !counterDate[sel.id] || !counterTime[sel.id] ? 0.5 : 1 }}>
                          Send proposal
                        </button>
                        <button onClick={() => setShowCounter((prev) => ({ ...prev, [sel.id]: false }))}
                          style={{ padding: "8px 14px", borderRadius: 9, background: "none", border: `1px solid ${C.inkLine}`, color: C.ivoryDim, fontSize: 13, cursor: "pointer" }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {/* Agenda tab — confirmed sessions only (read-only for learner) */}
                  {isConfirmed && (() => {
                    const detailTab = learnerSessionDetailTab[sel.id] || "details";
                    const agenda = learnerAgenda[sel.id] || "";
                    return (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.inkLine}`, marginBottom: 10 }}>
                          {[["details","Details"],["agenda","Agenda"]].map(([t, label]) => (
                            <button key={t} onClick={() => setLearnerSessionDetailTab(prev => ({ ...prev, [sel.id]: t }))}
                              style={{ padding: "6px 16px", fontSize: 12, fontWeight: detailTab === t ? 700 : 500, color: detailTab === t ? C.brass : C.ivoryDim, background: "none", border: "none", cursor: "pointer", borderBottom: detailTab === t ? `2px solid ${C.brass}` : "2px solid transparent", marginBottom: -1 }}>
                              {label}
                            </button>
                          ))}
                        </div>
                        {detailTab === "agenda" && (
                          agenda ? (
                            <div style={{ background: C.inkSoft, border: `1px solid ${C.inkLine}`, borderRadius: 10, padding: "10px 12px", fontSize: 13, color: C.inkText, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                              {agenda}
                            </div>
                          ) : (
                            <p style={{ fontSize: 13, color: C.ivoryDim, fontStyle: "italic", margin: 0 }}>
                              Your teacher hasn't written an agenda for this session yet.
                            </p>
                          )
                        )}
                      </div>
                    );
                  })()}

                  {isConfirmed && teacher.teaching?.open && teacher.teaching?.price && (
                    sel.paid ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: "#DFF2E8", color: "#1A9E6E", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                        <Check size={13} /> Paid
                      </span>
                    ) : (
                      <button onClick={() => { onPayLesson(teacher); setSessions((prev) => prev.map((x) => x.id === sel.id ? { ...x, paid: true } : x)); }} disabled={payLoading}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: "none", border: `1px solid ${C.brass}`, color: C.brassLabel, fontSize: 12, fontWeight: 600, cursor: payLoading ? "not-allowed" : "pointer", opacity: payLoading ? 0.6 : 1, marginBottom: 8 }}>
                        <CreditCard size={13} />
                        {payLoading ? "Redirecting…" : `Pay €${teacher.teaching.price}`}
                      </button>
                    )
                  )}
                  {isConfirmed && payError && <p style={{ fontSize: 12, color: "#E34234", marginBottom: 6 }}>{payError}</p>}

                  {isConfirmed && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {!modifyLocked(sel) ? (
                        <button onClick={() => setShowCounter((prev) => ({ ...prev, [sel.id]: true }))}
                          style={{ fontSize: 12, color: C.brassLabel, background: "none", border: `1px solid ${C.brass}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontWeight: 600 }}>
                          Modify time
                        </button>
                      ) : (
                        <span style={{ fontSize: 11, color: C.ivoryDim, display: "flex", alignItems: "center", gap: 4 }}>🔒 Modify locked (48h)</span>
                      )}
                      {!cancelLocked(sel) ? (
                        <button onClick={() => setConfirmCancelId(sel.id)}
                          style={{ fontSize: 12, color: "#c0392b", background: "none", border: "1px solid #c0392b", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontWeight: 600 }}>
                          Cancel session
                        </button>
                      ) : (
                        <span style={{ fontSize: 11, color: C.ivoryDim, display: "flex", alignItems: "center", gap: 4 }}>🔒 Cancel locked (24h)</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* Cancel confirmation modal */}
      {confirmCancelId !== null && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,20,40,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}
          onClick={() => setConfirmCancelId(null)}>
          <div style={{ background: "rgba(176,146,98,0.05)", borderRadius: 16, padding: "28px 28px 24px", maxWidth: 320, width: "90%", boxShadow: "0 8px 32px rgba(0,0,0,0.18)", textAlign: "center" }}
            onClick={(e) => e.stopPropagation()}>
            <p style={{ fontSize: 16, fontWeight: 700, color: C.inkText, margin: "0 0 8px" }}>Cancel this session?</p>
            <p style={{ fontSize: 13, color: C.ivoryDim, margin: "0 0 20px", lineHeight: 1.5 }}>Are you sure you want to remove this proposal? This cannot be undone.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmCancelId(null)}
                style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${C.inkLine}`, background: "none", color: C.inkText, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Keep it
              </button>
              <button onClick={() => { cancelSession(confirmCancelId); setConfirmCancelId(null); }}
                style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: "#c0392b", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Yes, cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video */}
      {tab === "video" && <VideoSessionTab sessions={sessions} teacher={teacher} zoomLink={zoomLink} meetLink={meetLink} />}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* TEACHER LESSON ROOM                                                */
/* ---------------------------------------------------------------- */
const MOCK_LESSON_LEARNERS = [
  { id: "p1",  name: "Élise Marchand",   instrument: "Piano",   level: "Intermediate" },
  { id: "p2",  name: "Théo Lambert",     instrument: "Piano",   level: "Beginner" },
  { id: "p3",  name: "Lukas Brunner",    instrument: "Piano",   level: "Advanced" },
  { id: "p4",  name: "Polina Sokolova",  instrument: "Piano",   level: "Intermediate" },
  { id: "p5",  name: "Maya Chen",        instrument: "Piano",   level: "Advanced" },
  { id: "p6",  name: "Daniel Osei",      instrument: "Piano",   level: "Beginner" },
  { id: "p7",  name: "Freya Whitlock",   instrument: "Piano",   level: "Intermediate" },
  { id: "p8",  name: "Wei Zhang",        instrument: "Piano",   level: "Advanced" },
  { id: "p9",  name: "Haruto Sato",      instrument: "Piano",   level: "Intermediate" },
  { id: "p10", name: "Ji-woo Kang",      instrument: "Piano",   level: "Beginner" },
  { id: "p11", name: "Anneliese Voss",   instrument: "Piano",   level: "Intermediate" },
  { id: "p12", name: "Nathan Boucher",   instrument: "Piano",   level: "Beginner" },
  { id: "p13", name: "Isla Cooper",      instrument: "Piano",   level: "Intermediate" },
  { id: "p14", name: "Sofia Reyes",      instrument: "Violin",  level: "Intermediate" },
  { id: "p15", name: "Léon Dupont",      instrument: "Cello",   level: "Advanced" },
  { id: "p16", name: "Amara Diallo",     instrument: "Voice",   level: "Beginner" },
  { id: "p17", name: "Ryo Nakamura",     instrument: "Guitar",  level: "Intermediate" },
  { id: "p18", name: "Ingrid Larsson",   instrument: "Flute",   level: "Advanced" },
  { id: "p19", name: "Carlos Mendez",    instrument: "Trumpet", level: "Intermediate" },
  { id: "p20", name: "Yuna Park",        instrument: "Harp",    level: "Advanced" },
  { id: "p21", name: "Lucas Ferreira",   instrument: "Guitar",  level: "Intermediate" },
  { id: "p22", name: "Chloe Dubois",     instrument: "Violin",  level: "Beginner" },
  { id: "p23", name: "Mateo García",     instrument: "Cello",   level: "Advanced" },
  { id: "p24", name: "Aiko Tanaka",      instrument: "Piano",   level: "Intermediate" },
  { id: "p25", name: "Finn O'Brien",     instrument: "Flute",   level: "Beginner" },
  { id: "p26", name: "Zara Ahmed",       instrument: "Violin",  level: "Advanced" },
  { id: "p27", name: "Hugo Laurent",     instrument: "Trumpet", level: "Intermediate" },
  { id: "p28", name: "Nina Kovač",       instrument: "Piano",   level: "Beginner" },
  { id: "p29", name: "Emil Svensson",    instrument: "Cello",   level: "Advanced" },
  { id: "p30", name: "Priya Nair",       instrument: "Sitar",   level: "Intermediate" },
  { id: "p31", name: "Oscar Müller",     instrument: "Oboe",    level: "Beginner" },
  { id: "p32", name: "Lena Fischer",     instrument: "Harp",    level: "Advanced" },
  { id: "p33", name: "Marco Rossi",      instrument: "Violin",  level: "Intermediate" },
  { id: "p34", name: "Sia Nakamura",     instrument: "Piano",   level: "Beginner" },
  { id: "p35", name: "Remy Blanc",       instrument: "Cello",   level: "Advanced" },
  { id: "p36", name: "Aria Patel",       instrument: "Flute",   level: "Intermediate" },
  { id: "p37", name: "Dani Wolff",       instrument: "Oboe",    level: "Beginner" },
  { id: "p38", name: "Tao Chen",         instrument: "Erhu",    level: "Advanced" },
  { id: "p39", name: "Mia Johansson",    instrument: "Violin",  level: "Intermediate" },
  { id: "p40", name: "Bram De Smet",     instrument: "Guitar",  level: "Beginner" },
  { id: "p41", name: "Fatou Diallo",     instrument: "Piano",   level: "Advanced" },
  { id: "p42", name: "Kenji Ito",        instrument: "Shakuhachi", level: "Intermediate" },
  { id: "p43", name: "Iris van Dijk",    instrument: "Violin",  level: "Beginner" },
  { id: "p44", name: "Pablo Ortiz",      instrument: "Trumpet", level: "Advanced" },
  { id: "p45", name: "Lea Hoffmann",     instrument: "Cello",   level: "Intermediate" },
  { id: "p46", name: "Sven Larsson",     instrument: "Piano",   level: "Beginner" },
  { id: "p47", name: "Nour El-Amin",     instrument: "Oud",     level: "Advanced" },
  { id: "p48", name: "Camille Moreau",   instrument: "Harp",    level: "Intermediate" },
  { id: "p49", name: "Enzo Ferrari",     instrument: "Violin",  level: "Beginner" },
  { id: "p50", name: "Yael Cohen",       instrument: "Piano",   level: "Advanced" },
  { id: "p51", name: "Lila Dupont",      instrument: "Flute",   level: "Intermediate" },
  { id: "p52", name: "Tariq Hassan",     instrument: "Cello",   level: "Beginner" },
  { id: "p53", name: "Vera Kuznetsova",  instrument: "Violin",  level: "Advanced" },
  { id: "p54", name: "Jules Martin",     instrument: "Guitar",  level: "Intermediate" },
  { id: "p55", name: "Hana Kimura",      instrument: "Koto",    level: "Beginner" },
  { id: "p56", name: "Diego Méndez",     instrument: "Piano",   level: "Advanced" },
  { id: "p57", name: "Astrid Berg",      instrument: "Cello",   level: "Intermediate" },
  { id: "p58", name: "Kofi Asante",      instrument: "Djembe",  level: "Beginner" },
  { id: "p59", name: "Mei-Ling Zhou",    instrument: "Erhu",    level: "Advanced" },
  { id: "p60", name: "Tom Brennan",      instrument: "Violin",  level: "Intermediate" },
  { id: "p61", name: "Sara Lindqvist",   instrument: "Piano",   level: "Beginner" },
  { id: "p62", name: "Adrien Leroy",     instrument: "Trumpet", level: "Advanced" },
];

/* ---------------------------------------------------------------- */
/* PROMOTE ME — aclassicaltone promotion offer + approval flow        */
/* ---------------------------------------------------------------- */
const TRACK_MAX_SECONDS = 60;
const TRACK_MAX_BYTES = 12 * 1024 * 1024;

/**
 * The artium half of Promote Me: a student's own recording, played across the
 * site once approved.
 *
 * Talks to student_tracks directly rather than going through the signup draft.
 * The draft route only existed inside the profile form, which meant the only
 * way to reach it was to re-open and step through an edit — nobody would have
 * found it, and every re-save risked a duplicate row.
 *
 * The consent checkbox is what makes playing the audio lawful, so the file
 * input stays disabled until it is ticked. Collecting the file first and
 * asking afterwards would mean holding a recording we had no right to.
 */
function ArtiumSoundCard({ myProfile, authUser }) {
  const [mine, setMine] = useState(null);
  const [rights, setRights] = useState(false);
  const [audio, setAudio] = useState({ url: "", name: "" });
  const [title, setTitle] = useState("");
  const [composer, setComposer] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [replacing, setReplacing] = useState(false);

  const uid = authUser?.id || null;

  async function load() {
    if (!uid) return;
    const { data } = await supabase.from("student_tracks")
      .select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(1);
    setMine(data && data[0] ? data[0] : null);
  }
  React.useEffect(() => { load(); const id = setInterval(load, 5000); return () => clearInterval(id); /* eslint-disable-next-line */ }, [uid]);

  async function upload(file) {
    if (!file) return;
    setErr("");
    if (file.size > TRACK_MAX_BYTES) { setErr("That file is over 12 MB. A minute of audio should be well under it."); return; }

    // Read the duration before uploading — refusing a nine-minute take after a
    // slow upload wastes the student's time and our storage.
    const seconds = await new Promise((resolve) => {
      const el = document.createElement("audio");
      el.preload = "metadata";
      el.onloadedmetadata = () => { URL.revokeObjectURL(el.src); resolve(el.duration); };
      el.onerror = () => resolve(NaN);
      el.src = URL.createObjectURL(file);
    });
    if (Number.isFinite(seconds) && seconds > TRACK_MAX_SECONDS + 2) {
      setErr(`That's ${Math.round(seconds)} seconds. Trim it to ${TRACK_MAX_SECONDS} or less — pick the passage you'd want heard first.`);
      return;
    }

    setUploading(true);
    const ext = (file.name.split(".").pop() || "mp3").toLowerCase();
    const path = `tracks/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("student-audio").upload(path, file, { upsert: false, contentType: file.type || undefined });
    setUploading(false);
    if (error) { setErr("Upload failed: " + error.message); return; }
    setAudio({ url: path, name: file.name });
  }

  async function submit() {
    if (!uid || !audio.url || !rights) return;
    setErr(""); setSaving(true);
    // One submission at a time: a new file replaces one still awaiting review
    // rather than queueing a second. Anything approved is left alone — it may
    // be playing on the site right now.
    await supabase.from("student_tracks").delete().eq("user_id", uid).eq("status", "pending");
    const { error } = await supabase.from("student_tracks").insert({
      user_id: uid,
      title: title.trim() || "Untitled",
      composer: composer.trim(),
      audio_url: audio.url,
      audio_name: audio.name,
      rights_confirmed: true,
      status: "pending",
    });
    setSaving(false);
    if (error) { setErr("Could not submit: " + error.message); return; }
    setAudio({ url: "", name: "" }); setTitle(""); setComposer(""); setRights(false); setReplacing(false);
    load();
  }

  const card = PANEL;
  const label = (t) => <span style={{ fontSize: 11, fontWeight: 700, color: C.brassLabel, textTransform: "uppercase", letterSpacing: "0.08em" }}>{t}</span>;
  const publicUrl = (p) => supabase.storage.from("student-audio").getPublicUrl(p).data.publicUrl;

  const STATE = {
    pending:  { colour: C.brassLabel, title: "Waiting for review", body: "Our team listens to every recording before it goes live. This usually takes a day or two." },
    approved: { colour: "#1A9E6E",    title: "Live on Artium",     body: "Visitors hear this when they play the music on Artium." },
    rejected: { colour: C.burgundy,   title: "Not accepted",       body: "This one wasn't right for the site — you're welcome to submit a different recording." },
  };

  if (!uid) {
    return (
      <div style={card}>
        {label("artium")}
        <p style={{ fontSize: 14, color: C.ivoryDim, margin: "10px 0 0" }}>
          Log in with your student account to submit a recording.
        </p>
      </div>
    );
  }

  const s = mine ? STATE[mine.status] : null;
  const showForm = !mine || mine.status === "rejected" || replacing;

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Logo size={17} markSize={26} />
      </div>
      <p style={{ fontSize: 15, fontWeight: 700, color: C.ivory, margin: "10px 0 4px" }}>Be the sound of Artium</p>
      <p style={{ fontSize: 13, color: C.ivoryDim, margin: 0, lineHeight: 1.5 }}>
        Up to {TRACK_MAX_SECONDS} seconds of you playing. Approved recordings become the music
        visitors hear across the site — so choose the passage you'd want heard first.
        <b style={{ color: C.ivory }}> Free.</b>
      </p>

      {mine && (
        <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, border: `1px solid ${s.colour}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: s.colour, display: "inline-block", flexShrink: 0 }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: s.colour }}>{s.title}</span>
          </div>
          <p style={{ fontSize: 13, color: C.ivoryDim, margin: "6px 0 0", lineHeight: 1.5 }}>{s.body}</p>
          <p style={{ fontSize: 13, color: C.ivory, margin: "10px 0 0", fontWeight: 600 }}>
            {mine.title}{mine.composer ? ` · ${mine.composer}` : ""}
          </p>
          <audio controls preload="none" src={publicUrl(mine.audio_url)} style={{ width: "100%", marginTop: 8 }} />
          {!showForm && (
            <button
              onClick={() => setReplacing(true)}
              style={{ marginTop: 10, background: "none", border: "none", padding: 0, font: "inherit", fontSize: 13, fontWeight: 600, color: C.brassLabel, cursor: "pointer", textDecoration: "underline" }}
            >
              {mine.status === "approved" ? "Submit a different recording" : "Replace it"}
            </button>
          )}
        </div>
      )}

      {showForm && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: mine ? `1px solid ${C.inkLine}` : "none" }}>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", marginBottom: 14 }}>
            <input
              type="checkbox"
              checked={rights}
              onChange={(e) => setRights(e.target.checked)}
              style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0, accentColor: C.brass }}
            />
            <span className="text-sm" style={{ color: C.ivory }}>
              This is <b>my own performance</b>, and I give Artium permission to play this excerpt on the site.
            </span>
          </label>

          {audio.url ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <CheckIcon size={18} color="#1A9E6E" />
              <span style={{ fontSize: 14, color: "#1A9E6E", fontWeight: 600 }}>{audio.name}</span>
              <button
                onClick={() => setAudio({ url: "", name: "" })}
                style={{ background: "none", border: "none", padding: 0, font: "inherit", fontSize: 13, color: C.ivoryDim, cursor: "pointer", textDecoration: "underline" }}
              >
                Remove
              </button>
            </div>
          ) : (
            <label
              title={rights ? undefined : "Tick the box above first"}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px",
                borderRadius: 10, border: `1.5px dashed ${C.inkLine}`, background: "rgba(176,146,98,0.05)",
                fontWeight: 600, fontSize: 14,
                color: rights ? C.ivory : C.ivoryDim,
                opacity: rights ? 1 : 0.55,
                cursor: rights && !uploading ? "pointer" : "not-allowed",
              }}
            >
              <Upload size={16} /> {uploading ? "Uploading…" : "Choose an audio file"}
              <input type="file" accept="audio/*" style={{ display: "none" }} disabled={!rights || uploading} onChange={(e) => upload(e.target.files?.[0])} />
            </label>
          )}

          {audio.url && (
            <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 12 }}>
              <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What you're playing" />
              <input style={inputStyle} value={composer} onChange={(e) => setComposer(e.target.value)} placeholder="Composer" />
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            <PrimaryBtn disabled={!audio.url || !rights || saving} onClick={submit}>
              {saving ? "Submitting…" : "Submit for review"}
            </PrimaryBtn>
          </div>

          <p className="text-xs" style={{ color: C.ivoryDim, marginTop: 12, fontFamily: FONT_MONO }}>
            Audio only · max {TRACK_MAX_SECONDS}s · reviewed before it goes live
          </p>
          {err && <p className="text-sm" style={{ color: C.burgundy, marginTop: 10 }}>{err}</p>}
        </div>
      )}
    </div>
  );
}

function PromoteMe({ myProfile, authUser }) {
  // Two unrelated offers on one screen read as a single long form, so the tab
  // opens on a choice and each one gets the screen to itself.
  const [view, setView] = useState(null);   // null | "artium" | "aclassicaltone"
  const isRealUser = !!authUser?.id;
  const lsKey = "artium_promotions";

  const [videoLink, setVideoLink] = useState("");
  const [captionPref, setCaptionPref] = useState("bio");
  const [captionCustom, setCaptionCustom] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mine, setMine] = useState(null);       // my latest submission
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState("");

  const provider = detectPromoProvider(videoLink);
  const linkValid = !!provider;

  // ---- storage helpers (Supabase for real users, localStorage for demo) ----
  function readLocal() { try { return JSON.parse(localStorage.getItem(lsKey) || "[]"); } catch { return []; } }
  function writeLocal(arr) { localStorage.setItem(lsKey, JSON.stringify(arr)); }

  async function loadMine() {
    if (isRealUser) {
      const { data } = await supabase.from("promotions").select("*").eq("user_id", authUser.id).order("created_at", { ascending: false }).limit(1);
      setMine(data && data[0] ? data[0] : null);
    } else {
      const arr = readLocal();
      const uid = myProfile?.id || "demo-teacher";
      const mineArr = arr.filter((p) => p.user_id === uid).sort((a, b) => b.created_at.localeCompare(a.created_at));
      setMine(mineArr[0] || null);
    }
  }
  React.useEffect(() => { loadMine(); const id = setInterval(loadMine, 4000); return () => clearInterval(id); /* eslint-disable-next-line */ }, []);

  async function submit() {
    setError("");
    if (!linkValid) { setError("Please use a link from Google Drive, Dropbox, OneDrive, YouTube or WeTransfer only."); return; }
    if (!date) { setError("Please propose a date for your post."); return; }
    setSubmitting(true);
    const caption = captionPref === "bio" ? "Use my bio" : captionCustom.trim() || "Custom (to be provided)";
    const row = {
      user_id: isRealUser ? authUser.id : (myProfile?.id || "demo-teacher"),
      name: myProfile?.name || "Student",
      video_link: videoLink.trim(),
      provider,
      caption,
      proposed_date: date,
      proposed_time: time || null,
      status: "pending",
      created_at: new Date().toISOString(),
    };
    if (isRealUser) {
      const { error: e } = await supabase.from("promotions").insert(row);
      if (e) { setError(e.message); setSubmitting(false); return; }
    } else {
      const arr = readLocal(); arr.push({ id: "promo-" + Date.now(), ...row }); writeLocal(arr);
    }
    setSubmitting(false);
    setVideoLink("");
    loadMine();
  }

  async function payForPromo() {
    setPayLoading(true); setPayError("");
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({
          teacherId: myProfile?.id || "promo",
          teacherName: `aclassicaltone promotion — ${myProfile?.name || "Student"}`,
          amount: PROMO_TOTAL,
          currency: "eur",
          successUrl: window.location.origin + "?promo=success",
          cancelUrl: window.location.origin + "?promo=cancel",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.url) throw new Error(data?.error || "Could not start checkout");
      window.location.href = data.url;
    } catch (e) { setPayError(e.message); setPayLoading(false); }
  }

  const approved = mine?.status === "approved";
  const awaiting = mine?.status === "pending";
  const rejected = mine?.status === "rejected";

  const label = (t) => <span style={{ fontSize: 11, fontWeight: 700, color: C.brassLabel, textTransform: "uppercase", letterSpacing: "0.08em" }}>{t}</span>;
  const card = PANEL;

  return (
    <div style={{ padding: "20px 16px 40px", background: C.ink, minHeight: "100%", fontFamily: FONT_BODY }}>
      <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Header */}
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Megaphone size={20} color={C.brassLabel} />
            <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 700, color: C.ivory, margin: 0 }}>Promote Me</h2>
          </div>
          <p style={{ fontSize: 13, color: C.ivoryDim, margin: 0, lineHeight: 1.5 }}>
            Two ways to be heard — on <a href="https://www.instagram.com/aclassicaltone?igsh=MTZzdzk3bWo5OGdkbA==" target="_blank" rel="noreferrer" style={{ color: C.brassLabel, fontWeight: 600, textDecoration: "none" }}>aclassicaltone</a>, and on Artium itself.
          </p>
        </div>

        {!view && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
            {[
              { v: "artium", t: "artium", d: "Your recording, played across the site. Free." },
              { v: "aclassicaltone", t: "aclassicaltone", d: `A promotional video to their audience. €${PROMO_TOTAL}.` },
            ].map(({ v, t, d }) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                  width: "100%", textAlign: "left", padding: "18px 20px", borderRadius: 999,
                  border: `1px solid ${C.inkLine}`, background: "rgba(176,146,98,0.05)", cursor: "pointer",
                  font: "inherit", boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 16, fontWeight: 800, color: C.ivory, letterSpacing: -0.3 }}>{t}</span>
                  <span style={{ display: "block", fontSize: 13, color: C.ivoryDim, marginTop: 2 }}>{d}</span>
                </span>
                <ChevronRight size={18} color={C.brassLabel} style={{ flexShrink: 0 }} />
              </button>
            ))}
          </div>
        )}

        {view && (
          <button
            onClick={() => setView(null)}
            style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, font: "inherit", fontSize: 13, fontWeight: 600, color: C.ivoryDim, cursor: "pointer" }}
          >
            <ArrowLeft size={14} /> Both options
          </button>
        )}

        {view === "artium" && <ArtiumSoundCard myProfile={myProfile} authUser={authUser} />}

        {view === "aclassicaltone" && (<>
        {/* Offer */}
        <div style={card}>
          {label("What you get")}
          <ul style={{ margin: "12px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 9 }}>
            {PROMO_OFFER.map((o, i) => (
              <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 14, color: C.ivory, lineHeight: 1.4 }}>
                <CheckIcon size={16} color="#1A9E6E" style={{ flexShrink: 0, marginTop: 2 }} /> {o}
              </li>
            ))}
            <li style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 14, color: "#1A9E6E", fontWeight: 600, lineHeight: 1.4 }}>
              <Plus size={16} color="#1A9E6E" style={{ flexShrink: 0, marginTop: 2 }} /> {PROMO_BONUS} <span style={{ color: C.ivoryDim, fontWeight: 500 }}>(free bonus)</span>
            </li>
          </ul>
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.inkLine}`, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 13, color: C.ivoryDim }}>€{PROMO_RATE} / service · 5 services</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: C.ivory }}>€{PROMO_TOTAL}</span>
          </div>
        </div>

        {/* Submission form (hidden once submitted, unless rejected) */}
        {(!mine || rejected) && (
          <div style={card}>
            {label("Your promotional video")}
            <p style={{ fontSize: 12, color: C.ivoryDim, margin: "8px 0 10px", lineHeight: 1.5 }}>
              Paste a link from <b>Google Drive, Dropbox, OneDrive, YouTube</b> or <b>WeTransfer</b> only.
            </p>
            <input
              value={videoLink}
              onChange={(e) => setVideoLink(e.target.value)}
              placeholder="https://drive.google.com/..."
              style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: `1.5px solid ${videoLink && !linkValid ? C.burgundy : C.inkLine}`, fontSize: 14, fontFamily: FONT_BODY, boxSizing: "border-box", outline: "none" }}
            />
            {videoLink && (
              <p style={{ fontSize: 12, margin: "6px 2px 0", color: linkValid ? "#1A9E6E" : C.burgundy }}>
                {linkValid ? `✓ ${provider} link accepted` : "✕ Only Google Drive, Dropbox, OneDrive, YouTube or WeTransfer links are accepted"}
              </p>
            )}

            <div style={{ marginTop: 16 }}>{label("Dedicated caption")}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              {[{ v: "bio", t: "Use my bio" }, { v: "custom", t: "Custom text" }].map(({ v, t }) => (
                <button key={v} onClick={() => setCaptionPref(v)}
                  style={{ padding: "7px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(176,146,98,0.05)", color: captionPref === v ? C.ivory : C.ivoryDim, border: captionPref === v ? `2px solid ${C.brass}` : `1px solid ${C.inkLine}` }}>{t}</button>
              ))}
            </div>
            {captionPref === "custom" && (
              <textarea value={captionCustom} onChange={(e) => setCaptionCustom(e.target.value)} placeholder="Write the caption you'd like…" rows={3}
                style={{ width: "100%", marginTop: 8, padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${C.inkLine}`, fontSize: 14, fontFamily: FONT_BODY, boxSizing: "border-box", outline: "none", resize: "vertical" }} />
            )}

            <div style={{ marginTop: 16 }}>{label("Propose a date & time")}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${C.inkLine}`, fontSize: 14, fontFamily: FONT_BODY, boxSizing: "border-box", outline: "none" }} />
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${C.inkLine}`, fontSize: 14, fontFamily: FONT_BODY, boxSizing: "border-box", outline: "none" }} />
            </div>
            <p style={{ fontSize: 12, color: C.brassLabel, margin: "8px 2px 0", display: "flex", alignItems: "center", gap: 5 }}>
              <Clock size={13} /> Tip: posts get better reach on weekends.
            </p>

            {error && <p style={{ fontSize: 13, color: C.burgundy, margin: "12px 0 0" }}>{error}</p>}
            <button onClick={submit} disabled={submitting}
              style={{ marginTop: 16, width: "100%", padding: "13px 0", borderRadius: 12, border: "none", background: C.brass, color: C.brassText, fontSize: 15, fontWeight: 700, cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.7 : 1 }}>
              {submitting ? "Submitting…" : "Submit for approval"}
            </button>
          </div>
        )}

        {/* Status + payment */}
        {mine && !rejected && (
          <div style={card}>
            {label("Status")}
            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0 4px" }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: approved ? "#1A9E6E" : C.brass, display: "inline-block" }} />
              <span style={{ fontSize: 15, fontWeight: 700, color: approved ? "#1A9E6E" : C.brassLabel }}>
                {approved ? "Approved" : "Awaiting approval"}
              </span>
            </div>
            <p style={{ fontSize: 13, color: C.ivoryDim, margin: "0 0 4px", lineHeight: 1.5 }}>
              {approved
                ? "Your video was approved. You can now complete your payment to book your promotion."
                : "Your video link was received and is awaiting approval by the Artium team. You'll be able to pay once it's approved."}
            </p>
            <p style={{ fontSize: 12, color: C.ivoryDim, margin: "8px 0 0", wordBreak: "break-all" }}>
              <b>{mine.provider}</b> · {mine.video_link}
            </p>

            <div style={{ marginTop: 16, position: "relative" }}>
              <button onClick={approved ? payForPromo : undefined} disabled={!approved || payLoading}
                title={approved ? "" : "Available after approval"}
                style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none", background: "#635BFF", color: "#fff", fontSize: 15, fontWeight: 700, cursor: approved ? (payLoading ? "default" : "pointer") : "not-allowed", opacity: approved ? 1 : 0.4, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <CreditCard size={17} /> {payLoading ? "Redirecting…" : `Pay €${PROMO_TOTAL} with Stripe`}
              </button>
              {!approved && <p style={{ fontSize: 11, color: C.ivoryDim, textAlign: "center", margin: "8px 0 0" }}>🔒 Unlocks once your video is approved</p>}
              {payError && <p style={{ fontSize: 13, color: C.burgundy, textAlign: "center", margin: "8px 0 0" }}>{payError}</p>}
            </div>
          </div>
        )}

        {rejected && (
          <div style={{ ...card, background: "#FDECEC" }}>
            <p style={{ fontSize: 14, color: C.burgundy, fontWeight: 600, margin: 0 }}>Your previous link wasn't approved. Please submit a new video link above.</p>
          </div>
        )}
        </>)}

      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* ADMIN — owner-only promotion approvals                             */
/* ---------------------------------------------------------------- */
function AdminScreen({ authUser, onlineCount }) {
  const isRealUser = !!authUser?.id;
  const lsKey = "artium_promotions";
  const [section, setSection] = useState("verifications");
  const [tab, setTab] = useState("pending");
  const [rows, setRows] = useState([]);

  function readLocal() { try { return JSON.parse(localStorage.getItem(lsKey) || "[]"); } catch { return []; } }
  function writeLocal(arr) { localStorage.setItem(lsKey, JSON.stringify(arr)); }

  async function load() {
    if (isRealUser) {
      const { data } = await supabase.from("promotions").select("*").order("created_at", { ascending: false });
      setRows(data || []);
    } else {
      setRows(readLocal().sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")));
    }
  }
  React.useEffect(() => { load(); const id = setInterval(load, 4000); return () => clearInterval(id); /* eslint-disable-next-line */ }, []);

  async function setStatus(promo, status) {
    if (isRealUser) {
      await supabase.from("promotions").update({ status }).eq("id", promo.id);
    } else {
      writeLocal(readLocal().map((p) => (p.id === promo.id ? { ...p, status } : p)));
    }
    load();
  }

  const pending = rows.filter((r) => r.status === "pending");
  const decided = rows.filter((r) => r.status !== "pending");
  const shown = tab === "pending" ? pending : decided;
  const card = { ...PANEL, padding: "16px 16px" };
  const STATUS_COLOR = { approved: "#1A9E6E", rejected: C.burgundy, pending: C.brassLabel };

  return (
    <div style={{ padding: "20px 16px 40px", background: C.ink, minHeight: "100%", fontFamily: FONT_BODY }}>
      <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <ShieldCheck size={20} color={C.brassLabel} />
            <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 700, color: C.ivory, margin: 0 }}>Admin</h2>
          </div>
          <p style={{ fontSize: 13, color: C.ivoryDim, margin: 0 }}>Review student verifications and promotions.</p>
          {/* The live figure that used to sit in every header. How many people
              are connected this second is an operational number, not something
              a visitor needs on the way in — so it lives here and nowhere
              else. The green dot is the same mark it always carried. */}
          {onlineCount != null && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, padding: "5px 12px", borderRadius: 999, background: "rgba(176,146,98,0.06)", border: `1px solid ${C.inkLine}`, fontSize: 12, color: C.ivoryDim }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#1A9E6E", display: "inline-block", flexShrink: 0 }} />
              <span style={{ color: C.ivory, fontWeight: 600 }}>{onlineCount}</span> online now
            </span>
          )}
        </div>

        {/* Section toggle */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          {[{ v: "verifications", t: "Student verifications" }, { v: "conservatories", t: "Conservatories" }, { v: "tracks", t: "Recordings" }, { v: "promotions", t: "Promotions" }].map(({ v, t }) => (
            <button key={v} onClick={() => setSection(v)}
              style={{ padding: "9px 18px", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer", background: section === v ? "linear-gradient(180deg, #EFD08A 0%, #DBAB4C 55%, #C9962E 100%)" : "rgba(176,146,98,0.07)", color: section === v ? C.brassText : C.ivoryDim, border: section === v ? "none" : `1px solid ${C.inkLine}` }}>{t}</button>
          ))}
        </div>

        {section === "verifications" && <AdminVerifications card={card} STATUS_COLOR={STATUS_COLOR} />}
        {section === "conservatories" && <AdminConservatories card={card} />}
        {section === "tracks" && <AdminTracks card={card} STATUS_COLOR={STATUS_COLOR} />}

        {section === "promotions" && <>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          {[{ v: "pending", t: `Pending (${pending.length})` }, { v: "history", t: `History (${decided.length})` }].map(({ v, t }) => (
            <button key={v} onClick={() => setTab(v)}
              style={{ padding: "8px 16px", borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(176,146,98,0.05)", color: tab === v ? C.ivory : C.ivoryDim, border: tab === v ? `2px solid ${C.brass}` : `1px solid ${C.inkLine}` }}>{t}</button>
          ))}
        </div>

        {shown.length === 0 ? (
          <div style={{ ...card, textAlign: "center" }}>
            <p style={{ fontSize: 14, color: C.ivoryDim, margin: 0 }}>{tab === "pending" ? "No submissions awaiting approval." : "No reviewed submissions yet."}</p>
          </div>
        ) : shown.map((p) => (
          <div key={p.id} style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: C.ivory, margin: 0 }}>{p.name}</p>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: STATUS_COLOR[p.status] || C.ivoryDim }}>{p.status}</span>
            </div>
            <p style={{ fontSize: 12, color: C.ivoryDim, margin: "0 0 4px" }}>
              <b>{p.provider}</b> · post {p.proposed_date}{p.proposed_time ? ` · ${p.proposed_time}` : ""}
            </p>
            <a href={p.video_link} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: C.brassLabel, wordBreak: "break-all" }}>{p.video_link}</a>
            <p style={{ fontSize: 12, color: C.ivoryDim, margin: "6px 0 0" }}>Caption: {p.caption}</p>
            {p.status === "pending" && (
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button onClick={() => setStatus(p, "approved")} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: "#1A9E6E", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Approve</button>
                <button onClick={() => setStatus(p, "rejected")} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${C.inkLine}`, background: "rgba(176,146,98,0.05)", color: C.burgundy, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Reject</button>
              </div>
            )}
            {p.status !== "pending" && (
              <button onClick={() => setStatus(p, "pending")} style={{ marginTop: 12, padding: "7px 14px", borderRadius: 9, border: `1px solid ${C.inkLine}`, background: "rgba(176,146,98,0.05)", color: C.ivoryDim, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Reset to pending</button>
            )}
          </div>
        ))}
        </>}
      </div>
    </div>
  );
}

/* Admin — student document-verification review (4-column table) */
/**
 * Review queue for student recordings. Listen, then approve or reject —
 * approved tracks become the audio every visitor hears, so nothing reaches
 * the player without someone having actually played it here first.
 */
function AdminTracks({ card, STATUS_COLOR }) {
  const [rows, setRows] = useState([]);
  const [names, setNames] = useState({});
  const [busy, setBusy] = useState("");

  async function load() {
    const { data } = await supabase.from("student_tracks").select("*").order("created_at", { ascending: false });
    const list = data || [];
    setRows(list);
    // student_tracks.user_id references auth.users, not profiles, so PostgREST
    // has no relationship to embed — the names are fetched and joined here.
    const ids = [...new Set(list.map((r) => r.user_id).filter(Boolean))];
    if (ids.length) {
      const { data: people } = await supabase.from("profiles").select("id, name").in("id", ids);
      setNames(Object.fromEntries((people || []).map((p) => [p.id, p.name])));
    }
  }
  React.useEffect(() => { load(); const id = setInterval(load, 5000); return () => clearInterval(id); /* eslint-disable-next-line */ }, []);

  function publicUrl(path) {
    return supabase.storage.from("student-audio").getPublicUrl(path).data.publicUrl;
  }

  async function decide(r, status) {
    setBusy(r.id);
    const { data, error } = await supabase.from("student_tracks")
      .update({ status }).eq("id", r.id).select("id");
    setBusy("");
    if (error) { alert(`Could not update this recording: ${error.message}`); return; }
    if (!data || data.length === 0) {
      alert("No row was changed — row-level security blocked the write. The recording is unchanged.");
      return;
    }
    load();
  }

  const pending = rows.filter((r) => r.status === "pending");
  const decided = rows.filter((r) => r.status !== "pending");

  function List({ list, editable }) {
    if (list.length === 0) {
      return (
        <div style={{ ...card, textAlign: "center" }}>
          <p style={{ fontSize: 14, color: C.ivoryDim, margin: 0 }}>
            {editable ? "No recordings waiting for review." : "Nothing reviewed yet."}
          </p>
        </div>
      );
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {list.map((r) => (
          <div key={r.id} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{r.title}</p>
                <p style={{ margin: "2px 0 0", fontSize: 13, color: C.ivoryDim }}>
                  {r.composer ? `${r.composer} · ` : ""}{names[r.user_id] || "Unknown student"}
                </p>
              </div>
              {!editable && (
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: STATUS_COLOR[r.status] || C.ivoryDim }}>
                  {r.status}
                </span>
              )}
            </div>

            <audio controls preload="none" src={publicUrl(r.audio_url)} style={{ width: "100%", marginTop: 12 }} />

            <p style={{ margin: "10px 0 0", fontSize: 11, fontFamily: FONT_MONO, color: r.rights_confirmed ? "#1A9E6E" : C.burgundy }}>
              {r.rights_confirmed
                ? "✓ Confirmed as their own performance, cleared for use"
                : "✕ No permission recorded — do not publish"}
            </p>

            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              {editable ? (
                <>
                  <button
                    disabled={busy === r.id || !r.rights_confirmed}
                    onClick={() => decide(r, "approved")}
                    title={r.rights_confirmed ? undefined : "No permission was recorded for this recording"}
                    style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: r.rights_confirmed ? "#1A9E6E" : C.inkLine, color: "#fff", fontSize: 12, fontWeight: 700, cursor: r.rights_confirmed ? "pointer" : "not-allowed" }}
                  >
                    Approve
                  </button>
                  <button disabled={busy === r.id} onClick={() => decide(r, "rejected")}
                    style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.inkLine}`, background: "rgba(176,146,98,0.05)", color: C.burgundy, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    Reject
                  </button>
                </>
              ) : (
                <button onClick={() => decide(r, "pending")}
                  style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${C.inkLine}`, background: "rgba(176,146,98,0.05)", color: C.ivoryDim, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  Reset
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.brassLabel, letterSpacing: "0.06em", margin: 0 }}>
        PENDING ({pending.length})
      </p>
      <List list={pending} editable />
      <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.brassLabel, letterSpacing: "0.06em", margin: "6px 0 0" }}>
        HISTORY ({decided.length})
      </p>
      <List list={decided} editable={false} />
    </div>
  );
}

// Which addresses each school accepts, and a way to change them.
//
// Until now this was a SQL edit. Fine for a one-off and wrong for something
// that happens whenever a conservatory migrates — the person who knows the new
// address is the one reading the request, and sending them to a query editor
// to hand-write an array is how the wrong domain ends up on the wrong school.
//
// The screen edits approved_conservatories, which is the patch layer: the
// roster carries what shipped, and an approved row overrides it. So clearing a
// school's domains here does not leave it with none — it falls back to the
// built-in, which is said out loud below rather than left to be discovered.
function AdminConservatories({ card }) {
  const [roster, setRoster] = useState([]);
  const [approved, setApproved] = useState([]);
  const [q, setQ] = useState("");
  const [drafts, setDrafts] = useState({});   // school id -> string[]
  const [adding, setAdding] = useState({});   // school id -> input text
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState(null);

  async function load() {
    const [r, a] = await Promise.all([
      supabase.from("conservatory_roster").select("id, name, short, city, country, domains").order("name"),
      supabase.from("approved_conservatories").select("id, name, address, domains").order("name"),
    ]);
    setRoster(r.data || []);
    setApproved(a.data || []);
  }
  React.useEffect(() => { load(); }, []);

  // One row per school, the same composition the database uses: an approved
  // row's domains win over the roster's; a school that exists only as an
  // approved row stands on its own.
  const schools = React.useMemo(() => {
    const patch = Object.create(null);
    for (const a of approved) {
      const d = (Array.isArray(a.domains) ? a.domains : []).map((x) => String(x).toLowerCase());
      patch[normalizeName(a.name)] = { domains: d, address: a.address || "" };
    }
    const out = [];
    const seen = new Set();
    for (const c of roster) {
      const key = normalizeName(c.name);
      const own = (Array.isArray(c.domains) ? c.domains : []).map((x) => String(x).toLowerCase());
      const p = patch[key];
      out.push({
        id: c.id, name: c.name,
        where: [c.city, c.country].filter(Boolean).join(", "),
        builtIn: own,
        domains: p && p.domains.length ? p.domains : own,
        overridden: !!(p && p.domains.length),
      });
      seen.add(key);
    }
    for (const a of approved) {
      const key = normalizeName(a.name);
      if (seen.has(key)) continue;
      out.push({
        id: a.id, name: a.name, where: a.address || "",
        builtIn: [], domains: (Array.isArray(a.domains) ? a.domains : []).map((x) => String(x).toLowerCase()),
        overridden: true,
      });
    }
    return out;
  }, [roster, approved]);

  const shown = React.useMemo(() => {
    const needle = normalizeName(q);
    const list = needle
      ? schools.filter((c) => normalizeName(c.name).includes(needle)
          || normalizeName(c.where).includes(needle)
          || c.domains.some((d) => d.includes(needle)))
      : schools;
    // All of them. The cap was there in case a hundred rows of inputs felt
    // heavy, and it does not — what it actually did was hide two thirds of the
    // list behind a search box, on the one screen whose job is to let you look
    // at the list.
    return list;
  }, [schools, q]);

  const draftOf = (c) => (drafts[c.id] !== undefined ? drafts[c.id] : c.domains);
  const dirty = (c) => JSON.stringify(draftOf(c)) !== JSON.stringify(c.domains);

  function toggle(c, d) {
    const cur = draftOf(c);
    setDrafts((x) => ({ ...x, [c.id]: cur.includes(d) ? cur.filter((v) => v !== d) : [...cur, d] }));
  }
  function addDomain(c) {
    const raw = (adding[c.id] || "").trim().toLowerCase().replace(/^@/, "");
    if (!raw) return;
    // The same refusal as signup. A personal-mail domain here would not add a
    // school, it would hand every account at that provider the ability to
    // verify as one — the mistake that put gmail.com on Juilliard.
    if (FREE_MAIL.has(raw)) { setNote({ bad: true, text: `${raw} is a personal-mail provider — a school cannot use it.` }); return; }
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(raw)) { setNote({ bad: true, text: `"${raw}" doesn't look like a domain.` }); return; }
    const cur = draftOf(c);
    if (!cur.includes(raw)) setDrafts((x) => ({ ...x, [c.id]: [...cur, raw] }));
    setAdding((x) => ({ ...x, [c.id]: "" }));
    setNote(null);
  }

  async function save(c) {
    setBusy(c.id); setNote(null);
    const next = draftOf(c);
    const { error } = await supabase.from("approved_conservatories")
      .upsert({ name: c.name, address: c.where || "", domains: next }, { onConflict: "name" });
    setBusy("");
    if (error) { setNote({ bad: true, text: error.message }); return; }
    setDrafts((x) => { const n = { ...x }; delete n[c.id]; return n; });
    setNote({ bad: false, text: next.length
      ? `${c.name} now accepts ${next.map((d) => "@" + d).join(", ")}.`
      : `${c.name} is back to its built-in ${c.builtIn.map((d) => "@" + d).join(", ") || "(none)"}.` });
    load();
  }

  const chip = (on) => ({
    display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 999,
    border: `1px solid ${on ? "rgba(26,158,110,0.55)" : C.inkLine}`,
    background: on ? "rgba(26,158,110,0.12)" : "rgba(176,146,98,0.07)",
    color: on ? C.ivory : C.ivoryDim, fontSize: 12, fontWeight: 600, cursor: "pointer",
  });

  return (
    <div style={{ ...card }}>
      <p style={{ margin: "0 0 4px", fontFamily: FONT_DISPLAY, fontSize: 19, fontWeight: 600, color: C.ivory }}>Conservatories</p>
      <p className="text-sm" style={{ margin: "0 0 14px", color: C.ivoryDim, lineHeight: 1.5 }}>
        Which email addresses each school accepts. Untick one to stop it verifying anybody; add one when a school moves.
      </p>

      <span className="artium-aw-field" style={{ marginBottom: 12 }}>
        <Search size={15} strokeWidth={2} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by school, place, or domain" />
      </span>

      {note && (
        <p className="text-sm" style={{ margin: "0 0 10px", color: note.bad ? C.burgundy : "#1A9E6E" }}>{note.text}</p>
      )}

      {shown.length === 0 && <p className="text-sm" style={{ color: C.ivoryDim }}>No school matches that.</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {shown.map((c) => {
          const d = draftOf(c);
          // Everything ever associated with the school, so a domain removed a
          // moment ago can be put back without retyping it.
          const universe = [...new Set([...c.builtIn, ...c.domains, ...d])];
          return (
            <div key={c.id} style={{ border: `1px solid ${C.inkLine}`, borderRadius: 12, padding: "11px 13px", background: "rgba(176,146,98,0.03)" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <p style={{ margin: 0, fontWeight: 700, color: C.ivory, fontSize: 14 }}>{c.name}</p>
                {c.where && <p style={{ margin: 0, fontSize: 11.5, color: C.ivoryDim }}>{c.where}</p>}
                {c.overridden && <span style={{ fontSize: 10, color: C.brassLabel, fontFamily: FONT_MONO }}>EDITED</span>}
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {universe.map((dom) => {
                  const on = d.includes(dom);
                  return (
                    <button key={dom} onClick={() => toggle(c, dom)} style={chip(on)} title={on ? "Accepted — click to stop accepting it" : "Not accepted — click to accept it"}>
                      {on ? <CheckIcon size={12} strokeWidth={3} /> : null}@{dom}
                    </button>
                  );
                })}
                {universe.length === 0 && <span style={{ fontSize: 11.5, color: C.ivoryDim }}>No domain — this school verifies by document only.</span>}
              </div>

              <div style={{ display: "flex", gap: 6, marginTop: 9, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  value={adding[c.id] || ""}
                  onChange={(e) => setAdding((x) => ({ ...x, [c.id]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDomain(c); } }}
                  placeholder="add a domain, e.g. stud.school.edu"
                  style={{ flex: "1 1 180px", minWidth: 150, padding: "7px 10px", borderRadius: 8, border: `1px solid ${C.inkLine}`, background: "rgba(176,146,98,0.05)", color: C.ivory, fontSize: 12, outline: "none" }}
                />
                <button onClick={() => addDomain(c)} style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${C.inkLine}`, background: "rgba(176,146,98,0.05)", color: C.ivoryDim, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Add</button>
                <button
                  onClick={() => save(c)}
                  disabled={!dirty(c) || busy === c.id}
                  style={{ padding: "7px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 700,
                    background: dirty(c) ? "linear-gradient(180deg, #EFD08A 0%, #DBAB4C 55%, #C9962E 100%)" : "rgba(176,146,98,0.05)",
                    color: dirty(c) ? C.brassText : C.ivoryDim, cursor: dirty(c) ? "pointer" : "not-allowed" }}
                >{busy === c.id ? "Saving…" : "Save"}</button>
              </div>

              {dirty(c) && d.length === 0 && c.builtIn.length > 0 && (
                <p className="text-sm" style={{ margin: "7px 0 0", color: C.brassLabel, lineHeight: 1.45 }}>
                  With none ticked this school goes back to its built-in {c.builtIn.map((x) => "@" + x).join(", ")}, not to none at all.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-sm" style={{ margin: "12px 0 0", color: C.ivoryDim }}>
        {q ? `${shown.length} of ${schools.length} schools` : `${schools.length} schools`}
      </p>
    </div>
  );
}

function AdminVerifications({ card, STATUS_COLOR }) {
  const [rows, setRows] = useState([]);
  const [edits, setEdits] = useState({}); // id -> { conservatory_name, conservatory_address }
  const [busy, setBusy] = useState("");
  const [reading, setReading] = useState("");

  async function load() {
    const { data } = await supabase.from("student_verifications").select("*").order("created_at", { ascending: false });
    setRows(data || []);
  }
  React.useEffect(() => { load(); const id = setInterval(load, 5000); return () => clearInterval(id); /* eslint-disable-next-line */ }, []);

  // Everything already on the map, so a request can be checked against it
  // before it becomes a second copy of something.
  const [known, setKnown] = useState([]);
  React.useEffect(() => {
    let live = true;
    Promise.all([
      supabase.from("conservatory_roster").select("id, name, city, country, domains"),
      supabase.from("approved_conservatories").select("id, name, address, domains"),
    ]).then(([a, b]) => {
      if (!live) return;
      // Roster first, then approved rows that are not already the same school
      // by name. A school lives in both once its domain has been approved —
      // the roster entry and the approved row that patched it — and offering
      // the same name twice invites picking the wrong one.
      // Domains come along so the approve screen can say which address it is
      // about to replace. An approved row wins over the roster's, the same
      // rule the database uses when it answers the question for real.
      const patched = Object.create(null);
      for (const c of b.data || []) {
        const d = (Array.isArray(c.domains) ? c.domains : []).map((x) => String(x).toLowerCase());
        if (d.length) patched[normalizeName(c.name)] = d;
      }
      const merged = [];
      const seenNames = new Set();
      for (const c of a.data || []) {
        const key = normalizeName(c.name);
        const own = (Array.isArray(c.domains) ? c.domains : []).map((x) => String(x).toLowerCase());
        merged.push({
          id: c.id, name: c.name,
          where: [c.city, c.country].filter(Boolean).join(", "),
          domains: patched[key] || own,
          roster: true,
        });
        seenNames.add(key);
      }
      for (const c of b.data || []) {
        if (seenNames.has(normalizeName(c.name))) continue;
        merged.push({
          id: c.id, name: c.name, where: c.address || "",
          domains: (Array.isArray(c.domains) ? c.domains : []).map((x) => String(x).toLowerCase()),
          roster: false,
        });
        seenNames.add(normalizeName(c.name));
      }
      setKnown(merged);
    });
    return () => { live = false; };
  }, []);

  // Two Cortot rows reached the roster with the same street address under two
  // different names — "ECOLE" and "ecole fredy cortot" — because the same
  // school was requested twice and nothing compared them. The merge written
  // for this only folds an approved row into a roster school by name, so two
  // requests spelled differently never met.
  //
  // Matching addresses automatically would be worse than useless: "115 Rue
  // Louis Guérin" and "115 rue Louis Guerin, Villeurbanne" are the same place
  // and do not compare equal, while a shared campus address can belong to two
  // genuinely different schools. So this suggests rather than decides. A human
  // reading two names side by side is right immediately; code guessing quietly
  // merges things that should not be.
  function looksLike(name, address) {
    const n = normalizeName(name), a = normalizeName(address);
    if (!n && !a) return [];
    const street = a.split(",")[0].trim();
    return known.filter((k) => {
      const kn = normalizeName(k.name), kw = normalizeName(k.where);
      if (!kn) return false;
      if (kn === n) return true;
      // one name contained in the other: "ECOLE" inside "ecole fredy cortot"
      if (n.length >= 4 && (kn.includes(n) || n.includes(kn))) return true;
      // same street line, however the rest of the address was typed
      if (street.length >= 6 && kw && kw.split(",")[0].trim() === street) return true;
      return false;
    }).slice(0, 3);
  }

  function fieldVal(r, key) {
    return edits[r.id]?.[key] !== undefined ? edits[r.id][key] : (r[key] || "");
  }
  function setField(r, key, val) {
    setEdits((e) => ({ ...e, [r.id]: { ...e[r.id], [key]: val } }));
  }

  // Which school this request is being approved as: an existing one, or a new
  // one you are deliberately creating.
  //
  // It used to be two text boxes prefilled with whatever the student typed,
  // and Approve took them as they stood. That is how the roster got "ECOLE"
  // and "ecole fredy cortot" at one address: nothing had to be decided, so
  // nothing was. Suggesting the existing entry helped, but a suggestion can be
  // scrolled past, and a school with a different name at a different address —
  // CNSMDP against Conservatoire de Paris — offers nothing to suggest from.
  //
  // So the choice is the step. Approve stays shut until one is made, and
  // creating a second copy of something means saying so.
  // What the applicant is told when turned down. Required, and stored on the
  // row, so the sentence they read and the sentence in the queue are the same
  // one — a rejection reconstructed from memory weeks later is worse than none.
  // Whether a newly approved domain joins the school's existing ones or
  // replaces them. Replacing is the default because a school that changed its
  // address has changed it; keeping both is for the year or two of a migration
  // when students are genuinely on either.
  const [keepDomains, setKeepDomains] = useState({});

  const [reasons, setReasons] = useState({});
  const reasonOf = (r) => (reasons[r.id] || "").trim();

  const [picks, setPicks] = useState({});   // request id -> { mode, id, name, where }
  const [pickQ, setPickQ] = useState({});   // request id -> search text
  const pickOf = (r) => picks[r.id] || null;

  function choose(r, k) {
    setPicks((p) => ({ ...p, [r.id]: { mode: "existing", id: k.id, name: k.name, where: k.where, roster: !!k.roster } }));
    // decide() reads these, and approving under the existing name is what
    // makes the database fold the domain into that school instead of adding a
    // row beside it.
    setField(r, "conservatory_name", k.name);
    if (k.where && !k.roster) setField(r, "conservatory_address", k.where);
  }

  function chooseNew(r) {
    setPicks((p) => ({ ...p, [r.id]: { mode: "new" } }));
  }

  function clearPick(r) {
    setPicks((p) => { const n = { ...p }; delete n[r.id]; return n; });
  }

  // The search is over everything already on the map. Ranked so an exact or
  // contained name comes before a loose word match, because the one you want
  // is nearly always the one that looks most like what was typed.
  function searchKnown(r) {
    const typed = normalizeName(fieldVal(r, "conservatory_name"));
    const q = normalizeName(pickQ[r.id] !== undefined ? pickQ[r.id] : fieldVal(r, "conservatory_name"));
    if (!q) return known.slice(0, 6);
    const scored = known
      .map((k) => {
        const kn = normalizeName(k.name);
        let score = -1;
        if (kn === q) score = 0;
        else if (kn.startsWith(q) || q.startsWith(kn)) score = 1;
        else if (kn.includes(q) || q.includes(kn)) score = 2;
        else if (q.split(" ").some((w) => w.length >= 4 && kn.includes(w))) score = 3;
        else if (normalizeName(k.where).includes(q)) score = 4;
        // The nudge for "this is the name they typed" is kept apart from the
        // score. Folded in, it took an exact match from 0 to -0.5, and the
        // filter below — there to drop things that do not match at all —
        // threw away the best match every time. Searching a school's full
        // name found every other school and not that one.
        return { k, score, exact: kn === typed };
      })
      .filter((x) => x.score >= 0)
      .sort((a, b) => (a.score - b.score) || (b.exact - a.exact));
    return scored.slice(0, 6).map((x) => x.k);
  }

  async function viewDoc(path) {
    if (!path) return;
    const { data, error } = await supabase.storage.from("student-proofs").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) { alert("Could not open document: " + (error?.message || "unknown")); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  // Asks the verify-document function what the uploaded proof says. It only
  // ever writes to the extraction columns, so this cannot approve anyone —
  // it fills in evidence for the decision you make below.
  async function readDoc(r) {
    setReading(r.id);
    const { error } = await supabase.functions.invoke("verify-document", { body: { verification_id: r.id } });
    setReading("");
    await load();
    if (error) {
      const detail = await error.context?.json?.().catch(() => null);
      alert(detail?.error || error.message || "Could not read the document.");
    }
  }

  async function decide(r, status) {
    setBusy(r.id);
    const name = fieldVal(r, "conservatory_name");
    const address = fieldVal(r, "conservatory_address");
    const approving = status === "approved";

    // Every write here used to be fire-and-forget, so an RLS refusal or a
    // missing user_id looked exactly like success: the row flipped to
    // "approved" while the student's profile stayed unapproved and they kept
    // seeing "your documents are under review". Check each one, and say which
    // step failed rather than reporting an approval that didn't happen.
    const { error: rowError } = await supabase.from("student_verifications")
      .update({ status, conservatory_name: name, conservatory_address: address,
                conservatory_email: fieldVal(r, "conservatory_email"),
                decision_reason: status === "rejected" ? reasonOf(r) : null }).eq("id", r.id);
    if (rowError) { setBusy(""); alert(`Could not update the request: ${rowError.message}`); return; }

    if (!r.user_id) {
      setBusy(""); load();
      alert("This request has no account attached, so there is no profile to approve. The document was recorded, but the student cannot be given access from here.");
      return;
    }

    // The conservatory has to exist before the profile is written, because the
    // profile needs its id: the globe groups students by conservatory_id, and
    // the document route leaves that null. Approved but unlinked means the
    // school shows in the list with no pin and an empty roster.
    let consId = null;
    if (approving && name.trim()) {
      const consName = name.trim();
      const consAddress = address.trim();
      // A domain request carries the address the student holds, and approving
      // it has to put that domain on the school — otherwise the request is
      // granted and the very thing it asked for is dropped. The union happens
      // in the database, so a school that already has one domain keeps it.
      // Never a free-mail domain, however it got this far. Attaching one
      // would not add a school, it would hand every account at that provider
      // the ability to verify as it — the blast radius of one careless
      // approval is the whole of gmail.com. The request form refuses these,
      // so this is the second lock, not the first. The school is still
      // approved; it simply arrives without a domain, onto the list for
      // students who have no institutional address.
      const rawDomain = r.kind === "domain_request"
        ? (String(fieldVal(r, "conservatory_email")).toLowerCase().match(/@([^@\s]+\.[^@\s]+)$/) || [])[1] || ""
        : "";
      const reqDomain = FREE_MAIL.has(rawDomain) ? "" : rawDomain;
      let consError = null, consRows = null;
      if (reqDomain) {
        const { data, error } = await supabase.rpc("approve_conservatory_domain", {
          p_name: consName, p_address: consAddress, p_domain: reqDomain,
          p_keep_existing: !!keepDomains[r.id],
        });
        consError = error;
        if (!error && data) {
          const { data: got } = await supabase.from("approved_conservatories")
            .select("id, lat, lng").eq("id", data).maybeSingle();
          consRows = got ? [got] : null;
        }
      } else {
        ({ data: consRows, error: consError } = await supabase.from("approved_conservatories")
          .upsert({ name: consName, address: consAddress }, { onConflict: "name" })
          .select("id, lat, lng"));
      }
      if (consError) {
        alert(`Could not add "${consName}" to the conservatory list: ${consError.message}`);
      } else {
        const row = consRows?.[0];
        consId = row?.id || null;
        // Without coordinates there is nowhere to put the pin, so the student
        // ends up approved but invisible on the globe. Geocode once, here.
        if (row && (row.lat == null || row.lng == null)) {
          const hit = await geocodeConservatory(consName, consAddress);
          if (hit) {
            await supabase.from("approved_conservatories")
              .update({ lat: hit.lat, lng: hit.lng, geocoded_at: new Date().toISOString(), geocode_query: hit.query })
              .eq("id", row.id);
          } else {
            alert(`"${consName}" was added to the list, but its address could not be located — it won't appear on the globe yet. Try a fuller address (street, city, country) and approve again.`);
          }
        }
      }
    }

    // .select() so the response carries the affected rows: RLS can refuse an
    // update by matching zero rows without raising an error at all.
    const patch = { approved: approving, conservatory_verified: approving };
    // Record the address they proved.
    //
    // A domain request verifies an institutional address by code, and until
    // now none of it reached the profile: conservatory_email stayed null,
    // because the signup route deliberately does not set it — the school is
    // not on any list yet, so there is nothing for it to belong to — and
    // approving never filled it in either.
    //
    // That loses the only record of what was proved. It is what the approval
    // trigger looks for if the row is ever touched again, so a student
    // approved this way could not be re-verified; and the profile screen shows
    // the address beside the school, which was simply blank.
    const provenEmail = String(fieldVal(r, "conservatory_email") || "").trim();
    if (approving && r.kind === "domain_request" && provenEmail) {
      patch.conservatory_email = provenEmail.toLowerCase();
    }
    // Which id the student is filed under.
    //
    // Approving still upserts approved_conservatories, because that row is
    // what carries the domain onto the school. But when the school picked was
    // a roster one, its id is the roster id — and that is what the profile
    // must hold. The upsert's uuid would be wrong: the signup screen folds an
    // approved row into the roster school it matches by name, so that uuid is
    // not a school anyone can be found under. The student would be approved,
    // filed against nothing, and absent from the school's roster on the map.
    //
    // Caught by the first end-to-end run: the request landed with
    // conservatory_id 65893f97… while the school it was approved as is
    // 'artium-test'.
    const picked = pickOf(r);
    const filedUnder = picked?.mode === "existing" && picked.roster ? picked.id : consId;
    if (approving && filedUnder) patch.conservatory_id = filedUnder;
    const { data: touched, error: profileError } = await supabase.from("profiles")
      .update(patch)
      .eq("id", r.user_id)
      .select("id, approved");
    if (profileError) { setBusy(""); alert(`Request updated, but the student's profile was not: ${profileError.message}`); return; }
    if (!touched || touched.length === 0) {
      setBusy(""); load();
      alert("Request updated, but no profile row was changed — the student's account may not have a profile, or row-level security blocked the write. They will still see \"under review\".");
      return;
    }

    await notifyApplicant(r, status);

    // Forget what was chosen for this row.
    //
    // picks, the reason, the keep-domains tick and the search text all live
    // keyed by request id and survived the decision. Resetting a request back
    // to pending therefore handed it back still carrying the school picked
    // last time — and since the confirmed panel replaces the list, the school
    // suggestions simply were not there, which reads as the picker being
    // broken rather than as a choice already made.
    //
    // A decision is the end of a row's editing. Whatever comes next starts
    // from the request as the applicant sent it.
    const forget = (setter) => setter((x) => { const n = { ...x }; delete n[r.id]; return n; });
    forget(setPicks); forget(setPickQ); forget(setReasons); forget(setKeepDomains); forget(setEdits);

    setBusy(""); load();
  }

  // Told after the fact, deliberately. The decision is already written; if the
  // mail fails, saying so is more useful than pretending the decision did not
  // happen — and re-sending is a click, while undoing an approval is not.
  async function notifyApplicant(r, status) {
    if (status !== "approved" && status !== "rejected") return;
    const { data, error } = await supabase.functions.invoke("notify-decision", {
      body: { verification_id: r.id, status, reason: status === "rejected" ? reasonOf(r) : "" },
    });
    const detail = error ? (await error.context?.json?.().catch(() => null))?.error : data?.error;
    if (error || data?.error) {
      alert(`Decision saved, but the applicant was not emailed: ${detail || "unknown error"}`);
    }
  }

  const pending = rows.filter((r) => r.status === "pending");
  const decided = rows.filter((r) => r.status !== "pending");

  const th = { textAlign: "left", fontSize: 10, fontWeight: 700, color: C.brassLabel, textTransform: "uppercase", letterSpacing: "0.06em", padding: "8px 8px", borderBottom: `1px solid ${C.inkLine}` };
  const td = { padding: "10px 8px", fontSize: 12, color: C.ivory, verticalAlign: "top", borderBottom: `1px solid ${C.inkLine}` };
  const inp = { width: "100%", padding: "7px 9px", borderRadius: 8, border: `1px solid ${C.inkLine}`, fontSize: 12, fontFamily: FONT_BODY, boxSizing: "border-box", outline: "none", marginBottom: 6 };

  const readBtn = { display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: `1px solid ${C.inkLine}`, borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: C.brassLabel, fontSize: 11, fontWeight: 700, marginBottom: 8 };

  // What the document says, next to what the student claimed. Evidence for
  // the reviewer — never a verdict: a forged certificate reads as cleanly as
  // a real one, so the mismatch flags are what actually carry signal here.
  function Extraction({ r }) {
    if (reading === r.id || r.extraction_status === "running")
      return <p style={{ margin: "0 0 8px", fontSize: 11, color: C.ivoryDim, fontStyle: "italic" }}>Reading the document…</p>;

    if (r.extraction_status === "failed")
      return (
        <div style={{ marginBottom: 8 }}>
          <p style={{ margin: "0 0 5px", fontSize: 11, color: C.burgundy }}>Couldn't read it: {r.extraction_error}</p>
          <button onClick={() => readDoc(r)} style={readBtn}>Try again</button>
        </div>
      );

    const x = r.extracted;
    if (!x?.document)
      return <button onClick={() => readDoc(r)} style={readBtn}><ScanLine size={12} /> Read document</button>;

    const d = x.document;
    const c = x.checks || {};
    const agrees = c.conservatory_matches_claim;
    const tone = agrees === false ? C.burgundy : agrees === true ? "#1A9E6E" : C.brassLabel;

    const flags = [];
    if (agrees === false) flags.push(`Claimed ${c.claimed_conservatory || "—"}, document says ${d.conservatory_name || "nothing"}`);
    if (c.name_matches_claim === false) flags.push(`Name on document is ${d.student_name || "absent"}, not ${c.claimed_name}`);
    if (c.duplicate_document?.found) flags.push("This exact file was uploaded by another applicant");
    if (d.legible === false) flags.push("The scan is hard to read — open it yourself");
    if (d.notes) flags.push(d.notes);

    return (
      <div style={{ marginBottom: 10, padding: "8px 9px", borderRadius: 8, border: `1px solid ${tone}33`, background: `${tone}0D` }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: tone }}>
          {agrees === false ? "Document disagrees with the claim" : agrees === true ? "Document matches the claim" : "Document read"}
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 11, color: C.ivory }}>
          {d.conservatory_name || "No institution named"}
          {d.conservatory_location ? ` · ${d.conservatory_location}` : ""}
          {d.student_name ? ` · ${d.student_name}` : ""}
          {d.academic_year ? ` · ${d.academic_year}` : ""}
        </p>
        {d.evidence && (
          <p style={{ margin: "4px 0 0", fontSize: 10, color: C.ivoryDim, fontStyle: "italic" }}>“{d.evidence}”</p>
        )}
        {flags.map((f, i) => (
          <p key={i} style={{ margin: "4px 0 0", fontSize: 10, color: C.burgundy }}>⚠ {f}</p>
        ))}
        <div style={{ display: "flex", gap: 6, marginTop: 7 }}>
          <button
            onClick={() => { setField(r, "conservatory_name", d.conservatory_name || ""); setField(r, "conservatory_address", d.conservatory_location || ""); }}
            style={{ ...readBtn, marginBottom: 0 }}
          >
            Use these values
          </button>
          <button onClick={() => readDoc(r)} style={{ ...readBtn, marginBottom: 0 }}>Re-read</button>
        </div>
        <p style={{ margin: "6px 0 0", fontSize: 10, color: C.ivoryDim }}>
          Reports what the document claims. It cannot tell a genuine document from a forged one — you decide.
        </p>
      </div>
    );
  }

  // Called, not rendered: {Table({...})}, never <Table />.
  //
  // Both of these are declared inside the screen, so every render makes a new
  // function object. React compares element types by identity, sees a
  // different component, and throws the old subtree away — unmounting and
  // remounting the table rather than updating it. The list reloads every five
  // seconds, so that happened on a timer: scrolling right to reach Approve
  // snapped back to the left, and typing in a conservatory name lost the
  // cursor, both within five seconds of starting.
  //
  // Calling them inlines the JSX into this component's own output, so there
  // is no child instance to replace and the DOM nodes — with their scroll
  // position and focus — survive. Safe precisely because neither holds hooks
  // or state of its own; if either ever needs some, it has to move to module
  // scope instead.
  function Table({ list, editable }) {
    if (list.length === 0) return <div style={{ ...card, textAlign: "center" }}><p style={{ fontSize: 14, color: C.ivoryDim, margin: 0 }}>{editable ? "No pending student verifications." : "No reviewed verifications yet."}</p></div>;
    return (
      <div style={{ ...card, overflowX: "auto", padding: "8px 8px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
          <thead>
            <tr>
              <th style={th}>Student</th>
              <th style={th}>Documents</th>
              <th style={th}>Conservatory name &amp; address</th>
              <th style={th}>{editable ? "Decision" : "Status"}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td style={td}>
                  <p style={{ margin: 0, fontWeight: 700 }}>{r.name}</p>
                  <p style={{ margin: "2px 0 0", color: C.ivoryDim, wordBreak: "break-all" }}>{r.personal_email}</p>
                </td>
                <td style={td}>
                  {/* A domain request has no document — its evidence is the
                      address itself, and offering a View button that opens
                      nothing is worse than saying so. */}
                  {r.kind === "domain_request" ? (
                    <>
                      <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: C.brassLabel, letterSpacing: "0.06em" }}>DOMAIN REQUEST</p>
                      <p style={{ margin: "5px 0 0", fontWeight: 600, wordBreak: "break-all" }}>{r.conservatory_email}</p>
                      <p style={{ margin: "3px 0 0", color: C.ivoryDim, fontSize: 11 }}>
                        Approving makes this the school's address:{" "}
                        <b style={{ color: C.ivory }}>
                          @{(String(r.conservatory_email).toLowerCase().match(/@([^@\s]+\.[^@\s]+)$/) || [])[1] || "?"}
                        </b>
                      </p>
                    </>
                  ) : (
                    <>
                      <button onClick={() => viewDoc(r.document_url)} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: `1px solid ${C.inkLine}`, borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: C.brassLabel, fontSize: 12, fontWeight: 600 }}>
                        <FileText size={13} /> View
                      </button>
                      <p style={{ margin: "4px 0 0", color: C.ivoryDim, fontSize: 11, wordBreak: "break-all" }}>{r.document_name}</p>
                    </>
                  )}
                </td>
                <td style={td}>
                  {editable ? (
                    <>
                      {r.kind !== "domain_request" && Extraction({ r })}
                      {(() => {
                        const pick = pickOf(r);
                        const hits = searchKnown(r);
                        const suggested = looksLike(fieldVal(r, "conservatory_name"), fieldVal(r, "conservatory_address"));
                        if (!pick) {
                          return (
                            <div style={{ padding: "9px 10px", borderRadius: 10, border: `1px solid ${suggested.length ? "rgba(239,208,155,0.35)" : C.inkLine}`, background: suggested.length ? "rgba(239,208,155,0.06)" : "rgba(176,146,98,0.05)" }}>
                              <p style={{ margin: "0 0 3px", fontSize: 11, fontWeight: 700, color: C.brassLabel }}>
                                {suggested.length ? "Looks like a school we already have" : "Which school is this?"}
                              </p>
                              <p style={{ margin: "0 0 7px", fontSize: 10.5, color: C.ivoryDim, lineHeight: 1.45 }}>
                                They typed “{fieldVal(r, "conservatory_name") || "—"}”
                                {fieldVal(r, "conservatory_address") ? <> · {fieldVal(r, "conservatory_address")}</> : null}
                              </p>
                              <input
                                style={{ ...inp, marginBottom: 6 }}
                                value={pickQ[r.id] !== undefined ? pickQ[r.id] : fieldVal(r, "conservatory_name")}
                                onChange={(e) => setPickQ((q) => ({ ...q, [r.id]: e.target.value }))}
                                placeholder="Search the schools we have…"
                              />
                              {hits.length === 0 && (
                                <p style={{ margin: "0 0 6px", fontSize: 10.5, color: C.ivoryDim }}>Nothing matches that search.</p>
                              )}
                              {hits.map((k) => (
                                <button
                                  key={k.id}
                                  onClick={() => choose(r, k)}
                                  style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 4, padding: "6px 8px", borderRadius: 8, border: `1px solid ${C.inkLine}`, background: "rgba(176,146,98,0.05)", color: C.ivory, fontSize: 11.5, cursor: "pointer" }}
                                >
                                  {k.name}
                                  {k.where ? <span style={{ color: C.ivoryDim }}> · {k.where}</span> : null}
                                  {k.roster ? <span style={{ color: C.ivoryDim }}> · built in</span> : null}
                                </button>
                              ))}
                              <button
                                onClick={() => chooseNew(r)}
                                style={{ display: "block", width: "100%", textAlign: "left", marginTop: 6, padding: "6px 8px", borderRadius: 8, border: `1px dashed ${C.inkLine}`, background: "none", color: C.ivoryDim, fontSize: 11.5, cursor: "pointer" }}
                              >
                                + None of these — add it as a new school
                              </button>
                            </div>
                          );
                        }
                        if (pick.mode === "existing") {
                          return (
                            <div style={{ padding: "9px 10px", borderRadius: 10, border: "1px solid #1A9E6E", background: "rgba(26,158,110,0.08)" }}>
                              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#1A9E6E" }}>Approving as an existing school</p>
                              <p style={{ margin: "3px 0 0", fontSize: 12, color: C.ivory, fontWeight: 600 }}>{pick.name}</p>
                              {pick.where ? <p style={{ margin: "2px 0 0", fontSize: 10.5, color: C.ivoryDim }}>{pick.where}</p> : null}
                              <p style={{ margin: "6px 0 0", fontSize: 10.5, color: C.ivoryDim, lineHeight: 1.45 }}>
                                Its domain joins that school. No new row.
                              </p>
                              <button onClick={() => clearPick(r)} style={{ marginTop: 7, padding: "5px 9px", borderRadius: 8, border: `1px solid ${C.inkLine}`, background: "rgba(176,146,98,0.05)", color: C.ivoryDim, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Change</button>
                            </div>
                          );
                        }
                        return (
                          <div style={{ padding: "9px 10px", borderRadius: 10, border: `1px solid ${C.brass}`, background: "rgba(239,208,155,0.05)" }}>
                            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: C.brassLabel }}>Adding a new school</p>
                            <input style={inp} value={fieldVal(r, "conservatory_name")} onChange={(e) => setField(r, "conservatory_name", e.target.value)} placeholder="Conservatory name" />
                            <input style={inp} value={fieldVal(r, "conservatory_address")} onChange={(e) => setField(r, "conservatory_address", e.target.value)} placeholder="Address — street, city, country" />
                            <p style={{ margin: "2px 0 0", fontSize: 10.5, color: C.ivoryDim, lineHeight: 1.45 }}>
                              Use the school's own spelling. Every later request is matched against this.
                            </p>
                            <button onClick={() => clearPick(r)} style={{ marginTop: 7, padding: "5px 9px", borderRadius: 8, border: `1px solid ${C.inkLine}`, background: "rgba(176,146,98,0.05)", color: C.ivoryDim, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Change</button>
                          </div>
                        );
                      })()}
                    </>
                  ) : (
                    <>
                      <p style={{ margin: 0, fontWeight: 600 }}>{r.conservatory_name}</p>
                      <p style={{ margin: "2px 0 0", color: C.ivoryDim }}>{r.conservatory_address}</p>
                    </>
                  )}
                </td>
                <td style={td}>
                  {editable ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {(() => {
                        // Approve waits for the school to be decided. A
                        // rejection does not — nothing is created by it.
                        const ready = !!pickOf(r);
                        return (
                          <button
                            disabled={busy === r.id || !ready}
                            onClick={() => decide(r, "approved")}
                            title={ready ? undefined : "Choose the school first"}
                            style={{ padding: "8px 10px", borderRadius: 8, border: "none", background: ready ? "#1A9E6E" : "rgba(176,146,98,0.12)", color: ready ? "#fff" : C.ivoryDim, fontSize: 12, fontWeight: 700, cursor: ready ? "pointer" : "not-allowed" }}
                          >Approve</button>
                        );
                      })()}
                      {(() => {
                        // Reject waits for a reason, because the reason is the
                        // email. A rejection with nothing to say leaves someone
                        // rebuffed and none the wiser about what to fix.
                        const has = reasonOf(r).length > 2;
                        return (
                          <button
                            disabled={busy === r.id || !has}
                            onClick={() => decide(r, "rejected")}
                            title={has ? undefined : "Write a reason first — it is sent to the applicant"}
                            style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.inkLine}`, background: "rgba(176,146,98,0.05)", color: has ? C.burgundy : C.ivoryDim, fontSize: 12, fontWeight: 700, cursor: has ? "pointer" : "not-allowed" }}
                          >Reject</button>
                        );
                      })()}
                      {(() => {
                        // Only asked when it is a real question: a domain
                        // request, against a school that already has one.
                        // Everywhere else the answer cannot matter, and a
                        // checkbox that never changes anything is noise that
                        // teaches you to ignore checkboxes.
                        const pick = pickOf(r);
                        if (r.kind !== "domain_request") return null;
                        if (!pick || pick.mode !== "existing") return null;
                        // What the school accepts *today*, minus the address
                        // being approved. Listing everything named the new
                        // domain back at you — "keep @art-ium.com working too"
                        // while approving @art-ium.com — which is no question
                        // at all, and hid the one domain actually at stake.
                        const incoming = (String(fieldVal(r, "conservatory_email")).toLowerCase()
                          .match(/@([^@\s]+\.[^@\s]+)$/) || [])[1] || "";
                        const existing = ((known.find((k) => k.id === pick.id)?.domains) || [])
                          .filter((d) => d !== incoming);
                        if (!existing.length) return null;
                        return (
                          <label style={{ display: "flex", gap: 7, alignItems: "flex-start", fontSize: 11, color: C.ivoryDim, lineHeight: 1.4, cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={!!keepDomains[r.id]}
                              onChange={(e) => setKeepDomains((x) => ({ ...x, [r.id]: e.target.checked }))}
                              style={{ marginTop: 1, accentColor: "#EFD09B" }}
                            />
                            <span>
                              Keep <b style={{ color: C.ivory }}>{existing.map((d) => "@" + d).join(", ")}</b> working too
                              <br />
                              <span style={{ opacity: 0.75 }}>Tick only if the school still issues both — otherwise the new address replaces it.</span>
                            </span>
                          </label>
                        );
                      })()}
                      <textarea
                        value={reasons[r.id] || ""}
                        onChange={(e) => setReasons((x) => ({ ...x, [r.id]: e.target.value }))}
                        placeholder="If rejecting: what should they fix? This is emailed to them."
                        rows={2}
                        style={{ ...inp, margin: 0, resize: "vertical", minHeight: 46, fontFamily: FONT_BODY }}
                      />
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: STATUS_COLOR[r.status] || C.ivoryDim }}>{r.status}</span>
                      <button onClick={() => decide(r, "pending")} style={{ padding: "6px 8px", borderRadius: 8, border: `1px solid ${C.inkLine}`, background: "rgba(176,146,98,0.05)", color: C.ivoryDim, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Reset</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <>
      <p style={{ fontSize: 12, fontWeight: 700, color: C.brassLabel, textTransform: "uppercase", letterSpacing: "0.06em", margin: "4px 0 0" }}>Pending ({pending.length})</p>
      {Table({ list: pending, editable: true })}
      {decided.length > 0 && <>
        <p style={{ fontSize: 12, fontWeight: 700, color: C.brassLabel, textTransform: "uppercase", letterSpacing: "0.06em", margin: "8px 0 0" }}>History ({decided.length})</p>
        {Table({ list: decided, editable: false })}
      </>}
    </>
  );
}

function TeacherLessonRoom({ teacherId, roomView, setRoomView }) {
  const tid = teacherId || "demo-teacher";

  // Real incoming requests from localStorage (cross-tab)
  const [incoming, setIncoming] = useState(() => {
    try { return (JSON.parse(localStorage.getItem("incomingRequests") || "{}"))[tid] || []; } catch { return []; }
  });
  React.useEffect(() => {
    function onStorage(e) {
      if (e.key === "incomingRequests") {
        try { setIncoming((JSON.parse(e.newValue || "{}"))[tid] || []); } catch {}
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [tid]);

  function acceptRequest(learnerId) {
    // Update incomingRequests
    const all = JSON.parse(localStorage.getItem("incomingRequests") || "{}");
    if (all[tid]) all[tid] = all[tid].map((r) => r.learnerId === learnerId ? { ...r, status: "accepted" } : r);
    localStorage.setItem("incomingRequests", JSON.stringify(all));
    setIncoming(all[tid] || []);
    // Update teachRequests so learner's tab reacts
    const tr = JSON.parse(localStorage.getItem("teachRequests") || "{}");
    tr[tid] = "accepted";
    localStorage.setItem("teachRequests", JSON.stringify(tr));
  }

  function declineRequest(learnerId) {
    const all = JSON.parse(localStorage.getItem("incomingRequests") || "{}");
    if (all[tid]) all[tid] = all[tid].map((r) => r.learnerId === learnerId ? { ...r, status: "declined" } : r);
    localStorage.setItem("incomingRequests", JSON.stringify(all));
    setIncoming(all[tid] || []);
    const tr = JSON.parse(localStorage.getItem("teachRequests") || "{}");
    tr[tid] = "declined";
    localStorage.setItem("teachRequests", JSON.stringify(tr));
  }

  const pendingRequests = incoming.filter((r) => r.status === "pending");
  const acceptedLearners = incoming.filter((r) => r.status === "accepted");
  const [removedStudentIds, setRemovedStudentIds] = useState(new Set());
  const allLearners = [...MOCK_LESSON_LEARNERS, ...acceptedLearners.map((r) => ({ id: r.learnerId, name: r.name, instrument: r.instrument, level: "Student" }))].filter(l => !removedStudentIds.has(l.id));

  const [viewingLearner, setViewingLearner] = useState(null);
  const [activeLearner, setActiveLearner] = useState(allLearners[0]);
  const [tab, setTab] = useState("chat");
  function sessionsKey(learnerId) { return `artium_sessions_${tid}_${learnerId}`; }
  function loadSessions(learnerId) {
    try { return JSON.parse(localStorage.getItem(sessionsKey(learnerId)) || "null") || []; } catch { return []; }
  }
  function saveSessions(learnerId, arr) {
    localStorage.setItem(sessionsKey(learnerId), JSON.stringify(arr));
  }

  const [sessionsByLearner, setSessionsByLearner] = useState({
    alex: [
      { id: 0, date: "2026-07-05", time: "10:00", status: "confirmed", paid: true },
      { id: 1, date: "2026-07-15", time: "16:00", status: "teacher_proposed", paid: false },
      { id: 2, date: "2026-07-12", time: "18:00", status: "confirmed", paid: true },
    ],
    sophie: [
      { id: 0, date: "2026-07-20", time: "14:00", status: "confirmed", paid: false },
    ],
  });

  // Sync real learner sessions from localStorage (cross-tab)
  React.useEffect(() => {
    function sync() {
      acceptedLearners.forEach((r) => {
        const saved = loadSessions(r.learnerId);
        if (saved.length > 0) {
          setSessionsByLearner((prev) => ({ ...prev, [r.learnerId]: saved }));
        }
      });
    }
    sync();
    const id = setInterval(sync, 2000);
    window.addEventListener("storage", sync);
    return () => { clearInterval(id); window.removeEventListener("storage", sync); };
  }, [incoming]);
  function chatKey(learnerId) { return `artium_chat_${tid}_${learnerId}`; }
  function loadMsgs(learnerId) {
    try { return JSON.parse(localStorage.getItem(chatKey(learnerId)) || "null") || null; } catch { return null; }
  }
  function saveMsgs(learnerId, arr) { localStorage.setItem(chatKey(learnerId), JSON.stringify(arr)); }

  const [messagesByLearner, setMessagesByLearner] = useState({
    alex:   [{ from: "them", text: "Hi! Looking forward to our next session." }, { from: "me", text: "Me too! I'll send you the sheet music." }],
    sophie: [{ from: "them", text: "Can we reschedule Thursday?" }],
  });

  const [lastSeenByLearner, setLastSeenByLearner] = useState({});

  // Sync active learner's chat from localStorage (runs whenever active learner changes)
  React.useEffect(() => {
    if (MOCK_IDS.includes(activeLearner.id)) return;
    function sync() {
      const saved = loadMsgs(activeLearner.id);
      if (saved) {
        const flipped = saved.map((m) => m.from === "teacher" ? { ...m, from: "me" } : { ...m, from: "them" });
        setMessagesByLearner((prev) => ({ ...prev, [activeLearner.id]: flipped }));
      }
    }
    sync();
    const id = setInterval(sync, 1500);
    window.addEventListener("storage", sync);
    return () => { clearInterval(id); window.removeEventListener("storage", sync); };
  }, [activeLearner.id]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [showPropose, setShowPropose] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [recurring, setRecurring] = useState("none");
  const [recurringCount, setRecurringCount] = useState(4);
  const [confirmCancelId, setConfirmCancelId] = useState(null);
  const [showCounter, setShowCounter] = useState({});
  const [counterDate, setCounterDate] = useState({});
  const [counterTime, setCounterTime] = useState({});
  const [pillPage, setPillPage] = useState(0);
  const PILLS_PER_PAGE = 30;
  const [zoomLink, setZoomLink] = useState("");
  const [zoomSaved, setZoomSaved] = useState(false);
  const [agendaBySession, setAgendaBySession] = useState({});
  const [sessionDetailTab, setSessionDetailTab] = useState({});
  const [agendaDraft, setAgendaDraft] = useState({});
  function agendaKey(learnerId, sessionId) { return `artium_agenda_${tid}_${learnerId}_${sessionId}`; }
  function saveAgenda(learnerId, sessionId, text) {
    const key = agendaKey(learnerId, sessionId);
    localStorage.setItem(key, text);
    setAgendaBySession(prev => ({ ...prev, [`${learnerId}_${sessionId}`]: text }));
  }
  function loadAgenda(learnerId, sessionId) {
    return localStorage.getItem(agendaKey(learnerId, sessionId)) || "";
  }
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const [cancelLockH, setCancelLockH] = useState(24);
  const [modifyLockH, setModifyLockH] = useState(48);
  const [cancelFeesPct, setCancelFeesPct] = useState(50);

  const [openMonths, setOpenMonths] = useState({ "2026-07": true, "2026-08": false, "2026-09": false });
  const MOCK_PLANNING = [
    { id:"p1",  name:"Élise Marchand",   instrument:"Piano",   price:55, sessions:[{date:"2026-07-22",time:"10:00",status:"confirmed",paid:true},{date:"2026-08-05",time:"10:00",status:"teacher_proposed",paid:false}] },
    { id:"p2",  name:"Théo Lambert",     instrument:"Piano",   price:45, sessions:[{date:"2026-07-25",time:"14:00",status:"confirmed",paid:false}] },
    { id:"p3",  name:"Lukas Brunner",    instrument:"Piano",   price:60, sessions:[{date:"2026-07-28",time:"09:00",status:"confirmed",paid:true},{date:"2026-08-18",time:"10:00",status:"confirmed",paid:true}] },
    { id:"p4",  name:"Polina Sokolova",  instrument:"Piano",   price:70, sessions:[{date:"2026-08-01",time:"11:00",status:"teacher_proposed",paid:false}] },
    { id:"p5",  name:"Maya Chen",        instrument:"Piano",   price:65, sessions:[{date:"2026-08-03",time:"16:00",status:"confirmed",paid:true}] },
    { id:"p6",  name:"Daniel Osei",      instrument:"Piano",   price:50, sessions:[{date:"2026-08-07",time:"15:00",status:"confirmed",paid:false}] },
    { id:"p7",  name:"Freya Whitlock",   instrument:"Piano",   price:48, sessions:[{date:"2026-08-09",time:"10:00",status:"student_proposed",paid:false}] },
    { id:"p8",  name:"Wei Zhang",        instrument:"Piano",   price:55, sessions:[{date:"2026-08-12",time:"17:00",status:"confirmed",paid:true}] },
    { id:"p9",  name:"Haruto Sato",      instrument:"Piano",   price:60, sessions:[{date:"2026-08-14",time:"09:00",status:"confirmed",paid:true}] },
    { id:"p10", name:"Ji-woo Kang",      instrument:"Piano",   price:45, sessions:[{date:"2026-08-15",time:"13:00",status:"teacher_proposed",paid:false}] },
    { id:"p11", name:"Anneliese Voss",   instrument:"Piano",   price:60, sessions:[{date:"2026-08-20",time:"14:00",status:"confirmed",paid:false}] },
    { id:"p12", name:"Nathan Boucher",   instrument:"Piano",   price:40, sessions:[{date:"2026-08-22",time:"11:00",status:"confirmed",paid:true}] },
    { id:"p13", name:"Isla Cooper",      instrument:"Piano",   price:52, sessions:[{date:"2026-08-24",time:"09:00",status:"student_proposed",paid:false}] },
    { id:"p14", name:"Sofia Reyes",      instrument:"Violin",  price:58, sessions:[{date:"2026-08-26",time:"16:00",status:"confirmed",paid:true}] },
    { id:"p15", name:"Léon Dupont",      instrument:"Cello",   price:55, sessions:[{date:"2026-08-28",time:"10:00",status:"confirmed",paid:true}] },
    { id:"p16", name:"Amara Diallo",     instrument:"Voice",   price:50, sessions:[{date:"2026-09-01",time:"13:00",status:"confirmed",paid:false}] },
    { id:"p17", name:"Ryo Nakamura",     instrument:"Guitar",  price:45, sessions:[{date:"2026-09-03",time:"15:00",status:"confirmed",paid:true}] },
    { id:"p18", name:"Ingrid Larsson",   instrument:"Flute",   price:48, sessions:[{date:"2026-09-05",time:"09:00",status:"confirmed",paid:true}] },
    { id:"p19", name:"Carlos Mendez",    instrument:"Trumpet", price:52, sessions:[{date:"2026-09-08",time:"11:00",status:"teacher_proposed",paid:false}] },
    { id:"p20", name:"Yuna Park",        instrument:"Harp",    price:60, sessions:[{date:"2026-09-12",time:"14:00",status:"confirmed",paid:true}] },
  ];

  const sessions = sessionsByLearner[activeLearner.id] || [];
  const msgs = messagesByLearner[activeLearner.id] || [];
  const teacherThemCount = msgs.filter(m => m.from === "them").length;
  const teacherUnread = Math.max(0, teacherThemCount - (lastSeenByLearner[activeLearner.id] || 0));
  React.useEffect(() => {
    if (tab === "chat") setLastSeenByLearner(prev => ({ ...prev, [activeLearner.id]: teacherThemCount }));
  }, [tab, activeLearner.id, teacherThemCount]);

  const MOCK_IDS = MOCK_LESSON_LEARNERS.map((l) => l.id);
  function setSessions(fn) {
    setSessionsByLearner((prev) => {
      const next = fn(prev[activeLearner.id] || []);
      // Persist to localStorage for real (non-mock) learners
      if (!MOCK_IDS.includes(activeLearner.id)) saveSessions(activeLearner.id, next);
      return { ...prev, [activeLearner.id]: next };
    });
  }

  function proposeSession() {
    if (!newDate || !newTime) return;
    const intervalDays = { none: 0, weekly: 7, biweekly: 14, monthly: 30 }[recurring];
    const count = recurring === "none" ? 1 : recurringCount;
    const newSessions = [];
    for (let i = 0; i < count; i++) {
      const d = new Date(newDate + "T12:00:00");
      d.setDate(d.getDate() + i * intervalDays);
      const dateStr = d.toISOString().slice(0, 10);
      newSessions.push({ id: Date.now() + i, date: dateStr, time: newTime, status: "teacher_proposed", paid: false, recurring: recurring !== "none" ? recurring : undefined });
    }
    setSessions((prev) => [...prev, ...newSessions]);
    setNewDate(""); setNewTime(""); setRecurring("none"); setRecurringCount(4); setShowPropose(false);
  }

  function approveCounter(id) {
    setSessions((prev) => prev.map((s) => s.id === id ? { ...s, status: "confirmed" } : s));
    setShowCounter((prev) => ({ ...prev, [id]: false }));
  }

  function proposeNewTime(id) {
    const d = counterDate[id]; const t = counterTime[id];
    if (!d || !t) return;
    setSessions((prev) => prev.map((s) => s.id === id ? { ...s, date: d, time: t, status: "teacher_proposed" } : s));
    setShowCounter((prev) => ({ ...prev, [id]: false }));
  }

  function cancelSession(id) { setSessions((prev) => prev.filter((s) => s.id !== id)); }

  function timeUntil(s) { return new Date(s.date + "T" + s.time).getTime() - Date.now(); }
  function cancelLocked(s) { return s.status === "confirmed" && timeUntil(s) < 24 * 60 * 60 * 1000; }
  function modifyLocked(s) { return s.status === "confirmed" && timeUntil(s) < 48 * 60 * 60 * 1000; }

  function sendMsg(text) {
    setMessagesByLearner((prev) => {
      const displayNext = [...(prev[activeLearner.id] || []), { from: "me", text }];
      if (!MOCK_IDS.includes(activeLearner.id)) {
        // Persist with "teacher" tag so learner can flip perspective
        const stored = loadMsgs(activeLearner.id) || [];
        saveMsgs(activeLearner.id, [...stored, { from: "teacher", text }]);
      }
      return { ...prev, [activeLearner.id]: displayNext };
    });
  }

  // One bar for five destinations. My Rules and My Planning used to be two
  // circles stranded under the card, in a strip of their own, visible only
  // while you were already in the students view — so the room had two
  // navigations and the second one disappeared exactly when you were in the
  // place it could take you back from.
  //
  // The last two switch roomView rather than the card's tab, which is why
  // they carry `view`. Everything else about them is a tab, so they look like
  // tabs and sit on the same line, to the right of Video Session.
  const tabs = [
    { id: "chat", label: "Chat", Icon: MessageCircle },
    { id: "schedule", label: "Schedule & Payments", Icon: Calendar },
    { id: "video", label: "Video Session", Icon: Video },
    { id: "preferences", label: "My Rules", Icon: ListChecks, view: "preferences" },
    { id: "planning", label: "My Planning", Icon: LayoutList, view: "planning" },
  ];

  // What is lit: inside the card it is the card's tab, otherwise it is the
  // room view standing in for one.
  const activeTab = roomView === "students" ? tab : roomView;

  function openTab(t) {
    if (t.view) { setRoomView(t.view); return; }
    setRoomView("students");
    setTab(t.id);
  }

  const RoomTabs = () => (
    <div style={{ display: "flex", borderBottom: `1px solid ${C.inkLine}`, background: "rgba(176,146,98,0.05)" }}>
      {tabs.map((t) => {
        const { id, label, Icon } = t;
        const on = activeTab === id;
        return (
          <button key={id} onClick={() => openTab(t)}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "10px 4px", fontSize: 11, fontWeight: on ? 700 : 400, color: on ? C.ivory : C.ivoryDim, background: "none", border: "none", cursor: "pointer", borderBottom: on ? `2px solid ${C.brass}` : "2px solid transparent" }}>
            <div style={{ position: "relative", display: "inline-flex" }}>
              <Icon size={15} />
              {id === "chat" && teacherUnread > 0 && (
                <span style={{ position: "absolute", top: -6, right: -6, minWidth: 14, height: 14, borderRadius: 7, background: C.brass, color: C.brassText, fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>{teacherUnread}</span>
              )}
            </div>
            {label}
          </button>
        );
      })}
    </div>
  );

  const upcomingSessions = sessions
    .filter((s) => s.status === "confirmed" && s.paid && timeUntil(s) > 0)
    .sort((a, b) => timeUntil(a) - timeUntil(b));
  const nextSession = upcomingSessions[0];

  return (
    <div style={{ padding: "0 0 32px", fontFamily: FONT_BODY, background: C.parchment, minHeight: "100%" }}>
      {/* Pending requests banner */}
      <LearnerProfileModal learner={viewingLearner} onClose={() => setViewingLearner(null)} />

      {/* Remove student confirmation */}
      {confirmRemoveId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          onClick={() => setConfirmRemoveId(null)}>
          <div style={{ background: "rgba(176,146,98,0.05)", borderRadius: 16, padding: 24, maxWidth: 340, width: "100%" }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 15, fontWeight: 700, color: C.ivory, margin: "0 0 10px" }}>Remove student?</p>
            <p style={{ fontSize: 13, color: C.ivoryDim, lineHeight: 1.6, margin: "0 0 20px" }}>
              Are you sure you want to remove this student? They will need to send you a new teaching request in order to connect again.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmRemoveId(null)}
                style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${C.inkLine}`, background: "none", color: C.inkText, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={() => {
                const remaining = allLearners.filter(l => l.id !== confirmRemoveId);
                setRemovedStudentIds(prev => new Set([...prev, confirmRemoveId]));
                if (activeLearner.id === confirmRemoveId && remaining.length > 0) setActiveLearner(remaining[0]);
                setConfirmRemoveId(null);
              }}
                style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: "#c0392b", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
      {pendingRequests.length > 0 && (
        <div style={{ margin: "16px 20px 0", background: "#FFF8E7", border: `1.5px solid ${C.brass}`, borderRadius: 12, padding: "14px 16px" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: C.brassLabel, margin: "0 0 10px" }}>New lesson request{pendingRequests.length > 1 ? "s" : ""}</p>
          {pendingRequests.map((r) => (
            <div key={r.learnerId} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <Avatar name={r.name} id={r.learnerId} size={34} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.ivory, margin: 0 }}>{r.name}</p>
                  <p style={{ fontSize: 11, color: C.ivoryDim, margin: 0 }}>{r.instrument}</p>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setViewingLearner(r)} style={{ flex: 1, padding: "6px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "transparent", border: `1.5px solid ${C.inkLine}`, color: C.ivoryDim, cursor: "pointer" }}>View profile</button>
                <button onClick={() => acceptRequest(r.learnerId)} style={{ flex: 1, padding: "6px 0", borderRadius: 8, fontSize: 12, fontWeight: 700, background: C.brass, color: C.brassText, border: "none", cursor: "pointer" }}>Accept</button>
                <button onClick={() => declineRequest(r.learnerId)} style={{ flex: 1, padding: "6px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "transparent", color: C.ivoryDim, border: `1px solid ${C.inkLine}`, cursor: "pointer" }}>Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Header */}
      <div style={{ padding: "20px 20px 0", background: C.parchment }}>
        <p style={{ fontSize: 13, color: C.ivoryDim, margin: "0 0 16px", textAlign: "center" }}>{allLearners.length} active student{allLearners.length !== 1 ? "s" : ""}</p>
        {roomView === "students" && (<>
        {/* Learner pill picker */}
        {allLearners.length > 1 && (() => {
          const totalPages = Math.ceil(allLearners.length / PILLS_PER_PAGE);
          const safePage = Math.min(pillPage, totalPages - 1);
          const pageLearners = allLearners.slice(safePage * PILLS_PER_PAGE, (safePage + 1) * PILLS_PER_PAGE);
          return (
            <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 0, background: C.parchment, padding: "12px 0 16px" }}>
                {pageLearners.map((l) => (
                  <div key={l.id} style={{ position: "relative", display: "inline-flex" }}>
                    <button onClick={() => { setActiveLearner(l); setSelectedSessionId(null); setTab("chat"); }}
                      style={{ padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: activeLearner.id === l.id ? 700 : 500, border: activeLearner.id === l.id ? `2px solid ${C.brass}` : "none", background: "rgba(176,146,98,0.05)", color: activeLearner.id === l.id ? C.ivory : C.ivoryDim, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.06)" }}>
                      {l.name.split(" ")[0]}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setConfirmRemoveId(l.id); }}
                      style={{ position: "absolute", top: -7, right: -7, width: 18, height: 18, borderRadius: "50%", background: C.inkSoft, color: C.ivoryDim, border: `1.5px solid ${C.inkLine}`, fontSize: 11, fontWeight: 700, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                      title="Remove student">
                      ×
                    </button>
                  </div>
                ))}
              </div>
              {totalPages > 1 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, paddingBottom: 20 }}>
                  <button onClick={() => setPillPage(p => Math.max(0, p - 1))} disabled={safePage === 0}
                    style={{ width: 28, height: 28, borderRadius: "50%", border: `1px solid ${C.inkLine}`, background: "none", cursor: safePage === 0 ? "default" : "pointer", color: safePage === 0 ? C.inkLine : C.ivoryDim, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    ‹
                  </button>
                  <span style={{ fontSize: 12, color: C.ivoryDim, fontWeight: 500 }}>{safePage + 1} of {totalPages}</span>
                  <button onClick={() => setPillPage(p => Math.min(totalPages - 1, p + 1))} disabled={safePage === totalPages - 1}
                    style={{ width: 28, height: 28, borderRadius: "50%", border: `1px solid ${C.inkLine}`, background: "none", cursor: safePage === totalPages - 1 ? "default" : "pointer", color: safePage === totalPages - 1 ? C.inkLine : C.ivoryDim, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    ›
                  </button>
                </div>
              )}
            </>
          );
        })()}
        {/* Active learner info */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "rgba(176,146,98,0.05)", borderRadius: 12, border: "none", boxShadow: "0 1px 6px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)", marginBottom: 16, marginTop: 0 }}>
          <Avatar name={activeLearner.name} id={activeLearner.id} size={40} online />
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: C.ivory, margin: 0 }}>{activeLearner.name}</p>
            <p style={{ fontSize: 12, color: C.ivoryDim, margin: "2px 0 0" }}>{activeLearner.instrument} · {activeLearner.level}</p>
          </div>
        </div>
        </>)}
      </div>

      {/* ── Teaching Preferences ── */}
      {roomView === "preferences" && (
        <div>
        <div style={{ margin: "0 20px 20px", background: "rgba(176,146,98,0.05)", borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <RoomTabs />
        <div style={{ padding: "24px 20px" }}>
          {[
            { label: "Cancellation lock", sublabel: "Students cannot cancel within this window", value: cancelLockH, set: setCancelLockH, min: 1, max: 72, unit: "h" },
            { label: "Modification lock", sublabel: "Students cannot reschedule within this window", value: modifyLockH, set: setModifyLockH, min: 1, max: 96, unit: "h" },
            { label: "Cancellation fee", sublabel: "Charged when student cancels inside the lock window", value: cancelFeesPct, set: setCancelFeesPct, min: 0, max: 100, unit: "%" },
          ].map(({ label, sublabel, value, set, min, max, unit }) => (
            <div key={label} style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: C.ivory, margin: 0 }}>{label}</p>
                <span style={{ fontSize: 18, fontWeight: 700, color: C.brassLabel }}>{value}{unit}</span>
              </div>
              <p style={{ fontSize: 12, color: C.ivoryDim, margin: "0 0 10px" }}>{sublabel}</p>
              <input type="range" min={min} max={max} value={value} onChange={e => set(Number(e.target.value))}
                style={{ width: "30%", accentColor: C.brass, height: 4, cursor: "pointer" }} />
              <div style={{ display: "flex", justifyContent: "space-between", width: "30%", marginTop: 4 }}>
                <span style={{ fontSize: 10, color: C.ivoryDim }}>{min}{unit}</span>
                <span style={{ fontSize: 10, color: C.ivoryDim }}>{max}{unit}</span>
              </div>
            </div>
          ))}
          <div style={{ padding: "14px 16px", background: "#FFF8E7", borderRadius: 12, border: `1px solid ${C.brass}`, fontSize: 12, color: C.ivory, lineHeight: 1.6 }}>
            <strong>Summary:</strong> Students must cancel ≥{cancelLockH}h before the session, modify ≥{modifyLockH}h before. Late cancellations are charged {cancelFeesPct}% of the lesson price.
          </div>
        </div>
        </div>
        </div>
      )}

      {/* ── My Planning ── */}
      {roomView === "planning" && (() => {
        // Merge MOCK_PLANNING with real sessions from sessionsByLearner (non-mock learners)
        const mockSessions = MOCK_PLANNING.flatMap(s =>
          s.sessions.map(sess => ({ ...sess, student: s }))
        );
        const realSessions = Object.entries(sessionsByLearner).flatMap(([learnerId, sessList]) => {
          const learner = allLearners.find(l => l.id === learnerId);
          if (!learner) return [];
          const student = { id: learnerId, name: learner.name, instrument: learner.instrument, price: 60 };
          return (sessList || []).map(sess => ({ ...sess, student }));
        });
        const allSessions = [...mockSessions, ...realSessions]
          .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
        const byMonth = {};
        allSessions.forEach(sess => {
          const key = sess.date.slice(0, 7);
          if (!byMonth[key]) byMonth[key] = [];
          byMonth[key].push(sess);
        });
        const STATUS_LABEL = { confirmed: "Confirmed", teacher_proposed: "Awaiting student", student_proposed: "Counter-proposal", cancelled: "Cancelled" };
        const STATUS_COLOR = { confirmed: "#1A9E6E", teacher_proposed: C.brass, student_proposed: "#E07B00", cancelled: "#c0392b" };
        return (
          <div>
          <div style={{ margin: "0 20px 20px", background: "rgba(176,146,98,0.05)", borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.06)", overflow: "hidden" }}>
            <RoomTabs />
          </div>
          <div style={{ padding: "0 20px 32px" }}>
            {Object.entries(byMonth).map(([monthKey, sessions]) => {
              const earned = sessions.filter(s => s.status === "confirmed" && s.paid).reduce((sum, s) => sum + s.student.price, 0);
              const [y, m] = monthKey.split("-");
              const monthLabel = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
              const isOpen = !!openMonths[monthKey];
              return (
                <div key={monthKey} style={{ marginBottom: 12, border: `1px solid ${C.inkLine}`, borderRadius: 10, overflow: "hidden" }}>
                  <button onClick={() => setOpenMonths(prev => ({ ...prev, [monthKey]: !prev[monthKey] }))}
                    style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 16px", background: C.inkSoft, border: "none", cursor: "pointer" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.ivory }}>{monthLabel}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {earned > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: "#1A9E6E" }}>€{earned} earned</span>}
                      <span style={{ fontSize: 11, color: C.ivoryDim }}>{sessions.length} session{sessions.length !== 1 ? "s" : ""}</span>
                      <span style={{ fontSize: 14, color: C.ivoryDim }}>{isOpen ? "▲" : "▼"}</span>
                    </span>
                  </button>
                  {isOpen && (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: "#FAFAFA" }}>
                          {["Student", "Date · Time", "Status", "Amount"].map(h => (
                            <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: C.brassLabel, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${C.inkLine}` }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.map((sess, i) => {
                          const dt = new Date(sess.date + "T" + sess.time);
                          const amount = (sess.status === "confirmed" && sess.paid) ? `€${sess.student.price}` : "—";
                          return (
                            <tr key={i} style={{ borderBottom: `1px solid ${C.inkLine}`, background: i % 2 === 0 ? "transparent" : "rgba(176,146,98,0.05)" }}>
                              <td style={{ padding: "9px 12px" }}>
                                <div onClick={() => { setActiveLearner(allLearners.find(l => l.id === sess.student.id) || allLearners[0]); setRoomView("students"); setSelectedSessionId(null); setTab("chat"); }}
                                  style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                                  <Avatar name={sess.student.name} id={sess.student.id} size={26} />
                                  <div>
                                    <p style={{ margin: 0, fontWeight: 600, color: C.brassLabel, fontSize: 12, textDecoration: "underline" }}>{sess.student.name}</p>
                                    <p style={{ margin: 0, fontSize: 10, color: C.ivoryDim }}>{sess.student.instrument}</p>
                                  </div>
                                </div>
                              </td>
                              <td style={{ padding: "9px 12px", color: C.ivory }}>
                                {dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · {sess.time}
                              </td>
                              <td style={{ padding: "9px 12px" }}>
                                <span style={{ fontSize: 11, fontWeight: 600, color: STATUS_COLOR[sess.status] || C.ivoryDim }}>
                                  {STATUS_LABEL[sess.status] || sess.status}
                                </span>
                              </td>
                              <td style={{ padding: "9px 12px", fontWeight: 700, color: amount === "—" ? C.ivoryDim : "#1A9E6E" }}>
                                {amount}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
          </div>
        );
      })()}

      {/* Inner tab bar — students view only */}
      {roomView === "students" && (
        <React.Fragment> {/* Inner tab bar */}
      <div style={{ margin: "0 20px 20px", background: "rgba(176,146,98,0.05)", borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.06)", overflow: "hidden", minHeight: 320 }}>
      <RoomTabs />

      {/* Chat */}
      {tab === "chat" && (
        <div>
          <div className="lg-scroll overflow-y-auto px-4 py-3 flex flex-col gap-2" style={{ maxHeight: 300 }}>
            {msgs.length === 0 && <p style={{ fontSize: 13, color: C.ivoryDim, textAlign: "center", padding: "24px 0" }}>Start the conversation with {activeLearner.name.split(" ")[0]}</p>}
            {msgs.map((m, i) => (
              <div key={i} className="px-3.5 py-2 rounded-2xl text-sm" style={{ maxWidth: "80%", alignSelf: m.from === "me" ? "flex-end" : "flex-start", background: m.from === "me" ? C.brass : C.inkSoft, color: m.from === "me" ? C.brassText : C.inkText }}>
                {m.text}
              </div>
            ))}
          </div>
          <div className="px-3 py-3 flex items-center gap-2" style={{ borderTop: `1px solid ${C.inkLine}` }}>
            <input style={{ flex: 1, background: "rgba(176,146,98,0.05)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 999, padding: "11px 15px", fontSize: 14, color: C.ivory, outline: "none" }}
              placeholder={`Message ${activeLearner.name.split(" ")[0]}…`}
              onKeyDown={(e) => { if (e.key === "Enter" && e.target.value.trim()) { sendMsg(e.target.value); e.target.value = ""; } }} />
            <button onClick={(e) => { const inp = e.currentTarget.previousSibling; if (inp.value.trim()) { sendMsg(inp.value); inp.value = ""; } }}
              className="rounded-full p-3" style={{ background: C.brass, flexShrink: 0 }}>
              <Send size={15} color={C.brassText} />
            </button>
          </div>
        </div>
      )}

      {/* Schedule & Payments */}
      {tab === "schedule" && (() => {
        const sel = sessions.find((s) => s.id === selectedSessionId);
        return (
          <div style={{ padding: "0 0 8px" }}>
            {/* Propose new session button */}
            <div style={{ padding: "14px 20px 0" }}>
              {!showPropose ? (
                <button onClick={() => { setRecurring("none"); setShowPropose(true); }}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, background: C.brass, color: C.brassText, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", marginBottom: 12 }}>
                  <Plus size={14} /> Propose a session
                </button>
              ) : (
                <div style={{ background: "rgba(176,146,98,0.05)", border: `1px solid ${C.inkLine}`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.ivory, margin: "0 0 10px" }}>Propose a time for {activeLearner.name.split(" ")[0]}</p>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)}
                      style={{ flex: 1, background: C.inkSoft, border: `1px solid ${C.inkLine}`, borderRadius: 9, padding: "8px 10px", fontSize: 13, color: C.inkText, outline: "none" }} />
                    <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)}
                      style={{ flex: 1, background: C.inkSoft, border: `1px solid ${C.inkLine}`, borderRadius: 9, padding: "8px 10px", fontSize: 13, color: C.inkText, outline: "none" }} />
                  </div>
                  {/* Recurring options */}
                  <p style={{ fontSize: 11, fontWeight: 600, color: C.ivoryDim, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Recurrence</p>
                  <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                    {[["none","One-time"], ["weekly","Weekly"], ["biweekly","Every 2 weeks"], ["monthly","Monthly"]].map(([val, label]) => (
                      <button key={val} onClick={() => setRecurring(val)}
                        style={{ padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${recurring === val ? C.brass : C.inkLine}`, background: recurring === val ? C.brassDim : "transparent", color: recurring === val ? C.brass : C.ivoryDim }}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {recurring !== "none" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <span style={{ fontSize: 12, color: C.ivoryDim, flexShrink: 0 }}>Number of sessions</span>
                      <input type="number" min={2} max={52} value={recurringCount} onChange={(e) => setRecurringCount(Math.max(2, Math.min(52, Number(e.target.value))))}
                        style={{ width: 60, background: C.inkSoft, border: `1px solid ${C.inkLine}`, borderRadius: 9, padding: "6px 10px", fontSize: 13, color: C.inkText, outline: "none" }} />
                      <span style={{ fontSize: 11, color: C.ivoryDim }}>
                        {recurring === "weekly" ? `(${recurringCount} weeks)` : recurring === "biweekly" ? `(${recurringCount * 2} weeks)` : `(${recurringCount} months)`}
                      </span>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={proposeSession} disabled={!newDate || !newTime}
                      style={{ flex: 1, padding: "8px 0", borderRadius: 9, background: C.brass, color: C.brassText, fontSize: 13, fontWeight: 600, border: "none", cursor: !newDate || !newTime ? "not-allowed" : "pointer", opacity: !newDate || !newTime ? 0.5 : 1 }}>
                      {recurring === "none" ? "Send proposal" : `Propose ${recurringCount} sessions`}
                    </button>
                    <button onClick={() => { setShowPropose(false); setRecurring("none"); setRecurringCount(4); }}
                      style={{ padding: "8px 14px", borderRadius: 9, background: "none", border: `1px solid ${C.inkLine}`, color: C.ivoryDim, fontSize: 13, cursor: "pointer" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Session cards strip */}
            <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "0 20px 12px", scrollbarWidth: "none" }}>
              {sessions.length === 0 && (
                <p style={{ fontSize: 13, color: C.ivoryDim }}>No sessions yet — propose one above.</p>
              )}
              {sessions.map((s) => {
                const dt = new Date(s.date + "T" + s.time);
                const isConfirmed = s.status === "confirmed";
                const isSelected = s.id === selectedSessionId;
                return (
                  <button key={s.id} onClick={() => setSelectedSessionId(isSelected ? null : s.id)}
                    style={{ flexShrink: 0, width: 110, height: 110, borderRadius: 14, border: isSelected ? `2px solid ${C.brass}` : `1px solid ${isConfirmed ? "#A8D5B5" : C.inkLine}`, background: isConfirmed ? "rgba(26,158,110,0.10)" : "rgba(176,146,98,0.06)", display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "space-between", padding: 12, cursor: "pointer", boxShadow: isSelected ? `0 0 0 3px ${C.brassDim}` : "none", transition: "box-shadow 0.15s" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: isConfirmed ? "#1A9E6E" : "#D4810A" }}>
                        {isConfirmed ? "Confirmed" : s.status === "student_counter" ? "Counter" : "Pending"}
                      </span>
                      {s.paid && <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", background: "#1A9E6E", borderRadius: 20, padding: "2px 6px" }}>Paid</span>}
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <p style={{ fontSize: 18, fontWeight: 800, color: C.inkText, margin: 0, lineHeight: 1 }}>{dt.getDate()}</p>
                      <p style={{ fontSize: 11, color: C.ivoryDim, margin: "2px 0 0" }}>{dt.toLocaleDateString("en-GB", { month: "short" })} · {s.time}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Session detail panel */}
            {sel && (() => {
              const dt = new Date(sel.date + "T" + sel.time);
              const isConfirmed = sel.status === "confirmed";
              const isCounter = sel.status === "student_counter" || sel.status === "student_proposed";
              const isPending = sel.status === "teacher_proposed";
              const showingCounter = showCounter[sel.id];
              return (
                <div style={{ borderTop: `1px solid ${C.inkLine}`, padding: "16px 20px 8px" }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: C.inkText, margin: "0 0 2px" }}>
                    {dt.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} at {sel.time}
                  </p>

                  {/* Student counter-proposal: teacher can approve or re-propose */}
                  {isCounter && !showingCounter && (
                    <div style={{ marginBottom: 10 }}>
                      <p style={{ fontSize: 11, color: C.brassLabel, margin: "0 0 8px" }}>{activeLearner.name.split(" ")[0]} suggested this time — awaiting your response</p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => approveCounter(sel.id)}
                          style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 13px", borderRadius: 8, background: "#1A9E6E", color: "#fff", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}>
                          <Check size={12} /> Accept
                        </button>
                        <button onClick={() => setShowCounter((p) => ({ ...p, [sel.id]: true }))}
                          style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 13px", borderRadius: 8, background: "none", border: `1px solid ${C.inkLine}`, color: C.ivoryDim, fontSize: 12, cursor: "pointer" }}>
                          Suggest another time
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Pending (teacher proposed, awaiting student) */}
                  {isPending && (
                    <p style={{ fontSize: 11, color: C.ivoryDim, margin: "0 0 10px" }}>Waiting for {activeLearner.name.split(" ")[0]} to confirm</p>
                  )}

                  {/* Counter-propose form */}
                  {showingCounter && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                      <p style={{ fontSize: 12, color: C.ivoryDim, margin: 0 }}>Suggest a new time:</p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input type="date" value={counterDate[sel.id] || ""} onChange={(e) => setCounterDate((p) => ({ ...p, [sel.id]: e.target.value }))}
                          style={{ flex: 1, background: C.inkSoft, border: `1px solid ${C.inkLine}`, borderRadius: 9, padding: "8px 10px", fontSize: 13, color: C.inkText, outline: "none" }} />
                        <input type="time" value={counterTime[sel.id] || ""} onChange={(e) => setCounterTime((p) => ({ ...p, [sel.id]: e.target.value }))}
                          style={{ flex: 1, background: C.inkSoft, border: `1px solid ${C.inkLine}`, borderRadius: 9, padding: "8px 10px", fontSize: 13, color: C.inkText, outline: "none" }} />
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => proposeNewTime(sel.id)} disabled={!counterDate[sel.id] || !counterTime[sel.id]}
                          style={{ flex: 1, padding: "8px 0", borderRadius: 9, background: C.brass, color: C.brassText, fontSize: 13, fontWeight: 600, border: "none", cursor: !counterDate[sel.id] || !counterTime[sel.id] ? "not-allowed" : "pointer", opacity: !counterDate[sel.id] || !counterTime[sel.id] ? 0.5 : 1 }}>
                          Send
                        </button>
                        <button onClick={() => setShowCounter((p) => ({ ...p, [sel.id]: false }))}
                          style={{ padding: "8px 14px", borderRadius: 9, background: "none", border: `1px solid ${C.inkLine}`, color: C.ivoryDim, fontSize: 13, cursor: "pointer" }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Payment status (read-only for teacher) */}
                  {isConfirmed && (
                    <div style={{ marginBottom: 10 }}>
                      {sel.paid ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: "#DFF2E8", color: "#1A9E6E", fontSize: 12, fontWeight: 700 }}>
                          <Check size={13} /> Payment received
                        </span>
                      ) : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: "#FFF4E5", color: "#D4810A", fontSize: 12, fontWeight: 600 }}>
                          ⏳ Awaiting payment from {activeLearner.name.split(" ")[0]}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Agenda tab — confirmed sessions only */}
                  {isConfirmed && (() => {
                    const detailTab = sessionDetailTab[sel.id] || "details";
                    const agendaText = agendaBySession[`${activeLearner.id}_${sel.id}`] ?? loadAgenda(activeLearner.id, sel.id);
                    return (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.inkLine}`, marginBottom: 10 }}>
                          {[["details","Details"],["agenda","Agenda"]].map(([t, label]) => (
                            <button key={t} onClick={() => setSessionDetailTab(prev => ({ ...prev, [sel.id]: t }))}
                              style={{ padding: "6px 16px", fontSize: 12, fontWeight: detailTab === t ? 700 : 500, color: detailTab === t ? C.brass : C.ivoryDim, background: "none", border: "none", cursor: "pointer", borderBottom: detailTab === t ? `2px solid ${C.brass}` : "2px solid transparent", marginBottom: -1 }}>
                              {label}
                            </button>
                          ))}
                        </div>
                        {detailTab === "agenda" && (() => {
                          const draftKey = `${activeLearner.id}_${sel.id}`;
                          const submitted = agendaText;
                          const draft = agendaDraft[draftKey] ?? submitted;
                          const isDirty = draft !== submitted;
                          return (
                            <div>
                              <textarea
                                value={draft}
                                onChange={e => setAgendaDraft(prev => ({ ...prev, [draftKey]: e.target.value }))}
                                placeholder={`Write the agenda for this session with ${activeLearner.name.split(" ")[0]}…`}
                                style={{ width: "100%", minHeight: 120, background: C.inkSoft, border: `1px solid ${C.inkLine}`, borderRadius: 10, padding: "10px 12px", fontSize: 13, color: C.inkText, resize: "vertical", outline: "none", fontFamily: FONT_BODY, lineHeight: 1.6, boxSizing: "border-box" }}
                              />
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 16 }}>
                                <button onClick={() => { saveAgenda(activeLearner.id, sel.id, draft); setAgendaDraft(prev => ({ ...prev, [draftKey]: draft })); }} disabled={!draft.trim() || !isDirty}
                                  style={{ padding: "7px 18px", borderRadius: 9, background: C.brass, color: C.brassText, fontSize: 13, fontWeight: 600, border: "none", cursor: !draft.trim() || !isDirty ? "not-allowed" : "pointer", opacity: !draft.trim() || !isDirty ? 0.5 : 1 }}>
                                  {submitted ? "Update agenda" : "Send agenda"}
                                </button>
                                {submitted && !isDirty && (
                                  <span style={{ fontSize: 11, color: "#1A9E6E" }}>✓ Sent to {activeLearner.name.split(" ")[0]}</span>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })()}

                  {/* Modify / Cancel */}
                  {(isConfirmed || isPending) && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {isConfirmed && (!modifyLocked(sel) ? (
                        <button onClick={() => setShowCounter((p) => ({ ...p, [sel.id]: true }))}
                          style={{ fontSize: 12, color: C.brassLabel, background: "none", border: `1px solid ${C.brass}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontWeight: 600 }}>
                          Modify time
                        </button>
                      ) : (
                        <span style={{ fontSize: 11, color: C.ivoryDim, display: "flex", alignItems: "center", gap: 4 }}>🔒 Modify locked (48h)</span>
                      ))}
                      {!cancelLocked(sel) ? (
                        <button onClick={() => setConfirmCancelId(sel.id)}
                          style={{ fontSize: 12, color: "#c0392b", background: "none", border: "1px solid #c0392b", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontWeight: 600 }}>
                          Cancel session
                        </button>
                      ) : (
                        <span style={{ fontSize: 11, color: C.ivoryDim, display: "flex", alignItems: "center", gap: 4 }}>🔒 Cancel locked (24h)</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* Video Session */}
      {tab === "video" && (
        <div style={{ padding: "20px" }}>
          {nextSession ? (() => {
            const dt = new Date(nextSession.date + "T" + nextSession.time);
            return (
              <div style={{ background: "#F4FBF6", border: "1px solid #A8D5B5", borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#1A9E6E", margin: "0 0 4px" }}>Next session with {activeLearner.name.split(" ")[0]}</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: C.ivory, margin: 0 }}>{dt.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} at {nextSession.time}</p>
              </div>
            );
          })() : (
            <div style={{ background: C.inkSoft, border: `1px solid ${C.inkLine}`, borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
              <p style={{ fontSize: 13, color: C.ivoryDim, margin: 0 }}>No upcoming confirmed & paid session with {activeLearner.name.split(" ")[0]}.</p>
            </div>
          )}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.ivory, marginBottom: 8 }}>Zoom / Meet link</p>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={zoomLink} onChange={(e) => { setZoomLink(e.target.value); setZoomSaved(false); }}
                placeholder="Paste your Zoom or Meet link…"
                style={{ flex: 1, background: C.inkSoft, border: `1px solid ${C.inkLine}`, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: C.inkText, outline: "none" }} />
              <button onClick={() => setZoomSaved(true)} disabled={!zoomLink.trim()}
                style={{ padding: "10px 16px", borderRadius: 10, background: zoomSaved ? "#1A9E6E" : C.brass, color: zoomSaved ? "#fff" : C.brassText, fontSize: 13, fontWeight: 600, border: "none", cursor: !zoomLink.trim() ? "not-allowed" : "pointer", opacity: !zoomLink.trim() ? 0.5 : 1 }}>
                {zoomSaved ? "Saved ✓" : "Save"}
              </button>
            </div>
            {zoomSaved && <p style={{ fontSize: 12, color: "#1A9E6E", marginTop: 6 }}>Link shared with {activeLearner.name.split(" ")[0]}</p>}
          </div>
          <div style={{ background: C.inkSoft, border: `1px solid ${C.inkLine}`, borderRadius: 12, padding: "20px", textAlign: "center" }}>
            <Video size={28} color={C.ivoryDim} style={{ marginBottom: 8 }} />
            <p style={{ fontSize: 13, color: C.ivoryDim, margin: 0 }}>LiveKit video integration coming soon</p>
          </div>
        </div>
      )}
      </div>{/* end card */}
      </React.Fragment> )}

      {/* The strip of two circles that used to sit here is gone. My Rules and
          My Planning are on the tab bar above, beside the room's three other
          destinations, which is where somebody looks for them. */}

      {/* Cancel confirmation modal */}
      {confirmCancelId !== null && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,20,40,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}
          onClick={() => setConfirmCancelId(null)}>
          <div style={{ background: "rgba(176,146,98,0.05)", borderRadius: 16, padding: "28px 28px 24px", maxWidth: 320, width: "90%", boxShadow: "0 8px 32px rgba(0,0,0,0.18)", textAlign: "center" }}
            onClick={(e) => e.stopPropagation()}>
            <p style={{ fontSize: 16, fontWeight: 700, color: C.inkText, margin: "0 0 8px" }}>Cancel this session?</p>
            <p style={{ fontSize: 13, color: C.ivoryDim, margin: "0 0 20px", lineHeight: 1.5 }}>Are you sure you want to cancel? This cannot be undone.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmCancelId(null)}
                style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${C.inkLine}`, background: "none", color: C.inkText, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Keep it
              </button>
              <button onClick={() => { cancelSession(confirmCancelId); setSelectedSessionId(null); setConfirmCancelId(null); }}
                style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: "#c0392b", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Yes, cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LearnerChat({ teacher, messages, onSend }) {
  const [text, setText] = useState("");
  const endRef = useRef(null);
  useEffect(() => { if (endRef.current) endRef.current.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);
  function submit() { if (!text.trim()) return; onSend(text); setText(""); }
  return (
    <div className="mt-6 rounded-xl overflow-hidden" style={{ border: `1px solid ${C.inkLine}` }}>
      <div className="px-4 py-2.5 text-xs flex items-center gap-2" style={{ background: C.inkSoft, color: C.brassLabel, borderBottom: `1px solid ${C.inkLine}` }}>
        <Check size={13} /> {teacher.name.split(" ")[0]} accepted — you can message now
      </div>
      <div className="lg-scroll overflow-y-auto px-4 py-3 flex flex-col gap-2" style={{ maxHeight: 240 }}>
        {messages.map((m, i) => (
          <div key={i} className="px-3.5 py-2 rounded-2xl text-sm" style={{ maxWidth: "80%", alignSelf: m.from === "me" ? "flex-end" : "flex-start", background: m.from === "me" ? C.brass : C.inkSoft, color: m.from === "me" ? C.brassText : C.ivory }}>
            {m.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="px-3 py-3 flex items-center gap-2" style={{ borderTop: `1px solid ${C.inkLine}` }}>
        <input style={{ ...inputStyle, flex: 1 }} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder={`Message ${teacher.name.split(" ")[0]}…`} />
        <button onClick={submit} className="rounded-full p-3" style={{ background: C.brass }}><Send size={16} color={C.inkText} /></button>
      </div>
    </div>
  );
}
