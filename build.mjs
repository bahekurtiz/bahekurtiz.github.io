// Bahe Kurtiz website builder — zero dependencies (Node 18+).
// Reads content/*.json and writes the finished site to _site/.
// Hosting: Cloudflare Pages (build command: node build.mjs, output: _site).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, "_site");
const S = JSON.parse(fs.readFileSync(path.join(ROOT, "content/settings.json"), "utf8"));

// ---------- site url / base ----------
const BASE = "/";
const SITE_URL = ((S.site_url || process.env.CF_PAGES_URL || "http://localhost:8080") + "").trim().replace(/\/$/, "");
const u = (p = "") => (!p ? BASE : /^(https?:)?\/\//.test(p) || p.startsWith("data:") ? p : BASE + String(p).replace(/^\//, ""));
const abs = (p) => (/^https?:/.test(p) ? p : SITE_URL + "/" + String(p).replace(/^\//, ""));

// ---------- helpers ----------
const esc = (s = "") => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const paras = (t = "") => String(t || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
const slugify = (s) => String(s).toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-");
const num = (v) => (v === "" || v === null || v === undefined || isNaN(Number(v)) ? null : Number(v));
const inr = (n) => (num(n) === null ? "" : "₹" + Number(n).toLocaleString("en-IN"));
const digits = (s) => String(s || "").replace(/\D/g, "");
const plural = (c) => (/(ss|sh|ch|x)$/i.test(c) ? c + "es" : /s$/i.test(c) ? c : c + "s");
const brand = S.brand_name || "Bahe Kurtiz";
const waNumber = (() => { let d = digits(S.whatsapp); if (d.length === 10) d = "91" + d; return d; })();
const waLink = (msg) => (waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}` : "");
const today = new Date().toISOString().slice(0, 10);
const year = new Date().getFullYear();

// ---------- products ----------
const prodDir = path.join(ROOT, "content/products");
const products = fs.readdirSync(prodDir).filter((f) => f.endsWith(".json")).map((f) => {
  const p = JSON.parse(fs.readFileSync(path.join(prodDir, f), "utf8"));
  p.slug = slugify(f.replace(/\.json$/, "")).replace(/^-+|-+$/g, "") || "item-" + [...f].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(36);
  p.images = (p.images || []).map((x) => (typeof x === "string" ? x : x?.image)).filter(Boolean);
  p.sizes = (p.sizes || []).filter(Boolean);
  p.category = (p.category || "Kurti").trim();
  p.catSlug = slugify(plural(p.category));
  p.url = `products/${p.slug}/`;
  p.price = num(p.price); p.mrp = num(p.mrp);
  p.in_stock = p.in_stock !== false;
  return p;
}).filter((p) => p.title && p.draft !== true)
  .sort((a, b) => (num(a.sort_order) ?? 999) - (num(b.sort_order) ?? 999) || a.title.localeCompare(b.title));
const categories = [...new Set(products.map((p) => p.category))].map((c) => ({ name: c, plural: plural(c), slug: slugify(plural(c)), url: `collections/${slugify(plural(c))}/`, items: products.filter((p) => p.category === c) }));
const offPct = (p) => (p.price && p.mrp && p.mrp > p.price ? Math.round((1 - p.price / p.mrp) * 100) : 0);

// ---------- icons ----------
const I = {
  bag: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  menu: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 7h18M3 12h18M3 17h18"/></svg>',
  close: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  wa: '<svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3zm0 23.6c-2 0-3.9-.5-5.6-1.5l-.4-.2-3.9 1 1-3.8-.2-.4A10.6 10.6 0 1 1 16 26.6zm5.8-7.9c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7 0a8.7 8.7 0 0 1-4.3-3.8c-.3-.6.3-.5.9-1.6.1-.2 0-.4 0-.5l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4s-1.1 1.1-1.1 2.7 1.2 3.1 1.3 3.3 2.3 3.5 5.5 4.9c2 .9 2.8.9 3.8.8.6-.1 1.9-.8 2.2-1.5s.3-1.4.2-1.5-.3-.2-.6-.3z"/></svg>',
  truck: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg>',
  shield: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6l8-3z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>',
  needle: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 20L19 5M16 4l4 4"/><path d="M7 13c-3 1-4 4-2 6"/></svg>',
  swap: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 8h14l-3-3M20 16H6l3 3"/></svg>',
};

// ---------- structured data ----------
// social + marketplace links come from editable lists in admin (old single fields still work)
const linkList = (list, legacy) => {
  const out = (Array.isArray(list) ? list : []).map((x) => ({ name: String(x?.name || "").trim(), url: String(x?.url || "").trim() }));
  for (const [k, n] of legacy) if (S[k]) out.push({ name: n, url: S[k] });
  return out.filter((x) => x.name && /^https?:\/\//i.test(x.url));
};
const socials = linkList(S.social_links, [["instagram", "Instagram"], ["facebook", "Facebook"], ["youtube", "YouTube"], ["pinterest", "Pinterest"]]);
const markets = linkList(S.marketplace_links, [["myntra", "Myntra"], ["amazon", "Amazon"], ["flipkart", "Flipkart"], ["etsy", "Etsy"]]);
const sameAs = [...socials, ...markets].map((x) => x.url);
const socialIcon = (n) => {
  const k = n.toLowerCase();
  const d = k.includes("insta") ? '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/>'
    : k.includes("face") ? '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z"/>'
    : k.includes("linked") ? '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 10v7M7 7v.01M11 17v-4a2 2 0 0 1 4 0v4M11 10v7"/>'
    : k.includes("google") ? '<path d="M20 12.2c0-.6-.1-1.2-.2-1.7H12v3.3h4.5a4 4 0 0 1-1.7 2.6v2.1h2.7c1.6-1.5 2.5-3.6 2.5-6.3z"/><path d="M12 20.5c2.3 0 4.2-.8 5.5-2l-2.7-2.1a5 5 0 0 1-7.5-2.7H4.5v2.2A8.5 8.5 0 0 0 12 20.5z"/><path d="M7.3 13.7a5 5 0 0 1 0-3.4V8.1H4.5a8.5 8.5 0 0 0 0 7.8z"/><path d="M12 6.9c1.3 0 2.4.4 3.3 1.3l2.4-2.4A8.5 8.5 0 0 0 4.5 8.1l2.8 2.2A5 5 0 0 1 12 6.9z"/>'
    : k.includes("you") ? '<rect x="2.5" y="6" width="19" height="12" rx="4"/><path d="M10 9.5v5l4.5-2.5z" fill="currentColor"/>'
    : k.includes("pin") ? '<circle cx="12" cy="12" r="9"/><path d="M11 8.5c2.5-1 5 .5 4.5 3s-3 3-4 1.5M11.5 11l-2 8"/>'
    : '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>';
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
};

const orgLd = {
  "@context": "https://schema.org", "@type": "ClothingStore", "@id": SITE_URL + "/#store", name: brand, url: SITE_URL + "/",
  logo: abs("favicon.svg"), image: abs(S.hero_image || "images/site/hero.jpg"), description: S.tagline,
  address: { "@type": "PostalAddress", addressLocality: "Jaipur", addressRegion: "Rajasthan", addressCountry: "IN", streetAddress: S.address || undefined },
  telephone: waNumber ? "+" + waNumber : undefined, email: S.email || undefined, sameAs, priceRange: "₹₹",
};

// ---------- layout ----------
const annItems = String(S.announcement || "").split("|").map((x) => x.trim()).filter(Boolean);

function page({ title, description, pathname, image, body, ld = [], type = "website", noindex = false, bodyClass = "" }) {
  const canonical = SITE_URL + "/" + pathname;
  const lds = [orgLd, ...ld].map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`).join("\n");
  const waHi = waLink(`Hi ${brand}! I have a question.`);
  return `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? "" : `<link rel="canonical" href="${esc(canonical)}">`}
<meta name="robots" content="${noindex ? "noindex" : "index,follow,max-image-preview:large"}">
${S.google_site_verification ? `<meta name="google-site-verification" content="${esc(S.google_site_verification)}">` : ""}
<meta property="og:site_name" content="${esc(brand)}"><meta property="og:type" content="${type}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}"><meta property="og:image" content="${esc(abs(image || S.hero_image || "images/site/hero.jpg"))}">
<meta property="og:locale" content="en_IN"><meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#fbf7f1">
<link rel="icon" href="${u("favicon.svg")}" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Jost:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${u("assets/style.css")}">
<link rel="alternate" type="application/rss+xml" title="${esc(brand)} Blog" href="${u("blog/feed.xml")}">
${lds}
</head>
<body class="${bodyClass}">
<a class="skip" href="#main">Skip to content</a>
${annItems.length ? `<div class="announce" aria-label="Announcements"><div class="announce-track">${[...annItems, ...annItems, ...annItems, ...annItems].map((a, i) => `<span${i >= annItems.length ? ' aria-hidden="true"' : ""}>${esc(a)}</span>`).join("")}</div></div>` : ""}
<header class="site-header">
  <div class="wrap nav">
    <button class="icon-btn menu-btn" aria-label="Open menu" aria-expanded="false" data-open-menu>${I.menu}</button>
    <a class="logo" href="${u()}" aria-label="${esc(brand)} home">${esc(brand)}<small>JAIPUR</small></a>
    <nav class="main-nav" aria-label="Main">
      <a href="${u("shop/")}">Shop All</a>
      ${categories.map((c) => `<a href="${u(c.url)}">${esc(c.plural)}</a>`).join("")}
      <a href="${u("blog/")}">Blog</a>
      <a href="${u("about/")}">Our Story</a>
      <a href="${u("contact/")}">Contact</a>
    </nav>
    <div class="nav-icons">
      ${waHi ? `<a class="icon-btn hide-sm" href="${esc(waHi)}" target="_blank" rel="noopener" aria-label="WhatsApp">${I.wa}</a>` : ""}
      <button class="icon-btn bag-btn" aria-label="Open bag" data-open-cart>${I.bag}<span class="bag-count" data-bag-count hidden>0</span></button>
    </div>
  </div>
</header>
<div class="scrim" data-scrim hidden></div>
<nav class="mnav" id="mnav" aria-label="Menu" aria-hidden="true">
  <div class="drawer-head"><span class="logo">${esc(brand)}<small>JAIPUR</small></span><button class="icon-btn" aria-label="Close menu" data-close-menu>${I.close}</button></div>
  <a href="${u("shop/")}">Shop All</a>
  ${categories.map((c) => `<a href="${u(c.url)}">${esc(c.plural)}</a>`).join("")}
  <a href="${u("blog/")}">Blog</a>
  <a href="${u("about/")}">Our Story</a>
  <a href="${u("contact/")}">Contact</a>
  ${waNumber ? `<a class="mnav-wa" href="${esc(waLink(`Hi ${brand}! I have a question.`))}" target="_blank" rel="noopener">${I.wa} WhatsApp ${esc(S.phone || "")}</a>` : ""}
  ${socials.length ? `<div class="mnav-social">${socials.map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${socialIcon(x.name)}${esc(x.name)}</a>`).join("")}</div>` : ""}
</nav>
<aside class="drawer" id="cart" aria-label="Shopping bag" aria-hidden="true">
  <div class="drawer-head"><h2>Your Bag</h2><button class="icon-btn" aria-label="Close bag" data-close-cart>${I.close}</button></div>
  <div class="drawer-body" data-cart-items><p class="empty">Your bag is empty.</p></div>
  <div class="drawer-foot" data-cart-foot hidden>
    <div class="row"><span>Subtotal</span><strong data-cart-subtotal>₹0</strong></div>
    ${num(S.prepaid_discount_percent) ? `<p class="hint">Extra ${num(S.prepaid_discount_percent)}% off on online payment at checkout</p>` : ""}
    <a class="btn btn-block" href="${u("checkout/")}">Checkout</a>
  </div>
</aside>
<main id="main">
${body}
</main>
<section class="usp">
  <div class="wrap usp-grid">
    <div>${I.needle}<strong>Made in Jaipur</strong><span>Designed and stitched by our own team</span></div>
    <div>${I.shield}<strong>Secure payments</strong><span>UPI, cards & netbanking via Razorpay</span></div>
    <div>${I.truck}<strong>Pan-India delivery</strong><span>${esc(S.dispatch_note || "Ships from Jaipur")}</span></div>
    <div>${I.swap}<strong>Easy exchange</strong><span><a href="${u("returns/")}">See our return policy</a></span></div>
  </div>
</section>
<footer class="site-footer">
  <div class="wrap foot">
    <div class="foot-brand">
      <div class="logo">${esc(brand)}<small>JAIPUR</small></div>
      <p>${esc(S.tagline || "")}</p>
      ${socials.length ? `<p class="social">${socials.map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener me">${socialIcon(x.name)}${esc(x.name)}</a>`).join("")}</p>` : ""}
    </div>
    <div><h3>Shop</h3><a href="${u("shop/")}">Shop All</a>${categories.map((c) => `<a href="${u(c.url)}">${esc(c.plural)}</a>`).join("")}</div>
    <div><h3>Help</h3><a href="${u("blog/")}">Blog</a><a href="${u("contact/")}">Contact Us</a><a href="${u("shipping/")}">Shipping Policy</a><a href="${u("returns/")}">Returns & Refunds</a><a href="${u("privacy/")}">Privacy Policy</a><a href="${u("terms/")}">Terms & Conditions</a></div>
    <div><h3>Contact</h3>
      ${waHi ? `<a href="${esc(waHi)}" target="_blank" rel="noopener">WhatsApp: ${esc(S.phone || "+" + waNumber)}</a>` : ""}
      ${S.email ? `<a href="mailto:${esc(S.email)}">${esc(S.email)}</a>` : ""}
      <p>${esc(S.address || "Jaipur, Rajasthan, India")}</p>
      ${markets.length ? `<h3 class="mt">Also on</h3>${markets.map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>`).join("")}` : ""}
    </div>
  </div>
  <div class="wrap copy">© ${year} ${esc(brand)}, Jaipur. All rights reserved.</div>
</footer>
${waHi ? `<a class="wa-float" href="${esc(waHi)}" target="_blank" rel="noopener" aria-label="Chat on WhatsApp">${I.wa}</a>` : ""}
<div class="toast" data-toast role="status" aria-live="polite"></div>
<script>window.BK=${JSON.stringify({ base: BASE, wa: waNumber, brand })};</script>
<script src="${u("assets/app.js")}" defer></script>
</body>
</html>`;
}

const priceHtml = (p, cls = "") => {
  if (p.price === null) return `<span class="price ask ${cls}">Price on request</span>`;
  const off = offPct(p);
  return `<span class="price ${cls}">${inr(p.price)}</span>${off ? `<s class="mrp">${inr(p.mrp)}</s><span class="off">${off}% OFF</span>` : ""}`;
};

const card = (p, i = 9) => {
  const [a, b] = p.images;
  const alt = `${p.title}${p.color && !p.title.toLowerCase().includes(p.color.toLowerCase()) ? " in " + p.color : ""} – ${brand}`;
  const off = offPct(p);
  return `<article class="card" data-cat="${esc(p.catSlug)}">
  <a href="${u(p.url)}" class="card-link">
    <div class="card-img${b ? " has-alt" : ""}">
      ${a ? `<img src="${esc(u(a))}" alt="${esc(alt)}" width="1200" height="1800" ${i < 2 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">` : ""}
      ${b ? `<img class="alt" src="${esc(u(b))}" alt="" width="1200" height="1800" loading="lazy" decoding="async">` : ""}
      <div class="tags">${off ? `<span class="tag tag-sale">-${off}%</span>` : ""}${!p.in_stock ? `<span class="tag">Made to order</span>` : ""}</div>
    </div>
    <div class="card-body">
      <h3>${esc(p.title)}</h3>
      <div class="card-price">${priceHtml(p)}</div>
    </div>
  </a>
</article>`;
};

const pages = [];
const add = (file, html) => pages.push([file, html]);

// ---------- home ----------
{
  const featured = products.filter((p) => p.featured);
  const list = (featured.length ? featured : products).slice(0, 8);
  const tiles = categories.map((c) => `<a class="tile" href="${u(c.url)}"><img src="${esc(u(c.items[0]?.images[1] || c.items[0]?.images[0] || ""))}" alt="${esc(c.plural)} by ${esc(brand)}" width="1200" height="1800" loading="lazy"><span>${esc(c.plural)}<em>Shop now →</em></span></a>`).join("");
  const body = `
<section class="hero">
  <div class="hero-media"><img src="${esc(u(S.hero_image || "images/site/hero.jpg"))}" alt="${esc(brand)} – handcrafted kurtis and dresses from Jaipur" width="1200" height="1800" fetchpriority="high"></div>
  <div class="hero-text">
    <p class="eyebrow">New collection · Made in Jaipur</p>
    <h1>${esc(S.hero_title || brand)}</h1>
    <p class="lead">${esc(S.hero_subtitle || S.tagline || "")}</p>
    <div class="hero-cta"><a class="btn" href="${u("shop/")}">Shop the collection</a>${categories[0] ? `<a class="btn btn-ghost" href="${u(categories[0].url)}">${esc(categories[0].plural)}</a>` : ""}</div>
  </div>
</section>
${categories.length > 1 ? `<section class="wrap section"><div class="section-head center"><p class="eyebrow">Shop by category</p><h2>Find your style</h2></div><div class="tiles">${tiles}</div></section>` : ""}
<section class="wrap section">
  <div class="section-head"><div><p class="eyebrow">Just in</p><h2>New Arrivals</h2></div><a class="link" href="${u("shop/")}">View all →</a></div>
  <div class="grid">${list.map(card).join("")}</div>
</section>
<section class="story">
  <div class="wrap story-grid">
    <img src="${esc(u(products[0]?.images[2] || products[0]?.images[0] || S.hero_image))}" alt="${esc(brand)} kurti shot in Jaipur" width="1200" height="1800" loading="lazy">
    <div>
      <p class="eyebrow">Our story</p>
      <h2>${esc(S.about_title || "About us")}</h2>
      ${paras(S.about_text)}
      <a class="btn btn-ghost" href="${u("about/")}">Read more</a>
    </div>
  </div>
</section>`;
  add("index.html", page({
    title: `${brand} | Kurtis & Dresses for Women, Made in Jaipur`,
    description: `Shop ${categories.map((c) => c.plural.toLowerCase()).join(" & ")} for women by ${brand}, Jaipur. ${S.tagline || ""}. Secure online payment and pan-India delivery.`.slice(0, 160),
    pathname: "", body, bodyClass: "home",
    ld: [{ "@context": "https://schema.org", "@type": "WebSite", name: brand, url: SITE_URL + "/" }],
  }));
}

// ---------- listing pages ----------
function listing({ file, pathname, h1, intro, items, title, description, crumbs }) {
  const body = `
<section class="wrap section">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="${u()}">Home</a> / ${crumbs}</nav>
  <div class="list-head"><h1>${esc(h1)}</h1><p class="muted">${esc(intro)}</p></div>
  <div class="chips">
    <a class="chip${pathname === "shop/" ? " active" : ""}" href="${u("shop/")}">All</a>
    ${categories.map((c) => `<a class="chip${pathname === c.url ? " active" : ""}" href="${u(c.url)}">${esc(c.plural)}</a>`).join("")}
    <label class="sort">Sort <select data-sort><option value="">Featured</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select></label>
  </div>
  <div class="grid" data-grid>${items.map((p, i) => card(p, i).replace('<article class="card"', `<article class="card" data-price="${p.price ?? ""}" data-i="${i}"`)).join("")}</div>
</section>`;
  add(file, page({
    title, description, pathname, body, image: items[0]?.images[0],
    ld: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: h1, url: SITE_URL + "/" + pathname,
      mainEntity: { "@type": "ItemList", itemListElement: items.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: SITE_URL + "/" + p.url, name: p.title })) } }],
  }));
}
listing({ file: "shop/index.html", pathname: "shop/", h1: "Shop All", intro: `${products.length} styles, made in Jaipur`, items: products, crumbs: "<span>Shop All</span>",
  title: `Shop Women's Kurtis & Dresses Online | ${brand}`, description: `Browse all kurtis and dresses by ${brand}, Jaipur. Embroidered kurtis, floral dresses and more with secure online payment and pan-India delivery.` });
for (const c of categories) {
  listing({ file: c.url + "index.html", pathname: c.url, h1: c.plural, intro: `${c.items.length} styles`, items: c.items, crumbs: `<a href="${u("shop/")}">Shop</a> / <span>${esc(c.plural)}</span>`,
    title: `${c.plural} for Women – Made in Jaipur | ${brand}`, description: `Shop ${c.plural.toLowerCase()} for women by ${brand}, Jaipur. Handcrafted designs, secure online payment and pan-India delivery.` });
}

// ---------- product pages ----------
for (const p of products) {
  const related = products.filter((x) => x.slug !== p.slug).sort((a, b) => (b.category === p.category) - (a.category === p.category)).slice(0, 4);
  const firstLine = String(p.description || "").split(/\n/)[0];
  const desc = (p.seo_description || `${p.title}${p.color ? " in " + p.color : ""}${p.fabric ? ", " + p.fabric : ""}. ${firstLine}`).slice(0, 160);
  const cat = categories.find((c) => c.name === p.category);
  const waAsk = waLink(`Hi ${brand}! I have a question about: ${p.title}\n${SITE_URL}/${p.url}`);
  const disc = num(S.prepaid_discount_percent);
  const body = `
<nav class="wrap crumbs" aria-label="Breadcrumb"><a href="${u()}">Home</a> / <a href="${u(cat.url)}">${esc(cat.plural)}</a> / <span>${esc(p.title)}</span></nav>
<section class="wrap product" data-product="${esc(p.slug)}">
  <div class="gallery">
    <div class="slides" data-slides>
      ${p.images.map((im, i) => `<figure class="slide"><img src="${esc(u(im))}" alt="${esc(p.title)} – photo ${i + 1}" width="1200" height="1800" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></figure>`).join("")}
    </div>
    ${p.images.length > 1 ? `<div class="dots" data-dots>${p.images.map((_, i) => `<button aria-label="Photo ${i + 1}"${i === 0 ? ' class="on"' : ""}></button>`).join("")}</div>
    <div class="thumbs">${p.images.map((im, i) => `<button class="thumb${i === 0 ? " on" : ""}" data-go="${i}" aria-label="Photo ${i + 1}"><img src="${esc(u(im))}" alt="" width="120" height="180" loading="lazy"></button>`).join("")}</div>` : ""}
  </div>
  <div class="buybox">
    <p class="eyebrow">${esc(p.category)}${p.color ? " · " + esc(p.color) : ""}</p>
    <h1>${esc(p.title)}</h1>
    <div class="pdp-price">${priceHtml(p)}</div>
    ${p.price !== null ? `<p class="tax">Inclusive of all taxes${disc ? ` · <strong>Extra ${disc}% off</strong> on online payment` : ""}</p>` : ""}
    ${p.sizes.length ? `<div class="sizes"><div class="label">Select size <span data-size-error hidden>Please select a size</span></div><div class="size-row">${p.sizes.map((s) => `<button class="size" data-size="${esc(s)}">${esc(s)}</button>`).join("")}</div></div>` : ""}
    ${p.price !== null ? `<div class="buy-row"><button class="btn btn-block" data-add>Add to Bag</button><button class="btn btn-dark btn-block" data-buy>Buy Now</button></div>`
      : `<a class="btn btn-wa btn-block" href="${esc(waAsk)}" target="_blank" rel="noopener">${I.wa} Ask price on WhatsApp</a>`}
    ${waAsk && p.price !== null ? `<a class="ask-wa" href="${esc(waAsk)}" target="_blank" rel="noopener">${I.wa} Questions? Chat with us on WhatsApp</a>` : ""}
    <ul class="perks"><li>${I.truck}${esc(S.dispatch_note || "Ships from Jaipur")}</li><li>${I.shield}Secure online payment</li><li>${I.swap}<a href="${u("returns/")}">Easy exchange policy</a></li></ul>
    <details open><summary>Description</summary><div>${paras(p.description) || "<p>Handcrafted in Jaipur.</p>"}</div></details>
    <details><summary>Product details</summary><dl class="specs">
      ${p.color ? `<dt>Colour</dt><dd>${esc(p.color)}</dd>` : ""}${p.fabric ? `<dt>Fabric</dt><dd>${esc(p.fabric)}</dd>` : ""}
      ${p.sizes.length ? `<dt>Sizes</dt><dd>${esc(p.sizes.join(", "))}</dd>` : ""}<dt>Made in</dt><dd>Jaipur, India</dd><dt>Status</dt><dd>${p.in_stock ? "In stock" : "Made to order"}</dd>
    </dl></details>
    <details><summary>Shipping & returns</summary><div>${paras(String(S.shipping_policy || "").split(/\n\s*\n/)[1] || S.dispatch_note)}<p><a href="${u("shipping/")}">Shipping policy</a> · <a href="${u("returns/")}">Returns & refunds</a></p></div></details>
  </div>
</section>
${p.price !== null ? `<div class="sticky-buy" data-sticky><div><strong>${inr(p.price)}</strong><span>${esc(p.title)}</span></div><button class="btn" data-add>Add to Bag</button></div>` : ""}
${related.length ? `<section class="wrap section"><div class="section-head"><h2>You may also like</h2></div><div class="grid">${related.map(card).join("")}</div></section>` : ""}`;
  const ld = {
    "@context": "https://schema.org", "@type": "Product", name: p.title, image: p.images.map(abs), description: String(p.description || "").replace(/\s+/g, " ").trim() || p.title,
    sku: p.slug, brand: { "@type": "Brand", name: brand }, category: p.category, color: p.color || undefined, material: p.fabric || undefined,
    ...(p.price !== null ? { offers: { "@type": "Offer", url: SITE_URL + "/" + p.url, priceCurrency: "INR", price: String(p.price), availability: p.in_stock ? "https://schema.org/InStock" : "https://schema.org/PreOrder", itemCondition: "https://schema.org/NewCondition", seller: { "@id": SITE_URL + "/#store" }, priceValidUntil: `${year + 1}-12-31`,
      shippingDetails: { "@type": "OfferShippingDetails", shippingRate: { "@type": "MonetaryAmount", value: String(num(S.shipping_charge) || 0), currency: "INR" }, shippingDestination: { "@type": "DefinedRegion", addressCountry: "IN" } },
      hasMerchantReturnPolicy: { "@type": "MerchantReturnPolicy", applicableCountry: "IN", returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow", merchantReturnDays: num(S.return_days) || 7, returnMethod: "https://schema.org/ReturnByMail" } } } : {}),
  };
  const crumbs = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL + "/" },
    { "@type": "ListItem", position: 2, name: cat.plural, item: SITE_URL + "/" + cat.url },
    { "@type": "ListItem", position: 3, name: p.title, item: SITE_URL + "/" + p.url }] };
  add(p.url + "index.html", page({ title: p.seo_title || `${p.title} | ${brand}`, description: desc, pathname: p.url, image: p.images[0], body, ld: p.price !== null ? [ld, crumbs] : [crumbs], type: "product", bodyClass: "pdp" }));
}

// ---------- checkout ----------
add("checkout/index.html", page({
  title: `Checkout | ${brand}`, description: "Secure checkout", pathname: "checkout/", noindex: true, bodyClass: "checkout-page",
  body: `
<section class="wrap section checkout" data-checkout>
  <h1>Checkout</h1>
  <div class="co-grid">
    <form class="co-form" data-co-form novalidate>
      <h2>Delivery details</h2>
      <div class="f2">
        <label>Full name<input name="name" autocomplete="name" required maxlength="80"></label>
        <label>Mobile number<input name="phone" type="tel" inputmode="numeric" autocomplete="tel-national" required pattern="[6-9][0-9]{9}" maxlength="10" placeholder="10-digit mobile"></label>
      </div>
      <label>Email (for order updates)<input name="email" type="email" autocomplete="email" maxlength="100"></label>
      <label>House no., building, street, area<textarea name="address" autocomplete="street-address" required rows="2" maxlength="200"></textarea></label>
      <div class="f3">
        <label>Pincode<input name="pincode" inputmode="numeric" autocomplete="postal-code" required pattern="[1-9][0-9]{5}" maxlength="6"></label>
        <label>City<input name="city" autocomplete="address-level2" required maxlength="60"></label>
        <label>State<input name="state" autocomplete="address-level1" required maxlength="40" list="states"></label>
      </div>
      <datalist id="states">${["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Delhi","Jammu and Kashmir","Ladakh","Chandigarh","Puducherry"].map((s) => `<option value="${s}">`).join("")}</datalist>
      <h2>Payment</h2>
      <div class="pay-opts" data-pay-opts><p class="muted">Loading payment options…</p></div>
      <p class="form-error" data-co-error hidden></p>
      <button class="btn btn-block btn-lg" type="submit" data-place disabled>Place order</button>
      <p class="secure" data-secure hidden>${I.shield} Payments are processed securely by Razorpay. We never see your card details.</p>
    </form>
    <aside class="co-summary">
      <h2>Order summary</h2>
      <div data-co-items></div>
      <div class="totals" data-co-totals></div>
    </aside>
  </div>
</section>
<section class="wrap section done" data-done hidden></section>`,
}));

// ---------- info pages ----------
function infoPage(file, pathname, title, h1, html, description) {
  add(file, page({ title, description, pathname, body: `<section class="wrap section prose"><nav class="crumbs" aria-label="Breadcrumb"><a href="${u()}">Home</a> / <span>${esc(h1)}</span></nav><h1>${esc(h1)}</h1>${html}</section>` }));
}
const contactHtml = `
  <p>We are a Jaipur-based label. Message us anytime, we usually reply within a few hours.</p>
  <ul class="contact-list">
    ${waNumber ? `<li><strong>WhatsApp / Call:</strong> <a href="${esc(waLink(`Hi ${brand}!`))}" target="_blank" rel="noopener">${esc(S.phone || "+" + waNumber)}</a></li>` : ""}
    ${S.email ? `<li><strong>Email:</strong> <a href="mailto:${esc(S.email)}">${esc(S.email)}</a></li>` : ""}
    <li><strong>Address:</strong> ${esc(S.address || "Jaipur, Rajasthan, India")}</li>
    ${[...socials, ...markets].map((x) => `<li><strong>${esc(x.name)}:</strong> <a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""))}</a></li>`).join("")}
  </ul>
  ${waNumber ? `<p><a class="btn btn-wa" href="${esc(waLink(`Hi ${brand}!`))}" target="_blank" rel="noopener">${I.wa} Chat on WhatsApp</a></p>` : ""}`;
