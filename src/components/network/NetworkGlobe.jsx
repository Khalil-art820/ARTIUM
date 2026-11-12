import React from "react";
import Globe from "react-globe.gl";
import * as THREE from "three";

/**
 * The Network tab's globe: a night Earth in the app's teal — deep ocean,
 * green land with lit coastlines, and gold city lights that glow on the shaded
 * side too (NASA Black Marble 2016 lights over Natural Earth 10m coastlines and lakes,
 * recoloured with gold continent borders into public/earth-*-artium-v4.jpg
 * (scripts/globe-continents.py), and an 8K "-hd-v4" pair that
 * loads once someone zooms in — see scripts/globe-night-texture.py). Then: mint
 * points at every conservatory, thin arcs between the places members study,
 * and the members themselves as portrait markers at their conservatory.
 *
 * Loaded lazily (it carries three.js), so only the Network tab pays for it.
 * Positions are the conservatories' real coordinates — nobody gets a guessed
 * home address. Markers on the far side are hidden by the globe library's
 * own visibility test, so a face never floats through the sphere.
 */

const EARTH_URL = "/earth-night-artium-v4.jpg";
const LIGHTS_URL = "/earth-lights-artium-v4.jpg";
const EARTH_HD_URL = "/earth-night-artium-hd-v4.jpg";     // 8192 x 4096
const LIGHTS_HD_URL = "/earth-lights-artium-hd-v4.jpg";   // 8192 x 4096
// Regional HD tiles (scripts/globe-hd-tiles.py): 15 x 15 degree squares at
// 2048 px, about 6x the 8K map, laid over the globe where you zoom past what
// the 8K map can show sharply. Only land squares exist; the list is index.json.
const TILE_BASE = "/globe-tiles/v1/";
const TILE_ALT = 0.55;     // below this altitude the tiles take over
const TILE_MAX = 8;        // at most this many in memory (each ~40 MB on the GPU)
const MINT = "#42C9B8";
// The five continents' names, floating over each one (gold, spaced caps).
const CONTINENTS = [
  { name: "Europe", lat: 55, lng: 34 },   // east of the busy west-European cities
  { name: "Asia", lat: 47, lng: 92 },
  { name: "Africa", lat: 6, lng: 20 },
  { name: "America", lat: 6, lng: -74 },
  { name: "Oceania", lat: -24, lng: 134 },
];
const DEFAULT_POV = { lat: 27, lng: -1, altitude: 1.36 };
// The camera distance that draws the globe at a given on-screen diameter:
// as large as the design wants (≈390px), never wider than the space it sits
// in, so its edge is never cut. Camera fov is the library's 50°.
const FIT_MAX_DIAMETER = 392;
function fitAltitude(w, h) {
  if (!w || !h) return DEFAULT_POV.altitude;
  const r = Math.min(FIT_MAX_DIAMETER, w - 8, h - 16) / 2;
  const d = Math.sqrt(1 + ((h / 2) / Math.tan((25 * Math.PI) / 180) / r) ** 2);
  return Math.round((d - 1) * 1000) / 1000;
}

const prefersReducedMotion = () => {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
};

