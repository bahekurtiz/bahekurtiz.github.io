#!/usr/bin/env node
// Weekly drafts kit – ready-to-post text for 3 products, for the owner to post HIMSELF.
// Run AFTER `node build.mjs` (reads _site/products.json and _site/data/festival-plan.json).
//   node scripts/drafts-kit.mjs          → writes drafts/kit/<YYYY>-W<ww>.md (skips if it already exists)
//   node scripts/drafts-kit.mjs --dry    → prints the kit, writes nothing
// Rules (owner): nothing is ever posted automatically; only real facts from the site (product data, prices,
// dispatch times from settings); no discounts, no scarcity, no review numbers. scripts/lint-claims.mjs checks the file.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DRY = process.argv.includes("--dry");
const CAT = path.join(ROOT, "_site/products.json"), PLAN = path.join(ROOT, "_site/data/festival-plan.json");
if (!fs.existsSync(CAT)) { console.error("Run `node build.mjs` first (missing _site/products.json)."); process.exit(1); }
const S = JSON.parse(fs.readFileSync(path.join(ROOT, "content/settings.json"), "utf8"));
if (S.engine && S.engine.drafts_kit === false) { console.log("drafts-kit: switched off in settings.engine.drafts_kit"); process.exit(0); }
const C = JSON.parse(fs.readFileSync(CAT, "utf8"));
const P = fs.existsSync(PLAN) ? JSON.parse(fs.readFileSync(PLAN, "utf8")) : { events: [], today: new Date().toISOString().slice(0, 10) };

// ISO week label, IST
const now = new Date(Date.now() + 5.5 * 36e5);
const isoWeek = (d) => { const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return [t.getUTCFullYear(), Math.ceil(((t - y0) / 864e5 + 1) / 7)]; };
const [YY, WW] = isoWeek(now), WEEK = `${YY}-W${String(WW).padStart(2, "0")}`;
const OUTDIR = path.join(ROOT, "drafts/kit"), OUT = path.join(OUTDIR, `${WEEK}.md`);
if (fs.existsSync(OUT) && !DRY) { console.log(`drafts-kit: ${path.relative(ROOT, OUT)} already exists – nothing to do`); process.exit(0); }

// rotation: 3 in-stock products per week, cycling through the catalogue in a stable order
const pool = C.products.filter((p) => p.in_stock && p.images && p.images.length && p.price_inr).sort((a, b) => a.id.localeCompare(b.id));
if (!pool.length) { console.log("drafts-kit: no in-stock products"); process.exit(0); }
const start = ((YY * 53 + WW) * 3) % pool.length;
const picks = [0, 1, 2].map((i) => pool[(start + i) % pool.length]).filter((p, i, a) => a.indexOf(p) === i);

const inr = (n) => "₹" + Number(n).toLocaleString("en-IN");
const list = (a) => (Array.isArray(a) ? a : []).filter(Boolean);
const lc = (s) => String(s || "").toLowerCase();
const utm = (url, src, med) => `${url}${url.includes("?") ? "&" : "?"}utm_source=${src}&utm_medium=${med}&utm_campaign=kit-${WEEK.toLowerCase()}`;
const dispatch = S.dispatch_note || "Handmade in Jaipur";
const wa = S.whatsapp ? `https://wa.me/91${String(S.whatsapp).replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "")}` : "";
const tags = (p) => ["BaheKurtiz", "HandmadeInJaipur", ...list(p.craft).slice(0, 2), p.category, p.fabric, ...list(p.occasion).slice(0, 2)]
  .filter(Boolean).map((t) => "#" + String(t).replace(/[^A-Za-z0-9]/g, "")).filter((t, i, a) => t.length > 2 && a.indexOf(t) === i).join(" ");