infoPage("about/index.html", "about/", `Our Story – ${brand}, Jaipur`, S.about_title || "Our Story", paras(S.about_text) + `<h2>Get in touch</h2>` + contactHtml, `${brand} is a Jaipur label making kurtis and dresses for women. ${S.tagline || ""}`.slice(0, 160));
infoPage("contact/index.html", "contact/", `Contact Us | ${brand}`, "Contact Us", contactHtml, `Contact ${brand}, Jaipur for orders, sizes, custom requests and bulk enquiries. Chat with us on WhatsApp${S.email ? " or write to us by email" : ""}.`);
infoPage("shipping/index.html", "shipping/", `Shipping Policy | ${brand}`, "Shipping Policy", paras(S.shipping_policy), `Shipping policy of ${brand}: dispatch time from Jaipur, delivery time across India, tracking details and made-to-order timelines.`);
infoPage("returns/index.html", "returns/", `Returns, Exchange & Refund Policy | ${brand}`, "Returns, Exchange & Refunds", paras(S.return_policy), `Return, exchange and refund policy of ${brand}: how to request an exchange, eligible products and refund timelines for online payments.`);
infoPage("privacy/index.html", "privacy/", `Privacy Policy | ${brand}`, "Privacy Policy", paras(S.privacy_policy), `Privacy policy of ${brand}: what details we collect for your order, how we use them, secure payments via Razorpay and how to delete your data.`);
infoPage("terms/index.html", "terms/", `Terms & Conditions | ${brand}`, "Terms & Conditions", paras(S.terms), `Terms and conditions for shopping on the ${brand} website: orders, pricing, payments, cancellations and governing law.`);

