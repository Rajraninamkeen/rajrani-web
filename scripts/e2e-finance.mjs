// Session 34 live E2E — back-office Finance console surface (OPERATOR/ADMIN).
// Drives the exact routes the new FinanceOps view calls:
//   /finance/reconciliation/summary, /finance/report/totals,
//   /delivery/payouts/{all,summary,settle}, /finance/{payables,settlements} + create/advance
// against a fresh throwaway money scenario (courier-delivered parcel -> EARNED courier payout
// ₹35 + EARNED seller payable), then cleans every created row out of the DB.
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

async function cleanup(ids) {
  const { orderId, sliceId, payableId, settlementId, payoutId, buyerId, productId, qty } = ids;
  await db.query('BEGIN');
  try {
    // restore product stock (order not cancelled)
    if (productId) await db.query('UPDATE products SET "stockOnHand" = "stockOnHand" + $1 WHERE id = $2', [qty, productId]);
    // child tables keyed off the slice / order
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
    console.log('cleanup: rows removed for order/slice/payable/settlement/payout/buyer');
  } catch (e) { await db.query('ROLLBACK'); throw e; }
}

async function run() {
  const op = await auth(OPER, OPW);
  const seller = await auth(SELLER, SPW);
  const courier = await auth(DLV, DLVPW);
  // throwaway buyer
  const email = `s34_${Date.now().toString(36)}@example.com`;
  const reg = await req('POST', '/auth/register', { body: { email, password: 'Test@12345', fullName: 'S34 Buyer', phone: '9000000000' } });
  ok('throwaway buyer registered', reg.status < 300, reg.text);
  const buyer = reg.data.data.tokens.accessToken;
  const buyerId = reg.data.data.user.id;

  // ---- RBAC negatives on the Finance surface ----
  ok('CUSTOMER on /finance/reconciliation/summary -> 403', (await req('GET', '/finance/reconciliation/summary', { token: buyer })).status === 403);
  ok('SELLER on /finance/payables -> 403', (await req('GET', '/finance/payables', { token: seller })).status === 403);
  ok('DELIVERY on /finance/report/totals -> 403', (await req('GET', '/finance/report/totals', { token: courier })).status === 403);
  ok('CUSTOMER on /delivery/payouts/summary -> 403', (await req('GET', '/delivery/payouts/summary', { token: buyer })).status === 403);
  ok('DELIVERY on /delivery/payouts/all -> 403 (staff route)', (await req('GET', '/delivery/payouts/all', { token: courier })).status === 403);

  // ---- OPERATOR read shapes the FinanceOps view consumes ----
  const rec = await req('GET', '/finance/reconciliation/summary', { token: op });
  ok('reconciliation summary 200 + shape', rec.status === 200 && 'checked' in rec.data.data && 'discrepancyCount' in rec.data.data && 'ok' in rec.data.data, rec.text.slice(0, 80));
  const rep = await req('GET', '/finance/report/totals', { token: op });
  ok('report totals 200 + perSeller/totals', rep.status === 200 && Array.isArray(rep.data.data?.perSeller) && 'totals' in rep.data.data);
  const cs = await req('GET', '/delivery/payouts/summary', { token: op });
  ok('courier payout summary 200 + partners', cs.status === 200 && cs.data.data?.currency === 'INR' && Array.isArray(cs.data.data?.partners), cs.text.slice(0, 80));

  // ---- money scenario: courier-delivered parcel (order-level seller payable + courier payout) ----
  const address = { name: 'S34 Buyer', phone: '9876500000', line1: '1 MG Rd', line2: '', city: 'Kanpur', state: 'UP', pincode: '208001' };
  const bn = await req('POST', '/buy-now', { token: buyer, body: { productId: PRODUCT, quantity: QTY, paymentMethod: 'PREPAID', address } });
  ok('buy-now PREPAID order placed', bn.status < 300, bn.data?.data?.order?.orderNumber || bn.text);
  const order = bn.data.data.order;
  const orderId = order.id;
  const sliceId = order.sellerOrders?.[0]?.id;
  ok('single seller slice present', !!sliceId, sliceId);
  // capture
  const pay = await req('GET', `/orders/${orderId}/payment`, { token: buyer });
  const p = pay.data?.data;
  const ts = new Date().toISOString();
  const peid = 'sand_' + Date.now().toString(36);
  const amount = Math.round(p.amount);
  const cap = await req('POST', '/payments/webhook/sandbox', { body: { providerEventId: peid, paymentReference: p.paymentReference, eventType: 'payment.captured', amount, timestamp: ts, signature: sandboxSig({ timestamp: ts, eventType: 'payment.captured', paymentReference: p.paymentReference, providerEventId: peid, amount }) } });
  ok('sandbox capture -> PAID', cap.status < 300);
  // drive to SHIPPED then courier-deliver the slice
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
  // courier payout earned + seller payable earned
  const earned = await req('GET', '/delivery/payouts/all?status=EARNED', { token: op });
  const myPayout = earned.data?.data?.payouts?.find((x) => x.orderId === orderId);
  ok('courier payout EARNED ₹35 for the delivered parcel', !!myPayout && myPayout.feeAmount === 35 && myPayout.kind === 'parcel', JSON.stringify(myPayout));
  const payoutId = myPayout?.id;
  const pb = await req('GET', `/finance/payables?status=EARNED&limit=100`, { token: op });
  const payable = pb.data?.data?.payables?.find((x) => x.sellerOrderId === sliceId);
  ok('seller payable EARNED for the delivered slice', !!payable && payable.netPayable > 0, JSON.stringify(payable));
  const payableId = payable?.id;
  const sellerId = payable?.sellerId;
  // summary now lists the partner as pending
  const cs2 = await req('GET', '/delivery/payouts/summary', { token: op });
  const pendPartner = cs2.data?.data?.partners?.find((x) => x.deliveryPartnerId === partnerId);
  ok('payout summary shows partner pending ≥35', !!pendPartner && pendPartner.pendingAmount >= 35, JSON.stringify(pendPartner));

  // ---- Courier settle (FinanceOps "Courier Payouts" action) ----
  const settle = await req('POST', '/delivery/payouts/settle', { token: op, body: { deliveryPartnerId: partnerId } });
  ok('settle returns settled≥1 + totalAmount≥35', (settle.data?.data?.settled ?? 0) >= 1 && (settle.data?.data?.totalAmount ?? 0) >= 35, settle.text);
  const settled = await req('GET', '/delivery/payouts/all?status=SETTLED', { token: op });
  const settledRow = settled.data?.data?.payouts?.find((x) => x.orderId === orderId);
  ok('courier payout moved to SETTLED', !!settledRow && settledRow.status === 'SETTLED' && !!settledRow.settledAt, JSON.stringify(settledRow));

  // ---- Seller settlement create + advance (FinanceOps "Seller Settlements" actions) ----
  const create = await req('POST', '/finance/settlements', { token: op, body: { sellerId, payableIds: [payableId], reason: 'S34 console E2E' } });
  ok('settlement created PENDING', create.data?.data?.status === 'PENDING' && !!create.data?.data?.settlementReference, create.text.slice(0, 140));
  const settlementId = create.data.data.id;
  const advBad = await req('POST', `/finance/settlements/${settlementId}/advance`, { token: op, body: { toStatus: 'PAID' } });
  ok('illegal PENDING->PAID -> 409 (machine guard)', advBad.status === 409, `http ${advBad.status}`);
  const advApp = await req('POST', `/finance/settlements/${settlementId}/advance`, { token: op, body: { toStatus: 'APPROVED' } });
  ok('settlement advanced PENDING->APPROVED', advApp.data?.data?.status === 'APPROVED', advApp.text.slice(0, 120));
  const list = await req('GET', '/finance/settlements?limit=100', { token: op });
  const inList = list.data?.data?.settlements?.some((x) => x.id === settlementId);
  ok('settlement appears in the list read', !!inList);

  console.log('\nS34_LOG orderId=' + orderId + ' sliceId=' + sliceId + ' payableId=' + payableId + ' settlementId=' + settlementId +
    ' payoutId=' + payoutId + ' buyerId=' + buyerId + ' partnerId=' + partnerId + ' product=' + PRODUCT + ' qty=' + QTY);
  // find productId & real order qty for stock restore via order item
  const oi = await db.query('SELECT "productId", quantity FROM order_items WHERE "orderId" = $1', [orderId]);
  const productIdReal = oi.rows[0]?.productId;
  const realQty = oi.rows[0]?.quantity ?? QTY;
  await cleanup({ orderId, sliceId, payableId, settlementId, payoutId, buyerId, productId: productIdReal, qty: realQty });
  // assert DB clean of courier payouts / settlements for this run
  const still = await db.query('SELECT (SELECT count(*) FROM courier_payouts WHERE "orderId" = $1) AS cp, (SELECT count(*) FROM seller_payables WHERE "orderId" = $1) AS sp, (SELECT count(*) FROM settlements WHERE id = $2) AS st', [orderId, settlementId || '']);
  ok('DB clean: no courier_payouts / seller_payables / settlement left for the throwaway order', still.rows[0].cp === '0' && still.rows[0].sp === '0' && still.rows[0].st === '0', JSON.stringify(still.rows[0]));
  await db.end();
}

run().catch((e) => { console.error('\nE2E failed:', e.message); process.exit(process.exitCode || 1); });
