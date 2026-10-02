import { json, hasKeys, verifyHmacHex } from "../../lib/payments.js";

// Confirms the payment really came from Razorpay (signature check).
export async function onRequestPost({ request, env }) {
  if (!hasKeys(env)) return json({ ok: false }, 503);
  let b;
  try { b = await request.json(); } catch { return json({ ok: false }, 400); }
  const { razorpay_order_id: o, razorpay_payment_id: p, razorpay_signature: s } = b || {};
  if (!o || !p || !s) return json({ ok: false }, 400);
  const ok = await verifyHmacHex(env.RAZORPAY_KEY_SECRET, `${o}|${p}`, s);
  return json({ ok });
}
