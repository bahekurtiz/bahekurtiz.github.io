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
const clip = (t, n = 155) => { t = String(t || "").replace(/\s+/g, " ").trim(); if (t.length <= n) return t; const c = t.slice(0, n - 1); return c.slice(0, Math.max(c.lastIndexOf(" "), 60)).replace(/[\s,;:–-]+$/, "") + "…"; };
const slugify = (s) => String(s).toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-");
const num = (v) => (v === "" || v === null || v === undefined || isNaN(Number(v)) ? null : Number(v));
const inr = (n) => (num(n) === null ? "" : "₹" + Number(n).toLocaleString("en-IN"));
const digits = (s) => String(s || "").replace(/\D/g, "");
const plural = (c) => (/(ss|sh|ch|x)$/i.test(c) ? c + "es" : /s$/i.test(c) ? c : c + "s");
const brand = S.brand_name || "Bahe Kurtiz";
// logo from admin (Settings → Logo); falls back to the text logo
// logo / favicon / hero: admin settings first, else the default files in static/images/site/
const siteFile = (f) => (fs.existsSync(path.join(ROOT, "static/images/site", f)) ? "/images/site/" + f : "");
const logoImg = String(S.logo || "").trim() || siteFile("logo.png");
const favImg = String(S.favicon || "").trim() || siteFile("favicon.png");
if (!String(S.hero_image || "").trim() && siteFile("hero-teal.jpg")) S.hero_image = "/images/site/hero-teal.jpg";
const logoMark = () => (logoImg ? `<img class="logo-img" src="${esc(u(logoImg))}" alt="${esc(brand)}" width="300" height="100">` : `${esc(brand)}<small>JAIPUR</small>`);
const waNumber = (() => { let d = digits(S.whatsapp); if (d.length === 10) d = "91" + d; return d; })();
const waLink = (msg) => (waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}` : "");
const usdRate = num(S.usd_rate);
const ASSET_V = ["assets/style.css", "assets/app.js"].map((f) => { try { return fs.readFileSync(path.join(ROOT, "static", f), "utf8"); } catch { return ""; } }).join("").split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(36);
const today = new Date().toISOString().slice(0, 10);
const year = new Date().getFullYear();

// sizes always shown in order: XS, S, M, L, XL, XXL, 3XL… (numbers like 28, 30 sort by value; Free Size last)
const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "XXXL", "3XL", "4XL", "5XL", "6XL", "7XL", "8XL"];
const sizeRank = (x) => { const k = String(x).toUpperCase().replace(/\s+/g, ""); const alias = { "2XL": "XXL", XXXL: "3XL" }[k] || k; const i = SIZE_ORDER.indexOf(alias); if (i >= 0) return i * 10; const n = parseFloat(k); if (!isNaN(n)) return 200 + n; if (/FREE/.test(k)) return 900; return 500; };
// ---------- products ----------
const prodDir = path.join(ROOT, "content/products");
const products = fs.readdirSync(prodDir).filter((f) => f.endsWith(".json")).map((f) => {
  const p = JSON.parse(fs.readFileSync(path.join(prodDir, f), "utf8"));
  p.slug = slugify(f.replace(/\.json$/, "")).replace(/^-+|-+$/g, "") || "item-" + [...f].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(36);
  p.images = (p.images || []).map((x) => (typeof x === "string" ? x : x?.image)).filter(Boolean);
  p.sizes = [...new Set((p.sizes || []).filter(Boolean).map((x) => String(x).trim()))].sort((a, b) => sizeRank(a) - sizeRank(b));
  p.video = String(p.video || "").trim();
  p.category = (p.category || "Kurti").trim();
  p.catSlug = slugify(plural(p.category));
  p.url = `products/${p.slug}/`;
  p.price = num(p.price); p.mrp = num(p.mrp);
  p.in_stock = p.in_stock !== false;
  // international price: own $ price, else auto from ₹ ÷ rate (if a rate is set in admin)
  p.price_usd = num(p.price_usd) ?? (usdRate && p.price ? Math.ceil(p.price / usdRate) : null);
  p.mrp_usd = num(p.mrp_usd) ?? (usdRate && p.mrp ? Math.ceil(p.mrp / usdRate) : null);
  p.ships_abroad = p.ships_abroad !== false;
  p.bestseller = p.bestseller === true;
  p.sold_out = (Array.isArray(p.sold_out_sizes) ? p.sold_out_sizes : []).map((x) => String(x).trim()).filter(Boolean);
  p.occasion = (Array.isArray(p.occasion) ? p.occasion : p.occasion ? [p.occasion] : []).map((x) => String(x).trim()).filter(Boolean);
  p.intl = p.ships_abroad && p.price_usd !== null;
  p.fabric = String(p.fabric || "").trim();
  p.print_work = (Array.isArray(p.print_work) ? p.print_work : p.print_work ? [p.print_work] : []).map((x) => String(x).trim()).filter(Boolean);
  p.match = (Array.isArray(p.match_products) ? p.match_products : []).map((x) => slugify(String(x || ""))).filter(Boolean);
  return p;
}).filter((p) => p.title && p.draft !== true)
  .sort((a, b) => (num(a.sort_order) ?? 999) - (num(b.sort_order) ?? 999) || a.title.localeCompare(b.title));
const intlOn = products.some((p) => p.intl);
const usd = (n) => (num(n) === null ? "" : "$" + (Number(n) % 1 ? Number(n).toFixed(2) : String(Number(n))));
const offUsd = (p) => (p.price_usd && p.mrp_usd && p.mrp_usd > p.price_usd ? Math.round((1 - p.price_usd / p.mrp_usd) * 100) : 0);
const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort((a, b) => a.localeCompare(b));
const fabrics = uniq(products.map((p) => p.fabric).filter((f) => f && f !== "Other"));
const prints = uniq(products.flatMap((p) => p.print_work));
const occasions = uniq(products.flatMap((p) => p.occasion));
const addDays = (iso, d) => { const t = new Date(iso + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() - d); return t.toISOString().slice(0, 10); };
const nice = (iso) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
// default festive dates (Karwa Chauth 29 Oct 2026, Diwali 8 Nov 2026) until the owner sets their own list in admin
const festNext = (Array.isArray(S.festivals) ? S.festivals : [{ name: "Karwa Chauth", date: "2026-10-29", link: "occasion/festive/" }, { name: "Diwali", date: "2026-11-08", link: "occasion/festive/" }]).map((f) => ({ name: String(f?.name || "").trim(), date: String(f?.date || "").slice(0, 10), link: (() => { const l = String(f?.link || "").trim(); const m = l.match(/^occasion\/([^/]+)\/?$/); return m && !occasions.some((o) => slugify(o) === m[1]) ? "shop/" : l; })() })).filter((f) => f.name && /^\d{4}-\d{2}-\d{2}$/.test(f.date))
  .map((f) => { const inDays = (num(S.dispatch_days) || 3) + (num(S.transit_days_max) || 7), usDays = (num(S.dispatch_days) || 3) + (num(S.intl_eta_max) || 12); const a = addDays(f.date, inDays), b = addDays(f.date, usDays); return { ...f, dateText: nice(f.date), order_by_in: a, order_by_intl: b, order_by_in_text: nice(a), order_by_intl_text: nice(b) }; })
  .filter((f) => f.order_by_in >= today).sort((a, b) => a.date.localeCompare(b.date))[0] || null;
const qs = (k, v) => `shop/?${k}=${encodeURIComponent(v)}`;
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
  heart: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 20s-7.5-4.6-9.2-9.3C1.7 7.4 4 4.5 7.1 4.5c2 0 3.5 1.1 4.9 2.9 1.4-1.8 2.9-2.9 4.9-2.9 3.1 0 5.4 2.9 4.3 6.2C19.5 15.4 12 20 12 20z"/></svg>',
  globe: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
  ruler: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="2.5" y="8" width="19" height="8" rx="1.5"/><path d="M6.5 8v3M10 8v4M13.5 8v3M17 8v4"/></svg>',
  box: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5L12 12l9-4.5M12 12v9"/></svg>',
  tag: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 12l8.5-8.5H20V12l-8.5 8.5z"/><circle cx="15.5" cy="8" r="1.5"/></svg>',
  user: '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  search: '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
  home: '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 11l9-7 9 7v9h-6v-6H9v6H3z"/></svg>',
  grid: '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/></svg>',
  play: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>',
};
const star = (n) => `<span class="stars" aria-label="${n} out of 5 stars">${"★".repeat(Math.max(0, Math.min(5, Math.round(n))))}${"☆".repeat(5 - Math.max(0, Math.min(5, Math.round(n))))}</span>`;

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
  logo: abs(logoImg || favImg || "favicon.svg"), image: abs(S.hero_image || "images/site/hero.jpg"), description: S.tagline,
  address: { "@type": "PostalAddress", addressLocality: "Jaipur", addressRegion: "Rajasthan", addressCountry: "IN", streetAddress: S.address || undefined },
  telephone: waNumber ? "+" + waNumber : undefined, email: S.email || undefined, sameAs, priceRange: "₹₹",
};

// ---------- Google Analytics 4, Microsoft Clarity, Pinterest tag (IDs from admin settings) ----------
const ga4 = String(S.ga4_id || "").trim().match(/^G-[A-Z0-9]+$/i)?.[0] || "";
const clarity = String(S.clarity_id || "").trim().match(/^[a-z0-9]{6,14}$/i)?.[0] || "";
const pinTag = digits(S.pinterest_tag_id);
const trackHead = [
  ga4 ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${ga4}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${ga4}');</script>` : "",
  clarity ? `<script>(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","${clarity}");</script>` : "",
  pinTag ? `<script>!function(e){if(!window.pintrk){window.pintrk=function(){window.pintrk.queue.push(Array.prototype.slice.call(arguments))};var n=window.pintrk;n.queue=[],n.version="3.0";var t=document.createElement("script");t.async=!0,t.src=e;var r=document.getElementsByTagName("script")[0];r.parentNode.insertBefore(t,r)}}("https://s.pinimg.com/ct/core.js");pintrk('load','${pinTag}');pintrk('page');</script>` : "",
].filter(Boolean).join("\n");

const crumbLd = (list) => ({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [["Home", ""], ...list].map(([name, path_], i) => ({ "@type": "ListItem", position: i + 1, name, item: SITE_URL + "/" + path_ })) });
// ---------- Meta Pixel (ID from admin settings) ----------
const pixelId = digits(S.meta_pixel_id);
const pixelHead = pixelId ? `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');fbq('track','PageView');</script>` : "";
const pixelBody = pixelId ? `<noscript><img height="1" width="1" style="display:none" alt="" src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"></noscript>` : "";

