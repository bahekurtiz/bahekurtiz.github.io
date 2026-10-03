/* Bahe Kurtiz storefront: menu, bag, gallery, ₹/$ currency, wishlist, reels, checkout */
(() => {
  const BK = window.BK || { base: "/", wa: "", brand: "Bahe Kurtiz" };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const inr = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const usd = (n) => "$" + (Math.round(n * 100) % 100 ? (Math.round(n * 100) / 100).toFixed(2) : String(Math.round(n)));
  const isUSD = () => document.documentElement.classList.contains("usd");
  const money = (n) => (isUSD() ? usd(n) : inr(n));
  const unit = (p) => (isUSD() ? p.price_usd : p.price);
  const url = (p) => (/^https?:/.test(p) ? p : BK.base + String(p || "").replace(/^\//, ""));

  // ---------- Meta Pixel events (only if pixel is on) ----------
  const GA = { ViewContent: "view_item", AddToCart: "add_to_cart", InitiateCheckout: "begin_checkout", Purchase: "purchase", AddToWishlist: "add_to_wishlist", Search: "search", Lead: "generate_lead", CompleteRegistration: "sign_up", Subscribe: "join_group" }, PIN = { ViewContent: "pagevisit", AddToCart: "addtocart", Purchase: "checkout", Search: "search", Lead: "lead", CompleteRegistration: "signup" };
  const track = (ev, data = {}, id) => { try { window.fbq && window.fbq("track", ev, data, id ? { eventID: id } : undefined); } catch {} try { window.gtag && GA[ev] && window.gtag("event", GA[ev], { value: data.value, currency: data.currency, transaction_id: id, items: (data.content_ids || []).map((x) => ({ item_id: x })) }); } catch {} try { window.pintrk && PIN[ev] && window.pintrk("track", PIN[ev], { value: data.value, currency: data.currency, order_id: id }); } catch {} };

  // ---------- storage (safe) ----------
  const KEY = "bk_bag_v1";
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
  const save = (b) => { try { localStorage.setItem(KEY, JSON.stringify(b)); } catch {} };
  let bag = load();

  // ---------- catalog ----------
  let catalogP;
  const catalog = () => (catalogP ||= fetch(url("data/catalog.json"), { cache: "no-cache" }).then((r) => { if (!r.ok) throw new Error("catalog " + r.status); return r.json(); }).catch((e) => { catalogP = null; throw e; }));

  // ---------- toast ----------
  const toast = (msg) => { const t = $("[data-toast]"); if (!t) return; t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2200); };

  // ---------- customers: sign-in + list for future offers (saved to your Google Sheet) ----------
  const UK = "bk_user_v1";
  const getUser = () => { try { return JSON.parse(localStorage.getItem(UK)) || null; } catch { return null; } };
  const setUser = (x) => { try { x ? localStorage.setItem(UK, JSON.stringify(x)) : localStorage.removeItem(UK); } catch {} paintUser(); };
  const sendSheet = (data) => { if (!BK.sheet) return; try { fetch(BK.sheet, { method: "POST", mode: "no-cors", headers: { "content-type": "text/plain;charset=utf-8" }, body: JSON.stringify({ ...data, page: location.pathname, ts: new Date().toISOString(), currency: data.currency || (document.documentElement.classList.contains("usd") ? "USD" : "INR"), device: /Mobi/i.test(navigator.userAgent) ? "mobile" : "desktop" }) }).catch(() => {}); } catch {} };
  function saveCustomer(f, type, extra = {}) {
    const coc = document.querySelector("[data-co-consent]"); const consent = coc ? coc.checked : !!getUser()?.consent;
    const u0 = getUser() || {};
    setUser({ ...u0, name: f.name || u0.name, phone: f.phone || u0.phone, email: f.email || u0.email, city: f.city || u0.city, state: f.state || u0.state, pincode: f.pincode || u0.pincode, address: f.address || u0.address, country: f.country || u0.country || "", consent });
    sendSheet({ type, name: f.name, phone: f.phone, email: f.email || "", city: f.city || "", state: f.state || "", country: f.country || "India", pincode: f.pincode || "", consent: consent ? "yes" : "no", ref: refText().replace(/\n?Referred by: /, ""), via: [aiText().replace(/\n?Found us via: /, ""), srcText()].filter(Boolean).join(" | "), gift: f.gift_to ? "yes" : "", ...extra });
  }
  function paintUser() { const u0 = getUser(); document.querySelectorAll("[data-acct-dot]").forEach((d) => (d.hidden = !u0)); }

  const giftText = (f) => (f.gift_to || f.gift_msg ? `\n\n🎁 GIFT${f.gift_to ? "\nFor: " + f.gift_to : ""}${f.gift_msg ? "\nCard message: " + f.gift_msg : ""}${f.gift_hide === "yes" ? "\nDo NOT put price/invoice in the parcel" : ""}` : "");
  const gcText = () => { try { const g = localStorage.getItem("bk_gc"); return g ? `\nGift card: ${g}` : ""; } catch { return ""; } };
  const refText = () => { try { const r = JSON.parse(localStorage.getItem("bk_ref") || "null"); return r && Date.now() - r.t < 30 * 864e5 ? `\nReferred by: ${r.code}` : ""; } catch { return ""; } };
  try { const src = (new URLSearchParams(location.search).get("utm_source") || "") + " " + (document.referrer || ""); const m = src.match(/chatgpt|openai|perplexity|gemini|copilot|claude|bard/i); if (m) localStorage.setItem("bk_ai", JSON.stringify({ src: m[0].toLowerCase(), t: Date.now() })); } catch {}
  try { const q = new URLSearchParams(location.search), s = q.get("utm_source"); if (s && !/whatsapp/i.test(q.get("utm_medium") || "") ) localStorage.setItem("bk_src", JSON.stringify({ s: [s, q.get("utm_medium"), q.get("utm_campaign")].filter(Boolean).join(" / ").slice(0, 80), t: Date.now() })); } catch {}
  const srcText = () => { try { const a = JSON.parse(localStorage.getItem("bk_src") || "null"); return a && Date.now() - a.t < 30 * 864e5 ? a.s : ""; } catch { return ""; } };
  const aiText = () => { try { const a = JSON.parse(localStorage.getItem("bk_ai") || "null"); return a && Date.now() - a.t < 30 * 864e5 ? `\nFound us via: ${a.src}` : ""; } catch { return ""; } };
  try { const rc = new URLSearchParams(location.search).get("ref"); if (rc && /^[A-Za-z0-9-]{3,20}$/.test(rc)) { const old = JSON.parse(localStorage.getItem("bk_ref") || "null"); if (!(old && Date.now() - old.t < 30 * 864e5)) localStorage.setItem("bk_ref", JSON.stringify({ code: rc, t: Date.now() })); } } catch {}

  // ---------- overlay helpers ----------
  const scrim = $("[data-scrim]");
  const lock = (on) => { document.documentElement.classList.toggle("locked", on); if (scrim) scrim.hidden = !on; };
  const unlockIfFree = () => { if (!$("#mnav.open, #cart.open") && !document.querySelector("dialog[open]")) document.documentElement.classList.remove("locked"); };
  let _ret = null;
  const setInert = (el, off) => { if (el) { el.inert = off; } };
  const nav = $("#mnav"), drawer = $("#cart");
  const closeAll = () => { const was = nav?.classList.contains("open") || drawer?.classList.contains("open"); nav?.classList.remove("open"); nav?.setAttribute("aria-hidden", "true"); setInert(nav, true); drawer?.classList.remove("open"); drawer?.setAttribute("aria-hidden", "true"); setInert(drawer, true); $("[data-open-menu]")?.setAttribute("aria-expanded", "false"); lock(false); if (was && _ret?.focus) { _ret.focus(); _ret = null; } };
  setInert(nav, true); setInert(drawer, true);
  $$("[data-open-menu]").forEach((b) => b.addEventListener("click", () => { _ret = b; nav.classList.add("open"); nav.setAttribute("aria-hidden", "false"); setInert(nav, false); b.setAttribute("aria-expanded", "true"); lock(true); $("[data-close-menu]", nav)?.focus(); }));
  $$("[data-close-menu]").forEach((b) => b.addEventListener("click", closeAll));
  $$("[data-open-cart]").forEach((b) => b.addEventListener("click", () => openCart()));
  $$("[data-close-cart]").forEach((b) => b.addEventListener("click", closeAll));
  scrim?.addEventListener("click", closeAll);
  document.addEventListener("keydown", (e) => e.key === "Escape" && closeAll());
  function openCart() { _ret = document.activeElement; drawer.classList.add("open"); drawer.setAttribute("aria-hidden", "false"); setInert(drawer, false); lock(true); renderCart().catch(() => {}); $("[data-close-cart]", drawer)?.focus(); }

  // ---------- bag ----------
  const count = () => bag.reduce((s, i) => s + i.qty, 0);
  function setBag(b) { bag = b.filter((i) => i.qty > 0); save(bag); updateCount(); renderCart(); if ($("[data-checkout]")) renderCheckout(); }
  function updateCount() { $$("[data-bag-count]").forEach((el) => { const c = count(); el.textContent = c; el.hidden = !c; }); }
  function addItem(slug, size, qty = 1) {
    const b = [...bag]; const f = b.find((i) => i.slug === slug && i.size === size);
    if (f) f.qty = Math.min(10, f.qty + qty); else b.push({ slug, size, qty });
    setBag(b);
    const pr = Number($("[data-product]")?.dataset.price) || undefined;
    const prU = Number($("[data-product]")?.dataset.usd) || undefined;
    track("AddToCart", { content_ids: [slug], content_type: "product", value: isUSD() ? prU : pr, currency: isUSD() ? "USD" : "INR" });
  }
  async function renderCart() {
    const box = $("[data-cart-items]"); if (!box) return;
    if (!bag.length) { const sb = $("[data-ship-bar]"); if (sb) sb.hidden = true; box.innerHTML = `<p class="empty">Your bag is empty.<br><a class="link" href="${url("shop/")}">Start shopping →</a></p>`; $("[data-cart-foot]").hidden = true; return; }
    let cat; try { cat = await catalog(); } catch { box.innerHTML = `<p class="empty">Could not load your bag. Check your internet and try again.</p>`; return; }
    let sub = 0;
    const items = bag.filter((i) => cat.products[i.slug]);
    box.innerHTML = items.map((i, n) => { const p = cat.products[i.slug]; const pr = unit(p); sub += (pr || 0) * i.qty;
      return `<div class="line"><img src="${esc(url(p.image))}" alt="" width="64" height="96"><div><a href="${url(p.url)}">${esc(p.title)}</a><small>${i.size ? "Size " + esc(i.size) : ""}</small>${pr == null ? `<small class="warn">${isUSD() ? "Ships within India only" : "Price on request"}</small>` : ""}
      <div class="qty"><button data-q="${n}" data-d="-1" aria-label="Less">−</button><span>${i.qty}</span><button data-q="${n}" data-d="1" aria-label="More">+</button><button class="rm" data-rm="${n}">Remove</button></div></div><strong>${pr == null ? "–" : money(pr * i.qty)}</strong></div>`; }).join("");
    $("[data-cart-subtotal]").textContent = money(sub); $("[data-cart-foot]").hidden = false;
    const lim = isUSD() ? cat.settings.intl_free_shipping_above_usd : cat.settings.free_shipping_above, bar = $("[data-ship-bar]");
    if (bar) { bar.hidden = !lim; if (lim) { const left = lim - sub; $("[data-ship-text]").innerHTML = left > 0 ? `Add <strong>${money(left)}</strong> more for <strong>FREE shipping</strong>` : `🎉 You have unlocked <strong>FREE shipping</strong>`; $("[data-ship-fill]").style.width = Math.min(100, (sub / lim) * 100) + "%"; } }
    $$("[data-q]", box).forEach((b) => b.onclick = () => { const b2 = [...items]; b2[b.dataset.q].qty = Math.max(0, Math.min(10, b2[b.dataset.q].qty + +b.dataset.d)); setBag(b2); });
    $$("[data-rm]", box).forEach((b) => b.onclick = () => { const b2 = [...items]; b2.splice(+b.dataset.rm, 1); setBag(b2); });
  }
  updateCount();

  // ---------- product page ----------
  const prod = $("[data-product]");
  if (prod) {
    const slug = prod.dataset.product; let size = "";
    const sizes = $$(".size", prod);
    sizes.forEach((b) => b.addEventListener("click", () => { if (b.dataset.out) { openNotify(slug, b.dataset.size); return; } size = b.dataset.size; sizes.forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); }); const e = $("[data-size-error]"); if (e) e.hidden = true; }));
    // ---------- Mera Size: remembered fit -> suggested size (on this phone only) ----------
    const ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL"], INTL = { XS: "US 2 · UK 6 · EU 34", S: "US 4 · UK 8 · EU 36", M: "US 6–8 · UK 10–12 · EU 38–40", L: "US 10 · UK 14 · EU 42", XL: "US 12 · UK 16 · EU 44", XXL: "US 14 · UK 18 · EU 46", "3XL": "US 16 · UK 20 · EU 48", "4XL": "US 18 · UK 22 · EU 50", "5XL": "US 20 · UK 24 · EU 52" };
    const fitNote = $("[data-fit-note]"), chart = (() => { try { return JSON.parse(prod.dataset.chart || "[]"); } catch { return []; } })(), pfit = prod.dataset.fit || "";
    const getFit = () => { try { return JSON.parse(localStorage.getItem("bk_fit") || "null"); } catch { return null; } };
    const recSize = (f) => { if (!f) return ""; const avail = sizes.map((b) => b.dataset.size.toUpperCase()); let r = "";
      if (f.bust) { const target = +f.bust + (f.pref === "Snug" ? -1 : f.pref === "Loose" ? 2 : 0) + (/fitted/i.test(pfit) && f.pref !== "Snug" ? 1 : 0); r = (chart.find((c) => c[1] >= target) || chart[chart.length - 1] || [""])[0]; }
      else if (f.usual) { const i = ORDER.indexOf(f.usual) + (f.pref === "Loose" ? 1 : 0) + (/fitted/i.test(pfit) && f.pref !== "Snug" ? 1 : 0); r = ORDER[Math.min(ORDER.length - 1, Math.max(0, i))]; }
      r = String(r).toUpperCase(); if (avail.includes(r)) return r; const up = ORDER.slice(ORDER.indexOf(r)).find((s) => avail.includes(s)); return up || ""; };
    const intlLine = (s) => (document.documentElement.classList.contains("usd") && INTL[s] ? ` <small class="muted">(${s} ≈ ${INTL[s]})</small>` : "");
    const paintFit = (auto) => { if (!fitNote) return; const f = getFit(), r = recSize(f); if (!f || !r) { fitNote.hidden = !size; fitNote.innerHTML = size ? intlLine(size.toUpperCase()) : ""; return; }
      const btn = sizes.find((b) => b.dataset.size.toUpperCase() === r); fitNote.hidden = false;
      if (btn?.dataset.out) fitNote.innerHTML = `✨ Aapka size <b>${r}</b> abhi sold out hai. <button type="button" class="link" data-fit-notify>Wapas aane par batao</button>`;
      else { fitNote.innerHTML = `✨ Aapke liye: <b>${r}</b>${/relaxed/i.test(pfit) ? " (relaxed fit)" : ""}${intlLine(r)} · <button type="button" class="link" data-fit-open>Badlo</button>`; if (auto && btn && !size) btn.click(); }
      $("[data-fit-notify]", fitNote)?.addEventListener("click", () => openNotify(slug, btn.dataset.size)); $("[data-fit-open]", fitNote)?.addEventListener("click", openFit); };
    function openFit() {
      let d = $("[data-fit-dlg]"); const f = getFit() || {};
      if (!d) { d = document.createElement("dialog"); d.className = "fit-dlg"; d.dataset.fitDlg = ""; document.body.appendChild(d); }
      d.innerHTML = `<form method="dialog" class="fit-form"><h2>✨ Mera size</h2><p class="muted small">Sirf is phone mein save hoga. Agli baar har dress par aapka size apne aap chuna milega.</p>
        <p class="label">Aap usually kaunsa size pehenti ho?</p><div class="fit-chips">${ORDER.slice(1, 8).map((s) => `<label><input type="radio" name="usual" value="${s}"${f.usual === s ? " checked" : ""}><span>${s}</span></label>`).join("")}</div>
        <label class="fit-or">Ya bust (inches) <input name="bust" type="number" min="26" max="60" step="0.5" inputmode="decimal" value="${f.bust || ""}" placeholder="jaise 36"></label>
        <p class="label">Fitting kaisi pasand hai?</p><div class="fit-chips">${["Snug", "Regular", "Loose"].map((s) => `<label><input type="radio" name="pref" value="${s}"${(f.pref || "Regular") === s ? " checked" : ""}><span>${s === "Snug" ? "Fitted" : s === "Loose" ? "Dheela" : "Regular"}</span></label>`).join("")}</div>
        <div class="fit-b"><button class="btn" value="save">Mera size dikhao</button><button class="btn btn-ghost" value="cancel" formnovalidate>Cancel</button></div></form>`;
      d.onclose = () => { if (d.returnValue !== "save") return; const fd = new FormData($("form", d)); const nf = { usual: fd.get("usual") || "", bust: +fd.get("bust") || 0, pref: fd.get("pref") || "Regular" }; if (!nf.usual && !nf.bust) { toast("Size ya bust chuno"); return; } try { localStorage.setItem("bk_fit", JSON.stringify(nf)); } catch {} size = ""; sizes.forEach((x) => x.classList.remove("on")); paintFit(true); const r = recSize(nf); if (r) toast(`Aapka size: ${r}`); };
      d.showModal();
    }
    $$("[data-fit-open]", prod).forEach((b) => b.addEventListener("click", openFit));
    sizes.forEach((b) => b.addEventListener("click", () => { if (!getFit() && fitNote) { fitNote.hidden = !intlLine(b.dataset.size.toUpperCase()); fitNote.innerHTML = intlLine(b.dataset.size.toUpperCase()); } }));
    paintFit(true);
    const need = () => { if (sizes.length && !size) { const e = $("[data-size-error]"); if (e) e.hidden = false; $(".sizes")?.scrollIntoView({ behavior: "smooth", block: "center" }); toast("Please select a size"); return false; } return true; };
    $$("[data-add]").forEach((b) => b.addEventListener("click", () => { if (!need()) return; addItem(slug, size); openCart(); }));
    $$("[data-buy]").forEach((b) => b.addEventListener("click", () => { if (!need()) return; addItem(slug, size); location.href = url("checkout/"); }));
    // gallery: swipe on mobile, dots + thumbs
    const slides = $("[data-slides]"), dots = $$("[data-dots] button"), thumbs = $$(".thumb");
    const go = (i) => slides.scrollTo({ left: slides.clientWidth * i, behavior: "smooth" });
    dots.forEach((d, i) => d.addEventListener("click", () => go(i)));
    thumbs.forEach((t) => t.addEventListener("click", () => go(+t.dataset.go)));
    slides?.addEventListener("scroll", () => { const i = Math.round(slides.scrollLeft / slides.clientWidth); dots.forEach((d, k) => d.classList.toggle("on", k === i)); thumbs.forEach((t, k) => t.classList.toggle("on", k === i)); }, { passive: true });
    // sticky bar when main buttons scroll out of view
    const sticky = $("[data-sticky]"), main = $(".buy-row");
    if (sticky && main && "IntersectionObserver" in window) new IntersectionObserver(([e]) => { const on = !e.isIntersecting && e.boundingClientRect.top < 0; sticky.classList.toggle("show", on); document.body.classList.toggle("sticky-on", on); }).observe(main);
  }

  // ---------- listing sort ----------
  const sort = $("[data-sort]"), grid = $("[data-grid]");
  sort?.addEventListener("change", () => {
    const cards = $$(".card", grid); const v = sort.value; const pr = (c) => { const v = isUSD() ? c.dataset.usd : c.dataset.price; return v === "" || v == null ? Infinity : +v; };
    cards.sort((a, b) => v === "low" ? pr(a) - pr(b) : v === "high" ? (pr(b) === Infinity ? -1 : pr(a) === Infinity ? 1 : pr(b) - pr(a)) : +a.dataset.i - +b.dataset.i).forEach((c) => grid.appendChild(c));
  });

  // ---------- checkout (online payment via Razorpay; WhatsApp/UPI as fallback; no COD) ----------
  const co = $("[data-checkout]");
  let method = "", online = false;
  function totals(cat, m) {
    const s = cat.settings; let sub = 0;
    if (isUSD()) {
      for (const i of bag) { const p = cat.products[i.slug]; if (p && p.price_usd) sub += p.price_usd * i.qty; }
      const shipping = s.intl_free_shipping_above_usd && sub >= s.intl_free_shipping_above_usd ? 0 : (s.intl_shipping_charge_usd || 0);
      return { sub, discount: 0, shipping, total: Math.round((sub + shipping) * 100) / 100 };
    }
    for (const i of bag) { const p = cat.products[i.slug]; if (p && p.price) sub += p.price * i.qty; }
    const prepaid = m === "online" || m === "upi";
    const discount = prepaid && s.prepaid_discount_percent ? Math.round(sub * s.prepaid_discount_percent / 100) : 0;
    const shipping = s.free_shipping_above && sub >= s.free_shipping_above ? 0 : (s.shipping_charge || 0);
    return { sub, discount, shipping, total: sub - discount + shipping };
  }
  async function renderCheckout() {
    const cat = await catalog();
    const skipped = isUSD() ? bag.filter((i) => cat.products[i.slug] && !cat.products[i.slug].price_usd) : [];
    bag = bag.filter((i) => cat.products[i.slug] && unit(cat.products[i.slug]));
    const itemsBox = $("[data-co-items]");
    if (!bag.length) { co.innerHTML = `<h1>Checkout</h1><p class="empty">${skipped.length ? "The styles in your bag ship within India only. " : ""}Your bag is empty. <a class="link" href="${url("shop/")}">Shop the collection →</a></p>`; return; }
    itemsBox.innerHTML = (skipped.length ? `<p class="warn">${skipped.length} style(s) in your bag ship within India only and are not included.</p>` : "") + bag.map((i) => { const p = cat.products[i.slug]; return `<div class="line"><img src="${esc(url(p.image))}" alt="" width="64" height="96"><div><span>${esc(p.title)}</span><small>${i.size ? "Size " + esc(i.size) + " · " : ""}Qty ${i.qty}</small></div><strong>${money(unit(p) * i.qty)}</strong></div>`; }).join("");
    const t = totals(cat, method);
    $("[data-co-totals]").innerHTML = `<div class="row"><span>Subtotal</span><span>${money(t.sub)}</span></div>
      ${t.discount ? `<div class="row save"><span>Online payment discount</span><span>−${money(t.discount)}</span></div>` : ""}
      <div class="row"><span>${isUSD() ? "International shipping" : "Shipping"}</span><span>${t.shipping ? money(t.shipping) : "Free"}</span></div>
      <div class="row total"><span>Total</span><span>${money(t.total)}${isUSD() ? " USD" : ""}</span></div>`;
    $("[data-place]").textContent = method === "paypal" ? `Place order · ${usd(t.total)} (PayPal invoice)` : method === "online" ? `Pay ${inr(t.total)} securely` : method === "upi" ? `Pay ${inr(t.total)} by UPI` : `Send order on WhatsApp · ${inr(t.total)}`;
  }
  function loadRazorpay() {
    return new Promise((res, rej) => {
      if (window.Razorpay) return res();
      const s = document.createElement("script"); s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => res(); s.onerror = () => rej(new Error("Payment window could not load. Check your internet and try again."));
      document.head.appendChild(s);
    });
  }
  async function setupPayOptions() {
    const btn = $("[data-place]"); btn.disabled = true;
    let s = {};
    try { s = (await catalog()).settings; } catch {}
    // form fields differ for India and international
    const intl = isUSD(), q = (k) => $(`[data-${k}]`);
    if (q("country")) q("country").required = intl;
    if (q("state")) q("state").required = !intl;
    if (q("email")) q("email").required = intl;
    if (q("phone")) { q("phone").placeholder = intl ? "+1 555 123 4567" : "10-digit mobile"; q("phone").inputMode = intl ? "tel" : "numeric"; }
    if (q("pin")) q("pin").inputMode = intl ? "text" : "numeric";
    if (intl) {
      method = "paypal";
      $("[data-pay-opts]").innerHTML = `<label class="pay"><input type="radio" name="pay" value="paypal" checked><span><strong>PayPal / international card</strong><small>We send a secure PayPal invoice in USD to your email. Your order ships after payment.</small></span></label>`;
      const sec = $("[data-secure]"); if (sec) sec.hidden = true;
      await renderCheckout(); btn.disabled = false; return;
    }
    try { const r = await fetch(url("api/payment-status"), { cache: "no-store" }); online = r.ok && (await r.json()).online === true; } catch { online = false; }
    const opts = [];
    if (online) opts.push(["online", "Pay online", "UPI, cards, netbanking, wallets" + (s.prepaid_discount_percent ? ` · <b>${s.prepaid_discount_percent}% off</b>` : "")]);
    if (!online && s.upi_id) opts.push(["upi", "Pay by UPI", "GPay, PhonePe, Paytm" + (s.prepaid_discount_percent ? ` · <b>${s.prepaid_discount_percent}% off</b>` : "")]);
    if (!online) opts.push(["whatsapp", "Order on WhatsApp", "We confirm your order and share payment details on chat"]);
    method = opts[0][0];
    $("[data-pay-opts]").innerHTML = opts.map(([v, a, b], i) => `<label class="pay"><input type="radio" name="pay" value="${v}"${i === 0 ? " checked" : ""}><span><strong>${a}</strong><small>${b}</small></span></label>`).join("");
    $$("[name=pay]").forEach((r) => r.addEventListener("change", () => { method = r.value; renderCheckout(); }));
    const sec = $("[data-secure]"); if (sec) sec.hidden = !online;
    if (online) loadRazorpay().catch(() => {});
    await renderCheckout();
    btn.disabled = false;
  }
  const orderRef = () => { const d = new Date(); return "BK" + String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0") + "-" + Math.random().toString(36).slice(2, 6).toUpperCase(); };
  function orderText(cat, f, ref, total, payLine) {
    const lines = bag.map((i) => { const p = cat.products[i.slug]; return `• ${p.title}${i.size ? " | Size " + i.size : ""} | Qty ${i.qty} | ${inr(p.price * i.qty)}`; }).join("\n");
    return `New order ${ref}\n\n${lines}\n\nTotal: ${inr(total)}\nPayment: ${payLine}\n\nName: ${f.name}\nPhone: ${f.phone}${f.email ? "\nEmail: " + f.email : ""}\nAddress: ${f.address}, ${f.city}, ${f.state} - ${f.pincode}${giftText(f)}${refText()}${aiText()}${gcText()}`;
  }
  const waUrl = (txt) => `https://wa.me/${BK.wa}?text=${encodeURIComponent(txt)}`;
  function showDone(html) {
    co.hidden = true; const d = $("[data-done]"); d.innerHTML = html + `<div class="done-refer"><p><b>🎁 Love it? Share with friends.</b> They get a welcome offer and you get a thank-you reward.</p><a class="btn btn-ghost" href="${url("refer/")}">Get my Refer & Earn link</a>${BK.wa ? ` <a class="btn btn-ghost" download="Bahe-Kurtiz.vcf" href="data:text/vcard;charset=utf-8,${encodeURIComponent(`BEGIN:VCARD\nVERSION:3.0\nFN:${BK.brand}\nORG:${BK.brand}\nTEL;TYPE=CELL:+${BK.wa}\nURL:${location.origin}\nEND:VCARD`)}">📇 Save our number</a><p class="muted small">Save our number to get order updates and new designs on WhatsApp.</p>` : ""}</div>`; d.hidden = false; scrollTo({ top: 0, behavior: "smooth" });
    $$("[data-clear-bag]", d).forEach((a) => a.addEventListener("click", () => setBag([])));
  }
  if (co) {
    setupPayOptions().catch(() => { $("[data-place]").disabled = false; });
    const form = $("[data-co-form]"), err = $("[data-co-error]"), btn = $("[data-place]");
    const fail = (m, extra = "") => { err.innerHTML = esc(m) + extra; err.hidden = false; btn.disabled = false; };
    track("InitiateCheckout", { num_items: count(), currency: isUSD() ? "USD" : "INR" });
    form.addEventListener("submit", async (e) => {
      e.preventDefault(); if (btn.disabled) return; err.hidden = true;
      const f = Object.fromEntries(new FormData(form)); for (const k in f) f[k] = String(f[k]).trim();
      if (method === "paypal") {
        const ph = f.phone.replace(/[^\d+]/g, "");
        if (!form.checkValidity() || ph.replace(/\D/g, "").length < 7 || !f.country || !/^\S+@\S+\.\S+$/.test(f.email || "")) { form.reportValidity(); return fail("Please fill all delivery details, your country, phone with country code and email (for the PayPal invoice)."); }
        btn.disabled = true;
        let cat; try { cat = await catalog(); } catch { return fail("Could not load prices. Check your internet and try again."); }
        const t = totals(cat, "paypal"); const ref = orderRef();
        saveCustomer(f, "order", { ref_order: ref, total: t.total, currency: "USD", items: bag.map((i) => `${cat.products[i.slug]?.title} ${i.size || ""} x${i.qty}`).join("; ") });
        const lines = bag.map((i) => { const p = cat.products[i.slug]; return `• ${p.title}${i.size ? " | Size " + i.size : ""} | Qty ${i.qty} | ${usd(p.price_usd * i.qty)}`; }).join("\n");
        const txt = `New INTERNATIONAL order ${ref}\n\n${lines}\n\nShipping: ${t.shipping ? usd(t.shipping) : "Free"}\nTotal: ${usd(t.total)} USD\nPayment: Please send PayPal invoice\n\nName: ${f.name}\nPhone: ${ph}\nEmail: ${f.email}\nAddress: ${f.address}, ${f.city}${f.state ? ", " + f.state : ""} ${f.pincode}, ${f.country}${giftText(f)}${refText()}${aiText()}${gcText()}`;
        track("Lead", { value: t.total, currency: "USD" });
        const mail = cat.settings.email ? `mailto:${cat.settings.email}?subject=${encodeURIComponent("Order " + ref)}&body=${encodeURIComponent(txt)}` : "";
        showDone(`<div class="done-box"><div class="tick">✓</div><h1>Almost done!</h1><p>Send your order <strong>${ref}</strong> to us. We will email a secure <strong>PayPal invoice for ${usd(t.total)} USD</strong> to ${esc(f.email)}. Your order ships after payment.</p>${BK.wa ? `<a class="btn btn-wa btn-lg" data-clear-bag href="${waUrl(txt)}" target="_blank" rel="noopener">Send order on WhatsApp</a>` : ""}${mail ? `<p><a class="btn btn-ghost" data-clear-bag href="${esc(mail)}">Send by email instead</a></p>` : ""}<p class="muted">Import duties and taxes of your country are paid by you on delivery.</p></div>`);
        return;
      }
      f.phone = f.phone.replace(/\D/g, "").slice(-10);
      if (!form.checkValidity() || !/^[6-9]\d{9}$/.test(f.phone) || !/^[1-9]\d{5}$/.test(f.pincode)) { form.reportValidity(); return fail("Please fill all delivery details correctly (10-digit mobile, 6-digit pincode)."); }
      btn.disabled = true;
      let cat; try { cat = await catalog(); } catch { return fail("Could not load prices. Check your internet and try again."); }
      const t = totals(cat, method); const ref = orderRef();
      saveCustomer(f, "order", { ref_order: ref, total: t.total, currency: "INR", payment: method, items: bag.map((i) => `${cat.products[i.slug]?.title} ${i.size || ""} x${i.qty}`).join("; ") });
      const items = bag.map((i) => ({ slug: i.slug, size: i.size, qty: i.qty }));
      const waFallback = () => BK.wa ? ` <a class="link" href="${waUrl(orderText(cat, f, ref, totals(cat, "whatsapp").total, "Online payment failed – please help"))}" target="_blank" rel="noopener">Order on WhatsApp instead →</a>` : "";
      if (method === "online") {
        try {
          const r = await fetch(url("api/create-order"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items, customer: f, ref }) });
          const o = await r.json().catch(() => ({})); if (!r.ok) throw new Error(o.error || "Could not start payment");
          await loadRazorpay();
          const rzp = new window.Razorpay({
            key: o.key_id, amount: o.amount, currency: "INR", order_id: o.order_id, name: BK.brand, description: `Order ${ref}`,
            prefill: { name: f.name, contact: "+91" + f.phone, email: f.email || undefined }, notes: { ref }, theme: { color: "#0e5b59" },
            modal: { ondismiss: () => fail("Payment was not completed. You can try again.", waFallback()) },
            handler: async (resp) => {
              let ok = false; try { const v = await fetch(url("api/verify-payment"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(resp) }); ok = v.ok && (await v.json()).ok === true; } catch {}
              const txt = orderText(cat, f, ref, o.amount / 100, `PAID online (Payment ID ${resp.razorpay_payment_id})`);
              if (ok) {
                sendSheet({ type: "paid", name: f.name, phone: f.phone, email: f.email || "", city: f.city || "", state: f.state || "", pincode: f.pincode || "", ref_order: ref, total: o.amount / 100, currency: "INR", payment: "Razorpay " + resp.razorpay_payment_id, items: bag.map((i) => `${cat.products[i.slug]?.title} ${i.size || ""} x${i.qty}`).join("; ") });
                track("Purchase", { value: o.amount / 100, currency: "INR", content_ids: items.map((i) => i.slug), content_type: "product" }, ref);
                setBag([]);
                showDone(`<div class="done-box"><div class="tick">✓</div><h1>Payment successful!</h1><p>Thank you, ${esc(f.name)}. Your order <strong>${ref}</strong> is confirmed.</p><p class="muted">Payment ID: ${esc(resp.razorpay_payment_id)}</p>${BK.wa ? `<a class="btn btn-wa" href="${waUrl(txt)}" target="_blank" rel="noopener">Get updates on WhatsApp</a>` : ""}<p><a class="link" href="${url("shop/")}">Continue shopping →</a></p></div>`);
              } else {
                showDone(`<div class="done-box"><h1>We are confirming your payment</h1><p>Order <strong>${ref}</strong> · Payment ID <strong>${esc(resp.razorpay_payment_id)}</strong></p><p>Please send these details to us on WhatsApp so we can confirm your order quickly.</p>${BK.wa ? `<a class="btn btn-wa" data-clear-bag href="${waUrl(txt)}" target="_blank" rel="noopener">Send on WhatsApp</a>` : ""}</div>`);
              }
            },
          });
          rzp.on("payment.failed", (x) => { err.innerHTML = esc("Payment failed: " + (x.error?.description || "please try again.")); err.hidden = false; });
          rzp.open();
        } catch (ex) { fail(ex.message || "Something went wrong. Please try again.", waFallback()); }
        return;
      }
      if (method === "upi") {
        const upi = cat.settings.upi_id; const link = `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(BK.brand)}&am=${t.total.toFixed(2)}&cu=INR&tn=${encodeURIComponent("Order " + ref)}`;
        const txt = orderText(cat, f, ref, t.total, `UPI ${inr(t.total)} – screenshot attached`);
        showDone(`<div class="done-box"><h1>Pay ${inr(t.total)} by UPI</h1><p>Order <strong>${ref}</strong></p><div class="qr" data-qr></div><p class="muted">Scan with any UPI app, or on mobile tap the button.</p><a class="btn" href="${esc(link)}">Open UPI app</a><p>UPI ID: <strong>${esc(upi)}</strong></p><p><strong>After paying, send the order with your payment screenshot on WhatsApp:</strong></p><a class="btn btn-wa" data-clear-bag href="${waUrl(txt)}" target="_blank" rel="noopener">Send order on WhatsApp</a></div>`);
        const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
        s.onload = () => { try { new window.QRCode($("[data-qr]"), { text: link, width: 200, height: 200 }); } catch {} }; document.head.appendChild(s);
        return;
      }
      // WhatsApp order (used only while online payment is not switched on)
      const txt = orderText(cat, f, ref, t.total, "Prepaid – please share payment details");
      showDone(`<div class="done-box"><div class="tick">✓</div><h1>Almost done!</h1><p>Tap below to send your order <strong>${ref}</strong> to us on WhatsApp. We will confirm it and share payment details.</p><a class="btn btn-wa btn-lg" data-clear-bag href="${waUrl(txt)}" target="_blank" rel="noopener">Send order on WhatsApp</a><p><a class="link" href="${url("shop/")}">Continue shopping →</a></p></div>`);
    });
  }

  // product view
  const pv = $("[data-product]");
  if (pv) track("ViewContent", { content_ids: [pv.dataset.product], content_type: "product", value: Number(pv.dataset.price) || undefined, currency: "INR" });

  // product video: muted autoplay; pause when off screen
  const pv2 = $$("video[data-pvideo]");
  if (pv2.length && "IntersectionObserver" in window) {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io2 = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting && !reduce) { if (e.target.preload === "none") e.target.preload = "metadata"; e.target.play().catch(() => {}); } else e.target.pause(); }), { threshold: 0.4 });
    pv2.forEach((v) => { if (reduce) v.removeAttribute("autoplay"); io2.observe(v); });
  }

  // reels: play muted only while visible (saves data)
  const vids = $$("video[data-reel]");
  if (vids.length && "IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { const v = e.target; if (e.isIntersecting) { if (v.preload === "none") v.preload = "metadata"; v.play().catch(() => {}); } else v.pause(); }), { threshold: 0.5 });
    vids.forEach((v) => io.observe(v));
  }

  // ---------- country & currency (all countries; local prices shown approx., charged in USD) ----------
  const flag = (c) => (c && c.length === 2 ? String.fromCodePoint(...[...c.toUpperCase()].map((ch) => 127397 + ch.charCodeAt(0))) : "🌍");
  const CL = BK.countries || [];
  const getCC = () => { try { return JSON.parse(localStorage.getItem("bk_country") || "null"); } catch { return null; } };
  let cc = getCC();
  try { const qc = (new URLSearchParams(location.search).get("country") || "").toUpperCase(); const row = qc && CL.find((r) => r[0] === qc); if (row) { cc = { c: row[0], n: row[1], cur: row[2] }; localStorage.setItem("bk_country", JSON.stringify(cc)); localStorage.setItem("bk_cur", cc.c === "IN" ? "INR" : "USD"); } } catch {}
  if (!cc && CL.length) { // first visit: guess from browser
    let code = ""; try { const z = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; if (/Calcutta|Kolkata/.test(z)) code = "IN"; } catch {}
    if (!code) { const m = (navigator.language || "").match(/-([A-Z]{2})$/i); code = m ? m[1].toUpperCase() : (isUSD() ? "US" : "IN"); }
    const row = CL.find((r) => r[0] === code); cc = row ? { c: row[0], n: row[1], cur: row[2] } : null;
  }
  let rates = { USD: 1, ...(BK.rates || {}) };
  const fmtLocal = (v, cur) => { try { return new Intl.NumberFormat("en", { style: "currency", currency: cur, minimumFractionDigits: 0, maximumFractionDigits: v * rates[cur] >= 10 ? 0 : 2 }).format(v * rates[cur]); } catch { return null; } };
  function applyLocal() {
    const cur = cc?.cur || (isUSD() ? "USD" : "INR");
    $$("[data-cc-label]").forEach((el) => (el.textContent = cc ? `${flag(cc.c)} ${cur === "INR" ? "₹" : cur === "USD" ? "$" : cur}` : el.textContent));
    $$("[data-cc-name]").forEach((el) => (el.textContent = cc ? `${cc.n} · ${cur}` : el.textContent));
    const local = cur !== "INR" && cur !== "USD" && rates[cur];
    document.documentElement.classList.toggle("local-cur", !!local);
    $$("[data-usdv]").forEach((el) => { if (!el.dataset.usdText) el.dataset.usdText = el.textContent; const v = +el.dataset.usdv; const t = local && v ? fmtLocal(v, cur) : null; el.textContent = t ? "≈ " + t : el.dataset.usdText; el.title = t ? `${el.dataset.usdText} USD – charged in US $` : ""; });
  }
  function setCountry(row, silent) {
    cc = { c: row[0], n: row[1], cur: row[2] }; try { localStorage.setItem("bk_country", JSON.stringify(cc)); localStorage.setItem("bk_cur", cc.c === "IN" ? "INR" : "USD"); } catch {}
    const wasUSD = isUSD(), toUSD = cc.c !== "IN"; document.documentElement.classList.toggle("usd", toUSD);
    if (!silent) { toast(cc.c === "IN" ? "Showing prices in ₹ for India" : `Prices for ${cc.n}${cc.cur !== "USD" ? " (approx. " + cc.cur + ", charged in US $)" : " in US $"}`); if (co && wasUSD !== toUSD) return location.reload(); }
    ensureRates().then(applyLocal); renderCart().catch(() => {});
  }
  let ratesP;
  const ensureRates = () => { const cur = cc?.cur; if (!cur || cur === "USD" || cur === "INR" || rates[cur]) return Promise.resolve(); return (ratesP ||= (async () => { try { const c = JSON.parse(localStorage.getItem("bk_rates") || "null"); if (c && Date.now() - c.t < 12 * 36e5) { rates = { ...c.r, ...(BK.rates || {}), USD: 1 }; return; } } catch {} try { const r = await fetch("https://open.er-api.com/v6/latest/USD"); const j = await r.json(); if (j && j.rates) { rates = { ...j.rates, ...(BK.rates || {}), USD: 1 }; try { localStorage.setItem("bk_rates", JSON.stringify({ t: Date.now(), r: j.rates })); } catch {} } } catch {} })()); };
  const cm = $("[data-country-modal]"), cq = $("[data-country-q]"), clist = $("[data-country-list]");
  const renderCL = () => { const q = (cq.value || "").trim().toLowerCase(); const rows = CL.filter((r) => !q || r[1].toLowerCase().includes(q) || r[0].toLowerCase() === q || r[2].toLowerCase() === q); const top = q ? rows : [...CL.filter((r) => ["IN", "US", "GB", "AE", "CA", "AU"].includes(r[0])), ...rows]; clist.innerHTML = [...new Map(top.map((r) => [r[0], r])).values()].slice(0, 260).map((r) => `<button type="button" data-cc="${r[0]}"${cc?.c === r[0] ? ' class="on"' : ""}><span>${flag(r[0])} ${esc(r[1])}</span><small>${r[0] === "IN" ? "₹ INR" : r[2]}</small></button>`).join(""); };
  $$("[data-country]").forEach((b) => b.addEventListener("click", () => { if (!cm?.showModal) return; closeAll(); cq.value = ""; renderCL(); cm.showModal(); document.documentElement.classList.add("locked"); setTimeout(() => cq.focus(), 50); }));
  cq?.addEventListener("input", renderCL);
  clist?.addEventListener("click", (e) => { const b = e.target.closest("[data-cc]"); if (!b) return; const row = CL.find((r) => r[0] === b.dataset.cc); if (row) { cm.close(); setCountry(row); } });
  $("[data-close-country]")?.addEventListener("click", () => cm.close());
  cm?.addEventListener("close", unlockIfFree); cm?.addEventListener("click", (e) => { if (e.target === cm) cm.close(); });
  if (cc && CL.length) { document.documentElement.classList.toggle("usd", cc.c !== "IN"); ensureRates().then(applyLocal); applyLocal(); }
  if (CL.length && "MutationObserver" in window) { let mt; new MutationObserver((ms) => { if (ms.some((m) => [...m.addedNodes].some((n) => n.nodeType === 1 && (n.matches?.("[data-usdv]") || n.querySelector?.("[data-usdv]"))))) { clearTimeout(mt); mt = setTimeout(applyLocal, 50); } }).observe(document.body, { childList: true, subtree: true }); }

  // ---------- small product card (wishlist / recently viewed) ----------
  const off = (a, b) => (a && b && b > a ? Math.round((1 - a / b) * 100) : 0);
  const priceBoth = (p) => {
    const i = p.price == null ? `<span class="price ask">Price on request</span>` : `<span class="price">${inr(p.price)}</span>${off(p.price, p.mrp) ? `<s class="mrp">${inr(p.mrp)}</s>` : ""}`;
    if (!BK.intl) return i;
    const u2 = p.price_usd == null ? `<span class="price ask">India only</span>` : `<span class="price" data-usdv="${p.price_usd}">${usd(p.price_usd)}</span>${off(p.price_usd, p.mrp_usd) ? `<s class="mrp" data-usdv="${p.mrp_usd}">${usd(p.mrp_usd)}</s>` : ""}`;
    return `<span class="cur-inr">${i}</span><span class="cur-usd">${u2}</span>`;
  };
  const miniCard = (slug, p) => `<article class="card" data-slug="${esc(slug)}"><a class="card-link" href="${url(p.url)}"><div class="card-img${p.image2 ? " has-alt" : ""}"><img src="${esc(url(p.image))}" alt="${esc(p.title)}" width="1200" height="1800" loading="lazy">${p.image2 ? `<img class="alt" src="${esc(url(p.image2))}" alt="" width="1200" height="1800" loading="lazy">` : ""}</div><div class="card-body"><h3>${esc(p.title)}</h3><div class="card-price">${priceBoth(p)}</div></div></a><button class="wish" type="button" data-wish="${esc(slug)}" aria-label="Save to wishlist" aria-pressed="false"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 20s-7.5-4.6-9.2-9.3C1.7 7.4 4 4.5 7.1 4.5c2 0 3.5 1.1 4.9 2.9 1.4-1.8 2.9-2.9 4.9-2.9 3.1 0 5.4 2.9 4.3 6.2C19.5 15.4 12 20 12 20z"/></svg></button></article>`;

  // ---------- wishlist ----------
  const WK = "bk_wish_v1";
  const getW = () => { try { return JSON.parse(localStorage.getItem(WK)) || []; } catch { return []; } };
  const setW = (w) => { try { localStorage.setItem(WK, JSON.stringify(w)); } catch {} paintWish(); };
  function paintWish() {
    const w = getW();
    $$("[data-wish]").forEach((b) => { const on = w.includes(b.dataset.wish); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
    $$("[data-wish-count]").forEach((el) => { el.textContent = w.length; el.hidden = !w.length; });
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-wish]"); if (!b) return;
    e.preventDefault(); const w = getW(); const s2 = b.dataset.wish; const on = w.includes(s2);
    setW(on ? w.filter((x) => x !== s2) : [s2, ...w].slice(0, 60));
    if (!on) { toast("Saved to wishlist ♥"); track("AddToWishlist", { content_ids: [s2] }); }
    if ($("[data-wish-grid]") && on) renderWishPage();
  });
  async function renderWishPage() {
    const g = $("[data-wish-grid]"); if (!g) return;
    const cat = await catalog(); const w = getW().filter((x) => cat.products[x]);
    g.innerHTML = w.map((x) => miniCard(x, cat.products[x])).join(""); $("[data-wish-empty]").hidden = !!w.length; paintWish();
  }
  paintWish(); renderWishPage().catch(() => {});

  // ---------- recently viewed ----------
  const RK = "bk_recent_v1";
  const getR = () => { try { return JSON.parse(localStorage.getItem(RK)) || []; } catch { return []; } };
  const here = $("[data-product]")?.dataset.product;
  if (here) { try { localStorage.setItem(RK, JSON.stringify([here, ...getR().filter((x) => x !== here)].slice(0, 12))); } catch {} }
  (async () => {
    const box = $("[data-recent]"); if (!box) return;
    const list = getR().filter((x) => x !== here); if (!list.length) return;
    const cat = await catalog(); const items = list.filter((x) => cat.products[x]).slice(0, 4); if (!items.length) return;
    $("[data-recent-grid]").innerHTML = items.map((x) => miniCard(x, cat.products[x])).join(""); box.hidden = false; paintWish();
  })().catch(() => {});

  // ---------- listing filters (?fabric=Cotton / ?print=Hand Block Print) ----------
  if (grid) {
    const sels = $$("[data-filter]"); const params = new URLSearchParams(location.search);
    const empty = $("[data-filter-empty]");
    const apply = () => {
      const want = Object.fromEntries(sels.map((s2) => [s2.dataset.filter, s2.value]));
      for (const k of ["fabric", "print"]) if (!sels.find((s2) => s2.dataset.filter === k) && params.get(k)) want[k] = params.get(k);
      let shown = 0;
      $$(".card", grid).forEach((c) => {
        const ok = (!want.fabric || c.dataset.fabric === want.fabric) && (!want.print || (c.dataset.print || "").split("|").includes(want.print));
        c.hidden = !ok; if (ok) shown++;
      });
      if (empty) empty.hidden = shown > 0;
    };
    sels.forEach((s2) => { const v = params.get(s2.dataset.filter); if (v && [...s2.options].some((o) => o.value === v)) s2.value = v; s2.addEventListener("change", () => { const q2 = new URLSearchParams(location.search); s2.value ? q2.set(s2.dataset.filter, s2.value) : q2.delete(s2.dataset.filter); history.replaceState(null, "", location.pathname + (q2.toString() ? "?" + q2 : "")); apply(); }); });
    $("[data-filter-clear]")?.addEventListener("click", () => { sels.forEach((s2) => (s2.value = "")); history.replaceState(null, "", location.pathname); params.delete("fabric"); params.delete("print"); apply(); });
    if (params.get("fabric") || params.get("print")) apply();
  }

  // ---------- size chart ----------
  const sm = $("[data-size-modal]");
  $$("[data-open-size]").forEach((b) => b.addEventListener("click", () => { if (sm?.showModal) sm.showModal(); }));
  $$("[data-close-size]").forEach((b) => b.addEventListener("click", () => sm?.close()));
  sm?.addEventListener("click", (e) => { if (e.target === sm) sm.close(); });

  // ---------- reel viewer (tap a reel: plays with sound + shop the product) ----------
  const rm = $("[data-reel-modal]"), stage = $("[data-reel-stage]");
  let ri = 0;
  function showReel(i) {
    const list = BK.reels || []; if (!list.length || !stage) return;
    ri = (i + list.length) % list.length; renderStage(list[ri], list.length > 1);
  }
  function renderStage(r, nav) {
    stage.innerHTML = `${r.ig ? `<iframe class="reel-ig-full" src="${esc(r.ig)}" title="Instagram reel" scrolling="no" allow="autoplay; encrypted-media"></iframe>` : r.video ? `<video src="${esc(r.video)}"${r.cover ? ` poster="${esc(r.cover)}"` : ""} playsinline autoplay loop controls></video>` : `<img src="${esc(r.cover)}" alt="">`}
      ${nav ? `<button class="reel-nav prev" data-rn="-1" aria-label="Previous reel">‹</button><button class="reel-nav next" data-rn="1" aria-label="Next reel">›</button>` : ""}
      <div class="reel-info">${r.caption ? `<p>${esc(r.caption)}</p>` : ""}
      ${r.product ? `<a class="reel-prod big" href="${esc(r.product.url)}"><img src="${esc(r.product.image)}" alt="" width="60" height="90"><span><em>${esc(r.product.title)}</em><span class="card-price">${r.product.price}</span></span><b>Shop now</b></a>` : ""}
      ${r.link ? `<a class="link light" href="${esc(r.link)}" target="_blank" rel="noopener">Watch on ${/facebook|fb\.watch/i.test(r.link) ? "Facebook" : "Instagram"} →</a>` : ""}</div>`;
    $$("[data-rn]", stage).forEach((b) => b.addEventListener("click", () => showReel(ri + +b.dataset.rn)));
    const v = $("video", stage); if (v) v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
  }
  // floating mini reel (corner video)
  const mini = $("[data-mini]");
  if (mini) {
    let hide = false; try { hide = sessionStorage.getItem("bk_mini_x") === "1"; } catch {}
    if (hide || matchMedia("(prefers-reduced-motion: reduce)").matches) mini.remove();
    else {
      const mv = $("video", mini);
      const showMini = () => { if (mini.classList.contains("show")) return; if (mv && mv.dataset.src) { mv.src = mv.dataset.src; mv.preload = "metadata"; mv.play().catch(() => {}); } mini.classList.add("show"); };
      const gal = $(".gallery");
      if (gal && "IntersectionObserver" in window) { const io3 = new IntersectionObserver(([e]) => { if (!e.isIntersecting && e.boundingClientRect.top < 0) { showMini(); io3.disconnect(); } }); io3.observe(gal); }
      else { const onS = () => { if (scrollY > 520) { showMini(); removeEventListener("scroll", onS); } }; addEventListener("scroll", onS, { passive: true }); }
      $("[data-mini-close]", mini).addEventListener("click", () => { mini.remove(); try { sessionStorage.setItem("bk_mini_x", "1"); } catch {} });
      $("[data-mini-open]", mini).addEventListener("click", () => { if (!rm?.showModal || !BK.mini) { if (BK.mini?.product) location.href = BK.mini.product.url; return; } renderStage(BK.mini, false); rm.showModal(); document.documentElement.classList.add("locked"); });
    }
  }
  $$("[data-reel-open]").forEach((b) => b.addEventListener("click", () => {
    if (!rm?.showModal) { const r = (BK.reels || [])[+b.dataset.reelOpen]; if (r?.product) location.href = r.product.url; return; }
    showReel(+b.dataset.reelOpen); rm.showModal(); document.documentElement.classList.add("locked");
  }));
  const closeReel = () => { rm?.close(); };
  $("[data-reel-close]")?.addEventListener("click", closeReel);
  rm?.addEventListener("click", (e) => { if (e.target === rm) closeReel(); });
  rm?.addEventListener("close", () => { stage.innerHTML = ""; unlockIfFree(); });

  // ---------- wholesale enquiry → WhatsApp ----------
  const bf = $("[data-b2b-form]");
  bf?.addEventListener("submit", (e) => {
    e.preventDefault(); if (!bf.reportValidity()) return;
    const f = Object.fromEntries(new FormData(bf)); for (const k in f) f[k] = String(f[k]).trim();
    const txt = `Wholesale / private label enquiry\n\nName: ${f.name}\nBusiness: ${f.business || "-"}\nCountry: ${f.country}\nType: ${f.type}\nProducts: ${f.products || "-"}\nQuantity: ${f.qty || "-"}\nDetails: ${f.msg || "-"}`;
    track("Lead", { content_name: "wholesale" });
    sendSheet({ type: "wholesale", name: f.name, phone: f.phone || "", email: f.email || "", country: f.country, items: `${f.type} | ${f.business || "-"} | ${f.products || "-"} | qty ${f.qty || "-"} | ${f.msg || ""}`, consent: "no" });
    if (BK.wa) window.open(`https://wa.me/${BK.wa}?text=${encodeURIComponent(txt)}`, "_blank", "noopener");
    else if (BK.email) location.href = `mailto:${BK.email}?subject=${encodeURIComponent("Wholesale enquiry")}&body=${encodeURIComponent(txt)}`;
  });

  // ---------- search (instant, from catalog) ----------
  const srm = $("[data-search-modal]"), sin = $("[data-search-input]"), sres = $("[data-search-results]");
  const norm = (t) => String(t || "").toLowerCase();
  // Ask Bahe: Hinglish search – "laal kurti shaadi ke liye 1500 tak XL"
  const SQ = {
    col: { red: "laal lal red", pink: "gulabi rani pink", yellow: "peela pila haldi yellow mustard", blue: "neela nila blue indigo navy", green: "hara green olive bottle", white: "safed white off-white cream", black: "kala kaala black", orange: "narangi orange rust", purple: "baingani jamuni purple wine maroon", peach: "peach", beige: "beige", grey: "grey gray" },
    occ: { wedding: "shaadi shadi wedding sangeet reception", haldi: "haldi mehendi mehndi", office: "office work", daily: "daily roz casual everyday", party: "party", festive: "festive festival tyohar diwali teej eid navratri karwa", gift: "gift gifting" },
    cat: { kurti: "kurti kurta kurtis kurtas", set: "suit set sets dupatta", dress: "dress frock gown dresses", "co-ord": "coord co-ord cord", top: "top tunic", palazzo: "palazzo pant pants" },
    stop: new Set("for ke ki ka liye chahiye wala wali show me dikhao in a the and with under below upto up to tak se kam rs inr size mujhe koi hai please".split(" ")),
  };
  const findKey = (map, w) => Object.keys(map).find((k) => map[k].split(" ").includes(w));
  function parseQ(raw) {
    const q = norm(raw).replace(/₹|rs\.?/g, " ").replace(/\s+/g, " ").trim(), it = { words: [], chips: [] };
    let m = q.match(/(\d{3,6})\s*(?:-|to|se)\s*(\d{3,6})/); if (m) { it.min = +m[1]; it.max = +m[2]; it.chips.push([`${m[1]}–${m[2]}`, m[0]]); }
    else if ((m = q.match(/(?:under|below|upto|up to|less than|max|within)\s*\$?\s*(\d{2,6})/) || q.match(/\$?(\d{2,6})\s*(?:tak|se kam|ke andar|ke neeche|or less)/))) { it.max = +m[1]; it.chips.push([`Under ${m[1]}`, m[0]]); }
    it.usd = /\$/.test(raw) || (isUSD() && !/₹|rs/i.test(raw));
    m = q.match(/\b(free size|xxs|xs|xxl|2xl|3xl|4xl|5xl|xl)\b/) || q.match(/\bsize\s*(s|m|l)\b/); if (m) { it.size = m[1] === "2xl" ? "XXL" : m[1].replace("free size", "Free Size").toUpperCase(); it.chips.push([`Size ${it.size}`, m[0]]); }
    const rest = q.replace(it.chips.map((c) => c[1]).join("|") ? new RegExp(it.chips.map((c) => c[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g") : /^$/, " ");
    for (const w of rest.split(/\s+/).filter(Boolean)) {
      let k;
      if ((k = findKey(SQ.col, w))) { it.col = k; it.chips.push([k[0].toUpperCase() + k.slice(1), w]); }
      else if ((k = findKey(SQ.occ, w))) { it.occ = k; it.chips.push([k[0].toUpperCase() + k.slice(1), w]); }
      else if ((k = findKey(SQ.cat, w))) { it.cat = k; it.chips.push([k[0].toUpperCase() + k.slice(1), w]); }
      else if (!SQ.stop.has(w) && !/^\d+$/.test(w)) it.words.push(w.replace(/s$/, ""));
    }
    return it;
  }
  function rankQ(cat, it, relax = {}) {
    return Object.entries(cat.products).map(([k, p]) => {
      const pr = it.usd ? p.price_usd : p.price;
      if (!relax.price && (it.max || it.min)) { if (pr == null || (it.max && pr > it.max) || (it.min && pr < it.min)) return null; }
      if (!relax.size && it.size && !((p.sizes || []).map((s) => String(s).toUpperCase()).includes(it.size) && !(p.out || []).map((s) => String(s).toUpperCase()).includes(it.size))) return null;
      const hay = norm([p.title, p.cat, p.fabric, p.print, p.color, (p.occ || []).join(" ")].join(" "));
      let sc = 0, need = 0;
      if (it.col) { need++; if (SQ.col[it.col].split(" ").some((c) => hay.includes(c))) sc += 3; }
      if (it.occ) { need++; if (SQ.occ[it.occ].split(" ").some((c) => hay.includes(c)) || norm((p.occ || []).join(" ")).includes(it.occ)) sc += 3; }
      if (it.cat) { need++; if (SQ.cat[it.cat].split(" ").some((c) => hay.includes(c.replace(/s$/, "")))) sc += 2; }
      for (const w of it.words) { need++; if (hay.includes(w)) sc += 1; }
      if (need && !sc) return null;
      return [k, p, sc + (p.in_stock === false ? 0 : 0.5)];
    }).filter(Boolean).sort((a, b) => b[2] - a[2]);
  }
  async function runSearch() {
    const raw = sin.value, q = norm(raw).trim(); if (!q) { sres.innerHTML = ""; return; }
    const cat = await catalog(), it = parseQ(raw);
    let hits = rankQ(cat, it), note = "";
    if (!hits.length && (it.max || it.min)) { hits = rankQ(cat, it, { price: true }); if (hits.length) note = "Is budget mein nahi mila – baaki options dikha rahe hain."; }
    if (!hits.length && it.size) { hits = rankQ(cat, it, { price: true, size: true }); if (hits.length) note = `Size ${it.size} abhi nahi – baaki sizes mein ye hain.`; }
    const chips = it.chips.length ? `<div class="sq-chips">${it.chips.map((c) => `<button type="button" class="pill" data-sq-x="${esc(c[1])}">${esc(c[0])} ✕</button>`).join("")}</div>` : "";
    sres.innerHTML = chips + (note ? `<p class="muted small">${esc(note)}</p>` : "") + (hits.length ? `<div class="grid">${hits.slice(0, 12).map(([k, p]) => miniCard(k, p)).join("")}</div>` : `<p class="muted">No styles found for “${esc(raw)}”. ${BK.wa ? `<a class="link" href="https://wa.me/${BK.wa}?text=${encodeURIComponent("Hi! I am looking for: " + raw)}" target="_blank" rel="noopener">Ask us on WhatsApp →</a>` : ""}</p>`);
    $$("[data-sq-x]", sres).forEach((b) => b.addEventListener("click", () => { sin.value = norm(sin.value).replace(b.dataset.sqX, " ").replace(/\s+/g, " ").trim(); runSearch(); }));
    paintWish(); track("Search", { search_string: raw });
  }
  try { const dq = new URLSearchParams(location.search).get("q"); if (dq && srm?.showModal) setTimeout(() => { srm.showModal(); document.documentElement.classList.add("locked"); sin.value = dq; runSearch(); }, 300); } catch {}
  let st;
  sin?.addEventListener("input", () => { clearTimeout(st); st = setTimeout(runSearch, 180); });
  $$("[data-sugg]").forEach((b) => b.addEventListener("click", () => { sin.value = b.dataset.sugg; runSearch(); }));
  $$("[data-open-search]").forEach((b) => b.addEventListener("click", () => { closeAll(); if (srm?.showModal) { srm.showModal(); document.documentElement.classList.add("locked"); setTimeout(() => sin?.focus(), 50); } }));
  $("[data-close-search]")?.addEventListener("click", () => srm.close());
  srm?.addEventListener("close", unlockIfFree);
  srm?.addEventListener("click", (e) => { if (e.target === srm) srm.close(); });

  // ---------- hero slider ----------
  const hero = $("[data-hero]");
  if (hero) {
    // scheduled banners: hide slides outside their start/end dates
    const dnow = new Date().toISOString().slice(0, 10), allS = $$(".hero-slide", hero);
    const off = allS.filter((x) => (x.dataset.start && x.dataset.start > dnow) || (x.dataset.end && x.dataset.end < dnow));
    if (off.length && off.length < allS.length) { off.forEach((x) => x.remove()); const dots = $$("[data-hero-go]", hero); dots.slice(allS.length - off.length).forEach((d) => d.remove()); $$("[data-hero-go]", hero).forEach((d, k) => (d.dataset.heroGo = k)); const first = $(".hero-slide", hero); if (first) { first.classList.add("on"); first.inert = false; first.removeAttribute("aria-hidden"); } }
    const sl = $$(".hero-slide", hero), hd = $$("[data-hero-go]", hero); let hi = 0, ht;
    const track = $("[data-hero-track]", hero);
    const show = (i) => { hi = (i + sl.length) % sl.length; if (track) track.style.transform = `translateX(-${hi * 100}%)`; sl.forEach((x, k) => { x.classList.toggle("on", k === hi); x.setAttribute("aria-hidden", k !== hi); x.inert = k !== hi; }); hd.forEach((d, k) => d.classList.toggle("on", k === hi)); };
    const auto = () => { clearInterval(ht); if (sl.length > 1 && !matchMedia("(prefers-reduced-motion: reduce)").matches) ht = setInterval(() => show(hi + 1), 5000); };
    $$("[data-hero-step]", hero).forEach((b) => b.addEventListener("click", () => { show(hi + +b.dataset.heroStep); auto(); }));
    hero.addEventListener("mouseenter", () => clearInterval(ht)); hero.addEventListener("mouseleave", auto);
    hero.addEventListener("focusin", () => clearInterval(ht)); hero.addEventListener("focusout", (e) => { if (!hero.contains(e.relatedTarget)) auto(); });
    hd.forEach((d) => d.addEventListener("click", () => { show(+d.dataset.heroGo); auto(); }));
    let x0 = null; hero.addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
    hero.addEventListener("touchend", (e) => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) { show(hi + (dx < 0 ? 1 : -1)); auto(); } x0 = null; });
    auto();
  }

  // ---------- sign-in dialog (name + mobile, or Google) ----------
  const lm = $("[data-login-modal]"), lf = $("[data-login-form]"), ld = $("[data-login-done]");
  const openLogin = () => {
    if (!lm?.showModal) return; const u0 = getUser();
    lf.hidden = !!u0; ld.hidden = !u0; if (u0) $("[data-login-name]").textContent = (u0.name || "").split(" ")[0];
    if (!lm.open) { lm.showModal(); document.documentElement.classList.add("locked"); }
    if (!u0) loadGoogle();
  };
  $$("[data-open-login]").forEach((b) => b.addEventListener("click", () => { closeAll(); openLogin(); }));
  $$("[data-close-login]").forEach((b) => b.addEventListener("click", () => lm.close()));
  lm?.addEventListener("close", unlockIfFree);
  lm?.addEventListener("click", (e) => { if (e.target === lm) lm.close(); });
  $("[data-logout]")?.addEventListener("click", () => { setUser(null); lm.close(); toast("Signed out"); });
  lf?.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(lf)); for (const k in f) f[k] = String(f[k]).trim();
    if (!f.name || f.phone.replace(/\D/g, "").length < 7) { lf.reportValidity(); return; }
    const x = { name: f.name, phone: f.phone, email: f.email || getUser()?.email || "", consent: f.consent === "yes", via: getUser()?.via || "form" };
    setUser(x); sendSheet({ type: "signup", ...x, consent: x.consent ? "yes" : "no" });
    track("CompleteRegistration", { content_name: "sign-in" });
    toast(`Welcome, ${x.name.split(" ")[0]}!`); openLogin();
  });
  // Google sign-in (only when a Google Client ID is set in admin)
  let gLoaded = false;
  function loadGoogle() {
    const box = $("[data-google-btn]"); if (!BK.gid || !box || gLoaded) return; gLoaded = true;
    const sc = document.createElement("script"); sc.src = "https://accounts.google.com/gsi/client"; sc.async = true;
    sc.onload = () => { try {
      window.google.accounts.id.initialize({ client_id: BK.gid, callback: (r) => {
        try { const p = JSON.parse(decodeURIComponent(escape(atob(r.credential.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))))); 
          lf.name.value = p.name || ""; lf.email.value = p.email || ""; setUser({ ...(getUser() || {}), name: p.name, email: p.email, via: "google" }); lf.hidden = false; ld.hidden = true;
          sendSheet({ type: "google", name: p.name, email: p.email }); toast("Almost done – add your WhatsApp number"); lf.phone.focus(); } catch {}
      } });
      window.google.accounts.id.renderButton(box, { theme: "outline", size: "large", width: 300, text: "continue_with" });
    } catch {} };
    document.head.appendChild(sc);
  }
  // gentle invite once in 14 days (never on checkout)
  (() => {
    if (!BK.popup || getUser() || co || !lm || document.body.classList.contains("mirror-page") || document.body.classList.contains("feed-page") || document.body.classList.contains("dash-page")) return;
    let last = 0; try { last = +localStorage.getItem("bk_invite") || 0; } catch {}
    if (Date.now() - last < 14 * 864e5) return;
    const tryInvite = () => { if (document.querySelector("dialog[open]") || document.documentElement.classList.contains("locked")) return setTimeout(tryInvite, 15000); try { localStorage.setItem("bk_invite", Date.now()); } catch {} openLogin(); };
    setTimeout(tryInvite, 25000);
  })();
  // checkout: fill saved details + note an unfinished checkout once
  if (co) {
    const u0 = getUser(), form = $("[data-co-form]");
    if (u0 && form) { for (const k of ["name", "phone", "email", "address", "city", "state", "pincode", "country"]) if (u0[k] && form[k] && !form[k].value) form[k].value = u0[k]; }
    let sent = false;
    form?.phone?.addEventListener("blur", async () => {
      if (sent) return; const ph = form.phone.value.replace(/\D/g, ""); if (ph.length < 7 || !form.name.value.trim()) return; sent = true;
      const cat = await catalog().catch(() => null);
      sendSheet({ type: "checkout_started", name: form.name.value.trim(), phone: form.phone.value.trim(), email: (form.email?.value || "").trim(), city: (form.city?.value || "").trim(), consent: $("[data-co-consent]")?.checked ? "yes" : "no", items: cat ? bag.map((i) => `${cat.products[i.slug]?.title} ${i.size || ""} x${i.qty}`).join("; ") : "" });
    });
  }
  paintUser();

  // ---------- delivery date estimate (pincode / international) ----------
  const fmtD = (d) => d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  const addWork = (n) => { const d = new Date(); let k = 0; while (k < n) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0) k++; } return d; };
  const pf = $("[data-pin-form]"), pin = $("[data-pin]"), pout = $("[data-deliv-out]");
  const showEta = () => {
    const sh = BK.ship || { dispatch: 3, min: 3, max: 7, local: 2, intlMin: 7, intlMax: 12 };
    if (isUSD()) { pout.innerHTML = `Ships from Jaipur in ${sh.dispatch} days · arrives in about <b>${sh.intlMin}–${sh.intlMax} days</b> after dispatch (estimate).`; return; }
    const v = (pin.value || "").replace(/\D/g, ""); if (!/^[1-9]\d{5}$/.test(v)) { pout.textContent = "Enter a valid 6-digit pincode."; return; }
    const raj = /^3[0-4]/.test(v), lo = sh.dispatch + (raj ? 1 : sh.min), hi = sh.dispatch + (raj ? sh.local : sh.max);
    pout.innerHTML = `Estimated delivery: <b>${fmtD(addWork(lo))} – ${fmtD(addWork(hi))}</b> <span class="muted">(prepaid, not guaranteed)</span>`;
    try { localStorage.setItem("bk_pin", v); } catch {}
  };
  if (pf) {
    try { const sv = localStorage.getItem("bk_pin"); if (sv) { pin.value = sv; showEta(); } } catch {}
    if (isUSD()) { pin.closest(".pin-row").hidden = true; showEta(); }
    pf.addEventListener("submit", (e) => { e.preventDefault(); showEta(); });
  }
  if (co) { try { const sv = localStorage.getItem("bk_pin"); const f2 = $("[data-co-form]"); if (sv && f2?.pincode && !f2.pincode.value && !isUSD()) f2.pincode.value = sv; } catch {} }

  // ---------- sold-out size → notify me on WhatsApp ----------
  function openNotify(slug, sz) {
    let box = $("[data-notify]");
    if (!box) { box = document.createElement("div"); box.className = "notify"; box.setAttribute("data-notify", ""); $(".sizes")?.after(box); }
    const u0 = getUser() || {};
    box.innerHTML = `<p><b>Size ${esc(sz)} is sold out.</b> Get a WhatsApp message when it is back.</p><div class="pin-row"><input type="tel" placeholder="WhatsApp number" value="${esc(u0.phone || "")}" maxlength="18" data-n-phone><button class="btn" type="button" data-n-go>Notify me</button></div><label class="check"><input type="checkbox" data-n-ok> Yes, message me on WhatsApp about this size</label>`;
    $("[data-n-go]", box).onclick = () => { const ph = $("[data-n-phone]", box).value.trim(); if (ph.replace(/\D/g, "").length < 7 || !$("[data-n-ok]", box).checked) { toast("Enter your WhatsApp number and tick the box"); return; } sendSheet({ type: "restock", name: u0.name || "", phone: ph, items: `${slug} | size ${sz}`, consent: "yes" }); box.innerHTML = `<p>✓ Done! We will message you when size ${esc(sz)} is back.</p>`; };
  }

  // ---------- share: ask family on WhatsApp, copy link, add complete look ----------
  $("[data-share]")?.addEventListener("click", async () => {
    const title = $(".buybox h1")?.textContent || document.title, link = location.origin + location.pathname + "?utm_source=whatsapp&utm_medium=share&utm_campaign=ask_family";
    const text = `Kaisa lag raha hai? 👗 ${title}\n${link}`;
    try { const im = $(".slide img"); if (navigator.canShare && im) { const b = await (await fetch(im.currentSrc || im.src)).blob(); const file = new File([b], "bahe-kurtiz.jpg", { type: b.type || "image/jpeg" }); if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; } } } catch (e) { if (e?.name === "AbortError") return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  });
  $("[data-copy-link]")?.addEventListener("click", async () => { try { await navigator.clipboard.writeText(location.origin + location.pathname); toast("Link copied"); } catch { toast(location.href); } });
  $("[data-add-look]")?.addEventListener("click", async (e) => {
    const slugs = e.currentTarget.dataset.addLook.split(",");
    const cat = await catalog().catch(() => null); if (!cat) return; const mySize = $(".size.on")?.dataset.size || "";
    if ($$(".size").length && !mySize) { toast("Please select your size first"); $(".sizes")?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    const b = [...bag]; for (const sl of slugs) { const p = cat.products[sl]; if (!p || !p.price) continue; const sz = p.sizes?.includes(mySize) ? mySize : (p.sizes?.length ? p.sizes[0] : ""); const f = b.find((i) => i.slug === sl && i.size === sz); if (f) f.qty++; else b.push({ slug: sl, size: sz, qty: 1 }); }
    setBag(b); openCart(); toast("Complete look added – check sizes in your bag");
  });

  // ---------- share wishlist (#ids=…) ----------
  const wg = $("[data-wish-grid]");
  if (wg) {
    const m = location.hash.match(/ids=([\w,-]+)/);
    if (m) { const ids = m[1].split(",").filter(Boolean).slice(0, 40); (async () => { const cat = await catalog().catch(() => null); if (!cat) return; const ok = ids.filter((x) => cat.products[x]); if (!ok.length) return; ($("[data-wish-empty]") || wg).insertAdjacentHTML("beforebegin", `<div class="shared-wish"><p><b>Someone shared these picks with you 💝</b></p><button class="btn btn-ghost" type="button" data-wish-all>Save all to my wishlist</button></div><div class="grid">${ok.map((x) => miniCard(x, cat.products[x])).join("")}</div><h2 class="mt">My wishlist</h2>`); $("[data-wish-all]").onclick = () => { setW([...new Set([...ok, ...getW()])]); renderWishPage(); toast("Saved"); }; paintWish(); })(); }
    const sb = document.createElement("button"); sb.className = "btn btn-wa"; sb.type = "button"; sb.textContent = "Share my wishlist on WhatsApp";
    sb.onclick = () => { const w = getW(); if (!w.length) { toast("Your wishlist is empty"); return; } const link = `${location.origin}${location.pathname}#ids=${w.join(",")}`; window.open(`https://wa.me/?text=${encodeURIComponent("Meri pasand dekho 💝 " + link)}`, "_blank", "noopener"); };
    wg.after(sb);
  }

  // ---------- festival countdown ----------
  const fest = $("[data-fest]");
  if (fest) { const d = new Date((isUSD() ? fest.dataset.us : fest.dataset.in) + "T23:59:59"); const left = Math.ceil((d - new Date()) / 864e5); const el = $("[data-fest-left]", fest); if (left < 0) fest.remove(); else if (el) el.textContent = left === 0 ? "· last day!" : `· ${left} day${left > 1 ? "s" : ""} left`; }

  // ---------- installable app ----------
  if ("serviceWorker" in navigator && location.protocol === "https:") addEventListener("load", () => navigator.serviceWorker.register(url("sw.js")).catch(() => {}));

  // ---------- QR codes (craft passport + printable tags) ----------
  let qrLib;
  const loadQR = () => (qrLib ||= new Promise((res, rej) => { if (window.QRCode) return res(); const sc = document.createElement("script"); sc.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"; sc.onload = res; sc.onerror = rej; document.head.appendChild(sc); }));
  const drawQR = (root = document) => { const boxes = $$("[data-qr-box]", root).filter((b) => !b.dataset.done); if (!boxes.length) return; loadQR().then(() => boxes.forEach((b) => { b.dataset.done = 1; try { new window.QRCode(b, { text: b.dataset.qr, width: 112, height: 112, colorDark: "#0e5b59", colorLight: "#ffffff" }); } catch {} })).catch(() => {}); };
  $("[data-passport]")?.addEventListener("toggle", (e) => { if (e.target.open) drawQR(e.target); });
  if (document.body.classList.contains("tags-page")) drawQR();

  // ---------- voice search (Hindi + English) ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition, mic = $("[data-mic]");
  if (SR && mic && sin) {
    mic.hidden = false;
    const HI = { "कुर्ती": "kurti", "कुर्ता": "kurta", "ड्रेस": "dress", "सूट": "set", "सेट": "set", "सूती": "cotton", "कॉटन": "cotton", "रेयॉन": "rayon", "लिनन": "linen", "जॉर्जेट": "georgette", "अनारकली": "anarkali", "दुपट्टा": "dupatta", "प्लाज़ो": "palazzo", "पलाज़ो": "palazzo", "प्रिंट": "print", "ब्लॉक": "block", "बगरू": "bagru", "दाबू": "dabu", "सांगानेरी": "sanganeri", "लाल": "red", "नीला": "blue", "नीली": "blue", "हरा": "green", "हरी": "green", "पीला": "yellow", "पीली": "yellow", "गुलाबी": "pink", "काला": "black", "काली": "black", "सफ़ेद": "white", "सफेद": "white", "मैरून": "maroon", "शादी": "wedding", "त्योहार": "festive", "ऑफिस": "office" };
    mic.addEventListener("click", () => {
      const r = new SR(); r.lang = "hi-IN"; r.interimResults = false; r.maxAlternatives = 1;
      mic.classList.add("listening"); sin.placeholder = "Boliye… (Hindi ya English)";
      r.onresult = (e) => { let t = e.results[0][0].transcript || ""; t = t.replace(/(\d[\d,]*)\s*(से कम|se kam|ke andar|के अंदर|under)/gi, "").split(/\s+/).map((w) => HI[w] || w).join(" ").trim(); sin.value = t; runSearch(); };
      r.onend = () => { mic.classList.remove("listening"); sin.placeholder = "Search kurtis, dresses, block print, cotton…"; };
      r.onerror = () => toast("Mic not available – please type"); try { r.start(); } catch {}
    });
  }

  // ---------- "Picked for you" (from what this visitor viewed) ----------
  (async () => {
    const fy = $("[data-foryou]"); if (!fy) return; const seen = getR(); if (!seen.length) return;
    const cat = await catalog().catch(() => null); if (!cat) return;
    const likes = { cat: {}, fab: {} }; seen.forEach((k) => { const p = cat.products[k]; if (!p) return; likes.cat[p.cat] = (likes.cat[p.cat] || 0) + 2; if (p.fabric) likes.fab[p.fabric] = (likes.fab[p.fabric] || 0) + 1; });
    const ranked = Object.entries(cat.products).filter(([k, p]) => !seen.includes(k) && p.price).map(([k, p]) => [k, (likes.cat[p.cat] || 0) + (likes.fab[p.fabric] || 0)]).filter(([, sc]) => sc > 0).sort((a, b) => b[1] - a[1]).slice(0, 8);
    if (ranked.length < 2) return; $("[data-foryou-grid]").innerHTML = ranked.map(([k]) => miniCard(k, cat.products[k])).join(""); fy.hidden = false; paintWish();
  })();

  // ---------- Style Finder (3 taps) ----------
  const fm = $("[data-finder]"), fb = $("[data-finder-body]");
  if (fm && fb) {
    const ans = {};
    const steps = [
      { k: "occ", q: "What is the occasion?", opts: () => (BK.occasions?.length ? BK.occasions : ["Daily", "Office", "Festive"]).concat(["Anything"]) },
      { k: "fab", q: "Which fabric do you like?", opts: () => (BK.fabrics?.length ? BK.fabrics : ["Cotton", "Rayon"]).slice(0, 8).concat(["Any fabric"]) },
      { k: "bud", q: "Your budget?", opts: () => (isUSD() ? ["Under $20", "$20–40", "$40+", "Any budget"] : ["Under ₹999", "₹1,000–1,999", "₹2,000+", "Any budget"]) },
    ];
    const show = async (n) => {
      if (n < steps.length) { const st = steps[n]; fb.innerHTML = `<p class="eyebrow">Step ${n + 1} of 3</p><h2>${esc(st.q)}</h2><div class="finder-opts">${st.opts().map((o) => `<button class="pill" type="button" data-o="${esc(o)}">${esc(o)}</button>`).join("")}</div>`; $$("[data-o]", fb).forEach((b) => b.onclick = () => { ans[st.k] = b.dataset.o; show(n + 1); }); return; }
      const cat = await catalog().catch(() => null); if (!cat) { fb.innerHTML = "<p>Please check your internet and try again.</p>"; return; }
      const inBud = (p) => { const v = isUSD() ? p.price_usd : p.price; if (v == null) return false; const b = ans.bud || ""; if (/Any/.test(b)) return true; if (isUSD()) return /Under/.test(b) ? v < 20 : /20/.test(b) && /40/.test(b) ? v >= 20 && v <= 40 : v > 40; return /Under/.test(b) ? v < 1000 : /1,000/.test(b) ? v >= 1000 && v < 2000 : v >= 2000; };
      let hits = Object.entries(cat.products).filter(([, p]) => (/Anything/.test(ans.occ) || (p.occ || []).includes(ans.occ)) && (/Any fabric/.test(ans.fab) || p.fabric === ans.fab) && inBud(p));
      let note = ""; if (!hits.length) { hits = Object.entries(cat.products).filter(([, p]) => inBud(p)); note = `<p class="muted">No exact match yet – here are styles in your budget.</p>`; }
      fb.innerHTML = `<p class="eyebrow">Your picks</p><h2>${hits.length} styles for you</h2>${note}<div class="grid finder-grid">${hits.slice(0, 12).map(([k, p]) => miniCard(k, p)).join("")}</div><button class="btn btn-ghost" type="button" data-f-again>Start again</button>`;
      $("[data-f-again]", fb).onclick = () => show(0); paintWish(); track("Search", { search_string: `finder ${ans.occ}|${ans.fab}|${ans.bud}` });
    };
    $$("[data-open-finder]").forEach((b) => b.addEventListener("click", () => { show(0); fm.showModal(); document.documentElement.classList.add("locked"); }));
    $("[data-close-finder]")?.addEventListener("click", () => fm.close());
    fm.addEventListener("close", unlockIfFree); fm.addEventListener("click", (e) => { if (e.target === fm) fm.close(); });
  }

  // ---------- refer & earn ----------
  const myCode = () => { const u0 = getUser(); if (!u0?.phone) return ""; const d = u0.phone.replace(/\D/g, "").slice(-10); let h = 7; for (const ch of d + "bk") h = (h * 31 + ch.charCodeAt(0)) >>> 0; return "BK" + h.toString(36).toUpperCase().slice(-5); };
  const myLink = (path = "") => `${location.origin}/${path}?ref=${myCode()}`;
  const ro = $("[data-refer-out]");
  const paintRefer = () => {
    if (!ro) return; const code = myCode(); if (!code) return;
    const link = myLink();
    ro.innerHTML = `<p class="eyebrow">Your personal link</p><div class="ref-link"><input readonly value="${esc(link)}" aria-label="Your referral link"><button class="btn" type="button" data-ref-copy>Copy</button></div><p>Your code: <b>${code}</b></p><div class="hero-cta"><a class="btn btn-wa" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(`Maine Bahe Kurtiz se hand block print kurtis li hain – bahut sundar hain! 🌸 Mere link se dekho – tumhe welcome offer milega (aur mujhe bhi ek thank-you reward): ${link}`)}">Share on WhatsApp</a><button class="btn btn-ghost" type="button" data-status-home>✨ Make WhatsApp Status</button></div>`;
    $("[data-ref-copy]", ro).onclick = async () => { try { await navigator.clipboard.writeText(link); toast("Link copied"); } catch { toast(link); } };
    $("[data-status-home]", ro).onclick = () => makeStatus(null);
    try { if (localStorage.getItem("bk_ref_sent") !== code) { sendSheet({ type: "referrer", name: getUser()?.name || "", phone: getUser()?.phone || "", ref: code }); localStorage.setItem("bk_ref_sent", code); } } catch {}
  };
  paintRefer();
  const _setUser = setUser; // repaint after sign-in
  lf?.addEventListener("submit", () => setTimeout(paintRefer, 50));

  // ---------- "Make WhatsApp Status" image (1080×1920) ----------
  async function makeStatus(prodEl) {
    toast("Making your status…");
    const W = 1080, H = 1920, cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d");
    const grad = g.createLinearGradient(0, 0, W, H); grad.addColorStop(0, "#093f3e"); grad.addColorStop(1, "#147370"); g.fillStyle = grad; g.fillRect(0, 0, W, H);
    g.fillStyle = "rgba(232,201,131,.12)"; for (let y = 60; y < H; y += 140) for (let x = (y / 140) % 2 ? 130 : 60; x < W; x += 140) { g.beginPath(); g.arc(x, y, 14, 0, 7); g.fill(); }
    const load = (src) => new Promise((res) => { if (!src) return res(null); const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
    const title = prodEl ? ($(".buybox h1")?.textContent || "").trim() : "Hand block printed in Jaipur";
    const priceEl = prodEl ? $(".pdp-price " + (isUSD() ? ".cur-usd .price" : ".cur-inr .price"), document) || $(".pdp-price .price") : null;
    const price = priceEl ? priceEl.textContent.trim() : "";
    const imgSrc = prodEl ? ($(".slide img")?.currentSrc || $(".slide img")?.src) : ($(".hero-slide img")?.currentSrc || "");
    const im = await load(imgSrc), logo = await load($(".logo-img")?.src);
    // photo card
    const cx = 90, cy = 210, cw = W - 180, ch = 1180; g.save(); g.beginPath(); g.roundRect ? g.roundRect(cx, cy, cw, ch, 36) : g.rect(cx, cy, cw, ch); g.clip(); g.fillStyle = "#f6efe2"; g.fillRect(cx, cy, cw, ch);
    if (im) { const r = Math.max(cw / im.width, ch / im.height), iw = im.width * r, ih = im.height * r; g.drawImage(im, cx + (cw - iw) / 2, cy + (ch - ih) / 5, iw, ih); } g.restore();
    if (logo) { const lw = 360, lh = lw * logo.height / logo.width; g.save(); g.filter = "brightness(0) invert(1)"; g.drawImage(logo, (W - lw) / 2, 60, lw, lh); g.restore(); }
    g.fillStyle = "#fff"; g.textAlign = "center"; g.font = "600 58px Georgia, serif";
    const words = title.split(" "); let line = "", y = 1480; const lines = []; for (const w of words) { const t = line ? line + " " + w : w; if (g.measureText(t).width > W - 160) { lines.push(line); line = w; } else line = t; } lines.push(line); lines.slice(0, 2).forEach((l, k) => g.fillText(l, W / 2, y + k * 70));
    if (price) { g.fillStyle = "#e8c983"; g.font = "700 72px Georgia, serif"; g.fillText(price, W / 2, y + 170); }
    g.fillStyle = "#e3eeeb"; g.font = "500 38px system-ui, sans-serif"; g.fillText("Hand block printed in Sanganer, Jaipur", W / 2, 1760);
    const code = myCode(); g.fillStyle = "#fff"; g.font = "600 44px system-ui, sans-serif"; g.fillText(`${location.host}${code ? "  ·  code " + code : ""}`, W / 2, 1840);
    cv.toBlob(async (b) => {
      if (!b) return; const file = new File([b], "bahe-kurtiz-status.jpg", { type: "image/jpeg" });
      const link = prodEl ? location.origin + location.pathname + (code ? "?ref=" + code : "") : myLink();
      try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: link }); return; } } catch (e) { if (e?.name === "AbortError") return; }
      const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "bahe-kurtiz-status.jpg"; a.click(); toast("Status image saved – add it to WhatsApp status");
    }, "image/jpeg", 0.9);
  }
  $("[data-status]")?.addEventListener("click", () => makeStatus($(".product")));

  // ---------- festival calendar (.ics, made on the phone, nothing sent) ----------
  $("[data-ics]")?.addEventListener("click", () => {
    const fs_ = BK.fests || []; if (!fs_.length) return;
    const d8 = (d) => d.replace(/-/g, "");
    const ev = fs_.map((f, k) => `BEGIN:VEVENT\r\nUID:bk-${d8(f.date)}-${k}@bahekurtiz\r\nDTSTAMP:${d8(new Date().toISOString().slice(0, 10))}T000000Z\r\nDTSTART;VALUE=DATE:${d8(f.date)}\r\nSUMMARY:${f.name}\r\nDESCRIPTION:Festive outfits from ${BK.brand}: ${location.origin}/\r\nBEGIN:VALARM\r\nTRIGGER:-P14D\r\nACTION:DISPLAY\r\nDESCRIPTION:${f.name} in 2 weeks – order your outfit\r\nEND:VALARM\r\nEND:VEVENT`).join("\r\n");
    const blob = new Blob([`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//${BK.brand}//Festivals//EN\r\n${ev}\r\nEND:VCALENDAR`], { type: "text/calendar" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "bahe-festivals.ics"; a.click(); toast("Calendar file saved – open it to add reminders");
  });

  // ---------- e-gift card ----------
  const gcf = $("[data-gc-form]");
  gcf?.addEventListener("submit", (e) => {
    e.preventDefault(); if (!gcf.reportValidity()) return; const f = Object.fromEntries(new FormData(gcf)); for (const k in f) f[k] = String(f[k]).trim();
    const amt = isUSD() ? (f.amt_usd || "") : (f.amt || "");
    const txt = `GIFT CARD order\n\nAmount: ${amt}${isUSD() ? " USD" : ""}\nFor: ${f.to}${f.to_phone ? " (" + f.to_phone + ")" : ""}\nMessage: ${f.msg || "-"}\n\nFrom: ${f.from}\nPhone: ${f.from_phone}\nPayment: prepaid – please share payment details${refText()}`;
    sendSheet({ type: "gift_card", name: f.from, phone: f.from_phone, items: `Gift card ${amt} for ${f.to}`, consent: "no" });
    if (BK.wa) window.open(`https://wa.me/${BK.wa}?text=${encodeURIComponent(txt)}`, "_blank", "noopener");
  });
  const gcm = $("[data-gc-make]");
  gcm?.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!gcm.reportValidity()) return; const f = Object.fromEntries(new FormData(gcm)); for (const k in f) f[k] = String(f[k]).trim();
    const W = 1200, H = 750, cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d");
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, "#3b0d1f"); gr.addColorStop(1, "#7a1f3d"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = "rgba(232,201,131,.14)"; for (let y = 40; y < H; y += 110) for (let x = (y / 110) % 2 ? 95 : 40; x < W; x += 110) { g.beginPath(); g.arc(x, y, 12, 0, 7); g.fill(); }
    g.strokeStyle = "#e8c983"; g.lineWidth = 4; g.strokeRect(36, 36, W - 72, H - 72);
    const logo = await new Promise((r) => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(null); im.src = $(".logo-img")?.src || ""; });
    if (logo) { const lw = 300, lh = lw * logo.height / logo.width; g.save(); g.filter = "brightness(0) invert(1)"; g.drawImage(logo, 80, 80, lw, lh); g.restore(); }
    g.fillStyle = "#e8c983"; g.font = "600 40px system-ui, sans-serif"; g.fillText("E-GIFT CARD", 80, 300);
    g.fillStyle = "#fff"; g.font = "600 76px Georgia, serif"; g.fillText(`For ${f.to}`, 80, 400);
    g.fillStyle = "#e8c983"; g.font = "700 96px Georgia, serif"; g.fillText(f.amt, 80, 520);
    g.fillStyle = "#fff"; g.font = "600 40px ui-monospace, monospace"; g.fillText(`Code: ${f.code}`, 80, 610);
    g.font = "400 30px system-ui, sans-serif"; g.fillStyle = "#f6e7c8"; g.fillText(`Redeem: ${location.host}/redeem/?c=${f.code}`, 80, 670);
    cv.toBlob(async (b) => { const file = new File([b], "bahe-gift-card.png", { type: "image/png" }); const link = `${location.origin}/redeem/?c=${encodeURIComponent(f.code)}`;
      try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: `🎁 A gift for you from ${BK.brand}! ${link}` }); return; } } catch (er) { if (er?.name === "AbortError") return; }
      const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "bahe-gift-card.png"; a.click(); toast("Gift card image saved"); }, "image/png");
  });
  const rd = $("[data-redeem]");
  if (rd) { const c = new URLSearchParams(location.search).get("c"); if (c && /^[A-Za-z0-9-]{4,24}$/.test(c)) { try { localStorage.setItem("bk_gc", c); } catch {} $("[data-redeem-code]").textContent = c; } }

  // ---------- stories (tap through, hold to pause, swipe down to close) ----------
  const smd = $("[data-story-modal]"), sst = $("[data-story-stage]");
  if (smd && (BK.stories || []).length) {
    let si = 0, sj = 0, tmr = null, paused = false, t0 = 0, left = 0;
    const DUR = 5000;
    const seen = () => { try { return JSON.parse(localStorage.getItem("bk_seen_st") || "[]"); } catch { return []; } };
    const markSeen = (k) => { try { localStorage.setItem("bk_seen_st", JSON.stringify([...new Set([...seen(), k])])); } catch {} };
    $$("[data-story]").forEach((b) => { if (seen().includes(BK.stories[+b.dataset.story]?.t)) b.classList.add("seen"); });
    const stop = () => { clearTimeout(tmr); tmr = null; };
    const next = () => { const st = BK.stories[si]; if (sj < st.s.length - 1) { sj++; render(); } else if (si < BK.stories.length - 1) { si++; sj = 0; render(); } else smd.close(); };
    const prev = () => { if (sj > 0) sj--; else if (si > 0) { si--; sj = BK.stories[si].s.length - 1; } render(); };
    const run = (ms) => { stop(); t0 = Date.now(); left = ms; tmr = setTimeout(next, ms); const bar = $(".st-bar.on i", sst); if (bar) { bar.style.transition = "none"; bar.style.width = (100 - ms / DUR * 100) + "%"; requestAnimationFrame(() => { bar.style.transition = `width ${ms}ms linear`; bar.style.width = "100%"; }); } };
    function render() {
      const st = BK.stories[si], x = st.s[sj]; markSeen(st.t); $(`[data-story="${si}"]`)?.classList.add("seen");
      sst.innerHTML = `<div class="st-bars">${st.s.map((_, k) => `<span class="st-bar${k < sj ? " done" : k === sj ? " on" : ""}"><i></i></span>`).join("")}</div>
        <div class="st-head"><b>${esc(st.t)}</b><button class="st-x" type="button" aria-label="Close">✕</button></div>
        ${x.vid ? `<video src="${esc(x.vid)}" ${x.img ? `poster="${esc(x.img)}"` : ""} playsinline autoplay muted></video>` : `<img src="${esc(x.img)}" alt="">`}
        <button class="st-tap prev" type="button" aria-label="Previous"></button><button class="st-tap next" type="button" aria-label="Next"></button>
        <div class="st-foot">${x.cap ? `<p>${esc(x.cap)}</p>` : ""}${x.link ? `<a class="st-shop" href="${esc(x.link)}">🛍 ${esc(x.shop || "Shop now")}</a>` : ""}</div>`;
      $(".st-x", sst).onclick = () => smd.close(); $(".st-tap.prev", sst).onclick = prev; $(".st-tap.next", sst).onclick = next;
      const v = $("video", sst);
      if (v) { v.play().catch(() => {}); v.onloadedmetadata = () => run(Math.min(15000, (v.duration || 5) * 1000)); v.onended = next; run(15000); } else run(DUR);
    }
    const hold = (on) => { if (on && tmr) { paused = true; left -= Date.now() - t0; stop(); $("video", sst)?.pause(); const bar = $(".st-bar.on i", sst); if (bar) { const w = getComputedStyle(bar).width; bar.style.transition = "none"; bar.style.width = w; } } else if (!on && paused) { paused = false; $("video", sst)?.play().catch(() => {}); run(Math.max(300, left)); } };
    sst.addEventListener("pointerdown", (e) => { if (!e.target.closest("a,.st-x")) hold(true); });
    sst.addEventListener("pointerup", () => hold(false)); sst.addEventListener("pointercancel", () => hold(false));
    let y0 = null; sst.addEventListener("touchstart", (e) => (y0 = e.touches[0].clientY), { passive: true }); sst.addEventListener("touchend", (e) => { if (y0 !== null && e.changedTouches[0].clientY - y0 > 90) smd.close(); y0 = null; });
    document.addEventListener("keydown", (e) => { if (!smd.open) return; if (e.key === "ArrowRight") next(); if (e.key === "ArrowLeft") prev(); });
    $$("[data-story]").forEach((b) => b.addEventListener("click", () => { si = +b.dataset.story; sj = 0; smd.showModal(); document.documentElement.classList.add("locked"); render(); track("ViewContent", { content_name: "story " + BK.stories[si].t }); }));
    smd.addEventListener("close", () => { stop(); sst.innerHTML = ""; unlockIfFree(); });
  }

  // ---------- feed (vertical reels) ----------
  const feed = $("[data-feed]");
  if (feed) {
    const vids = $$("video", feed);
    if ("IntersectionObserver" in window) { const io4 = new IntersectionObserver((es) => es.forEach((e) => { const v = e.target; if (e.isIntersecting) { if (!v.src && v.dataset.src) v.src = v.dataset.src; v.play().catch(() => {}); } else v.pause(); }), { threshold: 0.6 }); vids.forEach((v) => io4.observe(v)); }
    feed.addEventListener("click", async (e) => {
      const sh = e.target.closest("[data-feed-share]"); if (sh) { const link = sh.dataset.feedShare + "?utm_source=whatsapp&utm_medium=share&utm_campaign=feed"; try { if (navigator.share) { await navigator.share({ url: link, text: "Ye dekho 👗" }); return; } } catch (er) { if (er?.name === "AbortError") return; } window.open(`https://wa.me/?text=${encodeURIComponent("Ye dekho 👗 " + link)}`, "_blank", "noopener"); return; }
      const snd = e.target.closest("[data-feed-sound]"); if (snd) { const v = snd.closest(".feed-item").querySelector("video"); if (v) { v.muted = !v.muted; snd.firstChild.textContent = v.muted ? "🔇" : "🔊"; } }
    });
    let lastTap = 0; feed.addEventListener("pointerup", (e) => { if (e.target.closest("a,button")) return; const now = Date.now(); if (now - lastTap < 300) { const w = e.target.closest(".feed-item")?.querySelector("[data-wish]"); if (w && !w.classList.contains("on")) { w.click(); const h = document.createElement("span"); h.className = "feed-heart"; h.textContent = "❤"; e.target.closest(".feed-item").appendChild(h); setTimeout(() => h.remove(), 900); } } lastTap = now; });
  }

  // ---------- Follow Bahe Kurtiz ----------
  const isFollow = () => { try { return localStorage.getItem("bk_follow") === "1"; } catch { return false; } };
  const paintFollow = () => $$("[data-follow-label]").forEach((el) => (el.textContent = isFollow() ? "✓ Following" : el.closest(".mnav") ? "＋ Follow Bahe Kurtiz" : "＋ Follow"));
  paintFollow();
  $$("[data-follow]").forEach((b) => b.addEventListener("click", () => {
    if (isFollow()) { toast("You are following – thank you 💚"); return; }
    const u0 = getUser();
    if (!u0?.phone) { openLogin(); const t = $("[data-login-title]"); if (t) t.textContent = "Follow Bahe Kurtiz"; const c = $("[data-login-form] [name=consent]"); if (c) c.checked = true; try { localStorage.setItem("bk_follow_pending", "1"); } catch {} return; }
    try { localStorage.setItem("bk_follow", "1"); } catch {} sendSheet({ type: "follow", name: u0.name, phone: u0.phone, email: u0.email || "", consent: "yes" }); paintFollow(); toast("Following! New drops will reach you first 💚"); track("Subscribe", {});
  }));
  lf?.addEventListener("submit", () => setTimeout(() => { try { if (localStorage.getItem("bk_follow_pending") === "1" && getUser()?.phone && lf.consent?.checked) { localStorage.removeItem("bk_follow_pending"); localStorage.setItem("bk_follow", "1"); sendSheet({ type: "follow", name: getUser().name, phone: getUser().phone, consent: "yes" }); paintFollow(); } } catch {} }, 80));

  $$("[data-yt]").forEach((b) => b.addEventListener("click", () => { b.outerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${b.dataset.yt}?autoplay=1&playsinline=1" title="Live video" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`; }));
  try { if (window.BKeu && !localStorage.getItem("bk_consent") && (window.BKtags?.length || window.fbq)) { const cb = document.createElement("div"); cb.className = "consent-bar"; cb.innerHTML = `<p>We use cookies for ads and analytics to improve your shopping. <a href="${url("privacy/")}">Privacy</a></p><div><button type="button" class="btn btn-sm" data-cs="yes">Accept</button><button type="button" class="btn btn-ghost btn-sm" data-cs="no">Only necessary</button></div>`; document.body.appendChild(cb);
    cb.addEventListener("click", (e) => { const b = e.target.closest("[data-cs]"); if (!b) return; const ok = b.dataset.cs === "yes"; try { localStorage.setItem("bk_consent", ok ? "yes" : "no"); } catch {} if (ok) { const g = "granted"; try { window.gtag?.("consent", "update", { ad_storage: g, ad_user_data: g, ad_personalization: g, analytics_storage: g }); window.fbq?.("consent", "grant"); } catch {} } cb.remove(); }); } } catch {}
  // ---------- speed: Instagram reels load only on tap; hover photo only on mouse devices ----------
  $$("[data-ig]").forEach((b) => b.addEventListener("click", () => { const d = document.createElement("div"); d.className = "reel reel-ig"; d.innerHTML = `<iframe src="${b.dataset.ig}" title="Instagram reel" scrolling="no" allowtransparency="true" allow="autoplay; encrypted-media; picture-in-picture"></iframe>`; b.replaceWith(d); }));
  if (matchMedia("(hover: hover)").matches) document.addEventListener("pointerover", (e) => { const c = e.target.closest?.(".card"); const im = c && c.querySelector("img.alt[data-src]"); if (im) { im.src = im.dataset.src; im.removeAttribute("data-src"); } }, { passive: true });

  // ---------- Mirror 2.0 ----------
  const mir = $("[data-mirror]");
  if (mir) {
    const me = $("[data-mirror-me]"), dr = $("[data-mirror-dress]"), stage = $("[data-mirror-stage]"), board = $("[data-mirror-board]"), statusEl = $("[data-mirror-status]"), playB = $("[data-mirror-play]"), scaleI = $("[data-mirror-scale]");
    const MP = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14", MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";
    let cat = null, all = [], list = [], idx = 0, seen = 0, timer = null, fit = { x: 50, y: 22, w: 52 }, liked = [], poseOk = false, ready = false;
    const cache = {};
    const say = (t, ms) => { statusEl.textContent = t; statusEl.hidden = !t; clearTimeout(say._h); if (ms) say._h = setTimeout(() => (statusEl.hidden = true), ms); };
    const place = () => { dr.style.width = fit.w + "%"; dr.style.left = fit.x + "%"; dr.style.top = fit.y + "%"; scaleI.value = Math.round(fit.w); };
    const loadImg = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
    // product photo -> dress layer: cutout PNG as is; normal photo: trim head + sides, feather the edges
    const prep = (k) => cache[k] ||= (async () => {
      const p = cat.products[k]; if (p.cutout) return url(p.cutout);
      try { const im = await loadImg(url(p.image)); const nw = im.naturalWidth, nh = im.naturalHeight; let box = null;
        // find the model's shoulders in the product photo -> cut out just the outfit, matched to her shoulders
        if (lmP) { try { const lm = await lmP; const L = lm.detect(im).landmarks?.[0]; if (L) { const ls = { x: L[11].x * nw, y: L[11].y * nh }, rs = { x: L[12].x * nw, y: L[12].y * nh }, sw = Math.abs(ls.x - rs.x); if (sw > nw * 0.05) { const w = sw * 2.3, top = Math.min(ls.y, rs.y) - sw * 0.3; box = { sx: (ls.x + rs.x) / 2 - w / 2, sy: top, sw: w, sh: nh - top }; } } } catch {} }
        if (!box) box = { sx: nw * 0.08, sy: nh * 0.16, sw: nw * 0.84, sh: nh * 0.82 };
        const sc = Math.min(1, 700 / box.sw), W = Math.round(box.sw * sc), H = Math.round(box.sh * sc);
        const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d"); g.drawImage(im, box.sx, box.sy, box.sw, box.sh, 0, 0, W, H);
        const m = document.createElement("canvas"); m.width = W; m.height = H; const mg = m.getContext("2d"); const f = Math.round(W * 0.045); mg.filter = `blur(${f}px)`; mg.fillStyle = "#000"; mg.beginPath(); if (mg.roundRect) mg.roundRect(f, f, W - 2 * f, H - 2 * f, W * 0.22); else mg.rect(f, f, W - 2 * f, H - 2 * f); mg.fill(); mg.filter = "none";
        g.globalCompositeOperation = "destination-in"; g.drawImage(m, 0, 0);
        return await new Promise((r) => cv.toBlob((bl) => r(bl ? URL.createObjectURL(bl) : url(p.image)), "image/png")); } catch { return url(p.image); }
    })();
    const show = async (i) => {
      if (!list.length) return; idx = (i + list.length) % list.length; const k = list[idx], p = cat.products[k];
      $("[data-mirror-count]").textContent = `${idx + 1} / ${list.length}`; $("[data-mirror-name]").textContent = p.title; $("[data-mirror-hud]").hidden = false;
      $$("[data-mp]").forEach((x) => x.classList.toggle("on", x.dataset.mp === k));
      dr.classList.add("swap"); const src = await prep(k); if (list[idx] !== k) return;
      dr.src = src; dr.classList.toggle("is-cutout", !!p.cutout); dr.hidden = false; place(); requestAnimationFrame(() => dr.classList.remove("swap"));
      prep(list[(idx + 1) % list.length]);
    };
    const stop = () => { clearInterval(timer); timer = null; playB.textContent = "▶"; playB.setAttribute("aria-label", "Play"); };
    const next = () => { seen++; if (seen >= list.length && timer) { stop(); say(`Sab ${list.length} dress dekh li! 💚 Pasand: ${liked.length}`, 4000); if (liked.length) board.scrollIntoView({ behavior: "smooth", block: "center" }); } show(idx + 1); };
    const play = () => { stop(); if (!list.length || me.hidden) return; seen = 0; timer = setInterval(next, 2600); playB.textContent = "⏸"; playB.setAttribute("aria-label", "Pause"); };
    const flash = (t) => { const f = $("[data-mirror-flash]"); f.textContent = t; f.classList.remove("go"); void f.offsetWidth; f.classList.add("go"); };
    const snap = () => new Promise((res) => { const r = stage.getBoundingClientRect(), W = 720, H = Math.round(W * r.height / r.width), cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d"); g.fillStyle = "#f6efe2"; g.fillRect(0, 0, W, H);
      const draw = (im) => { if (im === me) { const s = Math.min(W / im.naturalWidth, H / im.naturalHeight), w = im.naturalWidth * s, h = im.naturalHeight * s; g.drawImage(im, (W - w) / 2, (H - h) / 2, w, h); return; } const ir = im.getBoundingClientRect(); g.globalAlpha = +getComputedStyle(im).opacity || 1; g.drawImage(im, (ir.left - r.left) / r.width * W, (ir.top - r.top) / r.height * H, ir.width / r.width * W, ir.height / r.height * H); g.globalAlpha = 1; };
      if (!me.hidden) draw(me); if (!dr.hidden) draw(dr); g.fillStyle = "rgba(14,91,89,.88)"; g.fillRect(0, H - 60, W, 60); g.fillStyle = "#fff"; g.font = "600 24px system-ui"; g.fillText(String(cat.products[list[idx]]?.title || "").slice(0, 40), 16, H - 22); g.font = "500 18px system-ui"; g.textAlign = "right"; g.fillText("Bahe Kurtiz", W - 16, H - 22); cv.toBlob(res, "image/jpeg", 0.88); });
    const paintBoard = () => { $("[data-mirror-liked-n]").textContent = liked.length ? `(${liked.length})` : ""; board.innerHTML = liked.length ? liked.map((l, i) => `<figure><img src="${l.src}" alt=""><figcaption>${i + 1}. ${esc(l.t)}</figcaption><button type="button" data-unlike="${i}" aria-label="Remove">✕</button></figure>`).join("") : `<p class="muted small">Jo dress "Haan" karogi, wo yahan aayegi.</p>`; };
    board.addEventListener("click", (e) => { const b = e.target.closest("[data-unlike]"); if (!b) return; liked.splice(+b.dataset.unlike, 1); paintBoard(); });
    const yes = async () => { if (!ready || dr.hidden) return; const k = list[idx]; if (!liked.some((l) => l.k === k)) { const b = await snap(); liked.push({ k, b, src: URL.createObjectURL(b), t: cat.products[k].title, u: cat.products[k].url }); paintBoard(); } flash("💚"); track("AddToWishlist", { content_ids: [k] }); if (timer) { clearInterval(timer); timer = setInterval(next, 2600); } next(); };
    const no = () => { if (!ready) return; flash("✕"); if (timer) { clearInterval(timer); timer = setInterval(next, 2600); } next(); };
    $("[data-mirror-yes]").addEventListener("click", yes); $("[data-mirror-no]").addEventListener("click", no);
    playB.addEventListener("click", () => (timer ? stop() : play()));
    // find shoulders on the photo (on-device), so every dress lands on her automatically
    let lmP = null;
    const fitBody = async () => {
      try {
        const V = await import(MP + "/vision_bundle.mjs");
        lmP ||= V.FilesetResolver.forVisionTasks(MP + "/wasm").then((fs) => V.PoseLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: MODEL }, runningMode: "IMAGE", numPoses: 1 }));
        const lm = await lmP; const L = lm.detect(me).landmarks?.[0]; if (!L) return false;
        const r = stage.getBoundingClientRect(), W = r.width, H = r.height, s = Math.min(W / me.naturalWidth, H / me.naturalHeight), dw = me.naturalWidth * s, dh = me.naturalHeight * s, ox = (W - dw) / 2, oy = (H - dh) / 2;
        const P = (n) => ({ x: ox + L[n].x * dw, y: oy + L[n].y * dh });
        const ls = P(11), rs = P(12), sw = Math.abs(ls.x - rs.x); if (sw < W * 0.06) return false;
        fit = { x: (ls.x + rs.x) / 2 / W * 100, y: (Math.min(ls.y, rs.y) - sw * 0.3) / H * 100, w: Math.min(120, sw * 2.3 / W * 100) }; return true;
      } catch { return false; }
    };
    const timeout = (pr, ms) => Promise.race([pr, new Promise((r) => setTimeout(() => r(false), ms))]);
    $("[data-mirror-file]").addEventListener("change", (e) => {
      const f = e.target.files[0]; if (!f) return; stop(); me.src = URL.createObjectURL(f);
      me.onload = async () => { me.hidden = false; $("[data-mirror-empty]").hidden = true; $("[data-mirror-vote]").hidden = false; $("[data-mirror-tip]").hidden = false;
        say("✨ Aapki body ka naap le rahe hain…"); poseOk = await timeout(fitBody(), 15000);
        if (!poseOk) { const s = Math.min(1, (stage.clientWidth / stage.clientHeight) / (me.naturalWidth / me.naturalHeight)); fit = { x: 50, y: 22, w: 52 * s }; }
        say(poseOk ? "✓ Fit ho gaya! Ab dresses aap par aayengi…" : "Gardan par tap karo, dress wahan aa jayegi", 3500);
        ready = true; await show(idx); play(); };
    });
    catalog().then((c) => {
      cat = c; all = Object.entries(c.products).filter(([, p]) => p.image && p.in_stock !== false).map(([k]) => k); list = all.slice();
      const box = $("[data-mirror-picks]");
      box.innerHTML = all.map((k) => { const p = c.products[k]; return `<button type="button" data-mp="${esc(k)}"><img src="${esc(url(p.cutout || p.image))}" alt="${esc(p.title)}" loading="lazy"><span>${esc(p.title)}</span></button>`; }).join("");
      box.addEventListener("click", (e) => { const b = e.target.closest("[data-mp]"); if (!b) return; if (me.hidden) { toast("Pehle apni photo daalo 📷"); stage.scrollIntoView({ behavior: "smooth", block: "center" }); return; } stop(); if (!list.includes(b.dataset.mp)) list = all.slice(); show(list.indexOf(b.dataset.mp)); });
      const occ = [...new Set(all.flatMap((k) => [].concat(c.products[k].occ || [])))].filter(Boolean);
      const ob = $("[data-mirror-occ]");
      if (occ.length) { ob.innerHTML = [`<button type="button" class="on" data-mo="">All</button>`, ...occ.map((o) => `<button type="button" data-mo="${esc(o)}">${esc(o)}</button>`)].join("");
        ob.addEventListener("click", (e) => { const b = e.target.closest("[data-mo]"); if (!b) return; $$("[data-mo]", ob).forEach((x) => x.classList.toggle("on", x === b)); const o = b.dataset.mo; list = o ? all.filter((k) => [].concat(cat.products[k].occ || []).includes(o)) : all.slice(); if (!list.length) list = all.slice(); idx = 0; show(0); if (!me.hidden) play(); }); }
      else ob.previousElementSibling.hidden = ob.hidden = true;
    }).catch(() => {});
    scaleI.addEventListener("input", (e) => { stop(); fit.w = +e.target.value; place(); });
    $("[data-mirror-op]").addEventListener("input", (e) => { dr.style.opacity = e.target.value / 100; });
    // drag dress; swipe / tap on photo
    let drag = null, sw0 = null;
    dr.addEventListener("pointerdown", (e) => { stop(); drag = { x: e.clientX, y: e.clientY, px: fit.x, py: fit.y }; dr.setPointerCapture(e.pointerId); e.preventDefault(); e.stopPropagation(); });
    dr.addEventListener("pointermove", (e) => { if (!drag) return; const r = stage.getBoundingClientRect(); fit.x = drag.px + (e.clientX - drag.x) / r.width * 100; fit.y = drag.py + (e.clientY - drag.y) / r.height * 100; place(); });
    dr.addEventListener("pointerup", () => (drag = null));
    stage.addEventListener("pointerdown", (e) => { if (e.target === dr || me.hidden) return; sw0 = { x: e.clientX, y: e.clientY }; });
    stage.addEventListener("pointerup", (e) => { if (!sw0) return; const dx = e.clientX - sw0.x, dy = e.clientY - sw0.y; sw0 = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) { dx > 0 ? yes() : no(); return; }
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8 && !dr.hidden) { const r = stage.getBoundingClientRect(); fit.x = (e.clientX - r.left) / r.width * 100; fit.y = (e.clientY - r.top) / r.height * 100 - 2; place(); } });
    // share: all liked looks / top-3 vote card / wishlist
    const shareText = () => { const code = myCode(); return `Kaunsi pehnu? 🤔 Number bata do!\n${liked.slice(0, 6).map((l, i) => `${i + 1}. ${l.t} – ${location.origin}/${String(l.u).replace(/^\//, "")}${code ? "?ref=" + code : ""}`).join("\n")}\n\nApni photo par try karo: ${location.origin}/mirror/${code ? "?ref=" + code : ""}`; };
    const shareFiles = async (files, text) => { try { if (navigator.canShare && navigator.canShare({ files })) { await navigator.share({ files, text }); return; } } catch (e) { if (e?.name === "AbortError") return; } window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener"); };
    $("[data-mirror-share]").addEventListener("click", () => { if (!liked.length) { toast("Pehle kuch dress par 💚 Haan karo"); return; } shareFiles(liked.slice(0, 6).map((l, i) => new File([l.b], `look-${i + 1}.jpg`, { type: "image/jpeg" })), shareText()); });
    $("[data-mirror-card]").addEventListener("click", async () => {
      if (liked.length < 2) { toast("Kam se kam 2 dress par 💚 Haan karo"); return; }
      const top = liked.slice(0, 3), W = 1080, H = 1350, cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d");
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "#0e5b59"); gr.addColorStop(1, "#083b3a"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = "#e8c776"; g.textAlign = "center"; g.font = "600 34px system-ui"; g.fillText("BAHE KURTIZ · MIRROR", W / 2, 90); g.fillStyle = "#fff"; g.font = "700 76px Georgia, serif"; g.fillText("Kaunsi pehnu?", W / 2, 190); g.font = "500 36px system-ui"; g.fillText("Number reply karo 👇", W / 2, 245);
      const gap = 24, cw = (W - gap * (top.length + 1)) / top.length, ch = Math.min(cw * 1.45, 880), y = 300;
      for (let i = 0; i < top.length; i++) { const im = await loadImg(top[i].src); const x = gap + i * (cw + gap); const s = Math.max(cw / im.width, ch / im.height), w = im.width * s, h = im.height * s; g.save(); g.beginPath(); g.roundRect ? g.roundRect(x, y, cw, ch, 22) : g.rect(x, y, cw, ch); g.clip(); g.drawImage(im, x + (cw - w) / 2, y + (ch - h) / 2, w, h); g.restore();
        g.fillStyle = "#e8c776"; g.beginPath(); g.arc(x + cw / 2, y + ch, 46, 0, Math.PI * 2); g.fill(); g.fillStyle = "#083b3a"; g.font = "800 50px system-ui"; g.fillText(String(i + 1), x + cw / 2, y + ch + 18); }
      const code = myCode(); g.fillStyle = "#fff"; g.font = "600 38px system-ui"; g.fillText(`${location.host}/mirror`, W / 2, H - 120); g.font = "500 30px system-ui"; g.fillStyle = "#cfe3e1"; g.fillText(code ? `Apni photo par try karo · code ${code}` : "Apni photo par try karo", W / 2, H - 70);
      cv.toBlob((bl) => shareFiles([new File([bl], "kaunsi-pehnu.jpg", { type: "image/jpeg" })], shareText()), "image/jpeg", 0.9);
    });
    $("[data-mirror-wish]").addEventListener("click", () => { if (!liked.length) { toast("Pehle kuch dress par 💚 Haan karo"); return; } const w = getW(); liked.forEach((l) => { if (!w.includes(l.k)) w.push(l.k); }); setW(w); toast(`${liked.length} dress wishlist mein ♡`); });
  }
})();
