import { json, hasKeys } from "../../lib/payments.js";
// Tells the checkout page whether online payment (Razorpay) is switched on.
export const onRequestGet = ({ env }) => json({ online: hasKeys(env) });
