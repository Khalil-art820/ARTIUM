import React from "react";
import Globe from "react-globe.gl";
import * as THREE from "three";

/**
 * The Network tab's globe: a night Earth in the app's teal — deep ocean,
 * green land with lit coastlines, and gold city lights that glow on the shaded
 * side too (NASA Black Marble 2016 lights over Natural Earth 10m coastlines and lakes,
 * recoloured into public/earth-*-artium-v3.jpg, and an 8K "-hd-v3" pair that
 * loads once someone zooms in — see scripts/globe-night-texture.py). Then: mint
 * points at every conservatory, thin arcs between the places members study,
 * and the members themselves as portrait markers at their conservatory.
 *
 * Loaded lazily (it carries three.js), so only the Network tab pays for it.
 * Positions are the conservatories' real coordinates — nobody gets a guessed
 * home address. Markers on the far side are hidden by the globe library's
 * own visibility test, so a face never floats through the sphere.
 */

const EARTH_URL = "/earth-night-artium-v3.jpg";
const LIGHTS_URL = "/earth-lights-artium-v3.jpg";
const EARTH_HD_URL = "/earth-night-artium-hd-v3.jpg";     // 8192 x 4096
const LIGHTS_HD_URL = "/earth-lights-artium-hd-v3.jpg";   // 8192 x 4096
const MINT = "#42C9B8";
const DEFAULT_POV = { lat: 34, lng: -12, altitude: 1.36 };
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
function groupMarkers(members, altitude, selectedId) {
  const cell = Math.min(16, Math.max(0.3, altitude * 4.5));
  const groups = Object.create(null);
  const out = [];
  for (const m of members) {
    // The selected member always stands on their own, highlighted.
    if (m.id === selectedId) { out.push({ kind: "member", id: m.id, lat: m.lat, lng: m.lng, member: m, selected: true }); continue; }
    const cosLat = Math.max(0.15, Math.cos((m.lat * Math.PI) / 180));
    const key = `${Math.floor(m.lat / cell)}:${Math.floor(m.lng / Math.min(60, cell / cosLat))}`;
    (groups[key] = groups[key] || []).push(m);
  }
  return out.concat(Object.values(groups).map((list) => {
    const n = list.length;
    const lat = list.reduce((a, m) => a + m.lat, 0) / n;
    const lng = list.reduce((a, m) => a + m.lng, 0) / n;
    if (n === 1) return { kind: "member", id: list[0].id, lat, lng, member: list[0], selected: list[0].id === selectedId };
    return { kind: "group", id: `g:${list.map((m) => m.id).sort().join(",")}`, lat, lng, members: list, selected: false };
  }));
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

export default function NetworkGlobe({ members, conservatories, focus, selectedId, onSelectMember, onSelectGroup, height = 330 }) {
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

  // Zoomed in, draw at the screen's full pixel density (up to 3x) so the map
  // and coastlines stay crisp; zoomed out, a lighter 1.75x keeps it smooth.
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

  const markers = React.useMemo(() => groupMarkers(members, altitude, selectedId), [members, altitude, selectedId]);

  // Mint points at every conservatory (real places), brighter where members are.
  const memberCons = React.useMemo(() => new Set(members.map((m) => m.conservatoryId)), [members]);
  const points = React.useMemo(() => conservatories
    .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng))
    .map((c) => ({ lat: c.lat, lng: c.lng, on: memberCons.has(c.id) })), [conservatories, memberCons]);

  // Arcs: from where members are to the network's other member places; when
  // there's only one, to the five nearest conservatories — real places, a
  // quiet picture of reach rather than invented traffic.
  const arcs = React.useMemo(() => {
    const places = [];
    const seen = new Set();
    for (const m of members) { const k = `${m.lat},${m.lng}`; if (!seen.has(k)) { seen.add(k); places.push(m); } }
    const out = [];
    if (places.length >= 2) {
      for (let i = 0; i < places.length && out.length < 14; i++) {
        const a = places[i], b = places[(i + 1) % places.length];
        if (a !== b) out.push({ a, b });
      }
    } else if (places.length === 1) {
      const a = places[0];
      const d = (c) => (c.lat - a.lat) ** 2 + ((c.lng - a.lng) * Math.cos(a.lat * Math.PI / 180)) ** 2;
      conservatories.filter((c) => Number.isFinite(c.lat) && Math.abs(c.lat - a.lat) + Math.abs(c.lng - a.lng) > 3)
        .sort((x, y) => d(x) - d(y)).slice(0, 5).forEach((b) => out.push({ a, b }));
    }
    return out.map(({ a, b }) => ({ startLat: a.lat, startLng: a.lng, endLat: b.lat, endLng: b.lng }));
  }, [members, conservatories]);

  const reduced = prefersReducedMotion();

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
          arcStroke={(d) => (d.dots ? 0.9 : 0.45)}
          arcAltitudeAutoScale={0.38}
          arcDashLength={(d) => (d.dots ? 0.009 : 1)}
          arcDashGap={(d) => (d.dots ? 0.13 : 0)}
          arcDashInitialGap={(d) => (d.dots ? d.initialGap : 0)}
          arcDashAnimateTime={(d) => (d.dots && !reduced ? 5200 : 0)}
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
            el.style.opacity = visible ? "1" : "0";
            el.style.pointerEvents = visible ? "auto" : "none";
          }}
          htmlElement={(d) => {
            const el = document.createElement("button");
            el.type = "button";
            el.className = `ng-marker${d.selected ? " is-on" : ""}`;
            if (d.kind === "member") {
              const m = d.member;
              el.setAttribute("aria-label", `${m.name}${m.instrumentLabel ? `, ${m.instrumentLabel}` : ""}`);
              el.innerHTML = faceHTML(m, d.selected ? 46 : 36, d.selected ? 5 : 3);
              el.onclick = (e) => { e.stopPropagation(); onSelectMember(m.id); };
            } else {
              // As the top-bar counter: one portrait (the first in order — the
              // earliest connection) and a "+N" pill for everyone else here.
              el.setAttribute("aria-label", `${d.members.length} musicians here — open the list`);
              el.innerHTML = `<span class="ng-group">${faceHTML(d.members[0], 34, 2)}<span class="ng-more">+${d.members.length - 1}</span></span>`;
              el.onclick = (e) => { e.stopPropagation(); onSelectGroup(d.members); };
            }
            return el;
          }}
        />
      )}
    </div>
  );
}
