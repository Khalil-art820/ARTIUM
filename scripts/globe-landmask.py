# Rasterise Natural Earth 10m land polygons (shapefile type 5) to an
# equirectangular mask, then cut out lakes. Minimal reader: no pyshp needed.
# Usage: python3 scripts/globe-landmask.py ne_10m_land.shp land16k.png 16384 [ne_10m_lakes.shp]
#   (naciscdn.org/naturalearth/10m/physical/ne_10m_land.zip and ne_10m_lakes.zip)
import struct, sys
from PIL import Image, ImageDraw
shp, out, W = sys.argv[1], sys.argv[2], int(sys.argv[3])
cuts = sys.argv[4:]
H = W // 2
img = Image.new("L", (W, H), 0)
dr = ImageDraw.Draw(img)
def px(x, y): return ((x + 180) / 360 * W, (90 - y) / 180 * H)

def draw(path, outer_fill, hole_fill):
    n = 0
    with open(path, "rb") as f:
        f.read(100)
        while True:
            hdr = f.read(8)
            if len(hdr) < 8: break
            _, clen = struct.unpack(">ii", hdr)
            rec = f.read(clen * 2)
            if struct.unpack("<i", rec[:4])[0] != 5: continue
            nparts, npts = struct.unpack("<ii", rec[36:44])
            parts = list(struct.unpack(f"<{nparts}i", rec[44:44 + 4 * nparts])) + [npts]
            off = 44 + 4 * nparts
            pts = struct.unpack(f"<{2*npts}d", rec[off:off + 16 * npts])
            rings = []
            for a, b in zip(parts[:-1], parts[1:]):
                ring = [(pts[2*i], pts[2*i+1]) for i in range(a, b)]
                area = sum(x1*y2 - x2*y1 for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]))
                rings.append((area, ring))
            # shapefile: outer rings clockwise (negative signed area), holes CCW
            for area, ring in rings:
                if area < 0: dr.polygon([px(*p) for p in ring], fill=outer_fill)
            for area, ring in rings:
                if area > 0: dr.polygon([px(*p) for p in ring], fill=hole_fill)
            n += 1
    return n

print("land", draw(shp, 255, 0))
# Lakes are water; islands inside them (their holes) are land again.
for c in cuts: print("lakes", draw(c, 0, 255))
img.save(out)
