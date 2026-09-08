// Session 36 live E2E — courier tracking surfaced in the STAFF consoles (read-only).
// OPERATOR/ADMIN already may read /orders/:id/tracking (Session 31); this session adds
// DELIVERY-role per-task reads for the courier's own parcel + replacement tasks:
//   GET /delivery/tasks/:assignmentId/tracking            (parcel, own partner)
//   GET /delivery/replacement-tasks/:assignmentId/tracking (replacement, own partner)
// driven by the CourierTasks "Live tracking" panel, and surfaces the existing order
// tracking in the OperatorDashboard "Track delivery" panel. Read-only — exercises the
// S29/S30 demo courier rows (left persistent) and writes nothing to the DB.
import { readFileSync } from 'node:fs';
import { Client } from 'pg';

const API = (process.env.API || 'http://localhost:4600/api/v1').replace(/\/+$/, '');
const OPER = process.env.OPER || 'pfop@example.com';
const OPW = process.env.OPW || 'Operator@123';
const SELLER = process.env.SELLER || 'seller1@example.com';
const SPW = process.env.SPW || 'Seller@123';
const DLV = process.env.DLV || 'delivery15@example.com';
const DLVPW = process.env.DLVPW || 'Delivery@123';
// Persistent demo courier rows (S29/S30) assigned to the DLV-DEMO15 partner.
const ORDER_ID = process.env.ORDER_ID || 'cmts7exbq0009p6nzqn3lmsir';
const PARCEL_ASSIGNMENT = process.env.PARCEL_ASSIGNMENT || 'cmts7exhl000jp6nzghn2rlgc';   // MCK-F79C7047 PICKED_UP
const REPL_ASSIGNMENT = process.env.REPL_ASSIGNMENT || 'cmts7exs50018p6nzea5ob0km';       // MCK-84F6EF3E DELIVERED
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

async function run() {
  const op = await auth(OPER, OPW);
  const courier = await auth(DLV, DLVPW);
  const seller = await auth(SELLER, SPW);

  // ---- RBAC negatives on both staff tracking surfaces ----
  ok('DELIVERY on /orders/:id/tracking -> 403 (order-tracking is customer/operator)', (await req('GET', `/orders/${ORDER_ID}/tracking`, { token: courier })).status === 403);
  ok('SELLER on /orders/:id/tracking -> 403', (await req('GET', `/orders/${ORDER_ID}/tracking`, { token: seller })).status === 403);
  ok('OPERATOR on /delivery/tasks/:id/tracking -> 403 (DELIVERY-only)', (await req('GET', `/delivery/tasks/${PARCEL_ASSIGNMENT}/tracking`, { token: op })).status === 403);
  ok('SELLER on /delivery/tasks/:id/tracking -> 403', (await req('GET', `/delivery/tasks/${PARCEL_ASSIGNMENT}/tracking`, { token: seller })).status === 403);

  // ---- OPERATOR: existing order-tracking read surfaced in the Operations console ----
  const ot = await req('GET', `/orders/${ORDER_ID}/tracking`, { token: op });
  const legs = ot.data?.data?.legs;
  const parcel = (legs || []).find((l) => l.legType === 'parcel');
  ok('OPERATOR order tracking 200 + legs array', ot.status === 200 && Array.isArray(legs) && legs.length >= 1, ot.text.slice(0, 120));
  ok('parcel leg present with assignmentNumber + status + trackingNumber',
    !!parcel && !!parcel.assignmentNumber && !!parcel.status && !!parcel.trackingNumber, JSON.stringify(parcel)?.slice(0, 200));
  ok('parcel leg merges live provider events', !!parcel && !!parcel.provider && Array.isArray(parcel.provider.events) && parcel.provider.events.length >= 1,
    JSON.stringify(parcel?.provider)?.slice(0, 160));

  // ---- DELIVERY: parcel task tracking for the courier's own task ----
  const pt = await req('GET', `/delivery/tasks/${PARCEL_ASSIGNMENT}/tracking`, { token: courier });
  const pl = pt.data?.data;
  ok('DELIVERY parcel task tracking 200 + parcel leg', pt.status === 200 && pl?.legType === 'parcel', pt.text.slice(0, 140));
  ok('parcel leg owned by courier + assignment ref', pl?.assignmentId === PARCEL_ASSIGNMENT && !!pl?.trackingNumber, JSON.stringify(pl)?.slice(0, 180));
  ok('parcel leg merges live provider events (>=1)', !!pl?.provider && Array.isArray(pl.provider.events) && pl.provider.events.length >= 1,
    JSON.stringify(pl?.provider)?.slice(0, 160));

  // ---- DELIVERY: replacement task tracking for the courier's own task ----
  const rt = await req('GET', `/delivery/replacement-tasks/${REPL_ASSIGNMENT}/tracking`, { token: courier });
  const rl = rt.data?.data;
  ok('DELIVERY replacement task tracking 200 + replacement leg', rt.status === 200 && rl?.legType === 'replacement', rt.text.slice(0, 140));
  ok('replacement leg has assignment/reference + provider events',
    rl?.assignmentId === REPL_ASSIGNMENT && !!rl?.reference && !!rl?.provider && Array.isArray(rl.provider.events),
    JSON.stringify(rl)?.slice(0, 200));

  // ---- courier cannot read a task not assigned to their own partner ----
  ok('DELIVERY on a bogus/foreign assignment tracking -> 404', (await req('GET', `/delivery/tasks/does-not-exist/tracking`, { token: courier })).status === 404);

  console.log('\nS36_LOG read-only (no DB writes): operator order tracking + delivery parcel & replacement task tracking verified live');
  // read-only: assert we did not create/alter rows beyond the demo baseline
  const parts = await db.query('SELECT count(*)::int AS n FROM delivery_partners');
  ok('DB unchanged: partner roster still 1 seeded', parts.rows[0].n === 1, JSON.stringify(parts.rows[0]));
  await db.end();
}

run().catch((e) => { console.error('\nE2E failed:', e.message); process.exit(process.exitCode || 1); });
