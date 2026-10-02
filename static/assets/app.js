/* Bahe Kurtiz storefront: menu, bag, gallery, checkout */
(() => {
  const BK = window.BK || { base: "/", wa: "", brand: "Bahe Kurtiz" };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const inr = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
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
    track("AddToCart", { content_ids: [slug], content_type: "product", value: pr, currency: "INR" });
  }
  async function renderCart() {
    const box = $("[data-cart-items]"); if (!box) return;
    if (!bag.length) { box.innerHTML = `<p class="empty">Your bag is empty.<br><a class="link" href="${url("shop/")}">Start shopping →</a></p>`; $("[data-cart-foot]").hidden = true; return; }
    const cat = await catalog(); let sub = 0;
    const items = bag.filter((i) => cat.products[i.slug]);
    box.innerHTML = items.map((i, n) => { const p = cat.products[i.slug]; sub += (p.price || 0) * i.qty;
      return `<div class="line"><img src="${esc(url(p.image))}" alt="" width="64" height="96"><div><a href="${url(p.url)}">${esc(p.title)}</a><small>${i.size ? "Size " + esc(i.size) : ""}</small>
      <div class="qty"><button data-q="${n}" data-d="-1" aria-label="Less">−</button><span>${i.qty}</span><button data-q="${n}" data-d="1" aria-label="More">+</button><button class="rm" data-rm="${n}">Remove</button></div></div><strong>${inr((p.price || 0) * i.qty)}</strong></div>`; }).join("");
    $("[data-cart-subtotal]").textContent = inr(sub); $("[data-cart-foot]").hidden = false;
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
    const cards = $$(".card", grid); const v = sort.value; const pr = (c) => (c.dataset.price === "" ? Infinity : +c.dataset.price);
    cards.sort((a, b) => v === "low" ? pr(a) - pr(b) : v === "high" ? (pr(b) === Infinity ? -1 : pr(a) === Infinity ? 1 : pr(b) - pr(a)) : +a.dataset.i - +b.dataset.i).forEach((c) => grid.appendChild(c));
  });

  // ---------- checkout (online payment via Razorpay; WhatsApp/UPI as fallback; no COD) ----------
  const co = $("[data-checkout]");
  let method = "", online = false;
  function totals(cat, m) {
    const s = cat.settings; let sub = 0;
    for (const i of bag) { const p = cat.products[i.slug]; if (p && p.price) sub += p.price * i.qty; }
    const prepaid = m === "online" || m === "upi";
    const discount = prepaid && s.prepaid_discount_percent ? Math.round(sub * s.prepaid_discount_percent / 100) : 0;
    const shipping = s.free_shipping_above && sub >= s.free_shipping_above ? 0 : (s.shipping_charge || 0);
    return { sub, discount, shipping, total: sub - discount + shipping };
  }
  async function renderCheckout() {
    const cat = await catalog();
    bag = bag.filter((i) => cat.products[i.slug] && cat.products[i.slug].price);
    const itemsBox = $("[data-co-items]");
    if (!bag.length) { co.innerHTML = `<h1>Checkout</h1><p class="empty">Your bag is empty. <a class="link" href="${url("shop/")}">Shop the collection →</a></p>`; return; }
    itemsBox.innerHTML = bag.map((i) => { const p = cat.products[i.slug]; return `<div class="line"><img src="${esc(url(p.image))}" alt="" width="64" height="96"><div><span>${esc(p.title)}</span><small>${i.size ? "Size " + esc(i.size) + " · " : ""}Qty ${i.qty}</small></div><strong>${inr(p.price * i.qty)}</strong></div>`; }).join("");
    const t = totals(cat, method);
    $("[data-co-totals]").innerHTML = `<div class="row"><span>Subtotal</span><span>${inr(t.sub)}</span></div>
      ${t.discount ? `<div class="row save"><span>Online payment discount</span><span>−${inr(t.discount)}</span></div>` : ""}
      <div class="row"><span>Shipping</span><span>${t.shipping ? inr(t.shipping) : "Free"}</span></div>
      <div class="row total"><span>Total</span><span>${inr(t.total)}</span></div>`;
    $("[data-place]").textContent = method === "online" ? `Pay ${inr(t.total)} securely` : method === "upi" ? `Pay ${inr(t.total)} by UPI` : `Send order on WhatsApp · ${inr(t.total)}`;
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
    track("InitiateCheckout", { num_items: count(), currency: "INR" });
    form.addEventListener("submit", async (e) => {
      e.preventDefault(); if (btn.disabled) return; err.hidden = true;
      const f = Object.fromEntries(new FormData(form)); for (const k in f) f[k] = String(f[k]).trim();
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
            prefill: { name: f.name, contact: "+91" + f.phone, email: f.email || undefined }, notes: { ref }, theme: { color: "#7a1f3d" },
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

  // reels: play muted only while visible (saves data)
  const vids = $$("video[data-reel]");
  if (vids.length && "IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { const v = e.target; if (e.isIntersecting) { if (v.preload === "none") v.preload = "metadata"; v.play().catch(() => {}); } else v.pause(); }), { threshold: 0.5 });
    vids.forEach((v) => io.observe(v));
  }
})();