// ---------- Shoppable reels (Instagram-style videos, each can be linked to a product) ----------
const igCode = (l) => (String(l || "").match(/instagram\.com\/(?:[^/]+\/)?(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i) || [])[1] || "";
const reels = (Array.isArray(S.reels) ? S.reels : []).map((r) => ({ link: String(r?.link || "").trim(), video: String(r?.video || "").trim(), cover: String(r?.cover || "").trim(), caption: String(r?.caption || "").trim(), product: slugify(String(r?.product || "")) }))
  .map((r) => ({ ...r, ig: !r.video && !r.cover && igCode(r.link) ? `https://www.instagram.com/reel/${igCode(r.link)}/embed/` : "" }))
  .filter((r) => r.video || r.cover || r.ig);
const igLink = socials.find((x) => /insta/i.test(x.name))?.url || "";
const igHandle = (igLink.match(/instagram\.com\/([^/?#]+)/i) || [])[1] || "";
const reelData = () => reels.map((r) => { const p = products.find((x) => x.slug === r.product); return { video: r.video ? u(r.video) : "", cover: r.cover ? u(r.cover) : "", ig: r.ig, link: r.link, caption: r.caption, product: p ? { slug: p.slug, title: p.title, url: u(p.url), image: u(p.images[0] || ""), price: priceHtml(p) } : null }; });
const reelsHtml = () => !reels.length ? "" : `<section class="reels" aria-label="Shoppable reels">
  <div class="wrap">
    <div class="section-head"><div><p class="eyebrow">${esc(S.reels_eyebrow || "Watch & shop")}</p><h2>${esc(S.reels_title || "Watch & Shop")}</h2></div>${igLink ? `<a class="link" href="${esc(igLink)}" target="_blank" rel="noopener">${igHandle ? "@" + esc(igHandle) : "Follow us"} →</a>` : ""}</div>
    <div class="reel-row">${reels.map((r, i) => {
      const fb = /facebook\.com|fb\.watch/i.test(r.link);
      const p = products.find((x) => x.slug === r.product);
      const media = r.ig ? `<iframe src="${esc(r.ig)}" title="${esc(r.caption || "Instagram reel")}" loading="lazy" scrolling="no" allowtransparency="true" allow="autoplay; encrypted-media; picture-in-picture"></iframe>` : r.video
        ? `<video src="${esc(u(r.video))}"${r.cover ? ` poster="${esc(u(r.cover))}"` : ""} muted loop playsinline preload="none" data-reel aria-hidden="true"></video>`
        : `<img src="${esc(u(r.cover))}" alt="${esc(r.caption || brand + " reel")}" width="540" height="960" loading="lazy" decoding="async">`;
      const inner = `${media}<span class="reel-play" aria-hidden="true">${I.play}</span>${r.caption ? `<span class="reel-cap">${esc(r.caption)}</span>` : ""}${r.link ? `<span class="reel-src">${socialIcon(fb ? "facebook" : "instagram")}</span>` : ""}`;
      const box = r.ig ? `<div class="reel reel-ig">${media}</div>` : r.video || p ? `<button class="reel" type="button" data-reel-open="${i}" aria-label="Play reel${r.caption ? ": " + esc(r.caption) : ""}">${inner}</button>`
        : r.link ? `<a class="reel" href="${esc(r.link)}" target="_blank" rel="noopener" aria-label="${esc(r.caption || "Watch reel")} on ${fb ? "Facebook" : "Instagram"}">${inner}</a>` : `<div class="reel">${inner}</div>`;
      const shop = p ? `<a class="reel-prod" href="${u(p.url)}"><img src="${esc(u(p.images[0] || ""))}" alt="" width="60" height="90" loading="lazy"><span><em>${esc(p.title)}</em><span class="card-price">${priceHtml(p)}</span></span><b>Shop</b></a>` : "";
      return `<div class="reel-item">${box}${shop}</div>`;
    }).join("")}</div>
  </div>
</section>`;

const landDir = path.join(ROOT, "content/landing");
const landings = (fs.existsSync(landDir) ? fs.readdirSync(landDir) : []).filter((f) => f.endsWith(".json")).map((f) => {
  const l = JSON.parse(fs.readFileSync(path.join(landDir, f), "utf8"));
  l.slug = slugify(l.slug || f.replace(/\.json$/, "")).replace(/^-+|-+$/g, "");
  l.url = l.slug + "/";
  l.faq = (Array.isArray(l.faq) ? l.faq : []).map((x) => ({ q: String(x?.q || "").trim(), a: String(x?.a || "").trim() })).filter((x) => x.q && x.a);
  return l;
}).filter((l) => l.slug && l.h1 && l.draft !== true && !["shop", "blog", "products", "collections", "wholesale", "admin", "api", "checkout"].includes(l.slug));
// ---------- layout ----------
const annItems = String(S.announcement || "").split("|").map((x) => x.trim()).filter(Boolean);

let _dm; const defaultMini = () => _dm !== undefined ? _dm : (_dm = (() => { const r = reels.find((x) => x.video); if (!r) return null; const p = products.find((x) => x.slug === r.product); return { video: u(r.video), cover: r.cover ? u(r.cover) : "", caption: r.caption, product: p ? { title: p.title, url: u(p.url), image: u(p.images[0] || ""), price: priceHtml(p) } : null }; })());
function page({ title, description, pathname, image, body, ld = [], type = "website", noindex = false, bodyClass = "", mini, og = "" }) {
  if (mini === undefined) mini = defaultMini();
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
${S.facebook_domain_verification ? `<meta name="facebook-domain-verification" content="${esc(S.facebook_domain_verification)}">` : ""}
${S.pinterest_verification ? `<meta name="p:domain_verify" content="${esc(S.pinterest_verification)}">` : ""}
${trackHead}
<meta property="og:site_name" content="${esc(brand)}"><meta property="og:type" content="${type}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}">
${og}<meta property="og:url" content="${esc(canonical)}"><meta property="og:image" content="${esc(abs(image || S.hero_image || "images/site/hero.jpg"))}">
<meta property="og:locale" content="en_IN"><meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0e5b59">
${favImg ? `<link rel="icon" href="${esc(u(favImg))}" type="image/png"><link rel="apple-touch-icon" href="${esc(u(favImg))}">` : `<link rel="icon" href="${u("favicon.svg")}" type="image/svg+xml">`}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600&family=Jost:wght@400;500&display=swap" rel="stylesheet" media="print" onload="this.media='all'"><noscript><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600&family=Jost:wght@400;500&display=swap" rel="stylesheet"></noscript>
<link rel="stylesheet" href="${u("assets/style.css")}?v=${ASSET_V}">
<link rel="manifest" href="${u("manifest.webmanifest")}">
<script type="speculationrules">{"prerender":[{"where":{"href_matches":"/products/*"},"eagerness":"moderate"}],"prefetch":[{"where":{"and":[{"href_matches":"/*"},{"not":{"href_matches":"/checkout*"}},{"not":{"href_matches":"/admin*"}},{"not":{"href_matches":"/api/*"}}]},"eagerness":"conservative"}]}</script>
${intlOn ? `<script>(function(){var c;try{c=localStorage.getItem("bk_cur")}catch(e){}if(!c){var z="";try{z=Intl.DateTimeFormat().resolvedOptions().timeZone||""}catch(e){}c=/Calcutta|Kolkata/.test(z)||!z?"INR":"USD"}if(c==="USD")document.documentElement.classList.add("usd")})()</script>` : ""}
<link rel="alternate" type="application/rss+xml" title="${esc(brand)} Blog" href="${u("blog/feed.xml")}">
${lds}
${pixelHead}
</head>
<body class="${bodyClass}">
${pixelBody}
<a class="skip" href="#main">Skip to content</a>
${annItems.length ? `<div class="announce" aria-label="Announcements"><div class="announce-track">${[...annItems, ...annItems, ...annItems, ...annItems].map((a, i) => `<span${i >= annItems.length ? ' aria-hidden="true"' : ""}>${esc(a)}</span>`).join("")}</div></div>` : ""}
<header class="site-header">
  <div class="wrap nav">
    <button class="icon-btn menu-btn" aria-label="Open menu" aria-expanded="false" data-open-menu>${I.menu}</button>
    <a class="logo${logoImg ? " has-img" : ""}" href="${u()}" aria-label="${esc(brand)} home">${logoMark()}</a>
    <nav class="main-nav" aria-label="Main">
      <div class="has-mega"><a href="${u("shop/")}" class="mega-trigger">Shop <span aria-hidden="true">▾</span></a>
        <div class="mega"><div class="wrap mega-grid">
          <div><h4>Categories</h4><a href="${u("shop/")}">Shop All</a>${categories.map((c) => `<a href="${u(c.url)}">${esc(c.plural)}</a>`).join("")}</div>
          ${prints.length ? `<div><h4>Shop by print</h4>${prints.slice(0, 9).map((x) => `<a href="${u(qs("print", x))}">${esc(x)}</a>`).join("")}</div>` : ""}
          ${fabrics.length ? `<div><h4>Shop by fabric</h4>${fabrics.slice(0, 9).map((x) => `<a href="${u(qs("fabric", x))}">${esc(x)}</a>`).join("")}</div>` : ""}
          <a class="mega-feat" href="${u("wholesale/")}"><img src="${esc(u(products[0]?.images[0] || S.hero_image || ""))}" alt="" width="240" height="320" loading="lazy"><span><em>For boutiques & brands</em>Wholesale & Private Label →</span></a>
        </div></div>
      </div>
      ${products.some((p) => p.bestseller) ? `<a href="${u("bestsellers/")}">Bestsellers</a>` : ""}
      <a href="${u("shop/")}">New Arrivals</a>
      <a href="${u("wholesale/")}">Wholesale</a>
      <a href="${u("blog/")}">Journal</a>
      <a href="${u("about/")}">Our Story</a>
      <a href="${u("contact/")}">Contact</a>
    </nav>
    <div class="nav-icons">
      ${intlOn ? `<button class="cur-btn" type="button" data-cur aria-label="Change currency"><span class="cur-inr">₹ INR</span><span class="cur-usd">$ USD</span></button>` : ""}
      <button class="icon-btn" type="button" data-open-search aria-label="Search">${I.search}</button>
      <button class="icon-btn" type="button" data-open-login aria-label="My account">${I.user}<span class="acct-dot" data-acct-dot hidden></span></button>
      <a class="icon-btn hide-sm" href="${u("wishlist/")}" aria-label="Wishlist">${I.heart}<span class="bag-count" data-wish-count hidden>0</span></a>
      ${waHi ? `<a class="icon-btn hide-sm" href="${esc(waHi)}" target="_blank" rel="noopener" aria-label="WhatsApp">${I.wa}</a>` : ""}
      <button class="icon-btn bag-btn" aria-label="Open bag" data-open-cart>${I.bag}<span class="bag-count" data-bag-count hidden>0</span></button>
    </div>
  </div>
</header>
<div class="scrim" data-scrim hidden></div>
<nav class="mnav" id="mnav" aria-label="Menu" aria-hidden="true">
  <div class="drawer-head"><span class="logo${logoImg ? " has-img" : ""}">${logoMark()}</span><button class="icon-btn" aria-label="Close menu" data-close-menu>${I.close}</button></div>
  <a href="${u("shop/")}">Shop All</a>
  ${categories.map((c) => `<a href="${u(c.url)}">${esc(c.plural)}</a>`).join("")}
  <a href="${u("wholesale/")}">Wholesale & Private Label</a>
  <a href="${u("wishlist/")}">Wishlist</a>
  <button class="mnav-cur" type="button" data-open-login>My account / Sign in</button>
  <a href="${u("blog/")}">Blog</a>
  <a href="${u("about/")}">Our Story</a>
  <a href="${u("contact/")}">Contact</a>
  ${intlOn ? `<button class="mnav-cur" type="button" data-cur>Currency: <span class="cur-inr">₹ INR (India)</span><span class="cur-usd">$ USD (Worldwide)</span> · change</button>` : ""}
  ${waNumber ? `<a class="mnav-wa" href="${esc(waLink(`Hi ${brand}! I have a question.`))}" target="_blank" rel="noopener">${I.wa} WhatsApp ${esc(S.phone || "")}</a>` : ""}
  ${socials.length ? `<div class="mnav-social">${socials.map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${socialIcon(x.name)}${esc(x.name)}</a>`).join("")}</div>` : ""}
</nav>
<aside class="drawer" id="cart" aria-label="Shopping bag" aria-hidden="true">
  <div class="drawer-head"><h2>Your Bag</h2><button class="icon-btn" aria-label="Close bag" data-close-cart>${I.close}</button></div>
  <div class="ship-bar" data-ship-bar hidden><p data-ship-text></p><div class="ship-track"><span data-ship-fill></span></div></div>
  <div class="drawer-body" data-cart-items><p class="empty">Your bag is empty.</p></div>
  <div class="drawer-foot" data-cart-foot hidden>
    <div class="row"><span>Subtotal</span><strong data-cart-subtotal>₹0</strong></div>
    ${num(S.prepaid_discount_percent) ? `<p class="hint cur-inr">Extra ${num(S.prepaid_discount_percent)}% off on online payment at checkout</p>` : ""}
    ${intlOn && S.intl_duty_note ? `<p class="hint cur-usd">${esc(S.intl_duty_note)}</p>` : ""}
    <a class="btn btn-block" href="${u("checkout/")}">Checkout</a>
  </div>
</aside>
<main id="main">
${body}
</main>
${noindex || ["home", "pdp"].includes(bodyClass) ? "" : reelsHtml()}
${["home", "pdp", "checkout-page"].includes(bodyClass) ? "" : `<section class="usp">
  <div class="wrap usp-grid">
    <div>${I.needle}<strong>Made in Jaipur</strong><span>Designed and stitched by our own team</span></div>
    <div>${I.shield}<strong>Secure prepaid payments</strong><span class="cur-inr">UPI, cards & netbanking via Razorpay</span>${intlOn ? `<span class="cur-usd">PayPal & international cards</span>` : ""}</div>
    <div>${intlOn ? I.globe : I.truck}<strong>${intlOn ? "Ships worldwide" : "Pan-India delivery"}</strong><span>${esc(S.dispatch_note || "Ships from Jaipur")}</span></div>
    <div>${I.swap}<strong>Easy exchange</strong><span><a href="${u("returns/")}">See our return policy</a></span></div>
  </div>
</section>`}
${waNumber && bodyClass !== "checkout-page" ? `<section class="join"><div class="wrap join-row"><div><h2>New designs, first on WhatsApp</h2><p>Get new arrivals and restock alerts straight on WhatsApp. No spam.</p></div><a class="btn btn-wa" href="${esc(waLink(`Hi ${brand}! Please add me to your new arrivals updates.`))}" target="_blank" rel="noopener">${I.wa} Join on WhatsApp</a></div></section>` : ""}
${bodyClass === "checkout-page" ? `<footer class="co-foot wrap"><a href="${u("shipping/")}">Shipping</a> · <a href="${u("returns/")}">Returns</a> · <a href="${u("privacy/")}">Privacy</a> · <a href="${u("terms/")}">Terms</a><br>© ${year} ${esc(brand)}, Jaipur</footer>` : `<footer class="site-footer">
  <div class="wrap foot">
    <div class="foot-brand">
      <div class="logo${logoImg ? " has-img" : ""}">${logoMark()}</div>
      <p>${esc(S.tagline || "")}</p>
      ${socials.length ? `<p class="social">${socials.map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener me">${socialIcon(x.name)}${esc(x.name)}</a>`).join("")}</p>` : ""}
    </div>
    <div><h3>Shop</h3><a href="${u("shop/")}">Shop All</a>${categories.map((c) => `<a href="${u(c.url)}">${esc(c.plural)}</a>`).join("")}</div>
    <div><h3>Help</h3><a href="${u("blog/")}">Blog</a><a href="${u("contact/")}">Contact Us</a><a href="${u("wholesale/")}">Wholesale & Private Label</a><a href="${u("shipping/")}">Shipping Policy (India)</a><a href="${u("returns/")}">Returns & Refunds (India)</a>${S.intl_shipping_policy ? `<a href="${u("international-shipping/")}">International Shipping</a>` : ""}${S.intl_return_policy ? `<a href="${u("international-returns/")}">International Returns</a>` : ""}<a href="${u("privacy/")}">Privacy Policy</a><a href="${u("terms/")}">Terms & Conditions</a></div>
    <div><h3>Contact</h3>
      ${waHi ? `<a href="${esc(waHi)}" target="_blank" rel="noopener">WhatsApp: ${esc(S.phone || "+" + waNumber)}</a>` : ""}
      ${S.email ? `<a href="mailto:${esc(S.email)}">${esc(S.email)}</a>` : ""}
      <p>${esc(S.address || "Jaipur, Rajasthan, India")}</p>
      ${markets.length ? `<h3 class="mt">Also on</h3>${markets.map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>`).join("")}` : ""}
    </div>
  </div>
  ${landings.length ? `<div class="wrap foot-seo"><h3>Popular</h3><p>${landings.map((l) => `<a href="${u(l.url)}">${esc(l.h1)}</a>`).join(" · ")}</p></div>` : ""}
  <div class="wrap copy">© ${year} ${esc(brand)}, Jaipur. All rights reserved.</div>
</footer>`}
${waHi ? `<a class="wa-float" href="${esc(waHi)}" target="_blank" rel="noopener" aria-label="Chat on WhatsApp">${I.wa}</a>` : ""}
<div class="toast" data-toast role="status" aria-live="polite"></div>
<dialog class="login-modal" data-login-modal aria-labelledby="login-h"><form class="login-box" data-login-form method="dialog" novalidate>
  <button class="icon-btn login-x" type="button" data-close-login aria-label="Close">${I.close}</button>
  <p class="eyebrow">${esc(S.login_eyebrow || "Members get it first")}</p>
  <h2 id="login-h" data-login-title>${esc(S.login_title || "Sign in for early access to sales")}</h2>
  <p class="muted small">${esc(S.login_text || "Be the first to know about festive sales, new designs and restocks. Faster checkout next time.")}</p>
  ${S.google_client_id ? `<div class="g-btn" data-google-btn></div><p class="or"><span>or</span></p>` : ""}
  <label>Name<input name="name" autocomplete="name" maxlength="80" required></label>
  <label>Mobile / WhatsApp<input name="phone" type="tel" autocomplete="tel" maxlength="18" placeholder="+91 98765 43210" required></label>
  <label>Email (optional)<input name="email" type="email" autocomplete="email" maxlength="100"></label>
  <label class="check"><input type="checkbox" name="consent" value="yes"> Send me offers and new arrivals on WhatsApp / email</label>
  <button class="btn btn-block" type="submit">Continue</button>
  <p class="muted tiny">We use your details only for your orders and the updates you choose. <a href="${u("privacy/")}">Privacy</a></p>
</form>
<div class="login-box login-done" data-login-done hidden><h2>Welcome, <span data-login-name></span>!</h2><p class="muted">You are signed in on this device. Your details will be filled at checkout.</p><button class="btn btn-ghost btn-block" type="button" data-logout>Sign out</button><button class="btn btn-block" type="button" data-close-login>Continue shopping</button></div>
</dialog>
<dialog class="search-modal" data-search-modal aria-label="Search"><div class="search-box"><div class="search-bar">${I.search}<input type="search" placeholder="Search kurtis, dresses, block print, cotton…" data-search-input aria-label="Search products" autocomplete="off"><button class="icon-btn" type="button" data-close-search aria-label="Close">${I.close}</button></div>
<div class="search-sugg">${[...categories.map((c) => c.plural), ...prints.slice(0, 4), ...fabrics.slice(0, 3)].map((x) => `<button type="button" class="pill" data-sugg="${esc(x)}">${esc(x)}</button>`).join("")}</div><div class="search-results" data-search-results></div></div></dialog>
<nav class="bnav" aria-label="Quick links"><a href="${u()}">${I.home}<span>Home</span></a><a href="${u("shop/")}">${I.grid}<span>Shop</span></a><button type="button" data-open-search>${I.search}<span>Search</span></button><a href="${u("wishlist/")}">${I.heart}<span>Wishlist</span><i class="bag-count" data-wish-count hidden>0</i></a><button type="button" data-open-cart>${I.bag}<span>Bag</span><i class="bag-count" data-bag-count hidden>0</i></button></nav>
${mini && !noindex && (bodyClass === "home" || bodyClass === "pdp") ? `<div class="mini-reel" data-mini><button class="mini-x" type="button" data-mini-close aria-label="Close video">×</button><button class="mini-play" type="button" data-mini-open aria-label="Watch video${mini.caption ? ": " + esc(mini.caption) : ""}"><video data-src="${esc(mini.video)}"${mini.cover ? ` poster="${esc(mini.cover)}"` : ""} muted loop playsinline preload="none" aria-hidden="true"></video><span class="mini-badge">${I.play} Watch</span></button></div>` : ""}
<dialog class="reel-modal" data-reel-modal aria-label="Reel"><button class="icon-btn reel-x" data-reel-close aria-label="Close">${I.close}</button><div class="reel-stage" data-reel-stage></div></dialog>
<script>window.BK=${JSON.stringify({ base: BASE, wa: waNumber, brand, email: S.email || "", intl: intlOn, sheet: /^https:\/\/script\.google\.com\//.test(String(S.customer_sheet_url || "").trim()) ? String(S.customer_sheet_url).trim() : "", gid: String(S.google_client_id || "").trim(), popup: S.login_popup !== false, ship: { dispatch: num(S.dispatch_days) || 3, min: num(S.transit_days_min) || 3, max: num(S.transit_days_max) || 7, local: num(S.transit_days_local) || 2, intlMin: num(S.intl_eta_min) || 7, intlMax: num(S.intl_eta_max) || 12 }, reels: reels.length ? reelData() : [], mini: mini || null }).replace(/</g, "\\u003c")};</script>
<script src="${u("assets/app.js")}?v=${ASSET_V}" defer></script>
</body>
</html>`;
}

const inrPrice = (p, cls = "") => {
  if (p.price === null) return `<span class="price ask ${cls}">Price on request</span>`;
  const off = offPct(p);
  return `<span class="price ${cls}">${inr(p.price)}</span>${off ? `<s class="mrp">${inr(p.mrp)}</s><span class="off">${off}% OFF</span>` : ""}`;
};
const usdPrice = (p, cls = "") => {
  if (!p.ships_abroad) return `<span class="price ask ${cls}">Ships within India only</span>`;
  if (p.price_usd === null) return `<span class="price ask ${cls}">Price on request</span>`;
  const off = offUsd(p);
  return `<span class="price ${cls}">${usd(p.price_usd)}</span>${off ? `<s class="mrp">${usd(p.mrp_usd)}</s><span class="off">${off}% OFF</span>` : ""}`;
};
// both prices are in the page; the ₹/$ switch shows one (no flicker, works without JS)
const priceHtml = (p, cls = "") => (intlOn ? `<span class="cur-inr">${inrPrice(p, cls)}</span><span class="cur-usd">${usdPrice(p, cls)}</span>` : inrPrice(p, cls));

const card = (p, i = 9) => {
  const [a, b] = p.images;
  const alt = `${p.title}${p.color && !p.title.toLowerCase().includes(p.color.toLowerCase()) ? " in " + p.color : ""} – ${brand}`;
  const off = offPct(p);
  return `<article class="card" data-cat="${esc(p.catSlug)}" data-slug="${esc(p.slug)}" data-fabric="${esc(p.fabric)}" data-print="${esc(p.print_work.join("|"))}" data-intl="${p.intl ? 1 : 0}"${intlOn && !p.intl ? " data-india-only" : ""}>
  <a href="${u(p.url)}" class="card-link">
    <div class="card-img${b ? " has-alt" : ""}">
      ${a ? `<img src="${esc(u(a))}" alt="${esc(alt)}" width="1200" height="1800" ${i < 2 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">` : ""}
      ${b ? `<img class="alt" src="${esc(u(b))}" alt="" width="1200" height="1800" loading="lazy" decoding="async">` : ""}
      <div class="tags">${p.bestseller ? `<span class="tag tag-best">★ Bestseller</span>` : ""}${off ? `<span class="tag tag-sale">-${off}%</span>` : ""}${!p.in_stock ? `<span class="tag">Made to order</span>` : ""}${p.video ? `<span class="tag tag-vid">▶ Reel</span>` : ""}</div>
    </div>
    <div class="card-body">
      <h3>${esc(p.title)}</h3>
      <div class="card-price">${priceHtml(p)}</div>
    </div>
  </a>
  <button class="wish" type="button" data-wish="${esc(p.slug)}" aria-label="Save ${esc(p.title)} to wishlist" aria-pressed="false">${I.heart}</button>
</article>`;
};

const sizeRows = (Array.isArray(S.size_chart) && S.size_chart.length ? S.size_chart : [["XS", 32, 26, 34], ["S", 34, 28, 36], ["M", 36, 30, 38], ["L", 38, 32, 40], ["XL", 40, 34, 42], ["XXL", 42, 36, 44], ["3XL", 44, 38, 46], ["4XL", 46, 40, 48], ["5XL", 48, 42, 50]].map(([size, bust, waist, hip]) => ({ size, bust, waist, hip })))
  .map((r) => ({ size: String(r.size || ""), bust: num(r.bust), waist: num(r.waist), hip: num(r.hip) })).filter((r) => r.size);
const cm = (n) => (n === null ? "–" : `${n}" <small>${Math.round(n * 2.54)} cm</small>`);
const sizeDialog = `<dialog class="size-modal" data-size-modal aria-labelledby="sz-h"><div class="size-box"><div class="drawer-head"><h2 id="sz-h">Size chart</h2><button class="icon-btn" type="button" data-close-size aria-label="Close">${I.close}</button></div>
<p class="muted">Body measurements in inches (cm). If you are between two sizes, choose the bigger one. ${esc(S.size_note || "Need help? WhatsApp us your bust and height and we will suggest a size.")}</p>
<div class="table-scroll"><table class="size-table"><thead><tr><th>Size</th><th>Bust</th><th>Waist</th><th>Hip</th></tr></thead><tbody>${sizeRows.map((r) => `<tr><th>${esc(r.size)}</th><td>${cm(r.bust)}</td><td>${cm(r.waist)}</td><td>${cm(r.hip)}</td></tr>`).join("")}</tbody></table></div>
<p class="muted small">How to measure: Bust – around the fullest part. Waist – around the natural waistline. Hip – around the fullest part of the hips.</p></div></dialog>`;
const circles = (active = "") => categories.length ? `<nav class="circles" aria-label="Categories"><div class="circles-row">
  <a class="circle${active === "shop/" ? " on" : ""}" href="${u("shop/")}"><span class="circle-img circle-all">All</span><em>Shop All</em></a>
  ${categories.map((c) => { const img = c.items.find((p) => p.images[0])?.images[0] || ""; return `<a class="circle${active === c.url ? " on" : ""}" href="${u(c.url)}"><span class="circle-img">${img ? `<img src="${esc(u(img))}" alt="" width="160" height="160" loading="lazy">` : ""}</span><em>${esc(c.plural)}</em></a>`; }).join("")}
  <a class="circle" href="${u("wholesale/")}"><span class="circle-img circle-all">B2B</span><em>Wholesale</em></a>
</div></nav>` : "";
const reviews = (Array.isArray(S.reviews) ? S.reviews : []).map((r) => ({ name: String(r?.name || "").trim(), city: String(r?.city || "").trim(), text: String(r?.text || "").trim(), rating: num(r?.rating) || 5, photo: String(r?.photo || "").trim() })).filter((r) => r.name && r.text && !/\b(test|sample|dummy)\b/i.test(r.name + " " + r.text));
const pages = [];
const add = (file, html) => pages.push([file, html]);

// ---------- home ----------
{
  const slides = (Array.isArray(S.hero_slides) ? S.hero_slides : []).map((x) => ({ image: String(x?.image || x?.image_desktop || "").trim(), wide: String(x?.image_desktop || "").trim(), title: String(x?.title || "").trim(), subtitle: String(x?.subtitle || "").trim(), link: String(x?.link || "").trim(), button: String(x?.button || "").trim(), eyebrow: String(x?.eyebrow || "").trim() })).filter((x) => x.image);
  if (!slides.length) {
    slides.push({ image: S.hero_image || "images/site/hero.jpg", wide: String(S.hero_image_desktop || "").trim() || (S.hero_image === "/images/site/hero-teal.jpg" ? siteFile("hero-wide.jpg") : ""), title: S.hero_title || brand, subtitle: S.hero_subtitle || S.tagline || "" });
    // ready-made promo banners until real ones are added in admin (Settings → होमपेज बैनर स्लाइड)
    const sf = (n) => siteFile("slides/" + n);
    if (sf("slide-festive-wide.jpg")) {
      slides.push({ image: sf("slide-festive-tall.jpg"), wide: sf("slide-festive-wide.jpg"), eyebrow: "Festive Edit 2026", title: "Festive & Wedding Season Collection", subtitle: "Block print kurta sets, Anarkalis and co-ords for every celebration", button: "Shop festive", link: "shop/" });
      slides.push({ image: sf("slide-indigo-tall.jpg"), wide: sf("slide-indigo-wide.jpg"), eyebrow: "Just in", title: "New Arrivals Every Week", subtitle: "Fresh hand block prints from our Sanganer workshop", button: "See what's new", link: "shop/" });
      slides.push({ image: sf("slide-mustard-tall.jpg"), wide: sf("slide-mustard-wide.jpg"), eyebrow: "For boutiques & brands", title: "Wholesale & Private Label", subtitle: "Your brand, made in Jaipur. Low minimums for new boutiques", button: "Wholesale enquiry", link: "wholesale/" });
      if (intlOn) slides.push({ image: sf("slide-sand-tall.jpg"), wide: sf("slide-sand-wide.jpg"), eyebrow: "From Jaipur to the world", title: "We Ship Worldwide", subtitle: "USA · UK · Canada · Australia · UAE and more, prepaid in USD", button: "Shop now", link: "shop/" });
    }
  }
  const featured = products.filter((p) => p.featured);
  const list = (featured.length ? featured : products).slice(0, 8);
  const tiles = categories.map((c) => `<a class="tile" href="${u(c.url)}"><img src="${esc(u(c.items[0]?.images[1] || c.items[0]?.images[0] || ""))}" alt="${esc(c.plural)} by ${esc(brand)}" width="1200" height="1800" loading="lazy"><span>${esc(c.plural)}<em>Shop now →</em></span></a>`).join("");
  const body = `
${circles()}
${festNext ? `<div class="fest" data-fest data-in="${esc(festNext.order_by_in)}" data-us="${esc(festNext.order_by_intl)}"><div class="wrap fest-row"><span class="fest-name">${esc(festNext.name)} · ${esc(festNext.dateText)}</span><span class="fest-cut"><span class="cur-inr">Order by <b>${esc(festNext.order_by_in_text)}</b> for delivery in India</span>${intlOn ? `<span class="cur-usd">Order by <b>${esc(festNext.order_by_intl_text)}</b> for delivery abroad</span>` : ""} <span class="fest-left" data-fest-left></span></span><a class="link" href="${u(festNext.link || "shop/")}">Shop →</a></div></div>` : ""}
<section class="hero-wrap" aria-label="Featured" data-hero>
<div class="hero-track" data-hero-track>
${slides.map((sl, i) => `<div class="hero hero-slide${sl.wide ? " hero-full" : ""}${i === 0 ? " on" : ""}"${i ? ' aria-hidden="true" inert' : ""}>
  <div class="hero-media">${sl.wide ? `<picture><source media="(min-width: 901px)" srcset="${esc(u(sl.wide))}"><img src="${esc(u(sl.image))}" alt="${esc(sl.title || brand)} – ${esc(brand)}, Jaipur" width="1200" height="1800" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'}></picture>` : `<img src="${esc(u(sl.image))}" alt="${esc(sl.title || brand)} – ${esc(brand)}, Jaipur" width="1200" height="1800" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'}>`}</div>
  <div class="hero-text">
    <p class="eyebrow">${esc(sl.eyebrow || "New collection · Made in Jaipur")}</p>
    ${i === 0 ? `<h1>${esc(sl.title || brand)}</h1>` : `<h2 class="h1">${esc(sl.title || brand)}</h2>`}
    <p class="lead">${esc(sl.subtitle || "")}</p>
    <div class="hero-cta"><a class="btn" href="${u(sl.link || "shop/")}">${esc(sl.button || "Shop the collection")}</a>${i === 0 && categories[0] ? `<a class="btn btn-ghost" href="${u(categories[0].url)}">${esc(categories[0].plural)}</a>` : ""}</div>
  </div>
</div>`).join("")}
</div>
${slides.length > 1 ? `<button class="hero-arrow prev" type="button" data-hero-step="-1" aria-label="Previous banner">‹</button><button class="hero-arrow next" type="button" data-hero-step="1" aria-label="Next banner">›</button>` : ""}
${slides.length > 1 ? `<div class="hero-dots">${slides.map((_, i) => `<button type="button" data-hero-go="${i}" aria-label="Slide ${i + 1}"${i === 0 ? ' class="on"' : ""}></button>`).join("")}</div>` : ""}
</section>
<section class="trust" aria-label="Why shop with us">
  <div class="wrap trust-row">
    <div>${I.needle}<span><strong>Handmade in Jaipur</strong>Hand block prints by our own karigars</span></div>
    <div>${intlOn ? I.globe : I.truck}<span><strong>${intlOn ? "Ships worldwide" : "Pan-India delivery"}</strong>${esc(S.dispatch_note || "Dispatched from Sanganer, Jaipur")}</span></div>
    <div>${I.shield}<span><strong>100% secure prepaid</strong><span class="cur-inr">UPI · Cards · Netbanking</span>${intlOn ? `<span class="cur-usd">PayPal · International cards</span>` : ""}</span></div>
    <div>${I.box}<span><strong>Wholesale & private label</strong><a href="${u("wholesale/")}">Bulk orders for boutiques →</a></span></div>
  </div>
</section>
${reelsHtml()}
${(() => { const best = products.filter((p) => p.bestseller).slice(0, 8); return best.length >= 4 ? `<section class="wrap section best"><div class="section-head"><div><p class="eyebrow">Most loved</p><h2>Bestsellers</h2></div><a class="link" href="${u("bestsellers/")}">View all →</a></div><div class="grid scroller">${best.map((p) => card(p)).join("")}</div></section>` : ""; })()}
<section class="wrap section">
  <div class="section-head"><div><p class="eyebrow">Just in</p><h2>New Arrivals</h2></div><a class="link" href="${u("shop/")}">View all →</a></div>
  <div class="grid scroller">${list.map((p) => card(p)).join("")}</div>
</section>
${(() => { const lim = num(S.budget_price) || 999; const cheap = products.filter((p) => p.price !== null && p.price <= lim).slice(0, 8); return cheap.length >= 3 ? `<section class="wrap section budget"><div class="section-head"><div><p class="eyebrow">Everyday picks</p><h2>${intlOn ? `<span class="cur-inr">Under ${inr(lim)}</span><span class="cur-usd">Everyday Picks</span>` : `Under ${inr(lim)}`}</h2></div><a class="link" href="${u("shop/")}">View all →</a></div><div class="grid scroller">${cheap.map((p) => card(p)).join("")}</div></section>` : ""; })()}
${fabrics.length > 1 || prints.length > 1 || occasions.length ? `<section class="shopby"><div class="wrap">
  ${occasions.length ? `<div class="shopby-row"><p class="eyebrow">Shop by occasion</p><div class="pills">${occasions.map((o) => `<a class="pill" href="${u("occasion/" + slugify(o) + "/")}">${esc(o)}</a>`).join("")}</div></div>` : ""}
  ${prints.length > 1 ? `<div class="shopby-row"><p class="eyebrow">Shop by print</p><div class="pills">${prints.map((x) => `<a class="pill" href="${u(qs("print", x))}">${esc(x)}</a>`).join("")}</div></div>` : ""}
  ${fabrics.length > 1 ? `<div class="shopby-row"><p class="eyebrow">Shop by fabric</p><div class="pills">${fabrics.map((x) => `<a class="pill" href="${u(qs("fabric", x))}">${esc(x)}</a>`).join("")}</div></div>` : ""}
</div></section>` : ""}
<section class="b2b">
  <div class="wrap b2b-grid">
    <div>
      <p class="eyebrow">For boutiques, brands & importers</p>
      <h2>Wholesale · Private Label · Export</h2>
      <p>Buy directly from our workshop in Sanganer, Jaipur. Your brand label, your designs or ours, low minimums for new boutiques, and photos and videos before every dispatch.</p>
      <div class="hero-cta"><a class="btn btn-light" href="${u("wholesale/")}">Wholesale enquiry</a>${waNumber ? `<a class="btn btn-wa" href="${esc(waLink(`Hi ${brand}! I am interested in wholesale / private label.`))}" target="_blank" rel="noopener">${I.wa} WhatsApp</a>` : ""}</div>
    </div>
    <ul class="b2b-list"><li>${I.box}<span><strong>Wholesale</strong>Kurtis, sets, dresses & co-ords in bulk</span></li><li>${I.tag}<span><strong>Private label</strong>Your brand name, tags & packaging</span></li><li>${I.globe}<span><strong>Export</strong>USA, UK, Europe, Australia & Middle East</span></li></ul>
  </div>
</section>
${reviews.length >= 3 ? `<section class="wrap section reviews"><div class="section-head center"><p class="eyebrow">Loved by our customers</p><h2>Reviews</h2></div><div class="rev-row">${reviews.map((r) => `<figure class="rev">${r.photo ? `<img src="${esc(u(r.photo))}" alt="" width="400" height="500" loading="lazy">` : ""}<blockquote>${star(r.rating)}<p>${esc(r.text)}</p></blockquote><figcaption>${esc(r.name)}${r.city ? ` · ${esc(r.city)}` : ""}</figcaption></figure>`).join("")}</div></section>` : ""}
<section class="wrap section recent" data-recent hidden><div class="section-head"><div><p class="eyebrow">Picked up where you left</p><h2>Recently viewed</h2></div></div><div class="grid" data-recent-grid></div></section>
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
    description: clip(`Shop ${categories.map((c) => c.plural.toLowerCase()).join(" & ")} for women by ${brand}, Jaipur. ${S.tagline || ""}. Secure prepaid payment${intlOn ? ", shipping worldwide" : " and pan-India delivery"}.`),
    pathname: "", body, bodyClass: "home",
    ld: [{ "@context": "https://schema.org", "@type": "WebSite", name: brand, url: SITE_URL + "/" }],
  }));
}

// ---------- listing pages ----------
function listing({ file, pathname, h1, intro, items, title, description, crumbs, seo = "" }) {
  const body = `
<section class="wrap section">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="${u()}">Home</a> / ${crumbs}</nav>
  <div class="list-head"><h1>${esc(h1)}</h1><p class="muted">${esc(intro)}</p></div>
  ${circles(pathname)}
  <div class="chips">

    ${(() => { const fs_ = uniq(items.map((p) => p.fabric).filter((f) => f && f !== "Other")); const ps = uniq(items.flatMap((p) => p.print_work));
      return `${ps.length > 1 ? `<label class="sort">Print <select data-filter="print"><option value="">All</option>${ps.map((x) => `<option>${esc(x)}</option>`).join("")}</select></label>` : ""}${fs_.length > 1 ? `<label class="sort">Fabric <select data-filter="fabric"><option value="">All</option>${fs_.map((x) => `<option>${esc(x)}</option>`).join("")}</select></label>` : ""}`; })()}
    <label class="sort">Sort <select data-sort><option value="">Featured</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select></label>
  </div>
  <p class="filter-empty muted" data-filter-empty hidden>No styles match this filter. <button class="link" type="button" data-filter-clear>Show all</button></p>
  <div class="grid" data-grid>${items.map((p, i) => card(p, i).replace('<article class="card"', `<article class="card" data-price="${p.price ?? ""}" data-usd="${p.intl ? p.price_usd : ""}" data-i="${i}"`)).join("")}</div>
  ${seo ? `<div class="seo-text">${paras(seo)}<p><a class="link" href="${u("wholesale/")}">Wholesale & private label →</a></p></div>` : ""}
</section>`;
  add(file, page({
    title, description, pathname, body, image: items[0]?.images[0],
    ld: [crumbLd([[h1, pathname]]), { "@context": "https://schema.org", "@type": "CollectionPage", name: h1, url: SITE_URL + "/" + pathname,
      mainEntity: { "@type": "ItemList", itemListElement: items.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: SITE_URL + "/" + p.url, name: p.title })) } }],
  }));
}
listing({ file: "shop/index.html", pathname: "shop/", h1: "Shop All", intro: `${products.length} styles, made in Jaipur`, items: products, crumbs: "<span>Shop All</span>",
  title: `Shop Women's Kurtis & Dresses Online | ${brand}`, description: `Browse all kurtis and dresses by ${brand}, Jaipur. Embroidered kurtis, floral dresses and more with secure online payment and pan-India delivery.` });
{ const best = products.filter((p) => p.bestseller); if (best.length) listing({ file: "bestsellers/index.html", pathname: "bestsellers/", h1: "Bestsellers", intro: `Our most loved styles, made in Jaipur`, items: best, crumbs: "<span>Bestsellers</span>",
  title: `Bestsellers – Most Loved Kurtis & Dresses | ${brand}`, description: `Shop the bestselling kurtis, kurta sets and dresses by ${brand}, Jaipur. Hand block prints loved by our customers.` }); }
for (const o of occasions) { const items = products.filter((p) => p.occasion.includes(o)); const slug = slugify(o); listing({ file: `occasion/${slug}/index.html`, pathname: `occasion/${slug}/`, h1: `${o} Wear`, intro: `${items.length} styles for ${o.toLowerCase()}, made in Jaipur`, items, crumbs: `<span>${esc(o)}</span>`, title: `${o} Kurtis & Dresses – Hand Block Print | ${brand}`, description: `Shop ${o.toLowerCase()} kurtis, kurta sets and dresses by ${brand}, Jaipur. Hand block prints, secure prepaid payment.` }); }
const catSeo = Object.fromEntries((Array.isArray(S.category_seo) ? S.category_seo : []).map((x) => [String(x?.category || "").trim(), String(x?.text || "").trim()]));
for (const c of categories) {
  const fb = uniq(c.items.map((p) => p.fabric)).slice(0, 4), pw = uniq(c.items.flatMap((p) => p.print_work)).slice(0, 4);
  c.seoText = catSeo[c.name] || `Shop ${c.plural.toLowerCase()} for women by ${brand}, made in our own unit in Sanganer, Jaipur${pw.length ? ` – ${pw.join(", ").toLowerCase()}` : ""}${fb.length ? ` in ${fb.join(", ").toLowerCase()}` : ""}. Secure prepaid payment, shipping across India${intlOn ? " and worldwide" : ""}. Boutiques and brands can also order ${c.plural.toLowerCase()} in wholesale or under their own private label.`;
  listing({ file: c.url + "index.html", pathname: c.url, h1: c.plural, intro: `${c.items.length} styles`, seo: c.seoText, items: c.items, crumbs: `<a href="${u("shop/")}">Shop</a> / <span>${esc(c.plural)}</span>`,
    title: `${c.plural} for Women – Made in Jaipur | ${brand}`, description: `Shop ${c.plural.toLowerCase()} for women by ${brand}, Jaipur. Handcrafted designs, secure online payment and pan-India delivery.` });
}

// ---------- product pages ----------
for (const p of products) {
  const look = p.match.map((m) => products.find((x) => x.slug === m)).filter((x) => x && x.slug !== p.slug).slice(0, 4);
  const related = products.filter((x) => x.slug !== p.slug && !look.includes(x)).sort((a, b) => (b.category === p.category) - (a.category === p.category)).slice(0, 4);
  const firstLine = String(p.description || "").split(/\n/)[0];
  const desc = clip(p.seo_description || `${p.title}${p.color ? " in " + p.color : ""}${p.fabric ? ", " + p.fabric : ""}. ${firstLine}`);
  const cat = categories.find((c) => c.name === p.category);
  const waAsk = waLink(`Hi ${brand}! I have a question about: ${p.title}\n${SITE_URL}/${p.url}`);
  const disc = num(S.prepaid_discount_percent);
  const gal = p.images.map((img) => ({ img }));
  if (p.video) gal.splice(Math.min(1, gal.length), 0, { video: p.video });
  const body = `
<nav class="wrap crumbs" aria-label="Breadcrumb"><a href="${u()}">Home</a> / <a href="${u(cat.url)}">${esc(cat.plural)}</a> / <span>${esc(p.title)}</span></nav>
<section class="wrap product" data-product="${esc(p.slug)}" data-price="${p.price ?? ""}" data-usd="${p.price_usd ?? ""}" data-intl="${p.intl ? 1 : 0}">
  <div class="gallery">
    <div class="slides" data-slides>
      ${gal.map((m, i) => m.video
        ? `<figure class="slide slide-video"><video src="${esc(u(m.video))}"${p.images[0] ? ` poster="${esc(u(p.images[0]))}"` : ""} muted loop playsinline preload="none" data-pvideo aria-label="${esc(p.title)} – video"></video><span class="vid-badge" aria-hidden="true">▶ Reel</span></figure>`
        : `<figure class="slide"><img src="${esc(u(m.img))}" alt="${esc(p.title)} – photo ${i + 1}" width="1200" height="1800" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></figure>`).join("")}
    </div>
    ${gal.length > 1 ? `<div class="dots" data-dots>${gal.map((_, i) => `<button aria-label="Slide ${i + 1}"${i === 0 ? ' class="on"' : ""}></button>`).join("")}</div>
    <div class="thumbs">${gal.map((m, i) => `<button class="thumb${i === 0 ? " on" : ""}${m.video ? " thumb-video" : ""}" data-go="${i}" aria-label="${m.video ? "Video" : "Photo " + (i + 1)}"><img src="${esc(u(m.video ? (p.images[0] || "") : m.img))}" alt="" width="120" height="180" loading="lazy"></button>`).join("")}</div>` : ""}
  </div>
  <div class="buybox">
    <p class="eyebrow">${esc(p.category)}${p.color ? " · " + esc(p.color) : ""}</p>
    <div class="title-row"><h1>${esc(p.title)}</h1><button class="wish wish-lg" type="button" data-wish="${esc(p.slug)}" aria-label="Save to wishlist" aria-pressed="false">${I.heart}</button></div>
    <div class="pdp-price">${priceHtml(p)}</div>
    ${p.model_height || p.model_size || p.fit ? `<p class="fit-line">${[p.model_height ? `Model is ${esc(p.model_height)}` : "", p.model_size ? `wearing ${esc(p.model_size)}` : "", p.fit ? `${esc(p.fit)} fit` : ""].filter(Boolean).join(" · ")}</p>` : ""}
    ${p.price !== null ? `<p class="tax cur-inr">Inclusive of all taxes${disc ? ` · <strong>Extra ${disc}% off</strong> on online payment` : ""}</p>` : ""}
    ${intlOn && p.intl ? `<p class="tax cur-usd">${esc(S.intl_duty_note || "Prices exclude import duties and taxes of your country.")}</p>` : ""}
    ${p.sizes.length ? `<div class="sizes"><div class="label">Select size <span data-size-error role="alert" hidden>Please select a size</span><button class="size-guide" type="button" data-open-size>${I.ruler} Size chart</button></div><div class="size-row" role="group" aria-label="Select size">${p.sizes.map((s) => `<button class="size${p.sold_out.includes(s) ? " out" : ""}" type="button" data-size="${esc(s)}" aria-pressed="false"${p.sold_out.includes(s) ? ' data-out="1" aria-label="' + esc(s) + ' – sold out, notify me"' : ""}>${esc(s)}</button>`).join("")}</div></div>` : ""}
    ${p.price !== null ? `<div class="buy-row"><button class="btn btn-block" data-add>Add to Bag</button><button class="btn btn-dark btn-block" data-buy>Buy Now</button></div>`
      : `<a class="btn btn-wa btn-block" href="${esc(waAsk)}" target="_blank" rel="noopener">${I.wa} Ask price on WhatsApp</a>`}
    ${intlOn && !p.intl && waNumber ? `<div class="intl-ask cur-usd"><p>${p.ships_abroad ? "International price for this style is shared on request." : "This style currently ships within India only."} Message us for availability and similar styles that ship to your country.</p><a class="btn btn-wa btn-block" href="${esc(waLink(`Hi ${brand}! I am outside India. Can you ship this to my country?\n${p.title}\n${SITE_URL}/${p.url}`))}" target="_blank" rel="noopener">${I.wa} Ask on WhatsApp</a></div>` : ""}
    ${waAsk && p.price !== null ? `<a class="ask-wa" href="${esc(waAsk)}" target="_blank" rel="noopener">${I.wa} Questions? Chat with us on WhatsApp</a>` : ""}
    <div class="deliv" data-deliv><form class="pin-check" data-pin-form><label class="cur-inr" for="pin-${esc(p.slug)}">Check delivery date</label>${intlOn ? `<label class="cur-usd" for="pin-${esc(p.slug)}">Delivery to your country</label>` : ""}<div class="pin-row"><input id="pin-${esc(p.slug)}" name="pin" inputmode="numeric" maxlength="6" autocomplete="postal-code" placeholder="Enter pincode" data-pin><button class="btn btn-ghost" type="submit">Check</button></div></form><p class="deliv-out" data-deliv-out aria-live="polite"></p></div>
    <div class="share-row"><button class="share-btn" type="button" data-share>${I.wa} Ask family</button><a class="share-btn" href="https://www.pinterest.com/pin/create/button/?url=${encodeURIComponent(SITE_URL + "/" + p.url)}&media=${encodeURIComponent(abs(p.images[0] || ""))}&description=${encodeURIComponent(p.title + " – " + brand)}" target="_blank" rel="noopener">${socialIcon("pinterest")} Save</a><button class="share-btn" type="button" data-copy-link>${I.tag} Copy link</button></div>
    <ul class="perks"><li>${I.truck}${esc(S.dispatch_note || "Ships from Jaipur")}</li>${p.ships_abroad && intlOn ? `<li>${I.globe}Ships worldwide · <a href="${u(S.intl_shipping_policy ? "international-shipping/" : "shipping/")}">delivery times</a></li>` : ""}<li>${I.shield}Secure prepaid payment</li><li>${I.swap}<a href="${u("returns/")}">Easy exchange policy</a></li></ul>
    <details open><summary>Description</summary><div>${paras(p.description) || "<p>Handcrafted in Jaipur.</p>"}</div></details>
    <details><summary>Product details</summary><dl class="specs">
      ${p.color ? `<dt>Colour</dt><dd>${esc(p.color)}</dd>` : ""}${p.fabric ? `<dt>Fabric</dt><dd>${esc(p.fabric)}</dd>` : ""}${p.print_work.length ? `<dt>Print / work</dt><dd>${esc(p.print_work.join(", "))}</dd>` : ""}
      ${p.sizes.length ? `<dt>Sizes</dt><dd>${esc(p.sizes.join(", "))}</dd>` : ""}<dt>Made in</dt><dd>Jaipur, India</dd><dt>Status</dt><dd>${p.in_stock ? "In stock" : "Made to order"}</dd>
    </dl></details>
    <details><summary>Shipping & returns</summary><div>${paras(String(S.shipping_policy || "").split(/\n\s*\n/)[1] || S.dispatch_note)}<p><a href="${u("shipping/")}">Shipping (India)</a> · <a href="${u("returns/")}">Returns (India)</a>${S.intl_shipping_policy ? ` · <a href="${u("international-shipping/")}">International shipping</a>` : ""}${S.intl_return_policy ? ` · <a href="${u("international-returns/")}">International returns</a>` : ""}</p></div></details>
  </div>
</section>
${p.price !== null ? `<div class="sticky-buy" data-sticky><div><strong>${intlOn ? `<span class="cur-inr">${inr(p.price)}</span><span class="cur-usd">${p.intl ? usd(p.price_usd) : ""}</span>` : inr(p.price)}</strong><span>${esc(p.title)}</span></div><button class="btn" data-add>Add to Bag</button></div>` : ""}
${look.length ? `<section class="wrap section look"><div class="section-head"><div><p class="eyebrow">Shop the look</p><h2>Complete the look</h2></div>${look.some((x) => x.price !== null) ? `<button class="btn btn-ghost" type="button" data-add-look="${esc([p.slug, ...look.filter((x) => x.price !== null).map((x) => x.slug)].join(","))}">Add complete look</button>` : ""}</div><div class="grid">${look.map((p) => card(p)).join("")}</div></section>` : ""}
${p.sizes.length ? sizeDialog : ""}
${related.length ? `<section class="wrap section"><div class="section-head"><h2>You may also like</h2></div><div class="grid">${related.map((p) => card(p)).join("")}</div></section>` : ""}
<section class="wrap section recent" data-recent hidden><div class="section-head"><h2>Recently viewed</h2></div><div class="grid" data-recent-grid></div></section>`;
  const ld = {
    "@context": "https://schema.org", "@type": "Product", name: p.title, image: p.images.map(abs), description: String(p.description || "").replace(/\s+/g, " ").trim() || p.title,
    sku: p.slug, brand: { "@type": "Brand", name: brand }, category: p.category, color: p.color || undefined, material: p.fabric || undefined,
    ...(p.price !== null ? { offers: { "@type": "Offer", url: SITE_URL + "/" + p.url, priceCurrency: "INR", price: String(p.price), availability: p.in_stock ? "https://schema.org/InStock" : "https://schema.org/PreOrder", itemCondition: "https://schema.org/NewCondition", seller: { "@id": SITE_URL + "/#store" }, priceValidUntil: `${year + 1}-12-31`,
      shippingDetails: { "@type": "OfferShippingDetails", shippingRate: { "@type": "MonetaryAmount", value: String(p.price >= (num(S.free_shipping_above) || Infinity) ? 0 : num(S.shipping_charge) || 0), currency: "INR" }, shippingDestination: { "@type": "DefinedRegion", addressCountry: "IN" },
        deliveryTime: { "@type": "ShippingDeliveryTime", handlingTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: num(S.dispatch_days) || 3, unitCode: "DAY" }, transitTime: { "@type": "QuantitativeValue", minValue: 2, maxValue: num(S.transit_days_max) || 7, unitCode: "DAY" } } },
      hasMerchantReturnPolicy: { "@type": "MerchantReturnPolicy", applicableCountry: "IN", returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow", merchantReturnDays: num(S.return_days) || 7, returnMethod: "https://schema.org/ReturnByMail" } } } : {}),
  };
  const crumbs = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL + "/" },
    { "@type": "ListItem", position: 2, name: cat.plural, item: SITE_URL + "/" + cat.url },
    { "@type": "ListItem", position: 3, name: p.title, item: SITE_URL + "/" + p.url }] };
  const myReel = reels.find((r) => r.product === p.slug && r.video);
  const pmini = myReel || p.video ? { video: u(myReel ? myReel.video : p.video), cover: myReel?.cover ? u(myReel.cover) : u(p.images[0] || ""), caption: myReel?.caption || "See it on", product: { title: p.title, url: u(p.url), image: u(p.images[0] || ""), price: priceHtml(p) } } : defaultMini();
  const ogP = p.price !== null ? `<meta property="product:price:amount" content="${p.price}"><meta property="product:price:currency" content="INR"><meta property="product:availability" content="${p.in_stock ? "in stock" : "preorder"}"><meta property="product:brand" content="${esc(brand)}">` : "";
  add(p.url + "index.html", page({ og: ogP, mini: pmini, title: p.seo_title || `${p.title} | ${brand}`, description: desc, pathname: p.url, image: p.images[0], body, ld: p.price !== null ? [ld, crumbs] : [crumbs], type: "product", bodyClass: "pdp" }));
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
        <label><span class="cur-inr">Mobile number</span><span class="cur-usd">Phone / WhatsApp (with country code)</span><input name="phone" type="tel" inputmode="tel" autocomplete="tel" required maxlength="18" placeholder="10-digit mobile" data-phone></label>
      </div>
      <label>Email (for order updates<span class="cur-usd"> and PayPal invoice</span>)<input name="email" type="email" autocomplete="email" maxlength="100" data-email></label>
      ${intlOn ? `<label class="cur-usd">Country<input name="country" autocomplete="country-name" maxlength="60" list="countries" data-country></label>
      <datalist id="countries">${["United States","United Kingdom","Canada","Australia","New Zealand","United Arab Emirates","Saudi Arabia","Qatar","Kuwait","Oman","Bahrain","Singapore","Malaysia","Germany","France","Netherlands","Italy","Spain","Ireland","Switzerland","Sweden","Norway","Denmark","Belgium","Austria","South Africa","Mauritius","Fiji","Japan","Hong Kong"].map((c) => `<option value="${c}">`).join("")}</datalist>` : ""}
      <label>House no., building, street, area<textarea name="address" autocomplete="street-address" required rows="2" maxlength="200"></textarea></label>
      <div class="f3">
        <label><span class="cur-inr">Pincode</span><span class="cur-usd">ZIP / Postal code</span><input name="pincode" autocomplete="postal-code" required maxlength="12" data-pin></label>
        <label>City<input name="city" autocomplete="address-level2" required maxlength="60"></label>
        <label><span class="cur-inr">State</span><span class="cur-usd">State / Province</span><input name="state" autocomplete="address-level1" maxlength="40" list="states" data-state></label>
      </div>
      <datalist id="states">${["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Delhi","Jammu and Kashmir","Ladakh","Chandigarh","Puducherry"].map((s) => `<option value="${s}">`).join("")}</datalist>
      <details class="gift"><summary>🎁 This is a gift</summary><div class="gift-body"><label>Recipient name<input name="gift_to" maxlength="60"></label><label>Gift message (printed on a card)<textarea name="gift_msg" rows="2" maxlength="150"></textarea></label><label class="check"><input type="checkbox" name="gift_hide" value="yes"> Do not put the price in the parcel</label><p class="muted small">Enter the recipient's address above as the delivery address.</p></div></details>
      <label class="check"><input type="checkbox" name="consent" value="yes" data-co-consent> Send me offers and new arrivals on WhatsApp / email</label>
      <h2>Payment</h2>
      <div class="pay-opts" data-pay-opts><p class="muted">Loading payment options…</p></div>
      <p class="form-error" data-co-error hidden></p>
      <button class="btn btn-block btn-lg" type="submit" data-place disabled>Place order</button>
      ${intlOn ? `<p class="secure cur-usd">${I.shield} International orders are prepaid in USD through a secure PayPal invoice (cards accepted). We ship after payment.</p>` : ""}
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
  add(file, page({ title, description, pathname, ld: [crumbLd([[h1, pathname]])], body: `<section class="wrap section prose"><nav class="crumbs" aria-label="Breadcrumb"><a href="${u()}">Home</a> / <span>${esc(h1)}</span></nav><h1>${esc(h1)}</h1>${html}</section>` }));
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
infoPage("about/index.html", "about/", `Our Story – ${brand}, Jaipur`, S.about_title || "Our Story", paras(S.about_text) + `<h2>Get in touch</h2>` + contactHtml, clip(`${brand} is a Jaipur label making kurtis and dresses for women. ${S.tagline || ""}`));
infoPage("contact/index.html", "contact/", `Contact Us | ${brand}`, "Contact Us", contactHtml, `Contact ${brand}, Jaipur for orders, sizes, custom requests and bulk enquiries. Chat with us on WhatsApp${S.email ? " or write to us by email" : ""}.`);
infoPage("shipping/index.html", "shipping/", `Shipping Policy | ${brand}`, "Shipping Policy", paras(S.shipping_policy), `Shipping policy of ${brand}: dispatch time from Jaipur, delivery time across India, tracking details and made-to-order timelines.`);
infoPage("returns/index.html", "returns/", `Returns, Exchange & Refund Policy | ${brand}`, "Returns, Exchange & Refunds", paras(S.return_policy), `Return, exchange and refund policy of ${brand}: how to request an exchange, eligible products and refund timelines for online payments.`);
infoPage("privacy/index.html", "privacy/", `Privacy Policy | ${brand}`, "Privacy Policy", paras(S.privacy_policy), `Privacy policy of ${brand}: what details we collect for your order, how we use them, secure payments via Razorpay and how to delete your data.`);
infoPage("terms/index.html", "terms/", `Terms & Conditions | ${brand}`, "Terms & Conditions", paras(S.terms), `Terms and conditions for shopping on the ${brand} website: orders, pricing, payments, cancellations and governing law.`);

if (S.intl_shipping_policy) infoPage("international-shipping/index.html", "international-shipping/", `International Shipping Policy | ${brand}`, "International Shipping", paras(S.intl_shipping_policy), `International shipping policy of ${brand}, Jaipur: countries we ship to, delivery times, charges in USD and import duties.`);
if (S.intl_return_policy) infoPage("international-returns/index.html", "international-returns/", `International Returns & Refunds | ${brand}`, "International Returns & Refunds", paras(S.intl_return_policy), `Return and refund policy for international orders from ${brand}, Jaipur.`);

// ---------- wishlist (filled by the browser) ----------
add("wishlist/index.html", page({ title: `Wishlist | ${brand}`, description: "Your saved styles", pathname: "wishlist/", noindex: true,
  body: `<section class="wrap section"><nav class="crumbs" aria-label="Breadcrumb"><a href="${u()}">Home</a> / <span>Wishlist</span></nav><div class="list-head"><h1>Your Wishlist</h1><p class="muted">Styles you saved with ${I.heart.replace('width="20" height="20"', 'width="16" height="16"')} are kept on this device.</p></div><p class="empty" data-wish-empty>No saved styles yet. <a class="link" href="${u("shop/")}">Start shopping →</a></p><div class="grid" data-wish-grid></div></section>` }));

// ---------- wholesale / private label / export (B2B) ----------
{
  const cats = categories.map((c) => c.plural);
  const waB2B = waLink(`Hi ${brand}! I am interested in wholesale / private label.`);
  const steps = [["Share your requirement", "Styles, fabric, quantity, sizes and target country on WhatsApp or email."], ["Catalogue & samples", "We share our catalogue, swatches and sample options for your selection."], ["Price & approval", "You get a written quotation. Production starts after you approve the sample."], ["Advance & production", "Advance payment confirms the order. Printing and stitching in our Jaipur unit."], ["Quality check", "Every piece is checked. You get photos and videos before dispatch."], ["Dispatch", "Shipped with GST invoice and tracking, across India and worldwide."]];
  const body = `
<section class="b2b-hero">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="${u()}">Home</a> / <span>Wholesale</span></nav>
    <p class="eyebrow">Manufacturer · Sanganer, Jaipur</p>
    <h1>Wholesale, Private Label & Export</h1>
    <p class="lead">${esc(S.wholesale_intro || `Women's ethnic wear made in our own unit in Jaipur, the home of hand block printing. For boutiques, online sellers, fashion brands and importers.`)}</p>
    <div class="hero-cta">${waB2B ? `<a class="btn btn-wa" href="${esc(waB2B)}" target="_blank" rel="noopener">${I.wa} WhatsApp enquiry</a>` : ""}<a class="btn btn-light" href="#enquiry">Send requirement</a></div>
  </div>
</section>
<section class="wrap section">
  <div class="svc">
    <article>${I.box}<h2>Wholesale</h2><p>Ready designs and running styles for boutiques, retailers and online sellers. Mixed sizes and colours per design.</p></article>
    <article>${I.tag}<h2>Private Label</h2><p>Your brand name on neck labels, tags and packaging. Produce our designs or your own tech packs and samples.</p></article>
    <article>${I.globe}<h2>Export</h2><p>Bulk and repeat orders for buyers in the USA, UK, Europe, Australia and the Middle East, with export paperwork.</p></article>
  </div>
</section>
<section class="b2b-what"><div class="wrap two-col">
  <div><p class="eyebrow">What we make</p><h2>Products</h2><ul class="tick-list">${(cats.length ? cats : ["Kurtis", "Kurta sets with dupatta", "Dresses", "Co-ord sets", "Kaftans", "Tops & tunics"]).map((c) => `<li>${esc(c)}</li>`).join("")}</ul></div>
  <div><p class="eyebrow">Prints & fabrics</p><h2>Craft</h2><ul class="tick-list">${uniq([...prints, "Hand Block Print", "Sanganeri Print", "Bagru Print", "Dabu Print"]).slice(0, 10).map((c) => `<li>${esc(c)}</li>`).join("")}${fabrics.length ? `<li>Fabrics: ${esc(fabrics.slice(0, 8).join(", "))}</li>` : `<li>Cotton, rayon, linen, georgette & more</li>`}</ul></div>
</div></section>
<section class="wrap section"><div class="section-head center"><p class="eyebrow">How it works</p><h2>From enquiry to dispatch</h2></div>
  <ol class="steps">${steps.map(([a, b]) => `<li><strong>${esc(a)}</strong><span>${esc(b)}</span></li>`).join("")}</ol>
  <div class="terms-box"><p><strong>Minimum order:</strong> ${esc(S.wholesale_moq || "Depends on the design and fabric. Small boutique orders are welcome. Ask us on WhatsApp.")}</p><p><strong>Payment:</strong> ${esc(S.wholesale_payment || "Advance payment only (bank transfer / UPI in India, PayPal or wire transfer for international buyers). No cash on delivery.")}</p><p><strong>Prices:</strong> Shared as a written quotation after we understand your requirement.</p></div>
</section>
<section class="wrap section enquiry" id="enquiry">
  <div class="section-head center"><p class="eyebrow">Get a quotation</p><h2>Send your requirement</h2><p class="muted">Fill this and tap send. It opens WhatsApp with your details ready${S.email ? `, or email us at <a class="link" href="mailto:${esc(S.email)}">${esc(S.email)}</a>` : ""}.</p></div>
  <form class="b2b-form" data-b2b-form>
    <div class="f2"><label>Your name<input name="name" required maxlength="80" autocomplete="name"></label><label>Business / brand name<input name="business" maxlength="100" autocomplete="organization"></label></div>
    <div class="f2"><label>Country<input name="country" required maxlength="60" list="countries-b2b" autocomplete="country-name"></label><label>I am a<select name="type"><option>Boutique / retailer</option><option>Online seller</option><option>Fashion brand (private label)</option><option>Importer / distributor</option><option>Other</option></select></label></div>
    <datalist id="countries-b2b"><option value="India"><option value="United States"><option value="United Kingdom"><option value="Canada"><option value="Australia"><option value="United Arab Emirates"><option value="Germany"><option value="France"><option value="Netherlands"><option value="Singapore"></datalist>
    <div class="f2"><label>Products<input name="products" maxlength="140" placeholder="e.g. cotton kurta sets, block print dresses"></label><label>Quantity (approx.)<input name="qty" maxlength="40" placeholder="e.g. 100 pcs per design"></label></div>
    <label>Details (optional)<textarea name="msg" rows="3" maxlength="600" placeholder="Sizes, colours, own label, target price, timeline…"></textarea></label>
    <button class="btn btn-wa btn-block btn-lg" type="submit">${I.wa} Send on WhatsApp</button>
  </form>
</section>`;
  add("wholesale/index.html", page({ title: `Wholesale & Private Label Kurti Manufacturer, Jaipur | ${brand}`, description: clip(`Wholesale and private label women's ethnic wear manufacturer in Sanganer, Jaipur. Hand block print kurtis, kurta sets, dresses and co-ords for boutiques, brands and importers.`), pathname: "wholesale/", body, bodyClass: "wholesale-page",
    ld: [{ "@context": "https://schema.org", "@type": "Service", serviceType: "Wholesale and private label clothing manufacturing", provider: { "@id": SITE_URL + "/#store" }, areaServed: "Worldwide", url: SITE_URL + "/wholesale/" }] }));
}

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
${b.related.length ? `<section class="wrap section"><div class="section-head"><h2>Shop this story</h2></div><div class="grid">${b.related.slice(0, b.related.length >= 4 ? 4 : Math.min(2, b.related.length)).map((p) => card(p)).join("")}</div></section>` : ""}
${more.length ? `<section class="wrap section"><div class="section-head"><h2>More from the blog</h2><a class="link" href="${u("blog/")}">All posts →</a></div><div class="posts">${more.map(postCard).join("")}</div></section>` : ""}`;
  add(b.url + "index.html", page({
    title: b.seo_title || `${b.title} | ${brand}`, description: clip(b.seo_description || b.excerpt || b.title), pathname: b.url, image: b.cover, type: "article", body,
    ld: [{ "@context": "https://schema.org", "@type": "BlogPosting", headline: b.title, description: b.excerpt || undefined, image: b.cover ? [abs(b.cover)] : undefined,
      datePublished: b.date, dateModified: b.date, author: { "@type": "Organization", name: brand }, publisher: { "@id": SITE_URL + "/#store" }, mainEntityOfPage: SITE_URL + "/" + b.url, keywords: b.tags.join(", ") || undefined },
      { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: SITE_URL + "/" }, { "@type": "ListItem", position: 2, name: "Blog", item: SITE_URL + "/blog/" }, { "@type": "ListItem", position: 3, name: b.title, item: SITE_URL + "/" + b.url }] }],
  }));
}

// ---------- SEO landing pages (content/landing/*.json) – rank for "manufacturer / wholesale" searches ----------
for (const l of landings) {
  const words = String(l.match || "").toLowerCase().split(",").map((x) => x.trim()).filter(Boolean);
  const items = (words.length ? products.filter((p) => words.some((w) => [p.title, p.category, p.fabric, p.print_work.join(" ")].join(" ").toLowerCase().includes(w))) : products).slice(0, 8);
  const waL = waLink(`Hi ${brand}! I saw your page: ${l.h1}. I want details.`);
  const body = `
<section class="b2b-hero land-hero"><div class="wrap">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="${u()}">Home</a> / <span>${esc(l.h1)}</span></nav>
  <p class="eyebrow">${esc(l.eyebrow || "Manufacturer · Sanganer, Jaipur")}</p>
  <h1>${esc(l.h1)}</h1>
  ${l.lead ? `<p class="lead">${esc(l.lead)}</p>` : ""}
  <div class="hero-cta">${waL ? `<a class="btn btn-wa" href="${esc(waL)}" target="_blank" rel="noopener">${I.wa} WhatsApp us</a>` : ""}<a class="btn btn-light" href="${u("wholesale/")}#enquiry">Get a quotation</a></div>
</div></section>
${items.length ? `<section class="wrap section"><div class="section-head"><div><p class="eyebrow">From our collection</p><h2>${esc(l.products_title || "Styles we make")}</h2></div><a class="link" href="${u("shop/")}">View all →</a></div><div class="grid">${items.map((p) => card(p)).join("")}</div></section>` : ""}
<section class="wrap section prose land-body">${md(l.body || "")}</section>
${l.faq.length ? `<section class="wrap section faq"><div class="section-head"><h2>Frequently asked questions</h2></div>${l.faq.map((x) => `<details><summary>${esc(x.q)}</summary><div>${paras(x.a)}</div></details>`).join("")}</section>` : ""}`;
  const ld = [{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: SITE_URL + "/" }, { "@type": "ListItem", position: 2, name: l.h1, item: SITE_URL + "/" + l.url }] }];
  if (l.faq.length) ld.push({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: l.faq.map((x) => ({ "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: x.a } })) });
  add(l.url + "index.html", page({ title: l.seo_title || `${l.h1} | ${brand}`, description: clip(l.seo_description || l.lead || l.h1), pathname: l.url, body, ld, image: items[0]?.images[0], bodyClass: "landing-page" }));
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
    upi_id: (S.upi_id || "").trim(), brand, whatsapp: waNumber, email: S.email || "",
    intl_shipping_charge_usd: num(S.intl_shipping_charge_usd) || 0, intl_free_shipping_above_usd: num(S.intl_free_shipping_above_usd) || 0,
  },
  products: Object.fromEntries(products.map((p) => [p.slug, { title: p.title, price: p.price, sizes: p.sizes, image: p.images[0] || "", image2: p.images[1] || "", color: p.color || "", url: p.url, in_stock: p.in_stock, cat: p.category, fabric: p.fabric, print: p.print_work.join(", "), price_usd: p.intl ? p.price_usd : null, mrp: p.mrp, mrp_usd: p.intl ? p.mrp_usd : null }])),
};
fs.mkdirSync(path.join(OUT, "data"), { recursive: true });
fs.writeFileSync(path.join(OUT, "data/catalog.json"), JSON.stringify(catalog));

// ---------- product feeds: Meta (Facebook/Instagram Shop) catalog + Google Merchant Center ----------
{
  const csv = (v) => `"${String(v ?? "").replace(/"/g, '""').replace(/\s+/g, " ").trim()}"`;
  const gcat = (c) => (/dress|gown|kaftan/i.test(c) ? "Apparel & Accessories > Clothing > Dresses" : /palazzo|pant/i.test(c) ? "Apparel & Accessories > Clothing > Pants" : /dupatta|stole/i.test(c) ? "Apparel & Accessories > Clothing Accessories > Scarves & Shawls" : /top|tunic/i.test(c) ? "Apparel & Accessories > Clothing > Shirts & Tops" : /set|co-ord/i.test(c) ? "Apparel & Accessories > Clothing > Outfit Sets" : "Apparel & Accessories > Clothing > Traditional & Ceremonial Clothing");
  const plain = (p) => String(p.description || p.title).replace(/\s+/g, " ").trim().slice(0, 4900) || p.title;
  const feedItems = products.filter((p) => p.price !== null && p.images[0]);
  const head = ["id", "title", "description", "availability", "condition", "price", "sale_price", "link", "image_link", "additional_image_link", "brand", "google_product_category", "product_type", "color", "material", "gender", "age_group"];
  const row = (p, cur) => {
    const usdMode = cur === "USD"; const pr = usdMode ? p.price_usd : p.price; const mrp = usdMode ? p.mrp_usd : p.mrp;
    const fmt = (n) => `${Number(n).toFixed(2)} ${cur}`;
    return [p.slug, p.title, plain(p), p.in_stock ? "in stock" : "preorder", "new", fmt(mrp && mrp > pr ? mrp : pr), mrp && mrp > pr ? fmt(pr) : "", `${SITE_URL}/${p.url}`, abs(p.images[0]), p.images.slice(1, 10).map(abs).join(","), brand, gcat(p.category), p.category, p.color || "", p.fabric || "", "female", "adult"].map(csv).join(",");
  };
  fs.mkdirSync(path.join(OUT, "feeds"), { recursive: true });
  fs.writeFileSync(path.join(OUT, "feeds/meta-catalog.csv"), [head.join(","), ...feedItems.map((p) => row(p, "INR"))].join("\n"));
  const intlItems = feedItems.filter((p) => p.intl);
  if (intlItems.length) fs.writeFileSync(path.join(OUT, "feeds/meta-catalog-usd.csv"), [head.join(","), ...intlItems.map((p) => row(p, "USD"))].join("\n"));
  const x = (v) => esc(String(v ?? ""));
  if (intlItems.length) fs.writeFileSync(path.join(OUT, "feeds/google-merchant-usd.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>${x(brand)} – International</title><link>${SITE_URL}/</link><description>${x(S.tagline || "")}</description>
${intlItems.map((p) => `<item><g:id>${x(p.slug)}</g:id><g:title>${x(p.title)}</g:title><g:description>${x(plain(p))}</g:description><g:link>${SITE_URL}/${p.url}</g:link><g:image_link>${x(abs(p.images[0]))}</g:image_link><g:availability>${p.in_stock ? "in_stock" : "preorder"}</g:availability><g:condition>new</g:condition><g:price>${(p.mrp_usd && p.mrp_usd > p.price_usd ? p.mrp_usd : p.price_usd).toFixed(2)} USD</g:price>${p.mrp_usd && p.mrp_usd > p.price_usd ? `<g:sale_price>${p.price_usd.toFixed(2)} USD</g:sale_price>` : ""}<g:brand>${x(brand)}</g:brand><g:identifier_exists>no</g:identifier_exists><g:google_product_category>${x(gcat(p.category))}</g:google_product_category><g:gender>female</g:gender><g:age_group>adult</g:age_group>${["US", "GB", "CA", "AU"].map((c) => `<g:shipping><g:country>${c}</g:country><g:price>${(p.price_usd >= (num(S.intl_free_shipping_above_usd) || Infinity) ? 0 : num(S.intl_shipping_charge_usd) || 0).toFixed(2)} USD</g:price></g:shipping>`).join("")}</item>`).join("\n")}
</channel></rss>`);
  fs.writeFileSync(path.join(OUT, "feeds/google-merchant.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>${x(brand)}</title><link>${SITE_URL}/</link><description>${x(S.tagline || "")}</description>
${feedItems.map((p) => `<item><g:id>${x(p.slug)}</g:id><g:title>${x(p.title)}</g:title><g:description>${x(plain(p))}</g:description><g:link>${SITE_URL}/${p.url}</g:link><g:image_link>${x(abs(p.images[0]))}</g:image_link>${p.images.slice(1, 10).map((im) => `<g:additional_image_link>${x(abs(im))}</g:additional_image_link>`).join("")}<g:availability>${p.in_stock ? "in_stock" : "preorder"}</g:availability>${p.in_stock ? "" : `<g:availability_date>${new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10)}T00:00:00+05:30</g:availability_date>`}<g:condition>new</g:condition><g:price>${(p.mrp && p.mrp > p.price ? p.mrp : p.price).toFixed(2)} INR</g:price>${p.mrp && p.mrp > p.price ? `<g:sale_price>${p.price.toFixed(2)} INR</g:sale_price>` : ""}<g:brand>${x(brand)}</g:brand><g:identifier_exists>no</g:identifier_exists><g:google_product_category>${x(gcat(p.category))}</g:google_product_category><g:product_type>${x(p.category)}</g:product_type>${p.color ? `<g:color>${x(p.color)}</g:color>` : ""}${p.fabric ? `<g:material>${x(p.fabric)}</g:material>` : ""}<g:gender>female</g:gender><g:age_group>adult</g:age_group><g:shipping><g:country>IN</g:country><g:price>${(p.price >= (num(S.free_shipping_above) || Infinity) ? 0 : num(S.shipping_charge) || 0).toFixed(2)} INR</g:price></g:shipping></item>`).join("\n")}
</channel></rss>`);
}

// installable app (PWA): manifest + a small service worker (network-first pages, cached assets)
fs.writeFileSync(path.join(OUT, "manifest.webmanifest"), JSON.stringify({ name: brand, short_name: brand, start_url: "/?src=pwa", display: "standalone", background_color: "#fbf7f1", theme_color: "#0e5b59", icons: favImg ? [{ src: favImg, sizes: "512x512", type: "image/png", purpose: "any maskable" }] : [] }));
const swVer = String([...JSON.stringify(catalog)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(36));
fs.writeFileSync(path.join(OUT, "sw.js"), `const V='bk-${swVer}';self.addEventListener('install',e=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);if(u.origin!==location.origin||/^\\/(admin|api|checkout)/.test(u.pathname))return;if(r.mode==='navigate'){e.respondWith(fetch(r).then(res=>{const c=res.clone();caches.open(V).then(x=>x.put(r,c));return res}).catch(()=>caches.match(r).then(m=>m||caches.match('/'))));return}if(/\\.(css|js|webp|jpg|jpeg|png|svg|woff2)$/.test(u.pathname)){e.respondWith(caches.open(V).then(c=>c.match(r).then(m=>{const f=fetch(r).then(res=>{if(res.ok)c.put(r,res.clone());return res}).catch(()=>m);return m||f})))}});`);

// admin panel config
const repo = process.env.GITHUB_REPO || S.github_repo || "YOUR-GITHUB-USERNAME/bahe-kurtiz";
const cfgPath = path.join(OUT, "admin/config.yml");
if (fs.existsSync(cfgPath)) {
  fs.writeFileSync(cfgPath, fs.readFileSync(cfgPath, "utf8").replaceAll("__REPO__", repo).replaceAll("__BRANCH__", process.env.CF_PAGES_BRANCH || "main").replaceAll("__SITE_URL__", SITE_URL));
}

// sitemap, robots, redirects for old shop links, headers
const urls = ["", "shop/", ...categories.map((c) => c.url), ...products.map((p) => p.url), "blog/", ...posts.map((b) => b.url), "wholesale/", ...occasions.map((o) => `occasion/${slugify(o)}/`), ...(products.some((p) => p.bestseller) ? ["bestsellers/"] : []), ...landings.map((l) => l.url), "about/", "contact/", "shipping/", "returns/", ...(S.intl_shipping_policy ? ["international-shipping/"] : []), ...(S.intl_return_policy ? ["international-returns/"] : []), "privacy/", "terms/"];
fs.writeFileSync(path.join(OUT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.map((x) => { const p = products.find((q) => q.url === x); const bp = posts.find((q) => q.url === x); return `<url><loc>${SITE_URL}/${x}</loc>${bp ? `<lastmod>${bp.date}</lastmod>` : ""}${p ? p.images.map((im) => `<image:image><image:loc>${esc(abs(im))}</image:loc></image:image>`).join("") : ""}</url>`; }).join("\n")}
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
fs.writeFileSync(path.join(OUT, "_headers"), `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: SAMEORIGIN\n/images/*\n  Cache-Control: public, max-age=2592000\n/assets/*\n  Cache-Control: public, max-age=86400\n/admin/*\n  X-Robots-Tag: noindex\n/sw.js\n  Cache-Control: no-cache\n/data/*\n  Cache-Control: no-cache\n`);
console.log(`Built ${pages.length} pages, ${products.length} products, ${categories.length} categories → _site (url ${SITE_URL})`);
