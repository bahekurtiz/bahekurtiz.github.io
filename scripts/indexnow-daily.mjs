// Daily IndexNow ping (GitHub Actions, no sign-in needed): tells Bing – and through Bing, Copilot and ChatGPT search –
// plus Yandex, Seznam and Naver about changed pages. Reads the LIVE sitemap, sends every URL whose lastmod is in the
// last 2 days; on Mondays (IST) it sends all URLs once. The key file is served at https://bahekurtiz.com/<key>.txt
// (written by build.mjs). The Cloudflare build also pings IndexNow for changed pages on each live deploy – this is the
// independent daily backup with a visible log.
//   node scripts/indexnow-daily.mjs            (normal run)
//   node scripts/indexnow-daily.mjs --all      (send every sitemap URL)
const SITE_URL = "https://bahekurtiz.com";
const key = [...(SITE_URL + "|bahe-indexnow")].reduce((h, c) => (h * 33 + c.charCodeAt(0)) >>> 0, 5381).toString(16).padStart(8, "0").repeat(4);
const ist = new Date(Date.now() + 5.5 * 36e5);
const all = process.argv.includes("--all") || ist.getUTCDay() === 1;
const since = new Date(ist.getTime() - 2 * 864e5).toISOString().slice(0, 10);
const get = async (u) => { const r = await fetch(u, { headers: { "user-agent": "bahe-indexnow/1.0" } }); if (!r.ok) throw new Error(`${u} → ${r.status}`); return r.text(); };
try {
  const keyTxt = (await get(`${SITE_URL}/${key}.txt`)).trim();
  if (keyTxt !== key) throw new Error("live key file does not match – IndexNow would reject the ping");
  const xml = await get(`${SITE_URL}/sitemap.xml`);
  const entries = [...xml.matchAll(/<url><loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?/g)].map((m) => ({ loc: m[1], lm: (m[2] || "").slice(0, 10) }));
  const list = (all ? entries : entries.filter((e) => e.lm && e.lm >= since)).map((e) => e.loc).slice(0, 10000);
  console.log(`IndexNow: ${entries.length} sitemap URLs, sending ${list.length} (${all ? "all – weekly full ping" : "changed since " + since})`);
  if (!list.length) process.exit(0);
  const kr = await fetch(`${SITE_URL}/${key}.txt`, { headers: { "user-agent": "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)" } });
  console.log(`key file as bingbot: ${kr.status} ${kr.headers.get("content-type")} cf-mitigated=${kr.headers.get("cf-mitigated") || "-"} server=${kr.headers.get("server")}`);
  const body = JSON.stringify({ host: new URL(SITE_URL).host, key, keyLocation: `${SITE_URL}/${key}.txt`, urlList: list });
  let ok = 0; // each search engine shares IndexNow pings with the others – one acceptance is enough
  for (const ep of ["https://api.indexnow.org/indexnow", "https://www.bing.com/indexnow", "https://yandex.com/indexnow"]) {
    try { const r = await fetch(ep, { method: "POST", headers: { "content-type": "application/json; charset=utf-8" }, body }); const t = [200, 202].includes(r.status) ? "accepted" : (await r.text()).slice(0, 200); console.log(`${ep} → ${r.status} ${t}`); if ([200, 202].includes(r.status)) ok++; } catch (e) { console.log(`${ep} → ${e.message}`); }
  }
  if (!ok) process.exit(1);
} catch (e) { console.error("IndexNow failed:", e.message); process.exit(1); }
