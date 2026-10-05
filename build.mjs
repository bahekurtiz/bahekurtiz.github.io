// Bahe Kurtiz website builder — zero dependencies (Node 18+).
// Reads content/*.json and writes the finished site to _site/.
// Hosting: Cloudflare Pages (build command: node build.mjs, output: _site).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, "_site");
const S = JSON.parse(fs.readFileSync(path.join(ROOT, "content/settings.json"), "utf8"));

// ---------- site url / base ----------
const BASE = "/";
const SITE_URL = ((S.site_url || process.env.CF_PAGES_URL || "http://localhost:8080") + "").trim().replace(/\/$/, "");
const u = (p = "") => (!p ? BASE : /^(https?:)?\/\//.test(p) || p.startsWith("data:") ? p : BASE + String(p).replace(/^\//, ""));
const abs = (p) => (/^https?:/.test(p) ? p : SITE_URL + "/" + String(p).replace(/^\//, ""));

// ---------- helpers ----------
const esc = (s = "") => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const paras = (t = "") => String(t || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
const clip = (t, n = 155) => { t = String(t || "").replace(/\s+/g, " ").trim(); if (t.length <= n) return t; const c = t.slice(0, n - 1); return c.slice(0, Math.max(c.lastIndexOf(" "), 60)).replace(/[\s,;:–-]+$/, "") + "…"; };
const slugify = (s) => String(s).toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-");
const num = (v) => (v === "" || v === null || v === undefined || isNaN(Number(v)) ? null : Number(v));
const inr = (n) => (num(n) === null ? "" : "₹" + Number(n).toLocaleString("en-IN"));
const digits = (s) => String(s || "").replace(/\D/g, "");
const plural = (c) => (/(ss|sh|ch|x)$/i.test(c) ? c + "es" : /s$/i.test(c) ? c : c + "s");
const brand = S.brand_name || "Bahe Kurtiz";
// logo from admin (Settings → Logo); falls back to the text logo
// logo / favicon / hero: admin settings first, else the default files in static/images/site/
const siteFile = (f) => (fs.existsSync(path.join(ROOT, "static/images/site", f)) ? "/images/site/" + f : "");
const logoImg = String(S.logo || "").trim() || siteFile("logo.png");
const favImg = String(S.favicon || "").trim() || siteFile("favicon.png");
if (!String(S.hero_image || "").trim() && siteFile("hero-teal.jpg")) S.hero_image = "/images/site/hero-teal.jpg";
const logoMark = () => (logoImg ? `<img class="logo-img" src="${esc(u(logoImg))}" alt="${esc(brand)}" width="300" height="100">` : `${esc(brand)}<small>JAIPUR</small>`);
const waNumber = (() => { let d = digits(S.whatsapp); if (d.length === 10) d = "91" + d; return d; })();
const waLink = (msg) => (waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}` : "");
const usdRate = num(S.usd_rate);
const ASSET_V = ["assets/style.css", "assets/app.js"].map((f) => { try { return fs.readFileSync(path.join(ROOT, "static", f), "utf8"); } catch { return ""; } }).join("").split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(36);
const today = new Date().toISOString().slice(0, 10);
const year = new Date().getFullYear();

// sizes always shown in order: XS, S, M, L, XL, XXL, 3XL… (numbers like 28, 30 sort by value; Free Size last)
const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "XXXL", "3XL", "4XL", "5XL", "6XL", "7XL", "8XL"];
const sizeRank = (x) => { const k = String(x).toUpperCase().replace(/\s+/g, ""); const alias = { "2XL": "XXL", XXXL: "3XL" }[k] || k; const i = SIZE_ORDER.indexOf(alias); if (i >= 0) return i * 10; const n = parseFloat(k); if (!isNaN(n)) return 200 + n; if (/FREE/.test(k)) return 900; return 500; };
// ---------- products ----------
const prodDir = path.join(ROOT, "content/products");
const products = fs.readdirSync(prodDir).filter((f) => f.endsWith(".json")).map((f) => {
  const p = JSON.parse(fs.readFileSync(path.join(prodDir, f), "utf8"));
  p.slug = slugify(f.replace(/\.json$/, "")).replace(/^-+|-+$/g, "") || "item-" + [...f].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(36);
  p.images = (p.images || []).map((x) => (typeof x === "string" ? x : x?.image)).filter(Boolean);
  p.sizes = [...new Set((p.sizes || []).filter(Boolean).map((x) => String(x).trim()))].sort((a, b) => sizeRank(a) - sizeRank(b));
  p.video = String(p.video || "").trim();
  p.category = (p.category || "Kurti").trim();
  p.catSlug = slugify(plural(p.category));
  p.url = `products/${p.slug}/`;
  p.price = num(p.price); p.mrp = num(p.mrp);
  p.in_stock = p.in_stock !== false;
  // International selling price is merchant-defined and never derived from the India price.
  p.price_usd = num(p.price_usd); // 2050: international selling price must be explicit, never derived from INR
  p.mrp_usd = num(p.mrp_usd); // 2050: explicit international MRP only
  p.market_prices = (() => {
    const raw = p.market_prices;
    if (Array.isArray(raw)) return Object.fromEntries(raw.map((r) => {
      const c = String(r?.country || "").trim().toUpperCase();
      if (!/^[A-Z]{2}$/.test(c)) return null;
      return [c, { currency: String(r?.currency || "USD").trim().toUpperCase(), price: num(r?.price), mrp: num(r?.mrp) }];
    }).filter(Boolean));
    return (raw && typeof raw === "object") ? raw : {};
  })(); // explicit per-country selling prices; never derived from INR
  p.i18n = (p.i18n && typeof p.i18n === "object") ? p.i18n : {};
  p.ships_abroad = p.ships_abroad !== false;
  p.bestseller = p.bestseller === true;
  p.sold_out = (Array.isArray(p.sold_out_sizes) ? p.sold_out_sizes : []).map((x) => String(x).trim()).filter(Boolean);
  p.occasion = (Array.isArray(p.occasion) ? p.occasion : p.occasion ? [p.occasion] : []).map((x) => String(x).trim()).filter(Boolean);
  p.intl = p.ships_abroad && p.price_usd !== null;
  p.fabric = String(p.fabric || "").trim();
  p.print_work = (Array.isArray(p.print_work) ? p.print_work : p.print_work ? [p.print_work] : []).map((x) => String(x).trim()).filter(Boolean);
  p.match = (Array.isArray(p.match_products) ? p.match_products : []).map((x) => slugify(String(x || ""))).filter(Boolean);
  return p;
}).filter((p) => p.title && p.draft !== true)
  .sort((a, b) => (num(a.sort_order) ?? 999) - (num(b.sort_order) ?? 999) || a.title.localeCompare(b.title));
const intlOn = S.international_enabled !== false; // 2050 worldwide storefront; product prices remain explicit
const usd = (n) => (num(n) === null ? "" : "$" + (Number(n) % 1 ? Number(n).toFixed(2) : String(Number(n))));
const offUsd = (p) => (p.price_usd && p.mrp_usd && p.mrp_usd > p.price_usd ? Math.round((1 - p.price_usd / p.mrp_usd) * 100) : 0);
const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort((a, b) => a.localeCompare(b));
const fabrics = uniq(products.map((p) => p.fabric).filter((f) => f && f !== "Other"));
const prints = uniq(products.flatMap((p) => p.print_work));
// ---------- Fabric & print guide data (built-in; grows with the admin lists) ----------
const CRAFT = {
  print: {
    "Hand Block Print": ["Rajasthan", "Wooden blocks are hand-carved, dipped in colour and pressed onto the fabric one by one. Small shifts in each print show it was made by hand.", "Gentle hand wash in cold water, dry in shade."],
    "Sanganeri Print": ["Sanganer, Jaipur", "Fine floral and paisley motifs printed by hand on a light or white base. Sanganeri printing as a craft is GI-registered.", "Cold hand wash, dry inside-out in shade."],
    "Bagru Print": ["Bagru, near Jaipur", "Earthy reds, blacks and browns from natural dyes, printed with wooden blocks by the Chhipa community. Bagru printing as a craft is GI-registered.", "Wash separately in cold water the first few times."],
    "Dabu Print": ["Rajasthan", "A mud-resist print: a paste of clay, gum and lime is blocked onto cloth before dyeing, leaving soft, crackled patterns.", "Cold hand wash, mild soap, dry in shade."],
    "Ajrakh Print": ["Kutch (Gujarat) and Barmer (Rajasthan)", "Deep indigo and madder-red geometric prints made through many rounds of resist printing and natural dyeing.", "Wash separately in cold water; colour softens beautifully over time."],
    "Indigo Print": ["Rajasthan & Gujarat", "Patterns printed or resisted on fabric dyed in indigo blue, one of the oldest natural dyes.", "Wash separately, cold water, dry in shade."],
    "Kalamkari": ["Andhra Pradesh", "'Kalam' means pen: motifs are hand-drawn or block printed with natural dyes, often telling stories from nature and mythology.", "Cold hand wash, avoid strong detergent."],
    "Bagh Print": ["Bagh, Madhya Pradesh", "Red and black geometric and floral block prints on a white base, made with natural dyes.", "Cold hand wash, dry in shade."],
    "Jaipuri Print": ["Jaipur", "The classic Jaipur look: bright florals, buttis and borders, hand block or screen printed.", "Cold wash, dry in shade."],
    "Mughal Print": ["Rajasthan", "Motifs inspired by Mughal art: flowering plants, vines and arches in fine detail.", "Cold hand wash."],
    "Indigo Dabu": ["Rajasthan", "Dabu mud-resist combined with indigo dyeing for blue-and-white crackle patterns.", "Wash separately in cold water."],
    "Bandhani": ["Rajasthan & Gujarat", "Tie-dye art: tiny points of cloth are tied tightly with thread before dyeing, creating dotted patterns.", "Dry clean first wash, then gentle cold hand wash."],
    "Leheriya": ["Rajasthan", "'Lehar' means wave: cloth is rolled and tied diagonally before dyeing to make wave-like stripes. Loved for Teej and monsoon.", "Cold hand wash, dry in shade."],
    "Shibori / Tie-Dye": ["Japan-inspired, made in India", "Fabric is folded, twisted or bound before dyeing for soft, unique patterns.", "Wash separately in cold water."],
    "Batik": ["India & Indonesia", "Wax is applied on cloth before dyeing; the wax resists colour and creates fine crackle lines.", "Cold hand wash."],
    "Ikat": ["Odisha, Telangana, Gujarat", "Threads are tie-dyed before weaving, so the pattern appears with a soft, feathered edge.", "Gentle hand wash or dry clean."],
    "Madhubani Print": ["Bihar", "Folk-art motifs of nature and festivals inspired by Madhubani painting.", "Cold hand wash."],
    "Pichwai Print": ["Nathdwara, Rajasthan", "Lotus, cows and temple motifs inspired by Pichwai painting.", "Cold hand wash."],
    "Screen Print": ["India", "Colour is pushed through a fine mesh screen; crisp, even prints at an easy price.", "Machine wash gentle, cold."],
    "Digital Print": ["India", "Designs printed directly by machine, allowing rich detail and many colours.", "Gentle cold wash, dry in shade."],
    "Floral Print": ["", "Flower motifs in any technique – the most loved print family for kurtis.", "Follow the care of the fabric."],
    "All Over Print": ["", "The print covers the whole garment evenly.", "Follow the care of the fabric."],
    "Foil Print": ["India", "Metallic foil pressed onto the fabric for a festive shine.", "Hand wash inside-out, do not iron on the foil."],
    "Hand Painted": ["India", "Each motif is painted by hand with a brush – no two pieces are the same.", "Dry clean or gentle cold hand wash."],
    "Gota Patti": ["Rajasthan", "Gold or silver ribbon (gota) cut into shapes and hand-stitched onto fabric – a Rajasthani festive classic.", "Dry clean recommended."],
    "Embroidered": ["India", "Thread work added by hand or machine for texture and detail.", "Gentle hand wash inside-out or dry clean."],
    "Thread Work": ["India", "Colourful thread embroidery on necklines, sleeves or all over.", "Gentle hand wash inside-out."],
    "Chikankari": ["Lucknow", "Delicate white-on-white hand embroidery from Lucknow; the craft is GI-registered.", "Gentle hand wash or dry clean."],
    "Zari Work": ["India", "Metallic gold or silver thread embroidery for festive wear.", "Dry clean."],
    "Mirror Work": ["Rajasthan & Gujarat", "Small mirrors stitched into embroidery that catch the light.", "Dry clean or very gentle hand wash."],
    "Sequin Work": ["India", "Sequins stitched on for sparkle at parties and weddings.", "Dry clean."],
    "Kantha": ["West Bengal", "Running-stitch embroidery that forms soft, rippled patterns.", "Gentle hand wash."],
    "Phulkari": ["Punjab", "Bright floral embroidery in silk thread – 'phul' means flower.", "Dry clean."],
    "Kutch Work": ["Kutch, Gujarat", "Dense, colourful embroidery often with mirrors, from the Kutch region.", "Dry clean."],
    "Pintuck": ["", "Fine stitched folds that add texture without extra embellishment.", "Follow the care of the fabric."],
    "Lace Work": ["", "Lace trims or panels on hems, sleeves and yokes.", "Gentle hand wash."],
    "Solid / Plain": ["", "A single colour, no print – easy to style with printed dupattas and bottoms.", "Follow the care of the fabric."],
  },
  fabric: {
    "Cotton": ["Natural", "Soft, breathable and skin-friendly – the best everyday fabric for Indian summers.", "Cold wash; may shrink slightly on the first wash."],
    "Pure Cotton": ["Natural", "100% cotton: breathable, absorbent and comfortable all day.", "Cold wash, dry in shade."],
    "Cambric Cotton": ["Natural", "Fine, tightly woven, smooth cotton that holds block prints crisply.", "Cold wash, iron medium."],
    "Mul Cotton (Mulmul)": ["Natural", "Very light, airy and soft cotton – feels like a breeze in summer.", "Gentle hand wash, dry in shade."],
    "Cotton Slub": ["Natural", "Cotton with small natural thicker threads (slubs) for a textured, handloom feel.", "Cold wash."],
    "Cotton Flex": ["Blend", "Cotton with a little stretch for an easy fit.", "Cold wash."],
    "Cotton Blend": ["Blend", "Cotton mixed with another fibre for less wrinkling and more strength.", "Cold wash."],
    "Cotton Silk": ["Blend", "Cotton's comfort with a soft silk sheen – good for festive daywear.", "Gentle hand wash or dry clean."],
    "Cotton Linen": ["Blend", "Breathable, textured and cool – a relaxed, premium look.", "Cold wash, iron while damp."],
    "Voile": ["Natural", "Light, semi-sheer cotton that drapes softly.", "Gentle hand wash."],
    "Poplin": ["Natural", "Smooth, crisp cotton weave that keeps its shape.", "Machine wash cold."],
    "Linen": ["Natural", "Made from flax: very breathable, gets softer with every wash.", "Cold wash, iron while damp."],
    "Khadi": ["Natural, handspun", "Hand-spun and hand-woven fabric – breathable and full of character.", "Gentle hand wash."],
    "Rayon": ["Semi-natural", "Made from wood pulp: smooth, flowy and cool on the skin.", "Gentle cold hand wash; do not wring."],
    "Rayon Slub": ["Semi-natural", "Rayon with a textured slub weave and lovely drape.", "Gentle cold hand wash."],
    "Viscose": ["Semi-natural", "Silky, soft and flowy – drapes beautifully in long kurtis and dresses.", "Gentle cold hand wash or dry clean."],
    "Modal": ["Semi-natural", "Very soft, breathable and resistant to shrinking.", "Gentle cold wash."],
    "Modal Silk": ["Blend", "Modal with a silk-like sheen – light and festive.", "Dry clean recommended."],
    "Muslin": ["Natural / blend", "Soft, finely woven fabric with a gentle sheen.", "Gentle hand wash."],
    "Chanderi": ["Chanderi, Madhya Pradesh", "Light, sheer handloom fabric with a soft shine. Chanderi weaving is GI-registered.", "Dry clean recommended."],
    "Chanderi Silk": ["Chanderi, Madhya Pradesh", "Chanderi woven with silk for a richer sheen – perfect for festivals.", "Dry clean."],
    "Maheshwari": ["Maheshwar, Madhya Pradesh", "Light handloom cotton-silk with a reversible border; the weave is GI-registered.", "Dry clean."],
    "Kota Doria": ["Kota, Rajasthan", "Airy, chequered weave (khats) from Kota – light and elegant; the weave is GI-registered.", "Gentle hand wash or dry clean."],
    "Banarasi": ["Varanasi", "Rich woven fabric often with zari motifs – a wedding favourite.", "Dry clean only."],
    "Jacquard": ["", "Pattern is woven into the fabric itself, not printed.", "Gentle hand wash or dry clean."],
    "Art Silk": ["Synthetic", "Silk-like look and shine at an easy price.", "Gentle hand wash or dry clean."],
    "Silk Blend": ["Blend", "Silk mixed with another fibre for sheen and strength.", "Dry clean."],
    "Tussar Silk": ["Jharkhand, Bihar, Odisha", "Wild silk with a natural gold tone and rich texture.", "Dry clean."],
    "Dola Silk": ["Blend", "Soft, light silk-like fabric that takes prints and embroidery well.", "Dry clean."],
    "Russian Silk": ["Synthetic", "Smooth and shiny with good fall.", "Gentle hand wash or dry clean."],
    "Roman Silk": ["Synthetic", "Soft, slightly stretchy silk-look fabric.", "Gentle hand wash."],
    "Georgette": ["Synthetic / silk", "Light, flowy and slightly crinkled – great for anarkalis and gowns.", "Gentle hand wash or dry clean."],
    "Faux Georgette": ["Synthetic", "Georgette look and flow, easy care.", "Gentle hand wash."],
    "Chiffon": ["Synthetic / silk", "Sheer, very light and floaty.", "Gentle hand wash or dry clean."],
    "Crepe": ["Synthetic / blend", "Fine crinkled texture that resists wrinkles – good for travel and office.", "Gentle hand wash."],
    "Satin": ["Synthetic / silk", "Glossy, smooth face with luxurious drape.", "Dry clean recommended."],
    "Organza": ["Synthetic / silk", "Crisp, sheer and structured – often used for dupattas and overlays.", "Dry clean."],
    "Tissue": ["", "Fabric woven with metallic threads for a glowing festive look.", "Dry clean."],
    "Net": ["Synthetic", "Open mesh fabric used for dupattas and party wear.", "Dry clean."],
    "Hakoba / Schiffli": ["", "Fabric with cut-work eyelet embroidery – light and pretty for summer.", "Gentle hand wash."],
    "Velvet": ["", "Soft, plush pile – rich and warm for winter weddings.", "Dry clean only."],
    "Denim": ["Cotton", "Sturdy twill cotton for casual tunics and dresses.", "Machine wash cold, inside-out."],
    "Wool": ["Natural", "Warm natural fibre for winter kurtis.", "Dry clean or wool wash."],
    "Bamboo": ["Semi-natural", "Very soft, breathable and kind to the skin.", "Gentle cold wash."],
    "Tencel": ["Semi-natural", "Smooth, breathable fibre made from wood pulp in a closed-loop process.", "Gentle cold wash."],
    "Polyester": ["Synthetic", "Strong, wrinkle-resistant and quick to dry.", "Machine wash cold."],
    "Lycra": ["Synthetic", "Stretch fibre, usually blended for comfort fit.", "Cold wash, no high heat."],
  },
};

const craftCount = (type, n) => products.filter((p) => (type === "fabric" ? p.fabric === n : p.print_work.includes(n))).length;
const craftUrl = (n) => `craft/${slugify(n)}/`;
const craftInfo = (type, n) => CRAFT[type][n] || null;
const craftLink = (type, n) => craftCount(type, n) ? `<a href="${u(craftUrl(n))}">${esc(n)}</a>` : esc(n);
const occasions = uniq(products.flatMap((p) => p.occasion));
const addDays = (iso, d) => { const t = new Date(iso + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() - d); return t.toISOString().slice(0, 10); };
const nice = (iso) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
// default festive dates (Karwa Chauth 29 Oct 2026, Diwali 8 Nov 2026) until the owner sets their own list in admin
// default festival dates (New Delhi panchang; owner can override in admin → Settings → festivals)
const FEST_DEFAULT = [["Karwa Chauth", "2026-10-29"], ["Diwali", "2026-11-08"], ["Holi", "2027-03-22"], ["Eid al-Fitr", "2027-03-10"], ["Raksha Bandhan", "2027-08-17"], ["Navratri", "2027-09-30"], ["Karwa Chauth", "2027-10-18"], ["Diwali", "2027-10-29"]].map(([name, date]) => ({ name, date, link: "occasion/festive/" }));
const festAll = (Array.isArray(S.festivals) ? S.festivals : FEST_DEFAULT).map((f) => ({ name: String(f?.name || "").trim(), date: String(f?.date || "").slice(0, 10) })).filter((f) => f.name && f.date >= today);
const festNext = (Array.isArray(S.festivals) ? S.festivals : FEST_DEFAULT).map((f) => ({ name: String(f?.name || "").trim(), date: String(f?.date || "").slice(0, 10), link: (() => { const l = String(f?.link || "").trim(); const m = l.match(/^occasion\/([^/]+)\/?$/); return m && !occasions.some((o) => slugify(o) === m[1]) ? "shop/" : l; })() })).filter((f) => f.name && /^\d{4}-\d{2}-\d{2}$/.test(f.date))
  .map((f) => { const inDays = (num(S.dispatch_days) || 3) + (num(S.transit_days_max) || 7), usDays = (num(S.dispatch_days) || 3) + (num(S.intl_eta_max) || 12); const a = addDays(f.date, inDays), b = addDays(f.date, usDays); return { ...f, dateText: nice(f.date), order_by_in: a, order_by_intl: b, order_by_in_text: nice(a), order_by_intl_text: nice(b) }; })
  .filter((f) => f.order_by_in >= today).sort((a, b) => a.date.localeCompare(b.date))[0] || null;
// every country name (from the built-in Unicode list), for checkout and the wholesale form
const allCountries = (() => { try { const dn = new Intl.DisplayNames(["en"], { type: "region" }); const out = new Set(); for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) { const code = String.fromCharCode(a, b); let n; try { n = dn.of(code); } catch { continue; } if (n && n !== code && !/Unknown|Outlying|Pseudo|European Union|Eurozone|United Nations|world/i.test(n)) out.add(n); } return [...out].filter((n) => n !== "India").sort((x, y) => x.localeCompare(y)); } catch { return ["United States", "United Kingdom", "Canada", "Australia", "United Arab Emirates"]; } })();
// YouTube live shopping (admin toggle)
const ytId = (l) => (String(l || "").match(/(?:v=|youtu\.be\/|\/live\/|\/shorts\/|\/embed\/)([A-Za-z0-9_-]{11})/) || [])[1] || "";
const live = { on: S.live_on === true, url: String(S.live_url || "").trim(), title: String(S.live_title || "Live shopping from our Jaipur workshop").trim(), next: String(S.live_next || "").trim() };
live.id = ytId(live.url);
const liveNextText = (() => { if (!live.next) return ""; const d = new Date(live.next.length > 10 ? live.next : live.next + "T19:00:00+05:30"); if (isNaN(d)) return ""; return d.getTime() < Date.now() ? "" : d.toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) + " IST"; })();
const EUR = "DE FR IT ES NL BE IE AT PT FI GR LU SK SI EE LV LT MT CY HR".split(" ");
const CUR = { US: "USD", GB: "GBP", CA: "CAD", AU: "AUD", NZ: "NZD", AE: "AED", SA: "SAR", QA: "QAR", KW: "KWD", OM: "OMR", BH: "BHD", SG: "SGD", MY: "MYR", HK: "HKD", JP: "JPY", CN: "CNY", KR: "KRW", TH: "THB", ID: "IDR", PH: "PHP", VN: "VND", LK: "LKR", NP: "NPR", BD: "BDT", PK: "PKR", MV: "MVR", MU: "MUR", ZA: "ZAR", NG: "NGN", KE: "KES", GH: "GHS", TZ: "TZS", UG: "UGX", EG: "EGP", MA: "MAD", IL: "ILS", TR: "TRY", CH: "CHF", NO: "NOK", SE: "SEK", DK: "DKK", PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON", BR: "BRL", MX: "MXN", AR: "ARS", CL: "CLP", CO: "COP", PE: "PEN", FJ: "FJD", TT: "TTD", GY: "GYD", JM: "JMD" };
const countryList = (() => { try { const dn = new Intl.DisplayNames(["en"], { type: "region" }); const out = []; for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) { const c = String.fromCharCode(a, b); let n; try { n = dn.of(c); } catch { continue; } if (n && n !== c && !/Unknown|Outlying|Pseudo|European Union|Eurozone|United Nations|world/i.test(n)) out.push([c, n, c === "IN" ? "INR" : EUR.includes(c) ? "EUR" : CUR[c] || "USD"]); } return out.sort((x, y) => x[1].localeCompare(y[1])); } catch { return [["IN", "India", "INR"], ["US", "United States", "USD"], ["GB", "United Kingdom", "GBP"]]; } })();
// Instagram-style stories: admin "Stories" first, else made automatically from products/banners
const storyDir = path.join(ROOT, "content/stories");
const storiesData = (() => {
  const own = (fs.existsSync(storyDir) ? fs.readdirSync(storyDir) : []).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(storyDir, f), "utf8"))).filter((x) => x && x.active !== false && Array.isArray(x.slides) && x.slides.length && (!x.end || String(x.end).slice(0, 10) >= today))
    .sort((a, b) => (num(a.order) ?? 50) - (num(b.order) ?? 50)).map((x) => ({ t: String(x.title || "").slice(0, 18), c: x.cover || x.slides[0]?.image || "", s: x.slides.map((sl) => { const pr = products.find((p) => p.slug === slugify(String(sl.product || ""))); return { img: sl.image || "", vid: sl.video || "", cap: String(sl.caption || ""), link: sl.link || (pr ? pr.url : ""), shop: pr ? pr.title : (sl.button || "") }; }).filter((sl) => sl.img || sl.vid) })).filter((x) => x.s.length);
  if (own.length) return own;
  const auto = [];
  const mk = (t, list) => { const items = list.filter((p) => p.images[0]).slice(0, 6); if (items.length) auto.push({ t, c: items[0].images[0], s: items.map((p) => ({ img: p.images[0], vid: "", cap: `${p.title}${p.price !== null ? " · " + inr(p.price) : ""}`, link: p.url, shop: p.title })) }); };
  mk("New", products);
  mk("Bestsellers", products.filter((p) => p.bestseller));
  for (const o of occasions.slice(0, 3)) mk(o, products.filter((p) => p.occasion.includes(o)));
  mk("Videos", products.filter((p) => p.video).map((p) => p));
  return auto;
})();
const qs = (k, v) => `shop/?${k}=${encodeURIComponent(v)}`;
const categories = [...new Set(products.map((p) => p.category))].map((c) => ({ name: c, plural: plural(c), slug: slugify(plural(c)), url: `collections/${slugify(plural(c))}/`, items: products.filter((p) => p.category === c) }));
const offPct = (p) => (p.price && p.mrp && p.mrp > p.price ? Math.round((1 - p.price / p.mrp) * 100) : 0);

// ---------- icons ----------
const I = {
  bag: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  menu: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 7h18M3 12h18M3 17h18"/></svg>',
  close: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  wa: '<svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3zm0 23.6c-2 0-3.9-.5-5.6-1.5l-.4-.2-3.9 1 1-3.8-.2-.4A10.6 10.6 0 1 1 16 26.6zm5.8-7.9c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7 0a8.7 8.7 0 0 1-4.3-3.8c-.3-.6.3-.5.9-1.6.1-.2 0-.4 0-.5l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4s-1.1 1.1-1.1 2.7 1.2 3.1 1.3 3.3 2.3 3.5 5.5 4.9c2 .9 2.8.9 3.8.8.6-.1 1.9-.8 2.2-1.5s.3-1.4.2-1.5-.3-.2-.6-.3z"/></svg>',
  truck: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg>',
  shield: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6l8-3z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>',
  needle: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 20L19 5M16 4l4 4"/><path d="M7 13c-3 1-4 4-2 6"/></svg>',
  swap: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 8h14l-3-3M20 16H6l3 3"/></svg>',
  heart: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 20s-7.5-4.6-9.2-9.3C1.7 7.4 4 4.5 7.1 4.5c2 0 3.5 1.1 4.9 2.9 1.4-1.8 2.9-2.9 4.9-2.9 3.1 0 5.4 2.9 4.3 6.2C19.5 15.4 12 20 12 20z"/></svg>',
  globe: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
  ruler: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="2.5" y="8" width="19" height="8" rx="1.5"/><path d="M6.5 8v3M10 8v4M13.5 8v3M17 8v4"/></svg>',
  box: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5L12 12l9-4.5M12 12v9"/></svg>',
  tag: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 12l8.5-8.5H20V12l-8.5 8.5z"/><circle cx="15.5" cy="8" r="1.5"/></svg>',
  user: '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  mic: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  search: '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
  home: '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 11l9-7 9 7v9h-6v-6H9v6H3z"/></svg>',
  grid: '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/></svg>',
  play: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>',
};
const star = (n) => `<span class="stars" aria-label="${n} out of 5 stars">${"★".repeat(Math.max(0, Math.min(5, Math.round(n))))}${"☆".repeat(5 - Math.max(0, Math.min(5, Math.round(n))))}</span>`;

// ---------- structured data ----------
// social + marketplace links come from editable lists in admin (old single fields still work)
const linkList = (list, legacy) => {
  const out = (Array.isArray(list) ? list : []).map((x) => ({ name: String(x?.name || "").trim(), url: String(x?.url || "").trim() }));
  for (const [k, n] of legacy) if (S[k]) out.push({ name: n, url: S[k] });
  return out.filter((x) => x.name && /^https?:\/\//i.test(x.url));
};
const socials = linkList(S.social_links, [["instagram", "Instagram"], ["facebook", "Facebook"], ["youtube", "YouTube"], ["pinterest", "Pinterest"]]);
const markets = linkList(S.marketplace_links, [["myntra", "Myntra"], ["amazon", "Amazon"], ["flipkart", "Flipkart"], ["etsy", "Etsy"]]);
const sameAs = [...socials, ...markets].map((x) => x.url);
const socialIcon = (n) => {
  const k = n.toLowerCase();
  const d = k.includes("insta") ? '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/>'
    : k.includes("face") ? '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z"/>'
    : k.includes("linked") ? '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 10v7M7 7v.01M11 17v-4a2 2 0 0 1 4 0v4M11 10v7"/>'
    : k.includes("google") ? '<path d="M20 12.2c0-.6-.1-1.2-.2-1.7H12v3.3h4.5a4 4 0 0 1-1.7 2.6v2.1h2.7c1.6-1.5 2.5-3.6 2.5-6.3z"/><path d="M12 20.5c2.3 0 4.2-.8 5.5-2l-2.7-2.1a5 5 0 0 1-7.5-2.7H4.5v2.2A8.5 8.5 0 0 0 12 20.5z"/><path d="M7.3 13.7a5 5 0 0 1 0-3.4V8.1H4.5a8.5 8.5 0 0 0 0 7.8z"/><path d="M12 6.9c1.3 0 2.4.4 3.3 1.3l2.4-2.4A8.5 8.5 0 0 0 4.5 8.1l2.8 2.2A5 5 0 0 1 12 6.9z"/>'
    : k.includes("you") ? '<rect x="2.5" y="6" width="19" height="12" rx="4"/><path d="M10 9.5v5l4.5-2.5z" fill="currentColor"/>'
    : k.includes("pin") ? '<circle cx="12" cy="12" r="9"/><path d="M11 8.5c2.5-1 5 .5 4.5 3s-3 3-4 1.5M11.5 11l-2 8"/>'
    : '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>';
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
};

const orgLd = {
  "@context": "https://schema.org", "@type": "ClothingStore", "@id": SITE_URL + "/#store", name: brand, url: SITE_URL + "/",
  logo: abs(logoImg || favImg || "favicon.svg"), image: abs(S.hero_image || "images/site/hero.jpg"), description: S.tagline,
  address: { "@type": "PostalAddress", addressLocality: "Jaipur", addressRegion: "Rajasthan", addressCountry: "IN", streetAddress: S.address || undefined },
  telephone: waNumber ? "+" + waNumber : undefined, email: S.email || undefined, sameAs, priceRange: "₹₹", legalName: S.legal_name || undefined,
  hasMerchantReturnPolicy: num(S.return_days) ? { "@type": "MerchantReturnPolicy", applicableCountry: "IN", returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow", merchantReturnDays: num(S.return_days), returnMethod: "https://schema.org/ReturnByMail", url: SITE_URL + "/returns/" } : undefined,
};

// ---------- Google Analytics 4, Microsoft Clarity, Pinterest tag (IDs from admin settings) ----------
const ga4 = String(S.ga4_id || "").trim().match(/^G-[A-Z0-9]+$/i)?.[0] || "";
const clarity = String(S.clarity_id || "").trim().match(/^[a-z0-9]{6,14}$/i)?.[0] || "";
const pinTag = digits(S.pinterest_tag_id);
// analytics: tiny stubs now, real scripts after first tap/scroll (or 4s); never on /admin/; EU/UK consent mode
const trackHead = (ga4 || clarity || pinTag) ? `<script>(function(){if(location.pathname.indexOf("/admin/")>-1)return;var w=window,d=document,c=null;try{c=localStorage.getItem("bk_consent")}catch(e){}var eu=/^Europe\\//.test((Intl.DateTimeFormat().resolvedOptions().timeZone)||"");w.BKeu=eu;var deny=eu&&c!=="yes",g=deny?"denied":"granted",S=[];
w.dataLayer=w.dataLayer||[];w.gtag=function(){dataLayer.push(arguments)};gtag("consent","default",{ad_storage:g,ad_user_data:g,ad_personalization:g,analytics_storage:g});
${ga4 ? `gtag("js",new Date());gtag("config","${ga4}");S.push("https://www.googletagmanager.com/gtag/js?id=${ga4}");` : ""}
${pinTag ? `if(!deny){w.pintrk=function(){w.pintrk.queue.push(Array.prototype.slice.call(arguments))};w.pintrk.queue=[];w.pintrk.version="3.0";pintrk("load","${pinTag}");pintrk("page");S.push("https://s.pinimg.com/ct/core.js");}` : ""}
${clarity ? `if(!deny){w.clarity=w.clarity||function(){(w.clarity.q=w.clarity.q||[]).push(arguments)};S.push("https://www.clarity.ms/tag/${clarity}");}` : ""}
w.BKtags=S;})();</script>` : "";

const crumbLd = (list) => ({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [["Home", ""], ...list].map(([name, path_], i) => ({ "@type": "ListItem", position: i + 1, name, item: SITE_URL + "/" + path_ })) });
// ---------- Meta Pixel (ID from admin settings) ----------
const pixelId = digits(S.meta_pixel_id);
const pixelHead = `<script>(function(){var w=window;if(location.pathname.indexOf("/admin/")>-1)return;var S=w.BKtags||[];${pixelId ? `!function(f){if(f.fbq)return;var n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version="2.0";n.queue=[]}(w);var c=null;try{c=localStorage.getItem("bk_consent")}catch(e){}if(w.BKeu&&c!=="yes")fbq("consent","revoke");fbq("init","${pixelId}");fbq("track","PageView");S.push("https://connect.facebook.net/en_US/fbevents.js");` : ""}if(!S.length)return;var L=function(){if(L.d)return;L.d=1;S.forEach(function(s){var t=document.createElement("script");t.async=1;t.src=s;document.head.appendChild(t)})};["pointerdown","keydown","scroll","touchstart"].forEach(function(e){addEventListener(e,L,{once:true,passive:true})});setTimeout(L,4000)})();</script>`;
const pixelBody = pixelId ? `<noscript><img height="1" width="1" style="display:none" alt="" src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"></noscript>` : "";

// ---------- Shoppable reels (Instagram-style videos, each can be linked to a product) ----------
const igCode = (l) => (String(l || "").match(/instagram\.com\/(?:[^/]+\/)?(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i) || [])[1] || "";
const reels = (Array.isArray(S.reels) ? S.reels : []).map((r) => ({ link: String(r?.link || "").trim(), video: String(r?.video || "").trim(), cover: String(r?.cover || "").trim(), caption: String(r?.caption || "").trim(), creator: String(r?.creator || "").trim().replace(/^@?/, "@").replace(/^@$/, ""), creator_link: String(r?.creator_link || "").trim(), product: slugify(String(r?.product || "")) }))
  .map((r) => ({ ...r, ig: !r.video && !r.cover && igCode(r.link) ? `https://www.instagram.com/reel/${igCode(r.link)}/embed/` : "" }))
  .filter((r) => r.video || r.cover || r.ig);
const ytChan = socials.find((x) => /you/i.test(x.name))?.url || "";
const igLink = socials.find((x) => /insta/i.test(x.name))?.url || "";
const igHandle = (igLink.match(/instagram\.com\/([^/?#]+)/i) || [])[1] || "";
const reelData = () => reels.map((r) => { const p = products.find((x) => x.slug === r.product); return { video: r.video ? u(r.video) : "", cover: r.cover ? u(r.cover) : "", ig: r.ig, link: r.link, caption: r.caption, product: p ? { slug: p.slug, title: p.title, url: u(p.url), image: u(p.images[0] || ""), price: priceHtml(p) } : null }; });
const reelItem = (r, i, noShop = false) => {
      const fb = /facebook\.com|fb\.watch/i.test(r.link);
      const p = products.find((x) => x.slug === r.product);
      const igPoster = r.ig ? (r.cover ? u(r.cover) : p?.images[0] ? u(p.images[0]) : "") : "";
      const media = r.ig ? (igPoster ? `<img src="${esc(igPoster)}" alt="${esc(r.caption || brand + " reel")}" loading="lazy" decoding="async">` : `<span class="reel-ig-ph"></span>`) : r.video
        ? `<video src="${esc(u(r.video))}"${r.cover ? ` poster="${esc(u(r.cover))}"` : ""} muted loop playsinline preload="none" data-reel aria-hidden="true"></video>`
        : `<img src="${esc(u(r.cover))}" alt="${esc(r.caption || brand + " reel")}" width="540" height="960" loading="lazy" decoding="async">`;
      const inner = `${media}<span class="reel-play" aria-hidden="true">${I.play}</span>${r.creator ? `<span class="reel-by">Styled by ${esc(r.creator)}</span>` : ""}${r.caption ? `<span class="reel-cap">${esc(r.caption)}</span>` : ""}${r.link ? `<span class="reel-src">${socialIcon(fb ? "facebook" : "instagram")}</span>` : ""}`;
      const box = r.ig ? `<button class="reel reel-igf" type="button" data-ig="${esc(r.ig)}" aria-label="Play Instagram reel${r.caption ? ": " + esc(r.caption) : ""}">${inner}</button>` : r.video || p ? `<button class="reel" type="button" data-reel-open="${i}" aria-label="Play reel${r.caption ? ": " + esc(r.caption) : ""}">${inner}</button>`
        : r.link ? `<a class="reel" href="${esc(r.link)}" target="_blank" rel="noopener" aria-label="${esc(r.caption || "Watch reel")} on ${fb ? "Facebook" : "Instagram"}">${inner}</a>` : `<div class="reel">${inner}</div>`;
      const shop = p && !noShop ? `<a class="reel-prod" href="${u(p.url)}"><img src="${esc(u(p.images[0] || ""))}" alt="" width="60" height="90" loading="lazy"><span><em>${esc(p.title)}</em><span class="card-price">${priceHtml(p)}</span></span><b>Shop</b></a>` : "";
      return `<div class="reel-item">${box}${shop}</div>`;
};
const reelsHtml = () => !reels.length ? "" : `<section class="reels" aria-label="Shoppable reels">
  <div class="wrap">
    <div class="section-head"><div><p class="eyebrow">${esc(S.reels_eyebrow || "Watch & shop")}</p><h2>${esc(S.reels_title || "Watch & Shop")}</h2></div>${igLink ? `<a class="link" href="${esc(igLink)}" target="_blank" rel="noopener">${igHandle ? "@" + esc(igHandle) : "Follow us"} →</a>` : ""}</div>
    <div class="reel-row">${reels.map((r, i) => reelItem(r, i)).join("")}</div>
  </div>
</section>`;

const landDir = path.join(ROOT, "content/landing");
const landings = (fs.existsSync(landDir) ? fs.readdirSync(landDir) : []).filter((f) => f.endsWith(".json")).map((f) => {
  const l = JSON.parse(fs.readFileSync(path.join(landDir, f), "utf8"));
  l.slug = slugify(l.slug || f.replace(/\.json$/, "")).replace(/^-+|-+$/g, "");
  l.url = l.slug + "/";
  l.faq = (Array.isArray(l.faq) ? l.faq : []).map((x) => ({ q: String(x?.q || "").trim(), a: String(x?.a || "").trim() })).filter((x) => x.q && x.a);
  return l;
}).filter((l) => l.slug && l.h1 && l.draft !== true && !["shop", "blog", "products", "collections", "wholesale", "admin", "api", "checkout"].includes(l.slug));
// ---------- layout ----------
const annItems = String(S.announcement || "").split("|").map((x) => x.trim()).filter(Boolean);

let _dm; const defaultMini = () => _dm !== undefined ? _dm : (_dm = (() => { const r = reels.find((x) => x.video); if (!r) return null; const p = products.find((x) => x.slug === r.product); return { video: u(r.video), cover: r.cover ? u(r.cover) : "", caption: r.caption, product: p ? { title: p.title, url: u(p.url), image: u(p.images[0] || ""), price: priceHtml(p) } : null }; })());
function page({ title, description, pathname, image, body, ld = [], type = "website", noindex = false, bodyClass = "", mini, og = "" }) {
  if (mini === undefined) mini = defaultMini();
  const canonical = SITE_URL + "/" + pathname;
  const lds = [orgLd, ...ld].map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`).join("\n");
  const waHi = waLink(`Hi ${brand}! I have a question.`);
  return `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? "" : `<link rel="canonical" href="${esc(canonical)}">`}
<meta name="robots" content="${noindex ? "noindex" : "index,follow,max-image-preview:large"}">
${S.google_site_verification ? `<meta name="google-site-verification" content="${esc(S.google_site_verification)}">` : ""}
${S.facebook_domain_verification ? `<meta name="facebook-domain-verification" content="${esc(S.facebook_domain_verification)}">` : ""}
${S.pinterest_verification ? `<meta name="p:domain_verify" content="${esc(S.pinterest_verification)}">` : ""}
${trackHead}
<meta property="og:site_name" content="${esc(brand)}"><meta property="og:type" content="${type}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}">
${og}<meta property="og:url" content="${esc(canonical)}"><meta property="og:image" content="${esc(abs(image || S.hero_image || "images/site/hero.jpg"))}">
<meta property="og:locale" content="en_IN"><meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0e5b59">
${favImg ? `<link rel="icon" href="${esc(u(favImg))}" type="image/png"><link rel="apple-touch-icon" href="${esc(u(favImg))}">` : `<link rel="icon" href="${u("favicon.svg")}" type="image/svg+xml">`}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600&family=Jost:wght@400;500&display=swap" rel="stylesheet" media="print" onload="this.media='all'"><noscript><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600&family=Jost:wght@400;500&display=swap" rel="stylesheet"></noscript>
<link rel="stylesheet" href="${u("assets/style.css")}?v=${ASSET_V}">
<link rel="manifest" href="${u("manifest.webmanifest")}">
${bodyClass === "pdp" && pathname.startsWith("products/") ? `<link rel="alternate" type="text/markdown" href="${u("p/" + pathname.split("/")[1] + ".md")}">` : ""}
<script type="speculationrules">{"prerender":[{"where":{"href_matches":"/products/*"},"eagerness":"moderate"}],"prefetch":[{"where":{"and":[{"href_matches":"/*"},{"not":{"href_matches":"/checkout*"}},{"not":{"href_matches":"/admin*"}},{"not":{"href_matches":"/api/*"}}]},"eagerness":"conservative"}]}</script>
${intlOn ? `<script>(function(){var c;try{c=localStorage.getItem("bk_cur")}catch(e){}if(!c){var z="";try{z=Intl.DateTimeFormat().resolvedOptions().timeZone||""}catch(e){}c=/Calcutta|Kolkata/.test(z)||!z?"INR":"USD"}if(c==="USD")document.documentElement.classList.add("usd")})()</script>` : ""}
<link rel="alternate" type="application/rss+xml" title="${esc(brand)} Blog" href="${u("blog/feed.xml")}">
${lds}
${pixelHead}
</head>
<body class="${bodyClass}">
${pixelBody}
<a class="skip" href="#main">Skip to content</a>
<div class="announce" aria-label="Announcements">${annItems.length ? `<div class="announce-track">${[...annItems, ...annItems, ...annItems, ...annItems].map((a, i) => `<span${i >= annItems.length ? ' aria-hidden="true"' : ""}>${esc(a)}</span>`).join("")}</div>` : `<div class="announce-track"><span>Hand block printed in Jaipur · Ships worldwide</span></div>`}<div class="announce-cta"><a href="${u("wholesale/")}" class="ann-trade">For boutiques & brands</a><button type="button" class="ann-follow" data-follow><span data-follow-label>＋ Follow</span></button></div></div>
<header class="site-header">
  <div class="wrap nav">
    <button class="icon-btn menu-btn" aria-label="Open menu" aria-expanded="false" data-open-menu>${I.menu}</button>
    <a class="logo${logoImg ? " has-img" : ""}" href="${u()}" aria-label="${esc(brand)} home">${logoMark()}</a>
    <nav class="main-nav" aria-label="Main">
      <div class="has-mega"><a href="${u("shop/")}" class="mega-trigger">Shop <span aria-hidden="true">▾</span></a>
        <div class="mega"><div class="wrap mega-grid">
          <div><h4>Categories</h4><a href="${u("shop/")}">Shop All</a>${categories.map((c) => `<a href="${u(c.url)}">${esc(c.plural)}</a>`).join("")}</div>
          ${prints.length ? `<div><h4>Shop by print</h4>${prints.slice(0, 9).map((x) => `<a href="${u(qs("print", x))}">${esc(x)}</a>`).join("")}</div>` : ""}
          ${fabrics.length ? `<div><h4>Shop by fabric</h4>${fabrics.slice(0, 9).map((x) => `<a href="${u(qs("fabric", x))}">${esc(x)}</a>`).join("")}</div>` : ""}
          <a class="mega-feat" href="${u("wholesale/")}"><img src="${esc(u(products[0]?.images[0] || S.hero_image || ""))}" alt="" width="240" height="320" loading="lazy"><span><em>For boutiques & brands</em>Wholesale & Private Label →</span></a>
        </div></div>
      </div>
      ${products.some((p) => p.bestseller) ? `<a href="${u("bestsellers/")}">Bestsellers</a>` : ""}
      <a href="${u("shop/")}">New Arrivals</a>
      <a href="${u("wholesale/")}">Wholesale</a>
      <div class="nav-shop"><button type="button" aria-haspopup="true">Discover ▾</button><div class="mega"><div class="wrap mega-grid discover-grid">
        <div><h4>Try & discover</h4><a href="${u("feed/")}">▶ Watch & Shop</a><a href="${u("mirror/")}">🪞 Mirror · Try your look</a><a href="${u("designs/")}">✨ My Designs · Vote</a></div>
        <div><h4>Save & share</h4><a href="${u("wishlist/")}">♡ Wishlist</a><a href="${u("refer/")}">🎁 Share & Earn</a><a href="${u("gift-card/")}">💌 E-Gift Card</a></div>
      </div></div></div>
      <a href="${u("blog/")}">Journal</a>
      <a href="${u("about/")}">Our Story</a>
      <a href="${u("contact/")}">Contact</a>
    </nav>
    <div class="nav-icons">
      ${intlOn ? `<button class="cur-btn" type="button" data-country aria-label="Change country and currency"><span data-cc-label><span class="cur-inr">🇮🇳 ₹</span><span class="cur-usd">🌍 $</span></span></button>` : ""}
      <button class="icon-btn" type="button" data-open-search aria-label="Search">${I.search}</button>
      <button class="lang-btn head-lang" type="button" data-language aria-label="Choose language">${I.globe}<span data-lang-label>EN</span></button>
      <button class="icon-btn" type="button" data-open-login aria-label="My account">${I.user}<span class="acct-dot" data-acct-dot hidden></span></button>
      <a class="icon-btn hide-sm" href="${u("wishlist/")}" aria-label="Wishlist">${I.heart}<span class="bag-count" data-wish-count hidden>0</span></a>
      ${waHi ? `<a class="icon-btn hide-sm" href="${esc(waHi)}" target="_blank" rel="noopener" aria-label="WhatsApp">${I.wa}</a>` : ""}
      <button class="icon-btn bag-btn" aria-label="Open bag" data-open-cart>${I.bag}<span class="bag-count" data-bag-count hidden>0</span></button>
    </div>
  </div>
</header>
<div class="scrim" data-scrim hidden></div>
<nav class="mnav" id="mnav" aria-label="Menu" aria-hidden="true">
  <div class="drawer-head"><span class="logo${logoImg ? " has-img" : ""}">${logoMark()}</span><button class="icon-btn" aria-label="Close menu" data-close-menu>${I.close}</button></div>
  <a href="${u("shop/")}">Shop All</a>
  ${categories.map((c) => `<a href="${u(c.url)}">${esc(c.plural)}</a>`).join("")}
  <a href="${u("wholesale/")}">Wholesale & Private Label</a>
  <a href="${u("wishlist/")}">Wishlist</a>
  <a href="${u("feed/")}">▶ Feed – watch & shop</a>
  <a href="${u("mirror/")}">🪞 Mirror – try your look</a>
  <a href="${u("craft/")}">🧵 Fabric & print guide</a>
  <button class="mnav-cur" type="button" data-follow><span data-follow-label>＋ Follow Bahe Kurtiz</span></button>
  <a href="${u("refer/")}">🎁 Saheli Credit · Refer & Earn</a>
  <a href="${u("designs/")}">✨ My Designs · Vote & Share</a>
  <a href="${u("gift-card/")}">💌 E-Gift Card</a>
  <a class="mnav-cur" href="${u("feed/")}">▶ Watch & Shop</a>
  <a class="mnav-cur" href="${u("mirror/")}">🪞 Mirror · Try your look</a>
  <a class="mnav-cur" href="${u("refer/")}">🎁 Refer & Earn</a>
  <a class="mnav-cur" href="${u("designs/")}">✨ My Designs · Vote</a>
  <button class="mnav-cur" type="button" data-open-login>My account / Sign in</button>
  <a href="${u("blog/")}">Blog</a>
  <a href="${u("about/")}">Our Story</a>
  <a href="${u("contact/")}">Contact</a>
  ${intlOn ? `<button class="mnav-cur" type="button" data-country>Country & currency: <b data-cc-name>India · ₹</b> · change</button>` : ""}
  ${waNumber ? `<a class="mnav-wa" href="${esc(waLink(`Hi ${brand}! I have a question.`))}" target="_blank" rel="noopener">${I.wa} WhatsApp ${esc(S.phone || "")}</a>` : ""}
  ${socials.length ? `<div class="mnav-social">${socials.map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${socialIcon(x.name)}${esc(x.name)}</a>`).join("")}</div>` : ""}
</nav>
<aside class="drawer" id="cart" aria-label="Shopping bag" aria-hidden="true">
  <div class="drawer-head"><h2>Your Bag</h2><button class="icon-btn" aria-label="Close bag" data-close-cart>${I.close}</button></div>
  <div class="ship-bar" data-ship-bar hidden><p data-ship-text></p><div class="ship-track"><span data-ship-fill></span></div></div>
  <div class="drawer-body" data-cart-items><p class="empty">Your bag is empty.</p></div>
  <div class="drawer-foot" data-cart-foot hidden>
    <div class="row"><span>Subtotal</span><strong data-cart-subtotal>₹0</strong></div>
    ${num(S.prepaid_discount_percent) ? `<p class="hint cur-inr">Extra ${num(S.prepaid_discount_percent)}% off on online payment at checkout</p>` : ""}
    ${intlOn && S.intl_duty_note ? `<p class="hint cur-usd">${esc(S.intl_duty_note)}</p>` : ""}
    <a class="btn btn-block" href="${u("checkout/")}">Checkout</a>
  </div>
</aside>
<main id="main">
${body}
</main>
${noindex || ["home", "pdp"].includes(bodyClass) ? "" : reelsHtml()}
${["home", "pdp", "checkout-page"].includes(bodyClass) ? "" : `<section class="usp">
  <div class="wrap usp-grid">
    <div>${I.needle}<strong>Made in Jaipur</strong><span>Designed and stitched by our own team</span></div>
    <div>${I.shield}<strong>Secure prepaid payments</strong><span class="cur-inr">UPI, cards & netbanking via Razorpay</span>${intlOn ? `<span class="cur-usd">PayPal & international cards</span>` : ""}</div>
    <div>${intlOn ? I.globe : I.truck}<strong>${intlOn ? "Ships worldwide" : "Pan-India delivery"}</strong><span>${esc(S.dispatch_note || "Ships from Jaipur")}</span></div>
    ${num(S.return_days) ? `<div>${I.swap}<strong>${num(S.return_days)}-day size exchange</strong><span><a href="${u("returns/")}">See our return policy</a></span></div>` : ""}
  </div>
</section>`}
${waNumber && bodyClass !== "checkout-page" ? `<section class="join"><div class="wrap join-row"><div><h2>New designs, first on WhatsApp</h2><p>Get new arrivals and restock alerts straight on WhatsApp. No spam.</p></div><a class="btn btn-wa" href="${esc(waLink(`Hi ${brand}! Please add me to your new arrivals updates.`))}" target="_blank" rel="noopener">${I.wa} Join on WhatsApp</a></div></section>` : ""}
${bodyClass === "checkout-page" ? `<footer class="co-foot wrap"><a href="${u("shipping/")}">Shipping</a> · <a href="${u("returns/")}">Returns</a> · <a href="${u("privacy/")}">Privacy</a> · <a href="${u("terms/")}">Terms</a><br>© ${year} ${esc(brand)}, Jaipur</footer>` : `<footer class="site-footer">
  <div class="wrap foot">
    <div class="foot-brand">
      <div class="logo${logoImg ? " has-img" : ""}">${logoMark()}</div>
      <p>${esc(S.tagline || "")}</p>
      ${socials.length ? `<p class="social">${socials.map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener me">${socialIcon(x.name)}${esc(x.name)}</a>`).join("")}</p>` : ""}
    </div>
    <div><h3>Shop</h3><a href="${u("shop/")}">Shop All</a>${categories.map((c) => `<a href="${u(c.url)}">${esc(c.plural)}</a>`).join("")}</div>
    <div><h3>Help</h3><a href="${u("blog/")}">Blog</a><a href="${u("contact/")}">Contact Us</a><a href="${u("wholesale/")}">Wholesale & Private Label</a><a href="${u("refer/")}">Refer & Earn</a><a href="${u("gift-card/")}">E-Gift Card</a><a href="${u("shipping/")}">Shipping Policy (India)</a><a href="${u("returns/")}">Returns & Refunds (India)</a>${S.intl_shipping_policy ? `<a href="${u("international-shipping/")}">International Shipping</a>` : ""}${S.intl_return_policy ? `<a href="${u("international-returns/")}">International Returns</a>` : ""}<a href="${u("privacy/")}">Privacy Policy</a><a href="${u("terms/")}">Terms & Conditions</a></div>
    <div><h3>Contact</h3>
      ${waHi ? `<a href="${esc(waHi)}" target="_blank" rel="noopener">WhatsApp: ${esc(S.phone || "+" + waNumber)}</a>` : ""}
      ${S.email ? `<a href="mailto:${esc(S.email)}">${esc(S.email)}</a>` : ""}
      <p>${esc(S.address || "Jaipur, Rajasthan, India")}</p>
      ${markets.length ? `<h3 class="mt">Also on</h3>${markets.map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>`).join("")}` : ""}
    </div>
  </div>
  ${landings.length ? `<div class="wrap foot-seo"><h3>Popular</h3><p>${landings.map((l) => `<a href="${u(l.url)}">${esc(l.h1)}</a>`).join(" · ")}</p></div>` : ""}
  ${intlOn ? `<div class="wrap foot-country"><button type="button" class="foot-cc" data-country>${I.globe} Country / region: <b data-cc-name>India · ₹ INR</b> <u>Change</u></button></div>` : ""}
  <div class="wrap copy">© ${year} ${esc(brand)}, Jaipur. All rights reserved.</div>
</footer>`}
${waHi ? `<a class="wa-float" href="${esc(waHi)}" target="_blank" rel="noopener" aria-label="Chat on WhatsApp">${I.wa}</a>` : ""}
<div class="toast" data-toast role="status" aria-live="polite"></div>
<dialog class="login-modal" data-login-modal aria-labelledby="login-h"><form class="login-box" data-login-form method="dialog" novalidate>
  <button class="icon-btn login-x" type="button" data-close-login aria-label="Close">${I.close}</button>
  <p class="eyebrow">${esc(S.login_eyebrow || "Members get it first")}</p>
  <h2 id="login-h" data-login-title>${esc(S.login_title || "Sign in for early access to sales")}</h2>
  <p class="muted small">${esc(S.login_text || "Be the first to know about festive sales, new designs and restocks. Faster checkout next time.")}</p>
  ${S.google_client_id ? `<div class="g-btn" data-google-btn></div><p class="or"><span>or</span></p>` : ""}
  <label>Name<input name="name" autocomplete="name" maxlength="80" required></label>
  <label>Mobile / WhatsApp<input name="phone" type="tel" autocomplete="tel" maxlength="18" placeholder="+91 98765 43210" required></label>
  <label>Email (optional)<input name="email" type="email" autocomplete="email" maxlength="100"></label>
  <label class="check"><input type="checkbox" name="consent" value="yes"> Send me offers and new arrivals on WhatsApp / email</label>
  <button class="btn btn-block" type="submit">Continue</button>
  <p class="muted tiny">We use your details only for your orders and the updates you choose. <a href="${u("privacy/")}">Privacy</a></p>
</form>
<div class="login-box login-done" data-login-done hidden><h2>Welcome, <span data-login-name></span>!</h2><p class="muted">You are signed in on this device. Your details will be filled at checkout.</p><a class="btn btn-wa btn-block" href="${u("refer/")}">🎁 Refer & Earn – get your link</a><button class="btn btn-ghost btn-block" type="button" data-logout>Sign out</button><button class="btn btn-block" type="button" data-close-login>Continue shopping</button></div>
</dialog>
<dialog class="country-modal lang-modal" data-lang-modal aria-label="Choose language"><div class="country-box"><button class="icon-btn login-x" type="button" data-close-language aria-label="Close">${I.close}</button><h2>Choose language</h2><p class="muted small">Language and country are separate. You can change this anytime.</p><div class="lang-list" data-lang-list></div></div></dialog>
${intlOn ? `<dialog class="country-modal" data-country-modal aria-label="Choose your country"><div class="country-box"><button class="icon-btn login-x" type="button" data-close-country aria-label="Close">${I.close}</button><h2>Where should we ship?</h2><p class="muted small">Prices change to your country. International orders are charged in US $; local prices are approximate.</p><input type="search" placeholder="Search country – India, UK, UAE, USA…" data-country-q aria-label="Search country" autocomplete="off"><div class="country-list" data-country-list></div></div></dialog>` : ""}
<dialog class="story-modal" data-story-modal aria-label="Story"><div class="story-stage" data-story-stage></div></dialog>
<dialog class="finder-modal" data-finder aria-label="Style finder"><div class="finder-box"><button class="icon-btn login-x" type="button" data-close-finder aria-label="Close">${I.close}</button><div data-finder-body></div></div></dialog>
<dialog class="search-modal" data-search-modal aria-label="Search"><div class="search-box"><div class="search-bar">${I.search}<button class="icon-btn mic" type="button" data-mic aria-label="Search by voice" hidden>${I.mic}</button><input type="search" placeholder="Search kurtis, dresses, block print, cotton…" data-search-input aria-label="Search products" autocomplete="off"><button class="icon-btn" type="button" data-close-search aria-label="Close">${I.close}</button></div>
<div class="search-sugg">${[...categories.map((c) => c.plural), ...prints.slice(0, 4), ...fabrics.slice(0, 3)].map((x) => `<button type="button" class="pill" data-sugg="${esc(x)}">${esc(x)}</button>`).join("")}</div><div class="search-results" data-search-results></div></div></dialog>
<nav class="bnav" aria-label="Quick links"><a href="${u()}">${I.home}<span>Home</span></a><a href="${u("shop/")}">${I.grid}<span>Shop</span></a><button type="button" data-open-search>${I.search}<span>Search</span></button><a href="${u("wishlist/")}">${I.heart}<span>Wishlist</span><i class="bag-count" data-wish-count hidden>0</i></a><button type="button" data-open-cart>${I.bag}<span>Bag</span><i class="bag-count" data-bag-count hidden>0</i></button></nav>
${mini && !noindex && (bodyClass === "home" || bodyClass === "pdp") ? `<div class="mini-reel" data-mini><button class="mini-x" type="button" data-mini-close aria-label="Close video">×</button><button class="mini-play" type="button" data-mini-open aria-label="Watch video${mini.caption ? ": " + esc(mini.caption) : ""}"><video data-src="${esc(mini.video)}"${mini.cover ? ` poster="${esc(mini.cover)}"` : ""} muted loop playsinline preload="none" aria-hidden="true"></video><span class="mini-badge">${I.play} Watch</span></button></div>` : ""}
<dialog class="reel-modal" data-reel-modal aria-label="Reel"><button class="icon-btn reel-x" data-reel-close aria-label="Close">${I.close}</button><div class="reel-stage" data-reel-stage></div></dialog>
<script>window.BK=${JSON.stringify({ base: BASE, wa: waNumber, brand, email: S.email || "", intl: intlOn, sheet: /^https:\/\/script\.google\.com\//.test(String(S.customer_sheet_url || "").trim()) ? String(S.customer_sheet_url).trim() : "", gid: String(S.google_client_id || "").trim(), popup: S.login_popup !== false, stories: bodyClass === "home" ? storiesData.map((st) => ({ t: st.t, s: st.s.map((x) => ({ img: x.img ? u(x.img) : "", vid: x.vid ? u(x.vid) : "", cap: x.cap, link: x.link ? u(x.link) : "", shop: x.shop })) })) : [], fests: festAll, countries: intlOn ? countryList : [], rates: Object.fromEntries((Array.isArray(S.currency_rates) ? S.currency_rates : []).map((r) => [String(r?.code || "").toUpperCase(), num(r?.per_usd)]).filter(([c, v]) => c && v)), occasions, fabrics, productI18n: Object.fromEntries(products.map((p) => [p.slug, p.i18n || {}])), marketPrices: Object.fromEntries(products.map((p) => [p.slug, p.market_prices || {}])), ship: { dispatch: num(S.dispatch_days) || 3, min: num(S.transit_days_min) || 3, max: num(S.transit_days_max) || 7, local: num(S.transit_days_local) || 2, intlMin: num(S.intl_eta_min) || 7, intlMax: num(S.intl_eta_max) || 12 }, reels: reels.length ? reelData() : [], mini: mini || null }).replace(/</g, "\\u003c")};</script>
<script src="${u("assets/app.js")}?v=${ASSET_V}" defer></script>
</body>
</html>`;
}

const inrPrice = (p, cls = "") => {
  if (p.price === null) return `<span class="price ask ${cls}">Price on request</span>`;
  const off = offPct(p);
  return `<span class="price ${cls}">${inr(p.price)}</span>${off ? `<s class="mrp">${inr(p.mrp)}</s><span class="off">${off}% OFF</span>` : ""}`;
};
const usdPrice = (p, cls = "") => {
  if (!p.ships_abroad) return `<span class="price ask ${cls}">Ships within India only</span>`;
  if (p.price_usd === null) return `<span class="price ask ${cls}">Price on request</span>`;
  const off = offUsd(p);
  return `<span class="price ${cls}" data-usdv="${p.price_usd}" data-price-slug="${esc(p.slug)}" data-price-kind="price">${usd(p.price_usd)}</span>${off ? `<s class="mrp" data-usdv="${p.mrp_usd}" data-price-slug="${esc(p.slug)}" data-price-kind="mrp">${usd(p.mrp_usd)}</s><span class="off">${off}% OFF</span>` : ""}`;
};
// both prices are in the page; the ₹/$ switch shows one (no flicker, works without JS)
const priceHtml = (p, cls = "") => (intlOn ? `<span class="cur-inr">${inrPrice(p, cls)}</span><span class="cur-usd">${usdPrice(p, cls)}</span>` : inrPrice(p, cls));

const card = (p, i = 9) => {
  const [a, b] = p.images;
  const alt = `${p.title}${p.color && !p.title.toLowerCase().includes(p.color.toLowerCase()) ? " in " + p.color : ""} – ${brand}`;
  const off = offPct(p);
  return `<article class="card" data-cat="${esc(p.catSlug)}" data-slug="${esc(p.slug)}" data-fabric="${esc(p.fabric)}" data-print="${esc(p.print_work.join("|"))}" data-intl="${p.intl ? 1 : 0}"${intlOn && !p.intl ? " data-india-only" : ""}>
  <a href="${u(p.url)}" class="card-link">
    <div class="card-img${b ? " has-alt" : ""}">
      ${a ? `<img src="${esc(u(a))}" alt="${esc(alt)}" width="1200" height="1800" ${i < 2 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">` : ""}
      ${b ? `<img class="alt" data-src="${esc(u(b))}" alt="" width="1200" height="1800" decoding="async">` : ""}
      <div class="tags">${p.bestseller ? `<span class="tag tag-best">★ Bestseller</span>` : ""}${off ? `<span class="tag tag-sale">-${off}%</span>` : ""}${!p.in_stock ? `<span class="tag">Made to order</span>` : ""}${p.video ? `<span class="tag tag-vid">▶ Reel</span>` : ""}</div>
    </div>
    <div class="card-body">
      <h3 data-p-title="${esc(p.slug)}">${esc(p.title)}</h3>
      <div class="card-price">${priceHtml(p)}</div>
    </div>
  </a>
  <button class="wish" type="button" data-wish="${esc(p.slug)}" aria-label="Save ${esc(p.title)} to wishlist" aria-pressed="false">${I.heart}</button>
</article>`;
};

const sizeRows = (Array.isArray(S.size_chart) && S.size_chart.length ? S.size_chart : [["XS", 32, 26, 34], ["S", 34, 28, 36], ["M", 36, 30, 38], ["L", 38, 32, 40], ["XL", 40, 34, 42], ["XXL", 42, 36, 44], ["3XL", 44, 38, 46], ["4XL", 46, 40, 48], ["5XL", 48, 42, 50]].map(([size, bust, waist, hip]) => ({ size, bust, waist, hip })))
  .map((r) => ({ size: String(r.size || ""), bust: num(r.bust), waist: num(r.waist), hip: num(r.hip) })).filter((r) => r.size);
const cm = (n) => (n === null ? "–" : `${n}" <small>${Math.round(n * 2.54)} cm</small>`);
const sizeDialog = `<dialog class="size-modal" data-size-modal aria-labelledby="sz-h"><div class="size-box"><div class="drawer-head"><h2 id="sz-h">Size chart</h2><button class="icon-btn" type="button" data-close-size aria-label="Close">${I.close}</button></div>
<p class="muted">Body measurements in inches (cm). Between two sizes? Relaxed styles: take your usual size. Fitted styles: size up. ${esc(S.size_note || "Need help? WhatsApp us your bust and height and we will suggest a size.")}</p>
<div class="table-scroll"><table class="size-table"><thead><tr><th>Size</th><th>Bust</th><th>Waist</th><th>Hip</th></tr></thead><tbody>${sizeRows.map((r) => `<tr><th>${esc(r.size)}</th><td>${cm(r.bust)}</td><td>${cm(r.waist)}</td><td>${cm(r.hip)}</td></tr>`).join("")}</tbody></table></div>
<p class="muted small">How to measure: Bust – around the fullest part. Waist – around the natural waistline. Hip – around the fullest part of the hips.</p></div></dialog>`;
const circles = (active = "") => categories.length ? `<nav class="circles" aria-label="Categories"><div class="circles-row">
  <a class="circle${active === "shop/" ? " on" : ""}" href="${u("shop/")}"><span class="circle-img circle-all">All</span><em>Shop All</em></a>
  ${categories.map((c) => { const img = c.items.find((p) => p.images[0])?.images[0] || ""; return `<a class="circle${active === c.url ? " on" : ""}" href="${u(c.url)}"><span class="circle-img">${img ? `<img src="${esc(u(img))}" alt="" width="160" height="160" loading="lazy">` : ""}</span><em>${esc(c.plural)}</em></a>`; }).join("")}
  <a class="circle" href="${u("wholesale/")}"><span class="circle-img circle-all">B2B</span><em>Wholesale</em></a>
</div></nav>` : "";
const reviews = (Array.isArray(S.reviews) ? S.reviews : []).map((r) => ({ name: String(r?.name || "").trim(), city: String(r?.city || "").trim(), text: String(r?.text || "").trim(), rating: num(r?.rating) || 5, photo: String(r?.photo || "").trim() })).filter((r) => r.name && r.text && !/\b(test|sample|dummy)\b/i.test(r.name + " " + r.text));
const pages = [];
const add = (file, html) => pages.push([file, html]);

// ---------- home ----------
{
  // banners: admin "बैनर (Banners)" section first, then the older settings list
  const bDir = path.join(ROOT, "content/banners");
  const bannerFiles = (fs.existsSync(bDir) ? fs.readdirSync(bDir) : []).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(bDir, f), "utf8"))).filter((b) => b && b.active !== false && (b.image || b.image_desktop) && (!b.end || String(b.end).slice(0, 10) >= today)).sort((a, b) => (num(a.order) ?? 50) - (num(b.order) ?? 50));
  const slides = [...bannerFiles, ...(Array.isArray(S.hero_slides) ? S.hero_slides : [])].map((x) => ({ start: String(x?.start || "").slice(0, 10), end: String(x?.end || "").slice(0, 10), image: String(x?.image || x?.image_desktop || "").trim(), wide: String(x?.image_desktop || "").trim(), title: String(x?.title || "").trim(), subtitle: String(x?.subtitle || "").trim(), link: String(x?.link || "").trim(), button: String(x?.button || "").trim(), eyebrow: String(x?.eyebrow || "").trim() })).filter((x) => x.image);
  if (!slides.length) {
    slides.push({ image: S.hero_image || "images/site/hero.jpg", wide: String(S.hero_image_desktop || "").trim() || (S.hero_image === "/images/site/hero-teal.jpg" ? siteFile("hero-wide.jpg") : ""), title: S.hero_title || brand, subtitle: S.hero_subtitle || S.tagline || "" });
    // ready-made promo banners until real ones are added in admin (Settings → होमपेज बैनर स्लाइड)
    const sf = (n) => siteFile("slides/" + n);
    if (sf("slide-festive-wide.jpg")) {
      slides.push({ image: sf("slide-festive-tall.jpg"), wide: sf("slide-festive-wide.jpg"), eyebrow: "Festive Edit 2026", title: "Festive & Wedding Season Collection", subtitle: "Block print kurta sets, Anarkalis and co-ords for every celebration", button: "Shop festive", link: "shop/" });
      slides.push({ image: sf("slide-indigo-tall.jpg"), wide: sf("slide-indigo-wide.jpg"), eyebrow: "Just in", title: "New Arrivals Every Week", subtitle: "Fresh hand block prints from our Sanganer workshop", button: "See what's new", link: "shop/" });
      slides.push({ image: sf("slide-mustard-tall.jpg"), wide: sf("slide-mustard-wide.jpg"), eyebrow: "For boutiques & brands", title: "Wholesale & Private Label", subtitle: "Your brand, made in Jaipur. Low minimums for new boutiques", button: "Wholesale enquiry", link: "wholesale/" });
      if (intlOn) slides.push({ image: sf("slide-sand-tall.jpg"), wide: sf("slide-sand-wide.jpg"), eyebrow: "From Jaipur to the world", title: "We Ship Worldwide", subtitle: "Shipping to every country in the world, prepaid in USD", button: "Shop now", link: "shop/" });
    }
  }
  const featured = products.filter((p) => p.featured);
  const list = (featured.length ? featured : products).slice(0, 8);
  const tiles = categories.map((c) => `<a class="tile" href="${u(c.url)}"><img src="${esc(u(c.items[0]?.images[1] || c.items[0]?.images[0] || ""))}" alt="${esc(c.plural)} by ${esc(brand)}" width="1200" height="1800" loading="lazy"><span>${esc(c.plural)}<em>Shop now →</em></span></a>`).join("");
  const body = `
${storiesData.length ? `<nav class="stories" aria-label="Stories"><div class="stories-row">${storiesData.map((st, i) => `<button class="story" type="button" data-story="${i}"><span class="story-ring"><img src="${esc(u(st.c))}" alt="" width="120" height="120" loading="${i < 5 ? "eager" : "lazy"}"></span><em>${esc(st.t)}</em></button>`).join("")}<a class="story" href="${u("feed/")}"><span class="story-ring story-feed">▶</span><em>Feed</em></a></div></nav>` : ""}
${circles()}
${live.on && live.url ? `<a class="live-strip" href="#live"><span class="live-dot"></span> LIVE NOW · ${esc(live.title)} <b>Watch & shop →</b></a>` : liveNextText ? `<div class="live-strip next">📺 Next live shopping: <b>${esc(liveNextText)}</b>${ytChan ? ` · <a href="${esc(ytChan)}" target="_blank" rel="noopener">Subscribe on YouTube</a>` : ""}</div>` : ""}
${festNext ? `<div class="fest" data-fest data-in="${esc(festNext.order_by_in)}" data-us="${esc(festNext.order_by_intl)}"><div class="wrap fest-row"><span class="fest-name">${esc(festNext.name)} · ${esc(festNext.dateText)}</span><span class="fest-cut"><span class="cur-inr">Order by <b>${esc(festNext.order_by_in_text)}</b> for delivery in India</span>${intlOn ? `<span class="cur-usd">Order by <b>${esc(festNext.order_by_intl_text)}</b> for delivery abroad</span>` : ""} <span class="fest-left" data-fest-left></span></span><a class="link" href="${u(festNext.link || "shop/")}">Shop →</a><button class="link fest-cal" type="button" data-ics>📅 Add festivals to my calendar</button></div></div>` : ""}
<section class="hero-wrap" aria-label="Featured" data-hero>
<div class="hero-track" data-hero-track>
${slides.map((sl, i) => `<div class="hero hero-slide${sl.wide ? " hero-full" : ""}${i === 0 ? " on" : ""}"${sl.start ? ` data-start="${sl.start}"` : ""}${sl.end ? ` data-end="${sl.end}"` : ""}${i ? ' aria-hidden="true" inert' : ""}>
  <div class="hero-media">${sl.wide ? `<picture><source media="(min-width: 901px)" srcset="${esc(u(sl.wide))}"><img src="${esc(u(sl.image))}" alt="${esc(sl.title || brand)} – ${esc(brand)}, Jaipur" width="1200" height="1800" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'}></picture>` : `<img src="${esc(u(sl.image))}" alt="${esc(sl.title || brand)} – ${esc(brand)}, Jaipur" width="1200" height="1800" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'}>`}</div>
  <div class="hero-text">
    <p class="eyebrow">${esc(sl.eyebrow || "New collection · Made in Jaipur")}</p>
    ${i === 0 ? `<h1>${esc(sl.title || brand)}</h1>` : `<h2 class="h1">${esc(sl.title || brand)}</h2>`}
    <p class="lead">${esc(sl.subtitle || "")}</p>
    <div class="hero-cta"><a class="btn" href="${u(sl.link || "shop/")}">${esc(sl.button || "Shop the collection")}</a>${i === 0 && categories[0] ? `<a class="btn btn-ghost" href="${u(categories[0].url)}">${esc(categories[0].plural)}</a>` : ""}</div>
  </div>
</div>`).join("")}
</div>
${slides.length > 1 ? `<button class="hero-arrow prev" type="button" data-hero-step="-1" aria-label="Previous banner">‹</button><button class="hero-arrow next" type="button" data-hero-step="1" aria-label="Next banner">›</button>` : ""}
${slides.length > 1 ? `<div class="hero-dots">${slides.map((_, i) => `<button type="button" data-hero-go="${i}" aria-label="Slide ${i + 1}"${i === 0 ? ' class="on"' : ""}></button>`).join("")}</div>` : ""}
</section>
<section class="trust" aria-label="Why shop with us">
  <div class="wrap trust-row">
    <div>${I.needle}<span><strong>Handmade in Jaipur</strong>Hand block prints by our own karigars</span></div>
    <div>${intlOn ? I.globe : I.truck}<span><strong>${intlOn ? "Ships worldwide" : "Pan-India delivery"}</strong>${esc(S.dispatch_note || "Dispatched from Sanganer, Jaipur")}</span></div>
    <div>${I.shield}<span><strong>100% secure prepaid</strong><span class="cur-inr">UPI · Cards · Netbanking</span>${intlOn ? `<span class="cur-usd">PayPal · International cards</span>` : ""}</span></div>
    <div>${I.box}<span><strong>Wholesale & private label</strong><a href="${u("wholesale/")}">Bulk orders for boutiques →</a></span></div>
  </div>
</section>
${live.on && live.url ? `<section class="wrap section live" id="live"><div class="section-head"><div><p class="eyebrow"><span class="live-dot"></span> Live now</p><h2>${esc(live.title)}</h2></div><a class="link" href="${esc(live.url)}" target="_blank" rel="noopener">Open on YouTube →</a></div>${live.id ? `<div class="live-frame"><button type="button" class="yt-facade" data-yt="${esc(live.id)}" aria-label="Play live: ${esc(live.title)}"><img src="https://i.ytimg.com/vi/${esc(live.id)}/hqdefault.jpg" alt="" loading="lazy" decoding="async"><span class="yt-play">▶</span></button></div>` : ""}<p class="muted">Like something in the live? ${waNumber ? `<a class="link" href="${esc(waLink("Hi " + brand + "! I saw this in your live: "))}" target="_blank" rel="noopener">Order it on WhatsApp</a>` : ""} or search it on the site.</p></section>` : ""}
<section class="wrap section foryou" data-foryou hidden><div class="section-head"><div><p class="eyebrow">Based on what you viewed</p><h2>Picked for you</h2></div></div><div class="grid scroller" data-foryou-grid></div></section>
<section class="follow-cta"><div class="wrap follow-row"><div><p class="eyebrow">Be part of the Bahe family</p><h2>Follow ${esc(brand)}</h2><p class="muted">New prints, live shows and festive drops – first to you. One tap, no spam.</p></div><button class="btn" type="button" data-follow><span data-follow-label>＋ Follow</span></button></div></section>
<section class="finder-cta"><div class="wrap finder-row"><div><p class="eyebrow">Sakhi · your style helper</p><h2>Find your style in 3 taps</h2><p class="muted">Tell us the occasion, fabric and budget. We show the styles that fit.</p></div><button class="btn" type="button" data-open-finder>Start Style Finder</button></div></section>
<section class="wrap section bk2050"><div class="section-head center"><p class="eyebrow">BAHE 2050 · discover together</p><h2>Try it · Watch it · Share it</h2><p class="muted">The same BAHE experience on phone and desktop.</p></div><div class="bk2050-grid"><a href="${u("feed/")}"><b>▶ Watch & Shop</b><span>Swipe new looks and shop directly.</span></a><a href="${u("mirror/")}"><b>🪞 Mirror</b><span>Try looks on your photo and ask family.</span></a><a href="${u("refer/")}"><b>🎁 Share & Earn</b><span>Your personal referral link and rewards.</span></a><a href="${u("designs/")}"><b>✨ My Designs</b><span>Vote for what BAHE should make next.</span></a></div></section>
${reelsHtml()}
${(() => { const best = products.filter((p) => p.bestseller).slice(0, 8); return best.length >= 4 ? `<section class="wrap section best"><div class="section-head"><div><p class="eyebrow">Most loved</p><h2>Bestsellers</h2></div><a class="link" href="${u("bestsellers/")}">View all →</a></div><div class="grid scroller">${best.map((p) => card(p)).join("")}</div></section>` : ""; })()}
<section class="wrap section">
  <div class="section-head"><div><p class="eyebrow">Just in</p><h2>New Arrivals</h2></div><a class="link" href="${u("shop/")}">View all →</a></div>
  <div class="grid scroller">${list.map((p) => card(p)).join("")}</div>
</section>
${(() => { const lim = num(S.budget_price) || 999; const cheap = products.filter((p) => p.price !== null && p.price <= lim).slice(0, 8); return cheap.length >= 3 ? `<section class="wrap section budget"><div class="section-head"><div><p class="eyebrow">Everyday picks</p><h2>${intlOn ? `<span class="cur-inr">Under ${inr(lim)}</span><span class="cur-usd">Everyday Picks</span>` : `Under ${inr(lim)}`}</h2></div><a class="link" href="${u("shop/")}">View all →</a></div><div class="grid scroller">${cheap.map((p) => card(p)).join("")}</div></section>` : ""; })()}
${fabrics.length > 1 || prints.length > 1 || occasions.length ? `<section class="shopby"><div class="wrap">
  ${occasions.length ? `<div class="shopby-row"><p class="eyebrow">Shop by occasion</p><div class="pills">${occasions.map((o) => `<a class="pill" href="${u("occasion/" + slugify(o) + "/")}">${esc(o)}</a>`).join("")}</div></div>` : ""}
  ${prints.length > 1 ? `<div class="shopby-row"><p class="eyebrow">Shop by print</p><div class="pills">${prints.map((x) => `<a class="pill" href="${u(qs("print", x))}">${esc(x)}</a>`).join("")}</div></div>` : ""}
  ${fabrics.length > 1 ? `<div class="shopby-row"><p class="eyebrow">Shop by fabric</p><div class="pills">${fabrics.map((x) => `<a class="pill" href="${u(craftUrl(x))}">${esc(x)}</a>`).join("")}</div></div>` : ""}
</div></section>` : ""}
<section class="b2b">
  <div class="wrap b2b-grid">
    <div>
      <p class="eyebrow">For boutiques, brands & importers</p>
      <h2>Wholesale · Private Label · Export</h2>
      <p>Buy directly from our workshop in Sanganer, Jaipur. Your brand label, your designs or ours, low minimums for new boutiques, and photos and videos before every dispatch.</p>
      <div class="hero-cta"><a class="btn btn-light" href="${u("wholesale/")}">Wholesale enquiry</a>${waNumber ? `<a class="btn btn-wa" href="${esc(waLink(`Hi ${brand}! I am interested in wholesale / private label.`))}" target="_blank" rel="noopener">${I.wa} WhatsApp</a>` : ""}</div>
    </div>
    <ul class="b2b-list"><li>${I.box}<span><strong>Wholesale</strong>Kurtis, sets, dresses & co-ords in bulk</span></li><li>${I.tag}<span><strong>Private label</strong>Your brand name, tags & packaging</span></li><li>${I.globe}<span><strong>Export</strong>Buyers in every country, worldwide</span></li></ul>
  </div>
</section>
${reviews.length >= 3 ? `<section class="wrap section reviews"><div class="section-head center"><p class="eyebrow">Loved by our customers</p><h2>Reviews</h2></div><div class="rev-row">${reviews.map((r) => `<figure class="rev">${r.photo ? `<img src="${esc(u(r.photo))}" alt="" width="400" height="500" loading="lazy">` : ""}<blockquote>${star(r.rating)}<p>${esc(r.text)}</p></blockquote><figcaption>${esc(r.name)}${r.city ? ` · ${esc(r.city)}` : ""}</figcaption></figure>`).join("")}</div></section>` : ""}
<section class="wrap section recent" data-recent hidden><div class="section-head"><div><p class="eyebrow">Picked up where you left</p><h2>Recently viewed</h2></div></div><div class="grid" data-recent-grid></div></section>
<section class="story">
  <div class="wrap story-grid">
    <img src="${esc(u(products[0]?.images[2] || products[0]?.images[0] || S.hero_image))}" alt="${esc(brand)} kurti shot in Jaipur" width="1200" height="1800" loading="lazy">
    <div>
      <p class="eyebrow">Our story</p>
      <h2>${esc(S.about_title || "About us")}</h2>
      ${paras(S.about_text)}
      <a class="btn btn-ghost" href="${u("about/")}">Read more</a>
    </div>
  </div>
</section>`;
  add("index.html", page({
    title: `${brand} | Kurtis & Dresses for Women, Made in Jaipur`,
    description: clip(`Shop ${categories.map((c) => c.plural.toLowerCase()).join(" & ")} for women by ${brand}, Jaipur. ${S.tagline || ""}. Secure prepaid payment${intlOn ? ", shipping worldwide" : " and pan-India delivery"}.`),
    pathname: "", body, bodyClass: "home",
    ld: [{ "@context": "https://schema.org", "@type": "WebSite", name: brand, url: SITE_URL + "/" }],
  }));
}

// ---------- listing pages ----------
function listing({ file, pathname, h1, intro, items, title, description, crumbs, seo = "" }) {
  const body = `
<section class="wrap section">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="${u()}">Home</a> / ${crumbs}</nav>
  <div class="list-head"><h1>${esc(h1)}</h1><p class="muted">${esc(intro)}</p></div>
  ${circles(pathname)}
  <div class="chips">

    ${(() => { const fs_ = uniq(items.map((p) => p.fabric).filter((f) => f && f !== "Other")); const ps = uniq(items.flatMap((p) => p.print_work));
      return `${ps.length > 1 ? `<label class="sort">Print <select data-filter="print"><option value="">All</option>${ps.map((x) => `<option>${esc(x)}</option>`).join("")}</select></label>` : ""}${fs_.length > 1 ? `<label class="sort">Fabric <select data-filter="fabric"><option value="">All</option>${fs_.map((x) => `<option>${esc(x)}</option>`).join("")}</select></label>` : ""}`; })()}
    <label class="sort">Sort <select data-sort><option value="">Featured</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select></label>
  </div>
  <p class="filter-empty muted" data-filter-empty hidden>No styles match this filter. <button class="link" type="button" data-filter-clear>Show all</button></p>
  <div class="grid" data-grid>${items.map((p, i) => card(p, i).replace('<article class="card"', `<article class="card" data-price="${p.price ?? ""}" data-usd="${p.intl ? p.price_usd : ""}" data-i="${i}"`)).join("")}</div>
  ${seo ? `<div class="seo-text">${paras(seo)}<p><a class="link" href="${u("wholesale/")}">Wholesale & private label →</a></p></div>` : ""}
</section>`;
  add(file, page({
    title, description, pathname, body, image: items[0]?.images[0],
    ld: [crumbLd([[h1, pathname]]), { "@context": "https://schema.org", "@type": "CollectionPage", name: h1, url: SITE_URL + "/" + pathname,
      mainEntity: { "@type": "ItemList", itemListElement: items.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: SITE_URL + "/" + p.url, name: p.title })) } }],
  }));
}
listing({ file: "shop/index.html", pathname: "shop/", h1: "Shop All", intro: `${products.length} styles, made in Jaipur`, items: products, crumbs: "<span>Shop All</span>",
  title: `Shop Women's Kurtis & Dresses Online | ${brand}`, description: `Browse all kurtis and dresses by ${brand}, Jaipur. Embroidered kurtis, floral dresses and more with secure online payment and pan-India delivery.` });
{ const best = products.filter((p) => p.bestseller); if (best.length) listing({ file: "bestsellers/index.html", pathname: "bestsellers/", h1: "Bestsellers", intro: `Our most loved styles, made in Jaipur`, items: best, crumbs: "<span>Bestsellers</span>",
  title: `Bestsellers – Most Loved Kurtis & Dresses | ${brand}`, description: `Shop the bestselling kurtis, kurta sets and dresses by ${brand}, Jaipur. Hand block prints loved by our customers.` }); }
// ---------- Fabric & print guide + one page per fabric / print that has products ----------
{ const sec = (type, title) => { const names = uniq([...Object.keys(CRAFT[type]), ...(type === "fabric" ? fabrics : prints)]);
    const rows = names.map((n) => ({ n, c: craftInfo(type, n), k: craftCount(type, n) })).sort((a, b) => b.k - a.k || a.n.localeCompare(b.n));
    return `<section class="wrap section"><h2>${title}</h2><div class="craft-grid">${rows.map(({ n, c, k }, i) => `<article class="craft-card" id="${slugify(title)}-${slugify(n)}-${i}"><h3>${esc(n)}</h3>${c?.[0] ? `<p class="eyebrow">${esc(c[0])}</p>` : ""}${c ? `<p>${esc(c[1])}</p><p class="muted small">🧺 ${esc(c[2])}</p>` : ""}${k ? `<a class="btn btn-sm" href="${u(craftUrl(n))}">Shop ${k} ${k === 1 ? "style" : "styles"} →</a>` : `<a class="link small" href="https://wa.me/${waNumber}?text=${encodeURIComponent("Hi " + brand + ", do you have " + n + " kurtis?")}" target="_blank" rel="noopener">Ask on WhatsApp →</a>`}</article>`).join("")}</div></section>`; };
  add("craft/index.html", page({ title: `Fabric & Print Guide – Bagru, Sanganeri, Ajrakh, Chanderi | ${brand}`, description: clip(`A simple guide to Indian hand block prints and fabrics – Sanganeri, Bagru, Dabu, Ajrakh, Kalamkari, Chanderi, Mul Cotton, Rayon and more – with care tips, from ${brand}, Jaipur.`), pathname: "craft/",
    body: `<section class="refer-hero"><div class="wrap"><p class="eyebrow">Craft guide</p><h1>Fabric & Print Guide</h1><p class="lead">Every print has a place, a community and a story. Here is what each one means, where it comes from, and how to care for it.</p></div></section>${sec("print", "Prints & handwork")}${sec("fabric", "Fabrics")}` }));
  for (const [type, names] of [["print", prints], ["fabric", fabrics]]) for (const n of names) { const items = products.filter((p) => (type === "fabric" ? p.fabric === n : p.print_work.includes(n))); if (!items.length) continue; const c = craftInfo(type, n);
    listing({ file: `${craftUrl(n)}index.html`, pathname: craftUrl(n), h1: `${n} ${type === "fabric" ? "Kurtis & Dresses" : "Kurtis & Dresses"}`, intro: `${items.length} ${items.length === 1 ? "style" : "styles"}${c?.[0] ? " · " + c[0] : ""}`, items, crumbs: `<a href="${u("craft/")}">Fabric & print guide</a> / <span>${esc(n)}</span>`, title: `${n} Kurtis & Dresses Online – Made in Jaipur | ${brand}`, description: clip(`Shop ${n} kurtis, kurta sets and dresses by ${brand}, Jaipur. ${c ? c[1] : ""}`), seo: c ? `${c[1]}\n\nCare: ${c[2]}` : "" }); } }
for (const o of occasions) { const items = products.filter((p) => p.occasion.includes(o)); const slug = slugify(o); listing({ file: `occasion/${slug}/index.html`, pathname: `occasion/${slug}/`, h1: `${o} Wear`, intro: `${items.length} styles for ${o.toLowerCase()}, made in Jaipur`, items, crumbs: `<span>${esc(o)}</span>`, title: `${o} Kurtis & Dresses – Hand Block Print | ${brand}`, description: `Shop ${o.toLowerCase()} kurtis, kurta sets and dresses by ${brand}, Jaipur. Hand block prints, secure prepaid payment.` }); }
const catSeo = Object.fromEntries((Array.isArray(S.category_seo) ? S.category_seo : []).map((x) => [String(x?.category || "").trim(), String(x?.text || "").trim()]));
for (const c of categories) {
  const fb = uniq(c.items.map((p) => p.fabric)).slice(0, 4), pw = uniq(c.items.flatMap((p) => p.print_work)).slice(0, 4);
  c.seoText = catSeo[c.name] || `Shop ${c.plural.toLowerCase()} for women by ${brand}, made in our own unit in Sanganer, Jaipur${pw.length ? ` – ${pw.join(", ").toLowerCase()}` : ""}${fb.length ? ` in ${fb.join(", ").toLowerCase()}` : ""}. Secure prepaid payment, shipping across India${intlOn ? " and worldwide" : ""}. Boutiques and brands can also order ${c.plural.toLowerCase()} in wholesale or under their own private label.`;
  listing({ file: c.url + "index.html", pathname: c.url, h1: c.plural, intro: `${c.items.length} styles`, seo: c.seoText, items: c.items, crumbs: `<a href="${u("shop/")}">Shop</a> / <span>${esc(c.plural)}</span>`,
    title: `${c.plural} for Women – Made in Jaipur | ${brand}`, description: `Shop ${c.plural.toLowerCase()} for women by ${brand}, Jaipur. Handcrafted designs, secure online payment and pan-India delivery.` });
}

// ---------- product pages ----------
for (const p of products) {
  const look = p.match.map((m) => products.find((x) => x.slug === m)).filter((x) => x && x.slug !== p.slug).slice(0, 4);
  const related = products.filter((x) => x.slug !== p.slug && !look.includes(x)).sort((a, b) => (b.category === p.category) - (a.category === p.category)).slice(0, 4);
  const firstLine = String(p.description || "").split(/\n/)[0];
  const desc = clip(p.seo_description || `${p.title}${p.color ? " in " + p.color : ""}${p.fabric ? ", " + p.fabric : ""}. ${firstLine}`);
  const cat = categories.find((c) => c.name === p.category);
  const waAsk = waLink(`Hi ${brand}! I have a question about: ${p.title}\n${SITE_URL}/${p.url}`);
  const disc = num(S.prepaid_discount_percent);
  const gal = p.images.map((img) => ({ img }));
  if (p.video) gal.splice(Math.min(1, gal.length), 0, { video: p.video });
  const body = `
<nav class="wrap crumbs" aria-label="Breadcrumb"><a href="${u()}">Home</a> / <a href="${u(cat.url)}">${esc(cat.plural)}</a> / <span>${esc(p.title)}</span></nav>
<section class="wrap product" data-fit="${esc(p.fit || "")}" data-chart="${esc(JSON.stringify(sizeRows.filter((r) => r.bust).map((r) => [r.size, r.bust])))}" data-product="${esc(p.slug)}" data-price="${p.price ?? ""}" data-usd="${p.price_usd ?? ""}" data-intl="${p.intl ? 1 : 0}">
  <div class="gallery">
    <div class="slides" data-slides>
      ${gal.map((m, i) => m.video
        ? `<figure class="slide slide-video"><video src="${esc(u(m.video))}"${p.images[0] ? ` poster="${esc(u(p.images[0]))}"` : ""} muted loop playsinline preload="none" data-pvideo aria-label="${esc(p.title)} – video"></video><span class="vid-badge" aria-hidden="true">▶ Reel</span></figure>`
        : `<figure class="slide"><img src="${esc(u(m.img))}" alt="${esc(p.title)} – photo ${i + 1}" width="1200" height="1800" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></figure>`).join("")}
    </div>
    ${gal.length > 1 ? `<div class="dots" data-dots>${gal.map((_, i) => `<button aria-label="Slide ${i + 1}"${i === 0 ? ' class="on"' : ""}></button>`).join("")}</div>
    <div class="thumbs">${gal.map((m, i) => `<button class="thumb${i === 0 ? " on" : ""}${m.video ? " thumb-video" : ""}" data-go="${i}" aria-label="${m.video ? "Video" : "Photo " + (i + 1)}"><img src="${esc(u(m.video ? (p.images[0] || "") : m.img))}" alt="" width="120" height="180" loading="lazy"></button>`).join("")}</div>` : ""}
  </div>
  <div class="buybox">
    <p class="eyebrow">${esc(p.category)}${p.color ? " · " + esc(p.color) : ""}</p>
    <div class="title-row"><h1 data-p-title="${esc(p.slug)}">${esc(p.title)}</h1><div class="pdp-actions"><button class="wish wish-lg" type="button" data-wish="${esc(p.slug)}" aria-label="Save to wishlist" aria-pressed="false">${I.heart}</button></div></div>
    <div class="pdp-price">${priceHtml(p)}</div>
    ${p.model_height || p.model_size || p.fit ? `<p class="fit-line">${[p.model_height ? `Model is ${esc(p.model_height)}` : "", p.model_size ? `wearing ${esc(p.model_size)}` : "", p.fit ? `${esc(p.fit)} fit` : ""].filter(Boolean).join(" · ")}</p>` : ""}
    ${p.price !== null ? `<p class="tax cur-inr">Inclusive of all taxes${disc ? ` · <strong>Extra ${disc}% off</strong> on online payment` : ""}</p>` : ""}
    ${intlOn && p.intl ? `<p class="tax cur-usd">${esc(S.intl_duty_note || "Prices exclude import duties and taxes of your country.")}</p>` : ""}
    ${p.sizes.length ? `<div class="sizes"><div class="label">Select size <span data-size-error role="alert" hidden>Please select a size</span><button class="size-guide" type="button" data-fit-open>✨ Mera size</button><button class="size-guide" type="button" data-open-size>${I.ruler} Size chart</button></div><div class="size-row" role="group" aria-label="Select size">${p.sizes.map((s) => `<button class="size${p.sold_out.includes(s) ? " out" : ""}" type="button" data-size="${esc(s)}" aria-pressed="false"${p.sold_out.includes(s) ? ' data-out="1" aria-label="' + esc(s) + ' – sold out, notify me"' : ""}>${esc(s)}</button>`).join("")}</div><p class="fit-note" data-fit-note hidden></p></div>` : ""}
    ${p.price !== null ? `<div class="buy-row"><button class="btn btn-block" data-add>Add to Bag</button><button class="btn btn-dark btn-block" data-buy>Buy Now</button></div>`
      : `<a class="btn btn-wa btn-block" href="${esc(waAsk)}" target="_blank" rel="noopener">${I.wa} Ask price on WhatsApp</a>`}
    ${intlOn && !p.intl && waNumber ? `<div class="intl-ask cur-usd"><p>${p.ships_abroad ? "International price for this style is shared on request." : "This style currently ships within India only."} Message us for availability and similar styles that ship to your country.</p><a class="btn btn-wa btn-block" href="${esc(waLink(`Hi ${brand}! I am outside India. Can you ship this to my country?\n${p.title}\n${SITE_URL}/${p.url}`))}" target="_blank" rel="noopener">${I.wa} Ask on WhatsApp</a></div>` : ""}
    ${waAsk && p.price !== null ? `<a class="ask-wa" href="${esc(waAsk)}" target="_blank" rel="noopener">${I.wa} Questions? Chat with us on WhatsApp</a>` : ""}
    <div class="deliv" data-deliv><form class="pin-check" data-pin-form><label class="cur-inr" for="pin-${esc(p.slug)}">Check delivery date</label>${intlOn ? `<label class="cur-usd" for="pin-${esc(p.slug)}">Delivery to your country</label>` : ""}<div class="pin-row"><input id="pin-${esc(p.slug)}" name="pin" inputmode="numeric" maxlength="6" autocomplete="postal-code" placeholder="Enter pincode" data-pin><button class="btn btn-ghost" type="submit">Check</button></div></form><p class="deliv-out" data-deliv-out aria-live="polite"></p></div>
    <div class="share-row"><button class="share-btn" type="button" data-share>${I.wa} Ask family</button><a class="share-btn" href="https://www.pinterest.com/pin/create/button/?url=${encodeURIComponent(SITE_URL + "/" + p.url)}&media=${encodeURIComponent(abs(p.images[0] || ""))}&description=${encodeURIComponent(p.title + " – " + brand)}" target="_blank" rel="noopener">${socialIcon("pinterest")} Save</a><button class="share-btn" type="button" data-copy-link>${I.tag} Copy link</button><button class="share-btn status-btn" type="button" data-status>✨ Make WhatsApp Status</button></div>
    <ul class="perks"><li>${I.truck}${esc(S.dispatch_note || "Ships from Jaipur")}</li>${p.ships_abroad && intlOn ? `<li>${I.globe}Ships worldwide · <a href="${u(S.intl_shipping_policy ? "international-shipping/" : "shipping/")}">delivery times</a></li>` : ""}<li>${I.shield}Secure prepaid payment</li><li>${I.swap}<a href="${u("returns/")}">Easy exchange policy</a></li></ul>
    <details open><summary>Description</summary><div data-p-desc="${esc(p.slug)}">${paras(p.description) || "<p>Handcrafted in Jaipur.</p>"}</div></details>
    <details><summary>Product details</summary><dl class="specs">
      ${p.color ? `<dt>Colour</dt><dd>${esc(p.color)}</dd>` : ""}${p.fabric ? `<dt>Fabric</dt><dd>${craftLink("fabric", p.fabric)}</dd>` : ""}${p.print_work.length ? `<dt>Print / work</dt><dd>${p.print_work.map((n) => craftLink("print", n)).join(", ")}</dd>` : ""}
      ${p.sizes.length ? `<dt>Sizes</dt><dd>${esc(p.sizes.join(", "))}</dd>` : ""}<dt>Made in</dt><dd>Jaipur, India</dd><dt>Status</dt><dd>${p.in_stock ? "In stock" : "Made to order"}</dd>
    </dl></details>
    ${(() => { const mine = reels.map((r, i) => [r, i]).filter(([r]) => r.product === p.slug); return mine.length ? `<div class="seen-on"><p class="label">📹 Isko pehne dekho${mine.some(([r]) => r.creator) ? " – influencers" : ""}</p><div class="reel-row seen-row">${mine.map(([r, i]) => `<div class="reel-item">${reelItem(r, i, true)}</div>`).join("")}</div></div>` : ""; })()}
    ${(() => { const rows = [...p.print_work.map((n) => ["print", n]), ...(p.fabric ? [["fabric", p.fabric]] : [])].map(([t, n]) => [n, craftInfo(t, n)]).filter(([, c]) => c); return rows.length ? `<details><summary>About the fabric & print</summary><div class="craft-about">${rows.map(([n, c]) => `<p><b>${esc(n)}</b>${c[0] ? ` <small class="muted">· ${esc(c[0])}</small>` : ""}<br>${esc(c[1])}<br><small>🧺 Care: ${esc(c[2])}</small></p>`).join("")}<p><a class="link" href="${u("craft/")}">Fabric & print guide →</a></p></div></details>` : ""; })()}
    <details class="passport" data-passport><summary>Craft passport</summary><div class="passport-body"><dl class="specs"><dt>Made in</dt><dd>Sanganer, Jaipur, India</dd><dt>Maker</dt><dd>${esc(brand)}</dd>${p.print_work.length ? `<dt>Craft</dt><dd>${esc(p.print_work.join(", "))}</dd>` : ""}${p.fabric ? `<dt>Fabric</dt><dd>${esc(p.fabric)}</dd>` : ""}<dt>Product ID</dt><dd>${esc(p.slug)}</dd></dl><div class="passport-qr"><div data-qr-box data-qr="${esc(SITE_URL + "/" + p.url + "?src=qr")}"></div><small>Scan to see this piece online. Printed on our tags.</small></div></div></details>
    <details><summary>Shipping & returns</summary><div>${paras(String(S.shipping_policy || "").split(/\n\s*\n/)[1] || S.dispatch_note)}<p><a href="${u("shipping/")}">Shipping (India)</a> · <a href="${u("returns/")}">Returns (India)</a>${S.intl_shipping_policy ? ` · <a href="${u("international-shipping/")}">International shipping</a>` : ""}${S.intl_return_policy ? ` · <a href="${u("international-returns/")}">International returns</a>` : ""}</p></div></details>
  </div>
</section>
${p.price !== null ? `<div class="sticky-buy" data-sticky><div><strong>${intlOn ? `<span class="cur-inr">${inr(p.price)}</span><span class="cur-usd">${p.intl ? usd(p.price_usd) : ""}</span>` : inr(p.price)}</strong><span>${esc(p.title)}</span></div><button class="btn" data-add>Add to Bag</button></div>` : ""}
${look.length ? `<section class="wrap section look"><div class="section-head"><div><p class="eyebrow">Shop the look</p><h2>Complete the look</h2></div>${look.some((x) => x.price !== null) ? `<button class="btn btn-ghost" type="button" data-add-look="${esc([p.slug, ...look.filter((x) => x.price !== null).map((x) => x.slug)].join(","))}">Add complete look</button>` : ""}</div><div class="grid">${look.map((p) => card(p)).join("")}</div></section>` : ""}
${p.sizes.length ? sizeDialog : ""}
${related.length ? `<section class="wrap section"><div class="section-head"><h2>You may also like</h2></div><div class="grid">${related.map((p) => card(p)).join("")}</div></section>` : ""}
<section class="wrap section recent" data-recent hidden><div class="section-head"><h2>Recently viewed</h2></div><div class="grid" data-recent-grid></div></section>`;
  const ld = {
    "@context": "https://schema.org", "@type": "Product", name: p.title, image: p.images.map(abs), description: String(p.description || "").replace(/\s+/g, " ").trim() || p.title,
    sku: p.slug, brand: { "@type": "Brand", name: brand }, category: p.category, color: p.color || undefined, material: p.fabric || undefined,
    ...(p.price !== null ? { offers: { "@type": "Offer", url: SITE_URL + "/" + p.url, priceCurrency: "INR", price: String(p.price), availability: p.in_stock ? "https://schema.org/InStock" : "https://schema.org/PreOrder", itemCondition: "https://schema.org/NewCondition", seller: { "@id": SITE_URL + "/#store" }, priceValidUntil: `${year + 1}-12-31`,
      shippingDetails: { "@type": "OfferShippingDetails", shippingRate: { "@type": "MonetaryAmount", value: String(p.price >= (num(S.free_shipping_above) || Infinity) ? 0 : num(S.shipping_charge) || 0), currency: "INR" }, shippingDestination: { "@type": "DefinedRegion", addressCountry: "IN" },
        deliveryTime: { "@type": "ShippingDeliveryTime", handlingTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: num(S.dispatch_days) || 3, unitCode: "DAY" }, transitTime: { "@type": "QuantitativeValue", minValue: 2, maxValue: num(S.transit_days_max) || 7, unitCode: "DAY" } } },
      hasMerchantReturnPolicy: !num(S.return_days) ? undefined : { "@type": "MerchantReturnPolicy", applicableCountry: "IN", returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow", merchantReturnDays: num(S.return_days), returnMethod: "https://schema.org/ReturnByMail" } } } : {}),
  };
  const crumbs = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL + "/" },
    { "@type": "ListItem", position: 2, name: cat.plural, item: SITE_URL + "/" + cat.url },
    { "@type": "ListItem", position: 3, name: p.title, item: SITE_URL + "/" + p.url }] };
  const myReel = reels.find((r) => r.product === p.slug && r.video);
  const pmini = myReel || p.video ? { video: u(myReel ? myReel.video : p.video), cover: myReel?.cover ? u(myReel.cover) : u(p.images[0] || ""), caption: myReel?.caption || "See it on", product: { title: p.title, url: u(p.url), image: u(p.images[0] || ""), price: priceHtml(p) } } : defaultMini();
  const ogP = p.price !== null ? `<meta property="product:price:amount" content="${p.price}"><meta property="product:price:currency" content="INR"><meta property="product:availability" content="${p.in_stock ? "in stock" : "preorder"}"><meta property="product:brand" content="${esc(brand)}">` : "";
  add(p.url + "index.html", page({ og: ogP, mini: pmini, title: p.seo_title || `${p.title} | ${brand}`, description: desc, pathname: p.url, image: p.images[0], body, ld: p.price !== null ? [ld, crumbs] : [crumbs], type: "product", bodyClass: "pdp" }));
}

// ---------- checkout ----------
add("checkout/index.html", page({
  title: `Checkout | ${brand}`, description: "Secure checkout", pathname: "checkout/", noindex: true, bodyClass: "checkout-page",
  body: `
<section class="wrap section checkout" data-checkout>
  <h1>Checkout</h1>
  <div class="co-grid">
    <form class="co-form" data-co-form novalidate>
      <h2>Delivery details</h2>
      <div class="f2">
        <label>Full name<input name="name" autocomplete="name" required maxlength="80"></label>
        <label><span class="cur-inr">Mobile number</span><span class="cur-usd">Phone / WhatsApp (with country code)</span><input name="phone" type="tel" inputmode="tel" autocomplete="tel" required maxlength="18" placeholder="10-digit mobile" data-phone></label>
      </div>
      <label>Email (for order updates<span class="cur-usd"> and PayPal invoice</span>)<input name="email" type="email" autocomplete="email" maxlength="100" data-email></label>
      ${intlOn ? `<label class="cur-usd">Country<input name="country" autocomplete="country-name" maxlength="60" list="countries" data-country></label>
      <datalist id="countries">${allCountries.map((c) => `<option value="${c}">`).join("")}</datalist>` : ""}
      <label>House no., building, street, area<textarea name="address" autocomplete="street-address" required rows="2" maxlength="200"></textarea></label>
      <div class="f3">
        <label><span class="cur-inr">Pincode</span><span class="cur-usd">ZIP / Postal code</span><input name="pincode" autocomplete="postal-code" required maxlength="12" inputmode="numeric" data-pin></label>
        <label>City<input name="city" autocomplete="address-level2" required maxlength="60"></label>
        <label><span class="cur-inr">State</span><span class="cur-usd">State / Province</span><input name="state" autocomplete="address-level1" maxlength="40" list="states" data-state></label>
      </div>
      <datalist id="states">${["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Delhi","Jammu and Kashmir","Ladakh","Chandigarh","Puducherry"].map((s) => `<option value="${s}">`).join("")}</datalist>
      <details class="gift"><summary>🎁 This is a gift</summary><div class="gift-body"><label>Recipient name<input name="gift_to" maxlength="60"></label><label>Gift message (printed on a card)<textarea name="gift_msg" rows="2" maxlength="150"></textarea></label><label class="check"><input type="checkbox" name="gift_hide" value="yes"> Do not put the price in the parcel</label><p class="muted small">Enter the recipient's address above as the delivery address.</p></div></details>
      <label class="check"><input type="checkbox" name="consent" value="yes" data-co-consent> Send me offers and new arrivals on WhatsApp / email</label>
      <h2>Payment</h2>
      <div class="pay-opts" data-pay-opts><p class="muted">Loading payment options…</p></div>
      <p class="form-error" data-co-error hidden></p>
      <button class="btn btn-block btn-lg" type="submit" data-place disabled>Place order</button>
      ${intlOn ? `<p class="secure cur-usd">${I.shield} International orders are prepaid in USD through a secure PayPal invoice (cards accepted). We ship after payment.</p>` : ""}
      <p class="secure" data-secure hidden>${I.shield} Payments are processed securely by Razorpay. We never see your card details.</p>
    </form>
    <aside class="co-summary">
      <h2>Order summary</h2>
      <div data-co-items></div>
      <div class="totals" data-co-totals></div>
    </aside>
  </div>
</section>
<section class="wrap section done" data-done hidden></section>`,
}));

// ---------- info pages ----------
function infoPage(file, pathname, title, h1, html, description) {
  add(file, page({ title, description, pathname, ld: [crumbLd([[h1, pathname]])], body: `<section class="wrap section prose"><nav class="crumbs" aria-label="Breadcrumb"><a href="${u()}">Home</a> / <span>${esc(h1)}</span></nav><h1>${esc(h1)}</h1>${html}</section>` }));
}
const contactHtml = `
  <p>We are a Jaipur-based label. Message us anytime, we usually reply within a few hours.</p>
  <ul class="contact-list">
    ${waNumber ? `<li><strong>WhatsApp / Call:</strong> <a href="${esc(waLink(`Hi ${brand}!`))}" target="_blank" rel="noopener">${esc(S.phone || "+" + waNumber)}</a></li>` : ""}
    ${S.email ? `<li><strong>Email:</strong> <a href="mailto:${esc(S.email)}">${esc(S.email)}</a></li>` : ""}
    <li><strong>Address:</strong> ${esc(S.address || "Jaipur, Rajasthan, India")}</li>
    ${[...socials, ...markets].map((x) => `<li><strong>${esc(x.name)}:</strong> <a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""))}</a></li>`).join("")}
  </ul>
  ${waNumber ? `<p><a class="btn btn-wa" href="${esc(waLink(`Hi ${brand}!`))}" target="_blank" rel="noopener">${I.wa} Chat on WhatsApp</a></p>` : ""}`;
