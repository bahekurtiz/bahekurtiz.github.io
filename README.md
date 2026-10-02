# Bahe Kurtiz – वेबसाइट (bahekurtiz.com)

अपनी वेबसाइट: अपना डोमेन, फ़्री होस्टिंग (Cloudflare), एडमिन पैनल, कार्ट, ऑनलाइन पेमेंट (Razorpay), ब्लॉग और सारे सोशल लिंक। COD नहीं है।

**खर्चा:** होस्टिंग ₹0। डोमेन का रिन्यूअल GoDaddy पर पहले जैसा चलता रहेगा। Razorpay की कोई महीने की फ़ीस नहीं है, सिर्फ़ हर ऑनलाइन पेमेंट पर छोटा कट (करीब 2%) लगता है।

---

## स्टेप 1 – GitHub (कोड और फ़ोटो यहाँ रहेंगे)
1. github.com पर फ़्री अकाउंट बनाओ।
2. ऊपर **+ → New repository** → नाम `bahe-kurtiz` → **Private** → **Create**।
3. **uploading an existing file** दबाओ → zip खोलकर `bahe-kurtiz` फ़ोल्डर के **अंदर की सारी चीज़ें** खींचकर डालो (build.mjs, content, functions, lib, static, README.md) → **Commit changes**।

## स्टेप 2 – Cloudflare (फ़्री होस्टिंग + पेमेंट सर्वर)
1. dash.cloudflare.com पर फ़्री अकाउंट बनाओ।
2. **Workers & Pages → Create → Pages → Connect to Git** → GitHub जोड़ो → `bahe-kurtiz` चुनो।
3. ये भरो:
   - Framework preset: **None**
   - Build command: `node build.mjs`
   - Build output directory: `_site`
   - **Environment variables** में जोड़ो: `GITHUB_REPO` = `आपका-github-यूज़रनेम/bahe-kurtiz`
     (यह ज़रूरी है, इसके बिना एडमिन पैनल में Save नहीं होगा)
4. **Save and Deploy** दबाओ। 1-2 मिनट में वेबसाइट `bahe-kurtiz.pages.dev` पर खुल जाएगी। पहले इसी पर सब चेक कर लो।

## स्टेप 3 – bahekurtiz.com डोमेन जोड़ो (GoDaddy)
> ध्यान दो: इसके बाद bahekurtiz.com पर पुरानी वेबसाइट की जगह यह नई वेबसाइट खुलेगी। पुराने प्रोडक्ट लिंक अपने-आप नई Shop पर भेज दिए जाएँगे। अगर पुरानी साइट Shopify पर थी, तो नई साइट चलने के बाद वहाँ का प्लान बंद कर देना, ताकि पैसे न कटें।

1. Cloudflare → **Add a domain** → `bahekurtiz.com` → **Free** प्लान चुनो।
2. Cloudflare पुराने DNS रिकॉर्ड अपने-आप कॉपी करेगा। अगर `@bahekurtiz.com` वाला ईमेल चलाते हो, तो देख लो कि **MX** रिकॉर्ड लिस्ट में आए हैं।
3. Cloudflare आपको **2 nameserver** देगा (जैसे `xxx.ns.cloudflare.com`)।
4. GoDaddy → **My Products → bahekurtiz.com → DNS → Nameservers → Change → "I'll use my own nameservers"** → दोनों nameserver डालो → Save।
5. कुछ घंटे रुको (कभी-कभी 24 घंटे लगते हैं)। Cloudflare ईमेल भेजेगा कि डोमेन **Active** हो गया।
6. Cloudflare → **Workers & Pages → bahe-kurtiz → Custom domains → Set up a custom domain** → `bahekurtiz.com` जोड़ो, फिर `www.bahekurtiz.com` भी जोड़ो।

## स्टेप 4 – एडमिन पैनल
1. GitHub → अपनी फ़ोटो → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
   - Repository access: **Only select repositories → bahe-kurtiz**
   - Permissions: **Contents → Read and write**
   - **Generate** दबाओ और टोकन संभालकर रखो (किसी को मत देना)।
2. `bahekurtiz.com/admin/` खोलो (डोमेन चालू होने से पहले `bahe-kurtiz.pages.dev/admin/`) → **Sign In with Token** → टोकन पेस्ट करो।
3. **सबसे पहले:** हर प्रोडक्ट में **दाम** भरो। दाम खाली रहेगा तो "Add to Bag" की जगह "Ask price on WhatsApp" दिखेगा।
4. **सेटिंग्स** में:
   - **सोशल मीडिया लिंक:** Instagram, YouTube, Pinterest, Threads जो भी हो, **Add** दबाकर जोड़ो (नाम + पूरा लिंक)
   - **मार्केटप्लेस लिंक:** Myntra, Amazon, Flipkart, Etsy के अपने स्टोर के सीधे लिंक डालो
   - ईमेल, ऑनलाइन छूट %, डिलीवरी चार्ज और पॉलिसी के टेक्स्ट अपने हिसाब से बदल लो
