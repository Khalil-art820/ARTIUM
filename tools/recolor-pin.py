# Regenerates public/glo-pin-ink.png from public/glo-pin.png: the brass pin
# recolored to the entry gate's circle tone (#363B44), keeping the artwork's
# shading, alpha and whites.
#
#   python3 tools/recolor-pin.py
#
# The mask is HSV saturation, not HLS: the ring's warm near-whites read as
# fully saturated in HLS and came out dark with the body. In HSV cream is
# ~0.09 and stays put. The band from 0.10 to 0.22 is deliberately narrow —
# a wide ramp left half-recolored gold highlights behind as olive fringes.
from PIL import Image
import colorsys

src = Image.open('public/glo-pin.png').convert('RGBA')
px = src.load()
W, H = src.size

TH, TS = 218.6/360.0, 0.1148   # hue/sat of #363B44
# Its lightness over the brass body's. 0.507 is measured, not assumed: a first
# pass at 0.58 left the flat body at #2f333b, a shade under the target.
SCALE = 0.239/0.507

def smooth(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t*t*(3 - 2*t)

for j in range(H):
    for i in range(W):
        r, g, b, a = px[i, j]
        if a == 0:
            continue
        M = max(r, g, b) / 255
        m = min(r, g, b) / 255
        s_hsv = 0 if M == 0 else (M - m) / M
        h, l, s = colorsys.rgb_to_hls(r/255, g/255, b/255)
        hue_deg = h*360
        wh = smooth(0, 20, 90 - abs(hue_deg - 45)) if abs(hue_deg - 45) < 90 else 0.0
        ws = smooth(0.10, 0.22, s_hsv)
        w = wh*ws
        if w <= 0:
            continue
        nl = min(1.0, l*SCALE)
        nr, ng, nb = colorsys.hls_to_rgb(TH, nl, TS)
        px[i, j] = (round(r*(1-w) + nr*255*w),
                    round(g*(1-w) + ng*255*w),
                    round(b*(1-w) + nb*255*w), a)

src.save('public/glo-pin-ink.png', optimize=True)
print('written public/glo-pin-ink.png', src.size)