infoPage("about/index.html", "about/", `Our Story – ${brand}, Jaipur`, S.about_title || "Our Story", paras(S.about_text) + `<h2>Get in touch</h2>` + contactHtml, clip(`${brand} is a Jaipur label making kurtis and dresses for women. ${S.tagline || ""}`));
infoPage("contact/index.html", "contact/", `Contact Us | ${brand}`, "Contact Us", contactHtml, `Contact ${brand}, Jaipur for orders, sizes, custom requests and bulk enquiries. Chat with us on WhatsApp${S.email ? " or write to us by email" : ""}.`);
infoPage("shipping/index.html", "shipping/", `Shipping Policy | ${brand}`, "Shipping Policy", paras(S.shipping_policy), `Shipping policy of ${brand}: dispatch time from Jaipur, delivery time across India, tracking details and made-to-order timelines.`);
infoPage("returns/index.html", "returns/", `Returns, Exchange & Refund Policy | ${brand}`, "Returns, Exchange & Refunds", paras(S.return_policy), `Return, exchange and refund policy of ${brand}: how to request an exchange, eligible products and refund timelines for online payments.`);
infoPage("privacy/index.html", "privacy/", `Privacy Policy | ${brand}`, "Privacy Policy", paras(S.privacy_policy), `Privacy policy of ${brand}: what details we collect for your order, how we use them, secure payments via Razorpay and how to delete your data.`);
infoPage("terms/index.html", "terms/", `Terms & Conditions | ${brand}`, "Terms & Conditions", paras(S.terms), `Terms and conditions for shopping on the ${brand} website: orders, pricing, payments, cancellations and governing law.`);

