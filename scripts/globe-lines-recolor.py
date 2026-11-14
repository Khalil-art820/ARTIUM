# Recolours the globe's baked-in white coastlines (and the Urals/Suez lines)
# in the finished images, without the NASA sources: the line layer is
# recomputed exactly as the makers drew it (scripts/globe-continents.py for
# the 4K/8K maps, scripts/globe-hd-tiles.py for the regional tiles), from the
# Natural Earth 10m land/lakes and the 110m countries. Each image was made as
#     out = (ground + sheen) * (1 - a) + white * a
# so the ground under the lines can be read back, ground = (out - a)/(1 - a)
# - sheen, wherever a line doesn't fully cover it; under a line's core it is
# filled in from the ground around. The image is then redrawn with only the
# coastlines, all of them now (Antarctica and lone islands had none), and no
# line where two continents meet on land (Urals, Suez), in the
# LINE colour, with the soft halo scaled to it. The emissive "lights" images
# carry the lines at 0.45 and get the same swap.
#
# Usage:
#   python3 scripts/globe-lines-recolor.py maps  <src dir> <land16k-nolakes.png> <in tag> <out tag>
#       e.g. maps globe-src land16k-nolakes.png v5 v6   (public/earth-*-artium-{,hd-}v5 -> v6)
#   python3 scripts/globe-lines-recolor.py tiles <src dir> <tiles in> <tiles out> [row_col ...]
# LINE env: the new line colour as R,G,B (default 170,170,170).
import json, os, struct, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
Image.MAX_IMAGE_PIXELS = None

LINE = np.array([float(v) for v in os.environ.get("LINE", "170,170,170").split(",")], np.float32) / 255
K = float(LINE.mean())                              # halo strength, relative to white
SHEEN = np.array([0.86, 0.97, 0.94], np.float32)
GEO = json.load(open("node_modules/globe.gl/example/datasets/ne_110m_admin_0_countries.geojson"))
IDS = {"Europe": 1, "Asia": 2, "Africa": 3, "North America": 4, "South America": 4, "Oceania": 5}

def f32(img): return np.asarray(img).astype(np.float32) / 255
def u8(a): return Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
def gblur(a, r): return f32(u8(a).filter(ImageFilter.GaussianBlur(r)))

def labels(W, H, x0, y1, sc, half=0.5):
    """Continent label per pixel (Russia split at 60E), for a raster whose
    pixel (i, j) sits at lon x0 + (i+.5)/sc, lat y1 - (j+.5)/sc."""
    lab = Image.new("L", (W, H), 0); dr = ImageDraw.Draw(lab)
    ru = Image.new("L", (W, H), 0); rdr = ImageDraw.Draw(ru)
    for f in GEO["features"]:
        cid = IDS.get(f["properties"].get("CONTINENT"))
        if not cid: continue
        g = f["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        is_ru = f["properties"].get("ISO_A3") == "RUS" or f["properties"].get("NAME") == "Russia"
        for poly in polys:
            ring = [((x - x0) * sc, (y1 - y) * sc) for x, y in poly[0]]
            if len(ring) >= 3: (rdr if is_ru else dr).polygon(ring, fill=255 if is_ru else cid)
    L = np.asarray(lab).copy(); r = np.asarray(ru) > 0
    lng = x0 + (np.arange(W) + half) / sc   # the 4K/8K maker used the pixel's left edge
    L[r & (lng[None, :] < 60)] = 1; L[r & (lng[None, :] >= 60)] = 2
    return L

def grow_labels(L, grow):
    for _ in range(6):
        if not (L == 0).any(): break
        nl = L.copy()
        for cid in range(1, 6):
            m = Image.fromarray(((L == cid) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2 * grow + 1))
            fill = (np.asarray(m) > 0) & (nl == 0); nl[fill] = cid
        L = nl
    return L

def meet_of(L, land):
    meet = np.zeros(L.shape, bool)
    d = (L[:, 1:] != L[:, :-1]) & (L[:, 1:] > 0) & (L[:, :-1] > 0); meet[:, 1:] |= d
    d = (L[1:, :] != L[:-1, :]) & (L[1:, :] > 0) & (L[:-1, :] > 0); meet[1:, :] |= d
    return meet & (land > 0.5)

def box(a, r):
    """Box blur (float, edge-clamped), along both axes."""
    for ax in (0, 1):
        pad = [(0, 0)] * a.ndim; pad[ax] = (r + 1, r)
        c = np.cumsum(np.pad(a, pad, mode="edge"), axis=ax, dtype=np.float64)
        n = a.shape[ax]
        hi = np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=ax)
        lo = np.take(c, np.arange(0, n), axis=ax)
        a = ((hi - lo) / (2 * r + 1)).astype(np.float32)
    return a

