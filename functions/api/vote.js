// Bahe Kurtiz – "Help me choose" votes (no login).
// GET  /api/vote?id=<poll>&n=<number of outfits>  -> { shared: true, counts: [..] }
// POST /api/vote { id, p: [slug, slug, slug], choice: 0-2, voter }  -> { shared: true, counts: [..] }
// Needs a Cloudflare KV namespace bound to this Pages project as VOTES (Settings → Bindings → KV namespace).
// Without it the API answers { shared: false } and the page keeps each vote on the voter's phone.
// One key per voter: "v:<poll>:<voter>" with the choice in metadata, so changing a vote just overwrites it.
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const TTL = 60 * 24 * 3600;                       // polls live for 60 days
const ID = /^[a-z0-9]{8,16}$/, VOTER = /^[a-z0-9]{8,24}$/, SLUG = /^[a-z0-9-]{3,140}$/;
const HITS = new Map();                           // light per-IP limit (per worker instance)
const limited = (ip) => { const now = Date.now(), l = (HITS.get(ip) || []).filter((t) => now - t < 6e5); l.push(now); HITS.set(ip, l); return l.length > 40; };

async function count(kv, id, n, voter, choice) {
  const c = Array(n).fill(0); let cursor, mine = false;
  do {
    const r = await kv.list({ prefix: `v:${id}:`, cursor });
    for (const k of r.keys) {
      const v = Number(k.metadata?.c);
      if (k.name === `v:${id}:${voter}`) { mine = true; if (choice !== undefined) continue; }
      if (Number.isInteger(v) && v >= 0 && v < n) c[v]++;
    }
    cursor = r.list_complete ? undefined : r.cursor;
  } while (cursor);
  if (choice !== undefined) c[choice]++;          // the vote just cast (KV lists can lag a few seconds)
  return { counts: c, mine };
}

export async function onRequestGet({ request, env }) {
  if (!env.VOTES) return json({ shared: false });
  const u = new URL(request.url), id = u.searchParams.get("id") || "", n = Math.min(3, Math.max(2, parseInt(u.searchParams.get("n"), 10) || 3));
  if (!ID.test(id)) return json({ error: "bad poll" }, 400);
  try { const { counts } = await count(env.VOTES, id, n); return json({ shared: true, counts }); }
  catch { return json({ shared: false }); }
}

export async function onRequestPost({ request, env }) {
  if (!env.VOTES) return json({ shared: false });
  let b; try { b = await request.json(); } catch { return json({ error: "bad request" }, 400); }
  const id = String(b.id || ""), voter = String(b.voter || ""), p = Array.isArray(b.p) ? b.p.map(String).slice(0, 3) : [], choice = Number(b.choice);
  if (!ID.test(id) || !VOTER.test(voter) || p.length < 2 || !p.every((s) => SLUG.test(s)) || !Number.isInteger(choice) || choice < 0 || choice >= p.length) return json({ error: "bad vote" }, 400);
  if (limited(request.headers.get("cf-connecting-ip") || "?")) return json({ error: "Too many votes, try again later." }, 429);
  try {
    // a poll keeps the outfits it was created with, so a changed link cannot mix in other votes
    const key = `p:${id}`, saved = await env.VOTES.get(key);
    if (saved && saved !== p.join(",")) return json({ error: "This poll link has changed. Ask your friend to share it again." }, 409);
    if (!saved) await env.VOTES.put(key, p.join(","), { expirationTtl: TTL });
    await env.VOTES.put(`v:${id}:${voter}`, "", { metadata: { c: choice }, expirationTtl: TTL });
    const { counts } = await count(env.VOTES, id, p.length, voter, choice);
    return json({ shared: true, counts });
  } catch { return json({ shared: false }); }
}
