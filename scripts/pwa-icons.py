# App icons: the top bar's radio button — its green disc (150deg, #41B48F ->
# #1F8B6D -> #13705A) with the five white wave bars — on a dark field.
#   python3 scripts/pwa-icons.py public v11
import sys, numpy as np
from PIL import Image, ImageDraw
out, tag = sys.argv[1], sys.argv[2]
BARS = [(3, 9), (7.5, 15), (12, 20), (16.5, 13), (21, 7)]   # WaveGlyph, 24-unit box
STOPS = [(0, (0x41, 0xB4, 0x8F)), (.55, (0x1F, 0x8B, 0x6D)), (1, (0x13, 0x70, 0x5A))]
DARK = (20, 20, 20)

def gradient(n):
    y, x = np.mgrid[0:n, 0:n] / (n - 1)
    t = (x - .5) * 0.5 + (y - .5) * 0.866
    t = (t - t.min()) / (t.max() - t.min())
    img = np.zeros((n, n, 3))
    for (a, ca), (b, cb) in zip(STOPS, STOPS[1:]):
        m = (t >= a) & (t <= b); f = ((t - a) / (b - a))[m][:, None]
        img[m] = np.array(ca) * (1 - f) + np.array(cb) * f
    return Image.fromarray(img.astype(np.uint8))

def icon(n, disc_frac):
    S = 4; N = n * S
    im = Image.new("RGB", (N, N), DARK)
    D = round(N * disc_frac); o = (N - D) // 2
    mask = Image.new("L", (D, D), 0); ImageDraw.Draw(mask).ellipse([0, 0, D - 1, D - 1], fill=255)
    im.paste(gradient(D), (o, o), mask)
    dr = ImageDraw.Draw(im)
    g = D * 0.5; u = g / 24; ox = o + (D - g) / 2; oy = o + (D - g) / 2; w = 2.4 * u
    for x, h in BARS:
        cx = ox + x * u; y0 = oy + (12 - h / 2) * u; y1 = oy + (12 + h / 2) * u
        dr.rounded_rectangle([cx - w / 2, y0 - w / 2, cx + w / 2, y1 + w / 2], radius=w / 2, fill=(255, 255, 255))
    return im.resize((n, n), Image.LANCZOS)

for n in (1024, 512, 192):
    icon(n, .78).save(f"{out}/icon-{n}-{tag}.png", optimize=True)
for n in (1024, 512):
    icon(n, .62).save(f"{out}/icon-{n}-maskable-{tag}.png", optimize=True)   # disc inside the safe zone
icon(180, .78).save(f"{out}/apple-touch-icon-{tag}.png", optimize=True)
icon(64, .9).save(f"{out}/favicon-{tag}.png", optimize=True)
print("ok")
