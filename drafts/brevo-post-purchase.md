# Brevo – after-purchase emails (setup draft, switch on yourself in Brevo)

> Owner note: nothing here is sent automatically until you create these automations in Brevo → Automations. Lists: "Bahe Customers" (service emails, incl. one review request) and VIP/festival lists (marketing, only people who ticked consent). Never offer a discount or gift for a review.

**Consent rules**
- Email: customers who gave email at checkout are in Brevo list "Bahe Customers". Service emails about their order (incl. one review request) are fine. Marketing emails only to people who ticked consent (VIP / festival lists). Every email has unsubscribe.
- WhatsApp: 1:1 messages to a customer about **their own order** are fine. Marketing messages only to people who joined the WhatsApp VIP / Channel / saved our number for updates. Broadcast lists in the Business app only reach people who saved our number – keep it that way. No bulk messages to bought or scraped numbers.
> - **Reviews: never offer a discount, coupon or gift in exchange for a review.** Google and Etsy both forbid it. Ask everyone the same way, happy or not. Do not ask only happy customers ("review gating").

### 5.1 Timing

| Step | India | Abroad | Channel |
|---|---|---|---|
| Order confirmation | instant (live) | instant (live) | Email (`order-notify.js`) + WhatsApp |
| "Your piece is being made" photo | at dispatch | at dispatch | WhatsApp 1:1 (Promise page says we send photos) |
| Delivered check + review request | ~3 days after delivery (≈ order + 12–14 days) | ≈ order + 20–25 days | WhatsApp 1:1 + Brevo email |
| Care tip + "how to style" | +7 days after delivery | same | Email |
| Repeat purchase nudge | +45 days, or 6 weeks before the next festival they care about | same | Email (if consent) / WhatsApp (if opted in) |
| Referral invite | with care tip, and again after a 2nd order | same | Email + WhatsApp |
| Win-back | 6 months, once | same | Email (if consent) |

### 5.2 Message drafts

**R1. Review request – WhatsApp (1:1, sent by Suresh)**
> Hi {Name}, Suresh from Bahe Kurtiz, Jaipur. Your {product} should have reached you – did it fit well? If anything is not right, tell me first and we'll fix it.
> If you have 1 minute, an honest review helps our small unit a lot: {review_link}
> Thank you 🙏

Hinglish:
> Namaste {Name} ji, Bahe Kurtiz se Suresh. Aapka {product} mil gaya hoga – fitting theek aayi? Kuch bhi gadbad ho to pehle mujhe batayein, hum theek karenge. Agar 1 minute ho, to apna sachcha review yahan likh dijiye: {review_link}. Dhanyavaad 🙏

`{review_link}`: India → Google review link (`https://g.page/r/CZRg9KONAiAfEBM/review`). Abroad → website `/review/` page (also fine to give the Google link). Etsy orders → Etsy asks automatically; don't ask twice.

**R2. Review request – email (Brevo automation on "Bahe Customers")**
> Subject: How does your {product} fit?
> Preheader: A quick question from our Jaipur unit.
>
> Hi {FIRSTNAME},
> Your outfit was made in our unit in Sanganer, Jaipur. We hope it fits well and feels good.
> **If anything is not right** – size, colour, stitching – just reply to this email or WhatsApp us. We will fix it.
> **If you like it**, an honest review helps other women decide: [Write a review]({review_link})
> Thank you,
> Suresh & team, Bahe Kurtiz
> [Unsubscribe]

**L1. Care + styling – email (+7 days after delivery)**
> Subject: 3 ways to style your {category}
> Hi {FIRSTNAME}, here are quick ideas for your {product}: {guide link from blog}. Washing tips: {care guide link}. Questions? Reply here.
> P.S. If a friend asks where it's from, here is your personal link – they get a welcome gift and you get Saheli Credit after their order is delivered: https://bahekurtiz.com/refer/

**L2. Repeat purchase – email (only if marketing consent)**
> Subject: {Festival} is on {date} – order by {last order date}
> Hi {FIRSTNAME}, {festival} is coming. For delivery to {country} in time, please order by **{last order date}** (custom fit by {date}).
> Picks from our unit: {3 product links from festival engine}
> As a past customer, your THANKYOU10 code still works. (Only include if the code is active in settings, and remove the line if not.)

**L3. Repeat purchase – WhatsApp (only VIP/opted-in)**
> Hi {Name}, {festival} is on {date}. Last order date for {country}: {date}. New this week from our unit: {link}. Reply STOP and we won't message again.

**L4. Referral – WhatsApp (1:1, after a happy reply)**
> So happy it fit well, {Name}! If your sister or friends ask, here's your personal link: {refer link}. They get {FRIEND10 – 10% off first order}, and you get Saheli Credit once their order is delivered. No pressure at all 🙂

**L5. Win-back – email, once at 6 months**
> Subject: Still in Jaipur, still stitching
> Hi {FIRSTNAME}, it's been a while. Here's what's new from our unit: {3 links}. If your last order had any issue, reply and tell me – I read every message. – Suresh
> [Unsubscribe]

> **Coupons rule:** FRIEND10 and THANKYOU10 are real and active in settings. Keep them as standing customer benefits (fine). Do **not** add a fake "ends tonight" timer or invent a "was" price.
