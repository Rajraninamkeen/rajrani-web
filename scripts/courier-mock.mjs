// Session 30 — local courier-protocol HTTP mock. Speaks the contract that
// HttpCourierProvider expects (see src/commerce/courier/http-courier.provider.ts):
//   POST {base}/v1/shipments                  -> 201 { carrier, trackingNumber, trackingUrl?, status }
//   GET  {base}/v1/shipments/:tn/track        -> 200 { trackingNumber, carrier, status, events[] }
//   POST {base}/v1/shipments/:tn/pod          -> 200 { podRef, signedBy, at }
// Plus a non-contract inspection endpoint for the E2E: GET {base}/_state.
// Optional bearer auth: if AUTH_TOKEN is set, require Authorization: Bearer <AUTH_TOKEN>.
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';

const PORT = Number(process.env.PORT || 9600);
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';
const store = new Map(); // tn -> { ref, kind, status, createdAt, pod }

function waybill(ref) {
  return 'MCK-' + createHash('sha1').update(String(ref)).digest('hex').slice(0, 8).toUpperCase();
}
function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}
function authed(req, res) {
  if (!AUTH_TOKEN) return true;
  return (req.headers.authorization || '') === `Bearer ${AUTH_TOKEN}`;
}

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const path = url.pathname;
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    if (!authed(req, res)) return json(res, 401, { error: 'unauthorized' });

    if (path === '/v1/shipments' && req.method === 'POST') {
      const p = JSON.parse(body || '{}');
      const tn = waybill(p.ref);
      store.set(tn, { ref: p.ref, kind: p.kind, status: 'CREATED', createdAt: new Date().toISOString(), pod: null });
      return json(res, 201, { carrier: 'Mock Courier', trackingNumber: tn, trackingUrl: null, status: 'CREATED' });
    }
    if (path === '/_state' && req.method === 'GET') {
      return json(res, 200, Array.from(store.values()).map((s) => ({
        trackingNumber: Array.from(store.keys()).find((k) => store.get(k) === s),
        ...s,
      })));
    }
    const tnMatch = /\/v1\/shipments\/([^/]+)\/track/.exec(path);
    if (tnMatch && req.method === 'GET') {
      const s = store.get(decodeURIComponent(tnMatch[1]));
      if (!s) return json(res, 404, { error: 'not found' });
      const statuses = ['CREATED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'];
      const now = Date.now();
      return json(res, 200, {
        trackingNumber: tnMatch[1],
        carrier: 'Mock Courier',
        status: s.pod ? 'DELIVERED' : 'OUT_FOR_DELIVERY',
        events: [...statuses, ...(s.pod ? ['DELIVERED'] : [])].map((st, i) => ({
          status: st, at: new Date(now + i * 1000).toISOString(), note: null,
        })),
      });
    }
    const podMatch = /\/v1\/shipments\/([^/]+)\/pod/.exec(path);
    if (podMatch && req.method === 'POST') {
      const tn = decodeURIComponent(podMatch[1]);
      const s = store.get(tn);
      if (!s) return json(res, 404, { error: 'not found' });
      s.status = 'DELIVERED';
      s.pod = { podRef: `POD-${tn}`, signedBy: 'Mock Courier', at: new Date().toISOString() };
      return json(res, 200, s.pod);
    }
    return json(res, 404, { error: `no route ${req.method} ${path}` });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`courier-mock listening on :${PORT}${AUTH_TOKEN ? ' (auth on)' : ''}`);
});
