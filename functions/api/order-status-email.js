// Bahe Kurtiz – automatic customer emails when the owner changes an order's status in the dashboard:
//   Paid      → order confirmed, being made in our Jaipur unit (skipped for PayPal / Razorpay: they got it at checkout)
//   Packed    → packed; photos of the piece before dispatch
//   Shipped   → courier, tracking number, tracking link, expected delivery
//   Delivered → thank you + one-tap Google review link (same link for everyone – no reward, no gating)
// POST /api/order-status-email  { ref, key }
// Safety: the owner key is checked by the Orders API (Google Apps Script). Email address, status and tracking are read
// from the Google Sheet through the Orders API – never trusted from the browser. Each result is written back to the
// sheet ("Customer emails" column) so the dashboard can show ✓ / ✗.
// Needs the Cloudflare secret BREVO_API_KEY and settings → orders_api_url.
import { wrap } from "./order-notify.js";

const B = "https://api.brevo.com/v3";
const SITE = "https://bahekurtiz.com";
const FROM = { name: "Bahe Kurtiz", email: "bahekurti@gmail.com" };
const REVIEW_FALLBACK = "https://g.page/r/CZRg9KONAiAfEBM/review";
const WA = "https://wa.me/917073350886";
const TEAL = "#0e5b59";
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const SENT = new Map();
const okApi = (u) => /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(String(u || ""));
const btn = (href, label) => `<p style="margin:0 0 20px;text-align:center"><a href="${esc(href)}" style="background:${TEAL};color:#ffffff;text-decoration:none;padding:13px 26px;border-radius:6px;font-size:14px;letter-spacing:1px;display:inline-block">${label}</a></p>`;
const head = (kicker, title) => `<p style="margin:0 0 6px;font-size:12px;letter-spacing:3px;color:#a8812f">${kicker}</p><h1 style="margin:0 0 12px;font-family:Georgia,serif;font-weight:normal;font-size:26px;color:${TEAL}">${title}</h1>`;
const P = (t) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6">${t}</p>`;
const firstName = (o) => esc(String(o.name || "").trim().split(/\s+/)[0] || "there");
export const isIndia = (o) => !o.country || /^(india|in|bharat)$/i.test(String(o.country).trim());
export function eta(o, ship = {}) {
  const n = (v, d) => (Number(v) > 0 ? Number(v) : d);
  return isIndia(o) ? `${n(ship.inMin, 3)}–${n(ship.inMax, 5)} days` : `${n(ship.intlMin, 5)}–${n(ship.intlMax, 10)} business days`;
}
const helpLink = (o) => `${SITE}/help/?ref=${encodeURIComponent(o.ref)}`;
const foot = (o, closing = "With love from Jaipur,") => `<p style="margin:0 0 6px;font-size:14px;line-height:1.6"><b>Need help?</b> <a href="${helpLink(o)}" style="color:${TEAL}">Get help with this order</a> – or reply to this email${WA ? ` / <a href="${WA}" style="color:${TEAL}">WhatsApp us</a>` : ""}.</p>
<p style="margin:0 0 6px;font-size:13px;color:#7a6f66">Order status any time: <a href="${SITE}/track/?ref=${encodeURIComponent(o.ref)}" style="color:${TEAL}">${SITE.replace("https://", "")}/track</a></p>
<p style="margin:18px 0 26px;font-size:14px">${closing}<br>Team Bahe Kurtiz</p>`;

