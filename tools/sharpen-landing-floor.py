# Rebuilds public/landing-hall.webp with the reference's floor.
#
#   python3 tools/sharpen-landing-floor.py
#
# The landing photograph is the reference mockup's own plate — matching it
# row-for-row against the mockup scores best at a vertical offset of 130, so
# photo row y is mockup row y+130. But the export the photograph arrived as
# lost the floor: the gold world-map on the ground measures 4.0 mean absolute
# Laplacian in the mockup and 1.5 in the photo — softened to a blur.
#
# Sharpening cannot recover what compression removed, and the crisp pixels
# already exist in the mockup. So the floor band is composited back from
# tools/data/landing-mock-floor.png (the mockup's rows 600-950, kept in-repo),
# with three regions excluded because the mockup has artwork baked over its
# floor there, feathered so no seam shows:
#
#   - the pin and its halo: an ellipse at (410, 415), rx 200 ry 270 in photo
#     coordinates. The app renders its own pin over this area.
#   - the base glow under the pin's tip: swallowed by the ellipse's lower arc.
#   - the caption "Tap the pin...": rows 725-790, x 195-685.
#
# Inside the exclusions the photo's own floor is unsharp-masked instead, so
# the covered middle does not sit visibly softer beside true detail.
from PIL import Image, ImageFilter
import math

MOCK_OFFSET = 130          # photo y -> mockup y + this
FLOOR_CROP_TOP = 600       # where tools/data/landing-mock-floor.png begins, mock coords
BAND_START, BAND_FULL = 470, 515   # photo rows where the composite ramps in

def smooth(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t*t*(3 - 2*t)

photo = Image.open('public/landing-hall.webp').convert('RGB')
floor = Image.open('tools/data/landing-mock-floor.png').convert('RGB')
W, H = photo.size
sharp = photo.filter(ImageFilter.UnsharpMask(radius=3, percent=140, threshold=2))

pp, fp, sp = photo.load(), floor.load(), sharp.load()
out = photo.copy(); op = out.load()

CX, CY, RX, RY = 410, 415, 200, 270
for y in range(BAND_START, H):
    band = smooth(BAND_START, BAND_FULL, y)
    my = y + MOCK_OFFSET - FLOOR_CROP_TOP
    for x in range(W):
        r = math.hypot((x - CX)/RX, (y - CY)/RY)
        keep_mock = smooth(1.0, 1.22, r)
        # caption zone: the mockup has its own caption text printed here
        cap = smooth(707, 725, y) * (1 - smooth(790, 808, y)) \
            * smooth(177, 195, x) * (1 - smooth(685, 703, x))
        keep_mock *= (1 - cap)
        a = band * keep_mock
        if 0 <= my < floor.size[1]:
            src = fp[x, my]
        else:
            src = sp[x, y]; a = band  # off the crop: just sharpened self
        inside = sp[x, y]
        p = pp[x, y]
        # untouched above the band; inside it, mockup detail where allowed and
        # the sharpened self elsewhere, in one weighted sum
        op[x, y] = tuple(round(p[i]*(1-band) + src[i]*a + inside[i]*(band - a)) for i in range(3))

out.save('public/landing-hall.webp', quality=93, method=6)
print('written public/landing-hall.webp', out.size)
