# App icons: the Artium mark (black field, one white tapered wave), taken from
# the same path as src/components/ArtiumMark.jsx.
#   python3 scripts/pwa-icons.py public v7
import re, sys
from PIL import Image, ImageDraw
out, tag = sys.argv[1], sys.argv[2]
src = open("src/components/ArtiumMark.jsx").read()
d = re.search(r'ARTIUM_WAVE_D = "([^"]+)"', src).group(1)
PTS = [tuple(map(float, p.split())) for p in re.findall(r"[ML]\s*([\d.]+ [\d.]+)", d)]
BLACK = (20, 20, 20)

def icon(n, scale):
    S = 4; N = n * S
    im = Image.new("RGB", (N, N), BLACK); dr = ImageDraw.Draw(im)
    k = N / 100 * scale; off = N * (1 - scale) / 2
    dr.polygon([(off + x * k, off + y * k) for x, y in PTS], fill=(255, 255, 255))
    return im.resize((n, n), Image.LANCZOS)

for n in (1024, 512, 192):
    icon(n, 1.0).save(f"{out}/icon-{n}-{tag}.png", optimize=True)
for n in (1024, 512):
    icon(n, 0.8).save(f"{out}/icon-{n}-maskable-{tag}.png", optimize=True)   # wave inside the 80% safe zone
icon(180, 1.0).save(f"{out}/apple-touch-icon-{tag}.png", optimize=True)
icon(64, 1.0).save(f"{out}/favicon-{tag}.png", optimize=True)
print("ok")
