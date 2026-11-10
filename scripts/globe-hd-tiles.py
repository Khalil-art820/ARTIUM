# Regional HD tiles for the network globe: 15 x 15 degree squares at 2048 px
# (about 136 px per degree, 6x the 8K map), made with the same recipe as the
# 8K night map (scripts/globe-night-texture.py + scripts/globe-continents.py):
# same ocean/land/coast colours, same light glow, same gold coastlines and
# continent borders, so a tile sits on the 8K globe without a seam.
#
# Sources (not committed; the app only ships the tiles):
#   NASA Black Marble 2016, 500 m, eight 21600 px images BlackMarble_2016_{A..D}{1,2}.jpg
#     assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144898/
#   Natural Earth 10m land + lakes (naciscdn.org/naturalearth/10m/physical/)
#   Natural Earth 110m countries (node_modules/globe.gl/example/datasets/), for the
#     continent borders on land (Urals, Suez)
#
# Usage: python3 scripts/globe-hd-tiles.py <src dir> public/globe-tiles/v1 [row_col ...]
#   writes {row}_{col}-night.jpg and {row}_{col}-lights.jpg and index.json (the tile list)
#   row = floor((90 - lat_top) / 15), col = floor((lng_left + 180) / 15)
import json, math, os, struct, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
Image.MAX_IMAGE_PIXELS = None

SRC, OUT = sys.argv[1], sys.argv[2]
ONLY = set(sys.argv[3:])
os.makedirs(OUT, exist_ok=True)

DEG = 15                 # tile size in degrees
T = 2048                 # tile size in pixels
PPD = T / DEG            # pixels per degree
M = 48                   # margin in pixels, so blurs run across tile edges
WORLD_W = T * 360 // DEG # the equivalent whole-world width (49152)
K = WORLD_W / 4096       # the night recipe's blur radii were tuned at 4K

# ---- Natural Earth shapefiles (type 5 polygons), parsed once -------------
def read_rings(path):
    out = []
    with open(path, "rb") as f:
        f.read(100)
        while True:
            hdr = f.read(8)
            if len(hdr) < 8: break
            _, clen = struct.unpack(">ii", hdr)
            rec = f.read(clen * 2)
            if struct.unpack("<i", rec[:4])[0] != 5: continue
            nparts, npts = struct.unpack("<ii", rec[36:44])
            parts = list(struct.unpack(f"<{nparts}i", rec[44:44 + 4 * nparts])) + [npts]
            off = 44 + 4 * nparts
            pts = np.frombuffer(rec[off:off + 16 * npts], dtype="<f8").reshape(-1, 2)
            for a, b in zip(parts[:-1], parts[1:]):
                ring = pts[a:b]
                x, y = ring[:, 0], ring[:, 1]
                area = float(np.sum(x * np.roll(y, -1) - np.roll(x, -1) * y))
                out.append((area, ring, (x.min(), y.min(), x.max(), y.max())))
    return out

LAND = read_rings(os.path.join(SRC, "ne_10m_land.shp"))
LAKES = read_rings(os.path.join(SRC, "ne_10m_lakes.shp"))
GEO = json.load(open("node_modules/globe.gl/example/datasets/ne_110m_admin_0_countries.geojson"))
IDS = {"Europe": 1, "Asia": 2, "Africa": 3, "North America": 4, "South America": 4, "Oceania": 5}

def bbox_of(row, col, margin_deg):
    lng0 = -180 + col * DEG; lat1 = 90 - row * DEG
    return lng0 - margin_deg, lat1 - DEG - margin_deg, lng0 + DEG + margin_deg, lat1 + margin_deg

def raster_land(row, col, S=2):
    """Anti-aliased land mask (lakes cut) for the tile plus its margin."""
    md = M / PPD
    x0, y0, x1, y1 = bbox_of(row, col, md)
    N = (T + 2 * M) * S
    sc = N / (x1 - x0)
    img = Image.new("L", (N, N), 0); dr = ImageDraw.Draw(img)
    def draw(rings, outer, hole):
        for area, ring, (a, b, c, d) in rings:
            if c < x0 or a > x1 or d < y0 or b > y1: continue
            p = [((x - x0) * sc, (y1 - y) * sc) for x, y in ring]
            if len(p) >= 3: dr.polygon(p, fill=outer if area < 0 else hole)
    # outer rings clockwise (negative signed area), holes counter-clockwise
    draw([r for r in LAND if r[0] < 0], 255, 255)
    draw([r for r in LAND if r[0] > 0], 0, 0)
    draw([r for r in LAKES if r[0] < 0], 0, 0)
    return np.asarray(img.resize((T + 2 * M, T + 2 * M), Image.LANCZOS)).astype(np.float32) / 255