def SH(s): return SHEEN * np.clip(s * 0.55, 0, 1)[..., None]

def swap(night_path, lights_path, A, Sf, Ac, Sc, fill_r, night_out, lights_out, q_night, q_lights, lights_layers=None):
    """A/Sf: every line as drawn and its halo; Ac/Sc: the coastlines only."""
    p = f32(Image.open(night_path).convert("RGB"))
    Ak = np.minimum(A, 0.95)[..., None]
    g = np.clip((p - Ak) / (1 - Ak) - SH(Sf), 0, 1)
    # under a line's core, the ground comes from around it
    valid = (A < 0.35).astype(np.float32)
    num, den = g * valid[..., None], valid
    for _ in range(3): num, den = box(num, fill_r), box(den, fill_r)
    gi = num / np.maximum(den, 1e-4)[..., None]
    w = np.clip((A - 0.2) / 0.3, 0, 1)[..., None]
    g = g * (1 - w) + gi * w
    a = Ac[..., None]
    out = (g + K * SH(Sc)) * (1 - a) + LINE * a
    u8(out).save(night_out, quality=q_night, optimize=True, progressive=True)
    em = f32(Image.open(lights_path).convert("RGB"))
    Al, Acl = lights_layers if lights_layers else (A, Ac)
    # the line glow was max()ed in at 0.45; keep only the coast's, in the new colour
    em = np.where(em <= Al[..., None] * 0.45 + 1 / 255, np.minimum(em, LINE * Acl[..., None] * 0.45), em)
    u8(em).save(lights_out, quality=q_lights, optimize=True)

