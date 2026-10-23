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


const FROM = { name: "Bahe Kurtiz", email: "bahekurti@gmail.com" };
function welcome(email, name) {
  const first = (String(name || "").trim().split(/\s+/)[0] || "there").replace(/[<>&"]/g, "");
  const html = `<!doctype html><html><body style="margin:0;background:#f6f1e9;font-family:Arial,Helvetica,sans-serif;color:#2b2522">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f1e9;padding:24px 0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:#0e5b59;padding:22px;text-align:center"><img src="https://bahekurtiz.com/images/site/logo.png" alt="Bahe Kurtiz" width="150" style="display:inline-block;filter:brightness(0) invert(1)"></td></tr>
<tr><td style="padding:30px 32px 10px">
<p style="margin:0 0 6px;font-size:12px;letter-spacing:3px;color:#a8812f">BAHE VIP</p>
<h1 style="margin:0 0 16px;font-family:Georgia,serif;font-weight:normal;font-size:26px;color:#0e5b59">Welcome, ${first}!</h1>
<p style="margin:0 0 14px;font-size:15px;line-height:1.6">Every Bahe piece is hand block printed or hand embroidered in Jaipur and stitched to your measurements – so it fits you, not a size chart.</p>
<p style="margin:0 0 14px;font-size:15px;line-height:1.6"><b>Your VIP gift:</b> a free handmade potli with your first order. It is packed automatically – no code needed.</p>
<p style="margin:0 0 22px;font-size:15px;line-height:1.6">As a VIP, you hear first about new prints, limited drops and festive edits.</p>
<p style="margin:0 0 26px;text-align:center"><a href="https://bahekurtiz.com/diwali-outfits-for-women/" style="background:#0e5b59;color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:6px;font-size:14px;letter-spacing:1px;display:inline-block">SHOP THE DIWALI EDIT</a></p>
<p style="margin:0 0 6px;font-size:14px;line-height:1.6">Need help with size or a custom fit? <a href="https://wa.me/917073350886" style="color:#0e5b59">WhatsApp us</a> – a real person from our Jaipur team will reply.</p>
<p style="margin:18px 0 26px;font-size:14px">With love from Jaipur,<br>Team Bahe Kurtiz</p>
</td></tr>
<tr><td style="background:#f6f1e9;padding:14px;text-align:center;font-size:11px;color:#7a6f66">Free worldwide shipping to the USA, UK, Canada, UAE &amp; Australia · <a href="https://bahekurtiz.com" style="color:#7a6f66">bahekurtiz.com</a></td></tr>
</table></td></tr></table></body></html>`;
  return { sender: FROM, to: [{ email, name: first }], replyTo: FROM, subject: "Welcome to Bahe VIP 💚 Your free potli is waiting", htmlContent: html, tags: ["welcome"] };
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
    // New VIP (contact just created) -> send the welcome email directly, no Brevo automation needed
    if (which === "vip" && r.status === 201) { try { await api(key, "/smtp/email", "POST", welcome(email, name)); } catch {} }
    if (which === "customers" && ids.checkout) await api(key, `/contacts/${encodeURIComponent(email)}`, "PUT", { unlinkListIds: [ids.checkout] });
    return J({ ok: r.ok || r.status === 204, list: LISTS[which] });
  } catch (e) { return J({ ok: false, error: "down" }, 200); }
}
