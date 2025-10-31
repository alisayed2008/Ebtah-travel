// server.js
// مثال Express بسيط لإنشاء طلب دفع عبر PayMob (illustrative).
// IMPORTANT: تحقق من مستندات PayMob الرسمية للحقول المطلوبة وتحديثات الـ endpoints.

import express from 'express';
import fetch from 'node-fetch'; // أو استخدم global fetch في Node 18+
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

const PAYMOB_API_KEY = process.env.PAYMOB_API_KEY;           // ضع هنا مفتاحك السري
const INTEGRATION_ID = process.env.PAYMOB_INTEGRATION_ID;   // integration_id من لوحة PayMob
const IFRAME_ID = process.env.PAYMOB_IFRAME_ID;             // iframe id (مثال: 1234)

if(!PAYMOB_API_KEY || !INTEGRATION_ID || !IFRAME_ID){
  console.warn('⚠️ تأكد من وضع PAYMOB_API_KEY و PAYMOB_INTEGRATION_ID و PAYMOB_IFRAME_ID في .env');
}

// 1) الحصول على auth token من PayMob
async function getPaymobAuthToken(){
  const res = await fetch('https://accept.paymob.com/api/auth/tokens', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({api_key: PAYMOB_API_KEY})
  });
  const j = await res.json();
  return j.token; // token = auth_token
}

// 2) إنشاء أمر (order)
async function createOrder(authToken, amount_cents, items=[]){
  const body = {
    auth_token: authToken,
    delivery_needed: "false",
    amount_cents: amount_cents,
    currency: "EGP",
    items: items
  };
  const res = await fetch('https://accept.paymob.com/api/ecommerce/orders', {
    method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)
  });
  return await res.json(); // contains id and other info
}

// 3) الحصول على payment_key (مفتاح الدفع) مع billing data
async function getPaymentKey(authToken, orderId, amount_cents, billingData={}){
  const body = {
    auth_token: authToken,
    amount_cents: amount_cents,
    expiration: 3600,
    order_id: orderId,
    billing_data: billingData,
    integration_id: Number(INTEGRATION_ID)
  };
  const res = await fetch('https://accept.paymob.com/api/acceptance/payment_keys', {
    method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)
  });
  return await res.json(); // contains token: "payment_token"
}

app.post('/api/create_payment', async (req, res) => {
  try{
    // بيانات الحجز من الـ frontend
    const booking = req.body || {};
    // احسب المبلغ بالمليم أو "cents" (PayMob يتطلب smallest currency unit)
    // هنا مثال: نفرض 1000 EGP لكل شخص — غيّر الحساب حسب موقعك
    const pricePerPersonEGP = 1000;
    const amount_cents = (pricePerPersonEGP * (booking.numPeople || 1)) * 100; // مثال: 1000 EGP -> 100000 cents

    // 1) auth token
    const authToken = await getPaymobAuthToken();

    // 2) create order
    const orderResp = await createOrder(authToken, amount_cents, [
      {name: 'Booking', amount_cents, description: `حجز ${booking.type}`, quantity: 1}
    ]);
    const orderId = orderResp.id;

    // 3) payment key with billing data (اجعل البيانات مناسبة)
    const billing = {
      apartment: "N/A",
      email: booking.email || "no-reply@example.com",
      floor: "N/A",
      first_name: booking.booker || "عميل",
      street: "N/A",
      building: "N/A",
      phone_number: booking.phone || "",
      city: "Cairo",
      country: "EG",
      last_name: ""
    };

    const payKeyResp = await getPaymentKey(authToken, orderId, amount_cents, billing);
    const paymentToken = payKeyResp.token; // payment_token

    // 4) iframe URL
    const iframe_url = `https://accept.paymob.com/api/acceptance/iframes/${IFRAME_ID}?payment_token=${paymentToken}`;

    // إرجاع الرابط للـ frontend
    res.json({ok:true, iframe_url});
  }catch(err){
    console.error(err);
    res.status(500).json({ok:false, message:'create_payment error', error: err.message});
  }
});

app.use(express.static('public')); // serve frontend if placed in public/

app.listen(PORT, ()=> console.log(`Server listening on ${PORT}`));
