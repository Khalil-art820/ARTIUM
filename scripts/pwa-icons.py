# App icons: the radio button's five white wave bars on a dark field.
#   python3 scripts/pwa-icons.py public v12
import sys
from PIL import Image, ImageDraw
out, tag = sys.argv[1], sys.argv[2]
BARS = [(3, 9), (7.5, 15), (12, 20), (16.5, 13), (21, 7)]   # WaveGlyph, 24-unit box
DARK = (20, 20, 20)

def icon(n, glyph_frac):
    S = 4; N = n * S
    im = Image.new("RGB", (N, N), DARK); dr = ImageDraw.Draw(im)
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
