// Session 22 live E2E — courier-deliver the DISPATCHED replacement (last mile).
//
// Full flow against a running Bilokat API (default sandbox gateway):
//   1. place a fresh PREPAID order (buy-now) and capture it via the sandbox webhook
//   2. deliver it (seller accepts slice, operator advances to DELIVERED)
//   3. customer requests a REPLACEMENT return -> operator approve/pickup/inspection
//      PASS -> REPLACEMENT_ISSUED + replacement PENDING_DISPATCH
//   4. operator dispatches it -> DISPATCHED
//   5. operator assigns a DELIVERY partner -> ReplacementAssignment ASSIGNED
//      (duplicate assign -> 409; OPERATOR manual /complete now blocked -> 409)
//   6. the courier drives accept/pickup/out-for-delivery/deliver; the final
//      deliver auto-completes the replacement (DISPATCHED -> COMPLETED)
//   7. assertions: replacement COMPLETED, assignment DELIVERED, NON-money (no Refund,
//      original order untouched & stays DELIVERED), RBAC negatives.
//
// Env: API, CUST/CPW, OPER/OPW, SELLER/SPW, DLV/DLVPW, PRODUCT, QTY.
import { createHmac } from 'node:crypto';

const API = (process.env.API || 'http://localhost:4500/api/v1').replace(/\/+$/, '');
const CUST = process.env.CUST || 's12@example.com';
const CPW = process.env.CPW || 'Test@12345';
const OPER = process.env.OPER || 'pfop@example.com';
const OPW = process.env.OPW || 'Operator@123';
const SELLER = process.env.SELLER || 'seller1@example.com';
const SPW = process.env.SPW || 'Seller@123';
const DLV = process.env.DLV || 'delivery15@example.com';
const DLVPW = process.env.DLVPW || 'Delivery@123';
const PRODUCT = process.env.PRODUCT || 'ratlami-sev';
const QTY = Number(process.env.QTY || 1);

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
function sandboxSig({ timestamp, eventType, paymentReference, providerEventId, amount }) {
  const canonical = [timestamp, eventType, paymentReference, providerEventId, amount].join('.');
  return createHmac('sha256', SB_SECRET).update(canonical).digest('hex');
}

async function deliver(orderId, soId, opTok, sellerTok) {
  const advance = (s) => req('POST', `/orders/${orderId}/fulfilment/advance`, { token: opTok, body: { toStatus: s } });
  for (const s of ['CONFIRMED', 'PACKED']) { const r = await advance(s); ok(`operator advance ${s}`, r.status < 300, r.text); }
  const acc = await req('POST', `/seller/orders/${soId}/accept`, { token: sellerTok, body: {} });
  ok('seller accepted slice', acc.status < 300, soId);
  for (const s of ['SHIPPED', 'DELIVERED']) { const r = await advance(s); ok(`operator advance ${s}`, r.status < 300, r.text); }
}

