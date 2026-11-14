#!/usr/bin/env node
// Festival & wedding-season engine – weekly step.
// Run AFTER `node build.mjs` (it reads _site/data/festival-plan.json, written by the build from content/calendar.json).
//   node scripts/festival-engine.mjs            → writes missing drafts to drafts/<event>-<year>.md and prints a report
//   node scripts/festival-engine.mjs --dry      → report only
// Drafts are for the owner to post by hand (Google Business, Instagram, Facebook, LinkedIn, X, WhatsApp, Brevo email).
// No discounts or offers are ever written here – only real facts from the site (dates, delivery, products, prices).
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const PLAN = path.join(ROOT, "_site/data/festival-plan.json");
const DRY = process.argv.includes("--dry");
{ const S0 = JSON.parse(fs.readFileSync(path.join(ROOT, "content/settings.json"), "utf8")); if (S0.engine && S0.engine.festival_drafts === false) { console.log("festival-engine: switched off in settings.engine.festival_drafts"); process.exit(0); } }
if (!fs.existsSync(PLAN)) { console.error("Run `node build.mjs` first (missing _site/data/festival-plan.json)."); process.exit(1); }
const P = JSON.parse(fs.readFileSync(PLAN, "utf8"));
const today = P.today, ms = (d) => Date.parse(d + "T00:00:00Z"), plus = (d, n) => new Date(ms(d) + n * 864e5).toISOString().slice(0, 10);
const nice = (d) => new Date(ms(d)).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const short = (d) => new Date(ms(d)).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const SOON = plus(today, 7); // weekly routine: also prepare what starts before next week's run
const startOf = (e) => [e.india_window?.[0], e.intl_window?.[0]].filter(Boolean).sort()[0] || e.date;
const DDIR = path.join(ROOT, "drafts");
const tag = (h) => h.map((x) => "#" + x.replace(/[^A-Za-z0-9]/g, "")).join(" ");
const inr = (n) => "₹" + Number(n).toLocaleString("en-IN");

function draft(e) {
  const c = e.copy || {}, yr = e.date.slice(0, 4), shop = e.page_url || (c.shop ? `${P.site}/${c.shop}` : `${P.site}/shop/`), guide = c.guide ? `${P.site}/${c.guide}` : "";
  const season = e.kind === "season", obI = !season && e.india_window && e.order_by.india >= today ? e.order_by.india : "", obX = !season && e.intl_window && e.order_by.abroad >= today ? e.order_by.abroad : "";
  const prods = (e.products || []).slice(0, 3), wa = P.whatsapp ? `https://wa.me/${P.whatsapp}` : "";
  const pLines = prods.map((p) => `- ${p.title} – ${inr(p.price)}${p.price_usd ? ` / $${p.price_usd}` : ""}: ${p.url}`).join("\n");
  const when = season ? `${short(e.date)} – ${short(e.end || e.date)}` : nice(e.date);
  const order = [obI && `India: order by ${short(obI)}`, obX && `USA, UK, Canada, UAE & Australia: order by ${short(obX)} (free shipping, duties paid)`].filter(Boolean);
  const orderTxt = order.length ? order.join(" · ") : "Ask us on WhatsApp for the delivery time to your city.";
  const H = tag([...(c.hashtags || []), "BaheKurtiz", "HandmadeInJaipur", "IndianWear"]);
  const x280 = (() => { let t = `${c.hook}. ${cap(c.wear)} – stitched to your size in Jaipur. ${obX ? `Abroad? Order by ${short(obX)}.` : obI ? `Order by ${short(obI)}.` : ""} ${shop}`; return t.replace(/\s+/g, " ").trim().slice(0, 280); })();
  return `# ${e.name} ${yr} – ready-to-post drafts

> Prepared automatically on ${today} by the festival engine. **Nothing here is posted** – copy, check and post yourself.
> Date: **${when}** (source: ${e.source}${e.note ? ` – ${e.note}` : ""})
> Shop link: ${shop}${guide ? `\n> Guide: ${guide}` : ""}
> Last order dates: ${orderTxt}
> No discount is mentioned anywhere. If you want a sale for ${e.name}, tell Claude first – prices are never changed automatically.

## Products to feature
${pLines || "- (no strong match yet – use the shop link)"}

## Google Business Profile post (type: Update · button: Shop / Learn more → shop link)
${c.hook}! ${cap(c.wear)}. Colours we love for it: ${(c.colours || []).join(", ")}.
Every piece is designed and stitched in our own unit in Sanganer, Jaipur – with free custom fit to your measurements.
${orderTxt}
Shop: ${shop}

## Instagram caption (use 3–5 product photos or a Reel)
${c.hook} ✨
${cap(c.wear)} – handmade in Jaipur, stitched to your size.

🎨 Colours: ${(c.colours || []).join(" · ")}
📦 ${orderTxt}
🔗 Link in bio · DM or WhatsApp us for sizes

${H}

## Facebook post
${c.hook}! Looking for something to wear? ${cap(c.wear)}.
${prods.length ? `Our picks:\n${pLines}\n` : ""}${orderTxt}
Free custom fit – send your bust, waist and hip and we stitch to your measurements.
👉 ${shop}

## LinkedIn post (boutiques & retailers – wholesale angle)
${e.name} (${when}) is one of the busiest weeks for Indian ethnic wear retail${season ? "" : " – in India and in diaspora markets abroad"}.
Boutique owners planning stock: we manufacture hand block print and embroidered kurta sets and Anarkalis in our own unit in Sanganer, Jaipur, with private label and low minimums for new boutiques.
Plan early – production + shipping needs time.
Wholesale quote: ${P.site}/wholesale/quote/

## X (Twitter) – max 280 characters
${x280}

## WhatsApp broadcast
*${c.hook}* ✨
${cap(c.wear)}.
${prods.map((p) => `• ${p.title} – ${inr(p.price)}${p.price_usd ? ` / $${p.price_usd}` : ""}\n${p.url}`).join("\n")}
${orderTxt}
Reply with your size or measurements and we will help you choose.${wa ? `\n${wa}` : ""}

## Email (Brevo)
_Send to the Brevo lists **Bahe Festival Reminders** (people who asked for a reminder on the festival pages) and **Bahe VIP**, a few days before the last order date._

**Subject:** ${c.hook} – ${(c.colours || []).slice(0, 2).join(" & ")} edit from Jaipur
**Preheader:** ${cap(c.wear)}.

Hi {{ contact.FIRSTNAME | default : "there" }},

${c.hook}. ${cap(c.wear)}.

${prods.length ? `Three styles we would pick:\n${pLines}\n\n` : ""}**When to order:** ${orderTxt}

Every piece is made in our own Jaipur unit, with free custom fit.${guide ? `\nStyling guide: ${guide}` : ""}

[Shop the ${e.name} edit](${shop})

Team ${P.brand}
`;
}
const cap = (s) => String(s || "").replace(/^./, (m) => m.toUpperCase());