// ---------- blog ----------
// Small, safe markdown → HTML (headings, bold, italic, links, images, lists, quotes)
function md(src = "") {
  const safeUrl = (x) => (/^(https?:\/\/|\/|#|mailto:)/i.test(x.trim()) ? x.trim() : "#");
  const inline = (t) => esc(t)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, a, h) => `<img src="${esc(u(safeUrl(h)))}" alt="${a}" loading="lazy">`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, a, h) => { const x = safeUrl(h); return `<a href="${esc(u(x))}"${/^https?:/.test(x) && !x.includes(SITE_URL) ? ' target="_blank" rel="noopener"' : ""}>${a}</a>`; })
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>").replace(/(^|\W)_([^_]+)_(?=\W|$)/g, "$1<em>$2</em>").replace(/`([^`]+)`/g, "<code>$1</code>");
  const out = []; let list = null, para = [];
  const flushP = () => { if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };
  const flushL = () => { if (list) { out.push(`<${list.t}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.t}>`); list = null; } };
  for (const raw of String(src).replace(/\r/g, "").split("\n")) {
    const line = raw.trim(); let m;
    if (!line) { flushP(); flushL(); continue; }
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) { flushP(); flushL(); const lv = Math.min(4, Math.max(2, m[1].length)); out.push(`<h${lv}>${inline(m[2])}</h${lv}>`); continue; }
    if ((m = line.match(/^[-*+]\s+(.*)$/))) { flushP(); if (!list || list.t !== "ul") { flushL(); list = { t: "ul", items: [] }; } list.items.push(m[1]); continue; }
    if ((m = line.match(/^\d+[.)]\s+(.*)$/))) { flushP(); if (!list || list.t !== "ol") { flushL(); list = { t: "ol", items: [] }; } list.items.push(m[1]); continue; }
    if ((m = line.match(/^>\s?(.*)$/))) { flushP(); flushL(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); continue; }
    if (/^!\[[^\]]*\]\([^)]+\)$/.test(line)) { flushP(); flushL(); out.push(`<figure>${inline(line)}</figure>`); continue; }
    flushL(); para.push(line);
  }
  flushP(); flushL();
  return out.join("\n");
}
const blogDir = path.join(ROOT, "content/blog");
const posts = (fs.existsSync(blogDir) ? fs.readdirSync(blogDir) : []).filter((f) => f.endsWith(".json")).map((f) => {
  const b = JSON.parse(fs.readFileSync(path.join(blogDir, f), "utf8"));
  b.slug = slugify(f.replace(/\.json$/, "")).replace(/^-+|-+$/g, "") || "post-" + [...f].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(36);
  b.url = `blog/${b.slug}/`;
  b.date = String(b.date || today).slice(0, 10);
  b.tags = (b.tags || []).filter(Boolean);
  b.related = (b.related_products || []).map((s) => products.find((p) => p.slug === slugify(s) || p.title === s)).filter(Boolean);
  return b;
}).filter((b) => b.title && b.draft !== true && b.date <= today).sort((a, b) => b.date.localeCompare(a.date));
const niceDate = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
const postCard = (b) => `<article class="post-card"><a href="${u(b.url)}">
  ${b.cover ? `<div class="post-img"><img src="${esc(u(b.cover))}" alt="${esc(b.title)}" width="1200" height="800" loading="lazy"></div>` : ""}
  <p class="eyebrow">${esc(niceDate(b.date))}${b.tags[0] ? " · " + esc(b.tags[0]) : ""}</p><h3>${esc(b.title)}</h3><p class="muted">${esc(b.excerpt || "")}</p></a></article>`;

