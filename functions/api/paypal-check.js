// Bahe Kurtiz – PayPal setup check (no payment, no order).
// Open https://bahekurtiz.com/api/paypal-check : it only asks PayPal for an access token with the keys saved in
// Cloudflare (PAYPAL_CLIENT_ID + PAYPAL_SECRET) and says yes/no. It never shows the key values.
import { paypalEnv } from "../../lib/paypal-env.js";

const json = (o, s = 200) => new Response(JSON.stringify(o, null, 1), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function onRequestGet({ env }) {
  const pp = paypalEnv(env);
  const out = {
    client_id_set: !!pp.id, secret_set: !!pp.secret, mode: pp.sandbox ? "sandbox" : "live",
    client_id_starts: pp.id ? pp.id.slice(0, 4) + "…" : null,
    paypal_variable_names_seen: pp.names,   // names only – shows typos such as a trailing space
    keys_work: false,
  };
  if (!pp.id || !pp.secret) {
    out.note = pp.names.length
      ? "Some PayPal variables reach this site, but not both. Compare the names above with PAYPAL_CLIENT_ID and PAYPAL_SECRET (Production), save, then Retry deployment."
      : "No PayPal variables reach this deployment. Check they are saved under Production (not Preview) in THIS Pages project (bahekurtiz), then Retry the latest deployment.";
    return json(out);
  }
  try {
    const host = pp.sandbox ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
    const r = await fetch(host + "/v1/oauth2/token", { method: "POST", headers: { authorization: "Basic " + btoa(pp.id + ":" + pp.secret), "content-type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
    const t = await r.json().catch(() => ({}));
    out.keys_work = r.ok && !!t.access_token;
    out.note = out.keys_work ? "PayPal keys work. Paid orders will be checked with PayPal, including the amount."
      : r.status === 401 ? "PayPal rejected the keys (check Live vs Sandbox, and that ID + Secret are from the same app)." : `PayPal answered ${r.status}.`;
  } catch { out.note = "Could not reach PayPal right now, try again in a minute."; }
  return json(out);
}
