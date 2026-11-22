# Phone-size photo copies (720 / 960 px) must stay light so product pages open fast on 4G abroad.
# If a copy is heavier than CAP, it is re-made from the ORIGINAL photo at a slightly lower WebP quality
# (74 → 70 → 66 → 62 at most). Originals are never touched. Used by thumbs.yml and safe to run by hand.
import os, sys
from PIL import Image
SRC, CAP = "static/images", 110_000
done = 0
for root, _, files in os.walk(os.path.join(SRC, "_r")):
    for f in files:
        if not f.endswith((("-720.webp", "-960.webp"))):
            continue
        out = os.path.join(root, f)
        if os.path.getsize(out) <= CAP:
            continue
        rel = os.path.relpath(out, os.path.join(SRC, "_r"))
        base, w = rel.rsplit("-", 1); w = int(w.split(".")[0])
        orig = next((os.path.join(SRC, base + e) for e in (".jpg", ".jpeg", ".png", ".webp", ".JPG", ".JPEG", ".PNG", ".WEBP") if os.path.exists(os.path.join(SRC, base + e))), None)
        if not orig:
            continue
        im = Image.open(orig); im = im.convert("RGBA" if im.mode in ("RGBA", "LA", "P") else "RGB")
        if im.width > w:
            im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        before = os.path.getsize(out)
        for q in (70, 66, 62):
            im.save(out, "WEBP", quality=q, method=6)
            if os.path.getsize(out) <= CAP:
                break
        done += 1
        print(f"{rel}: {before // 1000} KB -> {os.path.getsize(out) // 1000} KB (q{q})")
print("re-made", done)