# ---- the 4K and 8K maps (scripts/globe-continents.py) --------------------
def maps(src, land16, tin, tout):
    for W in (4096, 8192):
        H = W // 2
        L = grow_labels(labels(W, H, -180, 90, W / 360, half=0), max(3, round(W / 1600)))
        land = f32(Image.open(land16).convert("L").resize((W, H), Image.LANCZOS))
        gy, gx = np.gradient(land)
        coast_all = np.clip(np.hypot(gx, gy) * 2.2, 0, 1)
        coast = coast_all * (L > 0)
        meet_a = gblur(meet_of(L, land).astype(np.float32), 0.7)
        A = gblur(np.clip(np.maximum(coast, np.clip(meet_a * 2.2, 0, 1)), 0, 1), 0.45)
        # the new coastline: every coast, Antarctica and lone islands included
        Ac = gblur(coast_all, 0.45)
        r = 2.2 * W / 4096
        hd = "hd-" if W > 4096 else ""
        n_in, l_in = f"public/earth-night-artium-{hd}{tin}.jpg", f"public/earth-lights-artium-{hd}{tin}.jpg"
        lw, lh = Image.open(l_in).size
        rs = lambda a: f32(u8(a).resize((lw, lh), Image.LANCZOS))
        swap(n_in, l_in, A, gblur(A, r), Ac, gblur(Ac, r), max(2, W // 2048),
             f"public/earth-night-artium-{hd}{tout}.jpg", f"public/earth-lights-artium-{hd}{tout}.jpg", 86, 84, (rs(A), rs(Ac)))
        print("map", W, flush=True)

# ---- the regional tiles (scripts/globe-hd-tiles.py) ----------------------
DEG, T, M = 15, 2048, 48
PPD = T / DEG; WORLD_W = T * 360 // DEG

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
                ring = pts[a:b]; x, y = ring[:, 0], ring[:, 1]
                area = float(np.sum(x * np.roll(y, -1) - np.roll(x, -1) * y))
                out.append((area, ring, (x.min(), y.min(), x.max(), y.max())))
    return out

def tile_alpha(row, col, LAND, LAKES):
    md = M / PPD
    lng0 = -180 + col * DEG; lat1 = 90 - row * DEG
    x0, y0, x1, y1 = lng0 - md, lat1 - DEG - md, lng0 + DEG + md, lat1 + md
    full = T + 2 * M
    # land mask, as raster_land (2x supersampled, lakes cut)
    N = full * 2; sc = N / (x1 - x0)
    img = Image.new("L", (N, N), 0); dr = ImageDraw.Draw(img)
    def draw(rings, fill):
        for area, ring, (a, b, c, d) in rings:
            if c < x0 or a > x1 or d < y0 or b > y1: continue
            pp = [((x - x0) * sc, (y1 - y) * sc) for x, y in ring]
            if len(pp) >= 3: dr.polygon(pp, fill=fill)
    draw([r for r in LAND if r[0] < 0], 255); draw([r for r in LAND if r[0] > 0], 0); draw([r for r in LAKES if r[0] < 0], 0)
    land = f32(img.resize((full, full), Image.LANCZOS))
    # continent labels, as raster_continents (at 1/8, grown, then scaled up)
    D = 8; n = full // D
    Lc = grow_labels(labels(n, n, x0, y1, n / (x1 - x0)), max(1, round(WORLD_W / 1600 / D)))
    L = np.asarray(Image.fromarray(Lc).resize((full, full), Image.NEAREST))
    gy, gx = np.gradient(land)
    coast_all = np.clip(np.hypot(gx, gy) * 2.2, 0, 1)
    coast = coast_all * (L > 0)
    def finish(a): return gblur(f32(u8(a).filter(ImageFilter.MaxFilter(3))), 0.8)
    A = finish(np.clip(np.maximum(coast, np.clip(gblur(meet_of(L, land).astype(np.float32), 0.7) * 2.2, 0, 1)), 0, 1))
    Ac = finish(coast_all)        # every coast, lone islands included
    r = 2.2 * 2 * WORLD_W / 8192
    c = (slice(M, M + T), slice(M, M + T))
    return A[c], gblur(A, r)[c], Ac[c], gblur(Ac, r)[c]

def tiles(src, tin, tout, only):
    os.makedirs(tout, exist_ok=True)
    LAND = read_rings(os.path.join(src, "ne_10m_land.shp")); LAKES = read_rings(os.path.join(src, "ne_10m_lakes.shp"))
    idx = json.load(open(os.path.join(tin, "index.json")))
    for t in idx["tiles"]:
        if only and t not in only: continue
        r, c = map(int, t.split("_"))
        A, Sf, Ac, Sc = tile_alpha(r, c, LAND, LAKES)
        swap(f"{tin}/{t}-night.jpg", f"{tin}/{t}-lights.jpg", A, Sf, Ac, Sc, 5, f"{tout}/{t}-night.jpg", f"{tout}/{t}-lights.jpg", 84, 80)
        print("tile", t, flush=True)
    if not only: json.dump(idx, open(os.path.join(tout, "index.json"), "w"))

if __name__ == "__main__":
    mode = sys.argv[1]
    if mode == "maps": maps(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
    else: tiles(sys.argv[2], sys.argv[3], sys.argv[4], set(sys.argv[5:]))
