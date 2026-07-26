"""Render public/globe3d.svg — a gold globe with a graticule and black land.

A licence-free stand-in for the Adobe Stock comp: same idea (gold sphere,
black meridians and parallels, black continents, Americas facing), but built
from Natural Earth coastlines so it can be recoloured or re-aimed at will, and
vector so it stays sharp at any size.

Two details that matter:

* Filled land uses limb-clamping for hidden points. Dropping them closes each
  ring across a straight chord, which cuts wedges out of the disc wherever a
  landmass straddles the horizon.
* Graticule lines do the opposite — they are open polylines, so hidden runs are
  split out rather than clamped, otherwise every line would gain a spurious
  segment tracing the rim.

Run: python3 tools/make-globe3d.py
"""
import json
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "tools", "data", "ne_110m_land.geojson")
OUT = os.path.join(ROOT, "public", "globe3d.svg")

R = 100.0
LAT0, LNG0 = 12.0, -85.0     # Americas facing, Africa on the right limb
GRID_STEP = 15               # degrees between meridians / parallels
LAND = "#111111"
GRID = "#111111"
GRID_W = 0.5
MIN_STEP = 0.9               # decimation floor, in SVG units

p0 = math.radians(LAT0)
l0 = math.radians(LNG0)


def project(lng, lat):
    p, l = math.radians(lat), math.radians(lng)
    cos_c = math.sin(p0) * math.sin(p) + math.cos(p0) * math.cos(p) * math.cos(l - l0)
    x = math.cos(p) * math.sin(l - l0)
    y = math.cos(p0) * math.sin(p) - math.sin(p0) * math.cos(p) * math.cos(l - l0)
    return R * x, -R * y, cos_c >= 0


def land_ring(ring):
    """Closed ring; hidden points clamped to the limb so the outline hugs it."""
    pts, visible = [], False
    for lng, lat in ring:
        x, y, vis = project(lng, lat)
        if vis:
            visible = True
        else:
            n = math.hypot(x, y) or 1.0
            x, y = x / n * R, y / n * R
        if pts:
            px, py = pts[-1]
            if (x - px) ** 2 + (y - py) ** 2 < MIN_STEP ** 2:
                continue
        pts.append((x, y))
    return pts if visible and len(pts) >= 3 else None


def line_segments(coords):
    """Open polyline; hidden runs dropped so no segment traces the rim."""
    segs, cur = [], []
    for lng, lat in coords:
        x, y, vis = project(lng, lat)
        if vis:
            cur.append((x, y))
        elif cur:
            segs.append(cur)
            cur = []
    if cur:
        segs.append(cur)
    return [s for s in segs if len(s) >= 2]


def d_closed(rings):
    return "".join("M" + " ".join(f"{x:.1f},{y:.1f}" for x, y in r) + "Z" for r in rings)


def d_open(segs):
    return "".join("M" + " ".join(f"{x:.1f},{y:.1f}" for x, y in s) for s in segs)


# --- land ------------------------------------------------------------------
data = json.load(open(SRC))
rings = []
for feat in data["features"]:
    geom = feat["geometry"]
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    for poly in polys:
        for ring in poly:
            r = land_ring(ring)
            if r:
                rings.append(r)

# --- graticule -------------------------------------------------------------
grid = []
for lng in range(-180, 180, GRID_STEP):
    # Stopped at ±80° rather than run to the poles: 24 meridians converging on
    # a single point renders as a dark smudge at this size.
    grid += line_segments([(lng, lat / 2.0) for lat in range(-160, 161)])
for lat in range(-90 + GRID_STEP, 90, GRID_STEP):
    grid += line_segments([(lng / 2.0, lat) for lng in range(-360, 361)])

svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-R - 4} {-R - 4} {2 * R + 8} {2 * R + 8}" role="img" aria-label="Globe">
  <defs>
    <radialGradient id="gold" cx="42%" cy="28%" r="78%">
      <stop offset="0%" stop-color="#FFF3C9"/>
      <stop offset="22%" stop-color="#FFD64F"/>
      <stop offset="55%" stop-color="#F0B316"/>
      <stop offset="82%" stop-color="#C4870D"/>
      <stop offset="100%" stop-color="#7E5605"/>
    </radialGradient>
  </defs>
  <circle cx="0" cy="0" r="{R}" fill="url(#gold)"/>
  <path fill="none" stroke="{GRID}" stroke-width="{GRID_W}" stroke-opacity="0.9" d="{d_open(grid)}"/>
  <path fill="{LAND}" d="{d_closed(rings)}"/>
</svg>
"""

open(OUT, "w").write(svg)
print(f"wrote {OUT}  {len(svg) / 1024:.1f} KB  ({len(rings)} land rings, {len(grid)} grid segments)")