def raster_continents(row, col, D=8):
    """Continent label per pixel, worked out at 1/D resolution (labels only
    need to know which continent a coast belongs to; the gold lines
    themselves come from the full-resolution land mask), then scaled up."""
    md = M / PPD
    x0, y0, x1, y1 = bbox_of(row, col, md)
    full = T + 2 * M
    N = full // D; sc = N / (x1 - x0)
    lab = Image.new("L", (N, N), 0); dr = ImageDraw.Draw(lab)
    ru = Image.new("L", (N, N), 0); rdr = ImageDraw.Draw(ru)
    for f in GEO["features"]:
        cid = IDS.get(f["properties"].get("CONTINENT"))
        if not cid: continue
        g = f["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        is_ru = f["properties"].get("ISO_A3") == "RUS" or f["properties"].get("NAME") == "Russia"
        for poly in polys:
            ring = [((x - x0) * sc, (y1 - y) * sc) for x, y in poly[0]]
            if len(ring) >= 3: (rdr if is_ru else dr).polygon(ring, fill=255 if is_ru else cid)
    L = np.asarray(lab).copy()
    r = np.asarray(ru) > 0
    lng = x0 + (np.arange(N) + 0.5) / sc
    L[r & (lng[None, :] < 60)] = 1
    L[r & (lng[None, :] >= 60)] = 2
    # grow labels into the crisp coast and the water just off it (as the 8K
    # recipe does, about 1/1600 of the world's width)
    grow = max(1, round(WORLD_W / 1600 / D))
    for _ in range(6):
        if not (L == 0).any(): break
        nl = L.copy()
        for cid in range(1, 6):
            m = Image.fromarray(((L == cid) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2 * grow + 1))
            fill = (np.asarray(m) > 0) & (nl == 0); nl[fill] = cid
        L = nl
    return np.asarray(Image.fromarray(L).resize((full, full), Image.NEAREST))

# ---- NASA Black Marble 500 m: crop a region from the eight images ----------
_cache = {}
def marble(letter_row):
    if letter_row not in _cache:
        _cache.clear()
        _cache[letter_row] = Image.open(os.path.join(SRC, f"BlackMarble_2016_{letter_row}.jpg")).convert("L")
    return _cache[letter_row]

def lights_crop(row, col):
    md = M / PPD
    x0, y0, x1, y1 = bbox_of(row, col, md)
    # each source image is 90 x 90 degrees, 21600 px (240 px per degree)
    letter = "ABCD"[min(3, int((-180 + col * DEG + 180) // 90))]
    half = 1 if (90 - row * DEG) > 0 else 2
    lng_a = -180 + "ABCD".index(letter) * 90; lat_a = 90 if half == 1 else 0
    im = marble(f"{letter}{half}")
    P = 21600 / 90
    box = [(x0 - lng_a) * P, (lat_a - y1) * P, (x1 - lng_a) * P, (lat_a - y0) * P]
    # clamp to the source image; a margin past its edge repeats the edge
    cb = [max(0, box[0]), max(0, box[1]), min(21600, box[2]), min(21600, box[3])]
    crop = im.crop(tuple(round(v) for v in cb))
    full = Image.new("L", (round(box[2] - box[0]), round(box[3] - box[1])))
    full.paste(crop, (round(cb[0] - box[0]), round(cb[1] - box[1])))
    return np.asarray(full.resize((T + 2 * M, T + 2 * M), Image.LANCZOS)).astype(np.float32) / 255

# ---- the night recipe, per tile ------------------------------------------
OCEAN = np.array([4, 40, 38]) / 255
LANDC = np.array([31, 106, 85]) / 255
COAST = np.array([0x3E, 0x8A, 0x72]) / 255
GLOW = np.array([1.0, 0.82, 0.45]); CORE = np.array([1.0, 0.95, 0.78])
GOLD = np.array([226, 190, 85], np.float32) / 255
# Matched to the 8K map over France and Benelux (500 m lights are sharper and
# fainter at the edges than the 3 km source the 8K map was made from).
LIGHT_LO, LIGHT_SPAN = float(os.environ.get("LIGHT_LO", 0.13)), float(os.environ.get("LIGHT_SPAN", 0.30))

def blur(a, r):
    return np.asarray(Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))).astype(np.float32) / 255

def make_tile(row, col):
    land = raster_land(row, col)
    lum = lights_crop(row, col)
    lat = (90 - row * DEG + M / PPD) - (np.arange(T + 2 * M) + 0.5) / PPD
    lum = lum * (np.abs(lat)[:, None] < 72)
    land_s = blur(land, 0.6)
    lights = np.clip((lum - LIGHT_LO) / LIGHT_SPAN, 0, 1) ** 1.1
    # the 8K glow is 6*sqrt(2) px at 8192 wide: the same width on the ground here
    glow = blur(lights, 6 * 2 ** 0.5 * WORLD_W / 8192)
    edge = np.asarray(Image.fromarray((land_s * 255).astype(np.uint8)).filter(ImageFilter.FIND_EDGES).filter(ImageFilter.GaussianBlur(1.5))).astype(np.float32) / 255
    edge = np.clip(edge * 3, 0, 1)
    base = OCEAN * (1 - land_s[..., None]) + LANDC * land_s[..., None]
    base = base * (1 - edge[..., None] * .6) + COAST * edge[..., None] * .6
    night = np.clip(base + GLOW * (glow[..., None] * 0.75) + CORE * (lights[..., None] * 0.55), 0, 1)
    em = np.clip(GLOW * (glow[..., None] * 0.6) + CORE * lights[..., None], 0, 1)
    # gold coastlines and continent borders on land
    L = raster_continents(row, col)
    gy, gx = np.gradient(land)
    coast = np.clip(np.hypot(gx, gy) * 2.2, 0, 1) * (L > 0)
    meet = np.zeros(L.shape, bool)
    d = (L[:, 1:] != L[:, :-1]) & (L[:, 1:] > 0) & (L[:, :-1] > 0); meet[:, 1:] |= d
    d = (L[1:, :] != L[:-1, :]) & (L[1:, :] > 0) & (L[:-1, :] > 0); meet[1:, :] |= d
    meet &= land > 0.5
    alpha = np.clip(np.maximum(coast, np.clip(blur(meet.astype(np.float32), 0.7) * 2.2, 0, 1)), 0, 1)
    # a touch bolder than at 8K, so the coast keeps its weight when a tile
    # takes over from the 8K map
    alpha = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))).astype(np.float32) / 255
    alpha = blur(alpha, 0.8)
    night = night * (1 - alpha[..., None]) + GOLD * alpha[..., None]
    em = np.maximum(em, GOLD * alpha[..., None] * 0.45)
    c = (slice(M, M + T), slice(M, M + T))
    name = f"{row}_{col}"
    Image.fromarray((np.clip(night[c], 0, 1) * 255).astype(np.uint8)).save(f"{OUT}/{name}-night.jpg", quality=84, optimize=True, progressive=True)
    Image.fromarray((np.clip(em[c], 0, 1) * 255).astype(np.uint8)).save(f"{OUT}/{name}-lights.jpg", quality=80, optimize=True)
    return name

# ---- which tiles: any 15 x 15 square with land, north of 60 S ------------
def has_land(row, col):
    x0, y0, x1, y1 = bbox_of(row, col, 0)
    return any(a < x1 and c > x0 and b < y1 and d > y0 for area, _, (a, b, c, d) in LAND if area < 0)

tiles = []
for row in range(10):                     # rows 10-11 are south of 60 S
    for col in range(24):
        name = f"{row}_{col}"
        if ONLY and name not in ONLY: continue
        if not has_land(row, col): continue
        print("tile", name, flush=True)
        tiles.append(make_tile(row, col))
if not ONLY:
    json.dump({"deg": DEG, "px": T, "tiles": sorted(tiles)}, open(f"{OUT}/index.json", "w"))
print("done", len(tiles))
