// Bahe Kurtiz – on-site Help Center. POST /api/help { action, ... }
// Tickets live in the Google Sheet ("Help" tab) through the Orders API (apps-script/orders-api.gs).
// This function only forwards and sends the emails (Brevo):
//   order  – find my order (order no. + email or phone)        → status, courier, tracking, my tickets
//   create – new request (with or without an order)             → email to owner + confirmation to customer
//   view   – read a ticket (ticket id + email)
//   reply  – customer adds a message                            → email to owner
//   notify – owner replied in the dashboard ({ ticket, key })   → email to customer with the reply + link
// Needs: BREVO_API_KEY (Cloudflare), settings → orders_api_url. Owner email: env OWNER_EMAIL or the shop email.
import { wrap } from "./order-notify.js";

const B = "https://api.brevo.com/v3";
const SITE = "https://bahekurtiz.com";
const FROM = { name: "Bahe Kurtiz", email: "bahekurti@gmail.com" };
const TEAL = "#0e5b59";
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const okApi = (u) => /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(String(u || ""));
const okMail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || "").trim());
const mask = (e) => { const [u, d] = String(e || "").split("@"); return d ? u.slice(0, 2) + "•••@" + d : ""; };
export const viewUrl = (t, e) => `${SITE}/help/?t=${encodeURIComponent(t)}&e=${encodeURIComponent(e)}`;
const para = (t) => esc(t).replace(/\n/g, "<br>");
const HITS = new Map(); // per isolate: ip → timestamps (simple flood guard)
const flood = (ip, n = 20) => { const now = Date.now(), l = (HITS.get(ip) || []).filter((t) => now - t < 36e5); if (l.length >= n) return true; l.push(now); HITS.set(ip, l); return false; };

async function send(key, to, subject, inner, tag, replyTo) {
  if (!key || !okMail(to)) return false;
  try { const r = await fetch(B + "/smtp/email", { method: "POST", headers: { "api-key": key, accept: "application/json", "content-type": "application/json" }, body: JSON.stringify({ sender: FROM, to: [{ email: to }], replyTo: replyTo && okMail(replyTo) ? { email: replyTo } : FROM, subject, htmlContent: wrap(inner, `Handmade in Jaipur, India · <a href="${SITE}" style="color:#7a6f66">bahekurtiz.com</a>`), tags: [tag] }) }); return r.ok; } catch { return false; }
}
const btn = (href, label) => `<p style="margin:0 0 20px;text-align:center"><a href="${esc(href)}" style="background:${TEAL};color:#ffffff;text-decoration:none;padding:13px 26px;border-radius:6px;font-size:14px;letter-spacing:1px;display:inline-block">${label}</a></p>`;
const quote = (t) => `<div style="margin:0 0 16px;padding:12px 14px;border-left:3px solid ${TEAL};background:#f6f1e9;font-size:14px;line-height:1.6">${para(t)}</div>`;
export function ownerNewEmail(t, kind = "new") {
  const last = (t.thread || []).slice(-1)[0] || {};
  return { subject: `${kind === "new" ? "🆘 New help request" : "💬 Customer replied"} ${t.ticket} – ${t.reason}${t.ref ? " · " + t.ref : ""}`, inner: `<h1 style="margin:0 0 10px;font-family:Georgia,serif;font-weight:normal;font-size:22px;color:${TEAL}">${kind === "new" ? "New help request" : "New message from the customer"}</h1>
<p style="margin:0 0 8px;font-size:14px"><b>${esc(t.ticket)}</b> · ${esc(t.reason)}${t.ref ? ` · Order <b>${esc(t.ref)}</b>` : ""}</p><p style="margin:0 0 12px;font-size:14px">${esc(t.name)} · ${esc(t.email)}${t.phone ? " · " + esc(t.phone) : ""}</p>${quote(last.text || "")}${last.photo ? `<p style="margin:0 0 12px;font-size:14px">📷 <a href="${esc(last.photo)}">Photo</a></p>` : ""}${btn(SITE + "/admin/dashboard/#dash-help", "REPLY IN DASHBOARD")}` };
}
export function customerAckEmail(t) {
  const first = esc(String(t.name || "").split(/\s+/)[0] || "there");
  return { subject: `We got your message – ${t.ticket}`, inner: `<p style="margin:0 0 6px;font-size:12px;letter-spacing:3px;color:#a8812f">HELP REQUEST ${esc(t.ticket)}</p><h1 style="margin:0 0 12px;font-family:Georgia,serif;font-weight:normal;font-size:24px;color:${TEAL}">Thank you, ${first}</h1>
<p style="margin:0 0 12px;font-size:15px;line-height:1.6">We have your message${t.ref ? ` about order <b>${esc(t.ref)}</b>` : ""} and a real person from our Jaipur team will reply, usually within one working day. You will get an email as soon as we reply.</p>${quote((t.thread || [])[0]?.text || "")}${btn(viewUrl(t.ticket, t.email), "VIEW YOUR REQUEST")}<p style="margin:18px 0 26px;font-size:14px">Team Bahe Kurtiz</p>` };
}
export function customerReplyEmail(t) {
  const first = esc(String(t.name || "").split(/\s+/)[0] || "there"), last = [...(t.thread || [])].reverse().find((m) => m.by === "owner") || {};
  return { subject: `Reply to your request ${t.ticket}${t.ref ? " (order " + t.ref + ")" : ""}`, inner: `<p style="margin:0 0 6px;font-size:12px;letter-spacing:3px;color:#a8812f">HELP REQUEST ${esc(t.ticket)}</p><h1 style="margin:0 0 12px;font-family:Georgia,serif;font-weight:normal;font-size:24px;color:${TEAL}">Hi ${first}, we replied</h1>${quote(last.text || "")}
${btn(viewUrl(t.ticket, t.email), t.status === "Closed" ? "VIEW THE CONVERSATION" : "VIEW & REPLY")}<p style="margin:0 0 6px;font-size:13px;color:#7a6f66">${t.status === "Closed" ? "We have marked this request as solved. If anything is still not right, just reply on the page and it opens again." : "You can reply on the page – no login needed."}</p><p style="margin:18px 0 26px;font-size:14px">Team Bahe Kurtiz</p>` };
}

