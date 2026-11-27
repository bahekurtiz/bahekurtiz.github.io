#!/usr/bin/env python3
"""Keyword map: every Search Console query goes into ONE cluster, and every cluster has ONE owner page.
   python3 scripts/keyword-map.py GSC_ROWS.json [COUNTRY_ROWS.json] [--date YYYY-MM-DD]
GSC_ROWS.json   : list (or {"data": [...]}) of {query, page, impressions, clicks, position}  (Search Console, last 3 months)
COUNTRY_ROWS.json: optional list of [query, country, impressions, position] or {query, country, impressions, position}
Writes content/keyword-map.json: per cluster the queries, impressions, clicks, impression-weighted position, the pages Google
showed, the owner page's share, cannibalisation (another page with >= 20% of the cluster's impressions), countries, and a
dated history line (so the Monday report can say who moved up). Cluster rules live in content/keyword-map.json ("clusters")
– edit patterns or owners there; the script keeps them and only refreshes the numbers."""
import collections, json, os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
MAP = os.path.join(ROOT, "content/keyword-map.json")
SITE = os.path.join(ROOT, "_site")
try: LIVE_STORIES = set(json.load(open(os.path.join(ROOT, "content/stories.json"), encoding="utf8")).get("slugs", []))
except Exception: LIVE_STORIES = set()

