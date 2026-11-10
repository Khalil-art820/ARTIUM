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
//  - zoomed in, a single place with up to FAN_MAX people fans out into a ring
//    of faces (each tappable) when the ring has room; more stays a bubble
//    whose counter opens the list;
//  - never more than MAX_MARKERS markers: the merge distance grows until the
//    count fits, so a busy network stays smooth on an older phone.
// On screen, one degree is about PX_PER_DEG / altitude pixels at the centre.
const FAN_MAX = 8;
const FAN_ALTITUDE = 0.95;   // the same "zoomed in" as the HD map swap
const MAX_MARKERS = 60;
const PX_PER_DEG = 7.2;
const BUBBLE_PX = 64;        // a three-face bubble and its +N, with a margin
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
function relax(items, altitude) {
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
        moved = true;
      }
    }
    if (!moved) break;
  }
}
function groupMarkers(members, altitude, selectedId) {
  const out = [];
  const byPlace = new Map();
  let selected = null;
  for (const m of members) {
    // The selected member always stands on their own, highlighted.
    if (m.id === selectedId) { selected = m; continue; }
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
    c.rPx = n === 1 ? 24 : c.ring ? c.ringPx + 18 : 36;
  }
  const items = selected ? [{ lat: selected.lat, lng: selected.lng, rPx: 26, fixed: true }, ...clusters] : clusters;
  if (zoomedIn) relax(items, altitude);
  if (selected) out.push({ kind: "member", id: selected.id, lat: items[0].lat, lng: items[0].lng, member: selected, selected: true, place: selected.placeName || "" });
  for (const c of clusters) {
    const list = c.members;
    const n = list.length;
    if (n === 1) { out.push({ kind: "member", id: list[0].id, lat: c.lat, lng: c.lng, member: list[0], selected: false, place: c.places[0].name || "" }); continue; }
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
  const globeRef = React.useRef(null);
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  const [ready, setReady] = React.useState(false);
  const [altitude, setAltitude] = React.useState(DEFAULT_POV.altitude);
  const idleTimer = React.useRef(null);

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
      // No closer than the 8K map can stay sharp (about 2x its pixels on
      // screen at 3x density); closer, it turns visibly soft.
      c.minDistance = 145;
      c.maxDistance = 420;
      c.zoomSpeed = 0.7;
      c.rotateSpeed = 0.55;
      c.autoRotate = !prefersReducedMotion();
      c.autoRotateSpeed = 0.22;
      const hold = () => { c.autoRotate = false; clearTimeout(idleTimer.current); };
      const release = () => {
        clearTimeout(idleTimer.current);
        if (!prefersReducedMotion()) idleTimer.current = setTimeout(() => { c.autoRotate = true; }, 7000);
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
  const markers = React.useMemo(() => [
    ...CONTINENTS.map((c) => ({ kind: "label", id: `c:${c.name}`, ...c })),
    ...groupMarkers(members, altitude, selectedId),
  ], [members, altitude, selectedId]);

  // No dots for the conservatories: the globe shows people, not schools.
  const points = [];

  // Arcs: only between two members shown here who are connected to each
  // other (links: [idA, idB] pairs), and only when they stand apart.
  const arcs = React.useMemo(() => {
    const byId = new Map(members.map((m) => [m.id, m]));
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
  }, [members, links]);

  const reduced = prefersReducedMotion();
  // Zoomed in, the lines would swell and the travelling dots jump many pixels
  // a frame. In three zoom bands (so the lines are not rebuilt on every zoom
  // step) they get thinner and slower in map terms, about the same on screen.
  const arcScale = altitude > 0.95 ? 1 : altitude > 0.5 ? 0.5 : 0.28;

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
    <div ref={wrapRef} className="ng-wrap" style={{ height }}>
      {size.w > 0 && (
        <Globe
          ref={globeRef}
          width={size.w}
          height={size.h}
          backgroundColor="rgba(0,0,0,0)"
          rendererConfig={{ antialias: true, alpha: true, powerPreference: "low-power" }}
          animateIn={!reduced}
          onGlobeReady={() => setReady(true)}
          onZoom={(pov) => {
            const a = Math.round(pov.altitude * 20) / 20;
            setAltitude((p) => (p === a ? p : a));
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
          ringColor={() => (t) => `rgba(150,245,230,${Math.max(0, 1 - t) * 0.9})`}
          ringMaxRadius={2.4}
          ringPropagationSpeed={1.6}
          ringRepeatPeriod={1500}
          ringAltitude={0.004}
          htmlElementsData={markers}
          htmlLat="lat"
          htmlLng="lng"
          htmlAltitude={0.02}
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
              el.innerHTML = faceHTML(m, d.selected ? 36 : 28, d.selected ? 4 : 2) + (d.place ? `<span class="ng-place">${esc(d.place)}</span>` : "");
              el.onclick = (e) => { e.stopPropagation(); onSelectMember(m.id); };
            } else {
              // Up to three portraits (first in order: you, then your
              // connections), a "+N" pill for everyone else, and the city's
              // name beneath when they all share one place.
              const shown = d.members.slice(0, 3);
              const rest = d.members.length - shown.length;
              el.setAttribute("aria-label", `${d.members.length} musicians${d.place ? ` in ${d.place}` : " here"} — open the list`);
              el.innerHTML = `<span class="ng-group">${shown.map((m) => faceHTML(m, 26, 2)).join("")}${rest > 0 ? `<span class="ng-more">+${rest}</span>` : ""}</span>`
                + (d.place ? `<span class="ng-place">${esc(d.place)}</span>` : "");
              el.onclick = (e) => { e.stopPropagation(); onSelectGroup(d.members); };
            }
            return el;
          }}
        />
      )}
    </div>
  );
}
