#!/usr/bin/env node
// Demand radar + pulse alert – weekly, from Google Search Console data (via Windsor.ai).
// Output is an EMAIL to the owner only. Raw query data is never written into this public repo.
//
// Needs (GitHub → Settings → Secrets and variables → Actions):
//   WINDSOR_API_KEY   Windsor.ai API key (Search Console already connected there)
//   BREVO_API_KEY     Brevo API key (transactional email)
//   OWNER_EMAIL       where the report goes
//   BREVO_SENDER      optional – a sender address verified in Brevo (default bahekurti@gmail.com)
//   WINDSOR_SC_URL    optional – override the Windsor endpoint (default https://connectors.windsor.ai/searchconsole)
// Local test with a JSON file of rows instead of the API:  RADAR_MOCK=rows.json node scripts/demand-radar.mjs --print
//
// What it produces (mostly "improve an existing page", never auto-published content):
//   1. Rising searches – impressions at least doubled vs the previous 28 days, position 8–30 → improve that page
//   2. Low click-through – page seen a lot but clicked little → rewrite its title and description
//   3. New-guide ideas – at most 2, only for searches with real demand that no page ranks for yet
//   4. Pulse – clicks in the last 7 days fell 40%+ vs the 7 days before → alert
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const PRINT = process.argv.includes("--print");
const S = JSON.parse(fs.readFileSync(path.join(ROOT, "content/settings.json"), "utf8"));
const E = S.engine || {};
if (E.demand_radar === false && E.alerts_email === false) { console.log("demand-radar: switched off in settings.engine"); process.exit(0); }
const env = process.env;
const SITE = "https://bahekurtiz.com";

const day = (n) => new Date(Date.now() + 5.5 * 36e5 - n * 864e5).toISOString().slice(0, 10);
// Search Console data lags ~2–3 days: windows end 3 days ago
const END = day(3), A0 = day(30), B0 = day(58), B1 = day(31), W1a = day(9), W0a = day(16), W0b = day(10);

