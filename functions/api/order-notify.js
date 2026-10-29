// Bahe Kurtiz – order emails after a PAID order (PayPal USD or Razorpay INR).
// POST /api/order-notify  (called by the checkout page right after payment succeeds)
//  1) OWNER email  -> env OWNER_EMAIL (optional) or bahekurti@gmail.com
//  2) CUSTOMER confirmation -> only if the customer gave an email and the payment could be checked
// Needs the existing Cloudflare secret BREVO_API_KEY. Never throws – checkout must never break.
// Product titles / prices / photos are taken from the published catalog (not trusted from the browser).
import { verifySig } from "./pay-verify.js";

const B = "https://api.brevo.com/v3";
const SITE = "https://bahekurtiz.com";
const FROM = { name: "Bahe Kurtiz", email: "bahekurti@gmail.com" };
const WA = "https://wa.me/917073350886";
const TEAL = "#0e5b59";
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clip = (s, n = 200) => String(s ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, n);
const abs = (p) => (!p ? "" : /^https?:\/\//.test(p) ? p : SITE + "/" + String(p).replace(/^\//, ""));
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

// per-isolate memory: same order ref is emailed once; a customer address gets at most 3 mails / hour
const SENT = new Map(), PER_MAIL = new Map();
const seen = (ref) => { const now = Date.now(); for (const [k, t] of SENT) if (now - t > 6 * 36e5) SENT.delete(k); if (SENT.has(ref)) return true; SENT.set(ref, now); return false; };
const mailOk = (em) => { const now = Date.now(), l = (PER_MAIL.get(em) || []).filter((t) => now - t < 36e5); if (l.length >= 3) return false; l.push(now); PER_MAIL.set(em, l); return true; };

export const money = (n, cur) => (cur === "USD" ? "$" + num(n).toFixed(2).replace(/\.00$/, "") : "₹" + Math.round(num(n)).toLocaleString("en-IN"));

// Clean + enrich the order sent by the browser. cat = published catalog (optional).
export function normalizeOrder(b, cat) {
  const cur = String(b.currency || "").toUpperCase() === "USD" ? "USD" : "INR";
  const P = (cat && cat.products) || {};
  const items = (Array.isArray(b.items) ? b.items : []).slice(0, 30).map((i) => {
    const slug = clip(i.slug, 120).replace(/[^\w-]/g, ""), p = P[slug] || null, qty = Math.max(1, Math.min(50, parseInt(i.qty, 10) || 1));
    const price = p ? num(cur === "USD" ? p.price_usd : p.price) || num(i.price) : num(i.price);
    return { slug, title: clip(p?.title || i.title || slug, 140), size: clip(i.size, 20), qty, price, line: Math.round(price * qty * 100) / 100,
      url: p?.url ? abs(p.url) : slug ? `${SITE}/products/${slug}/` : "", image: abs(p?.thumb || p?.image || (/^\/(images|media)\//.test(String(i.image || "")) ? i.image : "")) };
  });
  const sub = items.reduce((s, i) => s + i.line, 0);
  const fit = b.fit && typeof b.fit === "object" ? Object.fromEntries(Object.entries(b.fit).filter(([k, v]) => /^(bust|waist|hip|height|usual|pref|shoulder|length)$/.test(k) && v !== "" && v != null).map(([k, v]) => [k, clip(v, 20)])) : {};
  return {
    ref: clip(b.ref, 40).replace(/[^\w-]/g, ""), currency: cur, total: num(b.total) || sub, sub: num(b.sub) || sub, shipping: num(b.shipping), discount: num(b.discount), coupon: clip(b.coupon, 30),
    method: /paypal/i.test(b.method) ? "PayPal" : /razorpay/i.test(b.method) ? "Razorpay" : clip(b.method, 30) || (cur === "USD" ? "PayPal" : "Razorpay"),
    payment_id: clip(b.payment_id, 80), paypal_order: clip(b.paypal_order, 80), rzp_order: clip(b.razorpay_order_id, 80), rzp_sig: clip(b.razorpay_signature, 128),
    name: clip(b.name, 80), email: clip(b.email, 120).toLowerCase(), phone: clip(b.phone, 30),
    address: clip(b.address, 300), city: clip(b.city, 60), state: clip(b.state, 60), pincode: clip(b.pincode, 20), country: clip(b.country, 60) || (cur === "INR" ? "India" : ""),
    note: clip(b.note, 600), gift_to: clip(b.gift_to, 80), gift_msg: clip(b.gift_msg, 300), gift_hide: b.gift_hide === "yes", fit, items,
  };
}

const wrap = (inner, foot) => `<!doctype html><html><body style="margin:0;background:#f6f1e9;font-family:Arial,Helvetica,sans-serif;color:#2b2522">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f1e9;padding:24px 0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:#ffffff;padding:22px;text-align:center;border-bottom:3px solid ${TEAL}"><img src="${SITE}/images/logo.png" alt="Bahe Kurtiz" width="150" style="display:inline-block"></td></tr>
<tr><td style="padding:26px 28px 10px">${inner}</td></tr>
<tr><td style="background:#f6f1e9;padding:14px;text-align:center;font-size:11px;color:#7a6f66">${foot}</td></tr>
</table></td></tr></table></body></html>`;

const fitText = (o) => Object.entries(o.fit).map(([k, v]) => `${k} ${v}`).join(", ");
const addrHtml = (o) => [esc(o.name), esc(o.address), esc([o.city, o.state, o.pincode].filter(Boolean).join(", ")), esc(o.country)].filter(Boolean).join("<br>");
function itemsTable(o, owner) {
  const td = "padding:10px 6px;border-bottom:1px solid #eee;font-size:14px;vertical-align:top";
  const rows = o.items.map((i) => `<tr>
<td style="${td};width:64px">${i.image ? `<img src="${esc(i.image)}" alt="" width="56" style="display:block;border-radius:6px;width:56px;height:auto">` : ""}</td>
<td style="${td}">${i.url ? `<a href="${esc(i.url)}" style="color:#2b2522;text-decoration:none;font-weight:bold">${esc(i.title)}</a>` : `<b>${esc(i.title)}</b>`}<br><span style="color:#7a6f66;font-size:13px">Size <b style="color:${TEAL}">${esc(i.size || "–")}</b> · Qty ${i.qty} · ${money(i.price, o.currency)} each</span>${owner && i.url ? `<br><a href="${esc(i.url)}" style="color:${TEAL};font-size:12px">Product link</a>` : ""}</td>
<td style="${td};text-align:right;white-space:nowrap"><b>${money(i.line, o.currency)}</b></td></tr>`).join("");
  const tr = (l, v, b) => `<tr><td colspan="2" style="padding:4px 6px;text-align:right;font-size:14px;${b ? "font-weight:bold;color:" + TEAL : "color:#555"}">${l}</td><td style="padding:4px 6px;text-align:right;font-size:14px;white-space:nowrap;${b ? "font-weight:bold;color:" + TEAL : ""}">${v}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px 0 16px">${rows}
${tr("Subtotal", money(o.sub, o.currency))}${o.discount ? tr("Discount", "−" + money(o.discount, o.currency)) : ""}${o.coupon ? tr("Coupon", esc(o.coupon)) : ""}${tr(o.currency === "USD" ? "Shipping (duties included)" : "Shipping", o.shipping ? money(o.shipping, o.currency) : "Free")}${tr("Total paid", money(o.total, o.currency) + " " + o.currency, true)}</table>`;
}
const notes = (o) => [o.note ? `<b>Note:</b> ${esc(o.note)}` : "", fitText(o) ? `<b>Custom measurements (inches):</b> ${esc(fitText(o))}` : "", o.gift_to || o.gift_msg ? `<b>🎁 Gift</b>${o.gift_to ? " for " + esc(o.gift_to) : ""}${o.gift_msg ? ` – card: “${esc(o.gift_msg)}”` : ""}${o.gift_hide ? " – <b>do NOT put price/invoice in parcel</b>" : ""}` : ""].filter(Boolean);

export function ownerEmail(o, to, verified = true) {
  const kv = (k, v) => (v ? `<tr><td style="padding:4px 8px 4px 0;color:#7a6f66;font-size:13px;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:4px 0;font-size:14px">${v}</td></tr>` : "");
  const ph = o.phone.replace(/\D/g, ""), waC = ph ? `https://wa.me/${ph.length === 10 ? "91" + ph : ph}` : "";
  const n = notes(o);
  const inner = `<p style="margin:0 0 6px;font-size:12px;letter-spacing:3px;color:#a8812f">NEW ${o.currency === "USD" ? "INTERNATIONAL " : ""}ORDER</p>
<h1 style="margin:0 0 4px;font-family:Georgia,serif;font-weight:normal;font-size:24px;color:${TEAL}">${esc(o.ref)} · ${money(o.total, o.currency)} ${o.currency}</h1>
<p style="margin:0 0 14px;font-size:13px;color:#7a6f66">${esc(o.method)} · ${o.items.reduce((s, i) => s + i.qty, 0)} item(s)${verified ? "" : ` · <b style="color:#b3261e">payment not auto-verified – check in ${esc(o.method)} before making</b>`}</p>
${itemsTable(o, true)}
<h2 style="margin:12px 0 6px;font-size:15px;color:${TEAL}">Payment</h2><table role="presentation" cellpadding="0" cellspacing="0">${kv("Method", esc(o.method))}${kv("Transaction ID", esc(o.payment_id || "–"))}${kv("PayPal order", esc(o.paypal_order))}${kv("Razorpay order", esc(o.rzp_order))}</table>
<h2 style="margin:16px 0 6px;font-size:15px;color:${TEAL}">Customer</h2><table role="presentation" cellpadding="0" cellspacing="0">${kv("Name", esc(o.name))}${kv("Email", o.email ? `<a href="mailto:${esc(o.email)}" style="color:${TEAL}">${esc(o.email)}</a>` : "")}${kv("Phone", o.phone ? esc(o.phone) + (waC ? ` · <a href="${waC}" style="color:${TEAL}">WhatsApp</a>` : "") : "")}${kv("Country", esc(o.country))}</table>
<h2 style="margin:16px 0 6px;font-size:15px;color:${TEAL}">Ship to</h2><p style="margin:0 0 12px;font-size:14px;line-height:1.5;border:1px solid #e3dccf;border-radius:8px;padding:10px">${addrHtml(o)}${o.phone ? "<br>📞 " + esc(o.phone) : ""}</p>
${n.length ? `<h2 style="margin:16px 0 6px;font-size:15px;color:${TEAL}">Notes</h2><p style="margin:0 0 12px;font-size:14px;line-height:1.6;background:#fff7e6;border-radius:8px;padding:10px">${n.join("<br>")}</p>` : ""}
<p style="margin:20px 0 24px;text-align:center"><a href="${SITE}/admin/dashboard/" style="background:${TEAL};color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:6px;font-size:14px;letter-spacing:1px;display:inline-block">OPEN OWNER DASHBOARD</a></p>`;
  return { sender: FROM, to: [{ email: to }], replyTo: o.email ? { email: o.email, name: o.name || o.email } : FROM,
    subject: `🛍️ New order ${o.ref} – ${money(o.total, o.currency)} ${o.currency}${verified ? "" : " (check payment)"}`, htmlContent: wrap(inner, `Automatic order alert from <a href="${SITE}" style="color:#7a6f66">bahekurtiz.com</a>`), tags: ["order-owner"] };
}

export function customerEmail(o) {
  const first = (o.name.split(/\s+/)[0] || "there");
  const intl = o.currency === "USD";
  const li = (t) => `<li style="margin:0 0 8px">${t}</li>`;
  const inner = `<p style="margin:0 0 6px;font-size:12px;letter-spacing:3px;color:#a8812f">ORDER CONFIRMED</p>
<h1 style="margin:0 0 12px;font-family:Georgia,serif;font-weight:normal;font-size:26px;color:${TEAL}">Thank you, ${esc(first)}!</h1>
<p style="margin:0 0 14px;font-size:15px;line-height:1.6">Your payment is received and your order <b>${esc(o.ref)}</b> is confirmed.</p>
${itemsTable(o, false)}
<p style="margin:0 0 6px;font-size:13px;color:#7a6f66">Paid by ${esc(o.method)}${o.payment_id ? ` · Ref ${esc(o.payment_id)}` : ""}</p>
<h2 style="margin:18px 0 6px;font-size:15px;color:${TEAL}">Shipping to</h2><p style="margin:0 0 12px;font-size:14px;line-height:1.5">${addrHtml(o)}</p>
${fitText(o) ? `<p style="margin:0 0 12px;font-size:14px"><b>Your measurements:</b> ${esc(fitText(o))} (inches)</p>` : ""}
<h2 style="margin:18px 0 8px;font-size:15px;color:${TEAL}">What happens next</h2>
<ol style="margin:0 0 16px;padding-left:20px;font-size:14px;line-height:1.6">${li("We start making your piece in our own Jaipur unit – hand finished and stitched for you.")}${li("Before it ships, we send you photos of your actual piece.")}${li(intl ? "Duties-paid express delivery: usually <b>5–10 business days after dispatch</b> – no customs bills at your door." : "Tracked delivery to your door – we share the tracking link as soon as it ships.")}</ol>
<p style="margin:0 0 22px;text-align:center"><a href="${SITE}/track/?ref=${encodeURIComponent(o.ref)}" style="background:${TEAL};color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:6px;font-size:14px;letter-spacing:1px;display:inline-block">TRACK MY ORDER</a></p>
<p style="margin:0 0 6px;font-size:14px;line-height:1.6">Questions about size or your order? <a href="${WA}" style="color:${TEAL}">WhatsApp us</a> – a real person from our Jaipur team will reply. You can also simply reply to this email.</p>
<p style="margin:18px 0 26px;font-size:14px">With love from Jaipur,<br>Team Bahe Kurtiz</p>`;
  return { sender: FROM, to: [{ email: o.email, name: first }], replyTo: FROM, subject: `Your Bahe Kurtiz order ${o.ref} is confirmed 💚`,
    htmlContent: wrap(inner, `Handmade in Jaipur, India · <a href="${SITE}" style="color:#7a6f66">bahekurtiz.com</a>`), tags: ["order-confirmation"] };
}

// Was the payment real? Razorpay: signature check. PayPal: API check only when PAYPAL_CLIENT_ID + PAYPAL_SECRET are set.
async function verified(o, env) {
  try {
    if (o.method === "Razorpay") { const s = env.RAZORPAY_KEY_SECRET || env.RZP_KEY_SECRET; return !!(s && o.rzp_order && o.rzp_sig && (await verifySig(s, o.rzp_order, o.payment_id, o.rzp_sig))); }
    if (o.method === "PayPal") {
      const id = env.PAYPAL_CLIENT_ID, sec = env.PAYPAL_SECRET || env.PAYPAL_CLIENT_SECRET; if (!id || !sec || !o.paypal_order) return true; // no PayPal API keys: trust the client (owner email says to check PayPal)
      const host = env.PAYPAL_ENV === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
      const tk = await (await fetch(host + "/v1/oauth2/token", { method: "POST", headers: { authorization: "Basic " + btoa(id + ":" + sec), "content-type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" })).json();
      const r = await (await fetch(host + "/v2/checkout/orders/" + encodeURIComponent(o.paypal_order), { headers: { authorization: "Bearer " + tk.access_token } })).json();
      return r.status === "COMPLETED";
    }
  } catch {}
  return false;
}

async function send(key, body) {
  try { const r = await fetch(B + "/smtp/email", { method: "POST", headers: { "api-key": key, accept: "application/json", "content-type": "application/json" }, body: JSON.stringify(body) }); return r.ok; } catch { return false; }
}

export async function onRequestPost({ request, env }) {
  try {
    const key = env.BREVO_API_KEY; if (!key) return J({ ok: false, error: "no key" });
    let b = {}; try { b = await request.json(); } catch { return J({ ok: false, error: "bad" }, 400); }
    let cat = null; try { const u = new URL("/data/catalog.json", request.url); const r = await (env.ASSETS ? env.ASSETS.fetch(u) : fetch(u)); if (r.ok) cat = await r.json(); } catch {}
    const o = normalizeOrder(b, cat);
    if (!o.ref || !o.items.length) return J({ ok: false, error: "order" });
    if (seen(o.ref)) return J({ ok: true, duplicate: true });
    const ok = await verified(o, env);
    const out = { ok: true, verified: ok, owner: false, customer: false };
    const owner = String(env.OWNER_EMAIL || "").trim() || FROM.email;
    out.owner = await send(key, ownerEmail(o, owner, ok));
    if (!out.owner) SENT.delete(o.ref); // let a retry try again
    if (ok && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(o.email) && mailOk(o.email)) out.customer = await send(key, customerEmail(o));
    return J(out);
  } catch { return J({ ok: false, error: "down" }); }
}
