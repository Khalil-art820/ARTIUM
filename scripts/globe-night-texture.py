# Usage: python3 scripts/globe-night-texture.py BlackMarble_2016_3km.jpg land16k.png public 4096   (then 8192)
#   Black Marble: eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_3km.jpg
#   land16k.png:  scripts/globe-landmask.py ne_10m_land.shp land16k.png 16384  (naciscdn.org/naturalearth/10m/physical/ne_10m_land.zip)
# 4096 writes earth-*-artium-v2.jpg, 8192 writes earth-*-artium-hd.jpg.
# Artium night Earth, rebuilt from sharper sources: NASA Black Marble 2016
# (13500px lights) + Natural Earth 10m land (rasterised at 16K). Same recipe
# and colours as earth-night-artium-v1; brightness matched to that source.
import sys, numpy as np
from PIL import Image, ImageFilter
Image.MAX_IMAGE_PIXELS = None
marble, land16, out, W = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
H = W // 2
k = W / 4096  # blur radii were tuned at 4K
night = np.asarray(Image.open(marble).convert("RGB").resize((W, H), Image.LANCZOS)).astype(np.float32) / 255
lum = night[..., 0]
# Black Marble 2016 has a moonlit land surface (red ~0.15 in deserts) where
# the old source was black, so the lights threshold sits above it. Ice and
# snow can be brighter still and there are no cities beyond 72 degrees.
lat = np.linspace(90, -90, H, dtype=np.float32)[:, None]
lum = lum * (np.abs(lat) < 72)
land = np.asarray(Image.open(land16).convert("L").resize((W, H), Image.LANCZOS)).astype(np.float32) / 255
# Edge softening in fixed pixels: scaling it with the size kept the 8K
# coastlines exactly as soft as the 4K ones.
land = np.asarray(Image.fromarray((land * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))).astype(np.float32) / 255
lights = np.clip((lum - 0.24) / 0.35, 0, 1) ** 1.1
glow = np.asarray(Image.fromarray((lights * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6 * k ** 0.5))).astype(np.float32) / 255
# measured from the live v1 texture, so the switch to HD doesn't shift colour
ocean = np.array([4, 40, 38]) / 255
landc = np.array([31, 106, 85]) / 255
coast = np.array([0x3E, 0x8A, 0x72]) / 255
edge = np.asarray(Image.fromarray((land * 255).astype(np.uint8)).filter(ImageFilter.FIND_EDGES).filter(ImageFilter.GaussianBlur(1.5))).astype(np.float32) / 255
edge = np.clip(edge * 3, 0, 1)
base = ocean * (1 - land[..., None]) + landc * land[..., None]
base = base * (1 - edge[..., None] * .6) + coast * edge[..., None] * .6
gold = np.array([1.0, 0.82, 0.45]); core = np.array([1.0, 0.95, 0.78])
img = np.clip(base + gold * (glow[..., None] * 0.75) + core * (lights[..., None] * 0.55), 0, 1)
tag = "hd" if W > 4096 else "v2"
Image.fromarray((img * 255).astype(np.uint8)).save(f"{out}/earth-night-artium-{tag}.jpg", quality=84, optimize=True, progressive=True)
em = np.clip(gold * (glow[..., None] * 0.6) + core * lights[..., None], 0, 1)
# The lights glow on top of the map, so in HD they are full size too.
em_img = Image.fromarray((em * 255).astype(np.uint8))
(em_img if W > 4096 else em_img.resize((W // 2, H // 2), Image.LANCZOS)).save(f"{out}/earth-lights-artium-{tag}.jpg", quality=82, optimize=True)
print("ok", tag)
