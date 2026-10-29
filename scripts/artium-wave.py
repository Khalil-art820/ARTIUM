# The Artium mark's white wave, as one filled path in a 100-unit box (disc r=50).
# A smooth cubic centreline (left tip -> crest -> trough -> right tip) with a
# thickness that swells to T in the middle and fades to fine points at both
# ends. Prints the path; scripts/pwa-icons.py and ArtiumMark.jsx use it.
#   python3 scripts/artium-wave.py [T]
import math, sys
T = float(sys.argv[1]) if len(sys.argv) > 1 else 4.2
# Two cubic Béziers joined smoothly at the middle (tangents match).
B1 = [(9.0, 58.6), (19.5, 45.6), (30.5, 43.6), (50.0, 51.0)]
B2 = [(50.0, 51.0), (69.5, 58.4), (80.5, 56.6), (91.0, 44.2)]
def bez(b, t):
    u = 1 - t
    return tuple(u**3*b[0][i] + 3*u*u*t*b[1][i] + 3*u*t*t*b[2][i] + t**3*b[3][i] for i in range(2))
pts = [bez(B1, k / 120) for k in range(120)] + [bez(B2, k / 120) for k in range(121)]
# arc-length parameter so the taper is even along the curve
L = [0.0]
for a, b in zip(pts, pts[1:]): L.append(L[-1] + math.dist(a, b))
tot = L[-1]
top, bot = [], []
for i, (x, y) in enumerate(pts):
    a = pts[max(i - 1, 0)]; b = pts[min(i + 1, len(pts) - 1)]
    dx, dy = b[0] - a[0], b[1] - a[1]; n = math.hypot(dx, dy) or 1
    nx, ny = -dy / n, dx / n
    s = L[i] / tot
    w = T * (math.sin(math.pi * s) ** 0.7) / 2
    top.append((x + nx * w, y + ny * w)); bot.append((x - nx * w, y - ny * w))
poly = top + bot[::-1]
print("M" + " L".join(f"{x:.2f} {y:.2f}" for x, y in poly) + "Z")