export function paidEmail(o, ship = {}) {
  const d = `${Number(ship.dMin) || 7}–${Number(ship.dMax) || 10}`, c = `${Number(ship.cMin) || 10}–${Number(ship.cMax) || 15}`;
  return { subject: `Your Bahe Kurtiz order ${o.ref} is confirmed 💚`, tag: "order-paid", inner: head("ORDER CONFIRMED", `Thank you, ${firstName(o)}!`)
    + P(`Your payment is received and your order <b>${esc(o.ref)}</b> is confirmed. It is now being made in our own unit in Jaipur.`)
    + P(`Ready sizes are dispatched in ${d} working days, custom fit in ${c} working days. Delivery then takes about ${eta(o, ship)}${isIndia(o) ? "" : " – duties and taxes are already paid"}. We will email you at every step.`) + foot(o) };
}
export function packedEmail(o) {
  return { subject: `Your Bahe Kurtiz order ${o.ref} is packed 📦`, tag: "order-packed", inner: head("PACKED", `Almost on its way, ${firstName(o)}!`)
    + P(`Your order <b>${esc(o.ref)}</b> is finished and packed in our Jaipur studio.`)
    + P(`Before it is dispatched, we will send you photos of your actual piece – reply to this email if you would like anything checked. You will get the courier and tracking number as soon as it ships.`) + foot(o) };
}
export function shippedEmail(o, ship = {}) {
  return { subject: `Your Bahe Kurtiz order ${o.ref} has shipped 🚚`, tag: "order-shipped", inner: head("ORDER SHIPPED", `It's on its way, ${firstName(o)}!`)
    + P(`Your order <b>${esc(o.ref)}</b> has left our Jaipur studio.`)
    + `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;background:#f3f8f6;padding:12px 14px;border-radius:8px">Courier: <b>${esc(o.courier)}</b><br>Tracking number: <b>${esc(o.tracking)}</b><br>Expected delivery: <b>${eta(o, ship)}</b> from today${isIndia(o) ? "" : " · duties & taxes paid"}</p>`
    + (/^https:\/\//.test(o.tracking_url || "") ? btn(o.tracking_url, "TRACK WITH THE COURIER") + (String(o.tracking_url).includes(encodeURIComponent(o.tracking)) ? "" : `<p style="margin:-8px 0 16px;font-size:13px;color:#7a6f66;text-align:center">On the courier's page, enter your tracking number <b>${esc(o.tracking)}</b>.</p>`) : "")
    + `<p style="margin:0 0 14px;font-size:13px;color:#7a6f66;line-height:1.6">The first tracking scan can take up to 24 hours to appear.</p>` + foot(o) };
}
export function deliveredEmail(o, review) {
  const stars = [1, 2, 3, 4, 5].map(() => `<a href="${esc(review)}" style="font-size:34px;line-height:1;color:#c99a2e;text-decoration:none;padding:0 3px">★</a>`).join("");
  return { subject: `Your Bahe Kurtiz order ${o.ref} was delivered 💚`, tag: "order-delivered", inner: head("DELIVERED", `Your order has arrived, ${firstName(o)} 💚`)
    + P(`Thank you for choosing handmade! Your order <b>${esc(o.ref)}</b> is marked as delivered – we hope you love it.`)
    + P(`If you have a minute, an honest review on Google helps a small Jaipur studio a lot. Tap a star:`)
    + `<p style="margin:0 0 10px;text-align:center">${stars}</p>` + btn(review, "REVIEW US ON GOOGLE")
    + P(`Something not right – size, colour, anything? <a href="${helpLink(o)}" style="color:${TEAL}">Tell us here</a> and we will fix it.`) + foot(o, "Thank you,") };
}
export function buildEmail(o, settings = {}) {
  const st = String(o.status || "").trim().toLowerCase(), ship = settings.ship || {}, review = /^https:\/\//.test(settings.google_review_url || "") ? settings.google_review_url : REVIEW_FALLBACK;
  if (st === "paid") return paidEmail(o, ship);
  if (st === "packed") return packedEmail(o);
  if (st === "shipped") return shippedEmail(o, ship);
  if (st === "delivered") return deliveredEmail(o, review);
  return null;
}

export async function onRequestPost({ request, env }) {
  let api = "", key = "", ref = "", status = "";
  const log = async (ok, error) => { if (!api) return; try { await fetch(api, { method: "POST", headers: { "content-type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "email_log", key, ref, status, ok, error: error || "" }), redirect: "follow" }); } catch {} };
  try {
    let b = {}; try { b = await request.json(); } catch { return J({ ok: false, error: "bad" }, 400); }
    ref = String(b.ref || "").trim().slice(0, 40); key = String(b.key || "");
    if (!ref || !key) return J({ ok: false, error: "missing" }, 400);
    let cat = null; try { const u = new URL("/data/catalog.json", request.url); const r = await (env.ASSETS ? env.ASSETS.fetch(u) : fetch(u)); if (r.ok) cat = await r.json(); } catch {}
    const settings = (cat && cat.settings) || {}; if (!okApi(settings.orders_api)) return J({ ok: false, error: "no_orders_api" });
    let r; try { r = await (await fetch(`${settings.orders_api}?action=get&ref=${encodeURIComponent(ref)}&key=${encodeURIComponent(key)}&t=${Date.now()}`, { redirect: "follow" })).json(); } catch { return J({ ok: false, error: "orders_api_down" }); }
    if (!r || !r.ok) return J({ ok: false, error: (r && r.error) || "orders_api" }); // wrong owner key → nothing sent, nothing logged
    api = settings.orders_api; const o = { ...r.order, ref: (r.order && r.order.ref) || ref }; status = String(o.status || "");
    const st = status.trim().toLowerCase();
    if (!["paid", "packed", "shipped", "delivered"].includes(st)) return J({ ok: false, error: "status" });
    if (st === "paid" && /paypal|razorpay/i.test(o.payment || "")) return J({ ok: false, error: "already_confirmed" }); // checkout already sent the confirmation
    if (st === "shipped" && !(o.courier && o.tracking)) { await log(false, "no tracking"); return J({ ok: false, error: "no_tracking" }); }
    const email = String(o.email || "").trim(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { await log(false, "no email"); return J({ ok: false, error: "no_email" }); }
    const dk = `mail:${o.ref}:${st}:${st === "shipped" ? o.tracking : ""}`;
    if (SENT.has(dk)) return J({ ok: false, error: "duplicate" });
    if (env.ORDERS) { try { if (await env.ORDERS.get(dk)) return J({ ok: false, error: "duplicate" }); } catch {} }
    const brevo = env.BREVO_API_KEY; if (!brevo) { await log(false, "no Brevo key"); return J({ ok: false, error: "no_brevo_key" }); }
    const m = buildEmail(o, settings);
    const body = { sender: FROM, to: [{ email, name: String(o.name || "").slice(0, 60) || undefined }], replyTo: FROM, subject: m.subject, htmlContent: wrap(m.inner, `Handmade in Jaipur, India · <a href="${SITE}" style="color:#7a6f66">bahekurtiz.com</a>`), tags: [m.tag] };
    let sent = false; try { const x = await fetch(B + "/smtp/email", { method: "POST", headers: { "api-key": brevo, accept: "application/json", "content-type": "application/json" }, body: JSON.stringify(body) }); sent = x.ok; } catch {}
    if (sent) { SENT.set(dk, Date.now()); if (env.ORDERS) { try { await env.ORDERS.put(dk, "1", { expirationTtl: 7776000 }); } catch {} } }
    await log(sent, sent ? "" : "Brevo error");
    return J({ ok: sent, sent, status, error: sent ? undefined : "brevo" });
  } catch { return J({ ok: false, error: "down" }); }
}