if (S.intl_shipping_policy) infoPage("international-shipping/index.html", "international-shipping/", `International Shipping Policy | ${brand}`, "International Shipping", paras(S.intl_shipping_policy), `International shipping policy of ${brand}, Jaipur: countries we ship to, delivery times, charges in USD and import duties.`);
if (S.intl_return_policy) infoPage("international-returns/index.html", "international-returns/", `International Returns & Refunds | ${brand}`, "International Returns & Refunds", paras(S.intl_return_policy), `Return and refund policy for international orders from ${brand}, Jaipur.`);

// ---------- refer & earn (customer-to-customer growth) ----------
{ const offer = String(S.referral_offer || "a thank-you discount on your next order").trim(), friend = String(S.referral_friend_offer || "a welcome discount on their first order").trim();
  add("refer/index.html", page({ title: `Refer & Earn | ${brand}`, description: clip(`Share ${brand} with friends and family. When they place their first order, you get ${offer} and they get ${friend}.`), pathname: "refer/", bodyClass: "refer-page",
  body: `<section class="refer-hero"><div class="wrap"><p class="eyebrow">Share the love of hand block prints</p><h1>Saheli Credit · Refer & Earn</h1><p class="lead">Send your personal link to friends and family. When they place their first order, <b>you get ${esc(offer)}</b> and <b>they get ${esc(friend)}</b>.</p></div></section>
<section class="wrap section refer-box" data-refer>
  <div data-refer-out><p class="muted">Sign in once to get your personal link.</p><button class="btn" type="button" data-open-login>Sign in to get my link</button></div>
</section>
<section class="wrap section"><div class="section-head center"><p class="eyebrow">How it works</p><h2>3 simple steps</h2></div><ol class="steps"><li><strong>Get your link</strong><span>Sign in with your name and WhatsApp number.</span></li><li><strong>Share it</strong><span>On WhatsApp, Instagram or as your WhatsApp status – one tap.</span></li><li><strong>Both of you save</strong><span>We confirm your reward on WhatsApp after your friend's order is delivered.</span></li></ol>
<div class="terms-box"><p><strong>Fair rules:</strong> Reward is given after the friend's first order is delivered and not returned. One reward per new customer. Self-referrals (same phone or address) do not count. ${esc(S.referral_terms || "")}</p></div></section>` })); }