const rep = { written: [], exists: [], needCopy: [], needTheme: [], noPage: [], active: [], soon: [], finishedDrafts: [] };
if (!fs.existsSync(DDIR) && !DRY) fs.mkdirSync(DDIR, { recursive: true });
const existing = fs.existsSync(DDIR) ? fs.readdirSync(DDIR) : [];
for (const e of P.events) {
  const fname = `${e.id}-${e.date.slice(0, 4)}.md`;
  if (e.status === "finished") { if (existing.includes(fname)) rep.finishedDrafts.push(fname); continue; }
  const prepare = e.status === "active" || (e.status === "upcoming" && startOf(e) <= SOON);
  if (e.status === "active") rep.active.push(e); else if (prepare) rep.soon.push(e);
  if (!prepare) continue;
  if (e.drafts !== false && e.audience !== "intl" && !e.theme_ok && e.kind === "festival") rep.needTheme.push(e.name);
  if (e.page && !e.page_url.includes("/festival/")) rep.noPage.push(e.name);
  if (e.drafts === false) continue;
  if (!e.copy || !e.copy.hook) { rep.needCopy.push(e.name); continue; }
  if (existing.includes(fname)) { rep.exists.push(fname); continue; }
  if (!DRY) fs.writeFileSync(path.join(DDIR, fname), draft(e));
  rep.written.push(fname);
}
const coverOk = P.covers_until && P.covers_until >= plus(today, 330);
const line = (e) => `${e.name} (${e.kind === "season" ? short(e.date) + "–" + short(e.end || e.date) : short(e.date)})`;
console.log(`Festival engine – ${today}
Banner now: India → ${P.banner.india || "-"}, abroad → ${P.banner.abroad || "-"}
Active: ${rep.active.map(line).join(", ") || "-"}
Starting before next run: ${rep.soon.map(line).join(", ") || "-"}
Drafts written: ${rep.written.join(", ") || "-"}${DRY ? " (dry run – nothing written)" : ""}
Drafts already there: ${rep.exists.join(", ") || "-"}
Needs copy in calendar.json (hook/wear/colours/hashtags) before drafts: ${rep.needCopy.join(", ") || "-"}
Needs a banner theme in banner-calendar.json: ${rep.needTheme.join(", ") || "-"}
Festival page not built (fewer than 4 matching styles – shop link falls back): ${rep.noPage.join(", ") || "-"}
Finished festivals with drafts (can be archived – ask before deleting): ${rep.finishedDrafts.join(", ") || "-"}
Calendar covers until ${P.covers_until || "?"}${coverOk ? " – OK" : " – EXTEND content/calendar.json (verify new dates on drikpanchang.com / timeanddate.com)"}
Festival calendar page: ${P.calendar_page || "-"}`);
