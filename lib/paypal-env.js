// Read the PayPal keys saved in Cloudflare → Settings → Variables, forgiving small typing slips in the
// variable NAME (spaces, lower case, "-" instead of "_") and stray spaces/new lines in the VALUE.
const norm = (k) => String(k).trim().toUpperCase().replace(/[\s-]+/g, "_").replace(/[^\w]/g, "");

export function paypalEnv(env = {}) {
  const keys = Object.keys(env || {});
  const find = (...names) => {
    for (const n of names) if (typeof env[n] === "string" && env[n].trim()) return env[n].trim();
    const k = keys.find((x) => names.includes(norm(x)) && typeof env[x] === "string" && env[x].trim());
    return k ? env[k].trim() : "";
  };
  return {
    id: find("PAYPAL_CLIENT_ID", "PAYPAL_CLIENTID", "PAYPAL_ID"),
    secret: find("PAYPAL_SECRET", "PAYPAL_CLIENT_SECRET", "PAYPAL_SECRET_KEY"),
    sandbox: find("PAYPAL_ENV").toLowerCase() === "sandbox",
    // names only (never values), quoted so hidden spaces show up
    names: keys.filter((x) => /pay\W*pal/i.test(x)).map((x) => JSON.stringify(x)),
  };
}
