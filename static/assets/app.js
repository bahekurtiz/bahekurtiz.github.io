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
  const track = (ev, data) => { try { window.fbq && window.fbq("track", ev, data); } catch {} };

  // ---------- storage (safe) ----------
  const KEY = "bk_bag_v1";
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
  const save = (b) => { try { localStorage.setItem(KEY, JSON.stringify(b)); } catch {} };
  let bag = load();

  // ---------- catalog ----------
  let catalogP;
  const catalog = () => (catalogP ||= fetch(url("data/catalog.json"), { cache: "no-cache" }).then((r) => r.json()));

  // ---------- toast ----------
  const toast = (msg) => { const t = $("[data-toast]"); if (!t) return; t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2200); };

  // ---------- overlay helpers ----------
  const scrim = $("[data-scrim]");
  const lock = (on) => { document.documentElement.classList.toggle("locked", on); if (scrim) scrim.hidden = !on; };
  const nav = $("#mnav"), drawer = $("#cart");
  const closeAll = () => { nav?.classList.remove("open"); nav?.setAttribute("aria-hidden", "true"); drawer?.classList.remove("open"); drawer?.setAttribute("aria-hidden", "true"); $("[data-open-menu]")?.setAttribute("aria-expanded", "false"); lock(false); };
  $$("[data-open-menu]").forEach((b) => b.addEventListener("click", () => { nav.classList.add("open"); nav.setAttribute("aria-hidden", "false"); b.setAttribute("aria-expanded", "true"); lock(true); }));
  $$("[data-close-menu]").forEach((b) => b.addEventListener("click", closeAll));
  $$("[data-open-cart]").forEach((b) => b.addEventListener("click", () => openCart()));
  $$("[data-close-cart]").forEach((b) => b.addEventListener("click", closeAll));
  scrim?.addEventListener("click", closeAll);
  document.addEventListener("keydown", (e) => e.key === "Escape" && closeAll());
  function openCart() { drawer.classList.add("open"); drawer.setAttribute("aria-hidden", "false"); lock(true); renderCart(); }

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
    if (!bag.length) { box.innerHTML = `<p class="empty">Your bag is empty.<br><a class="link" href="${url("shop/")}">Start shopping →</a></p>`; $("[data-cart-foot]").hidden = true; return; }
    const cat = await catalog(); let sub = 0;
    const items = bag.filter((i) => cat.products[i.slug]);
    box.innerHTML = items.map((i, n) => { const p = cat.products[i.slug]; const pr = unit(p); sub += (pr || 0) * i.qty;
      return `<div class="line"><img src="${esc(url(p.image))}" alt="" width="64" height="96"><div><a href="${url(p.url)}">${esc(p.title)}</a><small>${i.size ? "Size " + esc(i.size) : ""}</small>${pr == null ? `<small class="warn">${isUSD() ? "Ships within India only" : "Price on request"}</small>` : ""}
      <div class="qty"><button data-q="${n}" data-d="-1" aria-label="Less">−</button><span>${i.qty}</span><button data-q="${n}" data-d="1" aria-label="More">+</button><button class="rm" data-rm="${n}">Remove</button></div></div><strong>${pr == null ? "–" : money(pr * i.qty)}</strong></div>`; }).join("");
    $("[data-cart-subtotal]").textContent = money(sub); $("[data-cart-foot]").hidden = false;
    $$("[data-q]", box).forEach((b) => b.onclick = () => { const b2 = [...items]; b2[b.dataset.q].qty = Math.max(0, Math.min(10, b2[b.dataset.q].qty + +b.dataset.d)); setBag(b2); });
    $$("[data-rm]", box).forEach((b) => b.onclick = () => { const b2 = [...items]; b2.splice(+b.dataset.rm, 1); setBag(b2); });
  }
  updateCount();

  // ---------- product page ----------
  const prod = $("[data-product]");
  if (prod) {
    const slug = prod.dataset.product; let size = "";
    const sizes = $$(".size", prod);
    sizes.forEach((b) => b.addEventListener("click", () => { size = b.dataset.size; sizes.forEach((x) => x.classList.toggle("on", x === b)); const e = $("[data-size-error]"); if (e) e.hidden = true; }));
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
    return `New order ${ref}\n\n${lines}\n\nTotal: ${inr(total)}\nPayment: ${payLine}\n\nName: ${f.name}\nPhone: ${f.phone}${f.email ? "\nEmail: " + f.email : ""}\nAddress: ${f.address}, ${f.city}, ${f.state} - ${f.pincode}`;
  }
  const waUrl = (txt) => `https://wa.me/${BK.wa}?text=${encodeURIComponent(txt)}`;
  function showDone(html) {
    co.hidden = true; const d = $("[data-done]"); d.innerHTML = html; d.hidden = false; scrollTo({ top: 0, behavior: "smooth" });
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
        const cat = await catalog(); const t = totals(cat, "paypal"); const ref = orderRef();
        const lines = bag.map((i) => { const p = cat.products[i.slug]; return `• ${p.title}${i.size ? " | Size " + i.size : ""} | Qty ${i.qty} | ${usd(p.price_usd * i.qty)}`; }).join("\n");
        const txt = `New INTERNATIONAL order ${ref}\n\n${lines}\n\nShipping: ${t.shipping ? usd(t.shipping) : "Free"}\nTotal: ${usd(t.total)} USD\nPayment: Please send PayPal invoice\n\nName: ${f.name}\nPhone: ${ph}\nEmail: ${f.email}\nAddress: ${f.address}, ${f.city}${f.state ? ", " + f.state : ""} ${f.pincode}, ${f.country}`;
        track("Lead", { value: t.total, currency: "USD" });
        const mail = cat.settings.email ? `mailto:${cat.settings.email}?subject=${encodeURIComponent("Order " + ref)}&body=${encodeURIComponent(txt)}` : "";
        showDone(`<div class="done-box"><div class="tick">✓</div><h1>Almost done!</h1><p>Send your order <strong>${ref}</strong> to us. We will email a secure <strong>PayPal invoice for ${usd(t.total)} USD</strong> to ${esc(f.email)}. Your order ships after payment.</p>${BK.wa ? `<a class="btn btn-wa btn-lg" data-clear-bag href="${waUrl(txt)}" target="_blank" rel="noopener">Send order on WhatsApp</a>` : ""}${mail ? `<p><a class="btn btn-ghost" data-clear-bag href="${esc(mail)}">Send by email instead</a></p>` : ""}<p class="muted">Import duties and taxes of your country are paid by you on delivery.</p></div>`);
        return;
      }
      f.phone = f.phone.replace(/\D/g, "").slice(-10);
      if (!form.checkValidity() || !/^[6-9]\d{9}$/.test(f.phone) || !/^[1-9]\d{5}$/.test(f.pincode)) { form.reportValidity(); return fail("Please fill all delivery details correctly (10-digit mobile, 6-digit pincode)."); }
      btn.disabled = true;
      const cat = await catalog(); const t = totals(cat, method); const ref = orderRef();
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
                track("Purchase", { value: o.amount / 100, currency: "INR", content_ids: items.map((i) => i.slug), content_type: "product" });
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
    const io2 = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting && !reduce) e.target.play().catch(() => {}); else e.target.pause(); }), { threshold: 0.4 });
    pv2.forEach((v) => { if (reduce) v.removeAttribute("autoplay"); io2.observe(v); });
  }

  // reels: play muted only while visible (saves data)
  const vids = $$("video[data-reel]");
  if (vids.length && "IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { const v = e.target; if (e.isIntersecting) { if (v.preload === "none") v.preload = "metadata"; v.play().catch(() => {}); } else v.pause(); }), { threshold: 0.5 });
    vids.forEach((v) => io.observe(v));
  }

  // ---------- ₹ / $ currency switch ----------
  $$("[data-cur]").forEach((b) => b.addEventListener("click", () => {
    const toUSD = !isUSD();
    document.documentElement.classList.toggle("usd", toUSD);
    try { localStorage.setItem("bk_cur", toUSD ? "USD" : "INR"); } catch {}
    toast(toUSD ? "Showing prices in US $ · we ship worldwide" : "Showing prices in ₹ INR");
    if (co) location.reload(); else renderCart();
  }));

  // ---------- small product card (wishlist / recently viewed) ----------
  const off = (a, b) => (a && b && b > a ? Math.round((1 - a / b) * 100) : 0);
  const priceBoth = (p) => {
    const i = p.price == null ? `<span class="price ask">Price on request</span>` : `<span class="price">${inr(p.price)}</span>${off(p.price, p.mrp) ? `<s class="mrp">${inr(p.mrp)}</s>` : ""}`;
    if (!BK.intl) return i;
    const u2 = p.price_usd == null ? `<span class="price ask">India only</span>` : `<span class="price">${usd(p.price_usd)}</span>${off(p.price_usd, p.mrp_usd) ? `<s class="mrp">${usd(p.mrp_usd)}</s>` : ""}`;
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
    ri = (i + list.length) % list.length; const r = list[ri];
    stage.innerHTML = `${r.video ? `<video src="${esc(r.video)}"${r.cover ? ` poster="${esc(r.cover)}"` : ""} playsinline autoplay loop controls></video>` : `<img src="${esc(r.cover)}" alt="">`}
      ${list.length > 1 ? `<button class="reel-nav prev" data-rn="-1" aria-label="Previous reel">‹</button><button class="reel-nav next" data-rn="1" aria-label="Next reel">›</button>` : ""}
      <div class="reel-info">${r.caption ? `<p>${esc(r.caption)}</p>` : ""}
      ${r.product ? `<a class="reel-prod big" href="${esc(r.product.url)}"><img src="${esc(r.product.image)}" alt="" width="60" height="90"><span><em>${esc(r.product.title)}</em><span class="card-price">${r.product.price}</span></span><b>Shop now</b></a>` : ""}
      ${r.link ? `<a class="link light" href="${esc(r.link)}" target="_blank" rel="noopener">Watch on ${/facebook|fb\.watch/i.test(r.link) ? "Facebook" : "Instagram"} →</a>` : ""}</div>`;
    $$("[data-rn]", stage).forEach((b) => b.addEventListener("click", () => showReel(ri + +b.dataset.rn)));
    const v = $("video", stage); if (v) v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
  }
  $$("[data-reel-open]").forEach((b) => b.addEventListener("click", () => {
    if (!rm?.showModal) { const r = (BK.reels || [])[+b.dataset.reelOpen]; if (r?.product) location.href = r.product.url; return; }
    showReel(+b.dataset.reelOpen); rm.showModal(); document.documentElement.classList.add("locked");
  }));
  const closeReel = () => { rm?.close(); };
  $("[data-reel-close]")?.addEventListener("click", closeReel);
  rm?.addEventListener("click", (e) => { if (e.target === rm) closeReel(); });
  rm?.addEventListener("close", () => { stage.innerHTML = ""; document.documentElement.classList.remove("locked"); });

  // ---------- wholesale enquiry → WhatsApp ----------
  const bf = $("[data-b2b-form]");
  bf?.addEventListener("submit", (e) => {
    e.preventDefault(); if (!bf.reportValidity()) return;
    const f = Object.fromEntries(new FormData(bf)); for (const k in f) f[k] = String(f[k]).trim();
    const txt = `Wholesale / private label enquiry\n\nName: ${f.name}\nBusiness: ${f.business || "-"}\nCountry: ${f.country}\nType: ${f.type}\nProducts: ${f.products || "-"}\nQuantity: ${f.qty || "-"}\nDetails: ${f.msg || "-"}`;
    track("Lead", { content_name: "wholesale" });
    if (BK.wa) window.open(`https://wa.me/${BK.wa}?text=${encodeURIComponent(txt)}`, "_blank", "noopener");
    else if (BK.email) location.href = `mailto:${BK.email}?subject=${encodeURIComponent("Wholesale enquiry")}&body=${encodeURIComponent(txt)}`;
  });

  // ---------- search (instant, from catalog) ----------
  const srm = $("[data-search-modal]"), sin = $("[data-search-input]"), sres = $("[data-search-results]");
  const norm = (t) => String(t || "").toLowerCase();
  async function runSearch() {
    const q = norm(sin.value).trim(); if (!q) { sres.innerHTML = ""; return; }
    const cat = await catalog(); const words = q.split(/\s+/);
    const hits = Object.entries(cat.products).filter(([, p]) => { const hay = norm([p.title, p.cat, p.fabric, p.print, p.color].join(" ")); return words.every((w) => hay.includes(w.replace(/s$/, ""))); }).slice(0, 12);
    sres.innerHTML = hits.length ? `<div class="grid">${hits.map(([k, p]) => miniCard(k, p)).join("")}</div>` : `<p class="muted">No styles found for “${esc(sin.value)}”. ${BK.wa ? `<a class="link" href="https://wa.me/${BK.wa}?text=${encodeURIComponent("Hi! I am looking for: " + sin.value)}" target="_blank" rel="noopener">Ask us on WhatsApp →</a>` : ""}</p>`;
    paintWish(); track("Search", { search_string: sin.value });
  }
  let st;
  sin?.addEventListener("input", () => { clearTimeout(st); st = setTimeout(runSearch, 180); });
  $$("[data-sugg]").forEach((b) => b.addEventListener("click", () => { sin.value = b.dataset.sugg; runSearch(); }));
  $$("[data-open-search]").forEach((b) => b.addEventListener("click", () => { closeAll(); if (srm?.showModal) { srm.showModal(); document.documentElement.classList.add("locked"); setTimeout(() => sin?.focus(), 50); } }));
  $("[data-close-search]")?.addEventListener("click", () => srm.close());
  srm?.addEventListener("close", () => document.documentElement.classList.remove("locked"));
  srm?.addEventListener("click", (e) => { if (e.target === srm) srm.close(); });

  // ---------- hero slider ----------
  const hero = $("[data-hero]");
  if (hero) {
    const sl = $$(".hero-slide", hero), hd = $$("[data-hero-go]", hero); let hi = 0, ht;
    const show = (i) => { hi = (i + sl.length) % sl.length; sl.forEach((x, k) => { x.classList.toggle("on", k === hi); x.setAttribute("aria-hidden", k !== hi); }); hd.forEach((d, k) => d.classList.toggle("on", k === hi)); };
    const auto = () => { clearInterval(ht); if (sl.length > 1 && !matchMedia("(prefers-reduced-motion: reduce)").matches) ht = setInterval(() => show(hi + 1), 6000); };
    hd.forEach((d) => d.addEventListener("click", () => { show(+d.dataset.heroGo); auto(); }));
    let x0 = null; hero.addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
    hero.addEventListener("touchend", (e) => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) { show(hi + (dx < 0 ? 1 : -1)); auto(); } x0 = null; });
    auto();
  }
})();
