"""Rebuild the Artium mark: white ring at the outer edge, brass disc, white figure.

3.png is an opaque white plate with a dark figure on it, so step one is to
recover a real alpha silhouette from its luminance. Everything else is drawn
from that mask, which means the same source can be tinted any colour.

Ring geometry follows the Telegram convention: the white circle IS the outer
edge, with the coloured disc sitting inside it — not a hairline floating within
a coloured field. The canvas is filled with the ring colour rather than left
transparent, because icon-512 is declared "any maskable" and Android crops
maskable icons to the inner 80%; transparent corners would punch holes in it.

Flip SWAPPED to invert the two colours, then re-run. Keep it in step with
LOGO_SWAPPED in src/App.jsx, which drives the in-app mark.

Run: python3 tools/make-icons.py
"""
from PIL import Image, ImageDraw, ImageFilter
import base64
import io
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, "public")

SWAPPED = False
BRASS = (255, 198, 41, 255)
WHITE = (255, 255, 255, 255)
DISC = WHITE if SWAPPED else BRASS      # the filled circle
RING = BRASS if SWAPPED else WHITE      # outer edge, and the figure

RING_W = 0.07   # ring thickness as a fraction of the canvas
FIG_H = 0.40    # figure height as a fraction of the canvas

# --- 1. luminance -> alpha mask, trimmed to the figure's own bounds ---------
src = Image.open(os.path.join(PUB, "3.png")).convert("RGBA")
# dark pixels are the figure; threshold, then soften so edges aren't stair-stepped
alpha = src.convert("L").point(lambda v: 255 if v < 128 else 0).convert("L")
alpha = alpha.filter(ImageFilter.GaussianBlur(0.6))
mask = Image.new("RGBA", src.size, (255, 255, 255, 0))
mask.putalpha(alpha)
mask = mask.crop(alpha.getbbox())
mask.save(os.path.join(PUB, "teacher-mark.png"))
print("teacher-mark.png", mask.size)


def tinted(fig_mask, colour):
    out = Image.new("RGBA", fig_mask.size, colour)
    out.putalpha(fig_mask.getchannel("A"))
    return out


def place_figure(img, S, colour, fig_h=FIG_H):
    fh = int(S * fig_h)
    fw = int(mask.width * (fh / mask.height))
    fig = tinted(mask.resize((fw, fh), Image.LANCZOS), colour)
    img.alpha_composite(fig, (int((S - fw) / 2), int((S - fh) / 2)))


def build(size, square_bg=None, supersample=4):
    """Ringed circle. Corners are transparent unless square_bg is given —
    iOS renders a transparent apple-touch-icon on black, so that one gets a
    filled background instead."""
    S = size * supersample
    img = Image.new("RGBA", (S, S), square_bg or (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([0, 0, S - 1, S - 1], fill=RING)          # ring is the outer edge
    inset = S * RING_W
    d.ellipse([inset, inset, S - inset, S - inset], fill=DISC)
    place_figure(img, S, RING)
    return img.resize((size, size), Image.LANCZOS)


def build_maskable(size, supersample=4):
    """Full-bleed, ring drawn INSIDE the safe zone.

    A ring at the canvas edge gets cropped away here, which is why the first
    attempt at this file came out as a plain brass circle on the home screen.
    Instead the whole canvas is the ring colour and the disc is pulled in to
    r=0.38, inside the inner-80% safe zone. Platforms crop maskable icons
    somewhere between r=0.40 and r=0.50, so whatever shape is applied, white
    survives between the disc and the cut — a thin ring in the worst case, a
    thick one on the circular masks most launchers actually use.
    """
    S = size * supersample
    img = Image.new("RGBA", (S, S), RING)
    r = S * 0.38
    c = S / 2
    ImageDraw.Draw(img).ellipse([c - r, c - r, c + r, c + r], fill=DISC)
    place_figure(img, S, RING, fig_h=0.34)
    return img.resize((size, size), Image.LANCZOS)


for name, size in [("icon-512.png", 512), ("icon-192.png", 192)]:
    build(size).save(os.path.join(PUB, name))
    print(name, size)

build(180, square_bg=RING).save(os.path.join(PUB, "apple-touch-icon.png"))
print("apple-touch-icon.png 180")

build_maskable(512).save(os.path.join(PUB, "icon-512-maskable.png"))
print("icon-512-maskable.png 512")

# --- 2. icon.svg, with the figure embedded as a data URI -------------------
h = 300
w = int(mask.width * h / mask.height)
buf = io.BytesIO()
tinted(mask.resize((w, h), Image.LANCZOS), RING).save(buf, format="PNG", optimize=True)
b64 = base64.b64encode(buf.getvalue()).decode()
disc_hex = "#FFFFFF" if SWAPPED else "#FFC629"
ring_hex = "#FFC629" if SWAPPED else "#FFFFFF"
svg = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">\n'
    f'  <circle cx="256" cy="256" r="256" fill="{ring_hex}"/>\n'
    f'  <circle cx="256" cy="256" r="{256 - 512 * RING_W:.0f}" fill="{disc_hex}"/>\n'
    f'  <image x="{(512 - w) / 2:.1f}" y="{(512 - h) / 2:.1f}" width="{w}" height="{h}" '
    f'href="data:image/png;base64,{b64}"/>\n'
    "</svg>\n"
)
open(os.path.join(PUB, "icon.svg"), "w").write(svg)
print("icon.svg bytes:", len(svg))
