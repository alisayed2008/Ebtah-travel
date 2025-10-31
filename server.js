import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const PAYMOB_API_KEY = "ZXlKaGJHY2lPaUpJVXpVeE1pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SmpiR0Z6Y3lJNklrMWxjbU5vWVc1MElpd2ljSEp2Wm1sc1pWOXdheUk2TVRBM01qRTNNaXdpYm1GdFpTSTZJbWx1YVhScFlXd2lmUS5RU3U4VDdjQkdaZURVeEk5M0RRRmxMT0ltSDNya0ZkckplbXozSDJhSDM0dzhPRFNGaDZoRkNRcGZ3UzFKQ1hxSEd2aGkxUFpMV2U3YVdYcnJROVRJZw==";
const PAYMOB_IFRAME_ID = "954210"; // غيرها حسب حسابك
const PAYMOB_INTEGRATION_ID = "5257399"; // اللي انت كتبته فوق

app.post("/api/create_payment", async (req, res) => {
  try {
    // 1️⃣ إنشاء order جديد
    const orderResp = await fetch("https://accept.paymob.com/api/ecommerce/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_token: PAYMOB_API_KEY,
        delivery_needed: false,
        amount_cents: 10000, // المبلغ × 100
        currency: "EGP",
        items: [],
      }),
    });

    const orderData = await orderResp.json();
    const orderId = orderData.id;

    // 2️⃣ إنشاء payment key
    const payKeyResp = await fetch("https://accept.paymob.com/api/acceptance/payment_keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_token: PAYMOB_API_KEY,
        amount_cents: 10000,
        expiration: 3600,
        order_id: orderId,
        billing_data: {
          apartment: "NA",
          email: "customer@example.com",
          floor: "NA",
          first_name: req.body.bookerName || "Client",
          street: "NA",
          building: "NA",
          phone_number: req.body.phone || "01000000000",
          shipping_method: "NA",
          postal_code: "00000",
          city: "Cairo",
          country: "EG",
          last_name: "User",
          state: "NA",
        },
        currency: "EGP",
        integration_id: PAYMOB_INTEGRATION_ID,
      }),
    });

    const payKeyData = await payKeyResp.json();
    const iframeUrl = `https://accept.paymob.com/api/acceptance/iframes/${PAYMOB_IFRAME_ID}?payment_token=${payKeyData.token}`;

    res.json({ iframe_url: iframeUrl });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ message: "خطأ أثناء إنشاء الدفع" });
  }
});

app.listen(3000, () => console.log("✅ Server running on http://localhost:3000"));
