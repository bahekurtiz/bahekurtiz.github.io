// Bahe Kurtiz – Indian pincode → city + state (for checkout auto-fill). No key needed.
// GET /api/pin?p=302001  →  {"city":"Jaipur","state":"Rajasthan","areas":["Jaipur G.P.O.", ...]}
const J = (o, s = 200, cache = 86400) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": `public, max-age=${cache}` } });

export async function onRequestGet({ request, waitUntil }) {
  const p = new URL(request.url).searchParams.get("p") || "";
  if (!/^[1-9]\d{5}$/.test(p)) return J({ error: "pin" }, 400, 60);
  const c = caches.default, key = new Request(`https://bk-pin.local/${p}`);
  const hit = await c.match(key); if (hit) return hit;
  try {
    const r = await fetch(`https://api.postalpincode.in/pincode/${p}`, { headers: { accept: "application/json" }, cf: { cacheTtl: 604800, cacheEverything: true } });
    const d = await r.json(); const po = (Array.isArray(d) && d[0]?.Status === "Success" && d[0].PostOffice) || [];
    if (!po.length) return J({ error: "notfound" }, 404, 3600);
    const count = (k) => { const m = {}; for (const x of po) if (x[k]) m[x[k]] = (m[x[k]] || 0) + 1; return Object.entries(m).sort((a, b) => b[1] - a[1])[0]?.[0] || ""; };
    const res = J({ city: count("District"), state: count("State"), areas: [...new Set(po.map((x) => x.Name).filter(Boolean))].slice(0, 12) }, 200, 604800);
    waitUntil?.(c.put(key, res.clone()));
    return res;
  } catch { return J({ error: "down" }, 502, 60); }
}
