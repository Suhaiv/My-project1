// server.js
require('dotenv').config();
const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// JSON body parser (for create-order & verify endpoints)
app.use(express.json());

// Initialize Razorpay with keys from .env
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

/**
 * Create order -> called by frontend
 * IMPORTANT: compute amount server-side. Do not trust client.
 */
app.post('/create-order', async (req, res) => {
  try {
    // Example fixed amount: ₹500 -> 50000 paise
    // Replace logic to compute from cart/product in real app
    const amountInPaise = 50000;

    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: "rcpt_" + Date.now(),
      payment_capture: 1 // 1 = auto-capture; use 0 for authorize-only
    };

    const order = await razorpay.orders.create(options);
    return res.json(order);
  } catch (err) {
    console.error("Order creation failed:", err);
    return res.status(500).json({ error: "order_creation_failed", details: err.message });
  }
});

/**
 * Verify payment -> called by frontend handler after successful checkout
 */
app.post('/verify-payment', (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ verified: false, error: "missing_parameters" });
    }

    const generated_signature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest('hex');

    if (generated_signature === razorpay_signature) {
      // TODO: mark order as paid in DB and save payment details
      console.log("Payment verified:", razorpay_payment_id);
      return res.json({ verified: true });
    } else {
      console.warn("Signature mismatch", { generated_signature, razorpay_signature });
      return res.json({ verified: false, error: "signature_mismatch" });
    }
  } catch (err) {
    console.error("Verification error:", err);
    return res.status(500).json({ verified: false, error: err.message });
  }
});

/**
 * Webhook endpoint (recommended)
 * Use express.raw middleware so signature verification works
 */
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers['x-razorpay-signature'];

  const expected = crypto.createHmac('sha256', webhookSecret)
    .update(req.body)
    .digest('hex');

  if (signature === expected) {
    const payload = JSON.parse(req.body.toString());
    console.log("Webhook event:", payload.event);
    // TODO: handle events (payment.captured, payment.failed, etc.)
    return res.status(200).send('ok');
  } else {
    console.warn("Webhook signature mismatch");
    return res.status(400).send('invalid signature');
  }
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
