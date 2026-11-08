# App icons: the radio button exactly — its five white wave bars on its
# glossy old-rose fill (linear-gradient 165deg #D58A97 0%, #B45E6D 42%,
# #A8505F 60%, #8A3B49 100%).
#   python3 scripts/pwa-icons.py public v13
import sys
from PIL import Image, ImageDraw, ImageFilter
out, tag = sys.argv[1], sys.argv[2]
BARS = [(3, 9), (7.5, 15), (12, 20), (16.5, 13), (21, 7)]   # WaveGlyph, 24-unit box
STOPS = [(0.0, (0xD5, 0x8A, 0x97)), (0.42, (0xB4, 0x5E, 0x6D)), (0.60, (0xA8, 0x50, 0x5F)), (1.0, (0x8A, 0x3B, 0x49))]

def lerp(a, b, t): return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))
def ramp(t):
    for (t0, c0), (t1, c1) in zip(STOPS, STOPS[1:]):
        if t <= t1: return lerp(c0, c1, (t - t0) / (t1 - t0))
    return STOPS[-1][1]

def glossy(N):
    im = Image.new("RGB", (N, N)); px = im.load()
    for y in range(N):
        for x in range(N):
            t = min(1, max(0, ((x - N / 2) * 0.2588 + (y - N / 2) * 0.9659) / (N * 1.2247) + 0.5))   # CSS 165deg
            px[x, y] = ramp(t)
    return im

def icon(n, glyph_frac):
    S = 2; N = n * S
    im = glossy(N); dr = ImageDraw.Draw(im)
    g = N * glyph_frac; u = g / 24; ox = (N - g) / 2; oy = (N - g) / 2; w = 2.4 * u
    for x, h in BARS:
        cx = ox + x * u; y0 = oy + (12 - h / 2) * u; y1 = oy + (12 + h / 2) * u
        dr.rounded_rectangle([cx - w / 2, y0 - w / 2, cx + w / 2, y1 + w / 2], radius=w / 2, fill=(255, 255, 255))
    return im.resize((n, n), Image.LANCZOS)

for n in (1024, 512, 192):
    icon(n, .56).save(f"{out}/icon-{n}-{tag}.png", optimize=True)
for n in (1024, 512):
    icon(n, .44).save(f"{out}/icon-{n}-maskable-{tag}.png", optimize=True)   # inside the safe zone
icon(180, .56).save(f"{out}/apple-touch-icon-{tag}.png", optimize=True)
icon(64, .7).save(f"{out}/favicon-{tag}.png", optimize=True)
print("ok")
