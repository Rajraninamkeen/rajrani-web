// Session 29 throwaway seed — creates two courier-visible demo tasks for the
// DELIVERY courier console (slice parcel + replacement), leaving each ASSIGNED->ACCEPTED
// so they are actionable in the UI but NOT fully delivered. Prints ids for later cleanup.
//
// Run:  node scripts/seed-courier-demo.mjs   (API must be on :4600)
import { createHmac } from 'node:crypto';

const API = (process.env.API || 'http://localhost:4600/api/v1').replace(/\/+$/, '');
const CUST = process.env.CUST || 's12@example.com';
const CPW = process.env.CPW || 'Test@12345';
const OPER = process.env.OPER || 'pfop@example.com';
const OPW = process.env.OPW || 'Operator@123';
const SELLER = process.env.SELLER || 'seller1@example.com';
const SPW = process.env.SPW || 'Seller@123';
const DLV = process.env.DLV || 'delivery15@example.com';
const DLVPW = process.env.DLVPW || 'Delivery@123';
const PRODUCT = process.env.PRODUCT || 'ratlami-sev';
const SB_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || 'bilokat-sandbox-webhook-secret-do-not-use-in-prod';

async function req(method, path, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(API + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data = null; try { data = JSON.parse(text); } catch {}
  if (res.status >= 300) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 200)}`);
  return data;
}
const auth = (e, p) => req('POST', '/auth/login', { body: { email: e, password: p } })
  .then((r) => r.data.tokens.accessToken);
function sandboxSig({ timestamp, eventType, paymentReference, providerEventId, amount }) {
  const canonical = [timestamp, eventType, paymentReference, providerEventId, amount].join('.');
  return createHmac('sha256', SB_SECRET).update(canonical).digest('hex');
}

async function placePaidOrder(cust, qty) {
  const address = { name: 'Courier Demo Buyer', phone: '9876500111', line1: '12 Demo Avenue', line2: 'Sector 4', city: 'Kanpur', state: 'UP', pincode: '208001' };
  const bn = await req('POST', '/buy-now', { token: cust, body: { productId: PRODUCT, quantity: qty, paymentMethod: 'PREPAID', address } });
  const order = bn.data.order;
  const orderId = order.id;
  const soId = order.sellerOrders?.[0]?.id;
  const oiId = order.items[0].orderItemId;
  const pay = await req('GET', `/orders/${orderId}/payment`, { token: cust });
  const p = pay.data;
  const ts = new Date().toISOString();
  const providerEventId = 'sand_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const amount = Math.round(p.amount);
  const sig = sandboxSig({ timestamp: ts, eventType: 'payment.captured', paymentReference: p.paymentReference, providerEventId, amount });
  await req('POST', '/payments/webhook/sandbox', { body: { providerEventId, paymentReference: p.paymentReference, eventType: 'payment.captured', amount, timestamp: ts, signature: sig } });
  return { orderId, soId, oiId, orderNumber: order.orderNumber };
}

// Advance order through fulfilment then optionally stop at SHIPPED (for a slice parcel)
// or go to DELIVERED (needed before a return can be raised).
async function fulfil(opTok, sellerTok, orderId, soId, stopAtShipped) {
  for (const s of ['CONFIRMED', 'PACKED']) await req('POST', `/orders/${orderId}/fulfilment/advance`, { token: opTok, body: { toStatus: s } });
  await req('POST', `/seller/orders/${soId}/accept`, { token: sellerTok, body: {} });
  await req('POST', `/orders/${orderId}/fulfilment/advance`, { token: opTok, body: { toStatus: 'SHIPPED' } });
  if (!stopAtShipped) await req('POST', `/orders/${orderId}/fulfilment/advance`, { token: opTok, body: { toStatus: 'DELIVERED' } });
}

async function main() {
  const cust = await auth(CUST, CPW);
  const op = await auth(OPER, OPW);
  const seller = await auth(SELLER, SPW);
  const courier = await auth(DLV, DLVPW);
  const partners = await req('GET', '/delivery/partners', { token: op });
  const ptn = partners.data.find((x) => x.user?.email === DLV);
  if (!ptn) throw new Error('delivery partner DLV-DEMO15 not found');
  const partnerId = ptn.id;

  const created = { orders: [], sliceAssignments: [], replacementAssignments: [] };

  // ---- Demo 1: slice parcel task (order SHIPPED, slice ACCEPTED, assigned+accepted) ----
  const A = await placePaidOrder(cust, 1);
  await fulfil(op, seller, A.orderId, A.soId, true); // stop SHIPPED
  const sa = await req('POST', `/delivery/slices/${A.soId}/assign`, { token: op, body: { deliveryPartnerId: partnerId } });
  const sliceAssn = sa.data;
  const sac = await req('POST', `/delivery/tasks/${sliceAssn.id}/accept`, { token: courier });
  if (sac.data.status !== 'ACCEPTED') throw new Error('slice task not ACCEPTED ' + JSON.stringify(sac.data));
  created.orders.push(A.orderId); created.sliceAssignments.push(sliceAssn.id);
  console.log('SLICE parcel task visible:', sliceAssn.assignmentNumber, 'status', sac.data.status, 'order', A.orderNumber);

  // ---- Demo 2: replacement task (delivered order -> REPLACEMENT return -> dispatch -> assign -> accept) ----
  const B = await placePaidOrder(cust, 1);
  await fulfil(op, seller, B.orderId, B.soId, false); // DELIVERED
  const rrq = await req('POST', `/orders/${B.orderId}/returns`, {
    token: cust, body: { reasonCode: 'DEFECTIVE', resolution: 'REPLACEMENT', items: [{ orderItemId: B.oiId, quantity: 1 }] },
  });
  const rrId = rrq.data.id;
  const riId = rrq.data.items[0].id;
  await req('POST', `/return-requests/${rrId}/decision`, { token: op, body: { approve: true, reason: 'demo replacement' } });
  await req('POST', `/return-requests/${rrId}/pickup`, { token: op });
  await req('POST', `/return-requests/${rrId}/picked-up`, { token: op });
  await req('POST', `/return-requests/${rrId}/inspection`, { token: op, body: { items: [{ returnItemId: riId, result: 'PASS' }] } });
  await req('POST', `/return-requests/${rrId}/replacement/dispatch`, { token: op, body: { dispatchReference: 'DISP-COURIER-DEMO' } });
  const ra = await req('POST', `/return-requests/${rrId}/replacement/assign-courier`, { token: op, body: { deliveryPartnerId: partnerId } });
  const raId = ra.data.id;
  const rac = await req('POST', `/delivery/replacement-tasks/${raId}/accept`, { token: courier });
  if (rac.data.status !== 'ACCEPTED') throw new Error('replacement task not ACCEPTED ' + JSON.stringify(rac.data));
  created.orders.push(B.orderId); created.replacementAssignments.push(raId);
  console.log('REPLACEMENT task visible:', ra.data.assignmentNumber, 'status', rac.data.status, 'return', rrId);

  // ---- Final check: courier own-task list should show both ----
  const tasks = await req('GET', '/delivery/tasks', { token: courier });
  const rts = await req('GET', '/delivery/replacement-tasks', { token: courier });
  console.log('\nDELIVERY /delivery/tasks count =', (tasks.data || []).length,
    ' -> ', (tasks.data || []).map((t) => `${t.assignmentNumber}(${t.status})`).join(', '));
  console.log('DELIVERY /delivery/replacement-tasks count =', (rts.data || []).length,
    ' -> ', (rts.data || []).map((t) => `${t.assignmentNumber}(${t.status})`).join(', '));

  console.log('\nSEED_DEMO sliceAssignment=' + created.sliceAssignments.join(',') +
    ' replacementAssignment=' + created.replacementAssignments.join(',') +
    ' orders=' + created.orders.join(',') + ' partner=' + partnerId);
}

main().catch((e) => { console.error('\nSEED failed:', e.message); process.exit(1); });
