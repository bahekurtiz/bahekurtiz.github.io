// Bahe Kurtiz – secure Razorpay order (India, INR). Price is calculated HERE from the published catalog,
// never from the browser. Supports coupons, online-payment discount, shipping, checkout pause and sale pause.
// Cloudflare Pages → Settings → Environment variables: RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET (or RZP_KEY_ID + RZP_KEY_SECRET).
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const istToday = () => new Date(Date.now() + 5.5 * 36e5).toISOString().slice(0, 10);
export function priceOrder(cat, items, code) {
  const s = cat.settings || {};
  if (s.checkout_pause) return { error: "Orders are paused for a short while." };
  let sub = 0;
  for (const i of items) {
    const p = (cat.products || {})[String(i.slug || "")]; const q = Math.max(1, Math.min(20, parseInt(i.qty, 10) || 1));
    if (!p || p.price == null || p.paused) return { error: "An item in your bag is not available right now." };
    if (i.size && Array.isArray(p.out) && p.out.includes(i.size)) return { error: `Size ${i.size} of ${p.title} is sold out.` };
    sub += p.price * q;
  }
  const discount = s.prepaid_discount_percent ? Math.round(sub * s.prepaid_discount_percent / 100) : 0;
  let shipping = s.free_shipping_above && sub >= s.free_shipping_above ? 0 : (s.shipping_charge || 0), off = 0, used = "";
  if (code) {
    const c = (s.coupons || []).find((x) => x.c === String(code).trim().toUpperCase()); const d = istToday();
    if (!c || c.m === "intl" || (c.s && d < c.s) || (c.e && d > c.e) || (c.min && sub < c.min)) return { error: "Coupon is not valid for this order." };
    if (c.k === "Free shipping") shipping = 0; else off = c.k === "Percent" ? Math.round(sub * c.v / 100) : Math.min(c.v, sub);
    used = c.c;
  }
  const total = Math.max(0, Math.round((sub - discount - off + shipping) * 100) / 100);
  return { sub, discount, off, shipping, total, coupon: used };
}
export async function onRequestPost({ request, env }) {
  const id = env.RAZORPAY_KEY_ID || env.RZP_KEY_ID, secret = env.RAZORPAY_KEY_SECRET || env.RZP_KEY_SECRET;
  if (!id || !secret) return json({ error: "not configured" }, 503);
  let b; try { b = await request.json(); } catch { return json({ error: "Bad request" }, 400); }
  const items = Array.isArray(b.items) ? b.items.slice(0, 50) : []; if (!items.length) return json({ error: "Your bag is empty." }, 400);
  const curl = new URL("/data/catalog.json", request.url);
  let cat; try { cat = await (env.ASSETS ? env.ASSETS.fetch(curl) : fetch(curl)).then((r) => r.json()); } catch { return json({ error: "Catalogue not reachable, please try again." }, 502); }
  const t = priceOrder(cat, items, b.coupon); if (t.error) return json({ error: t.error }, 409);
  const amount = Math.round(t.total * 100); if (amount < 100) return json({ error: "Order amount is too low." }, 400);
  const ref = String(b.ref || "").replace(/[^\w-]/g, "").slice(0, 40);
  const r = await fetch("https://api.razorpay.com/v1/orders", { method: "POST", headers: { "content-type": "application/json", authorization: "Basic " + btoa(id + ":" + secret) }, body: JSON.stringify({ amount, currency: "INR", receipt: ref, notes: { ref, coupon: t.coupon } }) });
  const o = await r.json().catch(() => ({})); if (!r.ok) return json({ error: o?.error?.description || "Payment could not start." }, 502);
  return json({ key_id: id, order_id: o.id, amount });
}