// ---------- BAHE 2050 My Designs: community voting + viral sharing ----------
{ const voteItems = products.filter((p) => p.images && p.images[0]).slice(0, 12);
  add("designs/index.html", page({ title: `My Designs · Vote & Share | ${brand}`, description: clip(`Vote for the ${brand} styles you want next and share your picks with family and friends.`), pathname: "designs/", bodyClass: "designs-page",
  body: `<section class="refer-hero"><div class="wrap"><p class="eyebrow">BAHE 2050 · you help choose</p><h1>My Designs · Vote & Share</h1><p class="lead">Tap the looks you love. Save your picks on this device and share your vote with family or friends.</p></div></section>
<section class="wrap section"><div class="design-vote-grid" data-design-grid>${voteItems.map((p) => `<button type="button" class="design-vote" data-design-vote="${esc(p.slug)}" aria-pressed="false"><img src="${esc(u(p.images[0]))}" alt="${esc(p.title)}" width="600" height="800" loading="lazy"><span><b>${esc(p.title)}</b><em>♡ Vote</em></span></button>`).join("")}</div><div class="design-share"><p><b data-design-count>0</b> looks selected</p><button class="btn btn-wa" type="button" data-design-share>${I.wa} Share my picks</button><a class="btn btn-ghost" href="${u("mirror/")}">🪞 Try in Mirror</a></div></section>` })); }

