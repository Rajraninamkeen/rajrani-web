// Session 19 live E2E — async gateway refund reconciliation.
//
// Same driver spine as e2e-razorpay.mjs but expects the Razorpay mock to be
// running in REFUND_ASYNC mode (refunds return 'pending'), so:
//   - completeRefund submits the gateway refund but leaves the local Refund in
//     PROCESSING (RefundTransaction PENDING) + a REFUND_PROCESSING event.
//   - the driver then posts a signed razorpay `refund.processed` webhook (raw-body
//     HMAC) referencing the real rfnd_ gatewayRef -> ReturnsService.reconcileRefundFromEvent
//     finalises the Refund to COMPLETED, completes the return request, and marks
//     the order REFUNDED once fully refunded.
//
// Requires mock (REFUND_ASYNC=1) + API (razorpay provider) already running.
// Env: API, RAZORPAY_WEBHOOK_SECRET, CUST/CPW, OPER/OPW, SELLER/SPW, PRODUCT, QTY.
import { createHmac } from 'node:crypto';

const API = (process.env.API || 'http://localhost:4000/api/v1').replace(/\/+$/, '');
const MOCK = (process.env.MOCK || 'http://localhost:3912').replace(/\/+$/, '');
const SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'whsec_e2e';
const CUST = process.env.CUST || 's12@example.com';
const CPW = process.env.CPW || 'Test@12345';
const OPER = process.env.OPER || 'pfop@example.com';
const OPW = process.env.OPW || 'Operator@123';
const SELLER = process.env.SELLER || 'seller1@example.com';
const SPW = process.env.SPW || 'Seller@123';
const PRODUCT = process.env.PRODUCT || 'nylon-sev-gujarati';
const QTY = Number(process.env.QTY || 1);

let step = 0;
function ok(label, cond, extra = '') {
  step++;
  if (!cond) { console.error(`FAIL [${step}] ${label}${extra ? ' | ' + extra : ''}`); process.exitCode = 1; throw new Error(label); }
  console.log(`ok   [${step}] ${label}${extra ? ' | ' + extra : ''}`);
}

async function req(method, path, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(API + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data = null; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, text };
}
const auth = (email, pw) => req('POST', '/auth/login', { body: { email, password: pw } })
  .then((r) => { if (r.status !== 200 && r.status !== 201) throw new Error('login ' + email + ' ' + r.text); return r.data.data.tokens.accessToken; });

async function deliver(orderId, soId, opTok, sellerTok) {
  const advance = (s) => req('POST', `/orders/${orderId}/fulfilment/advance`, { token: opTok, body: { toStatus: s } });
  for (const s of ['CONFIRMED', 'PACKED']) { const r = await advance(s); ok(`operator advance ${s}`, r.status < 300); }
  const acc = await req('POST', `/seller/orders/${soId}/accept`, { token: sellerTok, body: {} });
  ok('seller accepted slice', acc.status < 300, soId);
  for (const s of ['SHIPPED', 'DELIVERED']) { const r = await advance(s); ok(`operator advance ${s}`, r.status < 300); }
}

