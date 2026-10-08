// Bahe Kurtiz – Meta Conversions API (server side copy of every Pixel event).
// Needs ONE secret in Cloudflare → Pages → Settings → Environment variables:  META_CAPI_TOKEN
// (Events Manager → your Pixel → Settings → Conversions API → Generate access token).
// Optional: META_TEST_CODE (to see events in "Test events"), META_PIXEL_ID (else read from admin settings).
// Same event_id as the browser Pixel → Meta counts it once (deduplication).
const ok = () => new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
const EVENTS = new Set(["PageView", "ViewContent", "AddToCart", "AddToWishlist", "InitiateCheckout", "AddPaymentInfo", "Purchase", "Lead", "CompleteRegistration", "Search", "Subscribe", "Contact"]);
const API = "v23.0";

export async function sha256(v) {
  const s = String(v ?? "").trim().toLowerCase(); if (!s) return undefined;
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
const cookie = (req, name) => { const m = (req.headers.get("cookie") || "").match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)")); return m ? decodeURIComponent(m[1]) : undefined; };
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "" && !(Array.isArray(v) && (!v.length || v[0] === undefined))));

export async function buildEvent(b, req) {
  const u = b.user || {};
  const phone = String(u.ph || "").replace(/\D/g, "");
  const user_data = clean({
    client_ip_address: req.headers.get("cf-connecting-ip") || undefined,
    client_user_agent: req.headers.get("user-agent") || undefined,
    fbp: cookie(req, "_fbp"), fbc: cookie(req, "_fbc") || (b.fbclid ? `fb.1.${Date.now()}.${b.fbclid}` : undefined),
    em: [await sha256(u.em)], ph: [await sha256(phone.length === 10 ? "91" + phone : phone)],
    fn: [await sha256(String(u.fn || "").split(/\s+/)[0])], ct: [await sha256(String(u.ct || "").replace(/\s+/g, ""))],
    zp: [await sha256(String(u.zp || "").replace(/\s+/g, ""))], country: [await sha256(u.country)],
    external_id: [await sha256(u.id || phone)],
  });
  const d = b.data || {};
  const custom_data = clean({ currency: d.currency, value: typeof d.value === "number" && isFinite(d.value) ? d.value : undefined, content_ids: Array.isArray(d.content_ids) ? d.content_ids.slice(0, 50).map(String) : undefined, content_type: d.content_type, num_items: d.num_items, search_string: d.search_string ? String(d.search_string).slice(0, 100) : undefined, content_name: d.content_name, order_id: b.event_name === "Purchase" ? b.event_id : undefined });
  return clean({ event_name: b.event_name, event_time: Math.floor(Date.now() / 1000), event_id: String(b.event_id || "").slice(0, 100), event_source_url: String(b.url || "").slice(0, 500), action_source: "website", user_data, custom_data });
}

export async function onRequestPost({ request, env, waitUntil }) {
  const token = env.META_CAPI_TOKEN || env.META_ACCESS_TOKEN; if (!token) return ok();
  let b; try { b = JSON.parse(await request.text()); } catch { return ok(); }
  if (!b || !EVENTS.has(b.event_name) || !b.event_id) return ok();
  let pixel = String(env.META_PIXEL_ID || "").replace(/\D/g, "");
  if (!pixel) { try { const cu = new URL("/data/catalog.json", request.url); const c = await (await (env.ASSETS ? env.ASSETS.fetch(cu) : fetch(cu))).json(); pixel = String(c?.settings?.meta_pixel_id || "").replace(/\D/g, ""); } catch {} }
  if (!pixel) return ok();
  const ev = await buildEvent(b, request);
  const body = clean({ data: [ev], test_event_code: env.META_TEST_CODE || undefined });
  const send = fetch(`https://graph.facebook.com/${API}/${pixel}/events?access_token=${encodeURIComponent(token)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});
  if (waitUntil) waitUntil(send); else await send;
  return ok();
}

// GET /api/capi → only says whether the token is set (never shows it). Used by the Dashboard check.
export async function onRequestGet({ env }) {
  return new Response(JSON.stringify({ capi: !!(env.META_CAPI_TOKEN || env.META_ACCESS_TOKEN), test: !!env.META_TEST_CODE }), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
}
