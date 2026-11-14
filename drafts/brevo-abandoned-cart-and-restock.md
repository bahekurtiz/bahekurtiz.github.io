# Brevo setup: abandoned-cart reminder and back-in-stock alert

> These drafts were prepared automatically. The website already captures the contacts, so you only need to switch the automation on in Brevo (about 10 minutes).
> No discount is promised anywhere. If you ever want to add a coupon to the reminder, tell Claude first.

## 1. Abandoned-cart reminder

**What the website already does:**
- When a shopper fills in their email at checkout, they are added to the Brevo list **Bahe Checkout Started**.
- When they pay, they are moved to **Bahe Customers** and removed from Checkout Started.
- So everyone still on Checkout Started a few hours later has **not finished** their order.

**Set it up in Brevo:**
1. Go to Automations → Create an automation → "Custom workflow".
2. Set the entry point to "Contact added to a list" → **Bahe Checkout Started**.
3. Add a "Wait" step of 3 hours.
4. Add a condition: "Contact is in list **Bahe Checkout Started**". If yes, continue to the next step. If no, exit (they paid).
5. Add a "Send an email" step using Email 1 below.
6. Optional: wait 2 days, check the same condition, then send Email 2.
7. Exit the workflow when the contact joins the list **Bahe Customers**.

Link: https://app.brevo.com/automation/list

### Email 1 – 3 hours later
**Subject:** Your outfit is still waiting 💚
**Preheader:** Questions about the size or delivery? We are one message away.

Hi {{ contact.FIRSTNAME | default : "there" }},

You were looking at something lovely on Bahe Kurtiz – your bag is saved on the same phone or computer.

- **Not sure of the size?** Every piece can be stitched to your measurements at no extra cost. Use the [size converter](https://bahekurtiz.com/tools/indian-size-converter/) or just reply with your bust, waist and hip.
- **Delivery:** ready sizes ship in 7–10 working days; abroad, free express shipping with duties included to the USA, UK, Canada, UAE and Australia.

[Finish my order](https://bahekurtiz.com/checkout/)

Questions? [WhatsApp us](https://wa.me/917073350886) – a real person from our Jaipur team will reply.

Team Bahe Kurtiz

### Email 2 – 2 days later (optional)
**Subject:** Need help choosing?
**Preheader:** Ask friends, check your size, or talk to us.

Hi {{ contact.FIRSTNAME | default : "there" }},

Still deciding? Three things that help:

1. **Ask friends** – tap "Help me choose" on any product page and share a quick poll.
2. **Check the last order date** for your next event: [festival calendar](https://bahekurtiz.com/festival/).
3. **Talk to us** on [WhatsApp](https://wa.me/917073350886) – we can send more photos or a video of the piece.

[Back to my bag](https://bahekurtiz.com/checkout/)

Team Bahe Kurtiz

## 2. Back-in-stock alert

**What the website already does:**
- On a sold-out size, "Notify me" saves the shopper's WhatsApp number to the order sheet (type: restock).
- If they also give an email, it goes to the Brevo list **Bahe Restock Alerts**, with the product and size noted.

**When a size is back:** send a short campaign to that list. Filter by product if you want – the product and size are in the restock row of your sheet.

**Subject:** It's back: {{ product }} in your size
**Body:** Good news – the size you asked for is available again. [Shop it here](link to the product). Ready sizes ship in 7–10 working days.

## 3. Price-drop alert – not built

Prices are not lowered automatically. A price-drop alert would only make sense if you decide to run a sale. Tell Claude before any price change; the alert can then be added for that sale.