// ---------- e-gift card (great for NRIs gifting family) ----------
{ const inrA = (Array.isArray(S.gift_amounts_inr) && S.gift_amounts_inr.length ? S.gift_amounts_inr : [1000, 1500, 2500]).map(num).filter(Boolean), usdA = (Array.isArray(S.gift_amounts_usd) && S.gift_amounts_usd.length ? S.gift_amounts_usd : [25, 40, 60]).map(num).filter(Boolean);
  add("gift-card/index.html", page({ title: `E-Gift Card – Let Them Choose | ${brand}`, description: clip(`Send a ${brand} e-gift card to family in India or anywhere in the world. They choose their own size and print. Prepaid, delivered on WhatsApp.`), pathname: "gift-card/", bodyClass: "gift-page",
  body: `<section class="refer-hero"><div class="wrap"><p class="eyebrow">Tum chuno · Let them choose</p><h1>E-Gift Card</h1><p class="lead">Not sure of her size or favourite print? Send a ${esc(brand)} gift card. She picks what she loves. Perfect for Diwali, Rakhi, birthdays and weddings – from India or abroad.</p></div></section>
<section class="wrap section gift-form-wrap"><form class="b2b-form" data-gc-form>
  <div><p class="label">Choose amount</p><div class="gc-amts"><span class="cur-inr">${inrA.map((a, i) => `<label class="gc-amt"><input type="radio" name="amt" value="₹${a}"${i === 1 ? " checked" : ""}><span>₹${a.toLocaleString("en-IN")}</span></label>`).join("")}</span>${intlOn ? `<span class="cur-usd">${usdA.map((a, i) => `<label class="gc-amt"><input type="radio" name="amt_usd" value="$${a}"${i === 1 ? " checked" : ""}><span data-usdv="${a}">$${a}</span></label>`).join("")}</span>` : ""}</div></div>
  <div class="f2"><label>Her name<input name="to" required maxlength="60"></label><label>Her WhatsApp (optional)<input name="to_phone" type="tel" maxlength="18"></label></div>
  <label>Your message<textarea name="msg" rows="2" maxlength="150" placeholder="Happy Diwali Didi! Pick something you love."></textarea></label>
  <div class="f2"><label>Your name<input name="from" required maxlength="60" autocomplete="name"></label><label>Your WhatsApp<input name="from_phone" type="tel" required maxlength="18" autocomplete="tel"></label></div>
  <button class="btn btn-wa btn-block btn-lg" type="submit">${I.wa} Order gift card on WhatsApp</button>
  <p class="muted small">Prepaid. We confirm payment on WhatsApp and send the gift card code + a beautiful card image to you (or straight to her).</p>
</form></section>
<section class="wrap section"><div class="section-head center"><p class="eyebrow">Already have a code?</p><h2>Make the gift card image</h2></div><form class="b2b-form" data-gc-make><div class="f2"><label>Gift card code<input name="code" required maxlength="24" placeholder="GIFT-XXXX"></label><label>For<input name="to" required maxlength="40"></label></div><label>Amount<input name="amt" required maxlength="12" placeholder="₹1,500"></label><button class="btn btn-block" type="submit">✨ Make & share card</button></form></section>` }));
  add("redeem/index.html", page({ title: `Redeem gift card | ${brand}`, description: "Redeem your gift card", pathname: "redeem/", noindex: true, body: `<section class="wrap section prose center" data-redeem><h1>🎁 You have a gift!</h1><p>Your gift card code is saved on this phone. Pick anything you love – the code will be added to your order message automatically.</p><p class="gc-code" data-redeem-code></p><p><a class="btn" href="${u("shop/")}">Start shopping</a></p></section>` })); }

