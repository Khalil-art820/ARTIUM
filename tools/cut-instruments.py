# Cuts tools/assets/INSTRUMENTS.png into one transparent icon per instrument.
#
#   python3 tools/cut-instruments.py
#
# The sheet is the source of the drawings; this only slices it, so redrawing an
# icon means editing the sheet and running this again rather than hunting for a
# stray file.
#
# Two things the obvious version gets wrong, both found by looking at the
# output rather than the code:
#
#   Columns are found on a tight band and the icon's own extent on a wider one.
#   Detect on the wide band and neighbouring icons merge, because the captions
#   underneath bridge the gaps between them.
#
#   In the last band the section headings sit flush against the organ with no
#   blank row between, so the search starts below them — and the crop padding
#   is clamped to that start, or the heading's antialiased underside rides
#   along.
from PIL import Image
import os

SRC = "tools/assets/INSTRUMENTS.png"
OUT = "public/instruments"
LIT = 150          # sum(rgb) above this counts as ink
MAX = 128          # longest edge of a saved icon

im = Image.open(SRC).convert("RGB")
W, H = im.size
px = im.load()


def col_groups(y0, y1, gapmax):
    """Split a band into items by looking for blank columns between them."""
    prof = []
    for x in range(W):
        n = 0
        for y in range(y0, y1, 2):
            if sum(px[x, y]) > LIT:
                n += 1
        prof.append(n)
    out, start, gap = [], None, 0
    for x, n in enumerate(prof):
        if n > 0:
            if start is None:
                start = x
            gap = 0
        elif start is not None:
            gap += 1
            if gap > gapmax:
                out.append((start, x - gap))
                start, gap = None, 0
    if start is not None:
        out.append((start, W - 1))
    return [(a, b) for a, b in out if b - a > 12]


def tallest_run(x0, x1, y0, y1, gapmax=4):
    """The icon, not the caption: the tallest unbroken run of ink."""
    runs, start, gap = [], None, 0
    for y in range(y0, y1):
        ink = any(sum(px[x, y]) > LIT for x in range(x0, x1))
        if ink:
            if start is None:
                start = y
            gap = 0
        elif start is not None:
            gap += 1
            if gap > gapmax:
                runs.append((start, y - gap))
                start, gap = None, 0
    if start is not None:
        runs.append((start, y1))
    return max(runs, key=lambda r: r[1] - r[0]) if runs else (y0, y1)


# (columns detected on this band), (icon searched in this one), column gap, names
PLAN = [
    ((178, 352), (158, 368), 14, ["Violin", "Viola", "Cello", "Double Bass", "Harp",
        "Flute", "Piccolo", "Oboe", "English Horn", "Clarinet", "Bass Clarinet",
        "Bassoon", "Contrabassoon"]),
    ((450, 573), (438, 588), 14, ["French Horn", "Trumpet", "Trombone", "Tuba",
        "Euphonium", "Cornet", "Timpani", "Bass Drum", "Snare Drum", "Cymbals",
        "Triangle", "Tambourine"]),
    ((617, 708), (608, 718), 14, ["Glockenspiel", "Xylophone", "Marimba",
        "Vibraphone", "Tubular Bells", "Celesta", "Cimbalom"]),
    ((775, 909), (788, 920),  8, ["Piano", "Organ", "Harpsichord", "Conductor",
        "Music Stand", "Voice", "Guitar", "Mandolin", "Lute"]),
]

slug = lambda n: n.lower().replace(" ", "-")
os.makedirs(OUT, exist_ok=True)
made = 0

for (dy0, dy1), (sy0, sy1), gapmax, names in PLAN:
    boxes = col_groups(dy0, dy1, gapmax)
    assert len(boxes) == len(names), f"band {dy0}-{dy1}: {len(boxes)} boxes, {len(names)} names"
    for (x0, x1), name in zip(boxes, names):
        iy0, iy1 = tallest_run(x0, x1 + 1, sy0, sy1)
        crop = im.crop((max(0, x0 - 4), max(sy0, iy0 - 4),
                        min(W, x1 + 5), min(H, iy1 + 5))).convert("RGBA")
        # Alpha from brightness, so gold-on-black becomes a clean glyph that
        # sits on any background the app happens to have.
        d = crop.load()
        for yy in range(crop.height):
            for xx in range(crop.width):
                r, g, b, _ = d[xx, yy]
                lum = (r * 299 + g * 587 + b * 114) // 1000
                d[xx, yy] = (r, g, b, 0 if lum < 18 else min(255, int((lum - 18) * 1.45)))
        bb = crop.getbbox()
        if bb:
            crop = crop.crop(bb)
        crop.thumbnail((MAX, MAX), Image.LANCZOS)
        crop.save(f"{OUT}/{slug(name)}.webp", "WEBP", quality=88, method=6)
        made += 1

total = sum(os.path.getsize(f"{OUT}/{f}") for f in os.listdir(OUT))
print(f"{made} icons, {total/1024:.0f} KB total")
