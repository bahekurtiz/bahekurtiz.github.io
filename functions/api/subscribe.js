// Bahe Kurtiz – add website visitors to Brevo email lists (no list IDs to configure).
// Needs one Cloudflare secret: BREVO_API_KEY.  Lists are created automatically by name.
// POST /api/subscribe  {type, email, name, country, consent}
const B = "https://api.brevo.com/v3";
const LISTS = { vip: "Bahe VIP", checkout: "Bahe Checkout Started", customers: "Bahe Customers" };
let cache = null;
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });

async function api(key, path, method = "GET", body) {
  const r = await fetch(B + path, { method, headers: { "api-key": key, accept: "application/json", "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let d = {}; try { d = t ? JSON.parse(t) : {}; } catch {}
  return { ok: r.ok, status: r.status, d };
}
async function listIds(key) {
  if (cache) return cache;
  const have = {}; let off = 0;
  for (;;) { const r = await api(key, `/contacts/lists?limit=50&offset=${off}`); const ls = r.d.lists || []; ls.forEach((l) => (have[l.name] = l.id)); if (ls.length < 50) break; off += 50; }
  let folder = (await api(key, "/contacts/folders?limit=1")).d.folders?.[0]?.id;
  if (!folder) folder = (await api(key, "/contacts/folders", "POST", { name: "Bahe Kurtiz" })).d.id;
  const out = {};
  for (const [k, name] of Object.entries(LISTS)) out[k] = have[name] || (await api(key, "/contacts/lists", "POST", { name, folderId: folder })).d.id;
  return (cache = out);
}

export async function onRequestPost({ request, env }) {
  const key = env.BREVO_API_KEY; if (!key) return J({ ok: false, error: "no key" }, 200);
  let b = {}; try { b = await request.json(); } catch { return J({ error: "bad" }, 400); }
  const email = String(b.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) return J({ ok: false, error: "email" }, 200);
  const type = String(b.type || "");
  const which = type === "paid" ? "customers" : type === "checkout_started" ? "checkout" : ["signup", "google", "follow"].includes(type) ? "vip" : "";
  if (!which) return J({ ok: false, error: "type" }, 200);
  if (which !== "customers" && b.consent === "no") return J({ ok: false, error: "consent" }, 200);
  try {
    const ids = await listIds(key);
    const name = String(b.name || "").trim().slice(0, 60);
    const r = await api(key, "/contacts", "POST", { email, updateEnabled: true, listIds: [ids[which]], attributes: name ? { FIRSTNAME: name.split(/\s+/)[0] } : {} });
    if (which === "customers" && ids.checkout) await api(key, `/contacts/${encodeURIComponent(email)}`, "PUT", { unlinkListIds: [ids.checkout] });
    return J({ ok: r.ok || r.status === 204, list: LISTS[which] });
  } catch (e) { return J({ ok: false, error: "down" }, 200); }
}
