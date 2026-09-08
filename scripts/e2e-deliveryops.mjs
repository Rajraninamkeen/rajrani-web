// Session 35 live E2E — back-office DELIVERY-partner management console (OPERATOR/ADMIN).
// Drives the exact routes the new DeliveryOps view calls:
//   /delivery/partners (GET/POST), /delivery/partner-candidates,
//   /delivery/partners/:partnerId/status, /delivery/assignments(/:id),
//   /delivery/payouts/{summary,all}
// against a throwaway DELIVERY-role candidate that we onboard as a partner (ACTIVE ->
// SUSPENDED -> ACTIVE), assert the per-partner assignment/payout read surfaces, then
// remove every row we created (partner profile + user). RBAC: CUSTOMER/SELLER/DELIVERY
// must be blocked from the staff surface.
import { readFileSync } from 'node:fs';
import { Client } from 'pg';

const API = (process.env.API || 'http://localhost:4600/api/v1').replace(/\/+$/, '');
const OPER = process.env.OPER || 'pfop@example.com';
const OPW = process.env.OPW || 'Operator@123';
const SELLER = process.env.SELLER || 'seller1@example.com';
const SPW = process.env.SPW || 'Seller@123';
const DLV = process.env.DLV || 'delivery15@example.com';
const DLVPW = process.env.DLVPW || 'Delivery@123';
const SEED_PARTNER = process.env.SEED_PARTNER || 'cmts74ogt00036pnzo4270woa'; // Ravi Courier / DLV-DEMO15
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
  const seller = await auth(SELLER, SPW);
  const courier = await auth(DLV, DLVPW);

  // throwaway CUSTOMER (RBAC negative)
  const cEmail = `s35c_${Date.now().toString(36)}@example.com`;
  const cPhone = '9' + String(Math.floor(100000000 + Math.random() * 899999999)); // unique 10-digit
  const reg = await req('POST', '/auth/register', { body: { email: cEmail, password: 'Test@12345', fullName: 'S35 Buyer', phone: cPhone } });
  ok('throwaway customer registered', reg.status < 300, reg.text);
  const customer = reg.data.data.tokens.accessToken;
  const customerId = reg.data.data.user.id;

  // throwaway DELIVERY-role candidate (inserted directly so no partner profile exists yet)
  const dEmail = `d35_${Date.now().toString(36)}@example.com`;
  const dName = 'S35 Rider';
  const ins = await db.query(
    'INSERT INTO users (id, email, "passwordHash", "fullName", "phone", status, role, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7, now(), now()) RETURNING id',
    ['cm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12), dEmail, 'unused-nologin-hash', dName, null, 'ACTIVE', 'DELIVERY'],
  );
  const userId = ins.rows[0].id;

  // ---- RBAC negatives on the partner-management surface ----
  ok('CUSTOMER on /delivery/partners -> 403', (await req('GET', '/delivery/partners', { token: customer })).status === 403);
  ok('SELLER on /delivery/partners -> 403', (await req('GET', '/delivery/partners', { token: seller })).status === 403);
  ok('DELIVERY on /delivery/partners -> 403 (staff route)', (await req('GET', '/delivery/partners', { token: courier })).status === 403);
  ok('CUSTOMER on /delivery/partner-candidates -> 403', (await req('GET', '/delivery/partner-candidates', { token: customer })).status === 403);
  ok('CUSTOMER on /delivery/assignments -> 403', (await req('GET', '/delivery/assignments', { token: customer })).status === 403);

  // ---- candidate surface sees the fresh DELIVERY user ----
  const cands = await req('GET', '/delivery/partner-candidates', { token: op });
  const cand = cands.data?.data?.find((c) => c.userId === userId);
  ok('fresh DELIVERY user appears in partner-candidates', cands.status === 200 && !!cand && cand.email === dEmail && cand.fullName === dName, cands.text.slice(0, 160));

  // ---- register partner (ACTIVE, auto code) ----
  const regP = await req('POST', '/delivery/partners', { token: op, body: { userId, vehicleType: 'scooter' } });
  ok('registerPartner -> ACTIVE with generated code', regP.status < 300 && regP.data?.data?.status === 'ACTIVE' && /^DLV-/.test(regP.data?.data?.partnerCode || ''), regP.text.slice(0, 160));
  const partnerId = regP.data.data.id;
  const partnerCode = regP.data.data.partnerCode;
  ok('partner vehicleType recorded', regP.data.data.vehicleType === 'scooter');

  const dup = await req('POST', '/delivery/partners', { token: op, body: { userId } });
  ok('duplicate register -> 409', dup.status === 409, `http ${dup.status}`);

  // partner no longer a candidate
  const cands2 = await req('GET', '/delivery/partner-candidates', { token: op });
  ok('partnered user drops out of candidates', !(cands2.data?.data || []).some((c) => c.userId === userId));

  // ---- status toggling (console Activate/Suspend) ----
  const susp = await req('PATCH', `/delivery/partners/${partnerId}/status`, { token: op, body: { status: 'SUSPENDED' } });
  ok('suspend -> SUSPENDED', susp.data?.data?.status === 'SUSPENDED', susp.text.slice(0, 120));
  const act = await req('PATCH', `/delivery/partners/${partnerId}/status`, { token: op, body: { status: 'ACTIVE' } });
  ok('reactivate -> ACTIVE', act.data?.data?.status === 'ACTIVE', act.text.slice(0, 120));

  // ---- partners list reflects the new partner ----
  const listP = await req('GET', '/delivery/partners', { token: op });
  const inList = (listP.data?.data || []).some((p) => p.id === partnerId && p.user?.email === dEmail);
  ok('new partner appears in /delivery/partners list', inList, listP.text.slice(0, 200));

  // ---- assignments read surfaces (per-partner isolation) ----
  const asgAll = await req('GET', '/delivery/assignments', { token: op });
  ok('assignments list 200 + shape', asgAll.status === 200 && Array.isArray(asgAll.data?.data?.assignments) && 'total' in asgAll.data?.data, asgAll.text.slice(0, 120));
  const asgNew = await req('GET', `/delivery/assignments?deliveryPartnerId=${partnerId}`, { token: op });
  ok('fresh partner has no assignments (filter isolates)', asgNew.data?.data?.total === 0, asgNew.text.slice(0, 120));
  const asgSeed = await req('GET', `/delivery/assignments?deliveryPartnerId=${SEED_PARTNER}`, { token: op });
  ok('seeded partner assignments list resolves (shape)', asgSeed.status === 200 && Array.isArray(asgSeed.data?.data?.assignments), asgSeed.text.slice(0, 120));

  // a concrete assignment detail (from the whole list) has the console's expected keys
  const first = asgAll.data?.data?.assignments?.[0];
  if (first) {
    const det = await req('GET', `/delivery/assignments/${first.id}`, { token: op });
    const dd = det.data?.data || {};
    ok('assignment detail has assignmentNumber/status/sellerOrder + events', !!dd.assignmentNumber && !!dd.status && !!dd.sellerOrder && Array.isArray(dd.events), det.text.slice(0, 200));
  } else {
    console.log('info [skip] no assignments present to open a detail row');
  }

  // ---- payout summary + ledger readouts (read-only) ----
  const ps = await req('GET', '/delivery/payouts/summary', { token: op });
  ok('payout summary 200 + INR + partners', ps.status === 200 && ps.data?.data?.currency === 'INR' && Array.isArray(ps.data?.data?.partners), ps.text.slice(0, 120));
  const pl = await req('GET', '/delivery/payouts/all?limit=50', { token: op });
  ok('payout ledger 200 + payouts array', pl.status === 200 && Array.isArray(pl.data?.data?.payouts), pl.text.slice(0, 120));

  console.log(`\nS35_LOG userId=${userId} partnerId=${partnerId} partnerCode=${partnerCode} customerId=${customerId}`);

  // ---- self-clean: delete throwaway partner profile, then its user, then the customer ----
  await db.query('BEGIN');
  try {
    await db.query('DELETE FROM delivery_partners WHERE id = $1', [partnerId]);
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
    // throwaway customer
    await db.query('DELETE FROM cart_items WHERE "cartId" IN (SELECT id FROM carts WHERE "userId" = $1)', [customerId]);
    await db.query('DELETE FROM carts WHERE "userId" = $1', [customerId]);
    await db.query('DELETE FROM users WHERE id = $1', [customerId]);
    await db.query('COMMIT');
    console.log('cleanup: removed throwaway partner + DELIVERY user + customer');
  } catch (e) { await db.query('ROLLBACK'); throw e; }

  const still = await db.query(
    'SELECT (SELECT count(*) FROM users WHERE email=$1 OR id=$2) AS users, (SELECT count(*) FROM delivery_partners WHERE id=$3) AS partners',
    [dEmail, userId, partnerId],
  );
  ok('DB clean: no throwaway users or partner profile remain', still.rows[0].users === '0' && still.rows[0].partners === '0', JSON.stringify(still.rows[0]));
  const before = await db.query('SELECT count(*) AS n FROM delivery_partners');
  ok('partner roster returned to baseline (1 seeded)', before.rows[0].n === '1', JSON.stringify(before.rows[0]));
  await db.end();
}

run().catch((e) => { console.error('\nE2E failed:', e.message); process.exit(process.exitCode || 1); });