add("blog/index.html", page({
  title: `Style Journal – Kurti Styling Tips & Jaipur Fashion | ${brand}`,
  description: `Kurti styling tips, fabric and care guides, festive outfit ideas and stories from our studio in Jaipur, by ${brand}.`,
  pathname: "blog/",
  body: `<section class="wrap section"><nav class="crumbs" aria-label="Breadcrumb"><a href="${u()}">Home</a> / <span>Blog</span></nav>
  <div class="list-head"><p class="eyebrow">Style Journal</p><h1>The ${esc(brand)} Blog</h1><p class="muted">Styling tips, fabric guides and stories from Jaipur.</p></div>
  ${posts.length ? `<div class="posts">${posts.map(postCard).join("")}</div>` : `<p class="center muted">New posts coming soon.</p>`}</section>`,
  ld: [{ "@context": "https://schema.org", "@type": "Blog", name: `${brand} Blog`, url: SITE_URL + "/blog/", blogPost: posts.map((b) => ({ "@type": "BlogPosting", headline: b.title, url: SITE_URL + "/" + b.url, datePublished: b.date })) }],
}));
for (const b of posts) {
  const more = posts.filter((x) => x.slug !== b.slug).slice(0, 3);
  const shareText = encodeURIComponent(`${b.title} ${SITE_URL}/${b.url}`);
  const body = `
<article class="wrap section post">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="${u()}">Home</a> / <a href="${u("blog/")}">Blog</a> / <span>${esc(b.title)}</span></nav>
  <header class="post-head"><p class="eyebrow">${esc(niceDate(b.date))}${b.tags.length ? " · " + b.tags.map(esc).join(", ") : ""}</p><h1>${esc(b.title)}</h1>${b.excerpt ? `<p class="lead">${esc(b.excerpt)}</p>` : ""}</header>
  ${b.cover ? `<img class="post-cover" src="${esc(u(b.cover))}" alt="${esc(b.title)}" width="1200" height="800" fetchpriority="high">` : ""}
  <div class="post-body prose">${md(b.body)}</div>
  <p class="share">Share: <a href="https://wa.me/?text=${shareText}" target="_blank" rel="noopener">WhatsApp</a> · <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SITE_URL + "/" + b.url)}" target="_blank" rel="noopener">Facebook</a> · <a href="https://pinterest.com/pin/create/button/?url=${encodeURIComponent(SITE_URL + "/" + b.url)}&description=${encodeURIComponent(b.title)}" target="_blank" rel="noopener">Pinterest</a></p>
</article>
${b.related.length ? `<section class="wrap section"><div class="section-head"><h2>Shop this story</h2></div><div class="grid">${b.related.slice(0, b.related.length >= 4 ? 4 : Math.min(2, b.related.length)).map(card).join("")}</div></section>` : ""}
${more.length ? `<section class="wrap section"><div class="section-head"><h2>More from the blog</h2><a class="link" href="${u("blog/")}">All posts →</a></div><div class="posts">${more.map(postCard).join("")}</div></section>` : ""}`;
  add(b.url + "index.html", page({
    title: b.seo_title || `${b.title} | ${brand}`, description: (b.seo_description || b.excerpt || b.title).slice(0, 160), pathname: b.url, image: b.cover, type: "article", body,
    ld: [{ "@context": "https://schema.org", "@type": "BlogPosting", headline: b.title, description: b.excerpt || undefined, image: b.cover ? [abs(b.cover)] : undefined,
      datePublished: b.date, dateModified: b.date, author: { "@type": "Organization", name: brand }, publisher: { "@id": SITE_URL + "/#store" }, mainEntityOfPage: SITE_URL + "/" + b.url, keywords: b.tags.join(", ") || undefined },
      { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: SITE_URL + "/" }, { "@type": "ListItem", position: 2, name: "Blog", item: SITE_URL + "/blog/" }, { "@type": "ListItem", position: 3, name: b.title, item: SITE_URL + "/" + b.url }] }],
  }));
}

