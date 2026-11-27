// Live courier tracking shown on our own /track/ page (3,600+ couriers via the 17TRACK API).
// Needs the Cloudflare Pages secret TRACK17_KEY (the owner adds it; never in the repo).
// GET /api/track-live?num=TRACKINGNUMBER[&pc=POSTCODE]  ->  { ok, status, carrier, events:[{t,desc,loc}] }
const J = (o, s = 200, cache = 0) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": cache ? `public, max-age=${cache}` : "no-store" } });
const API = "https://api.17track.net/track/v2.2/";

const post = async (key, path, body) => {
  const r = await fetch(API + path, { method: "POST", headers: { "17token": key, "content-type": "application/json" }, body: JSON.stringify(body) });
  return r.ok ? r.json() : { code: r.status };
};

// v2.2 shape: track_info.latest_status + track_info.tracking.providers[].events
const parse = (a) => {
  const ti = a && a.track_info;
  if (ti) {
    const prov = (ti.tracking && ti.tracking.providers) || [];
    const events = prov.flatMap((p) => (p.events || []).map((e) => ({ t: e.time_iso || e.time_utc || e.time || "", desc: e.description || "", loc: e.location || (e.address && [e.address.city, e.address.country].filter(Boolean).join(", ")) || "", by: (p.provider && p.provider.name) || "" })));
    events.sort((x, y) => String(y.t).localeCompare(String(x.t)));
    const st = (ti.latest_status && (ti.latest_status.status || ti.latest_status.sub_status)) || "";
    const carrier = prov.filter((p) => (p.events || []).length).map((p) => p.provider && p.provider.name).filter(Boolean).join(" → ");
    return { status: st, carrier, events };
  }
  return { status: "", carrier: "", events: [] };
};

export const onRequestGet = async ({ request, env, waitUntil }) => {
  const u = new URL(request.url);
  const num = String(u.searchParams.get("num") || "").replace(/\s+/g, "").toUpperCase();
  const pc = String(u.searchParams.get("pc") || "").replace(/[^A-Za-z0-9 -]/g, "").trim().slice(0, 12);
  if (!/^[A-Z0-9-]{5,40}$/.test(num)) return J({ ok: false, reason: "bad_number" }, 400);
  const key = env.TRACK17_KEY;
  if (!key) return J({ ok: false, reason: "nokey" });

  // 20-minute edge cache per number (saves API quota; couriers rarely update faster)
  const cache = caches.default, ck = new Request(`https://track-cache.local/${num}/${pc}`);
  const hit = await cache.match(ck);
  if (hit) return hit;

  try {
    const item = { number: num }; if (pc) item.param = pc;
    let g = await post(key, "gettrackinfo", [item]);
    let a = g && g.data && g.data.accepted && g.data.accepted[0];
    if (!a) {
      // not registered with 17TRACK yet -> register once, the first result follows within minutes
      await post(key, "register", [item]);
      g = await post(key, "gettrackinfo", [item]);
      a = g && g.data && g.data.accepted && g.data.accepted[0];
      if (!a) return J({ ok: true, pending: true, events: [] }, 200, 120);
    }
    const out = { ok: true, number: num, ...parse(a) };
    if (!out.events.length) out.pending = true;
    const res = J(out, 200, out.pending ? 300 : 1200);
    waitUntil(cache.put(ck, res.clone()));
    return res;
  } catch {
    return J({ ok: false, reason: "unreachable" }, 502);
  }
};
