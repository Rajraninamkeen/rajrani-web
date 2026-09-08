// Session 38 live E2E — finance/payout notifications (in-app ledger + outbox).
// Drives a fresh throwaway courier-delivered parcel (COURIER_FEE_EARNED + PAYABLE_EARNED),
// a courier settle (COURIER_FEE_SETTLED) and a seller settlement create+advance
// (SETTLEMENT_ADVANCED), then asserts those notices appear on the DELIVERY/SELLER self-service
// endpoints + OPERATOR oversight, and self-cleans every row including the new tables.
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { Client } from 'pg';

const API = (process.env.API || 'http://localhost:4600/api/v1').replace(/\/+$/, '');
const OPER = process.env.OPER || 'pfop@example.com';
const OPW = process.env.OPW || 'Operator@123';
const SELLER = process.env.SELLER || 'seller1@example.com';
const SPW = process.env.SPW || 'Seller@123';
const DLV = process.env.DLV || 'delivery15@example.com';
const DLVPW = process.env.DLVPW || 'Delivery@123';
const PRODUCT = process.env.PRODUCT || 'ratlami-sev';
const QTY = Number(process.env.QTY || 1);
const DB_URL = (readFileSync('/home/user/rajrani-web/.env', 'utf8').match(/^DATABASE_URL=(.*)$/m) || [])[1];

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
const SB_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || 'bilokat-sandbox-webhook-secret-do-not-use-in-prod';
const sandboxSig = ({ timestamp, eventType, paymentReference, providerEventId, amount }) =>
  createHmac('sha256', SB_SECRET).update([timestamp, eventType, paymentReference, providerEventId, amount].join('.')).digest('hex');

const db = new Client({ connectionString: DB_URL });
await db.connect();
const userByEmail = async (email) => (await db.query('SELECT id FROM users WHERE email = $1', [email])).rows[0]?.id;
const SELLER_UID = await userByEmail(SELLER);
const COURIER_UID = await userByEmail(DLV);
const runStart = new Date().toISOString();

async function cleanupMoney({ orderId, sliceId, payableId, settlementId, payoutId, buyerId, productId, qty }) {
  await db.query('BEGIN');
  try {
    if (productId) await db.query('UPDATE products SET "stockOnHand" = "stockOnHand" + $1 WHERE id = $2', [qty, productId]);
    if (settlementId) {
      await db.query('DELETE FROM settlement_events WHERE "settlementId" = $1', [settlementId]);
      await db.query('DELETE FROM settlement_items WHERE "settlementId" = $1', [settlementId]);
      await db.query('DELETE FROM settlements WHERE id = $1', [settlementId]);
    }
    if (sliceId) {
      await db.query('DELETE FROM courier_payouts WHERE "sellerOrderId" = $1 OR id = $2', [sliceId, payoutId || '']);
      await db.query('DELETE FROM seller_payable_adjustments WHERE "sellerPayableId" IN (SELECT id FROM seller_payables WHERE "sellerOrderId" = $1)', [sliceId]);
      await db.query('DELETE FROM seller_payables WHERE id = $1 OR "sellerOrderId" = $2', [payableId || '', sliceId]);
      await db.query('DELETE FROM refunds WHERE "sellerOrderId" = $1', [sliceId]);
      await db.query('DELETE FROM order_items WHERE "sellerOrderId" = $1', [sliceId]);
      await db.query('DELETE FROM delivery_events WHERE "deliveryAssignmentId" IN (SELECT id FROM delivery_assignments WHERE "sellerOrderId" = $1)', [sliceId]);
      await db.query('DELETE FROM delivery_assignments WHERE "sellerOrderId" = $1', [sliceId]);
      await db.query('DELETE FROM seller_orders WHERE id = $1', [sliceId]);
    }
    if (orderId) {
      await db.query('DELETE FROM order_status_history WHERE "orderId" = $1', [orderId]);
      await db.query('DELETE FROM cod_verifications WHERE "orderId" = $1', [orderId]);
      await db.query('DELETE FROM payment_webhooks WHERE "paymentId" IN (SELECT id FROM payments WHERE "orderId" = $1)', [orderId]);
      await db.query('DELETE FROM payment_transactions WHERE "paymentId" IN (SELECT id FROM payments WHERE "orderId" = $1)', [orderId]);
      await db.query('DELETE FROM payments WHERE "orderId" = $1', [orderId]);
      await db.query('DELETE FROM orders WHERE id = $1', [orderId]);
    }
    if (buyerId) {
      await db.query('DELETE FROM cart_items WHERE "cartId" IN (SELECT id FROM carts WHERE "userId" = $1)', [buyerId]);
      await db.query('DELETE FROM carts WHERE "userId" = $1', [buyerId]);
      await db.query('DELETE FROM users WHERE id = $1', [buyerId]);
    }
    await db.query('COMMIT');
  } catch (e) { await db.query('ROLLBACK'); throw e; }
}

