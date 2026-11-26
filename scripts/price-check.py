#!/usr/bin/env python3
"""Price consistency check on the built site (_site). Run after `node build.mjs`:  python3 scripts/price-check.py
For every product, the price in content/products/*.json must be the same on:
  product page (visible price, data attributes, Product/Offer schema), product cards on every page,
  prose mentions next to a product link (blogs, guides, landing / festival / Hindi / French / Japanese pages),
  Google Merchant INR + USD, Meta catalog INR + USD, ChatGPT jsonl / jsonl.gz / tsv, products.json, llms.txt, cart catalog,
  and drafts/*.md (ready-to-post texts).
Prints every mismatch and exits 1 if there is any. Wholesale (B2B) prices are not product retail prices and are not checked."""
import csv, glob, gzip, html, io, json, os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SITE = os.path.join(ROOT, "_site")
P = {}
for f in glob.glob(os.path.join(ROOT, "content/products/*.json")):
    d = json.load(open(f, encoding="utf8"))
    if d.get("draft") is True: continue
    s = re.sub(r"[^\w\s-]", "", os.path.basename(f)[:-5].lower()).strip()
    s = re.sub(r"[\s_]+", "-", s)
    P[s] = {"inr": d.get("price"), "usd": d.get("price_usd")}
bad, checked = [], {"n": 0}

def chk(where, slug, cur, val):
    exp = P[slug]["inr" if cur == "INR" else "usd"]
    if exp is None: return
    checked["n"] += 1
    if abs(float(val) - float(exp)) > 0.001: bad.append(f"{where}: {slug} {cur} {val} ≠ {exp}")

def num(x): return float(str(x).replace(",", ""))

# 1. product pages + 2. cards and prose on every page
link_re = re.compile(r'<a[^>]+href="/products/([a-z0-9-]+)/(?:\?[^"]*)?"[^>]*>(.*?)</a>', re.S)
money_after = re.compile(r'^[^<$₹]{0,40}?(?:\(|at |costs |is |for |– |- |, )?\s*(?:<[^>]+>\s*)*(US\$|\$|₹)\s?(\d{1,2},\d{3}|\d{2,5})(?:\.\d\d)?(?![\d,–-])')
money_before = re.compile(r'(?:At|at|For|for)\s(US\$|\$|₹)\s?(\d{1,2},\d{3}|\d{2,5}),?\s(?:the|a|an|this|our)?\s*$')
for f in glob.glob(os.path.join(SITE, "**/*.html"), recursive=True):
    rel = os.path.relpath(f, SITE)
    if rel.startswith(("admin", "wholesale/line-sheet", "dashboard")): continue
    h = open(f, encoding="utf8", errors="ignore").read()
    m = re.match(r"products/([a-z0-9-]+)/index\.html$", rel)
    if m and m.group(1) in P:
        s = m.group(1)
        dp = re.search(r'data-product[^>]*', h)
        if dp:
            a = re.search(r'data-price="([\d.]+)"', dp.group(0)); b = re.search(r'data-usd="([\d.]+)"', dp.group(0))
            if a: chk(rel + " data-price", s, "INR", a.group(1))
            if b: chk(rel + " data-usd", s, "USD", b.group(1))
        pdp = re.search(r'<div class="pdp-price">(.*?)</div>', h, re.S)
        if pdp:
            for v in re.findall(r'<span class="price[^"]*"[^>]*>₹([\d,]+)</span>', pdp.group(1)): chk(rel + " visible ₹", s, "INR", num(v))
            for v in re.findall(r'<span class="price[^"]*" data-usdv="([\d.]+)"', pdp.group(1)): chk(rel + " visible $", s, "USD", v)
        for blk in re.findall(r'<script type="application/ld\+json">(.*?)</script>', h, re.S):
            try: j = json.loads(blk)
            except Exception: continue
            stack = [j]
            while stack:
                o = stack.pop()
                if isinstance(o, list): stack += o; continue
                if not isinstance(o, dict): continue
                if o.get("@type") == "Offer" and "price" in o and o.get("priceCurrency") in ("INR", "USD"):
                    u = str(o.get("url", ""))
                    if "/products/" + s + "/" in u or not u: chk(rel + " schema Offer", s, o["priceCurrency"], o["price"])
                stack += [v for v in o.values() if isinstance(v, (dict, list))]
        for cur, v in re.findall(r'<meta property="(?:product|og):price:amount" content="([\d.]+)"[^>]*>\s*<meta property="(?:product|og):price:currency" content="(INR|USD)"', h): pass
    # cards
    for c in re.finditer(r'<article class="card"[^>]*data-slug="([a-z0-9-]+)"(.*?)</article>', h, re.S):
        s = c.group(1)
        if s not in P: continue
        cp = re.search(r'<div class="card-price">(.*?)</div>', c.group(2), re.S)
        if not cp: continue
        for v in re.findall(r'<span class="price[^"]*"[^>]*>₹([\d,]+)</span>', cp.group(1)): chk(rel + " card ₹", s, "INR", num(v))
        for v in re.findall(r'<span class="price[^"]*" data-usdv="([\d.]+)"', cp.group(1)): chk(rel + " card $", s, "USD", v)
        for v in re.findall(r'<span class="price" data-cadv="([\d.]+)"', cp.group(1)): chk(rel + " card CA (US$ base)", s, "USD", v)
    # prose: "[Product](/products/x/) ($67)", "… at $67", "At $67, the [Product]"
    body = re.sub(r'<article class="card".*?</article>', "", h, flags=re.S)
    body = re.sub(r'<(script|style)\b.*?</\1>', "", body, flags=re.S)
    for lm in link_re.finditer(body):
        s = lm.group(1)
        if s not in P: continue
        after = body[lm.end(): lm.end() + 160]
        after = after.split("/products/")[0]
        am = money_after.match(html.unescape(after))
        if am and not re.search(r'card-price|class="price', after[:am.end()]):
            chk(rel + " text after link", s, "INR" if am.group(1) == "₹" else "USD", num(am.group(2)))
        before = html.unescape(re.sub(r"<[^>]+>", "", body[max(0, lm.start() - 80): lm.start()]))
        bm = money_before.search(before)
        if bm: chk(rel + " text before link", s, "INR" if bm.group(1) == "₹" else "USD", num(bm.group(2)))

