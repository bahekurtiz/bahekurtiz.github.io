# Orders API – setup (Hinglish, step by step)

**Ye kya hai:** ek chhota Google Apps Script jo aapki **usi Google Sheet** mein:
- order ka **status** (Paid → Packed → Shipped → Delivered), **courier** aur **tracking number** save karta hai, aur dashboard ko saaf batata hai "save hua ✓" ya "nahi hua ✗ (wajah)";
- customer ke "Track your order" page ko courier + tracking link deta hai;
- **Help Center** chalata hai (Sheet mein naya **Help** tab apne aap banega).

Aapka **purana Sheet script waise hi chalta rahega** (orders likhna, dashboard ka data). Ye naya script uske saath chalta hai, use replace nahi karta.

Code: is folder ki file `orders-api.gs`.

---

## Pehli baar lagana (≈ 10 minute, laptop/PC par)

### Step 1 – Sheet ka ID copy karo
1. Apni orders wali Google Sheet kholo.
2. Upar address bar mein link aisa hoga: `https://docs.google.com/spreadsheets/d/`**`1AbC...XyZ`**`/edit#gid=0`
3. `/d/` aur `/edit` ke **beech wala lamba hissa** copy karo – yahi **SHEET_ID** hai. Kahin note kar lo.

### Step 2 – Naya Apps Script project banao
1. Naye tab mein kholo: **https://script.google.com** (usi Google account se jisme Sheet hai).
2. Left upar **"+ New project"** dabao.
3. Upar "Untitled project" par click karke naam do: **Bahe Orders API**.
4. Editor mein jo `function myFunction() {…}` likha hai, **sab select karke delete** karo.
5. GitHub par `apps-script/orders-api.gs` kholo → **"Copy raw file"** button (copy icon) dabao → editor mein **paste** karo.
6. **Save** (💾 icon ya Ctrl+S).

### Step 3 – Owner key aur Sheet ID daalo (Script properties)
1. Left side mein **⚙️ Project Settings** (gear icon) dabao.
2. Neeche scroll karo → **"Script Properties"** → **"Add script property"**.
3. Pehli property: Property = `OWNER_KEY`, Value = **wahi owner key jo aap dashboard login mein daalte ho**.
4. **"Add script property"** dobara → Property = `SHEET_ID`, Value = Step 1 wala ID.
5. **"Save script properties"** dabao.

> Owner key kabhi chat ya GitHub mein mat likhna – sirf yahan Script Properties mein.

### Step 4 – Deploy (Web app)
1. Upar right mein blue **"Deploy"** button → **"New deployment"**.
2. "Select type" ke paas ⚙️ gear icon → **"Web app"** chuno.
3. Description: `v2 – status, courier, help center`.
4. **Execute as:** `Me (aapka email)`.
5. **Who has access:** **`Anyone`** ← zaroori (warna website ko jawab nahi milega; data phir bhi owner key ke bina nahi milta).
6. **"Deploy"** dabao.
7. Google permission maangega: **"Authorize access"** → apna account chuno → "Google hasn't verified this app" aaye to **"Advanced" → "Go to Bahe Orders API (unsafe)"** → **"Allow"**. (Ye aapka khud ka script hai; Sheet aur Drive (Help photos ke liye) ki permission chahiye.)
8. **"Web app URL"** copy karo – `https://script.google.com/macros/s/…/exec` jaisa hoga.

### Step 5 – Website mein link daalo
1. Website admin kholo: **bahekurtiz.com/admin/** → **Settings**.
2. Field **"Orders API – Web App लिंक"** mein Step 4 wala URL paste karo → **Publish**.
3. 2–3 minute baad (Cloudflare deploy) dashboard kholo → kisi order ka status badlo → "✅ Saved in Google Sheet" dikhna chahiye.

**Check karne ka aasaan tareeka:** browser mein `<Web app URL>?action=ping` kholo → `{"ok":true,"app":"bk-orders-api","version":2,"owner_key_set":true,"sheet_id_set":true}` dikhna chahiye. `owner_key_set` ya `sheet_id_set` false ho to Step 3 dobara dekho.

---

## Baad mein code update karna (naya version) – URL wahi rahega
Jab bhi `orders-api.gs` GitHub par badle:
1. script.google.com → **Bahe Orders API** kholo → purana code sab select karke delete → naya code paste → **Save**.
2. **Deploy → "Manage deployments"**.
3. Jo deployment hai (Active) uske right mein ✏️ **pencil (Edit)** icon dabao.
4. **Version** dropdown → **"New version"** chuno. Description mein kuch bhi likh do (jaise `v3`).
5. **"Deploy"** dabao → Done.
   - URL **same rehta hai**, website mein kuch badalna nahi padta.
   - ⚠️ "New deployment" mat dabana – usse naya URL banta hai.

---

## Emails (customer ko apne aap)
Emails website (Cloudflare) se **Brevo** ke through jaate hain – Cloudflare mein `BREVO_API_KEY` pehle se laga hai. Har email ka result Sheet ke **"Customer emails"** column mein likha jaata hai (✓ / ✗) aur dashboard mein dikhta hai.

## Sheet mein naye columns
Script ye columns khud bana deta hai (agar pehle se nahi hain): **Courier**, **Tracking**, **Tracking link**, **Status updated**, **Customer emails**, aur naya tab **Help**. Inhe rename/delete mat karna.

---

## v3 – sirf verified payment wale orders (Payments + Abandoned tabs)
Website ka server Razorpay / PayPal se payment check karke result Sheet ke **Payments** tab mein likhta hai. Dashboard mein order tabhi "Orders" mein aata hai jab yahan **Verified = Yes** ho (ya aapne khud Status → Paid kiya ho). Checkout shuru karke chhod dene wale **Abandoned** tab mein jaate hain. Koi row delete nahi hoti.

Iske liye ek secret chahiye jo sirf Apps Script aur Cloudflare ke paas ho:
1. Ek lamba random text banao (kam se kam 20 akshar, jaise password manager se) – ise kahin chat mein mat bhejna.
2. **Apps Script:** script.google.com → Bahe Orders API → naya `orders-api.gs` code paste → Save → ⚙️ Project Settings → Script properties → **Add script property**: `SERVER_KEY` = wahi text → Save script properties.
3. **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy** (URL wahi rahega).
4. **Cloudflare:** dash.cloudflare.com → Workers & Pages → bahekurtiz → Settings → Variables and Secrets → **+ Add** → Type **Secret**, Name `ORDERS_API_SECRET`, Value = wahi text → Save → Deployments → latest → ⋯ → **Retry deployment**.
