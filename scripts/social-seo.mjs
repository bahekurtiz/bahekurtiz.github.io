// Weekly social-SEO drafts for the owner to post by hand (nothing is posted automatically).
//   node scripts/social-seo.mjs            → drafts/social-seo/<YYYY>-W<ww>/ (this week)
//   node scripts/social-seo.mjs 2026-W49   → that week
// Writes: README.md (how to use), profiles.md (name / bio with real keywords), instagram-facebook.md, pinterest.md, youtube.md (+ chapters); drafts/social-seo/tiktok/<week>.md.
// Each week picks 7 different live products (rotation), so the drafts are new every week. Keywords come only from
// real Search Console queries in content/keyword-map.json plus the product's own facts (fabric, craft, colour, sizes).
// Facts are never invented: every caption line is built from the product file. Prices are the live prices that day.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://bahekurtiz.com";
const now = new Date(Date.now() + 5.5 * 36e5);
const isoWeek = (d) => { const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y = t.getUTCFullYear(); const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7); return `${y}-W${String(w).padStart(2, "0")}`; };
const WEEK = process.argv[2] || isoWeek(now);
const OUT = path.join(ROOT, "drafts/social-seo", WEEK);

const slugify = (s) => String(s).toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-");
const products = fs.readdirSync(path.join(ROOT, "content/products")).filter((f) => f.endsWith(".json")).map((f) => ({ slug: slugify(f.replace(/\.json$/, "")), ...JSON.parse(fs.readFileSync(path.join(ROOT, "content/products", f), "utf8")) }))
  .filter((p) => p.draft !== true && p.in_stock !== false && p.price && (p.images || []).length).sort((a, b) => a.slug.localeCompare(b.slug));
let KM = { map: [] }; try { KM = JSON.parse(fs.readFileSync(path.join(ROOT, "content/keyword-map.json"), "utf8")); } catch {}
const S = JSON.parse(fs.readFileSync(path.join(ROOT, "content/settings.json"), "utf8"));

// rotation: 7 products per week, a different slice every week
const wn = Number(WEEK.split("-W")[1]) + 53 * Number(WEEK.slice(0, 4));
const start = (wn * 7) % Math.max(1, products.length);
const pick = Array.from({ length: Math.min(7, products.length) }, (_, i) => products[(start + i) % products.length]);

// real queries per product family (from Search Console via the keyword map)
const fam = (p) => { const c = String(p.category || "").toLowerCase(), f = String(p.fabric || "").toLowerCase(), w = (p.print_work || []).join(" ").toLowerCase();
  if (/linen/.test(f)) return ["linen-dress", "maxi-dress"]; if (/dress/.test(c)) return ["maxi-dress", "linen-dress"];
  if (/anarkali/.test(c)) return [/velvet/.test(f) ? "anarkali-winter" : "anarkali", "wedding-guest", "anarkali-jewellery"];
  if (/co-ord/.test(c)) return ["co-ord", "block-print"]; if (/palazzo/.test(c)) return ["kurta-palazzo", "block-print"];
  if (/tunic|top/.test(c)) return ["tunic", "kurti"]; if (/kurti/.test(c)) return ["kurti", "sheer-kurti"];
  return [/block/.test(w) ? "block-print" : "kurta-set", "kurta-set", "wedding-guest"]; };
const realQ = (ids, p) => { const words = [String(p.category || "").toLowerCase().replace(/ set$| suit$/, ""), String(p.fabric || "").toLowerCase(), ...(p.print_work || []).map((w) => w.toLowerCase().split(" ")[0]), "kurta set", "kurti", "anarkali", "dress", "co-ord", "palazzo", "block print", "jaipur", "wedding guest", "tunic"].filter((w) => w && w.length > 2);
  const keep = (q) => words.some((w) => q.includes(w)) && (!/anarkali/.test(q) || /anarkali/i.test(p.category)) && (!/dress/.test(q) || /dress/i.test(p.category)) && (!/kurti|tunic/.test(q) || /kurti|tunic|top/i.test(p.category));
  return [...new Set(ids.flatMap((id) => (KM.map.find((x) => x.id === id)?.top_queries || []).map((q) => q.q)))].filter((q) => q.length < 60 && !/[?]/.test(q) && !/^is it\b/.test(q) && !/ready to ship|next day|same day|fast (delivery|shipping)|cheap|free gift/.test(q) && keep(q)).slice(0, 4); };
