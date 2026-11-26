// Copies the courier list from content/couriers.json into apps-script/orders-api.gs (the Apps Script cannot read repo files).
// Run after editing content/couriers.json:  node scripts/sync-couriers.mjs
// The build warns if the two lists differ.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const C = JSON.parse(fs.readFileSync(path.join(ROOT, "content/couriers.json"), "utf8"));
const GS = path.join(ROOT, "apps-script/orders-api.gs");
let s = fs.readFileSync(GS, "utf8");
const block = "var COURIERS = {\n" + C.couriers.map((c) => `  ${JSON.stringify(c.name)}: ${JSON.stringify(c.url)}`).join(",\n") + "\n};\nvar COURIER_GROUP = {" + C.couriers.map((c) => `${JSON.stringify(c.name)}: ${JSON.stringify(c.group)}`).join(", ") + "};\nvar TRACK17 = " + JSON.stringify(C.track17) + ";";
const re = /var COURIERS = \{[\s\S]*?\n\};(\nvar COURIER_GROUP = \{[^\n]*\};\nvar TRACK17 = "[^"\n]*";)?/;
if (!re.test(s)) { console.error("COURIERS block not found in orders-api.gs"); process.exit(1); }
s = s.replace(re, block);
fs.writeFileSync(GS, s);
console.log(`orders-api.gs: ${C.couriers.length} couriers synced`);
