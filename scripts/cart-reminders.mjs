// Bag reminders (abandoned checkout) – runs every hour from GitHub Actions (.github/workflows/cart-reminders.yml).
// Who: only people on the Brevo list "Bahe Checkout Started" – they typed their email at checkout AND ticked
// "email me a reminder if I don't finish this order". Paying moves them to "Bahe Customers" (functions/api/subscribe.js),
// so nobody who bought gets a reminder.
// When (owner, 21 Nov 2026 – never pester): reminder 1 one day after checkout, reminder 2 one week after; then nothing. Max 2 emails per bag.
// What: their own bag (items, total, a link that refills the bag on any device). Abroad: a reminder of the standing first-order welcome offer (FRIEND10) – no extra discounts, no fake urgency.
// Needs GitHub secret BREVO_API_KEY (optional BREVO_SENDER = sender email). DRY_RUN=1 → only prints.
const KEY = process.env.BREVO_API_KEY, DRY = !!process.env.DRY_RUN, B = "https://api.brevo.com/v3";
const FROM = { name: "Bahe Kurtiz", email: String(process.env.BREVO_SENDER || "").trim() || "bahekurti@gmail.com" };
const TEAL = "#0e5b59", SITE = "https://bahekurtiz.com";
if (!KEY) { console.log("cart-reminders: no BREVO_API_KEY – skipped"); process.exit(0); }
const api = async (path, method = "GET", body) => { const r = await fetch(B + path, { method, headers: { "api-key": KEY, accept: "application/json", "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); const t = await r.text(); let d = {}; try { d = t ? JSON.parse(t) : {}; } catch {} return { ok: r.ok, status: r.status, d }; };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const H = 36e5;
// international first-order welcome offer (content/settings.json intl_welcome_code) – a real, standing offer, shown to shoppers abroad
let WELCOME = null; try { const fs = await import("node:fs"); const S = JSON.parse(fs.readFileSync(new URL("../content/settings.json", import.meta.url), "utf8")); const w = String(S.intl_welcome_code || "").toUpperCase(); WELCOME = (S.coupons || []).find((c) => c && c.active && String(c.code).toUpperCase() === w && c.kind === "Percent" && (c.market === "Both" || c.market === "International")) || null; } catch {}

function email(n, c) {
  const a = c.attributes || {}, first = esc(String(a.FIRSTNAME || "").split(/\s+/)[0] || "there"), abroad = String(a.CART_TOTAL || "").startsWith("$");
  const items = String(a.CART_ITEMS || "").split("; ").filter(Boolean).map((x) => `<li style="margin:0 0 4px">${esc(x)}</li>`).join("");
  const btn = `<p style="margin:18px 0 20px;text-align:center"><a href="${esc(a.CART_URL)}" style="background:${TEAL};color:#fff;text-decoration:none;padding:13px 26px;border-radius:6px;font-size:14px;letter-spacing:1px;display:inline-block">RETURN TO MY BAG</a></p>`;
  const facts = abroad ? "Free express shipping with tracking, and import duties &amp; taxes are already included – nothing to pay on delivery. Unused ready-size pieces can be returned within 14 days for a full refund."
    : "Ready sizes are dispatched in 7–10 working days and delivered in 3–5 days. Easy returns within 7 days for unused pieces with tags.";
  const intro = n === 1 ? `You left ${items.split("<li").length - 1 > 1 ? "these pieces" : "this piece"} in your bag – we have saved it for you:` : `Still thinking about your bag? Happy to help with any question before you order:`;
  const extra = n === 2 ? `<ul style="margin:0 0 14px;padding-left:18px;font-size:14px;line-height:1.6"><li><b>Size:</b> every style comes in XS–3XL (4XL in linen &amp; velvet) or free custom fit to your measurements – <a href="${SITE}/tools/indian-size-converter/" style="color:${TEAL}">size converter</a>.</li><li><b>Delivery:</b> ready sizes are dispatched in 7–10 working days${abroad ? ", then 5–10 business days to your door" : ""}.</li><li><b>Questions?</b> <a href="${SITE}/help/" style="color:${TEAL}">Ask us here</a> or simply reply to this email.</li></ul>` : "";
  const inner = `<p style="margin:0 0 6px;font-size:12px;letter-spacing:3px;color:#a8812f">YOUR BAG</p><h1 style="margin:0 0 12px;font-family:Georgia,serif;font-weight:normal;font-size:24px;color:${TEAL}">Hi ${first}</h1>
<p style="margin:0 0 10px;font-size:15px;line-height:1.6">${intro}</p><ul style="margin:0 0 6px;padding-left:18px;font-size:15px;line-height:1.5">${items}</ul><p style="margin:0 0 6px;font-size:15px"><b>Total: ${esc(a.CART_TOTAL)}</b></p>${abroad && WELCOME ? `<p style="margin:10px 0 0;padding:10px 12px;background:#fbf3e2;border-radius:6px;font-size:14px;line-height:1.5">🎁 <b>Your welcome offer: ${esc(WELCOME.value)}% off</b> your first order with code <b>${esc(WELCOME.code)}</b> – it is applied automatically when you return to your bag.</p>` : ""}${btn}${extra}
<p style="margin:0 0 14px;font-size:13px;line-height:1.6;color:#7a6f66">${facts}</p><p style="margin:18px 0 22px;font-size:14px">Team Bahe Kurtiz, Jaipur</p>
<p style="margin:0;font-size:11px;color:#9a9087">You get this because you asked us at checkout to remind you if you didn't finish your order. ${n === 1 ? "We send at most one more reminder." : "This is our last reminder about this bag."} <a href="mailto:bahekurti@gmail.com?subject=Unsubscribe" style="color:#9a9087">Unsubscribe</a></p>`;
  const html = `<!doctype html><html><body style="margin:0;background:#f6f1e9;font-family:Arial,Helvetica,sans-serif;color:#2b2522"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f1e9;padding:24px 0"><tr><td align="center"><table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:12px;overflow:hidden"><tr><td style="padding:22px;text-align:center;border-bottom:3px solid ${TEAL}"><img src="${SITE}/images/site/logo.png" alt="Bahe Kurtiz" width="150"></td></tr><tr><td style="padding:26px 28px 14px">${inner}</td></tr></table></td></tr></table></body></html>`;
  return { sender: FROM, to: [{ email: c.email, name: String(a.FIRSTNAME || "") || undefined }], replyTo: FROM, subject: n === 1 ? "You left something in your bag" : "Any questions about your bag? We're here to help", htmlContent: html, tags: ["cart-reminder-" + n], headers: { "List-Unsubscribe": "<mailto:bahekurti@gmail.com?subject=Unsubscribe>" } };
}

// lists by name
const lists = {}; for (let off = 0; ; off += 50) { const r = await api(`/contacts/lists?limit=50&offset=${off}`); (r.d.lists || []).forEach((l) => (lists[l.name] = l.id)); if (!r.ok || (r.d.lists || []).length < 50) break; }
const L = lists["Bahe Checkout Started"], CUST = lists["Bahe Customers"];
if (!L) { console.log("cart-reminders: list 'Bahe Checkout Started' not found – nothing to do"); process.exit(0); }
const since = new Date(Date.now() - 9 * 24 * H).toISOString();
const now = Date.now(); let sent = 0, seen = 0;
for (let off = 0; ; off += 500) {
  const r = await api(`/contacts/lists/${L}/contacts?limit=500&offset=${off}&modifiedSince=${encodeURIComponent(since)}`); const cs = r.d.contacts || [];
  for (const c of cs) {
    seen++; const a = c.attributes || {}; if (c.emailBlacklisted || !a.CART_URL || !a.CHECKOUT_AT) continue;
    if (CUST && (c.listIds || []).includes(CUST) && !(c.listIds || []).includes(L)) continue;
    const age = now - Date.parse(a.CHECKOUT_AT); if (!(age >= 0) || age > 8 * 24 * H) continue;
    const n = age >= 7 * 24 * H && !a.REMIND2_AT ? 2 : age >= 24 * H && age < 6 * 24 * H && !a.REMIND1_AT ? 1 : 0; if (!n) continue; // owner (21 Nov): never pester – at most one email a week
    console.log(`${DRY ? "[dry] " : ""}reminder ${n} → ${c.email.replace(/(.{2}).*@/, "$1•••@")} (${Math.round(age / H)} h)`);
    if (DRY) continue;
    const m = await api("/smtp/email", "POST", email(n, c));
    if (m.ok) { sent++; await api(`/contacts/${encodeURIComponent(c.email)}`, "PUT", { attributes: { [n === 1 ? "REMIND1_AT" : "REMIND2_AT"]: new Date().toISOString(), ...(n === 2 && !a.REMIND1_AT ? { REMIND1_AT: "skipped" } : {}) } }); }
    else console.log("  send failed:", m.status);
  }
  if (cs.length < 500) break;
}
console.log(`cart-reminders: checked ${seen} contacts, sent ${sent}`);