async function run() {
  const cust = await auth(CUST, CPW);
  const op = await auth(OPER, OPW);
  const seller = await auth(SELLER, SPW);
  const courier = await auth(DLV, DLVPW);
  ok('logins (customer/operator/seller/courier)', !!cust && !!op && !!seller && !!courier);

  // 1. Place a fresh PREPAID sandbox order.
  const address = { name: 'E2E Buyer', phone: '9876543210', line1: '1 MG Road', line2: '', city: 'Indore', state: 'MP', pincode: '452001' };
  const bn = await req('POST', '/buy-now', { token: cust, body: { productId: PRODUCT, quantity: QTY, paymentMethod: 'PREPAID', address } });
  ok('buy-now order placed', bn.status < 300, bn.data?.data?.order?.orderNumber || bn.text);
  const order = bn.data.data.order;
  const orderId = order.id;
  const oiId = order.items[0].orderItemId;
  const soId = order.sellerOrders?.[0]?.id;
  ok('order item + seller slice present', !!oiId && !!soId, `${oiId} / ${soId}`);

  // Sandbox capture webhook to mark PAID.
  const pay = await req('GET', `/orders/${orderId}/payment`, { token: cust });
  const p = pay.data?.data;
  ok('payment intent fetched', !!p?.paymentReference, p?.provider);
  const ts = new Date().toISOString();
  const providerEventId = 'sand_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const amount = Math.round(p.amount); // sandbox capture uses whole rupees (rounded)
  const sig = sandboxSig({ timestamp: ts, eventType: 'payment.captured', paymentReference: p.paymentReference, providerEventId, amount });
  const cap = await req('POST', '/payments/webhook/sandbox', { body: { providerEventId, paymentReference: p.paymentReference, eventType: 'payment.captured', amount, timestamp: ts, signature: sig } });
  ok('sandbox webhook captures (order PAID)', cap.status < 300, cap.text);
  const o2 = await req('GET', `/orders/${orderId}`, { token: cust });
  ok('order paymentStatus PAID', o2.data?.data?.paymentStatus === 'PAID', o2.data?.data?.paymentStatus);

  // 2. Deliver the order.
  await deliver(orderId, soId, op, seller);

  // 3. Customer requests a REPLACEMENT return; operator drives it to issued.
  const rrq = await req('POST', `/orders/${orderId}/returns`, {
    token: cust,
    body: { reasonCode: 'DEFECTIVE', resolution: 'REPLACEMENT', items: [{ orderItemId: oiId, quantity: QTY }] },
  });
  ok('customer REPLACEMENT return requested', rrq.status < 300, rrq.text);
  const rrId = rrq.data.data.id;
  const riId = rrq.data.data.items[0].id;
  const decision = await req('POST', `/return-requests/${rrId}/decision`, { token: op, body: { approve: true, reason: 'ok' } });
  ok('operator approved', decision.status < 300);
  await req('POST', `/return-requests/${rrId}/pickup`, { token: op });
  await req('POST', `/return-requests/${rrId}/picked-up`, { token: op });
  const insp = await req('POST', `/return-requests/${rrId}/inspection`, { token: op, body: { items: [{ returnItemId: riId, result: 'PASS' }] } });
  const inspData = insp.data?.data;
  ok('inspection PASS -> REPLACEMENT_ISSUED + replacement PENDING_DISPATCH',
    inspData?.status === 'REPLACEMENT_ISSUED' && inspData?.replacement?.status === 'PENDING_DISPATCH',
    JSON.stringify(inspData?.replacement));

  // 4. Operator dispatches the replacement.
  const disp = await req('POST', `/return-requests/${rrId}/replacement/dispatch`, { token: op, body: { dispatchReference: 'DISP-E2E' } });
  ok('replacement dispatched -> DISPATCHED', disp.data?.data?.replacement?.status === 'DISPATCHED');

  // 5. Operator assigns a courier (DELIVERY partner delivery15).
  const partners = await req('GET', '/delivery/partners', { token: op });
  const ptn = partners.data?.data?.find((x) => x.user?.email === DLV);
  ok('delivery partner delivery15 resolvable', !!ptn, ptn?.id);
  const partnerId = ptn.id;
  const assign = await req('POST', `/return-requests/${rrId}/replacement/assign-courier`, { token: op, body: { deliveryPartnerId: partnerId } });
  ok('courier assigned (ASSIGNED)', assign.data?.data?.status === 'ASSIGNED', assign.data?.data?.assignmentNumber);
  const raId = assign.data.data.id;

  // Negatives.
  const dup = await req('POST', `/return-requests/${rrId}/replacement/assign-courier`, { token: op, body: { deliveryPartnerId: partnerId } });
  ok('duplicate courier assignment -> 409', dup.status === 409, `http ${dup.status}`);
  const manual = await req('POST', `/return-requests/${rrId}/replacement/complete`, { token: op });
  ok('OPERATOR manual /complete blocked while a courier is assigned -> 409', manual.status === 409, `http ${manual.status}`);
  const rbac1 = await req('POST', `/return-requests/${rrId}/replacement/assign-courier`, { token: cust, body: { deliveryPartnerId: partnerId } });
  ok('CUSTOMER cannot assign a courier -> 403', rbac1.status === 403, `http ${rbac1.status}`);
  const rbac2 = await req('POST', `/return-requests/${rrId}/replacement/assign-courier`, { token: courier, body: { deliveryPartnerId: partnerId } });
  ok('courier (DELIVERY) cannot hit OPERATOR assign -> 403', rbac2.status === 403, `http ${rbac2.status}`);
  const rbac3 = await req('GET', '/delivery/replacement-tasks', { token: op });
  ok('OPERATOR cannot hit DELIVERY task surface -> 403', rbac3.status === 403, `http ${rbac3.status}`);

  // 6. Courier drives the replacement task to delivery.
  const list = await req('GET', '/delivery/replacement-tasks', { token: courier });
  const mine = list.data?.data?.find((a) => a.id === raId);
  ok('courier task not yet active before accept (ASSIGNED not listed)', !mine, 'no task');
  const acc = await req('POST', `/delivery/replacement-tasks/${raId}/accept`, { token: courier });
  ok('courier accepted (ACCEPTED)', acc.data?.data?.status === 'ACCEPTED');
  const pk = await req('POST', `/delivery/replacement-tasks/${raId}/pickup`, { token: courier });
  ok('courier picked up (PICKED_UP)', pk.data?.data?.status === 'PICKED_UP');
  const ofd = await req('POST', `/delivery/replacement-tasks/${raId}/out-for-delivery`, { token: courier });
  ok('courier out for delivery', ofd.data?.data?.status === 'OUT_FOR_DELIVERY');
  const dlv = await req('POST', `/delivery/replacement-tasks/${raId}/deliver`, { token: courier });
  ok('courier delivered -> assignment DELIVERED + replacement COMPLETED',
    dlv.data?.data?.status === 'DELIVERED', JSON.stringify({ status: dlv.data?.data?.status }));

  // 7. Verify final state (customer read of their returns on this order).
  const myRet = await req('GET', `/orders/${orderId}/returns`, { token: cust });
  const rr = myRet.data?.data?.find((x) => x.id === rrId);
  ok('return replacement is COMPLETED', rr?.replacement?.status === 'COMPLETED', rr?.replacement?.status);
  const ra = rr?.replacement?.assignments?.[0];
  ok('assignment DELIVERED recorded on the return', ra?.status === 'DELIVERED' && !!ra?.deliveredAt);
  ok('NON-money: replacement has no refund', rr?.refund == null);
  const o3 = await req('GET', `/orders/${orderId}`, { token: cust });
  ok('original order unchanged (still DELIVERED / PAID)', o3.data?.data?.status === 'DELIVERED' && o3.data?.data?.paymentStatus === 'PAID');

  console.log('\nE2E_LOG order=' + order.orderNumber + ' orderId=' + orderId + ' return=' + rrId +
    ' assignment=' + raId + ' replacement=' + rr?.replacement?.replacementReference);
}

run().catch((e) => { console.error('\nE2E failed:', e.message); process.exit(process.exitCode || 1); });
