// Session 20 live E2E — product listing/publishing lifecycle.
// Seller authors a product draft -> submits for review -> OPERATOR approves ->
// the product is LIVE and visible on the public catalog. A second product goes
// through the reject path (reason surfaces to the seller). Runs against a
// running Bilokat API (default sandbox provider fine).
// Env: API, SELLER/SPW, OPER/OPW, CATEGORY (active category id).
const API = (process.env.API || 'http://localhost:4300/api/v1').replace(/\/+$/, '');
const SELLER = process.env.SELLER || 'seller1@example.com';
const SPW = process.env.SPW || 'Seller@123';
const OPER = process.env.OPER || 'pfop@example.com';
const OPW = process.env.OPW || 'Operator@123';
const CATEGORY = process.env.CATEGORY || 'cmtrvg2j90005usnz1jaaa7mx';

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
  let d = null; try { d = JSON.parse(text); } catch { d = text; }
  return { status: res.status, data: d, text };
}
const auth = (e, p) => req('POST', '/auth/login', { body: { email: e, password: p } })
  .then((r) => { if (r.status >= 300) throw new Error('login ' + e + ' ' + r.text); return r.data.data.tokens.accessToken; });
const body = (d) => d?.data ?? d;

const T = Date.now().toString(36);

async function run() {
  const sel = await auth(SELLER, SPW);
  const op = await auth(OPER, OPW);
  ok('logins (seller + operator)', !!sel && !!op);

  // --- APPROVE path ---
  const nameA = 'Publishing Sev ' + T;
  const slugA = `pub-${T}-a`;
  const created = await req('POST', '/seller/catalog', {
    token: sel,
    body: { name: nameA, slug: slugA, categoryId: CATEGORY, brand: 'Bilokat', tagline: 'session20 approve', basePrice: 89.5, weightLabel: '400g', stockOnHand: 50, stockStatus: 'IN_STOCK', isBestseller: false, media: [{ url: 'https://cdn.example/x.jpg', altText: 'sev', kind: 'IMAGE', sortOrder: 0 }] },
  });
  const pA = body(created.data);
  ok('seller created a DRAFT product', created.status < 300 && pA?.status === 'DRAFT', `${pA?.slug} status=${pA?.status}`);
  ok('draft is HIDDEN (not yet public)', pA?.visibility === 'HIDDEN');
  const pidA = pA.id;

  // draft shows in seller own list
  const list1 = body((await req('GET', '/seller/catalog', { token: sel })).data);
  ok('draft appears in seller catalog list', Array.isArray(list1) && list1.some((p) => p.id === pidA));

  // submit for review
  const sub = body((await req('POST', `/seller/catalog/${pidA}/submit`, { token: sel })).data);
  ok('seller submitted for review -> PENDING_REVIEW', sub?.status === 'PENDING_REVIEW', `status=${sub?.status}`);

  // staff pending list
  const pending = body((await req('GET', '/catalog-publishing/products?status=PENDING_REVIEW', { token: op })).data);
  ok('OPERATOR sees it as PENDING_REVIEW', Array.isArray(pending) && pending.some((p) => p.id === pidA && p.status === 'PENDING_REVIEW'));

  // approve
  const apr = body((await req('POST', `/catalog-publishing/products/${pidA}/approve`, { token: op, body: { note: 'approved by operator' } })).data);
  ok('approve -> APPROVED + LIVE + publishedAt', apr?.status === 'APPROVED' && apr?.visibility === 'LIVE' && !!apr?.publishedAt, `status=${apr?.status}`);

  // public catalog visibility: public GET by identifier must now resolve (no auth)
  const pub = await req('GET', '/catalog/products/' + slugA);
  ok('approved product is now LIVE on the public catalog (public read by slug)', pub.status < 300 && body(pub.data)?.slug === slugA, `http ${pub.status}`);

  // --- REJECT path ---
  const nameB = 'Rejected Sev ' + T;
  const slugB = `pub-${T}-b`;
  const createdB = body((await req('POST', '/seller/catalog', { token: sel, body: { name: nameB, slug: slugB, categoryId: CATEGORY, basePrice: 5 } })).data);
  const pidB = createdB.id;
  await req('POST', `/seller/catalog/${pidB}/submit`, { token: sel });
  const rej = body((await req('POST', `/catalog-publishing/products/${pidB}/reject`, { token: op, body: { reason: 'price below floor' } })).data);
  ok('reject -> REJECTED + HIDDEN with reason', rej?.status === 'REJECTED' && rej?.reviewNote === 'price below floor', `status=${rej?.status} note=${rej?.reviewNote}`);

  // seller sees the rejection reason + can resubmit after editing
  const detailB = body((await req('GET', `/seller/catalog/${pidB}`, { token: sel })).data);
  ok('seller sees rejection reason on own product', detailB?.reviewNote === 'price below floor' && detailB?.status === 'REJECTED');

  // rejected product must NOT be resolvable on the public catalog
  const pubB = await req('GET', '/catalog/products/' + slugB);
  ok('rejected/hidden product is NOT on the public catalog (404)', pubB.status === 404, `http ${pubB.status}`);

  // RBAC: customer cannot access publishing surfaces
  const cust = await auth('s12@example.com', 'Test@12345');
  const deny = await req('GET', '/catalog-publishing/products?status=PENDING_REVIEW', { token: cust });
  ok('CUSTOMER denied OPERATOR publishing surface (403)', deny.status === 403, `http ${deny.status}`);
  const deny2 = await req('POST', '/seller/catalog', { token: cust, body: { name: 'x', categoryId: CATEGORY, basePrice: 1 } });
  ok('CUSTOMER denied seller authoring (403)', deny2.status === 403, `http ${deny2.status}`);

  console.log('\nE2E_PUBLISH approve=' + pidA + ' slug=' + slugA + ' reject=' + pidB + ' slug=' + slugB);
}
run().catch((e) => { console.error('\nE2E failed:', e.message); process.exit(process.exitCode || 1); });
