# Levels the regional HD tiles to the 8K map: the 500 m NASA source shows
# desert sand faintly lit at night, and the tiles' lower light threshold turned
# that into a broad, textured brightening the 8K map doesn't have (a lighter
# square over the Sahara when zooming in). This takes out only that broad
# background difference, measured as each image's local floor (a low
# percentile over ~1/3 degree, smoothed), so city lights, coastlines and
# detail are untouched and the tile meets the 8K map without a step.
#
# Usage: python3 scripts/globe-tiles-level.py public/globe-tiles/v2 public/globe-tiles/v3 [row_col ...]
import json, os, sys
import numpy as np
from PIL import Image, ImageFilter
Image.MAX_IMAGE_PIXELS = None

SRC, OUT = sys.argv[1], sys.argv[2]
ONLY = set(sys.argv[3:])
os.makedirs(OUT, exist_ok=True)
DEG, T, S = 15, 2048, 256            # tile degrees, tile px, working size for the floor

BASE = {k: np.asarray(Image.open(f"public/earth-{k}-artium-hd-v5.jpg").convert("RGB")) for k in ("night", "lights")}

def floor(img):
    """Local floor of an RGB image at S x S: min over ~1/3 degree, smoothed."""
    small = img.resize((S, S), Image.BOX)
    m = small.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(6))
    return np.asarray(m).astype(np.float32)

def base_crop(kind, row, col):
    b = BASE[kind]; H, W = b.shape[:2]
    x0 = (col * DEG) / 360 * W; y0 = (row * DEG) / 180 * H; s = DEG / 360 * W
    return Image.fromarray(b).crop((round(x0), round(y0), round(x0 + s), round(y0 + s)))

# The 8K map's plain land, and black for the lights map: where the 8K map
# sits at this level the ground there is unlit, so any brightening a tile
# adds is sand, not towns.
PLAIN = {"night": np.array([31, 106, 85], np.float32), "lights": np.zeros(3, np.float32)}
GATE = 12.0                           # faint texture under this many levels is flattened

def upsize(a):
    return np.asarray(Image.fromarray(np.clip(a * 4, 0, 255).astype(np.uint8)).resize((T, T), Image.BICUBIC)).astype(np.float32) / 4

def level(kind, row, col):
    name = f"{row}_{col}-{kind}.jpg"
    tile = Image.open(os.path.join(SRC, name)).convert("RGB")
    bf = floor(base_crop(kind, row, col))
    # 1 where the 8K map is barely lit around here (desert, empty land, sea;
    # a lone oasis hardly counts), 0 where towns are dense: villages lift a
    # tile's ground too (Germany), and those must stay.
    lit = base_crop("lights", row, col).convert("L").resize((S, S), Image.BOX)
    dense = np.asarray(lit.filter(ImageFilter.GaussianBlur(10))).astype(np.float32)
    unlit = 1 - np.clip((dense - 3) / 8, 0, 1)
    raw = np.clip(floor(tile) - bf, 0, None)
    # and only where the tile's ground is clearly lifted (sand), not the few
    # levels a lit countryside like Europe's differs by
    sand = np.clip((raw.mean(-1) - 2.5) / 3, 0, 1)
    unlit = unlit * sand
    diff = raw * unlit[..., None]
    t = np.asarray(tile).astype(np.float32) - upsize(diff)
    # in that unlit ground, flatten the faint sand texture left over (bright
    # lights and lines are far above the gate and stay as they are)
    d = (t - PLAIN[kind]).mean(-1)
    w = np.clip(np.abs(d) / GATE, 0, 1) ** 2
    w = 1 - (1 - w) * upsize(np.repeat(unlit[..., None], 3, -1))[..., 0]
    t = PLAIN[kind] + (t - PLAIN[kind]) * w[..., None]
    out = np.clip(t, 0, 255).astype(np.uint8)
    q = 84 if kind == "night" else 80
    Image.fromarray(out).save(os.path.join(OUT, name), quality=q, optimize=True, progressive=(kind == "night"))
    return float(diff.mean())

idx = json.load(open(os.path.join(SRC, "index.json")))
for t in idx["tiles"]:
    if ONLY and t not in ONLY: continue
    r, c = map(int, t.split("_"))
    print(t, round(level("night", r, c), 2), round(level("lights", r, c), 2), flush=True)
if not ONLY:
    json.dump(idx, open(os.path.join(OUT, "index.json"), "w"))
