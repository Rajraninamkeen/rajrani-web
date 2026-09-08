// Local Razorpay-protocol HTTP mock (Session 18). Speaks the REAL Razorpay wire
// protocol so the RazorpayGateway + live refund execution can be E2E-verified
// without external credentials:
//   POST /v1/orders                  -> { id: order_..., amount, currency, receipt, status }
//   POST /v1/payments/:id/refund     -> { id: rfnd_..., payment_id, amount, status:'processed' }
// It also exposes a helper to *produce a capture* so a test driver can fetch an
// order and issue the corresponding payment.captured webhook itself.
import http from 'node:http';

// REFUND_ASYNC=1 makes refunds return status 'pending' (in-flight) so the app
// leaves the Refund in PROCESSING; a test driver then sends a `refund.processed`
// webhook to exercise Session-19 async reconciliation. Default (unset) returns
// 'processed' synchronously (Session 18 behaviour).
const ASYNC = process.env.REFUND_ASYNC === '1' || process.env.REFUND_ASYNC === 'true';

const orderSeq = { n: 0 };
const orders = new Map();
const refunds = new Map();

const json = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

const server = http.createServer((req, res) => {
  const url = req.url || '/';
  const u = new URL(url, 'http://localhost');
  const method = req.method;

  if (method === 'POST' && u.pathname === '/v1/orders') {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      let b = {};
      try { b = JSON.parse(raw); } catch { /* ignore */ }
      const id = `order_${(++orderSeq.n).toString(36)}${Date.now().toString(36).slice(-4)}`;
      const o = {
        id, entity: 'order', amount: Number(b.amount) ?? 0, amount_paid: 0, amount_due: Number(b.amount) ?? 0,
        currency: b.currency || 'INR', receipt: b.receipt, status: 'created', attempts: 0,
        notes: b.notes || {}, created_at: Math.floor(Date.now() / 1000),
      };
      orders.set(id, o);
      json(res, 200, o);
    });
    return;
  }

  const refundMatch = u.pathname.match(/^\/v1\/payments\/([^/]+)\/refund$/);
  if (method === 'POST' && refundMatch) {
    const paymentId = refundMatch[1];
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      let b = {};
      try { b = JSON.parse(raw); } catch { /* ignore */ }
      const id = `rfnd_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const status = ASYNC ? 'pending' : 'processed';
      const refund = {
        id, entity: 'refund', amount: Number(b.amount) ?? 0, currency: b.currency || 'INR',
        payment_id: paymentId, notes: b.notes || {}, receipt: b.receipt || null,
        status, speed_processed: status === 'processed' ? (b.speed || 'normal') : null,
        speed_requested: b.speed || 'normal',
        created_at: Math.floor(Date.now() / 1000),
      };
      refunds.set(id, refund);
      json(res, 200, refund);
    });
    return;
  }

  if (method === 'GET' && u.pathname === '/__orders') {
    json(res, 200, { orders: [...orders.values()] });
    return;
  }

  if (method === 'GET' && u.pathname === '/__refunds') {
    json(res, 200, { refunds: [...refunds.values()] });
    return;
  }

  json(res, 404, { error: { code: 'NOT_FOUND', description: 'mock: unknown route ' + url } });
});

const port = Number(process.env.PORT || 3911);
server.listen(port, '0.0.0.0', () => console.log(`razorpay-mock listening :${port}`));
