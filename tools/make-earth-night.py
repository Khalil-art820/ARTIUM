# Builds public/earth-artium.jpg — the globe texture for Artium's World.
#
#   python3 tools/make-earth-night.py
#
# Two NASA sources, composited rather than picked between:
#
#   Blue Marble   public/earth-blue-marble.jpg   land, ice and ocean
#   Black Marble  tools/data/earth-night.jpg     city lights
#
# The brief asks for the night side lit by cities AND realistic oceans, which
# neither texture gives alone. Black Marble on its own is a black ball with
# gold freckles — no coastline until a city happens to trace one. Blue Marble
# on its own is the daylight globe the brief explicitly rules out.
#
# So: the day texture is dimmed hard and cooled, which leaves continents and
# oceans legible as shape without reading as daylight, and the lights are
# screened over it — screen, not add, because add clips the bright cores to
# white and the cities lose their colour. The lights are then pushed toward
# the brand's champagne so the globe belongs to the rest of the product; NASA
# renders them a sodium yellow-green that sits oddly beside the gold.
#
# 2048x1024 is deliberate. The sources are 4096x2048 and the globe is never
# drawn wider than ~380px on a phone, so the larger texture costs a megabyte
# of download to resolve detail no one can see.
from PIL import Image
import os

W, H = 2048, 1024
DAY = "public/earth-blue-marble.jpg"
NIGHT = "tools/data/earth-night.jpg"
OUT = "public/earth-artium.jpg"

# How much of the daylight texture survives. Low enough that it reads as a
# night side, high enough that Africa is still Africa.
DAY_LEVEL = 0.30
# A whisper of cool on the land. Heavier than this and the Sahara's tan turns
# teal, because the desert is the one place where the day texture's red and
# green are both high and its blue is not.
DAY_COOL = (0.96, 0.98, 1.05)
# The champagne the rest of the product uses.
LIGHT_TINT = (1.00, 0.84, 0.58)
LIGHT_GAIN = 2.3
# Below this the "lights" are the texture's own land wash, not lit ground.
LIGHT_FLOOR = 22

day = Image.open(DAY).convert("RGB").resize((W, H), Image.LANCZOS)
night = Image.open(NIGHT).convert("RGB").resize((W, H), Image.LANCZOS)
dp, np_ = day.load(), night.load()
out = Image.new("RGB", (W, H))
op = out.load()

for y in range(H):
    for x in range(W):
        dr, dg, db = dp[x, y]
        nr, ng, nb = np_[x, y]
        # Isolate the city lights from the night texture's own base.
        #
        # This source is not raw Black Marble: its unlit land is a blue-teal
        # wash — rgb(13,58,81) over the Sahara — so screening the texture
        # whole tints every desert cyan. The red channel is what separates
        # them: that wash carries R=13 and open ocean R=1, while a lit city
        # runs R=70 to 107. Red-minus-blue also separates them, but only by
        # about 50 levels at the very brightest, which left the lights too
        # faint to read once the globe is 380px wide.
        v = 0.0 if nr < LIGHT_FLOOR else min(255.0, (nr - LIGHT_FLOOR) * LIGHT_GAIN)
        lit = (v * LIGHT_TINT[0], v * LIGHT_TINT[1], v * LIGHT_TINT[2])
        base = (
            dr * DAY_LEVEL * DAY_COOL[0],
            dg * DAY_LEVEL * DAY_COOL[1],
            db * DAY_LEVEL * DAY_COOL[2],
        )
        # screen: 1-(1-a)(1-b). Keeps the bright cores from clipping flat.
        op[x, y] = tuple(
            min(255, max(0, round(255 - (255 - base[i]) * (255 - lit[i]) / 255)))
            for i in range(3)
        )

os.makedirs(os.path.dirname(OUT), exist_ok=True)
out.save(OUT, quality=86, optimize=True, progressive=True)
print("written", OUT, out.size, f"{os.path.getsize(OUT)/1024:.0f} KB")
