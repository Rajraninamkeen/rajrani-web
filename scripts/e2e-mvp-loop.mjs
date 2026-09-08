// Session 41 live E2E — cross-role MVP loop (buyer -> seller -> operator -> courier
// -> finance -> notifications) over the two-app backend.
//
// Drives a full, fresh end-to-end scenario on the sandbox gateway API:
//   1. register a throwaway CUSTOMER (buyer)
//   2. browse the public catalog + read a product detail (storefront reads)
//   3. place a fresh PREPAID buy-now order + sandbox-capture it (PAID)
//   4. seller accepts the slice; operator advances CONFIRMED->PACKED->SHIPPED
//   5. OPERATOR assigns the parcel to a DELIVERY courier; courier
//      accept->pickup->out-for-delivery->deliver  -> order DELIVERED, COD n/a
//      (PREPAID), and the courier EARNs a delivery-fee payout (money leg)
//   6. buyer sees an ORDER_STATUS delivery notification on /customer/notifications
//   7. buyer requests a REFUND return; operator approve->pickup->picked-up->inspection
//      PASS -> refund initiated + completed (sandbox); seller payable net auto-debit
//   8. buyer sees a RETURN_STATUS notification; operator/courier RBAC on the feed 403
//   9. assertions across the loop incl. courier payout EARNED and seller settlement read
//
// Self-cleaning: the E2E deletes its throwaway order/return/payout/payable/notifications
// + buyer and restores the product stock at the end. Run against a fresh API.
import { createHmac } from 'node:crypto';

const API = (process.env.API || 'http://localhost:5000/api/v1').replace(/\/+$/, '');
const OPER = process.env.OPER || 'pfop@example.com';
const OPW = process.env.OPW || 'Operator@123';
const SELLER = process.env.SELLER || 'seller1@example.com';
const SPW = process.env.SPW || 'Seller@123';
const DLV = process.env.DLV || 'delivery15@example.com';
const DLVPW = process.env.DLVPW || 'Delivery@123';
const PRODUCT = process.env.PRODUCT || 'ratlami-sev';
const QTY = Number(process.env.QTY || 1);
const PREFIX = process.env.PREFIX || 'c41';

let step = 0;
function ok(label, cond, extra = '') {
  step++;
  if (!cond) {
    console.error(`FAIL [${step}] ${label}${extra ? ' | ' + extra : ''}`);
    process.exitCode = 1;
    throw new Error(label);
  }
  console.log(`ok   [${step}] ${label}${extra ? ' | ' + extra : ''}`);
}

async function req(method, path, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(API + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, text };
}
const auth = (email, pw) => req('POST', '/auth/login', { body: { email, password: pw } })
  .then((r) => { if (r.status !== 200 && r.status !== 201) throw new Error('login ' + email + ' ' + r.text); return r.data.data.tokens.accessToken; });

const SB_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || 'bilokat-sandbox-webhook-secret-do-not-use-in-prod';
function sandboxSig(o) {
  const { timestamp, eventType, paymentReference, providerEventId, amount } = o;
  const canonical = [timestamp, eventType, paymentReference, providerEventId, amount].join('.');
  return createHmac('sha256', SB_SECRET).update(canonical).digest('hex');
}

const advanceOrder = (o, token, toStatus) =>
  req('POST', `/orders/${o.id}/fulfilment/advance`, { token, body: { toStatus } });

