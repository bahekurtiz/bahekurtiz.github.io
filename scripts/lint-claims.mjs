#!/usr/bin/env node
// Claims check for drafts – blocks text that breaks the owner's "honest claims only" rule.
//   node scripts/lint-claims.mjs <file.md> [...]     → exit 1 and list problems if any line breaks a rule
//   node scripts/lint-claims.mjs --changed           → checks drafts/**/*.md that git sees as new or changed
// Run after `node build.mjs` so real prices can be read from _site/products.json.
// Rules: no fake scarcity or urgency, no discount unless settings.engine.allow_sale_words is true (owner-approved real sale),
// no review/rating/customer numbers except the real trust_ratings in settings, no price that is not a real product price,
// no delivery faster than the dispatch times in settings.
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const S = JSON.parse(fs.readFileSync(path.join(ROOT, "content/settings.json"), "utf8"));
const CAT = path.join(ROOT, "_site/products.json");
const C = fs.existsSync(CAT) ? JSON.parse(fs.readFileSync(CAT, "utf8")) : { products: [] };

let files = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (process.argv.includes("--changed")) {
  const out = execSync("git status --porcelain --untracked-files=all -- drafts", { cwd: ROOT, encoding: "utf8" });
  files = out.split("\n").map((l) => l.slice(3).trim().replace(/^"|"$/g, "")).filter((f) => f.endsWith(".md"));
}
if (!files.length) { console.log("lint-claims: nothing to check"); process.exit(0); }

const allowSale = S.engine && S.engine.allow_sale_words === true;
const prices = new Set();
for (const p of C.products) { if (p.price_inr) prices.add("₹" + Number(p.price_inr)); if (p.price_usd) prices.add("$" + Number(p.price_usd)); }
for (const k of ["free_shipping_above", "shipping_charge"]) if (Number(S[k])) prices.add("₹" + Number(S[k]));
for (const k of ["intl_free_shipping_above_usd", "intl_shipping_charge_usd"]) if (Number(S[k])) prices.add("$" + Number(S[k]));
const ratings = new Set((Array.isArray(S.trust_ratings) ? S.trust_ratings : []).flatMap((t) => [String(t.rating), String(t.count || "").split(" ")[0]]));

const RULES = [
  [/\bonly\s+\d+\s+(left|pieces?|pcs|in stock)\b/i, "stock count (fake scarcity)"],
  [/\b(limited (stock|edition|time|period)|selling fast|almost gone|last chance|hurry|few left|while stocks last|ends (tonight|today|soon))\b/i, "urgency / scarcity words"],
  [/\b(sold out soon|going fast|don'?t miss out)\b/i, "urgency words"],
  ...(allowSale ? [] : [
    [/\d+\s*%\s*(off|discount)/i, "discount % (no owner-approved sale)"],
    [/\b(sale|discount|offer|coupon|deal)\b/i, "sale/offer word (no owner-approved sale)"],
  ]),
  [/\b(\d[\d,.]*\+?)\s*(happy |satisfied )?(customers|buyers|orders sold|reviews|ratings)\b/i, "customer/review number", (m) => !ratings.has(m[1].replace(/[,+]/g, "")) && !ratings.has(m[1])],
  [/\b(\d(?:\.\d)?)\s*(★|stars?)\b/i, "star rating", (m) => !ratings.has(m[1])],
  [/\b(delivered|delivery|arrives?)\s+(in|within)\s+([1-4])\s*(-|–|to)?\s*\d*\s*days?\b/i, "delivery faster than dispatch times"],
  [/\b(best[- ]?selling|#1|number one|no\.? ?1)\b/i, "ranking claim"],
  [/(₹\s?[\d,]+|\$\s?\d+(?:\.\d+)?)/g, "price not on any product", (m) => !prices.has(m[1].replace(/[\s,]/g, "").replace(/\.0+$/, ""))],
];

let bad = 0;
for (const f of files) {
  const abs = path.isAbsolute(f) ? f : path.join(ROOT, f);
  if (!fs.existsSync(abs)) continue;
  fs.readFileSync(abs, "utf8").split("\n").forEach((line, i) => {
    if (/^\s*>/.test(line)) return; // notes to the owner, not post text
    for (const [re, why, test] of RULES) {
      const ms = re.global ? [...line.matchAll(re)] : [line.match(re)].filter(Boolean);
      for (const m of ms) if (!test || test(m)) { bad++; console.log(`${path.relative(ROOT, abs)}:${i + 1}: ${why}: "${m[0]}"`); }
    }
  });
}
if (bad) { console.log(`lint-claims: ${bad} problem(s) – fix the generator or the draft before committing.`); process.exit(1); }
console.log(`lint-claims: ${files.length} file(s) OK`);
