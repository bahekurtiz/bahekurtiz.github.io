// GitHub OAuth for the admin panel (Sveltia / Decap CMS) on Cloudflare Pages – step 2.
// GET /api/callback?code=…&state=…  → checks the state cookie, swaps the code for a token and hands it to the
// CMS window with the standard postMessage handshake:
//   popup → opener: "authorizing:github"   opener → popup: (same)   popup → opener: "authorization:github:success:{token,provider}"
// The token is only ever sent to this site's own origin.
const html = (body, status = 200) => new Response(`<!doctype html><meta charset="utf-8"><title>Admin login</title><body style="font-family:system-ui;padding:24px;line-height:1.5">${body}</body>`, { status, headers: { "content-type": "text/html;charset=utf-8", "cache-control": "no-store", "set-cookie": "bk_oauth_state=; Path=/api; Max-Age=0; HttpOnly; Secure; SameSite=Lax" } });
const handshake = (origin, kind, payload) => {
  const msg = JSON.stringify(`authorization:github:${kind}:${JSON.stringify(payload)}`).replace(/</g, "\\u003c");
  const o = JSON.stringify(origin).replace(/</g, "\\u003c");
  return `<p>${kind === "success" ? "Logged in – this window will close." : "Login failed: " + String(payload.message || "").replace(/[<>&]/g, "")}</p>
<script>(function(){var O=${o},M=${msg};if(!window.opener){document.body.insertAdjacentHTML("beforeend","<p>Please close this window and try again from the admin page.</p>");return}
function r(e){if(e.origin!==O)return;window.removeEventListener("message",r);window.opener.postMessage(M,O);setTimeout(function(){window.close()},400)}
window.addEventListener("message",r,false);window.opener.postMessage("authorizing:github",O);})();</script>`;
};
const cookie = (req, k) => { const m = (req.headers.get("cookie") || "").match(new RegExp("(?:^|;\\s*)" + k + "=([^;]+)")); return m ? m[1] : ""; };

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url), origin = url.origin;
  const id = String(env.GITHUB_CLIENT_ID || "").trim(), secret = String(env.GITHUB_CLIENT_SECRET || "").trim();
  if (!id || !secret) return html(handshake(origin, "error", { message: "GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET are not set in Cloudflare." }), 500);
  if (url.searchParams.get("error")) return html(handshake(origin, "error", { message: url.searchParams.get("error_description") || url.searchParams.get("error") }), 400);
  const code = url.searchParams.get("code") || "", state = url.searchParams.get("state") || "", saved = cookie(request, "bk_oauth_state");
  if (!code || !state || !saved || state !== saved) return html(handshake(origin, "error", { message: "Login check failed (state). Please try again." }), 400);
  let tok = null;
  try {
    const r = await fetch("https://github.com/login/oauth/access_token", { method: "POST", headers: { accept: "application/json", "content-type": "application/json", "user-agent": "bahekurtiz-admin" }, body: JSON.stringify({ client_id: id, client_secret: secret, code, redirect_uri: `${origin}/api/callback` }) });
    tok = await r.json();
  } catch { return html(handshake(origin, "error", { message: "Could not reach GitHub. Please try again." }), 502); }
  if (!tok || !tok.access_token) return html(handshake(origin, "error", { message: (tok && (tok.error_description || tok.error)) || "No token from GitHub." }), 400);
  return html(handshake(origin, "success", { token: tok.access_token, provider: "github" }));
}
