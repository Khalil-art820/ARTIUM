"""
Turn Natural Earth's admin-0 countries into something a globe can carry.

Source: ne_110m_admin_0_countries.geojson from nvkelso/natural-earth-vector
(public domain). Downloaded to tools/data/ by hand; not committed, because the
only thing the app needs is the output of this script.

The raw file is 819KB of which almost none is geometry: every feature carries
ninety-odd properties — sovereignty codes, Wikidata ids, a name in each of a
dozen languages. This keeps the name, the geometry, and two numbers the globe
uses to decide what to draw at which altitude.

Coordinates are rounded to two decimals. At 110m scale that is well inside the
source's own precision, and it roughly halves the file.
"""

import json, os

SRC = "tools/data/ne_110m_admin_0_countries.geojson"
OUT = "public/countries.geo.json"

# Ring area by the shoelace formula, in square degrees. Not a real area — it
# ignores that meridians converge — but it only ever ranks countries against
# each other for label priority, and for that it is fine.
def ring_area(ring):
    a = 0.0
    for i in range(len(ring) - 1):
        x1, y1 = ring[i][0], ring[i][1]
        x2, y2 = ring[i + 1][0], ring[i + 1][1]
        a += x1 * y2 - x2 * y1
    return abs(a) / 2.0


def rings_of(geom):
    if geom["type"] == "Polygon":
        return [geom["coordinates"][0]]
    return [poly[0] for poly in geom["coordinates"]]


# The label goes on the biggest landmass, not at the average of all of them:
# France's centroid including French Guiana lands in the Atlantic, and the
# United States' including Alaska and Hawaii lands in the Pacific.
def label_anchor(geom):
    biggest, best = None, -1.0
    for ring in rings_of(geom):
        a = ring_area(ring)
        if a > best:
            best, biggest = a, ring
    xs = [p[0] for p in biggest]
    ys = [p[1] for p in biggest]
    return (sum(xs) / len(xs), sum(ys) / len(ys), best)


def round_geom(geom, nd=2):
    def r(c):
        if isinstance(c[0], (int, float)):
            return [round(c[0], nd), round(c[1], nd)]
        return [r(x) for x in c]
    return {"type": geom["type"], "coordinates": r(geom["coordinates"])}


src = json.load(open(SRC))
feats = []
for f in src["features"]:
    p = f["properties"]
    name = p.get("NAME") or p.get("NAME_LONG") or p.get("ADMIN")
    if not name or not f.get("geometry"):
        continue
    lng, lat, area = label_anchor(f["geometry"])
    feats.append({
        "type": "Feature",
        "properties": {
            "name": name,
            "lat": round(lat, 2),
            "lng": round(lng, 2),
            # Rank 0 is the largest country. The globe shows the first N by
            # rank at a given altitude, so labels arrive biggest-first rather
            # than in whatever order the file happens to be in.
            "rank": 0,
            "area": round(area, 1),
        },
        "geometry": round_geom(f["geometry"]),
    })

feats.sort(key=lambda f: -f["properties"]["area"])
for i, f in enumerate(feats):
    f["properties"]["rank"] = i
    del f["properties"]["area"]

os.makedirs("public", exist_ok=True)
out = {"type": "FeatureCollection", "features": feats}
with open(OUT, "w") as fh:
    json.dump(out, fh, separators=(",", ":"))

print(f"{len(feats)} countries -> {OUT}  {os.path.getsize(OUT)/1024:.0f} KB "
      f"(from {os.path.getsize(SRC)/1024:.0f} KB)")
print("largest:", ", ".join(f["properties"]["name"] for f in feats[:6]))