// ---------- 404 ----------
add("404.html", page({ title: `Page not found | ${brand}`, description: "Page not found", pathname: "404.html", noindex: true,
  body: `<section class="wrap section prose center"><h1>This page has moved</h1><p>The page you are looking for is not here anymore. Our latest collection is waiting for you.</p><p><a class="btn" href="${u("shop/")}">Shop the collection</a></p></section>` }));

// ---------- write ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, "static"), OUT, { recursive: true });
for (const [file, html] of pages) {
  const f = path.join(OUT, file);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, html);
}

// catalog used by the cart, checkout and the payment server (prices are checked on the server)
const catalog = {
  settings: {
    shipping_charge: num(S.shipping_charge) || 0, free_shipping_above: num(S.free_shipping_above) || 0,
    cod_enabled: !!S.cod_enabled, cod_charge: num(S.cod_charge) || 0, prepaid_discount_percent: num(S.prepaid_discount_percent) || 0,
    upi_id: (S.upi_id || "").trim(), brand, whatsapp: waNumber,
  },
  products: Object.fromEntries(products.map((p) => [p.slug, { title: p.title, price: p.price, sizes: p.sizes, image: p.images[0] || "", color: p.color || "", url: p.url, in_stock: p.in_stock }])),
};
fs.mkdirSync(path.join(OUT, "data"), { recursive: true });
fs.writeFileSync(path.join(OUT, "data/catalog.json"), JSON.stringify(catalog));

