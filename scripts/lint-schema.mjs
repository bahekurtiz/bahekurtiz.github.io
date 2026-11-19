#!/usr/bin/env node
// Google "Merchant listings" rules check on the built site (_site). Runs at the end of build.mjs:
// if any product schema breaks a rule Google warns about, the build FAILS, so a bad version never goes live.
// Rules (from Search Console warnings we have had): description on every product/variant, sku and
// productGroupID ≤ 50 chars, no invalid sizeSystem, every offer has price, currency, availability,
// validFrom, shippingDetails and hasMerchantReturnPolicy.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SITE = path.join(ROOT, "_site");
const OK_SIZE_SYSTEMS = new Set(["AU", "BR", "CN", "DE", "EU", "FR", "IT", "JP", "MEX", "UK", "US"].map((c) => "https://schema.org/WearableSizeSystem" + c));

const files = [];
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name === "index.html") files.push(p); } };
walk(SITE);

const errs = [];
let products = 0;
const check = (x, file) => {
  if (Array.isArray(x)) return x.forEach((v) => check(v, file));
  if (!x || typeof x !== "object") return;
  const where = path.relative(SITE, file);
  if (x["@type"] === "ProductGroup") {
    if (!x.description) errs.push(`${where}: ProductGroup without description`);
    if (String(x.productGroupID || "").length > 50) errs.push(`${where}: productGroupID longer than 50`);
  }
  if (x["@type"] === "Product" && x.offers) {
    products++;
    if (!x.description) errs.push(`${where}: Product "${x.name}" without description`);
    if (String(x.sku || "").length > 50) errs.push(`${where}: sku longer than 50 (${x.sku})`);
    const ss = x.size && x.size.sizeSystem;
    if (ss && !OK_SIZE_SYSTEMS.has(ss)) errs.push(`${where}: invalid sizeSystem ${ss}`);
    for (const o of [].concat(x.offers)) {
      for (const k of ["price", "priceCurrency", "availability", "validFrom", "shippingDetails", "hasMerchantReturnPolicy"]) if (o[k] === undefined) errs.push(`${where}: offer without ${k}`);
    }
  }
  for (const v of Object.values(x)) check(v, file);
};

for (const f of files) {
  const h = fs.readFileSync(f, "utf8");
  for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { check(JSON.parse(m[1]), f); } catch { errs.push(`${path.relative(SITE, f)}: JSON-LD does not parse`); }
  }
}

// Indexing hygiene (Search Console "Pages" report): no redirect chains, no redirect to a missing page,
// sitemap lists only pages that exist and are indexable.
{
  const exists = (u) => { u = u.split(/[?#]/)[0]; const f = path.join(SITE, u); return fs.existsSync(u.endsWith("/") ? path.join(f, "index.html") : f) || fs.existsSync(path.join(f, "index.html")); };
  const noindex = (u) => { const f = path.join(SITE, u, "index.html"); return fs.existsSync(f) && /name="robots" content="noindex/.test(fs.readFileSync(f, "utf8").slice(0, 8000)); };
  const rules = fs.readFileSync(path.join(SITE, "_redirects"), "utf8").split("\n").filter((l) => l.trim() && !l.startsWith("#")).map((l) => l.trim().split(/\s+/)).filter((r) => r.length > 1 && !r[0].includes("*") && !r[0].includes(":"));
  const from = new Map(rules.map((r) => [r[0], r[1]]));
  for (const [a, b] of from) { if (!b.startsWith("/")) continue; if (from.has(b)) errs.push(`redirect chain: ${a} → ${b} → ${from.get(b)}`); else if (!exists(b)) errs.push(`redirect to missing page: ${a} → ${b}`); }
  const sm = fs.readFileSync(path.join(SITE, "sitemap.xml"), "utf8");
  for (const m of sm.matchAll(/<loc>https:\/\/[^/<]+(\/[^<]*)<\/loc>/g)) { if (!exists(m[1])) errs.push(`sitemap lists missing page ${m[1]}`); else if (noindex(m[1])) errs.push(`sitemap lists noindex page ${m[1]}`); }
}

if (errs.length) {
  console.error(`lint-schema: ${errs.length} SEO problem(s) – fix before going live:`);
  for (const e of [...new Set(errs)].slice(0, 30)) console.error("  - " + e);
  process.exit(1);
}
console.log(`lint-schema: ${products} products, all Google merchant-listing rules OK; redirects + sitemap clean`);
