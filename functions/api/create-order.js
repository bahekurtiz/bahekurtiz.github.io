import { json, hasKeys, loadCatalog, priceOrder, validCustomer, clip, UserError } from "../../lib/payments.js";

// Creates a Razorpay order for the bag. The amount is calculated here from the catalog.
export async function onRequestPost({ request, env }) {
  if (!hasKeys(env)) return json({ error: "Online payment is not set up yet. Please choose another option." }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Bad request" }, 400); }
  try {
    const cat = await loadCatalog(request, env);
    const { total, lines } = priceOrder(cat, body);
    const c = validCustomer(body.customer);
    const ref = clip(body.ref, 20).replace(/[^\w-]/g, "") || "BK" + Date.now();
    const r = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Basic " + btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`) },
      body: JSON.stringify({
        amount: Math.round(total * 100), currency: "INR", receipt: ref,
        notes: { order_ref: ref, name: c.name, phone: c.phone, email: c.email, address: c.address, items: clip(lines.join("; "), 250) },
      }),
    });
    const o = await r.json();
    if (!r.ok) { console.error("razorpay order error", r.status, JSON.stringify(o)); return json({ error: "Payment could not be started. Please try again." }, 502); }
    return json({ order_id: o.id, amount: o.amount, key_id: env.RAZORPAY_KEY_ID });
  } catch (e) {
    if (e instanceof UserError) return json({ error: e.message }, 400);
    console.error("create-order failed", e);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
}