function block(p, n) {
  const craft = list(p.craft).join(", "), occ = list(p.occasion).slice(0, 3).join(", ");
  const usd = p.ships_internationally && p.price_usd ? ` · $${p.price_usd} abroad (free shipping, duties included)` : "";
  const what = `${lc(p.fabric)} ${lc(p.category)}`.trim();
  return `## ${n}. ${p.title}

Product page: ${p.url}
Price: ${inr(p.price_inr)} in India${usd}
Photos: ${p.images.slice(0, 4).join(" · ")}

### Instagram / Facebook caption (search-friendly – Google indexes public Instagram posts)
${p.title} ✨
${craft ? `${craft} on ${lc(p.fabric) || "fabric"}` : cap(what)}, designed and stitched in our own unit in Sanganer, Jaipur.
Made for: ${occ || "everyday and festive wear"}.
Sizes ${list(p.sizes)[0] || "XS"}–${list(p.sizes).at(-1) || "3XL"} or free custom fit to your measurements.
📦 ${dispatch}
🔗 Link in bio${wa ? ` · WhatsApp us for sizes: ${wa}` : ""}

${tags(p)}

### Reel script (under 60 seconds, your own footage)
1. 0–3s: close-up of the ${craft ? lc(craft.split(",")[0]) : "fabric"} – text on screen: "${p.title.split(" ").slice(0, 6).join(" ")}"
2. 3–10s: hand on the fabric, show the ${lc(p.fabric) || "fabric"} texture in daylight
3. 10–25s: full look on model, front and back
4. 25–40s: twirl or walk; text: "Made in our Jaipur unit"
5. 40–55s: text: "${inr(p.price_inr)}${p.ships_internationally && p.price_usd ? ` · $${p.price_usd} worldwide, duties included` : ""} – link in bio"
Use original audio or a licensed track from the Instagram library. Do not repost others' videos.

### Pinterest – 3 pin ideas (post from your Pinterest account)
- Title: ${p.title.slice(0, 95)}
  Description: ${cap(what)}${craft ? ` with ${lc(craft)}` : ""}, handmade in Jaipur. ${occ ? `For ${lc(occ)}.` : ""} Free custom fit.
  Link: ${utm(p.url, "pinterest", "organic")}
- Title: ${occ ? `${list(p.occasion)[0]} outfit idea: ${lc(p.color || "").split(" with")[0]} ${lc(p.category)}`.slice(0, 95) : `${p.category} from Jaipur`}
  Link: ${utm(p.url, "pinterest", "organic")}
- Title: ${craft ? `How ${craft.split(",")[0]} is done in Jaipur – ${lc(p.category)}`.slice(0, 95) : `${p.fabric} ${lc(p.category)} care and styling`}
  Link: ${utm(p.url, "pinterest", "organic")}

### WhatsApp Channel / Status (only to people who follow you)
New in our Jaipur unit: ${p.title}. ${inr(p.price_inr)}${p.ships_internationally && p.price_usd ? ` · $${p.price_usd} abroad` : ""}. ${utm(p.url, "whatsapp", "channel")}
`;
}
function cap(s) { s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); }

// upcoming festivals in the next 8 weeks (drafts come from scripts/festival-engine.mjs)
const today = P.today || now.toISOString().slice(0, 10), in8 = new Date(Date.parse(today) + 56 * 864e5).toISOString().slice(0, 10);
const fests = (P.events || []).filter((e) => e.kind !== "season" && e.date >= today && e.date <= in8 && ((e.order_by?.abroad || "") >= today || (e.order_by?.india || "") >= today)).sort((a, b) => a.date.localeCompare(b.date));
const fx = fests.map((e) => { const f = `drafts/${e.id}-${e.date.slice(0, 4)}.md`; return `- **${e.name}** – ${e.date}${e.order_by?.abroad ? ` · abroad order by ${e.order_by.abroad}` : ""}${e.order_by?.india ? ` · India order by ${e.order_by.india}` : ""}${fs.existsSync(path.join(ROOT, f)) ? ` · drafts: \`${f}\`` : ""}`; }).join("\n");

const md = `# Drafts kit ${WEEK}

> Made automatically on ${today}. **Nothing here is posted.** Check each line, post it yourself, and change anything you like.
> Facts come from the product pages and settings only. No discount, stock count or review number is written here.

## This week's 3 products
${picks.map((p, i) => `- ${p.title}`).join("\n")}

## Festivals in the next 8 weeks
${fx || "- None in the next 8 weeks."}

${picks.map((p, i) => block(p, i + 1)).join("\n")}
## Google Business Profile update (optional, only if your profile is set up)
New this week from our Sanganer unit: ${picks.map((p) => p.title).join("; ")}. ${dispatch}. Shop: ${utm(`${C.url || "https://bahekurtiz.com"}/shop/`, "google", "gbp")}
`;

if (DRY) { console.log(md); process.exit(0); }
fs.mkdirSync(OUTDIR, { recursive: true });
fs.writeFileSync(OUT, md);
console.log(`drafts-kit: wrote ${path.relative(ROOT, OUT)} (${picks.length} products, ${fests.length} festivals)`);
