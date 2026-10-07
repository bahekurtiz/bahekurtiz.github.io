// Bahe Kurtiz – Razorpay payment signature check (server side). An order is "Paid" only when this returns ok:true.
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
export async function verifySig(secret, orderId, paymentId, signature) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${orderId}|${paymentId}`));
  const hex = [...new Uint8Array(sig)].map((x) => x.toString(16).padStart(2, "0")).join("");
  return typeof signature === "string" && hex.length === signature.length && hex === signature;
}
export async function onRequestPost({ request, env }) {
  const secret = env.RAZORPAY_KEY_SECRET || env.RZP_KEY_SECRET; if (!secret) return json({ ok: false, error: "not configured" }, 503);
  let b; try { b = await request.json(); } catch { return json({ ok: false }, 400); }
  const ok = await verifySig(secret, String(b.razorpay_order_id || ""), String(b.razorpay_payment_id || ""), String(b.razorpay_signature || ""));
  return json({ ok }, ok ? 200 : 400);
}