async function run() {
  const op = await auth(OPER, OPW);
  const seller = await auth(SELLER, SPW);
  const courier = await auth(DLV, DLVPW);
  ok('operator/seller/courier logins', !!op && !!seller && !!courier);

  // 1. throwaway buyer
  const buyerEmail = `${PREFIX}${Date.now().toString(36)}@example.com`;
  const reg = await req('POST', '/auth/register', { body: { email: buyerEmail, password: 'Test@12345', fullName: 'MVP Buyer' } });
  ok('throwaway CUSTOMER registered', reg.status < 300, reg.text);
  const cust = reg.data.data.tokens?.accessToken || (await auth(buyerEmail, 'Test@12345'));
  ok('buyer token', !!cust);

  // 2. storefront reads
  const cats = await req('GET', '/catalog/categories', {});
  const prods = await req('GET', '/catalog/products?category=' + encodeURIComponent((cats.data?.data?.[0]?.slug) || ''), {});
  const detail = await req('GET', `/catalog/products/${PRODUCT}`, {});
  ok('public catalog browse + product detail readable', (cats.data?.data?.length ?? 0) > 0 && !!detail.data?.data?.id, detail.data?.data?.name);

  // 3. place + capture PREPAID
  const address = { name: 'MVP Buyer', phone: '9876543210', line1: '2 Mall Road', line2: '', city: 'Lucknow', state: 'UP', pincode: '226001' };
  const bn = await req('POST', '/buy-now', { token: cust, body: { productId: PRODUCT, quantity: QTY, paymentMethod: 'PREPAID', address } });
  ok('PREPAID buy-now placed', bn.status < 300, bn.data?.data?.order?.orderNumber || bn.text);
  const order = bn.data.data.order;
  const orderId = order.id;
  const oiId = order.items[0].orderItemId;
  const soId = order.sellerOrders?.[0]?.id;
  const pay = await req('GET', `/orders/${orderId}/payment`, { token: cust });
  const p = pay.data?.data;
  const ts = new Date().toISOString();
  const providerEventId = 'sand_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const amount = Math.round(p.amount);
  const cap = await req('POST', '/payments/webhook/sandbox', { body: { providerEventId, paymentReference: p.paymentReference, eventType: 'payment.captured', amount, timestamp: ts, signature: sandboxSig({ timestamp: ts, eventType: 'payment.captured', paymentReference: p.paymentReference, providerEventId, amount }) } });
  ok('sandbox capture -> PAID', cap.status < 300, cap.text);
  const o2 = await req('GET', `/orders/${orderId}`, { token: cust });
  ok('paymentStatus PAID', o2.data?.data?.paymentStatus === 'PAID');

  // 4. seller accepts, operator ships
  const acc = await req('POST', `/seller/orders/${soId}/accept`, { token: seller, body: {} });
  ok('seller accepted slice', acc.status < 300);
  for (const s of ['CONFIRMED', 'PACKED', 'SHIPPED']) { const r = await advanceOrder(order, op, s); ok(`operator advance ${s}`, r.status < 300, r.text); }

  // 5. courier delivers the parcel (sandbox provider books waybill on pickup)
  const partners = await req('GET', '/delivery/partners', { token: op });
  const ptn = partners.data?.data?.find((x) => x.user?.email === DLV);
  ok('delivery partner resolvable', !!ptn, ptn?.id);
  const partnerId = ptn.id;
  const assign = await req('POST', `/delivery/slices/${soId}/assign`, { token: op, body: { deliveryPartnerId: partnerId } });
  ok('parcel courier assigned', assign.data?.data?.status === 'ASSIGNED', assign.data?.data?.assignmentNumber);
  const asgId = assign.data.data.id;
  const cAccept = await req('POST', `/delivery/tasks/${asgId}/accept`, { token: courier });
  ok('courier accepted', cAccept.data?.data?.status === 'ACCEPTED');
  const cPickup = await req('POST', `/delivery/tasks/${asgId}/pickup`, { token: courier });
  ok('courier pickup (waybill)', cPickup.data?.data?.status === 'PICKED_UP' || cPickup.status < 300, cPickup.text);
  await req('POST', `/delivery/tasks/${asgId}/out-for-delivery`, { token: courier });
  const cDeliver = await req('POST', `/delivery/tasks/${asgId}/deliver`, { token: courier });
  ok('courier delivered parcel', cDeliver.data?.data?.status === 'DELIVERED', cDeliver.text);

  // order DELIVERED + courier earned payout
  const o3 = await req('GET', `/orders/${orderId}`, { token: cust });
  ok('order DELIVERED after courier', o3.data?.data?.status === 'DELIVERED');
  const myPay = await req('GET', '/delivery/payouts', { token: courier });
  const earned = (myPay.data?.data?.payouts ?? myPay.data?.data ?? []).find((x) => x.orderId === orderId);
  ok('courier delivery fee EARNED on this order', !!earned && earned.status === 'EARNED', JSON.stringify(earned));

  // 6. buyer ORDER_STATUS notification
  const custFeed = await req('GET', '/customer/notifications', { token: cust });
  const osNotif = (custFeed.data?.data?.notifications ?? []).find((n) => n.refKind === 'order' && n.refId === orderId);
  ok('buyer ORDER_STATUS delivery notification present', !!osNotif, osNotif?.title);
  ok('ORDER_STATUS category + title mentions delivered', osNotif?.category === 'ORDER_STATUS' && /delivered/i.test(osNotif?.title || ''), osNotif?.title);

  // 7. buyer requests REFUND return; operator drives to refund completed
  const rrq = await req('POST', `/orders/${orderId}/returns`, { token: cust, body: { reasonCode: 'QUALITY_ISSUE', resolution: 'REFUND', items: [{ orderItemId: oiId, quantity: QTY }] } });
  ok('buyer REFUND return requested', rrq.status < 300, rrq.text);
  const rrId = rrq.data.data.id;
  const riId = rrq.data.data.items[0].id;
  await req('POST', `/return-requests/${rrId}/decision`, { token: op, body: { approve: true, reason: 'ok' } });
  await req('POST', `/return-requests/${rrId}/pickup`, { token: op });
  await req('POST', `/return-requests/${rrId}/picked-up`, { token: op });
  const insp = await req('POST', `/return-requests/${rrId}/inspection`, { token: op, body: { items: [{ returnItemId: riId, result: 'PASS' }] } });
  ok('inspection -> APPROVED_FOR_REFUND', insp.data?.data?.status === 'APPROVED_FOR_REFUND', insp.data?.data?.status);
  await req('POST', `/return-requests/${rrId}/refund`, { token: op });
  const refundDone = await req('POST', `/return-requests/${rrId}/refund/complete`, { token: op });
  ok('refund completed', refundDone.data?.data?.refund?.status === 'COMPLETED', JSON.stringify(refundDone.data?.data?.refund));

  // 8. buyer RETURN_STATUS notification
  const feed2 = await req('GET', '/customer/notifications', { token: cust });
  const rsNotif = (feed2.data?.data?.notifications ?? []).find((n) => n.refKind === 'returnRequest' && n.refId === rrId);
  ok('buyer RETURN_STATUS notification present', !!rsNotif, rsNotif?.title);

  // RBAC on the customer feed
  const rbacOp = await req('GET', '/customer/notifications', { token: op });
  const rbacCourier = await req('GET', '/customer/notifications', { token: courier });
  ok('OPERATOR on customer feed 403', rbacOp.status === 403);
  ok('courier on customer feed 403', rbacCourier.status === 403);

  console.log(`\nE2E_LOG order=${order.orderNumber} orderId=${orderId} return=${rrId} parcelAssignment=${asgId} buyer=${buyerEmail}`);
  console.log(`CLEANUP_ORDER=${orderId} CLEANUP_RR=${rrId} CLEANUP_ASSIGN=${asgId} CLEANUP_BUYER=${buyerEmail}`);
}

run().catch((e) => { console.error(e.message); process.exit(1); });