// Group members standing at (nearly) the same place for the current zoom.
// Members sit at their home city when they gave one, else at their
// conservatory (placeKey says which). Rules that keep a crowded globe legible:
//  - places are merged by on-screen distance, biggest first: a place closer
//    than one bubble's width to a bigger one joins its bubble, so bubbles never
//    overlap. Zoomed out that makes one bubble per region; zooming in splits
//    them into cities;
//  - two or more people in one city always share one bubble with the city's
//    name (up to three faces and a +N), whose counter opens the list;
//  - never more than MAX_MARKERS markers: the merge distance grows until the
//    count fits, so a busy network stays smooth on an older phone.
// On screen, one degree is about PX_PER_DEG / altitude pixels at the centre.
const FAN_MAX = 1;          // two or more in one city always share one named bubble
const FAN_ALTITUDE = 0.95;   // the same "zoomed in" as the HD map swap
const MAX_MARKERS = 60;
const PX_PER_DEG = 7.2;
const BUBBLE_PX = 52;        // a one-face bubble and its +N, with a margin
const degFor = (px, altitude) => (px * altitude) / PX_PER_DEG;
// Distance in degrees, longitude shrunk toward the poles.
const dist = (a, b) => Math.hypot(a.lat - b.lat, (a.lng - b.lng) * Math.max(0.15, Math.cos((a.lat * Math.PI) / 180)));
function clusterPlaces(places, reach) {
  const clusters = [];
  for (const p of places) {
    const near = clusters.find((c) => dist(c, p) < reach);
    if (near) { near.members.push(...p.members); near.places.push(p); } else clusters.push({ lat: p.lat, lng: p.lng, members: [...p.members], places: [p] });
  }
  return clusters;
}
function placeLabel(places) {
  const names = [...new Set(places.map((p) => (p.name || "").trim()).filter(Boolean).map((n) => n.toLowerCase()))];
  if (names.length === 1) return places.find((p) => (p.name || "").trim().toLowerCase() === names[0]).name.trim();
  return names.length > 1 ? `${names.length} cities` : "";
}
// Push markers apart (in degrees, longitude shrunk toward the poles) until no
// two overlap: each needs its own radius plus the other's. A few passes are
// enough for a city's neighbours; nothing moves when nothing overlaps.
function relax(items, altitude, capPx = Infinity) {
  for (const it of items) { it.oLat = it.lat; it.oLng = it.lng; }
  const cap = degFor(capPx, altitude);
  for (let pass = 0; pass < 40; pass++) {
    let moved = false;
    for (let a = 0; a < items.length; a++) {
      for (let b = a + 1; b < items.length; b++) {
        const A = items[a], B = items[b];
        const cosLat = Math.max(0.15, Math.cos((((A.lat + B.lat) / 2) * Math.PI) / 180));
        let dx = (B.lng - A.lng) * cosLat, dy = B.lat - A.lat;
        let d = Math.hypot(dx, dy);
        const need = degFor(A.rPx + B.rPx, altitude);
        if (d >= need) continue;
        if (d < 1e-6) { dx = 1; dy = 0; d = 1e-6; }   // same point: split sideways
        const push = (need - d) / 2 + 1e-4;
        const ux = dx / d, uy = dy / d;
        A.lat -= uy * push; A.lng -= (ux * push) / cosLat;
        B.lat += uy * push; B.lng += (ux * push) / cosLat;
        // never further than the cap from its true place
        for (const P of [A, B]) {
          const cl = Math.max(0.15, Math.cos((P.oLat * Math.PI) / 180));
          const ex = (P.lng - P.oLng) * cl, ey = P.lat - P.oLat, e = Math.hypot(ex, ey);
          if (e > cap) { P.lat = P.oLat + (ey / e) * cap; P.lng = P.oLng + (ex / e) * cap / cl; }
        }
        moved = true;
      }
    }
    if (!moved) break;
  }
}
function groupMarkers(members, altitude, selectedId, linked = new Set()) {
  const out = [];
  const byPlace = new Map();
  let selected = null;
  const solos = [];
  for (const m of members) {
    // The selected member always stands on their own, highlighted.
    if (m.id === selectedId) { selected = m; continue; }
    // Zoomed in, someone connected to another of your connections stands
    // alone, so the line between the two can be drawn. Zoomed out they stay
    // in their bubble.
    if (altitude < FAN_ALTITUDE && linked.has(m.id)) { solos.push(m); continue; }
    const key = m.placeKey || `${m.lat},${m.lng}`;
    if (!byPlace.has(key)) byPlace.set(key, { key, name: m.placeName || "", lat: m.lat, lng: m.lng, members: [] });
    byPlace.get(key).members.push(m);
  }
  // Biggest places first, so a city's bubble sits on the city, not a suburb.
  const places = [...byPlace.values()].sort((a, b) => b.members.length - a.members.length);
  const zoomedIn = altitude < FAN_ALTITUDE;
  // Zoomed out, nearby places merge into one bubble ("5 cities"). Zoomed in,
  // every place keeps its own marker and overlapping ones are nudged apart
  // instead, so close cities (London and Paris, Vienna and Bratislava) always
  // separate without zooming in past what the 8K map can show sharply.
  let clusters;
  if (zoomedIn && places.length <= MAX_MARKERS) {
    clusters = places.map((p) => ({ lat: p.lat, lng: p.lng, members: [...p.members], places: [p] }));
  } else {
    let reach = degFor(BUBBLE_PX, altitude);
    clusters = clusterPlaces(places, reach);
    while (clusters.length > MAX_MARKERS && reach < 60) { reach *= 1.5; clusters = clusterPlaces(places, reach); }
  }
  // Each marker's footprint in screen pixels (face or bubble plus its label).
  for (const c of clusters) {
    const n = c.members.length;
    c.ring = zoomedIn && c.places.length === 1 && n > 1 && n <= FAN_MAX;
    c.ringPx = Math.max(30, (n * 33) / (2 * Math.PI));   // room for the city name in the middle
    c.rPx = n === 1 ? 22 : c.ring ? c.ringPx + 18 : 28;   // face (+label) or one-face bubble
  }
  // The linked faces, each its own marker at its own place.
  const soloItems = solos.map((m) => ({ lat: m.lat, lng: m.lng, members: [m], places: [{ key: m.placeKey, name: m.placeName || "" }], rPx: 22, solo: true }));
  clusters = clusters.concat(soloItems);
  const items = selected ? [{ lat: selected.lat, lng: selected.lng, rPx: 24, fixed: true }, ...clusters] : clusters;
  // Nudge overlapping markers apart: always once linked faces stand alone
  // among the bubbles, otherwise only zoomed in.
  // With linked faces about, a face moves at most about a face's width from
  // its city (a crowd may overlap a little rather than drift away).
  if (zoomedIn || soloItems.length) relax(items, altitude, soloItems.length ? (zoomedIn ? 40 : 26) : Infinity);
  if (selected) out.push({ kind: "member", id: selected.id, lat: items[0].lat, lng: items[0].lng, member: selected, selected: true, place: selected.placeName || "" });
  const named = new Set();
  // Places that already have their own bubble (which carries the name).
  const bubbled = new Set(clusters.filter((c) => !c.solo && c.members.length > 1 && c.places.length === 1).map((c) => c.places[0].key));
  for (const c of clusters) {
    const list = c.members;
    const n = list.length;
    if (n === 1) {
      // Each city's name shows once: on its bubble if it has one, else on the
      // first face there. Linked faces stay unlabelled when zoomed out.
      let place = c.places[0].name || "";
      const k = c.places[0].key || place;
      if ((c.solo && !zoomedIn) || named.has(k) || bubbled.has(k)) place = "";
      named.add(k);
      out.push({ kind: "member", id: list[0].id, lat: c.lat, lng: c.lng, member: list[0], selected: false, place });
      continue;
    }
    if (c.ring) {
      const r = degFor(c.ringPx, altitude);
      const cosLat = Math.max(0.15, Math.cos((c.lat * Math.PI) / 180));
      // The city's name sits at the ring's centre.
      if (c.places[0].name) out.push({ kind: "place", id: `p:${c.places[0].key}`, lat: c.lat, lng: c.lng, name: c.places[0].name });
      list.forEach((m, k) => {
        const a = (2 * Math.PI * k) / n - Math.PI / 2;
        out.push({ kind: "member", id: m.id, lat: c.lat + r * Math.sin(a), lng: c.lng + (r * Math.cos(a)) / cosLat, member: m, selected: false });
      });
      continue;
    }
    out.push({
      kind: "group", id: `g:${list.map((m) => m.id).sort().join(",")}`, lat: c.lat, lng: c.lng, members: list, selected: false,
      // One city: its name. Several: how many (members at a school without a
      // home city count under the school's city, so names are deduplicated).
      place: placeLabel(c.places),
    });
  }
  return out;
}

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function faceHTML(m, size, ring) {
  const inner = m.photoUrl
    ? `<img src="${esc(m.photoUrl)}" alt="" draggable="false" style="width:100%;height:100%;object-fit:cover;display:block" onerror="this.remove()">`
    : "";
  const initials = esc((m.name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase());
  return `<span class="ng-face" style="width:${size}px;height:${size}px;box-shadow:0 0 0 2px #fff,0 0 0 ${ring}px rgba(120,235,220,.85),0 0 ${ring * 4}px ${ring}px rgba(120,235,220,.55),0 4px 10px rgba(0,0,0,.45)">
    <b>${initials}</b>${inner}</span>`;
}

export default function NetworkGlobe({ members, links = [], conservatories, focus, selectedId, onSelectMember, onSelectGroup, height = 330 }) {
  const wrapRef = React.useRef(null);
  const tapStart = React.useRef(null);
  const shadeRef = React.useRef(null);
  const globeRef = React.useRef(null);
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  const [ready, setReady] = React.useState(false);
  const [altitude, setAltitude] = React.useState(DEFAULT_POV.altitude);
  const idleTimer = React.useRef(null);
  const baseAlt = React.useRef(DEFAULT_POV.altitude);   // the whole-globe view's altitude

  // Size from the container (react-globe.gl needs explicit pixels).
  React.useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width), h = Math.round(e.contentRect.height);
      setSize((p) => (p.w === w && p.h === h ? p : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);


  // The globe image is the lit texture; the lights alone are also the
  // emissive map, so cities keep glowing where the light falls away.
  const material = React.useMemo(() => {
    const lights = new THREE.TextureLoader().load(LIGHTS_URL);
    lights.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshPhongMaterial({
      color: new THREE.Color("#FFFFFF"), emissive: new THREE.Color("#FFFFFF"), emissiveMap: lights, emissiveIntensity: 1.3,
      shininess: 8, specular: new THREE.Color("#0E3B37"),
    });
  }, []);
  React.useEffect(() => () => { material.emissiveMap?.dispose(); material.dispose(); }, [material]);

  // Camera, controls, frame budget, and pausing when off-screen.
  React.useEffect(() => {
    if (!ready || !globeRef.current) return;
    const g = globeRef.current;
    baseAlt.current = fitAltitude(size.w, size.h);
    g.pointOfView({ ...DEFAULT_POV, altitude: fitAltitude(size.w, size.h) }, 0);
    try { g.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75)); } catch { /* older three */ }
    // Up/down swipes scroll the page, sideways swipes spin the globe, pinch
    // still zooms. The browser takes a vertical pan itself (and cancels the
    // controls' pointer); OrbitControls had set "none", which trapped every
    // swipe that started on the globe.
    try { g.renderer().domElement.style.touchAction = "pan-y"; } catch { /* not ready */ }
    let detach = null;
    const c = g.controls();
    if (c) {
      c.enableZoom = true;
      c.minDistance = 110;   // with the regional HD tiles the map stays sharp this close
      c.maxDistance = 420;
      c.zoomSpeed = 0.7;
      c.rotateSpeed = 0.55;
      c.autoRotate = !prefersReducedMotion();
      c.autoRotateSpeed = 0.22;
      const hold = () => { c.autoRotate = false; clearTimeout(idleTimer.current); };
      // The slow spin resumes only once you are back out at the whole-globe
      // view; zoomed in, the globe stays exactly where you left it.
      const release = () => {
        clearTimeout(idleTimer.current);
        if (prefersReducedMotion()) return;
        idleTimer.current = setTimeout(() => {
          const alt = pov.current?.altitude ?? 9;
          if (alt >= baseAlt.current * 0.95) c.autoRotate = true;
        }, 7000);
      };
      c.addEventListener("start", hold);
      c.addEventListener("end", release);
      detach = () => { c.removeEventListener("start", hold); c.removeEventListener("end", release); };
    }
    // Nothing to draw while the globe is scrolled away.
    let io;
    if ("IntersectionObserver" in window && wrapRef.current) {
      io = new IntersectionObserver(([e]) => {
        try { if (e.isIntersecting) g.resumeAnimation(); else g.pauseAnimation(); } catch { /* not ready */ }
      }, { threshold: 0.01 });
      io.observe(wrapRef.current);
    }
    // Sharp map at a slant: full anisotropic filtering on both textures (the
    // globe image arrives a moment after ready, so wait for it).
    let tries = 0;
    const sharpen = setInterval(() => {
      try {
        const max = g.renderer().capabilities.getMaxAnisotropy();
        // `material` is the one passed as globeMaterial; the library puts the
        // globe image on it as .map.
        let done = true;
        for (const tex of [material.map, material.emissiveMap]) {
          if (!tex) { done = false; continue; }
          if (tex.anisotropy !== max) { tex.anisotropy = max; tex.needsUpdate = true; }
        }
        if (done || ++tries > 40) clearInterval(sharpen);
      } catch { clearInterval(sharpen); }
    }, 250);
    return () => { detach && detach(); io && io.disconnect(); clearTimeout(idleTimer.current); clearInterval(sharpen); };
  }, [ready]);

  // Zoomed in, draw at the screen's full pixel density (up to 3x) so the 8K
  // map and coastlines stay crisp; zoomed out, a lighter 1.75x keeps it
  // smooth. The lines stay fluid by thinning and slowing with the zoom.
  const zoomedIn = altitude < 0.95;
  React.useEffect(() => {
    if (!ready || !globeRef.current) return;
    const dpr = window.devicePixelRatio || 1;
    try { globeRef.current.renderer().setPixelRatio(Math.min(dpr, zoomedIn ? 3 : 1.75)); } catch { /* not ready */ }
  }, [ready, zoomedIn]);

  // The first zoom-in swaps in the 8K map and lights (about 2.2 MB, fetched only then),
  // on devices whose GPU takes a texture that size. It stays for the visit.
  const hdLoaded = React.useRef(false);
  React.useEffect(() => {
    if (!ready || !zoomedIn || hdLoaded.current || !globeRef.current) return;
    const g = globeRef.current;
    let renderer;
    try { renderer = g.renderer(); } catch { return; }
    if ((renderer.capabilities.maxTextureSize || 0) < 8192) return;
    hdLoaded.current = true;
    const loader = new THREE.TextureLoader();
    const aniso = renderer.capabilities.getMaxAnisotropy();
    const prep = (tex) => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = aniso; return tex; };
    loader.load(EARTH_HD_URL, (tex) => {
      const old = material.map;
      material.map = prep(tex); material.needsUpdate = true;
      if (old && old !== tex) old.dispose();
    });
    loader.load(LIGHTS_HD_URL, (tex) => {
      const old = material.emissiveMap;
      material.emissiveMap = prep(tex); material.needsUpdate = true;
      if (old && old !== tex) old.dispose();
    });
  }, [ready, zoomedIn, material]);

  // Regional HD tiles: when zoomed in past TILE_ALT, load the 15-degree
  // squares that cover the view and lay each one exactly over its patch of
  // the globe (same lighting and material as the globe itself), a hair above
  // the surface. Least recently seen tiles are freed past TILE_MAX.
  const tiles = React.useRef(new Map());       // "row_col" -> { mesh, seen }
  const tileIndex = React.useRef(null);        // Set of tile names, or false if unavailable
  const pov = React.useRef(null);
  const tileTick = React.useRef(0);
  const updateTiles = React.useCallback(() => {
    const g = globeRef.current; const p = pov.current;
    if (!g || !p) return;
    const map = tiles.current;
    if (p.altitude > TILE_ALT) { for (const t of map.values()) t.mesh.visible = false; return; }
    if (tileIndex.current === null) {
      tileIndex.current = false;
      fetch(TILE_BASE + "index.json").then((r) => r.json()).then((d) => { tileIndex.current = new Set(d.tiles || []); updateTiles(); }).catch(() => {});
      return;
    }
    if (!tileIndex.current) return;
    let renderer; try { renderer = g.renderer(); } catch { return; }
    if ((renderer.capabilities.maxTextureSize || 0) < 2048) return;
    // The view's half-size in degrees, with a margin (about 26 x altitude).
    const half = 30 * p.altitude + 2;
    const cosLat = Math.max(0.2, Math.cos((p.lat * Math.PI) / 180));
    const want = new Set();
    const r0 = Math.max(0, Math.floor((90 - (p.lat + half)) / 15)), r1 = Math.min(9, Math.floor((90 - (p.lat - half)) / 15));
    const span = Math.min(180, half / cosLat);
    for (let r = r0; r <= r1; r++) {
      for (let lng = p.lng - span; lng <= p.lng + span + 15; lng += 15) {
        const c = ((Math.floor((Math.min(lng, p.lng + span) + 180) / 15) % 24) + 24) % 24;
        const name = `${r}_${c}`;
        if (tileIndex.current.has(name)) want.add(name);
      }
    }
    const now = ++tileTick.current;
    for (const [name, t] of map) { t.mesh.visible = want.has(name); if (t.mesh.visible) t.seen = now; }
    const scene = g.scene();
    for (const name of want) {
      if (map.has(name)) continue;
      const [row, col] = name.split("_").map(Number);
      const lng0 = -180 + col * 15, lat1 = 90 - row * 15, N = 24;
      const pos = [], nrm = [], uv = [], idx = [];
      for (let j = 0; j <= N; j++) {
        for (let i = 0; i <= N; i++) {
          const c = g.getCoords(lat1 - (15 * j) / N, lng0 + (15 * i) / N, 0.0008);
          const l = Math.hypot(c.x, c.y, c.z) || 1;
          pos.push(c.x, c.y, c.z); nrm.push(c.x / l, c.y / l, c.z / l); uv.push(i / N, 1 - j / N);
        }
      }
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      geo.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));   // straight out, as on the globe
      geo.setIndex(idx);
      const mat = new THREE.MeshPhongMaterial({
        color: new THREE.Color("#FFFFFF"), emissive: new THREE.Color("#FFFFFF"), emissiveIntensity: 1.3,
        shininess: 8, specular: new THREE.Color("#0E3B37"), transparent: true, opacity: 0, side: THREE.DoubleSide,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 1; mesh.visible = true;
      const t = { mesh, seen: now };
      map.set(name, t);
      scene.add(mesh);
      // Shown once both images are in, so a half-loaded tile never flashes.
      const loader = new THREE.TextureLoader();
      const aniso = renderer.capabilities.getMaxAnisotropy();
      const prep = (tex) => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = aniso; return tex; };
      let n = 0;
      const done = () => { if (++n === 2 && map.get(name) === t) { mat.opacity = 1; mat.transparent = false; mat.needsUpdate = true; } };
      loader.load(`${TILE_BASE}${name}-night.jpg`, (tex) => { mat.map = prep(tex); mat.needsUpdate = true; done(); });
      loader.load(`${TILE_BASE}${name}-lights.jpg`, (tex) => { mat.emissiveMap = prep(tex); mat.needsUpdate = true; done(); });
    }
    // Free the least recently seen beyond the cap.
    if (map.size > TILE_MAX) {
      const old = [...map.entries()].filter(([n2]) => !want.has(n2)).sort((a, b) => a[1].seen - b[1].seen);
      for (const [n2, t] of old.slice(0, map.size - TILE_MAX)) {
        scene.remove(t.mesh); t.mesh.geometry.dispose();
        t.mesh.material.map?.dispose(); t.mesh.material.emissiveMap?.dispose(); t.mesh.material.dispose();
        map.delete(n2);
      }
    }
  }, []);
  const tileRaf = React.useRef(0);
  // The globe's radius on screen for a camera altitude (inverse of fitAltitude).
  const sizeShade = React.useCallback((alt) => {
    const el = shadeRef.current; if (!el || !size.h) return;
    const d = 1 + alt;
    const r = (size.h / 2) / Math.tan((25 * Math.PI) / 180) / Math.sqrt(d * d - 1);
    el.style.width = el.style.height = `${Math.round(2 * r)}px`;
  }, [size.h]);
  React.useEffect(() => { sizeShade(pov.current?.altitude ?? fitAltitude(size.w, size.h)); }, [sizeShade, size.w, size.h]);
  const onPov = React.useCallback((p) => {
    pov.current = p;
    sizeShade(p.altitude);
    // Zooming in stops the slow spin at once, so the view never drifts.
    if (p.altitude < baseAlt.current * 0.95) {
      try { const c = globeRef.current?.controls(); if (c) c.autoRotate = false; } catch { /* not ready */ }
      clearTimeout(idleTimer.current);
    }
    if (tileRaf.current) return;
    tileRaf.current = requestAnimationFrame(() => { tileRaf.current = 0; updateTiles(); });
  }, [updateTiles, sizeShade]);
  React.useEffect(() => () => {
    cancelAnimationFrame(tileRaf.current);
    let scene = null; try { scene = globeRef.current?.scene(); } catch { /* gone */ }
    for (const t of tiles.current.values()) {
      scene?.remove(t.mesh); t.mesh.geometry.dispose();
      t.mesh.material.map?.dispose(); t.mesh.material.emissiveMap?.dispose(); t.mesh.material.dispose();
    }
    tiles.current.clear();
  }, []);

  // Fly to whatever the page asks for (a carousel pick, a recenter).
  React.useEffect(() => {
    if (!ready || !globeRef.current || !focus) return;
    const g = globeRef.current;
    const c = g.controls(); if (c) c.autoRotate = false;
    clearTimeout(idleTimer.current);
    if (focus.reset) g.pointOfView({ ...DEFAULT_POV, altitude: fitAltitude(size.w, size.h) }, prefersReducedMotion() ? 0 : 900);
    else if (Number.isFinite(focus.lat) && Number.isFinite(focus.lng)) {
      g.pointOfView({ lat: focus.lat, lng: focus.lng, altitude: Math.min(altitude, 1.55) }, prefersReducedMotion() ? 0 : 900);
    }
  }, [focus?.at, ready]);

  // Continent names fade out as their continent turns toward the rim, so a
  // name is only fully shown while it faces you (never cut by the edge).
  const labelEls = React.useRef({});
  React.useEffect(() => {
    if (!ready || !globeRef.current) return;
    const g = globeRef.current;
    let raf;
    const tick = () => {
      try {
        const cam = g.camera().position;
        const cl = Math.hypot(cam.x, cam.y, cam.z) || 1;
        for (const k in labelEls.current) {
          const { el, lat, lng } = labelEls.current[k];
          const p = g.getCoords(lat, lng, 0);
          const pl = Math.hypot(p.x, p.y, p.z) || 1;
          const dot = (p.x * cam.x + p.y * cam.y + p.z * cam.z) / (pl * cl);
          const o = Math.max(0, Math.min(1, (dot - 0.5) / 0.3));
          el.style.opacity = o.toFixed(2);
          el.style.visibility = o > 0.02 ? "visible" : "hidden";
        }
      } catch { /* not ready */ }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready]);
  // Everyone on the globe who is connected to another person on it.
  const linkedIds = React.useMemo(() => {
    const here = new Set(members.map((m) => m.id));
    const out = new Set();
    for (const [a, b] of links) if (here.has(a) && here.has(b) && a !== b) { out.add(a); out.add(b); }
    return out;
  }, [members, links]);
  const markers = React.useMemo(() => [
    ...CONTINENTS.map((c) => ({ kind: "label", id: `c:${c.name}`, ...c })),
    ...groupMarkers(members, altitude, selectedId, linkedIds),
  ], [members, altitude, selectedId, linkedIds]);

  // No dots for the conservatories: the globe shows people, not schools.
  const points = [];

  // Arcs: only between two members shown here who are connected to each
  // other (links: [idA, idB] pairs), and only when they stand apart.
  // Lines join two connected people only while each stands alone on the
  // globe (a single face, not folded into a bubble), so they follow the zoom.
  // Each single face's displayed position (after any nudge), rounded so a face
  // that does not move never rebuilds the lines.
  const singlesKey = React.useMemo(() => markers.filter((d) => d.kind === "member")
    .map((d) => `${d.id}@${d.lat.toFixed(3)}@${d.lng.toFixed(3)}`).sort().join(","), [markers]);
  const arcs = React.useMemo(() => {
    // Lines (and the rings where they land) start and end at the centre of
    // each face, exactly where it is drawn.
    const byId = new Map((singlesKey ? singlesKey.split(",") : []).map((e) => {
      const [id, lat, lng] = e.split("@"); return [id, { lat: +lat, lng: +lng }];
    }));
    const seen = new Set();
    const out = [];
    for (const [ia, ib] of links) {
      const a = byId.get(ia), b = byId.get(ib);
      if (!a || !b || (Math.abs(a.lat - b.lat) < 0.05 && Math.abs(a.lng - b.lng) < 0.05)) continue;
      const k = [ia, ib].sort().join("|");
      if (seen.has(k)) continue;
      seen.add(k); out.push({ startLat: a.lat, startLng: a.lng, endLat: b.lat, endLng: b.lng });
      if (out.length >= 40) break;
    }
    return out;
  }, [links, singlesKey]);

  const reduced = prefersReducedMotion();
  // Zoomed in, the lines would swell and the travelling dots jump many pixels
  // a frame. In three zoom bands (so the lines are not rebuilt on every zoom
  // step) they get thinner and slower in map terms, about the same on screen.
  const arcScale = altitude > 0.95 ? 1 : altitude > 0.5 ? 0.5 : altitude > 0.25 ? 0.28 : 0.14;

  // Each arc is drawn twice: a faint steady line, and over it a string of
  // bright dots travelling along it. Where arcs land, a glow ripples out.
  const arcLayers = React.useMemo(() => [
    ...arcs.map((a, i) => ({ ...a, id: `l${i}`, dots: false })),
    ...arcs.map((a, i) => ({ ...a, id: `d${i}`, dots: true, initialGap: (i * 0.37) % 1 })),
  ], [arcs]);
  const landings = React.useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const a of arcs) {
      for (const [lat, lng] of [[a.startLat, a.startLng], [a.endLat, a.endLng]]) {
        const k = `${lat.toFixed(2)},${lng.toFixed(2)}`;
        if (!seen.has(k)) { seen.add(k); out.push({ lat, lng }); }
      }
    }
    return out;
  }, [arcs]);

  return (
    // Faces and bubbles let every touch through to the globe (so a swipe that
    // starts on a crowd of faces still spins it); a touch that barely moves
    // counts as a tap on whatever marker is under it.
    <div ref={wrapRef} className="ng-wrap" style={{ height }}
      onPointerDown={(e) => { tapStart.current = { x: e.clientX, y: e.clientY }; }}
      onPointerUp={(e) => {
        const st = tapStart.current; tapStart.current = null;
        if (!st || Math.hypot(e.clientX - st.x, e.clientY - st.y) > 8) return;
        const hit = [...(wrapRef.current?.querySelectorAll(".ng-marker") || [])]
          .filter((el) => el.style.opacity !== "0" && typeof el.__tap === "function")
          .map((el) => { const r = el.getBoundingClientRect(); return { el, r }; })
          .filter(({ r }) => e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom)
          .sort((a, b) => a.r.width * a.r.height - b.r.width * b.r.height)[0];
        if (hit) hit.el.__tap();
      }}>
      {size.w > 0 && (
        <Globe
          ref={globeRef}
          width={size.w}
          height={size.h}
          backgroundColor="rgba(0,0,0,0)"
          rendererConfig={{ antialias: true, alpha: true, powerPreference: "low-power" }}
          animateIn={!reduced}
          onGlobeReady={() => setReady(true)}
          onZoom={(p) => {
            const a = Math.round(p.altitude * 50) / 50;
            setAltitude((prev) => (prev === a ? prev : a));
            onPov(p);
          }}
          globeMaterial={material}
          globeImageUrl={EARTH_URL}
          // No halo: the globe sits clean on the white page.
          showAtmosphere={false}
          pointsData={points}
          pointLat="lat"
          pointLng="lng"
          pointAltitude={0.006}
          pointRadius={(d) => (d.on ? 0.6 : 0.34)}
          pointColor={(d) => (d.on ? "rgba(170,255,240,1)" : "rgba(90,220,200,0.8)")}
          pointsMerge
          pointsTransitionDuration={0}
          arcsData={arcLayers}
          arcColor={(d) => (d.dots ? ["rgba(225,255,250,1)", "rgba(255,226,160,1)"] : ["rgba(120,235,220,0.45)", "rgba(222,190,125,0.45)"])}
          arcStroke={(d) => (d.dots ? 0.9 : 0.45) * arcScale}
          arcAltitudeAutoScale={0.38}
          arcDashLength={(d) => (d.dots ? 0.009 : 1)}
          arcDashGap={(d) => (d.dots ? 0.13 : 0)}
          arcDashInitialGap={(d) => (d.dots ? d.initialGap : 0)}
          arcDashAnimateTime={(d) => (d.dots && !reduced ? Math.round(5200 / arcScale) : 0)}
          arcsTransitionDuration={0}
          ringsData={reduced ? [] : landings}
          ringLat="lat"
          ringLng="lng"
          // Bright at the face's centre and fading as it spreads, so each line
          // seems to spring out of (and land into) the middle of the face.
          ringColor={() => (t) => `rgba(170,250,238,${Math.pow(Math.max(0, 1 - t), 1.6)})`}
          // In screen terms: from the face's centre out to about 22px past its
          // edge, at every zoom (degrees = px x altitude / PX_PER_DEG).
          ringMaxRadius={degFor(36, altitude)}
          ringPropagationSpeed={degFor(36, altitude) / 1.3}
          ringRepeatPeriod={1500}
          ringAltitude={0.004}
          htmlElementsData={markers}
          htmlLat="lat"
          htmlLng="lng"
          // Faces, the pulsing rings and the lines' ends all sit at the same
          // height, so at any angle a ring is centred on its face.
          htmlAltitude={0.004}
          htmlTransitionDuration={0}
          htmlElementVisibilityModifier={(el, visible) => {
            if (el.classList.contains("ng-continent")) return;   // faded by the loop above
            if (el.classList.contains("ng-place-solo")) { el.style.opacity = visible ? "1" : "0"; return; }   // never takes a tap
            el.style.opacity = visible ? "1" : "0";
            el.style.pointerEvents = visible ? "auto" : "none";
          }}
          htmlElement={(d) => {
            if (d.kind === "place") {
              const el = document.createElement("span");
              el.className = "ng-place ng-place-solo";
              el.textContent = d.name;
              return el;
            }
            if (d.kind === "label") {
              const el = document.createElement("span");
              el.className = "ng-continent";
              el.textContent = d.name;
              labelEls.current[d.id] = { el, lat: d.lat, lng: d.lng };
              return el;
            }
            const el = document.createElement("button");
            el.type = "button";
            el.className = `ng-marker${d.selected ? " is-on" : ""}`;
            if (d.kind === "member") {
              const m = d.member;
              el.setAttribute("aria-label", `${m.name}${m.instrumentLabel ? `, ${m.instrumentLabel}` : ""}`);
              el.innerHTML = faceHTML(m, d.selected ? 32 : 25, d.selected ? 4 : 2) + (d.place ? `<span class="ng-place">${esc(d.place)}</span>` : "");
              el.__tap = () => onSelectMember(m.id);
              el.onclick = (e) => { e.stopPropagation(); el.__tap(); };
            } else {
              // One portrait (the first in order: the earliest connection), a
              // "+N" for everyone else here, and the city (or "N cities").
              el.setAttribute("aria-label", `${d.members.length} musicians${d.place ? ` in ${d.place}` : " here"} — open the list`);
              el.innerHTML = `<span class="ng-group">${faceHTML(d.members[0], 23, 2)}<span class="ng-more">+${d.members.length - 1}</span></span>`
                + (d.place ? `<span class="ng-place">${esc(d.place)}</span>` : "");
              el.__tap = () => onSelectGroup(d.members);
              el.onclick = (e) => { e.stopPropagation(); el.__tap(); };
            }
            return el;
          }}
        />
      )}
      {/* Depth: the rim darkens a little (as a real planet's does) and a soft
          shadow sits under the globe on the page. Sized to the globe's disc on
          screen at every zoom (see onPov). */}
      <div ref={shadeRef} className="ng-shade" aria-hidden="true" />
    </div>
  );
}