const money = (p) => `₹${Number(p.price).toLocaleString("en-IN")}${p.ships_abroad && p.price_usd ? ` · US$${p.price_usd}` : ""}`;
const plain = (s) => String(s || "").replace(/\s+/g, " ").trim();
const firstLine = (p) => plain(String(p.description || "").split("\n").find((l) => l.trim() && !/^✦|^•/.test(l.trim())) || p.title);
const tag = (s) => "#" + String(s).replace(/&/g, "and").replace(/[^A-Za-z0-9]+/g, "");
const tagsFor = (p) => { const t = new Set(["#BaheKurtiz", "#MadeInJaipur", "#HandmadeInIndia"]);
  const c = String(p.category || ""); if (/Anarkali/i.test(c)) ["#AnarkaliSuit", "#Anarkali", "#WeddingGuestOutfit"].forEach((x) => t.add(x));
  if (/Kurta/i.test(c)) ["#KurtaSet", "#KurtaSetForWomen"].forEach((x) => t.add(x)); if (/Co-ord/i.test(c)) t.add("#CoordSet"); if (/Dress/i.test(c)) t.add("#MaxiDress");
  if (/Tunic|Kurti/i.test(c)) ["#Kurti", "#KurtiForJeans"].forEach((x) => t.add(x)); if (p.fabric) t.add(tag(p.fabric + "Kurta").replace(/KurtaKurta/, "Kurta"));
  for (const w of p.print_work || []) { if (/block/i.test(w)) ["#HandBlockPrint", "#BlockPrint", "#JaipurPrints"].forEach((x) => t.add(x)); if (/gota/i.test(w)) t.add("#GotaPatti"); if (/zardozi/i.test(w)) t.add("#Zardozi"); if (/embroider/i.test(w)) t.add("#HandEmbroidery"); }
  for (const o of (p.occasion || []).slice(0, 3)) t.add(tag(o + "Outfit"));
  ["#IndianWear", "#EthnicWear", "#DesiFashion"].forEach((x) => t.add(x));
  return [...t].slice(0, 20).join(" "); };
const alt = (p) => `${p.style_name ? p.style_name + " – " : ""}${p.title}${p.color && !p.title.toLowerCase().includes(String(p.color).toLowerCase()) ? " in " + p.color : ""}, ${p.fabric || ""}, made in Jaipur by Bahe Kurtiz`.replace(/, ,/g, ",");
const url = (p) => `${SITE}/products/${p.slug}/`;
const sizes = (p) => (p.sizes || []).length ? `${p.sizes[0]}–${p.sizes[p.sizes.length - 1]}` : "";

fs.mkdirSync(OUT, { recursive: true });
const head = (t) => `# ${t} – week ${WEEK}\n\n> Drafts only – copy, check and post yourself. Prices are the live prices on ${now.toISOString().slice(0, 10)}; check the site before posting. No discount is mentioned (ask Claude before any sale).\n\n`;

// Instagram + Facebook
let ig = head("Instagram & Facebook captions");
for (const p of pick) { const q = realQ(fam(p), p);
  ig += `## ${p.style_name || p.title}\n\n**Photo:** ${SITE}${p.images[0]}\n**Link:** ${url(p)}\n\n**Caption:**\n\n${p.title}${p.style_name ? ` – ${p.style_name}` : ""} ✨\n${firstLine(p)}\n\n• ${[p.fabric, ...(p.print_work || [])].filter(Boolean).join(" · ")}\n• Sizes ${sizes(p)} + free custom fit\n• Handmade in our Jaipur unit (Sanganer)\n• ${money(p)}${p.ships_abroad ? " · free shipping to the USA, UK, Canada, UAE & Australia" : ""}\n\nTap the link in bio or DM "${(p.style_name || "SIZE").toUpperCase()}" for your size 💬\n\n${tagsFor(p)}\n\n**Alt text (Instagram → Advanced settings → Accessibility):** ${alt(p)}\n\n**Searchable words to keep in the first line** (real Google searches): ${q.length ? q.join(" · ") : "–"}\n\n---\n\n`; }
fs.writeFileSync(path.join(OUT, "instagram-facebook.md"), ig);