async function run() {
  const op = await auth(OPER, OPW);
  const seller = await auth(SELLER, SPW);
  const courier = await auth(DLV, DLVPW);
  const email = `s38_${Date.now().toString(36)}@example.com`;
  const reg = await req('POST', '/auth/register', { body: { email, password: 'Test@12345', fullName: 'S38 Buyer', phone: '9000000000' } });
  ok('throwaway buyer registered', reg.status < 300, reg.text);
  const buyer = reg.data.data.tokens.accessToken;
  const buyerId = reg.data.data.user.id;

  // ---- RBAC negatives on the notification surface ----
  ok('CUSTOMER on /delivery/notifications -> 403', (await req('GET', '/delivery/notifications', { token: buyer })).status === 403);
  ok('OPERATOR on /delivery/notifications -> 403 (partner-only)', (await req('GET', '/delivery/notifications', { token: op })).status === 403);
  ok('DELIVERY on /seller/notifications -> 403', (await req('GET', '/seller/notifications', { token: courier })).status === 403);
  ok('CUSTOMER on /finance/notifications -> 403', (await req('GET', '/finance/notifications', { token: buyer })).status === 403);
  ok('SELLER on /finance/notifications/outbox -> 403', (await req('GET', '/finance/notifications/outbox', { token: seller })).status === 403);

  // ---- Read shapes (empty before the money scenario) ----
  const emptyDlv = await req('GET', '/delivery/notifications', { token: courier });
  ok('DELIVERY notifications 200 + shape', emptyDlv.status === 200 && Array.isArray(emptyDlv.data?.data?.notifications) && 'unreadCount' in emptyDlv.data?.data, emptyDlv.text.slice(0, 80));
  const emptySlr = await req('GET', '/seller/notifications/unread-count', { token: seller });
  ok('SELLER unread-count 200 + number', emptySlr.status === 200 && typeof emptySlr.data?.data?.unreadCount === 'number');

  // ---- Money scenario: courier-delivered parcel ----
  const address = { name: 'S38 Buyer', phone: '9876500000', line1: '1 MG Rd', line2: '', city: 'Kanpur', state: 'UP', pincode: '208001' };
  const bn = await req('POST', '/buy-now', { token: buyer, body: { productId: PRODUCT, quantity: QTY, paymentMethod: 'PREPAID', address } });
  ok('buy-now PREPAID order placed', bn.status < 300, bn.data?.data?.order?.orderNumber || bn.text);
  const order = bn.data.data.order;
  const orderId = order.id;
  const sliceId = order.sellerOrders?.[0]?.id;
  ok('single seller slice present', !!sliceId, sliceId);
  const pay = await req('GET', `/orders/${orderId}/payment`, { token: buyer });
  const p = pay.data?.data;
  const ts = new Date().toISOString();
  const peid = 'sand_' + Date.now().toString(36);
  const amount = Math.round(p.amount);
  const cap = await req('POST', '/payments/webhook/sandbox', { body: { providerEventId: peid, paymentReference: p.paymentReference, eventType: 'payment.captured', amount, timestamp: ts, signature: sandboxSig({ timestamp: ts, eventType: 'payment.captured', paymentReference: p.paymentReference, providerEventId: peid, amount }) } });
  ok('sandbox capture -> PAID', cap.status < 300);
  const advance = (s) => req('POST', `/orders/${orderId}/fulfilment/advance`, { token: op, body: { toStatus: s } });
  for (const s of ['CONFIRMED', 'PACKED']) { const r = await advance(s); ok(`operator advance ${s}`, r.status < 300, r.text); }
  const acc = await req('POST', `/seller/orders/${sliceId}/accept`, { token: seller, body: {} });
  ok('seller accepted slice', acc.status < 300, acc.text);
  for (const s of ['SHIPPED']) { const r = await advance(s); ok(`operator advance ${s}`, r.status < 300, r.text); }
  const partners = await req('GET', '/delivery/partners', { token: op });
  const ptn = partners.data?.data?.find((x) => x.user?.email === DLV);
  ok('delivery partner delivery15 resolvable', !!ptn);
  const partnerId = ptn.id;
  const assign = await req('POST', `/delivery/slices/${sliceId}/assign`, { token: op, body: { deliveryPartnerId: partnerId } });
  ok('slice courier assigned', assign.data?.data?.status === 'ASSIGNED', assign.text.slice(0, 120));
  const assnId = assign.data.data.id;
  for (const act of ['accept', 'pickup', 'out-for-delivery', 'deliver']) {
    const r = await req('POST', `/delivery/tasks/${assnId}/${act}`, { token: courier, body: {} });
    ok(`courier ${act}`, r.status < 300, r.text.slice(0, 100));
  }
  const earned = await req('GET', '/delivery/payouts/all?status=EARNED', { token: op });
  const myPayout = earned.data?.data?.payouts?.find((x) => x.orderId === orderId);
  ok('courier payout EARNED ₹35 for the delivered parcel', !!myPayout && myPayout.feeAmount === 35 && myPayout.kind === 'parcel', JSON.stringify(myPayout));
  const payoutId = myPayout?.id;
  const pb = await req('GET', `/finance/payables?status=EARNED&limit=100`, { token: op });
  const payable = pb.data?.data?.payables?.find((x) => x.sellerOrderId === sliceId);
  ok('seller payable EARNED for the delivered slice', !!payable && payable.netPayable > 0, JSON.stringify(payable));
  const payableId = payable?.id;
  const sellerId = payable?.sellerId;

  // ---- Assert COURIER_FEE_EARNED + PAYABLE_EARNED notifications ----
  const dlvAfter = await req('GET', '/delivery/notifications', { token: courier });
  const earnedNotif = dlvAfter.data?.data?.notifications?.find((n) => n.category === 'COURIER_FEE_EARNED' && n.refId === payoutId);
  ok('DELIVERY sees COURIER_FEE_EARNED notice (ref payout)', !!earnedNotif, JSON.stringify(dlvAfter.data?.data?.notifications));
  ok('COURIER_FEE_EARNED message includes the fee', earnedNotif?.message?.includes('35'), earnedNotif?.message);
  const slrAfter = await req('GET', '/seller/notifications', { token: seller });
  const payableNotif = slrAfter.data?.data?.notifications?.find((n) => n.category === 'PAYABLE_EARNED' && n.refId === payableId);
  ok('SELLER sees PAYABLE_EARNED notice (ref payable)', !!payableNotif, JSON.stringify(slrAfter.data?.data?.notifications));

  // ---- Courier settle -> COURIER_FEE_SETTLED ----
  const settle = await req('POST', '/delivery/payouts/settle', { token: op, body: { deliveryPartnerId: partnerId } });
  ok('settle returns settled≥1', (settle.data?.data?.settled ?? 0) >= 1, settle.text);
  const dlv2 = await req('GET', '/delivery/notifications?limit=50', { token: courier });
  const settledNotif = dlv2.data?.data?.notifications?.find((n) => n.category === 'COURIER_FEE_SETTLED');
  ok('DELIVERY sees COURIER_FEE_SETTLED notice', !!settledNotif, JSON.stringify(dlv2.data?.data?.notifications));

  // ---- Seller settlement create + advance -> SETTLEMENT_ADVANCED ----
  const create = await req('POST', '/finance/settlements', { token: op, body: { sellerId, payableIds: [payableId], reason: 'S38 notifications E2E' } });
  ok('settlement created PENDING', create.data?.data?.status === 'PENDING' && !!create.data?.data?.settlementReference, create.text.slice(0, 140));
  const settlementId = create.data.data.id;
  const advApp = await req('POST', `/finance/settlements/${settlementId}/advance`, { token: op, body: { toStatus: 'APPROVED' } });
  ok('settlement advanced PENDING->APPROVED', advApp.data?.data?.status === 'APPROVED', advApp.text.slice(0, 120));
  const slr2 = await req('GET', '/seller/notifications?limit=50', { token: seller });
  const advNotifs = slr2.data?.data?.notifications?.filter((n) => n.category === 'SETTLEMENT_ADVANCED' && n.refId === settlementId);
  ok('SELLER sees SETTLEMENT_ADVANCED notices for create + advance', advNotifs?.length >= 2, JSON.stringify(advNotifs));

  // ---- Mark-read flows ----
  const unread = await req('GET', '/delivery/notifications/unread-count', { token: courier });
  ok('DELIVERY unread-count reflects new notices', (unread.data?.data?.unreadCount ?? 0) >= 1, unread.text);
  const first = dlv2.data?.data?.notifications?.[0];
  const readOne = await req('POST', `/delivery/notifications/${first.id}/read`, { token: courier });
  ok('DELIVERY mark one read', readOne.data?.data?.ok === true, readOne.text);
  const readAll = await req('POST', '/delivery/notifications/read-all', { token: courier });
  ok('DELIVERY read-all returns updated count', (readAll.data?.data?.updated ?? 0) >= 1, readAll.text);
  const afterRead = await req('GET', '/delivery/notifications/unread-count', { token: courier });
  ok('DELIVERY unread-count back to 0 after read-all', (afterRead.data?.data?.unreadCount ?? 99) === 0, afterRead.text);
  const foreignRead = await req('POST', `/delivery/notifications/${first.id}/read`, { token: seller });
  ok('SELLER cannot read another user\'s DELIVERY notice', foreignRead.status === 403, `http ${foreignRead.status}`);

  // ---- Operator oversight ----
  const over = await req('GET', '/finance/notifications?limit=100', { token: op });
  ok('OPERATOR notification ledger 200 + rows', over.status === 200 && Array.isArray(over.data?.data?.notifications) && over.data?.data?.total >= 1, over.text.slice(0, 80));
  const ob = await req('GET', '/finance/notifications/outbox', { token: op });
  ok('OPERATOR outbox 200 + rows', ob.status === 200 && Array.isArray(ob.data?.data?.rows), ob.text.slice(0, 80));
  const disp = await req('POST', '/finance/notifications/dispatch', { token: op });
  ok('dispatch processes outbox (skipped when no gateway)', disp.data?.data?.processed >= 0 && typeof disp.data?.data?.skipped === 'number', disp.text);

  console.log('\nS38_LOG orderId=' + orderId + ' sliceId=' + sliceId + ' payableId=' + payableId + ' settlementId=' + settlementId +
    ' payoutId=' + payoutId + ' buyerId=' + buyerId + ' partnerId=' + partnerId + ' product=' + PRODUCT + ' qty=' + QTY);
  const oi = await db.query('SELECT "productId", quantity FROM order_items WHERE "orderId" = $1', [orderId]);
  const productIdReal = oi.rows[0]?.productId;
  const realQty = oi.rows[0]?.quantity ?? QTY;
  await cleanupMoney({ orderId, sliceId, payableId, settlementId, payoutId, buyerId, productId: productIdReal, qty: realQty });
  // clean the new notification tables for this run's two recipients (created >= runStart)
  await db.query('DELETE FROM notification_outbox WHERE "notificationId" IN (SELECT id FROM notifications WHERE "recipientUserId" IN ($1,$2) AND "createdAt" >= $3)', [SELLER_UID, COURIER_UID, runStart]);
  const cleanNotif = await db.query('DELETE FROM notifications WHERE "recipientUserId" IN ($1,$2) AND "createdAt" >= $3', [SELLER_UID, COURIER_UID, runStart]);
  const still = await db.query('SELECT (SELECT count(*) FROM courier_payouts WHERE "orderId" = $1) AS cp, (SELECT count(*) FROM seller_payables WHERE "orderId" = $1) AS sp, (SELECT count(*) FROM settlements WHERE id = $2) AS st, (SELECT count(*) FROM notifications WHERE "recipientUserId" IN ($3,$4) AND "createdAt" >= $5) AS nt', [orderId, settlementId || '', SELLER_UID, COURIER_UID, runStart]);
  ok('DB clean: no money rows + no notifications left for the throwaway run', still.rows[0].cp === '0' && still.rows[0].sp === '0' && still.rows[0].st === '0' && still.rows[0].nt === '0', JSON.stringify(still.rows[0]));
  console.log('cleanup: notification rows removed for run =', cleanNotif.rowCount);
  await db.end();
}

await run();
