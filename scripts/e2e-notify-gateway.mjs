// Session 39 live E2E — real outbound gateway behind the notification outbox.
// Confirms a PENDING outbox row is moved to SENT (not SKIPPED) by the dispatcher via the
// configured transport (console dev-sink here), that a second dispatch is a no-op, and that
// the pipeline is cleanly testable end-to-end. Self-cleans its rows.
import { readFileSync } from 'node:fs';
import { Client } from 'pg';

const API = (process.env.API || 'http://localhost:4600/api/v1').replace(/\/+$/, '');
const OPER = process.env.OPER || 'pfop@example.com';
const OPW = process.env.OPW || 'Operator@123';
const DLV = process.env.DLV || 'delivery15@example.com';
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

const db = new Client({ connectionString: DB_URL });
await db.connect();

const courier = (await db.query('SELECT id, email FROM users WHERE email = $1', [DLV])).rows[0];
ok('delivery user resolvable', !!courier, JSON.stringify(courier));

// Insert a notification + PENDING EMAIL outbox row directly (unit of the outbox pipeline).
const insNotif = await db.query(
  `INSERT INTO notifications (id, "recipientUserId", category, title, message, "refKind", "refId", "readAt", "createdAt", "updatedAt")
   VALUES (gen_random_uuid()::text, $1, 'COURIER_FEE_SETTLED', 'Payout received', 'Gateway E2E — payout sent.', 'deliveryPartner', 'e2e-gw', NULL, now(), now()) RETURNING id`,
  [courier.id],
);
const notifId = insNotif.rows[0].id;
await db.query(
  `INSERT INTO notification_outbox (id, "notificationId", channel, destination, status, attempt, "createdAt")
   VALUES (gen_random_uuid()::text, $1, 'EMAIL', $2, 'PENDING', 0, now())`,
  [notifId, courier.email],
);

try {
  const dlvToken = await auth(DLV, process.env.DLVPW || 'Delivery@123');
  ok('DELIVERY (non-OPERATOR) cannot dispatch', (await req('POST', '/finance/notifications/dispatch', { token: dlvToken })).status === 403);

  const op = await auth(OPER, OPW);
  const d1 = await req('POST', '/finance/notifications/dispatch', { token: op });
  ok('dispatch processed the row', (d1.data?.data?.processed ?? 0) >= 1 && d1.data?.data?.sent >= 1, d1.text);
  const after = await db.query('SELECT status, attempt, "sentAt", "lastError" FROM notification_outbox WHERE "notificationId" = $1', [notifId]);
  const row = after.rows[0];
  ok('outbox row is now SENT (not SKIPPED) with sentAt', row.status === 'SENT' && !!row.sentAt, JSON.stringify(row));
  ok('attempt recorded as 1', row.attempt === 1, JSON.stringify(row));

  const d2 = await req('POST', '/finance/notifications/dispatch', { token: op });
  ok('second dispatch is a no-op (nothing PENDING/FAILED)', d2.data?.data?.processed === 0, d2.text);
} finally {
  await db.query('DELETE FROM notification_outbox WHERE "notificationId" = $1', [notifId]);
  await db.query('DELETE FROM notifications WHERE id = $1', [notifId]);
}
const gone = await db.query('SELECT count(*)::int AS c FROM notifications WHERE id = $1', [notifId]);
ok('self-clean: notification row removed', gone.rows[0].c === 0, JSON.stringify(gone.rows[0]));
await db.end();