// Pinterest
let pin = head("Pinterest pins (title ≤ 100 characters, description ≤ 500)");
for (const p of pick) { const q = realQ(fam(p), p); const t = `${p.title}${p.style_name ? " – " + p.style_name : ""} | Handmade in Jaipur`.slice(0, 100);
  const d = `${firstLine(p)} ${[p.fabric, ...(p.print_work || [])].filter(Boolean).join(", ")}. Sizes ${sizes(p)} or free custom fit. ${p.ships_abroad ? "Free shipping to the USA, UK, Canada, UAE and Australia. " : ""}${q.length ? "Ideas for: " + q.slice(0, 3).join(", ") + "." : ""}`.slice(0, 500);
  pin += `## ${p.style_name || p.title}\n\n- **Board:** ${/Anarkali/i.test(p.category) ? "Anarkali Suits & Wedding Guest Outfits" : /Dress/i.test(p.category) ? "Summer & Linen Dresses" : /Tunic|Kurti/i.test(p.category) ? "Kurtis & Tunics for Jeans" : "Jaipur Block Print Kurta Sets"}\n- **Pin title:** ${t}\n- **Description:** ${d}\n- **Link:** ${url(p)}\n- **Image:** ${SITE}${p.images[0]} (vertical 2:3 – already this size)\n- **Alt text:** ${alt(p)}\n\n`; }
fs.writeFileSync(path.join(OUT, "pinterest.md"), pin);