// admin panel config
const repo = process.env.GITHUB_REPO || S.github_repo || "YOUR-GITHUB-USERNAME/bahe-kurtiz";
const cfgPath = path.join(OUT, "admin/config.yml");
if (fs.existsSync(cfgPath)) {
  fs.writeFileSync(cfgPath, fs.readFileSync(cfgPath, "utf8").replaceAll("__REPO__", repo).replaceAll("__BRANCH__", process.env.CF_PAGES_BRANCH || "main").replaceAll("__SITE_URL__", SITE_URL));
}

// sitemap, robots, redirects for old shop links, headers
const urls = ["", "shop/", ...categories.map((c) => c.url), ...products.map((p) => p.url), "blog/", ...posts.map((b) => b.url), "about/", "contact/", "shipping/", "returns/", "privacy/", "terms/"];
fs.writeFileSync(path.join(OUT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.map((x) => { const p = products.find((q) => q.url === x); return `<url><loc>${SITE_URL}/${x}</loc><lastmod>${today}</lastmod>${p ? p.images.map((im) => `<image:image><image:loc>${esc(abs(im))}</image:loc></image:image>`).join("") : ""}</url>`; }).join("\n")}
</urlset>`);
fs.writeFileSync(path.join(OUT, "blog/feed.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${esc(brand)} Blog</title><link>${SITE_URL}/blog/</link><description>${esc(S.tagline || "")}</description><atom:link href="${SITE_URL}/blog/feed.xml" rel="self" type="application/rss+xml"/><lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${posts.map((b) => `<item><title>${esc(b.title)}</title><link>${SITE_URL}/${b.url}</link><guid>${SITE_URL}/${b.url}</guid><pubDate>${new Date(b.date + "T09:00:00+05:30").toUTCString()}</pubDate><description>${esc(b.excerpt || "")}</description></item>`).join("\n")}
</channel></rss>`);
fs.writeFileSync(path.join(OUT, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /checkout/\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
const extraRedirects = fs.existsSync(path.join(ROOT, "content/redirects.txt")) ? fs.readFileSync(path.join(ROOT, "content/redirects.txt"), "utf8") : "";
fs.writeFileSync(path.join(OUT, "_redirects"), [
  "# Old website links -> new pages (keeps Google ranking)",
  "/collections/all /shop/ 301",
  "/collections /shop/ 301",
  "/pages/contact /contact/ 301",
  "/pages/about-us /about/ 301",
  "/policies/shipping-policy /shipping/ 301",
  "/policies/refund-policy /returns/ 301",
  "/policies/privacy-policy /privacy/ 301",
  "/policies/terms-of-service /terms/ 301",
  "/cart /checkout/ 302",
  extraRedirects.trim(),
].filter(Boolean).join("\n") + "\n");
fs.writeFileSync(path.join(OUT, "_headers"), `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: SAMEORIGIN\n/images/*\n  Cache-Control: public, max-age=2592000\n/assets/*\n  Cache-Control: public, max-age=86400\n/admin/*\n  X-Robots-Tag: noindex\n`);
console.log(`Built ${pages.length} pages, ${products.length} products, ${categories.length} categories → _site (url ${SITE_URL})`);
