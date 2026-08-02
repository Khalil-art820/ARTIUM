# Regenerates public/glo-pin-ink.png from public/glo-pin.png: the brass pin
# recolored to burgundy (#7B2D3B), keeping the artwork's shading and alpha,
# with the bezel ring painted a clean warm cream (#F4EDE6). The artwork's own
# luminance carries the shadow tones, so the darker #5E202B of the palette
# falls out of the shading rather than being painted in.
#
#   python3 tools/recolor-pin.py
#
# The mask is HSV saturation, not HLS: the ring's warm near-whites read as
# fully saturated in HLS and came out dark with the body. In HSV cream is
# ~0.09 and stays put. The band from 0.10 to 0.22 is deliberately narrow —
# a wide ramp left half-recolored gold highlights behind as olive fringes.
#
# The ring pass paints the bezel annulus flat white: the painted globe's edge
# and the bezel's brush texture survived the hue mask (they are unsaturated)
# and read as dirt around the live globe. Radii are measured off the artwork —
# window centre (296.5, 295.5), white band out to ~195.5 — with soft edges so
# neither boundary shows a seam.
from PIL import Image
import colorsys, math

src = Image.open('public/glo-pin.png').convert('RGBA')
px = src.load()
W, H = src.size

# #7B2D3B -> hue 349.2deg, HLS sat 0.4643, lightness 0.3294
TH, TS = 349.2/360.0, 0.4643
# Its lightness over the brass body's. 0.507 is measured, not assumed.
SCALE = 0.3294/0.507
CX, CY = 296.5, 295.5
RING = (0xF4, 0xED, 0xE6)   # the palette's warm cream, not pure white

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
        if w > 0:
            nl = min(1.0, l*SCALE)
            nr, ng, nb = colorsys.hls_to_rgb(TH, nl, TS)
            r = r*(1-w) + nr*255*w
            g = g*(1-w) + ng*255*w
            b = b*(1-w) + nb*255*w
        d = math.hypot(i - CX, j - CY)
        wr = smooth(150, 158, d) * (1 - smooth(204, 212, d))
        if wr > 0:
            r = r*(1-wr) + RING[0]*wr
            g = g*(1-wr) + RING[1]*wr
            b = b*(1-wr) + RING[2]*wr
        px[i, j] = (round(r), round(g), round(b), a)

src.save('public/glo-pin-ink.png', optimize=True)
print('written public/glo-pin-ink.png', src.size)