export async function onRequestPost({ request, env }) {
  try {
    let b = {}; try { b = await request.json(); } catch { return J({ ok: false, error: "bad" }, 400); }
    const a = String(b.action || ""), ip = request.headers.get("cf-connecting-ip") || "x";
    let cat = null; try { const u = new URL("/data/catalog.json", request.url); const r = await (env.ASSETS ? env.ASSETS.fetch(u) : fetch(u)); if (r.ok) cat = await r.json(); } catch {}
    const api = cat && cat.settings && cat.settings.orders_api; if (!okApi(api)) return J({ ok: false, error: "not_set_up" });
    const gas = async (body) => { try { return await (await fetch(api, { method: "POST", headers: { "content-type": "text/plain;charset=utf-8" }, body: JSON.stringify(body), redirect: "follow" })).json(); } catch { return { ok: false, error: "orders_api_down" }; } };
    const brevo = env.BREVO_API_KEY, owner = String(env.OWNER_EMAIL || (cat.settings && cat.settings.email) || "").trim() || FROM.email;
    const S = (x, n) => String(x || "").slice(0, n);
    if (a === "order") {
      if (flood(ip, 40)) return J({ ok: false, error: "too_many" });
      const r = await gas({ action: "help_order", ref: S(b.ref, 30), email: S(b.email, 120), phone: S(b.phone, 30) });
      return J(r.ok ? { ok: true, order: r.order, tickets: r.tickets, email: r.email } : { ok: false, error: r.error });
    }
    if (a === "create") {
      if (flood(ip, 12)) return J({ ok: false, error: "too_many" });
      const photo = /^data:image\/(jpeg|png|webp);base64,/.test(b.photo || "") && String(b.photo).length < 4.2e6 ? b.photo : "";
      const r = await gas({ action: "help_create", ref: S(b.ref, 30), email: S(b.email, 120), phone: S(b.phone, 30), name: S(b.name, 80), reason: S(b.reason, 40), message: S(b.message, 3000), photo, hp: S(b.hp, 50) });
      if (!r.ok) return J({ ok: false, error: r.error });
      const t = r.data; if (!t) return J({ ok: true, ticket: r.ticket }); // honeypot
      const m1 = ownerNewEmail(t, "new"), m2 = customerAckEmail(t);
      const [o1, o2] = await Promise.all([send(brevo, owner, m1.subject, m1.inner, "help-new", t.email), send(brevo, t.email, m2.subject, m2.inner, "help-ack")]);
      return J({ ok: true, ticket: t.ticket, email: mask(t.email), mailed_owner: o1, mailed_customer: o2 });
    }
    if (a === "view" || a === "reply") {
      if (flood(ip, a === "reply" ? 20 : 60)) return J({ ok: false, error: "too_many" });
      const photo = a === "reply" && /^data:image\/(jpeg|png|webp);base64,/.test(b.photo || "") && String(b.photo).length < 4.2e6 ? b.photo : "";
      const r = await gas({ action: a === "view" ? "help_view" : "help_reply_customer", ticket: S(b.ticket, 30), email: S(b.email, 120), phone: S(b.phone, 30), message: S(b.message, 3000), photo });
      if (!r.ok) return J({ ok: false, error: r.error });
      const t = r.data, safe = { ...t, email: mask(t.email), phone: "", row: undefined, thread: (t.thread || []).map((m) => ({ by: m.by, at: m.at, text: m.text, photo: !!m.photo })) };
      if (a === "reply") { const m = ownerNewEmail(t, "reply"); await send(brevo, owner, m.subject, m.inner, "help-reply", t.email); }
      return J({ ok: true, data: safe, order: r.order });
    }
    if (a === "notify") { // owner replied → email the customer (owner key is checked by the Orders API)
      const r = await gas({ action: "help_get_owner", key: S(b.key, 200), ticket: S(b.ticket, 30) });
      if (!r.ok) return J({ ok: false, error: r.error });
      const t = r.data; if (!okMail(t.email)) return J({ ok: false, error: "no_email" });
      if (!brevo) return J({ ok: false, error: "no_brevo_key" });
      const m = customerReplyEmail(t); const sent = await send(brevo, t.email, m.subject, m.inner, "help-owner-reply");
      return J({ ok: sent, sent, error: sent ? undefined : "brevo" });
    }
    return J({ ok: false, error: "action" }, 400);
  } catch { return J({ ok: false, error: "down" }); }
}
