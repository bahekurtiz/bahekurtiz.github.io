// Shared helpers for the payment API (Cloudflare Pages Functions).
// Secrets live in Cloudflare → Settings → Environment variables (never in GitHub):
//   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export const hasKeys = (env) => Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);

export async function loadCatalog(request, env) {
  const u = new URL("/data/catalog.json", request.url);
  const r = env.ASSETS ? await env.ASSETS.fetch(u) : await fetch(u);
  if (!r.ok) throw new Error("catalog missing");
  return r.json();
}

export class UserError extends Error {}
const clip = (s, n) => String(s ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, n);

// Recalculate the bill on the server from the catalog, never trust prices from the browser.
export function priceOrder(cat, body) {
  const s = cat.settings;
  const items = Array.isArray(body.items) ? body.items.slice(0, 30) : [];
  if (!items.length) throw new UserError("Your bag is empty");
  let sub = 0;
  const lines = [];
  for (const it of items) {
    const p = cat.products[it.slug];
    const qty = Number(it?.qty);
    if (!p || !p.price) throw new UserError("A product in your bag is no longer available");
    if (!Number.isInteger(qty) || qty < 1 || qty > 10) throw new UserError("Invalid quantity");
    if (p.sizes.length ? !p.sizes.includes(it.size) : it.size) throw new UserError(`Please select a valid size for ${p.title}`);
    sub += p.price * qty;
    lines.push(`${p.title}${it.size ? " (" + it.size + ")" : ""} x${qty}`);
  }
  const discount = s.prepaid_discount_percent ? Math.round((sub * s.prepaid_discount_percent) / 100) : 0;
  const shipping = s.free_shipping_above && sub >= s.free_shipping_above ? 0 : s.shipping_charge || 0;
  const total = sub - discount + shipping;
  return { total, lines };
}

export function validCustomer(c) {
  c = c && typeof c === "object" ? c : {};
  const phone = String(c.phone || "").replace(/\D/g, "").slice(-10);
  if (!clip(c.name, 80) || !/^[6-9]\d{9}$/.test(phone) || !/^[1-9]\d{5}$/.test(String(c.pincode || "")) || !clip(c.address, 200) || !clip(c.city, 60))
    throw new UserError("Please fill all delivery details correctly");
  return {
    name: clip(c.name, 80), phone, email: clip(c.email, 100), pincode: String(c.pincode),
    address: clip(`${c.address}, ${c.city}, ${c.state} - ${c.pincode}`, 250),
  };
}

export { clip };

// Timing-safe check of Razorpay's hex HMAC-SHA256 signature
export async function verifyHmacHex(secret, msg, sigHex) {
  if (!/^[0-9a-f]{64}$/i.test(String(sigHex))) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const sig = Uint8Array.from(String(sigHex).match(/../g), (h) => parseInt(h, 16));
  return crypto.subtle.verify("HMAC", key, sig, new TextEncoder().encode(msg));
}