// ---------- feed: full-screen vertical reels of products (Instagram/Reels style) ----------
{ const items = [];
  for (const r of reels) { const p = products.find((x) => x.slug === r.product); if (r.video || r.cover) items.push({ vid: r.video, img: r.cover, cap: r.caption, p }); }
  for (const p of products) { if (p.video && !items.some((x) => x.p === p && x.vid)) items.push({ vid: p.video, img: p.images[0], cap: p.title, p }); else if (p.images[0] && !items.some((x) => x.p === p)) items.push({ vid: "", img: p.images[1] || p.images[0], cap: p.title, p }); }
  add("feed/index.html", page({ title: `Feed – Watch & Shop | ${brand}`, description: clip(`Scroll the ${brand} feed: hand block printed kurtis and dresses from Jaipur in short videos and photos. Like, share and shop.`), pathname: "feed/", bodyClass: "feed-page", mini: null,
  body: `<section class="feed" data-feed>${items.map((it, i) => `<article class="feed-item" data-fi>${it.vid ? `<video data-src="${esc(u(it.vid))}"${it.img ? ` poster="${esc(u(it.img))}"` : ""} muted loop playsinline preload="none"></video>` : `<img src="${esc(u(it.img))}" alt="${esc(it.cap || brand)}" width="1080" height="1920" loading="${i < 2 ? "eager" : "lazy"}">`}
  <div class="feed-side">${it.p ? `<button class="feed-act wish" type="button" data-wish="${esc(it.p.slug)}" aria-label="Like" aria-pressed="false">${I.heart}<span>Like</span></button>` : ""}<button class="feed-act" type="button" data-feed-share="${esc(it.p ? SITE_URL + "/" + it.p.url : SITE_URL)}" aria-label="Share">${I.wa}<span>Share</span></button>${it.vid ? `<button class="feed-act" type="button" data-feed-sound aria-label="Sound">🔇<span>Sound</span></button>` : ""}</div>
  <div class="feed-info"><p class="feed-brand">${esc(brand)} · Jaipur</p>${it.cap ? `<p class="feed-cap">${esc(it.cap)}</p>` : ""}${it.p ? `<a class="feed-shop" href="${u(it.p.url)}"><span>${esc(it.p.title)}</span><b class="card-price">${priceHtml(it.p)}</b><em>Shop →</em></a>` : ""}</div></article>`).join("")}</section>` })); }

// ---------- Mirror 2.0: your photo, dresses appear on you one by one, Haan / Na, family vote ----------
add("mirror/index.html", page({ title: `Mirror – Try Every Dress On Your Photo | ${brand}`, description: clip(`Add your photo and every ${brand} dress appears on you, one by one. Tap Haan or Na, make your shortlist for the wedding or function, and ask family on WhatsApp which one suits you.`), pathname: "mirror/", bodyClass: "mirror-page", mini: null,
  body: `<section class="refer-hero"><div class="wrap"><p class="eyebrow">Mirror · beta</p><h1>Har dress, aap par</h1><p class="lead">Apni photo daalo. Har dress ek-ek karke aap par aayegi. Pasand aaye to <b>💚 Haan</b>, nahi to <b>✕ Na</b>. Aakhir mein family se poochho: "Kaunsi pehnu?" Your photo stays on your phone – it is never uploaded.</p></div></section>
<section class="wrap section mirror" data-mirror>
  <div class="mirror-main">
    <div class="mirror-stage" data-mirror-stage><div class="mirror-empty" data-mirror-empty><p><b>Step 1:</b> apni full-length photo daalo<br><small class="muted">Seedhe khade ho, saamne se, achhi roshni mein</small></p><label class="btn">📷 Add my photo<input type="file" accept="image/*" data-mirror-file hidden></label></div><img data-mirror-me alt="" hidden><img class="mirror-dress" data-mirror-dress alt="" hidden><div class="mirror-hud" data-mirror-hud hidden><span data-mirror-count></span><span data-mirror-name></span></div><p class="mirror-status" data-mirror-status hidden></p><div class="mirror-flash" data-mirror-flash></div></div>
    <div class="mirror-vote" data-mirror-vote hidden><button type="button" class="mv-no" data-mirror-no aria-label="Na">✕<small>Na</small></button><button type="button" class="mv-play" data-mirror-play aria-label="Pause">⏸</button><button type="button" class="mv-yes" data-mirror-yes aria-label="Haan">💚<small>Haan</small></button></div>
    <p class="muted small center" data-mirror-tip hidden>Swipe ← Na · Haan → · Dress ko ungli se khiskao · Photo par tap karo to dress wahan aayegi</p>
  </div>
  <div class="mirror-side">
    <p class="label">Occasion</p><div class="mirror-occ" data-mirror-occ></div>
    <p class="label">Ya khud chuno <small class="muted">(tap to try)</small></p><div class="mirror-picks" data-mirror-picks></div>
    <div class="mirror-tools"><label>Dress size <input type="range" min="20" max="120" value="52" data-mirror-scale></label><label>See-through <input type="range" min="40" max="100" value="100" data-mirror-op></label></div>
    <p class="label">💚 Aapki pasand <span data-mirror-liked-n></span></p><div class="mirror-board" data-mirror-board><p class="muted small">Jo dress "Haan" karogi, wo yahan aayegi.</p></div>
    <div class="mirror-actions"><button class="btn btn-wa" type="button" data-mirror-share>${I.wa} Family se poochho: kaunsi?</button><button class="btn btn-ghost" type="button" data-mirror-card>🖼️ Top 3 vote card</button><button class="btn btn-ghost" type="button" data-mirror-wish>♡ Sab wishlist mein</button></div>
    <p class="muted small">Beta: ye photo ke upar dress ka andaaza hai, exact fitting nahi. Size ke liye size chart dekho.</p></div>
</section>` }));

// ---------- wishlist (filled by the browser) ----------
add("wishlist/index.html", page({ title: `Wishlist | ${brand}`, description: "Your saved styles", pathname: "wishlist/", noindex: true,
  body: `<section class="wrap section"><nav class="crumbs" aria-label="Breadcrumb"><a href="${u()}">Home</a> / <span>Wishlist</span></nav><div class="list-head"><h1>Your Wishlist</h1><p class="muted">Styles you saved with ${I.heart.replace('width="20" height="20"', 'width="16" height="16"')} are kept on this device.</p></div><p class="empty" data-wish-empty>No saved styles yet. <a class="link" href="${u("shop/")}">Start shopping →</a></p><div class="grid" data-wish-grid></div></section>` }));

// ---------- wholesale / private label / export (B2B) ----------
{
  const cats = categories.map((c) => c.plural);
  const waB2B = waLink(`Hi ${brand}! I am interested in wholesale / private label.`);
  const steps = [["Share your requirement", "Styles, fabric, quantity, sizes and target country on WhatsApp or email."], ["Catalogue & samples", "We share our catalogue, swatches and sample options for your selection."], ["Price & approval", "You get a written quotation. Production starts after you approve the sample."], ["Advance & production", "Advance payment confirms the order. Printing and stitching in our Jaipur unit."], ["Quality check", "Every piece is checked. You get photos and videos before dispatch."], ["Dispatch", "Shipped with GST invoice and tracking, across India and worldwide."]];
  const body = `
<section class="b2b-hero">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="${u()}">Home</a> / <span>Wholesale</span></nav>
    <p class="eyebrow">Manufacturer · Sanganer, Jaipur</p>
    <h1>Wholesale, Private Label & Export</h1>
    <p class="lead">${esc(S.wholesale_intro || `Women's ethnic wear made in our own unit in Jaipur, the home of hand block printing. For boutiques, online sellers, fashion brands and importers.`)}</p>
    <div class="hero-cta">${waB2B ? `<a class="btn btn-wa" href="${esc(waB2B)}" target="_blank" rel="noopener">${I.wa} WhatsApp enquiry</a>` : ""}<a class="btn btn-light" href="#enquiry">Send requirement</a></div>
  </div>
</section>
<section class="wrap section">
  <div class="svc">
    <article>${I.box}<h2>Wholesale</h2><p>Ready designs and running styles for boutiques, retailers and online sellers. Mixed sizes and colours per design.</p></article>
    <article>${I.tag}<h2>Private Label</h2><p>Your brand name on neck labels, tags and packaging. Produce our designs or your own tech packs and samples.</p></article>
    <article>${I.globe}<h2>Export</h2><p>Bulk and repeat orders for buyers in every country – from the USA, UK and Europe to the Middle East, Africa, Asia and Australia – with export paperwork.</p></article>
  </div>
</section>
<section class="b2b-what"><div class="wrap two-col">
  <div><p class="eyebrow">What we make</p><h2>Products</h2><ul class="tick-list">${(cats.length ? cats : ["Kurtis", "Kurta sets with dupatta", "Dresses", "Co-ord sets", "Kaftans", "Tops & tunics"]).map((c) => `<li>${esc(c)}</li>`).join("")}</ul></div>
  <div><p class="eyebrow">Prints & fabrics</p><h2>Craft</h2><ul class="tick-list">${uniq([...prints, "Hand Block Print", "Sanganeri Print", "Bagru Print", "Dabu Print"]).slice(0, 10).map((c) => `<li>${esc(c)}</li>`).join("")}${fabrics.length ? `<li>Fabrics: ${esc(fabrics.slice(0, 8).join(", "))}</li>` : `<li>Cotton, rayon, linen, georgette & more</li>`}</ul></div>
</div></section>
<section class="wrap section"><div class="section-head center"><p class="eyebrow">How it works</p><h2>From enquiry to dispatch</h2></div>
  <ol class="steps">${steps.map(([a, b]) => `<li><strong>${esc(a)}</strong><span>${esc(b)}</span></li>`).join("")}</ol>
  <div class="terms-box"><p><strong>Minimum order:</strong> ${esc(S.wholesale_moq || "Depends on the design and fabric. Small boutique orders are welcome. Ask us on WhatsApp.")}</p><p><strong>Payment:</strong> ${esc(S.wholesale_payment || "Advance payment only (bank transfer / UPI in India, PayPal or wire transfer for international buyers). No cash on delivery.")}</p><p><strong>Prices:</strong> Shared as a written quotation after we understand your requirement.</p></div>
</section>
<section class="wrap section enquiry" id="enquiry">
  <div class="section-head center"><p class="eyebrow">Get a quotation</p><h2>Send your requirement</h2><p class="muted">Fill this and tap send. It opens WhatsApp with your details ready${S.email ? `, or email us at <a class="link" href="mailto:${esc(S.email)}">${esc(S.email)}</a>` : ""}.</p></div>
  <form class="b2b-form" data-b2b-form>
    <div class="f2"><label>Your name<input name="name" required maxlength="80" autocomplete="name"></label><label>Business / brand name<input name="business" maxlength="100" autocomplete="organization"></label></div>
    <div class="f2"><label>Email<input name="email" type="email" required maxlength="120" autocomplete="email"></label><label>WhatsApp (with country code)<input name="phone" type="tel" maxlength="20" autocomplete="tel" placeholder="+44 7..."></label></div>
    <div class="f2"><label>Country<input name="country" required maxlength="60" list="countries-b2b" autocomplete="country-name"></label><label>I am a<select name="type"><option>Boutique / retailer</option><option>Online seller</option><option>Fashion brand (private label)</option><option>Importer / distributor</option><option>Other</option></select></label></div>
    <datalist id="countries-b2b"><option value="India">${allCountries.map((c) => `<option value="${c}">`).join("")}</datalist>
    <div class="f2"><label>Products<input name="products" maxlength="140" placeholder="e.g. cotton kurta sets, block print dresses"></label><label>Quantity (approx.)<input name="qty" maxlength="40" placeholder="e.g. 100 pcs per design"></label></div>
    <label>Details (optional)<textarea name="msg" rows="3" maxlength="600" placeholder="Sizes, colours, own label, target price, timeline…"></textarea></label>
    <button class="btn btn-wa btn-block btn-lg" type="submit">${I.wa} Send on WhatsApp</button>
  </form>
</section>`;
  add("wholesale/index.html", page({ title: `Wholesale & Private Label Kurti Manufacturer, Jaipur | ${brand}`, description: clip(`Wholesale and private label women's ethnic wear manufacturer in Sanganer, Jaipur. Hand block print kurtis, kurta sets, dresses and co-ords for boutiques, brands and importers.`), pathname: "wholesale/", body, bodyClass: "wholesale-page",
    ld: [{ "@context": "https://schema.org", "@type": "Service", serviceType: "Wholesale and private label clothing manufacturing", provider: { "@id": SITE_URL + "/#store" }, areaServed: "Worldwide", url: SITE_URL + "/wholesale/" }] }));
}

// ---------- blog ----------
// Small, safe markdown → HTML (headings, bold, italic, links, images, lists, quotes)
function md(src = "") {
  const safeUrl = (x) => (/^(https?:\/\/|\/|#|mailto:)/i.test(x.trim()) ? x.trim() : "#");
  const inline = (t) => esc(t)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, a, h) => `<img src="${esc(u(safeUrl(h)))}" alt="${a}" loading="lazy">`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, a, h) => { const x = safeUrl(h); return `<a href="${esc(u(x))}"${/^https?:/.test(x) && !x.includes(SITE_URL) ? ' target="_blank" rel="noopener"' : ""}>${a}</a>`; })
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>").replace(/(^|\W)_([^_]+)_(?=\W|$)/g, "$1<em>$2</em>").replace(/`([^`]+)`/g, "<code>$1</code>");
  const out = []; let list = null, para = [];
  const flushP = () => { if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };
  const flushL = () => { if (list) { out.push(`<${list.t}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.t}>`); list = null; } };
  for (const raw of String(src).replace(/\r/g, "").split("\n")) {
    const line = raw.trim(); let m;
    if (!line) { flushP(); flushL(); continue; }
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) { flushP(); flushL(); const lv = Math.min(4, Math.max(2, m[1].length)); out.push(`<h${lv}>${inline(m[2])}</h${lv}>`); continue; }
    if ((m = line.match(/^[-*+]\s+(.*)$/))) { flushP(); if (!list || list.t !== "ul") { flushL(); list = { t: "ul", items: [] }; } list.items.push(m[1]); continue; }
    if ((m = line.match(/^\d+[.)]\s+(.*)$/))) { flushP(); if (!list || list.t !== "ol") { flushL(); list = { t: "ol", items: [] }; } list.items.push(m[1]); continue; }
    if ((m = line.match(/^>\s?(.*)$/))) { flushP(); flushL(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); continue; }
    if (/^!\[[^\]]*\]\([^)]+\)$/.test(line)) { flushP(); flushL(); out.push(`<figure>${inline(line)}</figure>`); continue; }
    flushL(); para.push(line);
  }
  flushP(); flushL();
  return out.join("\n");
}
const blogDir = path.join(ROOT, "content/blog");
const posts = (fs.existsSync(blogDir) ? fs.readdirSync(blogDir) : []).filter((f) => f.endsWith(".json")).map((f) => {
  const b = JSON.parse(fs.readFileSync(path.join(blogDir, f), "utf8"));
  b.slug = slugify(f.replace(/\.json$/, "")).replace(/^-+|-+$/g, "") || "post-" + [...f].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(36);
  b.url = `blog/${b.slug}/`;
  b.date = String(b.date || today).slice(0, 10);
  b.tags = (b.tags || []).filter(Boolean);
  b.related = (b.related_products || []).map((s) => products.find((p) => p.slug === slugify(s) || p.title === s)).filter(Boolean);
  return b;
}).filter((b) => b.title && b.draft !== true && b.date <= today).sort((a, b) => b.date.localeCompare(a.date));
const niceDate = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
const postCard = (b) => `<article class="post-card"><a href="${u(b.url)}">
  ${b.cover ? `<div class="post-img"><img src="${esc(u(b.cover))}" alt="${esc(b.title)}" width="1200" height="800" loading="lazy"></div>` : ""}
  <p class="eyebrow">${esc(niceDate(b.date))}${b.tags[0] ? " · " + esc(b.tags[0]) : ""}</p><h3>${esc(b.title)}</h3><p class="muted">${esc(b.excerpt || "")}</p></a></article>`;

add("blog/index.html", page({
  title: `Style Journal – Kurti Styling Tips & Jaipur Fashion | ${brand}`,
  description: `Kurti styling tips, fabric and care guides, festive outfit ideas and stories from our studio in Jaipur, by ${brand}.`,
  pathname: "blog/",
  body: `<section class="wrap section"><nav class="crumbs" aria-label="Breadcrumb"><a href="${u()}">Home</a> / <span>Blog</span></nav>
  <div class="list-head"><p class="eyebrow">Style Journal</p><h1>The ${esc(brand)} Blog</h1><p class="muted">Styling tips, fabric guides and stories from Jaipur.</p></div>
  ${posts.length ? `<div class="posts">${posts.map(postCard).join("")}</div>` : `<p class="center muted">New posts coming soon.</p>`}</section>`,
  ld: [{ "@context": "https://schema.org", "@type": "Blog", name: `${brand} Blog`, url: SITE_URL + "/blog/", blogPost: posts.map((b) => ({ "@type": "BlogPosting", headline: b.title, url: SITE_URL + "/" + b.url, datePublished: b.date })) }],
}));
for (const b of posts) {
  const more = posts.filter((x) => x.slug !== b.slug).slice(0, 3);
  const shareText = encodeURIComponent(`${b.title} ${SITE_URL}/${b.url}`);
  const body = `
<article class="wrap section post">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="${u()}">Home</a> / <a href="${u("blog/")}">Blog</a> / <span>${esc(b.title)}</span></nav>
  <header class="post-head"><p class="eyebrow">${esc(niceDate(b.date))}${b.tags.length ? " · " + b.tags.map(esc).join(", ") : ""}</p><h1>${esc(b.title)}</h1>${b.excerpt ? `<p class="lead">${esc(b.excerpt)}</p>` : ""}</header>
  ${b.cover ? `<img class="post-cover" src="${esc(u(b.cover))}" alt="${esc(b.title)}" width="1200" height="800" fetchpriority="high">` : ""}
  <div class="post-body prose">${md(b.body)}</div>
  <p class="share">Share: <a href="https://wa.me/?text=${shareText}" target="_blank" rel="noopener">WhatsApp</a> · <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SITE_URL + "/" + b.url)}" target="_blank" rel="noopener">Facebook</a> · <a href="https://pinterest.com/pin/create/button/?url=${encodeURIComponent(SITE_URL + "/" + b.url)}&description=${encodeURIComponent(b.title)}" target="_blank" rel="noopener">Pinterest</a></p>
</article>
${b.related.length ? `<section class="wrap section"><div class="section-head"><h2>Shop this story</h2></div><div class="grid">${b.related.slice(0, b.related.length >= 4 ? 4 : Math.min(2, b.related.length)).map((p) => card(p)).join("")}</div></section>` : ""}
${more.length ? `<section class="wrap section"><div class="section-head"><h2>More from the blog</h2><a class="link" href="${u("blog/")}">All posts →</a></div><div class="posts">${more.map(postCard).join("")}</div></section>` : ""}`;
  add(b.url + "index.html", page({
    title: b.seo_title || `${b.title} | ${brand}`, description: clip(b.seo_description || b.excerpt || b.title), pathname: b.url, image: b.cover, type: "article", body,
    ld: [{ "@context": "https://schema.org", "@type": "BlogPosting", headline: b.title, description: b.excerpt || undefined, image: b.cover ? [abs(b.cover)] : undefined,
      datePublished: b.date, dateModified: b.date, author: { "@type": "Organization", name: brand }, publisher: { "@id": SITE_URL + "/#store" }, mainEntityOfPage: SITE_URL + "/" + b.url, keywords: b.tags.join(", ") || undefined },
      { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: SITE_URL + "/" }, { "@type": "ListItem", position: 2, name: "Blog", item: SITE_URL + "/blog/" }, { "@type": "ListItem", position: 3, name: b.title, item: SITE_URL + "/" + b.url }] }],
  }));
}