async function rows() {
  if (env.RADAR_MOCK) return JSON.parse(fs.readFileSync(env.RADAR_MOCK, "utf8"));
  if (!env.WINDSOR_API_KEY) { console.log("demand-radar: WINDSOR_API_KEY not set – skipping (add it as a GitHub Actions secret)"); process.exit(0); }
  const base = env.WINDSOR_SC_URL || "https://connectors.windsor.ai/searchconsole";
  const q = new URLSearchParams({ api_key: env.WINDSOR_API_KEY, date_from: B0, date_to: END, fields: "date,query,page,clicks,impressions,position" });
  const r = await fetch(`${base}?${q}`, { signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error(`Windsor ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return Array.isArray(j) ? j : j.data || [];
}

const data = (await rows()).map((x) => ({ d: String(x.date || "").slice(0, 10), q: String(x.query || "").trim().toLowerCase(), p: String(x.page || "").trim(), c: +x.clicks || 0, i: +x.impressions || 0, pos: +x.position || 0 })).filter((x) => x.d);
if (!data.length) { console.log("demand-radar: no rows returned"); process.exit(0); }

const inR = (x, a, b) => x.d >= a && x.d <= b;
const agg = (list, key) => { const m = new Map(); for (const x of list) { const k = key(x); const o = m.get(k) || { c: 0, i: 0, pw: 0, pages: new Map() }; o.c += x.c; o.i += x.i; o.pw += x.pos * x.i; o.pages.set(x.p, (o.pages.get(x.p) || 0) + x.i); m.set(k, o); } for (const o of m.values()) { o.pos = o.i ? o.pw / o.i : 0; o.page = [...o.pages].sort((a, b) => b[1] - a[1])[0]?.[0] || ""; } return m; };
const now = data.filter((x) => inR(x, A0, END)), prev = data.filter((x) => inR(x, B0, B1));
const qNow = agg(now.filter((x) => x.q), (x) => x.q), qPrev = agg(prev.filter((x) => x.q), (x) => x.q);
const pNow = agg(now, (x) => x.p);
const short = (u) => u.replace(SITE, "") || "/";

// 1. rising searches on existing pages
const rising = [...qNow].filter(([q, o]) => o.i >= 50 && o.i >= 2 * (qPrev.get(q)?.i || 0) && o.pos >= 8 && o.pos <= 30)
  .sort((a, b) => b[1].i - a[1].i).slice(0, 10)
  .map(([q, o]) => ({ q, i: o.i, prev: qPrev.get(q)?.i || 0, pos: o.pos.toFixed(1), page: o.page }));

// 2. pages seen a lot but clicked little
const ctrs = [...pNow].filter(([, o]) => o.i >= 100).map(([p, o]) => ({ p, i: o.i, c: o.c, ctr: o.c / o.i, pos: o.pos }));
const med = ctrs.map((x) => x.ctr).sort((a, b) => a - b)[Math.floor(ctrs.length / 2)] || 0;
const lowCtr = ctrs.filter((x) => x.ctr < med / 2 && x.pos <= 15).sort((a, b) => b.i - a.i).slice(0, 8);

// 3. new-guide ideas – strict gates: real demand, no page ranks well, max 2
const ideas = [...qNow].filter(([q, o]) => o.i >= 50 && o.pos > 30 && q.split(" ").length >= 3 && !/bahe|kurtiz/.test(q))
  .sort((a, b) => b[1].i - a[1].i).slice(0, 2).map(([q, o]) => ({ q, i: o.i, pos: o.pos.toFixed(0) }));

// 4. pulse: last 7 days vs the 7 before
const sum = (a, b) => data.filter((x) => inR(x, a, b)).reduce((s, x) => s + x.c, 0);
const wNow = sum(W1a, END), wPrev = sum(W0a, W0b);
const drop = wPrev >= 20 && wNow < wPrev * 0.6;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const li = (a, f) => a.length ? `<ol>${a.map((x) => `<li>${f(x)}</li>`).join("")}</ol>` : "<p>Is hafte kuch nahi.</p>";
const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;max-width:640px">
<h2>Bahe Kurtiz – is hafte ka Google radar (${A0} se ${END})</h2>
${drop ? `<p style="background:#fde8e8;padding:10px;border-radius:6px"><b>⚠️ Alert:</b> pichhle 7 din me Google se clicks ${wPrev} se gir ke ${wNow} ho gaye (40%+ kam). Search Console me "Pages" aur "Manual actions" dekhiye, ya Claude ko boliye check karne.</p>` : `<p>Clicks: pichhle 7 din ${wNow}, usse pehle ke 7 din ${wPrev}.</p>`}
<h3>1. Ye pages upar aa sakte hain – inhe behtar karo</h3>
<p>In searches me log aapki site zyada dekh rahe hain, par aap page 1 par nahi ho. Page me is sawaal ka seedha jawab, achhi photo aur products jodo.</p>
${li(rising, (x) => `<b>"${esc(x.q)}"</b> – ${x.i} impressions (pehle ${x.prev}), position ${x.pos}<br>Page: <a href="${esc(x.page)}">${esc(short(x.page))}</a>`)}
<h3>2. Dikhte hain par click kam – title aur description badlo</h3>
${li(lowCtr, (x) => `<a href="${esc(x.p)}">${esc(short(x.p))}</a> – ${x.i} impressions, ${x.c} clicks (${(x.ctr * 100).toFixed(1)}%), position ${x.pos.toFixed(1)}`)}
<h3>3. Naye guide ka idea (max 2 – sirf tab likho jab aapke paas asli jaankari/photo ho)</h3>
${li(ideas, (x) => `"${esc(x.q)}" – ${x.i} impressions, abhi position ${x.pos}`)}
<p style="color:#666;font-size:13px">Ye email har Sunday apne aap aata hai. Isme se kuch bhi apne aap website par publish nahi hota. Band karna ho to /admin → Settings → Automatic engine.</p></div>`;

if (PRINT) { console.log(html.replace(/<[^>]+>/g, " ").replace(/\s+\n/g, "\n").replace(/ {2,}/g, " ")); }
console.log(`demand-radar: ${rising.length} rising, ${lowCtr.length} low-CTR, ${ideas.length} ideas, pulse ${wNow}/${wPrev}${drop ? " DROP" : ""}`);

const wantEmail = (E.demand_radar !== false) || (drop && E.alerts_email !== false);
if (!wantEmail || PRINT) process.exit(0);
if (!env.BREVO_API_KEY || !env.OWNER_EMAIL) { console.log("demand-radar: BREVO_API_KEY / OWNER_EMAIL not set – report not emailed"); process.exit(0); }
const r = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", headers: { "api-key": env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
  body: JSON.stringify({ sender: { email: env.BREVO_SENDER || "bahekurti@gmail.com", name: "Bahe Kurtiz radar" }, to: [{ email: env.OWNER_EMAIL }], subject: `${drop ? "⚠️ " : ""}Google radar – ${END}`, htmlContent: html }) });
console.log(`demand-radar: email → ${r.status}`);
if (!r.ok) { console.log((await r.text()).slice(0, 300)); process.exit(1); }
