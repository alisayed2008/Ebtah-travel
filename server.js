// server.js (CommonJS) — استخدم Node 14+
// خطوات سريعة: npm init -y && npm i express node-fetch@2 cors
// ثم: node server.js

const express = require('express');
const fetch = require('node-fetch'); // v2
const cors = require('cors');

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(cors()); // للسماح بطلبات من المتصفح أثناء التطوير

const PORT = process.env.PORT || 3000;
const PAYMOB_API_KEY = process.env.PAYMOB_API_KEY || '<ضع-مفتاح-الـAPI-هنا>';
const INTEGRATION_ID = process.env.PAYMOB_INTEGRATION_ID || '5257399';
const IFRAME_ID = process.env.PAYMOB_IFRAME_ID || '954210';

app.get('/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

app.post('/api/create_payment', async (req, res) => {
  try {
    const booking = req.body || {};
    // حساب مبلغ تجريبي (غير ثابت، عدّله بحسب منطقك)
    const pricePerPersonEGP = Number(process.env.PRICE_PER_PERSON || 1200);
    const amount_cents = Math.max(1, pricePerPersonEGP * (booking.numPeople || 1)) * 100;

    // 1) auth token
    const authRes = await fetch('https://accept.paymob.com/api/auth/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: PAYMOB_API_KEY })
    });
    const authJson = await authRes.json();
    if (!authRes.ok) return res.status(500).json({ message: 'PayMob auth failed', detail: authJson });

    const authToken = authJson.token;

    // 2) create order
    const orderBody = {
      auth_token: authToken,
      delivery_needed: "false",
      amount_cents,
      currency: "EGP",
      items: [{ name: 'Booking', amount_cents, description: booking.trip || 'حجز' }]
    };
    const orderRes = await fetch('https://accept.paymob.com/api/ecommerce/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderBody)
    });
    const orderJson = await orderRes.json();
    if (!orderRes.ok) return res.status(500).json({ message: 'PayMob create order failed', detail: orderJson });

    // 3) payment key
    const billing = {
      apartment: "N/A",
      email: booking.email || "no-reply@example.com",
      floor: "N/A",
      first_name: booking.bookerName || "عميل",
      street: "N/A",
      building: "N/A",
      phone_number: booking.phone || "",
      city: booking.city || "Cairo",
      country: booking.country || "EG",
      last_name: ""
    };

    const payKeyBody = {
      auth_token: authToken,
      amount_cents,
      expiration: 3600,
      order_id: orderJson.id,
      billing_data: billing,
      integration_id: Number(INTEGRATION_ID)
    };

    const payKeyRes = await fetch('https://accept.paymob.com/api/acceptance/payment_keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payKeyBody)
    });
    const payKeyJson = await payKeyRes.json();
    if (!payKeyRes.ok) return res.status(500).json({ message: 'PayMob payment key failed', detail: payKeyJson });

    const iframe_url = `https://accept.paymob.com/api/acceptance/iframes/${IFRAME_ID}?payment_token=${payKeyJson.token}`;

    // رد على الكلاينت
    return res.json({ ok: true, iframe_url, orderId: orderJson.id, raw: { orderJson, payKeyJson } });
  } catch (err) {
    console.error('server error:', err);
    return res.status(500).json({ ok:false, message: 'server error', error: String(err) });
  }
});

app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
