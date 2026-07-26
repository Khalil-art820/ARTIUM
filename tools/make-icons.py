"""Rebuild the Artium mark: brass disc, thin white ring, white teaching figure.

3.png is an opaque white plate with a dark figure on it, so step one is to
recover a real alpha silhouette from its luminance. Everything else is drawn
from that mask, which means the same source can be tinted any colour later.
"""
from PIL import Image, ImageDraw, ImageFilter
import os

PUB = "/Users/khalil/Desktop/ARTIUM HUB/artium/public"
BRASS = (255, 198, 41, 255)
WHITE = (255, 255, 255, 255)

# --- 1. luminance -> alpha mask, trimmed to the figure's own bounds ---------
src = Image.open(os.path.join(PUB, "3.png")).convert("RGBA")
lum = src.convert("L")
# dark pixels are the figure; invert so the figure becomes opaque
alpha = lum.point(lambda v: 255 if v < 128 else 0).convert("L")
# soften the hard threshold by one pass so edges are not stair-stepped
alpha = alpha.filter(ImageFilter.GaussianBlur(0.6))
mask = Image.new("RGBA", src.size, (255, 255, 255, 0))
mask.putalpha(alpha)
mask = mask.crop(alpha.getbbox())
mask.save(os.path.join(PUB, "teacher-mark.png"))
print("teacher-mark.png", mask.size)


def build(size, ring_r=0.40, ring_w=0.018, fig_h=0.44, supersample=4):
    S = size * supersample
    img = Image.new("RGBA", (S, S), BRASS)
    d = ImageDraw.Draw(img)
    r = S * ring_r
    w = max(1, int(S * ring_w))
    c = S / 2
    d.ellipse([c - r, c - r, c + r, c + r], outline=WHITE, width=w)

    fh = int(S * fig_h)
    fw = int(mask.width * (fh / mask.height))
    fig = mask.resize((fw, fh), Image.LANCZOS)
    white = Image.new("RGBA", fig.size, WHITE)
    white.putalpha(fig.getchannel("A"))
    img.alpha_composite(white, (int(c - fw / 2), int(c - fh / 2)))

    return img.resize((size, size), Image.LANCZOS)


for name, size in [("icon-512.png", 512), ("icon-192.png", 192), ("apple-touch-icon.png", 180)]:
    build(size).save(os.path.join(PUB, name))
    print(name, size)
