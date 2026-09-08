// Session 40 live E2E — buyer-side returns UI + customer notification feed.
//
// Against a running Bilokat API (default sandbox gateway):
//   1. register a throwaway CUSTOMER, place a fresh PREPAID buy-now order, capture it
//      via the sandbox webhook, seller accepts the slice, operator delivers it
//   2. the customer requests a REFUND return (the shape the new ReturnsPanel drives)
//   3. assert a RETURN_STATUS notification was created for the customer and is readable
//      on GET /customer/notifications (unread) + the unread-count; mark read works
//   4. RBAC: a DELIVERY/OPERATOR token hitting /customer/notifications -> 403
//   5. clean up: delete the order/return/seller-payable/notification rows + the
//      throwaway customer so the DB stays tidy.
//
// Env: API, OPER/OPW, SELLER/SPW, PRODUCT, QTY. EMAIL prefix for the throwaway buyer.
import { createHmac } from 'node:crypto';

const API = (process.env.API || 'http://localhost:4900/api/v1').replace(/\/+$/, '');
const OPER = process.env.OPER || 'pfop@example.com';
const OPW = process.env.OPW || 'Operator@123';
const SELLER = process.env.SELLER || 'seller1@example.com';
const SPW = process.env.SPW || 'Seller@123';
const PRODUCT = process.env.PRODUCT || 'ratlami-sev';
const QTY = Number(process.env.QTY || 1);
const PREFIX = process.env.PREFIX || 'c40';

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
  const op = await auth(OPER, OPW);
  const seller = await auth(SELLER, SPW);
  ok('operator + seller logins', !!op && !!seller);

  // 1. Throwaway buyer.
  const buyerEmail = `${PREFIX}${Date.now().toString(36)}@example.com`;
  const buyerPw = 'Test@12345';
  const reg = await req('POST', '/auth/register', { body: { email: buyerEmail, password: buyerPw, fullName: 'S40 Buyer' } });
  ok('throwaway customer registered', reg.status < 300, reg.text);
  const cust = reg.data.data.tokens?.accessToken || (await auth(buyerEmail, buyerPw));
  ok('buyer token', !!cust);

  // 2. Place + capture + deliver a fresh PREPAID order.
  const address = { name: 'S40 Buyer', phone: '9876543210', line1: '1 MG Road', line2: '', city: 'Indore', state: 'MP', pincode: '452001' };
  const bn = await req('POST', '/buy-now', { token: cust, body: { productId: PRODUCT, quantity: QTY, paymentMethod: 'PREPAID', address } });
  ok('buy-now order placed', bn.status < 300, bn.data?.data?.order?.orderNumber || bn.text);
  const order = bn.data.data.order;
  const orderId = order.id;
  const oiId = order.items[0].orderItemId;
  const soId = order.sellerOrders?.[0]?.id;
  ok('order item + seller slice present', !!oiId && !!soId, `${oiId} / ${soId}`);

  const pay = await req('GET', `/orders/${orderId}/payment`, { token: cust });
  const p = pay.data?.data;
  ok('payment intent fetched', !!p?.paymentReference, p?.provider);
  const ts = new Date().toISOString();
  const providerEventId = 'sand_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const amount = Math.round(p.amount);
  const sig = sandboxSig({ timestamp: ts, eventType: 'payment.captured', paymentReference: p.paymentReference, providerEventId, amount });
  const cap = await req('POST', '/payments/webhook/sandbox', { body: { providerEventId, paymentReference: p.paymentReference, eventType: 'payment.captured', amount, timestamp: ts, signature: sig } });
  ok('sandbox capture (order PAID)', cap.status < 300, cap.text);
  const o2 = await req('GET', `/orders/${orderId}`, { token: cust });
  ok('paymentStatus PAID', o2.data?.data?.paymentStatus === 'PAID');

  await deliver(orderId, soId, op, seller);

  // 3. Customer requests a REFUND return (the ReturnsPanel REFUND path).
  const rrq = await req('POST', `/orders/${orderId}/returns`, {
    token: cust,
    body: { reasonCode: 'QUALITY_ISSUE', resolution: 'REFUND', items: [{ orderItemId: oiId, quantity: QTY }] },
  });
  ok('customer REFUND return requested', rrq.status < 300, rrq.text);
  const rrId = rrq.data.data.id;
  ok('return status REQUESTED + refund resolution', rrq.data.data.status === 'REQUESTED' && rrq.data.data.resolution === 'REFUND', rrq.data.data.status);

  // 4. RETURN_STATUS notification feed for the customer.
  const myFeed = await req('GET', '/customer/notifications', { token: cust });
  const feed = myFeed.data?.data;
  ok('GET /customer/notifications ok', myFeed.status < 300);
  const found = (feed?.notifications ?? []).find((n) => n.refKind === 'returnRequest' && n.refId === rrId);
  ok('RETURN_STATUS notification present for the return', !!found, JSON.stringify(found));
  ok('notification category RETURN_STATUS', found?.category === 'RETURN_STATUS', found?.category);
  ok('notification unread + title mentions return', found?.read === false && /return/i.test(found?.title || ''), found?.title);

  const unread = await req('GET', '/customer/notifications/unread-count', { token: cust });
  ok('unread-count >= 1', (unread.data?.data?.unreadCount ?? 0) >= 1, `unread=${unread.data?.data?.unreadCount}`);

  const mark = await req('POST', `/customer/notifications/${found.id}/read`, { token: cust, body: {} });
  ok('mark one read ok', mark.status < 300);
  const after = await req('GET', '/customer/notifications', { token: cust });
  const marked = (after.data?.data?.notifications ?? []).find((n) => n.id === found.id);
  ok('notification now read', marked?.read === true);

  // 5. RBAC: non-CUSTOMER cannot read the customer feed.
  const rbacOp = await req('GET', '/customer/notifications', { token: op });
  ok('OPERATOR on /customer/notifications -> 403', rbacOp.status === 403, `http ${rbacOp.status}`);
  const custReadOps = await req('GET', '/ops/returns', { token: cust });
  ok('CUSTOMER on /ops/returns -> 403 (unchanged)', custReadOps.status === 403);

  console.log(`\nE2E_LOG order=${order.orderNumber} orderId=${orderId} return=${rrId} notif=${found.id} buyer=${buyerEmail}`);
  console.log(`CLEANUP_ORDER=${orderId} CLEANUP_RR=${rrId} CLEANUP_BUYER=${buyerEmail}`);
}

run().catch((e) => { console.error(e.message); process.exit(1); });