// ---------- SEO landing pages (content/landing/*.json) – rank for "manufacturer / wholesale" searches ----------
for (const l of landings) {
  const words = String(l.match || "").toLowerCase().split(",").map((x) => x.trim()).filter(Boolean);
  const items = (words.length ? products.filter((p) => words.some((w) => [p.title, p.category, p.fabric, p.print_work.join(" ")].join(" ").toLowerCase().includes(w))) : products).slice(0, 8);
  const waL = waLink(`Hi ${brand}! I saw your page: ${l.h1}. I want details.`);
  const body = `
<section class="b2b-hero land-hero"><div class="wrap">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="${u()}">Home</a> / <span>${esc(l.h1)}</span></nav>
  <p class="eyebrow">${esc(l.eyebrow || "Manufacturer · Sanganer, Jaipur")}</p>
  <h1>${esc(l.h1)}</h1>
  ${l.lead ? `<p class="lead">${esc(l.lead)}</p>` : ""}
  <div class="hero-cta">${waL ? `<a class="btn btn-wa" href="${esc(waL)}" target="_blank" rel="noopener">${I.wa} WhatsApp us</a>` : ""}<a class="btn btn-light" href="${u("wholesale/")}#enquiry">Get a quotation</a></div>
</div></section>
${items.length ? `<section class="wrap section"><div class="section-head"><div><p class="eyebrow">From our collection</p><h2>${esc(l.products_title || "Styles we make")}</h2></div><a class="link" href="${u("shop/")}">View all →</a></div><div class="grid">${items.map((p) => card(p)).join("")}</div></section>` : ""}
<section class="wrap section prose land-body">${md(l.body || "")}</section>
${l.faq.length ? `<section class="wrap section faq"><div class="section-head"><h2>Frequently asked questions</h2></div>${l.faq.map((x) => `<details><summary>${esc(x.q)}</summary><div>${paras(x.a)}</div></details>`).join("")}</section>` : ""}`;
  const ld = [{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: SITE_URL + "/" }, { "@type": "ListItem", position: 2, name: l.h1, item: SITE_URL + "/" + l.url }] }];
  if (l.faq.length) ld.push({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: l.faq.map((x) => ({ "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: x.a } })) });
  add(l.url + "index.html", page({ title: l.seo_title || `${l.h1} | ${brand}`, description: clip(l.seo_description || l.lead || l.h1), pathname: l.url, body, ld, image: items[0]?.images[0], bodyClass: "landing-page" }));
}

// ---------- 404 ----------
add("404.html", page({ title: `Page not found | ${brand}`, description: "Page not found", pathname: "404.html", noindex: true,
  body: `<section class="wrap section prose center"><h1>This page has moved</h1><p>The page you are looking for is not here anymore. Our latest collection is waiting for you.</p><p><a class="btn" href="${u("shop/")}">Shop the collection</a></p></section>` }));

// ---------- write ----------
// ---------- Owner business dashboard: /admin/dashboard/ (reads the Google Sheet Apps Script, owner key only) ----------
function dashMain() {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const inr = (n) => "₹" + Math.round(n || 0).toLocaleString("en-IN");
  const KK = "bk_owner_key"; const getK = () => { try { return localStorage.getItem(KK) || ""; } catch { return ""; } };
  const root = $("[data-dash]"), URL0 = (window.BK && window.BK.sheet) || "";
  let D = null, month = "";
  const box = (h) => { $("[data-dash-body]").innerHTML = h; };
  if (!URL0) { box(`<div class="dash-card"><h2>Pehle Google Sheet jodo</h2><p>Admin → Settings → "ग्राहक डेटा – Google Sheet का Web App लिंक" mein Apps Script ka link daalo. Phir yahan wapas aao.</p></div>`); return; }
  const login = (msg) => { box(`<form class="dash-card dash-login" data-login><h2>Owner login</h2><p class="muted">Apps Script mein jo <b>OWNER_KEY</b> rakha hai, wahi yahan daalo. Ye sirf is phone mein save hoga.</p>${msg ? `<p class="dash-err">${esc(msg)}</p>` : ""}<input name="k" type="password" placeholder="Owner key" required autocomplete="current-password"><button class="btn" type="submit">Dashboard kholo</button></form>`);
    $("[data-login]").addEventListener("submit", (e) => { e.preventDefault(); try { localStorage.setItem(KK, e.target.k.value.trim()); } catch {} load(); }); };
  const post = (data) => fetch(URL0, { method: "POST", mode: "no-cors", headers: { "content-type": "text/plain;charset=utf-8" }, body: JSON.stringify({ ...data, key: getK() }) });
  async function load() {
    if (!getK()) return login();
    $("[data-dash-status]").textContent = "Loading…";
    try { const r = await fetch(URL0 + (URL0.includes("?") ? "&" : "?") + "key=" + encodeURIComponent(getK()) + "&t=" + Date.now()); D = await r.json(); } catch { $("[data-dash-status]").textContent = ""; return box(`<div class="dash-card"><h2>Data nahi aaya</h2><p>Internet check karo. Agar Apps Script abhi purana hai to naya v3 code paste karke "New version" deploy karo.</p><button class="btn" type="button" onclick="location.reload()">Dobara try karo</button></div>`); }
    if (D.error === "key") { try { localStorage.removeItem(KK); } catch {} $("[data-dash-status]").textContent = ""; return login("Key galat hai. Dobara daalo."); }
    $("[data-dash-status]").textContent = "Updated " + new Date(D.updated).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    if (!month) { const cur = new Date().toISOString().slice(0, 7); month = D.months.some((m) => m.month === cur) ? cur : ""; }
    render();
  }
  const sumM = (ms) => ms.reduce((a, b) => { for (const k of ["sales", "orders", "pending", "refunds", "shipLost", "ship", "expenses", "returns", "rto", "exchanges", "cancels", "net", "capital"]) a[k] = (a[k] || 0) + (b[k] || 0); for (const c in b.exp) a.exp[c] = (a.exp[c] || 0) + b.exp[c]; return a; }, { exp: {} });
  const mName = (k) => { const [y, m] = k.split("-"); return new Date(+y, +m - 1, 1).toLocaleString("en-IN", { month: "short", year: "2-digit" }); };
  function chart(ms) {
    const L = ms.slice(-12); if (!L.length) return `<p class="muted">Abhi koi data nahi. Pehla order aate hi chart banega.</p>`;
    const W = 640, H = 230, pl = 54, pb = 28, pt = 12, cost = (m) => m.refunds + m.shipLost + m.ship + m.expenses;
    const max = Math.max(1, ...L.map((m) => Math.max(m.sales, cost(m)))); const step = Math.pow(10, Math.floor(Math.log10(max))); const top = Math.ceil(max / step) * step;
    const gw = (W - pl - 8) / L.length, bw = Math.min(22, gw / 2 - 4), y = (v) => pt + (H - pt - pb) * (1 - v / top);
    const ticks = [0, top / 2, top].map((v) => `<line x1="${pl}" x2="${W - 4}" y1="${y(v)}" y2="${y(v)}" class="dash-grid"/><text x="${pl - 6}" y="${y(v) + 4}" text-anchor="end" class="dash-ax">${v >= 1e5 ? (v / 1e5).toFixed(1) + "L" : v >= 1e3 ? Math.round(v / 1e3) + "k" : v}</text>`).join("");
    const bar = (x, v, c, i, lab) => { const h = Math.max(0, y(0) - y(v)); return `<path d="M${x},${y(0)} v${-Math.max(0, h - 4)} q0,-4 4,-4 h${bw - 8} q4,0 4,4 v${Math.max(0, h - 4)} z" fill="${c}" data-tip="${esc(lab)}" data-i="${i}"/>`; };
    const bars = L.map((m, i) => { const x = pl + i * gw + gw / 2 - bw - 1; return bar(x, m.sales, "#009688", i, `${mName(m.month)} · Sales ${inr(m.sales)}`) + bar(x + bw + 2, cost(m), "#c0702a", i, `${mName(m.month)} · Kharcha ${inr(cost(m))}`) + `<text x="${pl + i * gw + gw / 2}" y="${H - 8}" text-anchor="middle" class="dash-ax">${mName(m.month)}</text><rect x="${pl + i * gw}" y="${pt}" width="${gw}" height="${H - pt - pb}" fill="transparent" data-hit="${i}"/>`; }).join("");
    return `<div class="dash-legend"><span><i style="background:#009688"></i>Sales</span><span><i style="background:#c0702a"></i>Kharcha (refund + shipping + expenses)</span></div><div class="dash-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Monthly sales vs costs">${ticks}${bars}</svg><div class="dash-tip" data-tipbox hidden></div></div>
      <details class="dash-table-wrap"><summary>Table dekho</summary><table class="dash-table"><thead><tr><th>Month</th><th>Sales</th><th>Kharcha</th><th>Profit</th></tr></thead><tbody>${L.map((m) => `<tr><td>${mName(m.month)}</td><td>${inr(m.sales)}</td><td>${inr(cost(m))}</td><td class="${m.net < 0 ? "neg" : "pos"}">${inr(m.net)}</td></tr>`).join("")}</tbody></table></details>`;
  }
  const hbars = (rows, unit = "") => { if (!rows.length) return `<p class="muted small">Abhi data nahi.</p>`; const mx = Math.max(...rows.map((r) => r[1])); return `<ul class="dash-hbars">${rows.map(([k, v]) => `<li><span class="dash-hl">${esc(k)}</span><span class="dash-hb"><i style="width:${Math.max(3, v / mx * 100)}%"></i></span><b>${unit === "₹" ? inr(v) : v}</b></li>`).join("")}</ul>`; };
  function insights(t, all) {
    const out = [], ret = t.returns + t.rto, rate = t.orders ? ret / t.orders * 100 : 0;
    if (t.orders && rate > 15) out.push(`⚠️ Return + RTO ${rate.toFixed(0)}% hai. 10% se neeche laana target rakho.`);
    const rs = D.reasons[0]; if (rs && rs[1] >= 3) out.push(rs[0].startsWith("Size") ? "📏 Sabse zyada return size ki wajah se. Size chart aur model ka size har product mein bharo." : rs[0].includes("RTO") ? "📦 RTO zyada hai. Prepaid hi rakho aur dispatch se pehle WhatsApp par confirm karo." : `🔎 Sabse zyada return ki wajah: ${rs[0]}.`);
    if (t.pending) out.push(`💳 ${t.pending} order ka payment pending hai. Customer ko yaad dilao ya status update karo.`);
    if (D.customers.buyers) out.push(`🔁 Repeat customers: ${D.customers.repeat} / ${D.customers.buyers} (${Math.round(D.customers.repeat / D.customers.buyers * 100)}%). Saheli Credit aur festival message se badhao.`);
    if (t.sales && t.exp["Ads & marketing"]) out.push(`📣 Ads par ${inr(t.exp["Ads & marketing"])} kharcha, sales ka ${Math.round(t.exp["Ads & marketing"] / t.sales * 100)}%.`);
    if (all.length >= 2) { const a = all[all.length - 1], b = all[all.length - 2]; if (b.sales) out.push(`${a.sales >= b.sales ? "📈" : "📉"} ${mName(a.month)} ki sales pichhle mahine se ${Math.abs(Math.round((a.sales - b.sales) / b.sales * 100))}% ${a.sales >= b.sales ? "zyada" : "kam"}.`); }
    return out.length ? `<ul class="dash-ins">${out.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="muted small">Data aate hi yahan sujhaav dikhenge.</p>`;
  }
  function render() {
    const ms = D.months, sel = month ? ms.filter((m) => m.month === month) : ms, t = sumM(sel);
    const ord = D.orders.filter((o) => !month || o.month === month);
    const tile = (l, v, cls = "", sub = "") => `<div class="dash-tile ${cls}"><span>${l}</span><b>${v}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;
    const retRate = t.orders ? Math.round((t.returns + t.rto) / t.orders * 100) : 0;
    box(`<div class="dash-filter"><label>Mahina <select data-month><option value="">Sab (all time)</option>${ms.slice().reverse().map((m) => `<option value="${m.month}"${m.month === month ? " selected" : ""}>${mName(m.month)}</option>`).join("")}</select></label><button class="btn btn-ghost btn-sm" type="button" data-csv>⬇ CSV report</button><button class="btn btn-ghost btn-sm" type="button" data-logout>Logout</button></div>
      <div class="dash-tiles">${tile("Sales", inr(t.sales), "", `${t.orders || 0} paid orders`)}${tile("Net profit", inr(t.net), t.net < 0 ? "neg" : "pos", "sales − sab kharche")}${tile("Avg order", inr(t.orders ? t.sales / t.orders : 0))}${tile("Pending payment", t.pending || 0)}${tile("Return + RTO", `${(t.returns || 0) + (t.rto || 0)}`, retRate > 15 ? "warn" : "", `${retRate}% · RTO ${t.rto || 0}`)}${tile("Refunds", inr(t.refunds))}${tile("Shipping", inr(t.ship + (t.exp.Shipping || 0)), "", `+ RTO loss ${inr(t.shipLost)}`)}${tile("Expenses", inr(t.expenses), "", t.capital ? `Investment alag: ${inr(t.capital)}` : "")}</div>
      <details class="dash-card dash-studio" data-studio><summary><h2>📣 Marketing Studio – ad 1 minute mein banao</h2></summary><div data-studio-body><p class="muted">Loading products…</p></div></details>
      <section class="dash-card"><h2>Sujhaav</h2>${insights(t, ms)}</section>
      <section class="dash-card"><h2>Mahine ka hisaab</h2>${chart(ms)}</section>
      <div class="dash-2"><section class="dash-card"><h2>Return / RTO ki wajah</h2>${hbars(D.reasons)}</section><section class="dash-card"><h2>Kharcha kahan gaya</h2>${hbars(Object.entries(t.exp).sort((a, b) => b[1] - a[1]), "₹")}</section>
      <section class="dash-card"><h2>Top products</h2>${hbars(D.top)}</section><section class="dash-card"><h2>Kahan se orders</h2>${hbars(D.countries.length > 1 ? D.countries : D.states)}</section>
      <section class="dash-card"><h2>Payment type</h2>${hbars(D.payments)}</section><section class="dash-card"><h2>Customer kahan se aaye (ads / source)</h2>${hbars(D.source_sales || [], "₹")}<p class="muted small">Ads ka link Marketing Studio se banao, tabhi yahan dikhega.</p></section><section class="dash-card"><h2>Customers</h2><ul class="dash-kv"><li>Kharidne wale<b>${D.customers.buyers}</b></li><li>Repeat customers<b>${D.customers.repeat}</b></li><li>Sign-ups<b>${D.customers.signups}</b></li><li>Followers<b>${D.customers.follows}</b></li><li>Checkout shuru kiya<b>${D.customers.checkouts}</b></li><li>Wholesale enquiry<b>${D.customers.wholesale}</b></li><li>Gift cards<b>${D.customers.gift_cards}</b></li><li>RTO wale state<b>${esc(D.rto_states.map((r) => r[0] + " " + r[1]).join(", ") || "–")}</b></li></ul></section></div>
      <section class="dash-card"><h2>Orders & payment history <small class="muted">(${ord.length})</small></h2><input type="search" placeholder="Naam, order no. ya product dhundo" data-q class="dash-q">
        <div class="dash-orders">${ord.length ? ord.map((o) => `<div class="dash-o" data-o="${esc([o.ref, o.name, o.items, o.city].join(" ").toLowerCase())}"><div><b>${esc(o.ref)}</b> · ${esc(o.day)}<br>${esc(o.name)}${o.city ? " · " + esc(o.city) : ""}${o.country && o.country !== "India" ? " · " + esc(o.country) : ""}<br><small class="muted">${esc(o.items)}</small></div><div class="dash-o-r"><b>${o.cur === "USD" ? "$" + o.total : inr(o.inr)}</b><small>${esc(o.payment || "")}</small><span class="dash-st st-${esc(o.status.toLowerCase())}">${esc(o.status)}</span><button type="button" class="link small" data-edit="${esc(o.ref)}">Update</button></div></div>`).join("") : `<p class="muted">Is mahine koi order nahi.</p>`}</div></section>
      <div class="dash-2"><form class="dash-card dash-form" data-f="expense"><h2>➕ Kharcha / investment likho</h2><label>Date<input type="date" name="date" value="${new Date().toISOString().slice(0, 10)}"></label><label>Kis cheez ka<select name="category">${D.lists.exp_cats.map((c) => `<option>${c}</option>`).join("")}</select></label><label>Amount ₹<input type="number" name="amount" min="0" step="1" required inputmode="numeric"></label><label>Note<input name="note" placeholder="jaise: 50 m cotton, Delhivery bill"></label><button class="btn" type="submit">Save</button></form>
      <form class="dash-card dash-form" data-f="return"><h2>↩️ Return / RTO likho</h2><label>Order no.<input name="ref_order" placeholder="BK-..." required list="dash-refs"></label><label>Type<select name="rtype">${D.lists.ret_types.map((c) => `<option>${c}</option>`).join("")}</select></label><label>Wajah<select name="reason">${D.lists.reasons.map((c) => `<option>${c}</option>`).join("")}</select></label><label>Refund ₹<input type="number" name="refund" min="0" value="0" inputmode="numeric"></label><label>Shipping loss ₹<input type="number" name="ship_lost" min="0" value="0" inputmode="numeric"></label><label>Product wapas aaya?<select name="back"><option>Yes</option><option>No</option></select></label><label>Note<input name="note"></label><button class="btn" type="submit">Save</button></form></div>
      <datalist id="dash-refs">${D.orders.slice(0, 200).map((o) => `<option value="${esc(o.ref)}">${esc(o.name)}</option>`).join("")}</datalist>
      <dialog class="dash-dlg" data-dlg><form method="dialog" data-f="status"><h2>Order update</h2><p data-dlg-ref></p><input type="hidden" name="ref_order"><label>Status<select name="status">${D.lists.statuses.map((c) => `<option>${c}</option>`).join("")}</select></label><label>Shipping kharcha ₹<input type="number" name="ship_cost" min="0" inputmode="numeric"></label><label>Note<input name="note" placeholder="AWB / courier"></label><div class="dash-dlg-b"><button class="btn" value="save">Save</button><button class="btn btn-ghost" value="cancel" formnovalidate>Cancel</button></div></form></dialog>`);
    $("[data-month]").addEventListener("change", (e) => { month = e.target.value; render(); });
    $("[data-logout]").addEventListener("click", () => { try { localStorage.removeItem(KK); } catch {} login(); });
    $("[data-q]").addEventListener("input", (e) => { const q = e.target.value.toLowerCase().trim(); $$("[data-o]").forEach((x) => (x.hidden = q && !x.dataset.o.includes(q))); });
    $("[data-csv]").addEventListener("click", () => { const rows = [["Order", "Date", "Name", "City", "State", "Country", "Amount INR", "Total", "Currency", "Payment", "Status", "Shipping", "Items"], ...ord.map((o) => [o.ref, o.day, o.name, o.city, o.state, o.country, o.inr, o.total, o.cur, o.payment, o.status, o.ship, o.items])];
      const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n"); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" })); a.download = `bahe-kurtiz-report-${month || "all"}.csv`; a.click(); });
    const dlg = $("[data-dlg]");
    $$("[data-edit]").forEach((b) => b.addEventListener("click", () => { const f = $("[data-f=status]"); f.ref_order.value = b.dataset.edit; $("[data-dlg-ref]").textContent = b.dataset.edit; const o = D.orders.find((x) => x.ref === b.dataset.edit); if (o) f.status.value = o.status; dlg.showModal(); }));
    dlg.addEventListener("close", async () => { if (dlg.returnValue !== "save") return; const f = $("[data-f=status]"); await post({ type: "status", ...Object.fromEntries(new FormData(f)) }); toast("Saved ✓"); setTimeout(load, 1800); });
    $$("form[data-f=expense],form[data-f=return]").forEach((f) => f.addEventListener("submit", async (e) => { e.preventDefault(); const b = f.querySelector("button"); b.disabled = true; await post({ type: f.dataset.f, ...Object.fromEntries(new FormData(f)) }); toast("Saved ✓"); setTimeout(load, 1800); }));
    studio();
    const tipbox = $("[data-tipbox]");
    $$("[data-hit]").forEach((h) => { const show = () => { const m = D.months.slice(-12)[+h.dataset.hit]; const c = m.refunds + m.shipLost + m.ship + m.expenses; tipbox.innerHTML = `<b>${mName(m.month)}</b><br><i style="background:#009688"></i>Sales ${inr(m.sales)}<br><i style="background:#c0702a"></i>Kharcha ${inr(c)}<br>Profit ${inr(m.net)} · ${m.orders} orders`; tipbox.hidden = false; const r = h.getBoundingClientRect(), p = h.ownerSVGElement.parentNode.getBoundingClientRect(); tipbox.style.left = Math.min(p.width - 170, Math.max(0, r.left - p.left + r.width / 2 - 85)) + "px"; $$("[data-i]").forEach((b) => b.style.opacity = b.dataset.i === h.dataset.hit ? 1 : .45); };
      h.addEventListener("pointerenter", show); h.addEventListener("click", show); h.addEventListener("pointerleave", () => { tipbox.hidden = true; $$("[data-i]").forEach((b) => (b.style.opacity = 1)); }); });
  }
  // ---------- Marketing Studio: tracked link + ad copy + ad images for any country ----------
  let CAT = null, FX = null;
  const C_LIST = [["US", "United States", "USD"], ["GB", "United Kingdom", "GBP"], ["CA", "Canada", "CAD"], ["AU", "Australia", "AUD"], ["NZ", "New Zealand", "NZD"], ["AE", "UAE", "AED"], ["SG", "Singapore", "SGD"], ["MY", "Malaysia", "MYR"], ["DE", "Germany", "EUR"], ["FR", "France", "EUR"], ["NL", "Netherlands", "EUR"], ["IE", "Ireland", "EUR"], ["JP", "Japan", "JPY"], ["IN", "India", "INR"]];
  const CH = { meta: ["Meta ads (Facebook + Instagram)", "meta", "paid"], google: ["Google ads / Shopping", "google", "cpc"], pinterest: ["Pinterest ads", "pinterest", "paid"], insta: ["Instagram post / reel (free)", "instagram", "social"], wa: ["WhatsApp broadcast", "whatsapp_bc", "broadcast"], b2b: ["Boutiques / brands (B2B email)", "b2b", "email"] };
  const HOOK = { everyday: "Everyday comfort", diwali: "Diwali", wedding: "Wedding season", summer: "Summer", navratri: "Navratri", eid: "Eid", gifting: "Gifting / Christmas" };
  async function studio() {
    const sb = $("[data-studio-body]"); if (!sb) return;
    try { CAT ||= await (await fetch((window.BK?.base || "/") + "data/catalog.json")).json(); } catch { sb.innerHTML = "<p>Products load nahi hue.</p>"; return; }
    if (!FX) { try { FX = (await (await fetch("https://open.er-api.com/v6/latest/USD")).json()).rates; } catch { FX = { USD: 1 }; } }
    const ps = Object.entries(CAT.products).filter(([, p]) => p.image);
    const opt = (o) => Object.entries(o).map(([k, v]) => `<option value="${k}">${Array.isArray(v) ? v[0] : v}</option>`).join("");
    sb.innerHTML = `<div class="studio-f"><label>Product<select data-s="p">${ps.map(([k, p]) => `<option value="${esc(k)}">${esc(p.title)}</option>`).join("")}</select></label><label>Desh (country)<select data-s="c">${C_LIST.map((c) => `<option value="${c[0]}">${c[1]}</option>`).join("")}</select></label><label>Kahan chalana hai<select data-s="ch">${opt(CH)}</select></label><label>Mauka<select data-s="h">${opt(HOOK)}</select></label><button class="btn" type="button" data-s-go>✨ Ad kit banao</button></div><div data-s-out></div>`;
    $("[data-s-go]").addEventListener("click", makeKit);
  }
  const money = (usd, inrV, cur) => { if (cur === "INR") return inrV ? "₹" + Number(inrV).toLocaleString("en-IN") : ""; if (!usd) return ""; const r = FX?.[cur] || (cur === "USD" ? 1 : 0); if (!r) return "$" + usd; try { return new Intl.NumberFormat("en", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(usd * r); } catch { return "$" + usd; } };
  function makeKit() {
    const g = (k) => $(`[data-s="${k}"]`).value, k = g("p"), p = CAT.products[k], cc = C_LIST.find((c) => c[0] === g("c")), ch = CH[g("ch")], hk = g("h"), hook = HOOK[hk];
    const brand = window.BK?.brand || "Bahe Kurtiz", ym = new Date().toISOString().slice(2, 7).replace("-", "");
    const camp = `${cc[0].toLowerCase()}-${hk}-${ym}`;
    const b2b = g("ch") === "b2b", path = b2b ? "wholesale/" : String(p.url).replace(/^\//, "");
    const link = `${location.origin}/${path}?country=${cc[0]}&utm_source=${ch[1]}&utm_medium=${ch[2]}&utm_campaign=${camp}&utm_content=${k}`;
    const price = money(p.price_usd, p.price, cc[2]); const noUsd = cc[0] !== "IN" && !p.price_usd; const noFx = !["USD", "INR"].includes(cc[2]) && !FX?.[cc[2]];
    const craft = String(p.print || "").split(",")[0].trim() || "Handcrafted", fab = p.fabric || "cotton";
    const H = [`${p.title} – handmade in Jaipur`, `${hook} ready: ${craft} from Jaipur`, price ? `${craft} kurtis from ${price}` : `Authentic ${craft} from Jaipur`];
    const T = b2b ? `Hello,\n\nI am from ${brand}, a hand block print studio in Sanganer, Jaipur (India). We make kurtis, kurta sets and dresses in ${craft} on ${fab} and supply boutiques and brands in ${cc[1]}.\n\n• Small minimum orders, mixed designs\n• Private label available\n• Samples and catalogue on request\n• Worldwide shipping from Jaipur\n\nCatalogue & trade enquiry: ${link}\n\nWarm regards,\n${brand}`
      : `${hook === "Everyday comfort" ? "Comfort that looks handmade – because it is." : hook + " is better in something made by hand."} ${p.title}: ${craft} on breathable ${fab}${/block|sanganer|bagru|dabu|ajrakh|indigo|kalamkari|bagh/i.test(p.print || "") ? ", printed with wooden blocks in Sanganer, Jaipur" : ", made in Jaipur"}.${price ? " Now " + price + "." : ""} Ships to ${cc[1]}. Secure prepaid checkout.`;
    const D2 = `${/block|sanganer|bagru|dabu|ajrakh|indigo|kalamkari|bagh/i.test(p.print || "") ? "Hand block printed" : "Made"} in Jaipur · Ships to ${cc[1]}`;
    const tags = `#handblockprint #jaipurkurti #${craft.replace(/[^a-z]/gi, "").toLowerCase()} #indianwear #kurti #${cc[1].replace(/\s/g, "").toLowerCase()}indians #ethnicwear #madeinindia`;
    const steps = { meta: [`Meta Ads Manager kholo (business.facebook.com) → Create → Sales.`, `Location: ${cc[1]} · Women · Age 25–55 · Interests: Indian fashion, Kurta, Saree, Bollywood, Diwali + "Expats (India)".`, `Budget ₹500–800/din se shuru karo, 3–5 din chalao, phir jo ad achha chale usi par budget badhao.`, `Neeche wali square aur story photo upload karo, headline aur text copy-paste karo.`, `Website URL mein upar wala link daalo.`], google: [`Google Merchant Center mein products feed: bahekurtiz.com/feeds/google-merchant-usd.xml (bahar ke liye, pehle se bana hai).`, `Google Ads → New campaign → Sales → Performance Max / Shopping.`, `Country: ${cc[1]} · Budget ₹500/din se shuru.`, `Headlines aur description neeche se copy karo; final URL upar wala link.`], pinterest: [`Pinterest Business → Ads → Create campaign → Consideration.`, `Country: ${cc[1]} · Interests: Women's fashion, Indian wedding, Boho.`, `Story (tall) photo upload karo, link upar wala.`], insta: [`Story/tall photo download karo, Instagram par post karo.`, `Caption mein text + hashtags paste karo.`, `Bio link ya story link sticker mein upar wala link lagao.`], wa: [`Sirf un customers ko bhejo jinhone offers ke liye haan bola hai.`, `Square photo + text + link bhejo.`], b2b: [`Boutique / brand ka email ya Instagram dhundo (Google Maps, Instagram "indian boutique ${cc[1]}").`, `Neeche wala email copy karke bhejo, saath mein square photo.`, `Reply aaye to Sheet mein "wholesale" row dekho; rate aur MOQ aap final karo.`] }[g("ch")];
    const blk = (t, v) => `<div class="studio-b"><div class="studio-bh"><b>${t}</b><button type="button" class="link small" data-copy>Copy</button></div><pre>${esc(v)}</pre></div>`;
    $("[data-s-out]").innerHTML = `${noUsd ? `<p class="dash-err">Is product ka $ price admin mein nahi bhara. Bahar ke ads se pehle $ price daalo.</p>` : ""}${noFx ? `<p class="dash-err">${cc[2]} ka rate nahi mila, isliye price $ mein dikh raha hai. Internet check karke dobara banao.</p>` : ""}
      ${blk("🔗 Tracked link (isi se pata chalega kitni sale aayi)", link)}${b2b ? blk("✉️ Email / DM", T) : blk("Headlines", H.join("\n")) + blk("Text", T) + blk("Description", D2) + blk("Hashtags", tags)}
      <div class="studio-imgs"><figure><canvas data-cv="sq" width="1080" height="1080"></canvas><button class="btn btn-ghost btn-sm" type="button" data-dl="sq">⬇ Square photo</button></figure><figure><canvas data-cv="st" width="1080" height="1920"></canvas><button class="btn btn-ghost btn-sm" type="button" data-dl="st">⬇ Story photo</button></figure></div>
      <div class="studio-b"><b>Ab ye karo</b><ol>${steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></div>`;
    $$("[data-copy]").forEach((b) => b.addEventListener("click", async () => { try { await navigator.clipboard.writeText(b.closest(".studio-b").querySelector("pre").textContent); toast("Copied ✓"); } catch {} }));
    const im = new Image(); im.onload = () => { for (const [key, W, Hh] of [["sq", 1080, 1080], ["st", 1080, 1920]]) { const cv = $(`[data-cv="${key}"]`), x = cv.getContext("2d"); const s = Math.max(W / im.width, Hh / im.height); x.drawImage(im, (W - im.width * s) / 2, (Hh - im.height * s) / 2, im.width * s, im.height * s);
        const gr = x.createLinearGradient(0, Hh * 0.55, 0, Hh); gr.addColorStop(0, "rgba(8,59,58,0)"); gr.addColorStop(1, "rgba(8,59,58,.92)"); x.fillStyle = gr; x.fillRect(0, Hh * 0.5, W, Hh * 0.5);
        x.fillStyle = "#e8c776"; x.font = "600 34px system-ui"; x.fillText((b2b ? "WHOLESALE · PRIVATE LABEL" : hook.toUpperCase()), 60, Hh - (key === "st" ? 360 : 250));
        x.fillStyle = "#fff"; x.font = "700 62px Georgia, serif"; const words = (b2b ? "Hand block prints for your boutique" : p.title).split(" "); let line = "", y = Hh - (key === "st" ? 290 : 180); const lines = []; for (const w of words) { if (x.measureText(line + w).width > W - 120) { lines.push(line); line = ""; } line += w + " "; } lines.push(line); lines.slice(0, 2).forEach((l, i) => x.fillText(l.trim(), 60, y + i * 70));
        x.font = "600 44px system-ui"; x.fillStyle = "#fff"; if (price && !b2b) x.fillText(price, 60, Hh - (key === "st" ? 120 : 40)); x.font = "500 30px system-ui"; x.fillStyle = "#cfe3e1"; x.textAlign = "right"; x.fillText(`${brand} · Jaipur`, W - 60, Hh - (key === "st" ? 120 : 40)); x.textAlign = "left"; } };
    im.src = (window.BK?.base || "/") + String(p.image).replace(/^\//, "");
    $$("[data-dl]").forEach((b) => b.addEventListener("click", () => { $(`[data-cv="${b.dataset.dl}"]`).toBlob((bl) => { const a = document.createElement("a"); a.href = URL.createObjectURL(bl); a.download = `ad-${camp}-${b.dataset.dl}.jpg`; a.click(); }, "image/jpeg", 0.9); }));
  }
  const toast = (m) => { const t = document.querySelector("[data-toast]"); if (!t) return; t.textContent = m; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 2000); };
  root && load();
}
add("admin/dashboard/index.html", page({ title: `Business Dashboard | ${brand}`, description: "Owner dashboard", pathname: "admin/dashboard/", noindex: true, bodyClass: "dash-page", mini: null,
  body: `<section class="wrap section dash" data-dash><div class="dash-head"><div><p class="eyebrow">Owner only</p><h1>Business Dashboard</h1></div><span class="muted small" data-dash-status></span></div><div data-dash-body><p class="muted">Loading…</p></div></section><script>addEventListener("DOMContentLoaded", () => (${dashMain.toString()})());</script>` }));

fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, "static"), OUT, { recursive: true });
for (const [file, html] of pages) {
  const f = path.join(OUT, file);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, html);
}

// catalog used by the cart, checkout and the payment server (prices are checked on the server)
const catalog = {
  settings: {
    shipping_charge: num(S.shipping_charge) || 0, free_shipping_above: num(S.free_shipping_above) || 0,
    cod_enabled: false, cod_charge: 0, prepaid_discount_percent: num(S.prepaid_discount_percent) || 0,
    upi_id: (S.upi_id || "").trim(), brand, whatsapp: waNumber, email: S.email || "",
    intl_shipping_charge_usd: num(S.intl_shipping_charge_usd) || 0, intl_free_shipping_above_usd: num(S.intl_free_shipping_above_usd) || 0,
  },
  products: Object.fromEntries(products.map((p) => [p.slug, { title: p.title, price: p.price, sizes: p.sizes, image: p.images[0] || "", image2: p.images[1] || "", color: p.color || "", url: p.url, in_stock: p.in_stock, out: p.sold_out, cutout: p.tryon_png || "", occ: p.occasion, cat: p.category, fabric: p.fabric, print: p.print_work.join(", "), price_usd: p.intl ? p.price_usd : null, mrp: p.mrp, mrp_usd: p.intl ? p.mrp_usd : null, market_prices: p.market_prices || {}, i18n: p.i18n || {} }])),
};
fs.mkdirSync(path.join(OUT, "data"), { recursive: true });
fs.writeFileSync(path.join(OUT, "data/catalog.json"), JSON.stringify(catalog));

// ---------- product feeds: Meta (Facebook/Instagram Shop) catalog + Google Merchant Center ----------
{
  const csv = (v) => `"${String(v ?? "").replace(/"/g, '""').replace(/\s+/g, " ").trim()}"`;
  const gcat = (c) => (/set|co-ord/i.test(c) ? "Apparel & Accessories > Clothing > Outfit Sets" : /dress|gown|kaftan/i.test(c) ? "Apparel & Accessories > Clothing > Dresses" : /palazzo|pant/i.test(c) ? "Apparel & Accessories > Clothing > Pants" : /dupatta|stole/i.test(c) ? "Apparel & Accessories > Clothing Accessories > Scarves & Shawls" : /top|tunic/i.test(c) ? "Apparel & Accessories > Clothing > Shirts & Tops" : "Apparel & Accessories > Clothing > Traditional & Ceremonial Clothing");
  const plain = (p) => String(p.description || p.title).replace(/\s+/g, " ").trim().slice(0, 4900) || p.title;
  const feedItems = products.filter((p) => p.price !== null && p.images[0]);
  const head = ["id", "title", "description", "availability", "condition", "price", "sale_price", "link", "image_link", "additional_image_link", "brand", "google_product_category", "product_type", "color", "material", "gender", "age_group"];
  const row = (p, cur) => {
    const usdMode = cur === "USD"; const pr = usdMode ? p.price_usd : p.price; const mrp = usdMode ? p.mrp_usd : p.mrp;
    const fmt = (n) => `${Number(n).toFixed(2)} ${cur}`;
    return [p.slug, p.title, plain(p), p.in_stock ? "in stock" : "preorder", "new", fmt(mrp && mrp > pr ? mrp : pr), mrp && mrp > pr ? fmt(pr) : "", `${SITE_URL}/${p.url}`, abs(p.images[0]), p.images.slice(1, 10).map(abs).join(","), brand, gcat(p.category), p.category, p.color || "", p.fabric || "", "female", "adult"].map(csv).join(",");
  };
  fs.mkdirSync(path.join(OUT, "feeds"), { recursive: true });
  fs.writeFileSync(path.join(OUT, "feeds/meta-catalog.csv"), [head.join(","), ...feedItems.map((p) => row(p, "INR"))].join("\n"));
  const intlItems = feedItems.filter((p) => p.intl);
  if (intlItems.length) fs.writeFileSync(path.join(OUT, "feeds/meta-catalog-usd.csv"), [head.join(","), ...intlItems.map((p) => row(p, "USD"))].join("\n"));
  // Pinterest retail catalog: hosted CSV is rebuilt with every site deploy, so Pinterest can ingest fresh product data daily.
  const pinHead = ["id", "title", "description", "link", "image_link", "price", "availability", "condition", "brand", "google_product_category", "product_type", "color", "material"];
  const pinRow = (p, cur) => {
    const usdMode = cur === "USD"; const pr = usdMode ? p.price_usd : p.price;
    const fmt = (n) => `${Number(n).toFixed(2)} ${cur}`;
    return [p.slug, p.title, plain(p), `${SITE_URL}/${p.url}`, abs(p.images[0]), fmt(pr), p.in_stock ? "in stock" : "preorder", "new", brand, gcat(p.category), p.category, p.color || "", p.fabric || ""].map(csv).join(",");
  };
  fs.writeFileSync(path.join(OUT, "feeds/pinterest-catalog.csv"), [pinHead.join(","), ...feedItems.map((p) => pinRow(p, "INR"))].join("\n"));
  if (intlItems.length) fs.writeFileSync(path.join(OUT, "feeds/pinterest-catalog-usd.csv"), [pinHead.join(","), ...intlItems.map((p) => pinRow(p, "USD"))].join("\n"));
  const x = (v) => esc(String(v ?? ""));
  if (intlItems.length) fs.writeFileSync(path.join(OUT, "feeds/google-merchant-usd.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>${x(brand)} – International</title><link>${SITE_URL}/</link><description>${x(S.tagline || "")}</description>
${intlItems.map((p) => `<item><g:id>${x(p.slug)}</g:id><g:title>${x(p.title)}</g:title><g:description>${x(plain(p))}</g:description><g:link>${SITE_URL}/${p.url}</g:link><g:image_link>${x(abs(p.images[0]))}</g:image_link><g:availability>${p.in_stock ? "in_stock" : "preorder"}</g:availability><g:condition>new</g:condition><g:price>${(p.mrp_usd && p.mrp_usd > p.price_usd ? p.mrp_usd : p.price_usd).toFixed(2)} USD</g:price>${p.mrp_usd && p.mrp_usd > p.price_usd ? `<g:sale_price>${p.price_usd.toFixed(2)} USD</g:sale_price>` : ""}<g:brand>${x(brand)}</g:brand><g:identifier_exists>no</g:identifier_exists><g:google_product_category>${x(gcat(p.category))}</g:google_product_category><g:gender>female</g:gender><g:age_group>adult</g:age_group>${["US", "GB", "CA", "AU", "NZ", "AE", "SA", "QA", "SG", "MY", "DE", "FR", "NL", "IE", "IT", "ES", "ZA"].map((c) => `<g:shipping><g:country>${c}</g:country><g:price>${(p.price_usd >= (num(S.intl_free_shipping_above_usd) || Infinity) ? 0 : num(S.intl_shipping_charge_usd) || 0).toFixed(2)} USD</g:price></g:shipping>`).join("")}</item>`).join("\n")}
</channel></rss>`);
  fs.writeFileSync(path.join(OUT, "feeds/google-merchant.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>${x(brand)}</title><link>${SITE_URL}/</link><description>${x(S.tagline || "")}</description>
${feedItems.map((p) => `<item><g:id>${x(p.slug)}</g:id><g:title>${x(p.title)}</g:title><g:description>${x(plain(p))}</g:description><g:link>${SITE_URL}/${p.url}</g:link><g:image_link>${x(abs(p.images[0]))}</g:image_link>${p.images.slice(1, 10).map((im) => `<g:additional_image_link>${x(abs(im))}</g:additional_image_link>`).join("")}<g:availability>${p.in_stock ? "in_stock" : "preorder"}</g:availability>${p.in_stock ? "" : `<g:availability_date>${new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10)}T00:00:00+05:30</g:availability_date>`}<g:condition>new</g:condition><g:price>${(p.mrp && p.mrp > p.price ? p.mrp : p.price).toFixed(2)} INR</g:price>${p.mrp && p.mrp > p.price ? `<g:sale_price>${p.price.toFixed(2)} INR</g:sale_price>` : ""}<g:brand>${x(brand)}</g:brand><g:identifier_exists>no</g:identifier_exists><g:google_product_category>${x(gcat(p.category))}</g:google_product_category><g:product_type>${x(p.category)}</g:product_type>${p.color ? `<g:color>${x(p.color)}</g:color>` : ""}${p.fabric ? `<g:material>${x(p.fabric)}</g:material>` : ""}<g:gender>female</g:gender><g:age_group>adult</g:age_group><g:shipping><g:country>IN</g:country><g:price>${(p.price >= (num(S.free_shipping_above) || Infinity) ? 0 : num(S.shipping_charge) || 0).toFixed(2)} INR</g:price></g:shipping></item>`).join("\n")}
</channel></rss>`);
}

// installable app (PWA): manifest + a small service worker (network-first pages, cached assets)
fs.writeFileSync(path.join(OUT, "manifest.webmanifest"), JSON.stringify({ name: brand, short_name: brand, start_url: "/?src=pwa", display: "standalone", background_color: "#fbf7f1", theme_color: "#0e5b59", icons: favImg ? [{ src: favImg, sizes: "512x512", type: "image/png", purpose: "any maskable" }] : [] }));
const swVer = String([...JSON.stringify(catalog)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(36));
fs.writeFileSync(path.join(OUT, "sw.js"), `const V='bk-${swVer}';self.addEventListener('install',e=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);if(u.origin!==location.origin||/^\\/(admin|api|checkout)/.test(u.pathname))return;if(r.mode==='navigate'){e.respondWith(fetch(r).then(res=>{const c=res.clone();caches.open(V).then(x=>x.put(r,c));return res}).catch(()=>caches.match(r).then(m=>m||caches.match('/'))));return}if(/\\.(css|js|webp|jpg|jpeg|png|svg|woff2)$/.test(u.pathname)){e.respondWith(caches.open(V).then(c=>c.match(r).then(m=>{const f=fetch(r).then(res=>{if(res.ok)c.put(r,res.clone());return res}).catch(()=>m);return m||f})))}});`);

// admin panel config
const repo = process.env.GITHUB_REPO || S.github_repo || "YOUR-GITHUB-USERNAME/bahe-kurtiz";
const cfgPath = path.join(OUT, "admin/config.yml");
if (fs.existsSync(cfgPath)) {
  fs.writeFileSync(cfgPath, fs.readFileSync(cfgPath, "utf8").replaceAll("__REPO__", repo).replaceAll("__BRANCH__", process.env.CF_PAGES_BRANCH || "main").replaceAll("__SITE_URL__", SITE_URL));
}

// sitemap, robots, redirects for old shop links, headers
const urls = ["", "shop/", ...categories.map((c) => c.url), ...products.map((p) => p.url), "blog/", ...posts.map((b) => b.url), "wholesale/", "refer/", "gift-card/", "feed/", "mirror/", "craft/", ...uniq([...prints.filter((n) => craftCount("print", n)), ...fabrics.filter((n) => craftCount("fabric", n))]).map(craftUrl), ...occasions.map((o) => `occasion/${slugify(o)}/`), ...(products.some((p) => p.bestseller) ? ["bestsellers/"] : []), ...landings.map((l) => l.url), "about/", "contact/", "shipping/", "returns/", ...(S.intl_shipping_policy ? ["international-shipping/"] : []), ...(S.intl_return_policy ? ["international-returns/"] : []), "privacy/", "terms/"];
fs.writeFileSync(path.join(OUT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.map((x) => { const p = products.find((q) => q.url === x); const bp = posts.find((q) => q.url === x); return `<url><loc>${SITE_URL}/${x}</loc>${bp ? `<lastmod>${bp.date}</lastmod>` : ""}${p ? p.images.map((im) => `<image:image><image:loc>${esc(abs(im))}</image:loc></image:image>`).join("") : ""}</url>`; }).join("\n")}
</urlset>`);
fs.writeFileSync(path.join(OUT, "blog/feed.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${esc(brand)} Blog</title><link>${SITE_URL}/blog/</link><description>${esc(S.tagline || "")}</description><atom:link href="${SITE_URL}/blog/feed.xml" rel="self" type="application/rss+xml"/><lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${posts.map((b) => `<item><title>${esc(b.title)}</title><link>${SITE_URL}/${b.url}</link><guid>${SITE_URL}/${b.url}</guid><pubDate>${new Date(b.date + "T09:00:00+05:30").toUTCString()}</pubDate><description>${esc(b.excerpt || "")}</description></item>`).join("\n")}
</channel></rss>`);
// for AI assistants and shopping agents (ChatGPT, Gemini, Perplexity…): a plain summary + full product data
fs.writeFileSync(path.join(OUT, "llms.txt"), `# ${brand}\n\n> ${S.tagline || "Women's ethnic wear made in Sanganer, Jaipur"}. Manufacturer of hand block printed kurtis, kurta sets, dresses and co-ords. Retail in India (INR) and worldwide (USD), prepaid only. Wholesale, private label and export.\n\n## Shop\n- [All products](${SITE_URL}/shop/)\n${categories.map((c) => `- [${c.plural}](${SITE_URL}/${c.url})`).join("\n")}\n- [Product data (JSON)](${SITE_URL}/products.json)\n- [Google product feed](${SITE_URL}/feeds/google-merchant.xml)\n\n## Business\n- [Wholesale, private label & export](${SITE_URL}/wholesale/)\n${landings.map((l) => `- [${l.h1}](${SITE_URL}/${l.url})`).join("\n")}\n- [About](${SITE_URL}/about/)\n- [Contact](${SITE_URL}/contact/)${waNumber ? ` (WhatsApp +${waNumber})` : ""}\n\n## Policies\n- [Shipping – India](${SITE_URL}/shipping/)\n- [Returns – India](${SITE_URL}/returns/)\n${S.intl_shipping_policy ? `- [International shipping](${SITE_URL}/international-shipping/)\n` : ""}${S.intl_return_policy ? `- [International returns](${SITE_URL}/international-returns/)\n` : ""}- [Privacy](${SITE_URL}/privacy/)\n- [Terms](${SITE_URL}/terms/)\n`);
fs.writeFileSync(path.join(OUT, "products.json"), JSON.stringify({ brand, url: SITE_URL, currency: ["INR", ...(intlOn ? ["USD"] : [])], updated: today, products: products.map((p) => ({ id: p.slug, title: p.title, url: `${SITE_URL}/${p.url}`, category: p.category, color: p.color || undefined, fabric: p.fabric || undefined, craft: p.print_work.length ? p.print_work : undefined, occasion: p.occasion.length ? p.occasion : undefined, sizes: p.sizes, sold_out_sizes: p.sold_out.length ? p.sold_out : undefined, price_inr: p.price, mrp_inr: p.mrp || undefined, price_usd: p.intl ? p.price_usd : undefined, ships_internationally: p.ships_abroad, in_stock: p.in_stock, images: p.images.map(abs), description: String(p.description || "").replace(/\s+/g, " ").trim() || undefined, made_in: "Sanganer, Jaipur, India" })) }, null, 1));
// more files AI agents read: one-line-per-product list, a Markdown page per product, and how-to-order notes
fs.writeFileSync(path.join(OUT, "llms-full.txt"), `# ${brand} – full product list\n\n${products.map((p) => [p.title, p.price !== null ? "₹" + p.price : "price on request", p.intl ? "$" + p.price_usd : "", "sizes: " + (p.sizes.filter((z) => !p.sold_out.includes(z)).join("/") || "ask"), p.fabric, p.print_work.join("/"), p.occasion.join("/"), `${SITE_URL}/${p.url}`].filter(Boolean).join(" | ")).join("\n")}\n`);
fs.mkdirSync(path.join(OUT, "p"), { recursive: true });
for (const p of products) fs.writeFileSync(path.join(OUT, "p", p.slug + ".md"), `# ${p.title}\n\n- Brand: ${brand} (Sanganer, Jaipur, India)\n- Category: ${p.category}\n${p.color ? `- Colour: ${p.color}\n` : ""}${p.fabric ? `- Fabric: ${p.fabric}\n` : ""}${p.print_work.length ? `- Craft: ${p.print_work.join(", ")}\n` : ""}${p.occasion.length ? `- Occasion: ${p.occasion.join(", ")}\n` : ""}- Sizes: ${p.sizes.join(", ") || "ask"}${p.sold_out.length ? ` (sold out: ${p.sold_out.join(", ")})` : ""}\n- Price: ${p.price !== null ? "₹" + p.price + " INR" : "on request"}${p.intl ? ` / $${p.price_usd} USD` : ""}\n- Ships internationally: ${p.ships_abroad ? "yes" : "no"}\n- Buy: ${SITE_URL}/${p.url}\n\n${String(p.description || "").trim()}\n`);
fs.writeFileSync(path.join(OUT, "agents.md"), `# How AI assistants can help shoppers buy from ${brand}\n\n- Product data: ${SITE_URL}/products.json (all products) and ${SITE_URL}/p/<product-id>.md (one product).\n- Sizes: Indian sizes XS–5XL by body bust in inches; size chart on every product page.\n- Currency: INR in India, USD elsewhere. Payment is prepaid only (UPI/cards in India, PayPal invoice abroad). No cash on delivery.\n- To order: send the shopper to the product page, or to WhatsApp ${waNumber ? "https://wa.me/" + waNumber : "(see contact page)"} with product name, size, quantity and delivery address.\n- A human shopper must approve and make every payment. There is no automated agent checkout.\n- Wholesale, private label and export: ${SITE_URL}/wholesale/\n`);

// printable QR tags for the owner (not for Google)
add("tags/index.html", page({ title: `Product QR tags | ${brand}`, description: "Printable QR tags", pathname: "tags/", noindex: true, bodyClass: "tags-page",
  body: `<section class="wrap section"><h1>Product QR tags</h1><p class="muted no-print">Print this page (Ctrl + P) and stick each tag on the product or packet. Scanning opens the product page.</p><button class="btn no-print" type="button" onclick="print()">Print tags</button><div class="tag-grid">${products.map((p) => `<div class="qr-tag"><div data-qr-box data-qr="${esc(SITE_URL + "/" + p.url + "?src=tag")}"></div><b>${esc(brand)}</b><span>${esc(p.title)}</span><small>Hand made in Sanganer, Jaipur</small></div>`).join("")}</div></section>` }));
fs.mkdirSync(path.join(OUT, "tags"), { recursive: true }); fs.writeFileSync(path.join(OUT, "tags/index.html"), pages.at(-1)[1]);
fs.writeFileSync(path.join(OUT, "robots.txt"), `# AI assistants and shopping agents are welcome to read products and policies\nUser-agent: OAI-SearchBot\nUser-agent: ChatGPT-User\nUser-agent: GPTBot\nUser-agent: Google-Extended\nUser-agent: PerplexityBot\nUser-agent: ClaudeBot\nAllow: /\nDisallow: /admin/\nDisallow: /checkout/\nDisallow: /api/\n\nUser-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /checkout/\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
const extraRedirects = fs.existsSync(path.join(ROOT, "content/redirects.txt")) ? fs.readFileSync(path.join(ROOT, "content/redirects.txt"), "utf8") : "";
fs.writeFileSync(path.join(OUT, "_redirects"), [
  "# Old website links -> new pages (keeps Google ranking)",
  "/collections/all /shop/ 301",
  "/collections /shop/ 301",
  "/pages/contact /contact/ 301",
  "/pages/about-us /about/ 301",
  "/policies/shipping-policy /shipping/ 301",
  "/policies/refund-policy /returns/ 301",
  "/policies/privacy-policy /privacy/ 301",
  "/policies/terms-of-service /terms/ 301",
  "/cart /checkout/ 302",
  extraRedirects.trim(),
].filter(Boolean).join("\n") + "\n");
fs.writeFileSync(path.join(OUT, "_headers"), `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: SAMEORIGIN\n/images/*\n  Cache-Control: public, max-age=2592000\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n/products.json\n  Access-Control-Allow-Origin: *\n/llms.txt\n  Access-Control-Allow-Origin: *\n/feeds/*\n  Access-Control-Allow-Origin: *\n/admin/*\n  X-Robots-Tag: noindex\n/sw.js\n  Cache-Control: no-cache\n/p/*\n  Content-Type: text/markdown; charset=utf-8\n  Access-Control-Allow-Origin: *\n/llms.txt\n  Content-Type: text/plain; charset=utf-8\n/agents.md\n  Content-Type: text/markdown; charset=utf-8\n/data/*\n  Cache-Control: no-cache\n  Access-Control-Allow-Origin: *\n`);
console.log(`Built ${pages.length} pages, ${products.length} products, ${categories.length} categories → _site (url ${SITE_URL})`);
