// GitHub OAuth for the admin panel (Sveltia / Decap CMS) on Cloudflare Pages – step 1.
// GET /api/auth  → sets a short-lived state cookie and sends the browser to GitHub's login page.
// Secrets (Cloudflare Pages → Settings → Variables and Secrets): GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET.
// GitHub OAuth App callback URL must be: https://bahekurtiz.com/api/callback
const page = (msg) => new Response(`<!doctype html><meta charset="utf-8"><title>Admin login</title><body style="font-family:system-ui;padding:24px;line-height:1.5"><h1 style="font-size:20px">Admin login</h1><p>${msg}</p></body>`, { status: 500, headers: { "content-type": "text/html;charset=utf-8", "cache-control": "no-store" } });

export async function onRequestGet({ request, env }) {
  const id = String(env.GITHUB_CLIENT_ID || "").trim();
  if (!id || !String(env.GITHUB_CLIENT_SECRET || "").trim()) return page("GitHub login is not set up yet: add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in Cloudflare Pages → Settings → Variables and Secrets, then redeploy.");
  const url = new URL(request.url);
  const state = [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const go = new URL("https://github.com/login/oauth/authorize");
  go.searchParams.set("client_id", id);
  go.searchParams.set("redirect_uri", `${url.origin}/api/callback`);
  go.searchParams.set("scope", "repo,user");
  go.searchParams.set("state", state);
  go.searchParams.set("allow_signup", "false");
  return new Response(null, { status: 302, headers: { location: go.toString(), "cache-control": "no-store", "set-cookie": `bk_oauth_state=${state}; Path=/api; Max-Age=600; HttpOnly; Secure; SameSite=Lax` } });
}