5. नया प्रोडक्ट: **प्रोडक्ट → New** → भरो → फ़ोटो डालो → **Save**। 1-2 मिनट में वेबसाइट पर दिखेगा।

## ब्लॉग लिखना (SEO के लिए सबसे ज़रूरी)
1. एडमिन → **ब्लॉग → New**
2. टाइटल अंग्रेज़ी/Hinglish में रखो, वही शब्द जो लोग Google पर ढूँढते हैं (जैसे "Best Cotton Kurtis for Summer")
3. कवर फ़ोटो, 1-2 लाइन का सार, और पूरा लेख लिखो। `##` से सेक्शन हेडिंग बनती है
4. नीचे **"इस पोस्ट में कौन-से प्रोडक्ट दिखाने हैं"** में अपने प्रोडक्ट चुनो, वो लेख के नीचे "Shop this story" में दिखेंगे
5. **Save** करो। हफ़्ते में 1 पोस्ट भी डालो तो 3-6 महीने में Google से ट्रैफ़िक आने लगेगा

## स्टेप 5 – ऑनलाइन पेमेंट (Razorpay)
जब तक Razorpay चालू नहीं होता, चेकआउट पर **"Order on WhatsApp"** दिखेगा। ग्राहक का पूरा ऑर्डर WhatsApp पर आएगा और पेमेंट आप चैट पर ले लेना। COD का ऑप्शन कहीं नहीं है।
1. razorpay.com पर साइन-अप करो → KYC पूरी करो (PAN, बैंक खाता, बिज़नेस की जानकारी)। वेबसाइट के तौर पर `https://bahekurtiz.com` डालो। Razorpay जो पेज माँगता है, वो पहले से बने हैं: Contact, Shipping, Returns, Privacy, Terms।
2. अकाउंट चालू होने पर: Razorpay Dashboard → **Account & Settings → API Keys → Generate Key**। Key ID और Key Secret मिलेंगे।
3. Cloudflare → **bahe-kurtiz → Settings → Variables and Secrets** → Production में जोड़ो:
   - `RAZORPAY_KEY_ID` = Key ID
   - `RAZORPAY_KEY_SECRET` = Key Secret (टाइप **Secret** चुनो)
4. **Deployments → Retry deployment** दबाओ। अब चेकआउट में "Pay online" अपने-आप दिखने लगेगा।
5. Razorpay Dashboard में ये दो सेटिंग ज़रूर चेक करो:
   - **Payment Capture → Automatic** (वरना पेमेंट कुछ दिन बाद अपने-आप रिफ़ंड हो जाता है)
   - **Email notifications** चालू करो, ताकि हर पेमेंट का ईमेल आए
6. ऑनलाइन ऑर्डर की पूरी जानकारी (नाम, फ़ोन, पता, आइटम, साइज़) Razorpay Dashboard → **Payments → पेमेंट खोलो → Notes** में मिलेगी।

> पहले टेस्ट करना हो तो Razorpay के **Test Mode** वाली keys (`rzp_test_...`) डालो, टेस्ट पेमेंट करके देखो, फिर Live keys डाल दो।

## ऑर्डर कैसे आएँगे
- **Razorpay चालू होने पर:** ग्राहक ऑनलाइन पेमेंट करेगा, पैसे सीधे आपके बैंक में आएँगे, और ऑर्डर की डिटेल Razorpay में मिलेगी। ग्राहक को WhatsApp पर अपडेट माँगने का बटन भी मिलता है।
- **Razorpay चालू होने से पहले:** पूरा ऑर्डर (आइटम, साइज़, पता) WhatsApp पर 70733 50886 पर आएगा।

## Google पर दिखने के लिए (SEO)
- **Google Search Console** (search.google.com/search-console) → Domain जोड़ो → Cloudflare पर DNS होने से verification आसान रहता है → `https://bahekurtiz.com/sitemap.xml` सबमिट करो।
- प्रोडक्ट का नाम हमेशा ऐसे रखो: **रंग + कपड़ा + स्टाइल + Kurti**।
- Google Business Profile, Instagram bio, Etsy और Myntra प्रोफ़ाइल में `bahekurtiz.com` का लिंक डालो।
- वेबसाइट में पहले से है: हर पेज का SEO टाइटल, प्रोडक्ट schema (दाम, स्टॉक, फ़ोटो), breadcrumbs, sitemap, robots.txt, पुराने लिंक के redirect और तेज़ मोबाइल लोडिंग।

## फ़ोल्डर में क्या है
- `content/products/` – प्रोडक्ट (एडमिन से बदलो)
- `content/blog/` – ब्लॉग पोस्ट (एडमिन से लिखो)
- `content/settings.json` – WhatsApp, लिंक, पेमेंट, पॉलिसी (एडमिन से बदलो)
- `content/redirects.txt` – पुराने लिंक → नए पेज
- `functions/` + `lib/` – पेमेंट सर्वर (इसे मत छेड़ो)
- `static/` – फ़ोटो, डिज़ाइन, एडमिन पैनल
- `build.mjs` – वेबसाइट बनाने वाला प्रोग्राम (इसे मत छेड़ो)