DEFAULT_CLUSTERS = [
    # id, name, regex on the query, owner page, intent, target markets
    ("brand", "Bahe Kurtiz (brand)", r"\bbahe\b|bahevip|bahe kurti", "/", "brand", "all"),
    ("tamil-wedding", "Tamil wedding guest outfit", r"tamil", "/blog/what-to-wear-to-a-tamil-wedding-as-a-guest/", "guide", "US UK CA AU SG MY IN"),
    ("south-indian-wedding", "South Indian wedding guest outfit", r"south indian", "/blog/what-to-wear-to-a-south-indian-wedding-as-a-guest/", "guide", "US UK CA AU SG MY"),
    ("kerala-wedding", "Kerala / Malayali wedding guest outfit", r"kerala|malayali", "/blog/what-to-wear-to-a-kerala-malayali-wedding-as-a-guest/", "guide", "US UK AE IN"),
    ("bengali-wedding", "Bengali wedding guest outfit", r"bengali|biyer|gaye holud|bou bhaat", "/blog/what-to-wear-to-a-bengali-wedding-as-a-guest/", "guide", "US UK IN"),
    ("bangladeshi-wedding", "Bangladeshi wedding guest outfit", r"bangladesh", "/blog/what-to-wear-to-a-bangladeshi-wedding-as-a-guest/", "guide", "UK US CA"),
    ("punjabi-wedding", "Punjabi wedding guest outfit", r"punjabi", "/blog/what-to-wear-to-a-punjabi-wedding-as-a-guest/", "guide", "UK CA US AU"),
    ("sikh-wedding", "Sikh wedding / Anand Karaj guest outfit", r"sikh|anand karaj|gurdwara wedding", "/blog/what-to-wear-to-a-sikh-anand-karaj-as-a-guest/", "guide", "UK CA US AU"),
    ("gurdwara", "Gurdwara / Gurpurab outfit", r"gurdwara|gurpurab|guru nanak", "/blog/guru-nanak-gurpurab-outfit-ideas-for-women/", "guide", "UK CA US IN"),
    ("marathi-wedding", "Marathi wedding guest outfit", r"marathi|maharashtrian", "/blog/what-to-wear-to-a-marathi-wedding-as-a-guest/", "guide", "IN US UK"),
    ("gujarati-wedding", "Gujarati wedding guest outfit", r"gujarati|garba", "/blog/what-to-wear-to-a-gujarati-wedding-as-a-guest/", "guide", "UK US IN"),
    ("rajasthani-wedding", "Rajasthani / Marwari wedding guest outfit", r"rajasthani|marwari", "/blog/what-to-wear-to-a-rajasthani-marwari-wedding/", "guide", "IN US UK AE"),
    ("nepali-wedding", "Nepali wedding guest outfit", r"nepali|nepal", "/blog/what-to-wear-to-a-nepali-wedding-as-a-guest/", "guide", "UK US AU"),
    ("pakistani-wedding", "Pakistani wedding / nikah / walima guest outfit", r"pakistan|walima|nikah", "/blog/what-to-wear-to-a-pakistani-wedding-as-a-guest/", "guide", "UK US CA AE"),
    ("mehndi", "Mehndi outfits for guests", r"mehndi|mehendi|henna party", "/blog/what-to-wear-to-a-mehndi-as-a-guest/", "guide", "all"),
    ("haldi", "Haldi outfits for guests", r"haldi|pithi", "/blog/haldi-outfit-ideas-for-guests/", "guide", "all"),
    ("sangeet", "Sangeet outfits", r"sangeet", "/blog/sangeet-outfit-ideas-for-guests/", "guide", "all"),
    ("reception", "Reception outfit for women", r"reception", "/blog/reception-outfit-ideas-for-women/", "guide", "all"),
    ("engagement", "Roka / engagement outfit", r"roka|engagement", "/blog/roka-and-engagement-outfit-ideas/", "guide", "all"),
    ("teen-wedding", "Teen girl wedding outfit", r"teen", "/blog/teen-girl-indian-wedding-outfit-ideas/", "guide", "US UK CA"),
    ("plus-size", "Plus size Indian outfits", r"plus size|plus-size|chubby|curvy|4xl|5xl", "/plus-size-indian-outfits/", "collection", "US UK CA AU"),
    ("tall-women", "Anarkali / Indian outfits for tall women", r"\btall\b", "/blog/indian-wedding-guest-outfits-for-tall-women/", "guide", "US UK CA AU"),
    ("over-50", "Indian wedding outfits for women over 50 / mother of the bride", r"over 50|mother of the bride|older women", "/blog/indian-wedding-guest-outfits-for-women-over-50/", "guide", "US UK CA AU"),
    ("wedding-guest", "Indian wedding guest outfits (general)", r"wedding guest|indian wedding|wedding wear|wedding attire|wedding outfit|what to wear to an indian wedding|clothes for indian wedding|wedding dress for guest", "/indian-wedding-guest-outfits/", "collection", "US UK CA AU AE"),
    ("anarkali-jewellery", "Jewellery with an Anarkali", r"jewel|earring|necklace|jhumka", "/blog/jewellery-to-wear-with-an-anarkali/", "guide", "all"),
    ("anarkali-winter", "Anarkali fabric for winter weddings / velvet", r"winter|velvet", "/blog/velvet-anarkali-for-winter-weddings-how-to-choose-style-and-care/", "guide", "UK US CA IN"),
    ("anarkali-choose", "How to choose an Anarkali", r"choose an anarkali|anarkali suit.*worth|luxury anarkali", "/blog/how-to-choose-an-anarkali-for-a-wedding/", "guide", "all"),
    ("anarkali", "Anarkali suits (buy)", r"anarkali|gota patti|frock suit", "/collections/anarkali-suits/", "collection", "all"),
    ("georgette-chiffon", "Georgette vs chiffon vs organza", r"georgette|chiffon|organza", "/blog/georgette-vs-chiffon-vs-organza/", "guide", "all"),
    ("chanderi", "Chanderi kurta sets", r"chanderi", "/craft/chanderi/", "collection", "IN US UK"),
    ("kota-doria", "Kota doria", r"kota doria|kota cloth|kota fabric", "/blog/what-is-kota-doria-fabric-styling-and-care/", "guide", "IN US UK"),
    ("block-print-types", "Sanganeri, Bagru & Dabu print", r"sanganeri|bagru|dabu|bhagat", "/blog/sanganeri-bagru-and-dabu-print-a-simple-guide-to-jaipur-block-prints/", "guide", "all"),
    ("block-print", "Jaipur hand block print kurta / kurti", r"block print|jaipur print|jaipuri|hand block", "/hand-block-print-kurta-sets/", "collection", "all"),
    ("wholesale", "Kurti wholesale / manufacturer", r"wholesale|manufacturer|supplier|bulk|private label|import", "/wholesale/", "b2b", "all"),
    ("linen-dress", "Linen dresses / linen vs cotton", r"linen|sundress|resort", "/blog/linen-vs-cotton-dresses-which-is-better-for-hot-weather/", "guide", "US UK AU AE"),
    ("maxi-dress", "Cotton maxi / midi dresses", r"maxi|midi|dress for summer|summer dress", "/collections/dresses/", "collection", "US UK AU AE"),
    ("co-ord", "Co-ord sets", r"co-?ord|coord|two piece|2 piece", "/collections/co-ord-sets/", "collection", "all"),
    ("kurta-palazzo", "Kurta palazzo sets", r"palazzo", "/collections/kurta-palazzo-sets/", "collection", "all"),
    ("kurta-set", "Kurta sets / suit sets", r"kurta set|kurta pant|suit set|salwar|3 piece|three piece|\bsuits?\b", "/collections/kurta-pant-dupatta-sets/", "collection", "all"),
    ("tunic", "Short kurtis / tunic tops for jeans", r"tunic|short kurti|kurti for jeans|top for jeans", "/cotton-tunic-tops-short-kurtis-for-jeans/", "collection", "all"),
    ("kurti", "Kurtis", r"kurti|kurtis", "/collections/kurtis/", "collection", "all"),
    ("custom-fit", "Custom stitched / made to measure", r"custom|made to measure|stitched|tailor", "/custom-stitched-indian-suits-made-to-measure/", "collection", "US UK CA AU"),
    ("buy-abroad", "Buy Indian clothes online abroad", r"online.*(usa|uk|canada|australia|uae|us\b)|(usa|uk|canada|australia|uae).*online|fast (shipping|delivery)|next day|indian clothes", "/indian-clothes-online-uk-canada-australia-uae/", "collection", "US UK CA AU AE"),
    ("diwali", "Diwali / Dhanteras / Bhai Dooj outfits", r"diwali|deepavali|dhanteras|dantheras|lakshmi|laxmi|bhai dooj", "/diwali-outfits-for-women/", "collection", "all"),
    ("christmas", "Christmas & New Year Indian outfits", r"christmas|new year", "/festival/christmas-new-year/", "collection", "US UK CA AU"),
    ("lohri", "Lohri outfits", r"lohri", "/blog/what-to-wear-for-lohri-outfit-ideas/", "guide", "IN UK CA"),
    ("eid", "Eid outfits", r"\beid\b", "/blog/eid-outfit-ideas-anarkali-and-kurta-sets-abroad/", "guide", "UK US AE MY SG"),
    ("dupatta", "How to drape a dupatta", r"dupatta", "/blog/how-to-drape-a-dupatta-7-ways/", "guide", "all"),
    ("dubai", "Indian outfits in Dubai / UAE", r"dubai|abu dhabi|uae", "/blog/indian-wedding-guest-outfits-in-dubai-and-abu-dhabi/", "guide", "AE"),
    ("france", "Tenue indienne (France)", r"tenue|robe|indienne|femme", "/fr/", "intl", "FR"),
    ("japan", "インド服 (Japan)", r"[぀-ヿ一-鿿]", "/ja/", "intl", "JP"),
    ("russia", "Индийская одежда (Russia)", r"[Ѐ-ӿ]", "/ru/", "intl", "RU"),
]
NOISE = re.compile(r"^(yes|no|more|more please|dress|photo|pictures?|images?|pic.*|clear .*|colou?r image|how to style this|what do u call this style|can you.*pic.*|can you provide.*|/.*|as a guests?|for ladies|black|dark .*|day wise|colord)$")

