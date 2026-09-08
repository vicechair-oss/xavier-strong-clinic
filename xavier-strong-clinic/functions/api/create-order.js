/**
 * POST /api/create-order   (Path A only: Pay with Venmo via PayPal)
 * Creates a PayPal order with the $20 amount fixed server-side and the
 * registration reference attached as custom_id, so capture can reconcile it.
 */
import { json, bad, clean, paypalBase, paypalToken, FEE_USD } from '../_shared.js';

export async function onRequestPost({ request, env }) {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_SECRET) {
    return bad('Payment is not configured yet.', 503);
  }

  let body;
  try { body = await request.json(); } catch { return bad('Malformed request.'); }

  const reference = clean(body.reference, 32);
  if (!/^XS-[A-Z]{3}-\d{4}$/.test(reference)) return bad('Missing registration reference.');

  try {
    const token = await paypalToken(env);
    const res = await fetch(`${paypalBase(env)}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: reference,
          custom_id: reference,
          description: 'Xavier Strong Baseball Clinic registration',
          amount: { currency_code: 'USD', value: FEE_USD },
        }],
        application_context: {
          brand_name: 'All Things Foundation',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW',
        },
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('create-order: paypal rejected', JSON.stringify(data));
      return bad('Could not start the payment. Please try again.', 502);
    }
    return json({ ok: true, id: data.id });
  } catch (err) {
    console.error('create-order failed', err.message);
    return bad('Could not start the payment. Please try again.', 502);
  }
}

export const onRequestGet = () => bad('POST only.', 405);
