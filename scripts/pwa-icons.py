# App icons drawn like the top bar's radio button: its green gradient
# (150deg, #41B48F -> #1F8B6D -> #13705A) with the five white wave bars.
#   python3 scripts/pwa-icons.py public v6
import sys, numpy as np
from PIL import Image, ImageDraw
out, tag = sys.argv[1], sys.argv[2]
BARS = [(3, 9), (7.5, 15), (12, 20), (16.5, 13), (21, 7)]   # WaveGlyph, 24-unit box
STOPS = [(0, (0x41, 0xB4, 0x8F)), (.55, (0x1F, 0x8B, 0x6D)), (1, (0x13, 0x70, 0x5A))]

def bg(n):
    y, x = np.mgrid[0:n, 0:n] / (n - 1)
    d = np.array([0.5, 0.866])          # CSS 150deg
    t = (x - .5) * d[0] + (y - .5) * d[1]
    t = (t - t.min()) / (t.max() - t.min())
    img = np.zeros((n, n, 3))
    for (a, ca), (b, cb) in zip(STOPS, STOPS[1:]):
        m = (t >= a) & (t <= b); f = ((t - a) / (b - a))[m][:, None]
        img[m] = np.array(ca) * (1 - f) + np.array(cb) * f
    return Image.fromarray(img.astype(np.uint8))

def icon(n, glyph_frac):
    S = 4; N = n * S
    im = bg(N); dr = ImageDraw.Draw(im)
    g = N * glyph_frac; u = g / 24; ox = (N - g) / 2; oy = (N - g) / 2
    w = 2.4 * u
    for x, h in BARS:
        cx = ox + x * u; y0 = oy + (12 - h / 2) * u; y1 = oy + (12 + h / 2) * u
        dr.rounded_rectangle([cx - w / 2, y0 - w / 2, cx + w / 2, y1 + w / 2], radius=w / 2, fill=(255, 255, 255))
    return im.resize((n, n), Image.LANCZOS)

for n in (1024, 512, 192):
    icon(n, .56).save(f"{out}/icon-{n}-{tag}.png", optimize=True)
for n in (1024, 512):
    icon(n, .44).save(f"{out}/icon-{n}-maskable-{tag}.png", optimize=True)   # inside the 80% safe zone
icon(180, .56).save(f"{out}/apple-touch-icon-{tag}.png", optimize=True)
print("ok")
