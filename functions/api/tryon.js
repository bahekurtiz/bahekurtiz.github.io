// Bahe Kurtiz – AI Mirror (real virtual try-on with Google Gemini image model).
// Needs ONE secret in Cloudflare → Pages → Settings → Environment variables:  GEMINI_API_KEY
// (aistudio.google.com → Get API key; image model needs billing ON in Google AI Studio, about ₹3–4 per photo).
// Optional: TRYON_LIMIT (photos per visitor per day, default 12), TRYON_MODEL (default gemini-2.5-flash-image).
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const b64 = (buf) => { const u = new Uint8Array(buf); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };

async function overLimit(request, env) {
  try {
    const ip = request.headers.get("cf-connecting-ip") || "x", day = new Date().toISOString().slice(0, 10);
    const key = new Request(`https://bk-tryon-limit.local/${encodeURIComponent(ip)}/${day}`);
    const c = caches.default, hit = await c.match(key), n = hit ? +(await hit.text()) || 0 : 0;
    if (n >= (+env.TRYON_LIMIT || 12)) return true;
    await c.put(key, new Response(String(n + 1), { headers: { "cache-control": "max-age=86400" } }));
  } catch {}
  return false;
}

export async function onRequestGet({ env }) { return J({ on: !!env.GEMINI_API_KEY }); }

export async function onRequestPost({ request, env }) {
  const key = env.GEMINI_API_KEY; if (!key) return J({ error: "off" }, 503);
  const origin = request.headers.get("origin"); if (origin && new URL(origin).host !== new URL(request.url).host) return J({ error: "origin" }, 403);
  let b; try { b = await request.json(); } catch { return J({ error: "bad" }, 400); }
  const m = String(b?.person || "").match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m || m[2].length > 2_800_000) return J({ error: "photo" }, 400);
  const prod = String(b?.product || ""); if (!/^\/images\/[\w\-./%]+\.(jpe?g|png|webp)$/i.test(prod) || prod.includes("..")) return J({ error: "product" }, 400);
  if (await overLimit(request, env)) return J({ error: "limit" }, 429);
  let pImg, pType;
  try { const u = new URL(prod, request.url); const r = await (env.ASSETS ? env.ASSETS.fetch(u) : fetch(u)); if (!r.ok) throw 0; pType = (r.headers.get("content-type") || "image/jpeg").split(";")[0]; pImg = b64(await r.arrayBuffer()); } catch { return J({ error: "product" }, 400); }
  const title = String(b?.title || "outfit").slice(0, 120), cat = String(b?.category || "garment").slice(0, 40);
  const prompt = `Virtual try-on for an Indian fashion store.
Image 1: the customer. Image 2: a product photo of a "${title}" (${cat}) worn by a model.
Create ONE photorealistic photo of the customer from Image 1 wearing exactly the ${cat.toLowerCase()} from Image 2.
- Copy the garment faithfully: same colour, print pattern, fabric texture, embroidery, neckline, sleeves, length and silhouette.
- Fully replace the customer's current clothes so none of the old clothing shows; add simple matching bottoms only if the garment is a short kurti.
- Keep the customer's face, identity, skin tone, hair, body shape, pose, camera angle and background from Image 1 unchanged.
- Never use the model's face or body from Image 2.
- Natural fit, folds and lighting. No text, no logos, no frame. Return only the image.`;
  const model = env.TRYON_MODEL || "gemini-2.5-flash-image";
  let r;
  try {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }, { inline_data: { mime_type: m[1], data: m[2] } }, { inline_data: { mime_type: pType, data: pImg } }] }], generationConfig: { responseModalities: ["IMAGE"] } }) });
  } catch { return J({ error: "ai" }, 502); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return J({ error: r.status === 429 ? "busy" : "ai", detail: String(d?.error?.message || r.status).slice(0, 200) }, 502);
  const part = (d?.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data || p.inline_data?.data);
  const img = part?.inlineData || part?.inline_data;
  if (!img) return J({ error: "noimage", detail: String(d?.candidates?.[0]?.finishReason || d?.promptFeedback?.blockReason || "").slice(0, 80) }, 502);
  return J({ image: `data:${img.mimeType || img.mime_type || "image/png"};base64,${img.data}` });
}
