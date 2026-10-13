import React from "react";
import Globe from "react-globe.gl";
import * as THREE from "three";

/**
 * The Network tab's globe: deep-teal ocean, champagne continent lines, mint
 * points at every conservatory, thin arcs between the places members study,
 * and the members themselves as portrait markers at their conservatory.
 *
 * Loaded lazily (it carries three.js), so only the Network tab pays for it.
 * Positions are the conservatories' real coordinates — nobody gets a guessed
 * home address. Markers on the far side are hidden by the globe library's
 * own visibility test, so a face never floats through the sphere.
 */

const OCEAN = "#0A4F4C";
const LAND_LINE = "rgba(199,166,106,0.62)";   // champagne
const LAND_FILL = "rgba(66,201,184,0.07)";
const MINT = "#42C9B8";
const DEFAULT_POV = { lat: 34, lng: -12, altitude: 1.62 };

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
  return `<span class="ng-face" style="width:${size}px;height:${size}px;box-shadow:0 0 0 2px #fff,0 0 0 ${ring}px rgba(66,201,184,.55),0 4px 10px rgba(0,0,0,.45)">
    <b>${initials}</b>${inner}</span>`;
}

export default function NetworkGlobe({ members, conservatories, focus, selectedId, onSelectMember, onSelectGroup, height = 330 }) {
  const wrapRef = React.useRef(null);
  const globeRef = React.useRef(null);
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  const [ready, setReady] = React.useState(false);
  const [altitude, setAltitude] = React.useState(DEFAULT_POV.altitude);
  const [countries, setCountries] = React.useState([]);
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

  React.useEffect(() => {
    let alive = true;
    fetch("/countries.geo.json").then((r) => r.json()).then((d) => { if (alive) setCountries(d.features || []); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const material = React.useMemo(() => new THREE.MeshPhongMaterial({
    color: new THREE.Color(OCEAN), emissive: new THREE.Color("#052B29"), emissiveIntensity: 0.55, shininess: 14, specular: new THREE.Color("#1E5E58"),
  }), []);
  React.useEffect(() => () => material.dispose(), [material]);

  // Camera, controls, frame budget, and pausing when off-screen.
  React.useEffect(() => {
    if (!ready || !globeRef.current) return;
    const g = globeRef.current;
    g.pointOfView(DEFAULT_POV, 0);
    try { g.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75)); } catch { /* older three */ }
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
    return () => { detach && detach(); io && io.disconnect(); clearTimeout(idleTimer.current); };
  }, [ready]);

  // Fly to whatever the page asks for (a carousel pick, a recenter).
  React.useEffect(() => {
    if (!ready || !globeRef.current || !focus) return;
    const g = globeRef.current;
    const c = g.controls(); if (c) c.autoRotate = false;
    clearTimeout(idleTimer.current);
    if (focus.reset) g.pointOfView(DEFAULT_POV, prefersReducedMotion() ? 0 : 900);
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
          showAtmosphere
          atmosphereColor={MINT}
          atmosphereAltitude={0.14}
          polygonsData={countries}
          polygonAltitude={0.003}
          polygonCapColor={() => LAND_FILL}
          polygonSideColor={() => "rgba(0,0,0,0)"}
          polygonStrokeColor={() => LAND_LINE}
          polygonsTransitionDuration={0}
          pointsData={points}
          pointLat="lat"
          pointLng="lng"
          pointAltitude={0.006}
          pointRadius={(d) => (d.on ? 0.6 : 0.34)}
          pointColor={(d) => (d.on ? "rgba(170,255,240,1)" : "rgba(90,220,200,0.8)")}
          pointsMerge
          pointsTransitionDuration={0}
          arcsData={arcs}
          arcColor={() => ["rgba(120,235,220,0.95)", "rgba(222,190,125,0.95)"]}
          arcStroke={0.55}
          arcAltitudeAutoScale={0.38}
          arcDashLength={0.5}
          arcDashGap={0.25}
          arcDashAnimateTime={reduced ? 0 : 6500}
          arcsTransitionDuration={0}
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
              const shown = d.members.slice(0, 2);
              el.setAttribute("aria-label", `${d.members.length} musicians here — open the list`);
              el.innerHTML = `<span class="ng-group">${shown.map((m) => faceHTML(m, 32, 2)).join("")}<span class="ng-more">${d.members.length}</span></span>`;
              el.onclick = (e) => { e.stopPropagation(); onSelectGroup(d.members); };
            }
            return el;
          }}
        />
      )}
    </div>
  );
}