async function run() {
  const cust = await auth(CUST, CPW);
  const op = await auth(OPER, OPW);
  const seller = await auth(SELLER, SPW);
  ok('logins (customer/operator/seller)', !!cust && !!op && !!seller);

  const address = { name: 'Async Buyer', phone: '9876543210', line1: '1 MG Road', line2: '', city: 'Indore', state: 'MP', pincode: '452001' };
  const bn = await req('POST', '/buy-now', { token: cust, body: { productId: PRODUCT, quantity: QTY, paymentMethod: 'PREPAID', address } });
  ok('buy-now razorpay order placed', bn.status < 300, bn.data?.data?.order?.orderNumber || bn.text);
  const order = bn.data.data.order;
  const orderId = order.id;

  const pay = await req('GET', `/orders/${orderId}/payment`, { token: cust });
  ok('payment intent is razorpay', pay.data?.data?.provider === 'razorpay', pay.data?.data?.provider);
  // resolve the razorpay order id the mock recorded for this order (by receipt)
  const mock = await (await fetch(MOCK + '/__orders')).json();
  const rz = mock.orders.find((o) => o.receipt === `order-${orderId}`);
  ok('payment has a gateway (mock) order id', !!rz, rz?.id);
  const rzOrderId = rz.id;

  // capture via razorpay webhook
  const amountPaise = Math.round(pay.data.data.amount * 100);
  const payId = `pay_e2e_${Date.now().toString(36)}`;
  const entity = { id: payId, entity: 'payment', amount: amountPaise, currency: 'INR', order_id: rzOrderId, status: 'captured' };
  const raw = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity } } });
  const sig = createHmac('sha256', SECRET).update(raw).digest('hex');
  const wh = await fetch(API + '/payments/webhook/razorpay', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': sig }, body: raw });
  const whj = await wh.json();
  ok('razorpay webhook captures (order PAID)', wh.status < 300 && whj.data?.idempotent === false, JSON.stringify(whj.data));

  const o2 = await req('GET', `/orders/${orderId}`, { token: cust });
  ok('order paymentStatus PAID', o2.data?.data?.paymentStatus === 'PAID');

  const soId = order.sellerOrders?.[0]?.id;
  ok('seller slice available', !!soId, soId);
  await deliver(orderId, soId, op, seller);

  const oiId = order.items[0].orderItemId;
  const rrq = await req('POST', `/orders/${orderId}/returns`, { token: cust, body: { reasonCode: 'DEFECTIVE', items: [{ orderItemId: oiId, quantity: QTY }] } });
  ok('customer return requested', rrq.status < 300);
  const rrId = rrq.data.data.id;
  await req('POST', `/return-requests/${rrId}/decision`, { token: op, body: { approve: true, reason: 'ok' } });
  await req('POST', `/return-requests/${rrId}/pickup`, { token: op });
  await req('POST', `/return-requests/${rrId}/picked-up`, { token: op });
  const riId = rrq.data.data.items[0].id;
  const insp = await req('POST', `/return-requests/${rrId}/inspection`, { token: op, body: { items: [{ returnItemId: riId, result: 'PASS' }] } });
  ok('inspection PASS -> APPROVED_FOR_REFUND', insp.data?.data?.status === 'APPROVED_FOR_REFUND');

  // initiate refund
  const init = await req('POST', `/return-requests/${rrId}/refund`, { token: op });
  ok('refund initiated', init.data?.data?.refund?.status === 'PENDING', init.data?.data?.refund?.refundReference);

  // complete -> gateway refund submitted; mock returns pending -> local Refund PROCESSING
  const comp = await req('POST', `/return-requests/${rrId}/refund/complete`, { token: op });
  const rf = comp.data?.data?.refund;
  ok('refund submitted but IN-FLIGHT (PROCESSING)', rf?.status === 'PROCESSING', `${rf?.refundReference} status=${rf?.status}`);
  ok('in-flight refund carries a real gatewayRef', (rf?.gatewayRef || '').startsWith('rfnd_'), rf?.gatewayRef);

  // Now the gateway reports refund.processed -> async reconciliation completes it.
  const rent = { id: rf.gatewayRef, entity: 'refund', amount: Math.round(rf.amount * 100), currency: 'INR', payment_id: payId, status: 'processed' };
  const raw2 = JSON.stringify({ event: 'refund.processed', payload: { refund: { entity: rent } } });
  const sig2 = createHmac('sha256', SECRET).update(raw2).digest('hex');
  const wh2 = await fetch(API + '/payments/webhook/razorpay', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': sig2 }, body: raw2 });
  const wh2j = await wh2.json();
  const rec = wh2j.data || wh2j;
  ok('refund.processed webhook reconciles to COMPLETED', rec?.status === 'COMPLETED', JSON.stringify(rec));
  ok('reconciled return request is COMPLETED', rec?.request?.status === 'COMPLETED', rec?.request?.status);

  // idempotent replay of refund.processed is a no-op
  const wh3 = await fetch(API + '/payments/webhook/razorpay', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': sig2 }, body: raw2 });
  const wh3j = await wh3.json();
  const rec3 = wh3j.data || wh3j;
  ok('replayed refund.processed is idempotent', rec3?.idempotent === true, JSON.stringify(rec3));

  console.log('\nE2E_ASYNC order=' + order.orderNumber + ' orderId=' + orderId + ' razorpayOrder=' + rzOrderId +
    ' payment=' + payId + ' return=' + rrId + ' refund=' + rf?.refundReference + ' gatewayRef=' + rf?.gatewayRef + ' reconciled=' + rec?.status);
}

run().catch((e) => { console.error('\nE2E failed:', e.message); process.exit(process.exitCode || 1); });
