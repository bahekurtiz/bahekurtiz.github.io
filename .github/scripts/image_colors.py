"""Placeholder colours for photos: average colour of the top, middle and bottom third of every image in
static/images (not the _r copies). The site paints this soft gradient while a photo is still loading,
so shoppers never see an empty white box. Writes content/image-colors.json (same output for the same
photos, so the robot only commits when photos change). Run from the repo root."""
import json, os, warnings
from PIL import Image

warnings.filterwarnings("ignore")
SRC, OUT = "static/images", "content/image-colors.json"
out = {}
for root, dirs, files in os.walk(SRC):
    if os.path.relpath(root, SRC).split(os.sep)[0] == "_r":
        continue
    for f in files:
        if not f.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
            continue
        p = os.path.join(root, f)
        try:
            im = Image.open(p)
            im.draft("RGB", (96, 120))
            im = im.convert("RGB").resize((24, 30), Image.BILINEAR)
            px = im.load(); cols = []
            for y0, y1 in ((0, 10), (10, 20), (20, 30)):
                r = g = b = 0
                for y in range(y0, y1):
                    for x in range(24):
                        pr, pg, pb = px[x, y]; r += pr; g += pg; b += pb
                n = (y1 - y0) * 24
                cols.append("#%02x%02x%02x" % (r // n, g // n, b // n))
            out["/" + os.path.relpath(p, "static").replace(os.sep, "/")] = ",".join(cols)
        except Exception as e:
            print("skip", p, e)
json.dump(out, open(OUT, "w"), separators=(",", ":"), sort_keys=True)
print("colours:", len(out))
