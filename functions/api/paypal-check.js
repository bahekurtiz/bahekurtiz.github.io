// Bahe Kurtiz – PayPal setup check (no payment, no order).
// Open https://bahekurtiz.com/api/paypal-check : it only asks PayPal for an access token with the keys saved in
// Cloudflare (PAYPAL_CLIENT_ID + PAYPAL_SECRET) and says yes/no. It never shows the keys.
const json = (o, s = 200) => new Response(JSON.stringify(o, null, 1), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
export async function onRequestGet({ env }) {
  const id = env.PAYPAL_CLIENT_ID, sec = env.PAYPAL_SECRET || env.PAYPAL_CLIENT_SECRET;
  const mode = env.PAYPAL_ENV === "sandbox" ? "sandbox" : "live";
  const out = { client_id_set: !!id, secret_set: !!sec, mode, client_id_starts: id ? String(id).slice(0, 4) + "…" : null, keys_work: false };
  if (!id || !sec) return json({ ...out, note: "Add PAYPAL_CLIENT_ID and PAYPAL_SECRET in Cloudflare → Settings → Variables, then redeploy." });
  try {
    const host = mode === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
    const r = await fetch(host + "/v1/oauth2/token", { method: "POST", headers: { authorization: "Basic " + btoa(id + ":" + sec), "content-type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
    const t = await r.json().catch(() => ({}));
    out.keys_work = r.ok && !!t.access_token;
    if (!out.keys_work) out.note = r.status === 401 ? "PayPal rejected the keys (check Live vs Sandbox, and that ID + Secret are from the same app)." : `PayPal answered ${r.status}.`;
    else out.note = "PayPal keys work. Paid orders will be checked with PayPal, including the amount.";
  } catch { out.note = "Could not reach PayPal right now, try again in a minute."; }
  return json(out);
}
