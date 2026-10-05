BAHE KURTIZ 2050 — CONSOLIDATED DEPLOY PACKAGE
Base: user's latest GitHub main ZIP supplied in this chat.

PRESERVED
- Current catalog/products/content and images
- Mera Size existing implementation
- Cart/bag, wishlist, Style Finder, WhatsApp
- Feed / Watch & Shop
- Mirror 2.0 and family vote/share
- Refer & Earn foundation
- Wholesale / Private Label / Export
- Existing Cloudflare Pages Functions and Razorpay India server verification foundation

2050 CONSOLIDATED CHANGES IN THIS PACKAGE
- Mobile + desktop discovery parity links for Feed, Mirror, Refer & Earn, My Designs
- Homepage lightweight BAHE 2050 discovery strip
- New My Designs / Vote & Share page with local saved votes and viral share URL
- Explicit international selling price hard lock: no INR -> USD business-price fallback
- Existing automatic country/language/local-currency presentation preserved
- Existing viral sharing/referral/wishlist/Mirror share loops preserved
- No full-body language translation MutationObserver added
- Heavy Mirror/feed behavior remains on their own pages/lazy paths

PAYMENT REALITY
- India Razorpay server-side order/signature foundation is preserved.
- Live gateway requires Cloudflare environment secrets and approved merchant account.
- International checkout currently retains the site's existing PayPal-invoice fallback. A true international live gateway requires provider approval/credentials and should be activated/tested separately before claiming it is live.

VALIDATION PERFORMED
- node --check build.mjs : PASS
- node --check static/assets/app.js : PASS
- node build.mjs : PASS (39 pages, 4 products, 2 categories)
- generated /designs/ page : PASS
- desktop/mobile 2050 discovery links generated : PASS
- INR->USD automatic selling-price fallback absent : PASS

SAFETY
Keep the current main/backup available until the deployed site passes live smoke tests.