// YouTube (Shorts for products with a video, otherwise a slideshow idea)
let yt = head("YouTube titles, descriptions and tags");
for (const p of pick) { const q = realQ(fam(p), p);
  yt += `## ${p.style_name || p.title}\n\n- **Video:** ${p.video ? SITE + encodeURI(p.video) + " (reel already shot – upload as a Short)" : "no reel yet – a 15-second photo slideshow of the product photos works as a Short"}\n- **Title (≤ 70):** ${`${p.title.split(" with ")[0]} – Handmade in Jaipur #shorts`.slice(0, 70)}\n- **Description:**\n\n  ${firstLine(p)}\n  ${[p.fabric, ...(p.print_work || [])].filter(Boolean).join(" · ")} · sizes ${sizes(p)} + free custom fit · made in our Jaipur unit.\n  Shop: ${url(p)}\n  ${q.length ? "Searches this answers: " + q.slice(0, 3).join(" · ") : ""}\n\n- **Tags:** ${["Bahe Kurtiz", p.category, p.fabric, ...(p.print_work || []), "Jaipur", "Indian ethnic wear", ...q.slice(0, 4)].filter(Boolean).join(", ")}\n\n`; }
// long-form product walkthrough (60–90 s) – YouTube chapters need 3+ timestamps, the first at 0:00, each at least 10 s
yt += `## Chapters for a 60–90 second walkthrough video (any product above)\n\nPaste at the end of the description (YouTube turns them into chapters):\n\n\`\`\`\n0:00 The full look\n0:10 Fabric & craft close-up\n0:25 Neckline, sleeves & details\n0:40 Fit, sizes & free custom fit\n0:50 How to style it\n1:00 Where to buy (link in description)\n\`\`\`\n\nWeekly guide video idea (the most-searched guide topic right now, from Search Console): **${(KM.map.find((x) => x.intent === "guide" && x.impressions) || {}).name || "Indian wedding guest outfits"}** – film 3 of this week's pieces, title it with the exact search words, and use chapters: 0:00 Quick answer · 0:20 Look 1 · 0:45 Look 2 · 1:10 Look 3 · 1:35 What to avoid · 1:50 Sizes & ordering.\n`;
fs.writeFileSync(path.join(OUT, "youtube.md"), yt);

// TikTok – TikTok search reads the caption, the on-screen text and what is said in the video
const TT = path.join(ROOT, "drafts/social-seo/tiktok"); fs.mkdirSync(TT, { recursive: true });
let tt = head("TikTok captions, on-screen text and hashtags"); const USED = new Set();
tt += `**Profile (once):** name **Bahe Kurtiz | Jaipur Kurta Sets** · bio (80 characters): "Handmade kurta sets & Anarkalis from Jaipur 🌸 XS–3XL · custom fit · ships worldwide" · link ${SITE}/\n\nTikTok search tips: say the search words out loud in the first 3 seconds, put them in the on-screen text and the first line of the caption; 3–5 hashtags are enough.\n\n`;
for (const p of pick) { const q = realQ(fam(p), p); const clean = q.filter((x) => !/^(is|are|how|what|which|can|does|do|why|should)\b/.test(x) && x.split(" ").length <= 6); const kw = clean.find((x) => !USED.has(x)) || clean[0] || `${p.category} from Jaipur`.toLowerCase(); USED.add(kw);
  const tags = tagsFor(p).split(" ").filter((t) => !/#DailyOutfit|#IndianWear|#DesiFashion/.test(t)).slice(0, 5).join(" ");
  tt += `## ${p.style_name || p.title}\n\n- **Video:** ${p.video ? SITE + encodeURI(p.video) + " (reel already shot)" : "film a 10–15 s spin + fabric close-up"}\n- **Say in the first 3 seconds:** "${kw.charAt(0).toUpperCase() + kw.slice(1)} – this one is handmade in Jaipur."\n- **On-screen text:** 1) ${kw} · 2) ${[p.fabric, ...(p.print_work || [])].filter(Boolean).slice(0, 2).join(" + ")} · 3) Sizes ${sizes(p)} + custom fit\n- **Caption:** ${kw} ✨ ${p.title}${p.style_name ? " – " + p.style_name : ""}, made in our Jaipur unit. ${money(p)}. Link in bio 💬\n- **Hashtags:** ${tags}\n- **Search words to reuse:** ${q.length ? q.join(" · ") : "–"}\n\n`; }
fs.writeFileSync(path.join(TT, `${WEEK}.md`), tt);

// Profiles (same every week unless the keyword map changes)
const topQ = KM.map.filter((x) => x.impressions && x.intent !== "brand").slice(0, 6).map((x) => x.name);
const addr = "Sanganer, Jaipur";
let pr = head("Profile names and bios (Instagram, Facebook, Pinterest, YouTube, TikTok)");
pr += `Use the same name, city and link everywhere (Google and AI assistants match them).\n\n- **Name field (Instagram/Pinterest – searchable):** Bahe Kurtiz | Kurta Sets & Anarkalis Jaipur\n- **Username:** @bahekurtiz (keep)\n- **Instagram bio (150 characters):** Handmade kurta sets, Anarkalis & linen dresses from our Jaipur unit 🌸 XS–3XL + free custom fit · Ships worldwide ✈️\n- **Link:** ${SITE}/\n- **Category:** Clothing (Brand)\n- **Facebook "About":** Bahe Kurtiz makes women's Indian ethnic wear – hand block print kurta sets, Anarkali suits, co-ords and linen dresses – in our own unit in ${addr}. Sizes XS–3XL or free custom fit. WhatsApp ${S.whatsapp ? "+" + String(S.whatsapp).replace(/\D/g, "") : "+91 70733 50886"}. ${SITE}/\n- **Pinterest profile name:** Bahe Kurtiz – Jaipur Kurta Sets, Anarkalis & Block Print · **About:** Handmade Indian outfits from Jaipur: block print kurta sets, Anarkali suits for weddings, linen dresses. Free custom fit, worldwide shipping.\n- **YouTube channel description (first line matters):** Handmade Indian ethnic wear from Jaipur – kurta sets, Anarkali suits and linen dresses, made in our own Sanganer unit. Styling, fabric and wedding-guest guides.\n- **TikTok:** name Bahe Kurtiz | Jaipur Kurta Sets · bio: Handmade kurta sets & Anarkalis from Jaipur 🌸 XS–3XL · custom fit · ships worldwide\n- **Instagram Highlights (names people search):** Anarkalis · Kurta Sets · Linen Dresses · Reviews · Custom Fit · Shipping\n\nTopics people search most (Search Console, keyword map): ${topQ.join(" · ")}\n`;
fs.writeFileSync(path.join(OUT, "profiles.md"), pr);
fs.writeFileSync(path.join(OUT, "README.md"), `# Social SEO drafts – week ${WEEK}\n\nMade by \`node scripts/social-seo.mjs\` (weekly routine). 7 products this week: ${pick.map((p) => p.style_name || p.title).join(", ")}.\n\n- instagram-facebook.md – caption, hashtags, alt text, searchable first line\n- pinterest.md – pin title, description, board, alt text\n- youtube.md – Shorts title, description, tags, chapters for a walkthrough video + one guide-video idea\n- ../tiktok/${WEEK}.md – TikTok caption, on-screen text, words to say, hashtags, profile bio\n- profiles.md – name / bio / about with real keywords (update once, then only when it changes)\n\nNothing is posted automatically. Post 3–4 a week; put the keyword words in the first line; always add the alt text.\n`);
console.log(`social-seo: ${WEEK} – ${pick.length} products → ${path.relative(ROOT, OUT)}`);
