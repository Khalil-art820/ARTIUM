# Continent borders baked into the night globe: gold (v3 -> v4) or, with
# LINE=white SRC_DIR=<dir of the v3 maps>, glossy white (v3 -> v5).
#
# Usage:
#   python3 scripts/globe-continents.py land16k-nolakes.png public 4096   (then 8192)
#     land16k-nolakes.png: scripts/globe-landmask.py ne_10m_land.shp ... 16384 (no lakes cut —
#     the gold follows sea coasts only, not lake shores)
#     reads public/earth-{night,lights}-artium-{v3|hd-v3}.jpg, writes ...-{v4|hd-v4}.jpg
#
# Five continents: Europe, Asia, Africa, America (North + South), Oceania.
# Coastlines come from the crisp 10m land mask, so the gold sits on the coast;
# where two continents meet on land (Urals, Suez) the line comes from the
# Natural Earth 110m countries (CONTINENT field), with Russia split at 60°E so
# the Europe/Asia line runs down the Urals instead of along Russia's border.
# Antarctica gets no line.
import json, sys, numpy as np
from PIL import Image, ImageDraw, ImageFilter
Image.MAX_IMAGE_PIXELS = None

land16, out, W = sys.argv[1], sys.argv[2], int(sys.argv[3])
H = W // 2
GEO = "node_modules/globe.gl/example/datasets/ne_110m_admin_0_countries.geojson"
IDS = {"Europe": 1, "Asia": 2, "Africa": 3, "North America": 4, "South America": 4, "Oceania": 5}

def px(lon, lat): return ((lon + 180) / 360 * W, (90 - lat) / 180 * H)

# 1. Continent labels from the 110m countries.
lab = Image.new("L", (W, H), 0)
dr = ImageDraw.Draw(lab)
russia = Image.new("L", (W, H), 0)
rdr = ImageDraw.Draw(russia)
for f in json.load(open(GEO))["features"]:
    cid = IDS.get(f["properties"].get("CONTINENT"))
    if not cid: continue
    g = f["geometry"]
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    is_ru = f["properties"].get("ISO_A3") == "RUS" or f["properties"].get("NAME") == "Russia"
    for poly in polys:
        ring = [px(x, y) for x, y in poly[0]]
        if len(ring) < 3: continue
        (rdr if is_ru else dr).polygon(ring, fill=255 if is_ru else cid)
L = np.asarray(lab).copy()
ru = np.asarray(russia) > 0
xs = np.arange(W)[None, :] / W * 360 - 180
L[ru & (xs < 60)] = 1   # European Russia
L[ru & (xs >= 60)] = 2  # Asian Russia

# 2. Grow labels a little so every crisp-coast land pixel (and the water just
#    off it) knows its continent. Only empty pixels are filled.
grow = max(3, round(W / 1600))
for _ in range(6):
    if not (L == 0).any(): break
    out_l = L.copy()
    for cid in range(1, 6):
        m = Image.fromarray(((L == cid) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2 * grow + 1))
        fill = (np.asarray(m) > 0) & (out_l == 0)
        out_l[fill] = cid
    L = out_l

# 3. Gold alpha: the coastline (gradient of the anti-aliased 10m land mask)
#    plus the lines where two continents meet on land.
land = np.asarray(Image.open(land16).convert("L").resize((W, H), Image.LANCZOS)).astype(np.float32) / 255
gy, gx = np.gradient(land)
coast = np.clip(np.hypot(gx, gy) * 2.2, 0, 1) * (L > 0)
meet = np.zeros((H, W), bool)
for a, b in ((L[:, 1:], L[:, :-1]), (L[1:, :], L[:-1, :])):
    d = (a != b) & (a > 0) & (b > 0)
    if a.shape[1] != W: meet[:, 1:] |= d
    else: meet[1:, :] |= d
meet &= land > 0.5
meet_a = np.asarray(Image.fromarray((meet * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))).astype(np.float32) / 255
alpha = np.clip(np.maximum(coast, np.clip(meet_a * 2.2, 0, 1)), 0, 1)
alpha = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.45))).astype(np.float32) / 255

import os
# LINE=white (v5): glossy white lines, a crisp white core with a soft white
# sheen around it. Default: the original gold (v4).
WHITE = os.environ.get("LINE") == "white"
GOLD = np.array([255, 255, 255] if WHITE else [226, 190, 85], np.float32) / 255
v = "v5" if WHITE else "v4"
tag_in, tag_out = ("hd-v3", f"hd-{v}") if W > 4096 else ("v3", v)
src = os.environ.get("SRC_DIR", out)
base = np.asarray(Image.open(f"{src}/earth-night-artium-{tag_in}.jpg").convert("RGB")).astype(np.float32) / 255
if WHITE:
    sheen = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.2 * W / 4096))).astype(np.float32) / 255
    base = base + np.array([0.86, 0.97, 0.94], np.float32) * np.clip(sheen * 0.55, 0, 1)[..., None]
img = base * (1 - alpha[..., None]) + GOLD * alpha[..., None]
Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).save(f"{out}/earth-night-artium-{tag_out}.jpg", quality=86, optimize=True, progressive=True)
# The lines glow faintly on the night side too.
lw, lh = Image.open(f"{src}/earth-lights-artium-{tag_in}.jpg").size
a2 = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8)).resize((lw, lh), Image.LANCZOS)).astype(np.float32) / 255
lights = np.asarray(Image.open(f"{src}/earth-lights-artium-{tag_in}.jpg").convert("RGB")).astype(np.float32) / 255
lights = np.maximum(lights, GOLD * a2[..., None] * 0.45)
Image.fromarray((np.clip(lights, 0, 1) * 255).astype(np.uint8)).save(f"{out}/earth-lights-artium-{tag_out}.jpg", quality=84, optimize=True)
print("ok", tag_out)
