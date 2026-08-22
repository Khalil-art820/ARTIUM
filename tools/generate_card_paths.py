#!/usr/bin/env python3
"""
Copied from the client handoff (artium-handoff/generate_card_paths.py) for
the entry-gate rebuild. Regenerates
src/components/entrygate/paths.json — run this script from that output
location in mind (see main() below) if the card geometry ever changes.
Do not hand-edit paths.json.

Generate the four Artium card silhouettes as SVG path data.

Each card is a rounded rectangle with a concave carve around the
medallion center, blended with smooth fillets so the border reads as
one continuous line. Re-run this script whenever the card size, corner
radii, medallion position, or carve clearance changes — never hand-edit
the path data and never replace this with CSS mask/clip-path (masks
remove the outer drop shadows and break border continuity).

Requires: shapely >= 2.0   (pip install shapely)
Output:   paths.json  { plate1..4, platekey1..4, panel1..4, panelkey1..4 }

Geometry (card-local coordinates, card = 260 x 412):
  - plate: rounded rect r=62, carved along ellipse 203 x 238
  - panel: rounded rect r=54 inset 10px, carved along ellipse 213 x 248
  - keylines: same shapes offset inward by 2.6px (white specular lines)
  - medallion center per card:
      c1 (420, 423)   c2 (-160, 423)   c3 (420, -11)   c4 (-160, -11)
    (medallion slab is 380 x 446 centered at stage (420, 423);
     carve radii = slab half-axes + ~13px void)
"""
import json
import os
from shapely.geometry import box, Point
from shapely import affinity

CARD_W, CARD_H = 260, 412
PLATE_R, PANEL_R, PANEL_INSET = 62, 54, 10
PLATE_CARVE = (203, 238)          # ellipse radii for the plate cut
PANEL_CARVE = (213, 248)          # plate rim stays visible as a strip
FILLET = 10                       # blend radius at line/curve junctions
KEYLINE_OFFSET = 2.6              # inward offset of the white keylines

CENTERS = {1: (420, 423), 2: (-160, 423), 3: (420, -11), 4: (-160, -11)}


def rounded_rect(x0, y0, x1, y1, r):
    return box(x0 + r, y0 + r, x1 - r, y1 - r).buffer(r, quad_segs=28)


def ellipse(cx, cy, rx, ry):
    return affinity.scale(Point(cx, cy).buffer(1, quad_segs=120),
                          rx, ry, origin=(cx, cy))


def smooth(geom, f):
    """Round convex junction spikes (morphological opening)."""
    return geom.buffer(-f, quad_segs=24).buffer(f, quad_segs=24)


def to_d(geom, prec=1):
    ext = list(geom.exterior.coords)
    parts = [f"M{ext[0][0]:.{prec}f},{ext[0][1]:.{prec}f}"]
    parts += [f"L{x:.{prec}f},{y:.{prec}f}" for x, y in ext[1:]]
    return "".join(parts) + "Z"


def main():
    out = {}
    for k, (cx, cy) in CENTERS.items():
        plate = rounded_rect(0, 0, CARD_W, CARD_H, PLATE_R) \
            .difference(ellipse(cx, cy, *PLATE_CARVE))
        plate = smooth(plate, FILLET).simplify(0.25)

        panel = rounded_rect(PANEL_INSET, PANEL_INSET,
                             CARD_W - PANEL_INSET, CARD_H - PANEL_INSET,
                             PANEL_R).difference(ellipse(cx, cy, *PANEL_CARVE))
        panel = smooth(panel, FILLET - 1).simplify(0.25)

        for g, name in [(plate, "plate"),
                        (plate.buffer(-KEYLINE_OFFSET, quad_segs=24).simplify(0.25), "platekey"),
                        (panel, "panel"),
                        (panel.buffer(-KEYLINE_OFFSET, quad_segs=24).simplify(0.25), "panelkey")]:
            assert g.geom_type == "Polygon", (k, name, g.geom_type)
            out[f"{name}{k}"] = to_d(g)

    out_path = os.path.join(os.path.dirname(__file__), "..",
                             "src", "components", "entrygate", "paths.json")
    with open(out_path, "w") as f:
        json.dump(out, f, indent=1)
    print(f"wrote {out_path} ({sum(len(v) for v in out.values())} chars)")


if __name__ == "__main__":
    main()