def norm_page(p):
    p = re.sub(r"^https?://(www\.)?bahekurtiz\.com", "", str(p)).split("#")[0].split("?")[0] or "/"
    return p

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    date = next((sys.argv[i + 1] for i, a in enumerate(sys.argv) if a == "--date"), None)
    if not args: print(__doc__); sys.exit(1)
    rows = json.load(open(args[0], encoding="utf8")); rows = rows.get("data", rows) if isinstance(rows, dict) else rows
    crow = []
    if len(args) > 1:
        cr = json.load(open(args[1], encoding="utf8"))
        for r in (cr.get("data", cr) if isinstance(cr, dict) else cr):
            crow.append((r["query"], r["country"], r["impressions"], r["position"]) if isinstance(r, dict) else tuple(r))
    old = json.load(open(MAP, encoding="utf8")) if os.path.exists(MAP) else {}
    defs = old.get("clusters") or [{"id": i, "name": n, "pattern": p, "owner": o, "intent": t, "markets": m} for i, n, p, o, t, m in DEFAULT_CLUSTERS]
    comp = [(c, re.compile(c["pattern"], re.I)) for c in defs]
    agg = {c["id"]: {"imp": 0, "clk": 0, "pw": 0.0, "queries": collections.Counter(), "qpos": collections.defaultdict(lambda: [0, 0.0]), "pages": collections.Counter(), "countries": collections.Counter()} for c in defs}
    unassigned = collections.Counter()
    def cluster_of(q):
        for c, rx in comp:
            if rx.search(q): return c["id"]
        return None
    for r in rows:
        q = str(r["query"]).strip().lower()
        if len(q) > 140 or NOISE.match(q): continue
        cid = cluster_of(q)
        if not cid: unassigned[q] += r["impressions"]; continue
        a = agg[cid]; i = r["impressions"]; a["imp"] += i; a["clk"] += r.get("clicks", 0); a["pw"] += r["position"] * i
        a["queries"][q] += i; a["qpos"][q][0] += i; a["qpos"][q][1] += r["position"] * i
        p = norm_page(r["page"])
        if p.startswith("/stories/"):
            sl = p[9:].strip("/")
            if sl not in LIVE_STORIES: p = "/blog/" + sl + "/"          # story already 301s to its post (owner decision 12 Nov) – counts for the post
            else: p = "/stories/ → /blog/" + sl + "/"                    # live web story of the same post
        a["pages"][p] += i
    for q, cc, imp, pos in crow:
        cid = cluster_of(str(q).lower())
        if cid: agg[cid]["countries"][cc] += imp
    out = []
    for c in defs:
        a = agg[c["id"]]; imp = a["imp"]; pos = round(a["pw"] / imp, 1) if imp else None
        owner = c["owner"]; own_imp = sum(v for p, v in a["pages"].items() if p == owner or p.endswith("→ " + owner))
        rivals = [{"page": p, "share": round(v / imp, 2)} for p, v in a["pages"].most_common() if imp and p != owner and not p.endswith("→ " + owner) and v / imp >= 0.2]
        stories_same = [{"page": p.split(" → ")[0] + p.split("/blog/")[1], "share": round(v / imp, 2)} for p, v in a["pages"].items() if p.startswith("/stories/ → ") and p.endswith("→ " + owner) and imp and v / imp >= 0.2]
        hist = [h for h in (next((x.get("history", []) for x in old.get("map", []) if x["id"] == c["id"]), []))]
        if date and pos is not None and not any(h["date"] == date for h in hist): hist.append({"date": date, "position": pos, "impressions": imp, "clicks": a["clk"]})
        out.append({**c, "owner_exists": os.path.exists(os.path.join(SITE, owner.strip("/"), "index.html")) if owner != "/" else True,
                    "impressions": imp, "clicks": a["clk"], "ctr": round(a["clk"] / imp, 3) if imp else None, "position": pos,
                    "status": "no data yet" if pos is None else "No.1" if pos <= 1.5 else "top 3" if pos <= 3 else "page 1" if pos <= 10 else "page 2" if pos <= 20 else "beyond page 2",
                    "owner_share": round(own_imp / imp, 2) if imp else None, "cannibalisation": rivals, "story_twin": stories_same,
                    "countries": dict(a["countries"].most_common(6)),
                    "top_queries": [{"q": q, "impressions": n, "position": round(a["qpos"][q][1] / a["qpos"][q][0], 1)} for q, n in a["queries"].most_common(12)],
                    "history": hist})
    out.sort(key=lambda x: -x["impressions"])
    res = {"_help": "One owner page per keyword cluster. Built by scripts/keyword-map.py from Search Console (last 3 months). Edit 'clusters' (pattern / owner) and re-run; the Monday report reads 'map'. position = impression-weighted average; cannibalisation = another URL with >= 20% of the cluster's impressions; story_twin = the cluster's web story taking >= 20% (owner decision 12 Nov keeps 13 stories).",
           "source": old.get("source") if not date else f"Search Console via Windsor, data pulled {date}", "updated": date or old.get("updated"),
           "clusters": defs, "map": out,
           "unassigned_top": [{"q": q, "impressions": n} for q, n in unassigned.most_common(25)]}
    json.dump(res, open(MAP, "w", encoding="utf8"), ensure_ascii=False, indent=1)
    print(f"keyword-map: {len(out)} clusters, {sum(1 for x in out if x['impressions'])} with data, {sum(len(x['cannibalisation']) for x in out)} cannibalisation flags, {sum(len(x['story_twin']) for x in out)} story twins, owners missing: {[x['owner'] for x in out if not x['owner_exists']]}")

if __name__ == "__main__": main()
