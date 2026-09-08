/**
 * POST /api/capture-order   (Path A only)
 * Captures the PayPal/Venmo payment, then marks the matching Airtable row Paid.
 * The reference comes back from PayPal's own record, never from the client.
 */
import {
  json, bad, clean, paypalBase, paypalToken,
  airtableFindByReference, airtableUpdate, FEE_USD,
} from '../_shared.js';

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return bad('Malformed request.'); }

  const orderId = clean(body.orderID, 40);
  if (!orderId) return bad('Missing order id.');

  let capture;
  try {
    const token = await paypalToken(env);
    const res = await fetch(`${paypalBase(env)}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    });
    capture = await res.json();
    if (!res.ok) {
      console.error('capture-order: paypal rejected', JSON.stringify(capture));
      return bad('Payment could not be completed.', 502);
    }
  } catch (err) {
    console.error('capture-order failed', err.message);
    return bad('Payment could not be completed.', 502);
  }

  const unit      = capture?.purchase_units?.[0];
  const payment   = unit?.payments?.captures?.[0];
  const reference = unit?.custom_id || unit?.reference_id || '';
  const paidValue = payment?.amount?.value;
  const captureId = payment?.id || '';
  const source    = capture?.payment_source ? Object.keys(capture.payment_source)[0] : '';

  // Money is captured at this point. If the bookkeeping below fails we still
  // return success to the parent, and log loudly so it can be fixed by hand.
  if (reference) {
    try {
      const record = await airtableFindByReference(env, reference);
      if (record) {
        await airtableUpdate(env, record.id, {
          'Payment Status': paidValue === FEE_USD ? 'Paid' : 'Paid (amount mismatch)',
          'Payment Method': source === 'venmo' ? 'Venmo' : 'PayPal',
          'Payment Ref':    captureId,
          'Paid At':        new Date().toISOString().slice(0, 10),
          'Amount':         Number(paidValue || 0),
        });
      } else {
        console.error('capture-order: no Airtable row for reference', reference, captureId);
      }
    } catch (err) {
      console.error('capture-order: airtable update failed', err.message, { reference, captureId });
    }
  }

  return json({ ok: true, reference, captureId, method: source === 'venmo' ? 'Venmo' : 'PayPal' });
}

export const onRequestGet = () => bad('POST only.', 405);