# 3. feeds
def slug_from_link(u):
    m = re.search(r"/products/([a-z0-9-]+)/", u or ""); return m.group(1) if m else None
for fn, cur in (("google-merchant.xml", "INR"), ("google-merchant-usd.xml", "USD")):
    x = open(os.path.join(SITE, "feeds", fn), encoding="utf8").read()
    for it in re.findall(r"<item>(.*?)</item>", x, re.S):
        s = slug_from_link((re.search(r"<g:link>([^<]*)", it) or [None, ""])[1])
        pr = re.search(r"<g:price>([\d.]+) (\w+)</g:price>", it)
        if s in P and pr: chk(fn, s, pr.group(2), pr.group(1))
        if "<g:sale_price>" in it: bad.append(f"{fn}: {s} has sale_price (owner: real price only)")
for fn in ("meta-catalog.csv", "meta-catalog-usd.csv"):
    for r in csv.DictReader(open(os.path.join(SITE, "feeds", fn), encoding="utf8")):
        s = slug_from_link(r.get("link")); pv = (r.get("price") or "").split()
        if s in P and len(pv) == 2: chk(fn, s, pv[1], pv[0])
        if (r.get("sale_price") or "").strip(): bad.append(f"{fn}: {s} has sale_price")
def gpt_rows(text):
    for ln in text.splitlines():
        if ln.strip(): yield json.loads(ln)
for fn, rows in (("chatgpt.jsonl", gpt_rows(open(os.path.join(SITE, "feeds/chatgpt.jsonl"), encoding="utf8").read())),
                 ("chatgpt.jsonl.gz", gpt_rows(gzip.open(os.path.join(SITE, "feeds/chatgpt.jsonl.gz"), "rt", encoding="utf8").read()))):
    for r in rows:
        s = slug_from_link(r.get("url")); pv = str(r.get("price", "")).split()
        if s in P and len(pv) == 2: chk(fn, s, pv[1], pv[0])
        if r.get("sale_price"): bad.append(f"{fn}: {s} has sale_price")
tsv = list(csv.DictReader(open(os.path.join(SITE, "feeds/chatgpt.tsv"), encoding="utf8"), delimiter="\t"))
for r in tsv:
    s = slug_from_link(r.get("url")); pv = str(r.get("price", "")).split()
    if s in P and len(pv) == 2: chk("chatgpt.tsv", s, pv[1], pv[0])
pj = json.load(open(os.path.join(SITE, "products.json"), encoding="utf8"))
for r in pj.get("products", []):
    s = slug_from_link(r.get("url"))
    if s in P:
        if r.get("price_inr") is not None: chk("products.json", s, "INR", r["price_inr"])
        if r.get("price_usd") is not None: chk("products.json", s, "USD", r["price_usd"])
# llms.txt (and llms-full.txt): lines with a product link and prices
for fn in ("llms.txt", "llms-full.txt"):
    fp = os.path.join(SITE, fn)
    if not os.path.exists(fp): continue
    for ln in open(fp, encoding="utf8"):
        sl = set(re.findall(r"/products/([a-z0-9-]+)/", ln))
        if len(sl) != 1: continue
        s = sl.pop()
        if s not in P: continue
        for v in re.findall(r"₹\s?([\d,]{3,})", ln): chk(fn, s, "INR", num(v))
        for v in re.findall(r"(?<![A-Z])\$\s?(\d{2,4})(?![\d,])", ln): chk(fn, s, "USD", v)
# cart / checkout catalog (the prices the bag and the payment server use)
for fp in glob.glob(os.path.join(SITE, "**/catalog*.json"), recursive=True):
    try: cj = json.load(open(fp, encoding="utf8"))
    except Exception: continue
    for s, r in (cj.get("products") or {}).items():
        if s in P:
            if r.get("price") is not None: chk(os.path.relpath(fp, SITE), s, "INR", r["price"])
            if r.get("price_usd") is not None: chk(os.path.relpath(fp, SITE), s, "USD", r["price_usd"])
# 4. drafts (ready-to-post texts): a line with one product link
for fp in glob.glob(os.path.join(ROOT, "drafts/**/*.md"), recursive=True):
    for ln in open(fp, encoding="utf8"):
        sl = set(s for s in re.findall(r"/products/([a-z0-9-]+)/", ln) if s in P)
        if len(sl) != 1: continue
        s = sl.pop()
        for v in re.findall(r"₹\s?([\d,]{3,})", ln): chk(os.path.relpath(fp, ROOT), s, "INR", num(v))
        for v in re.findall(r"(?<![A-Z])\$\s?(\d{2,4})(?![\d,])", ln): chk(os.path.relpath(fp, ROOT), s, "USD", v)

print(f"price-check: {len(P)} products, {checked['n']} price spots checked, {len(bad)} mismatch(es)")
for b in bad[:200]: print("  ✗", b)
sys.exit(1 if bad else 0)
