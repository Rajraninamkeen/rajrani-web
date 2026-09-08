// Session 21 live E2E — product reviews/ratings backend.
// A verified buyer (DELIVERED order containing the product) submits a review
// (PENDING, verifiedBuyer), which appears ONLY after an OPERATOR/ADMIN approves
// it; rejected/hidden reviews never surface publicly and the product rating
// aggregate is recomputed from PUBLISHED reviews. Runs against a Bilokat API.
// Env: API, BUYER/BW (delivered-purchase CUSTOMER), OP/OPW (OPERATOR),
// SELLER/SPW (SELLER for RBAC negative), PRODUCT (id, default ratlami-sev).
const API = (process.env.API || 'http://localhost:4400/api/v1').replace(/\/+$/, '');
const BUYER = process.env.BUYER || 's12@example.com';
const BW = process.env.BW || 'Test@12345';
const OP = process.env.OP || 'pfop@example.com';
const OPW = process.env.OPW || 'Operator@123';
const SELLER = process.env.SELLER || 'seller1@example.com';
const SPW = process.env.SPW || 'Seller@123';
const PRODUCT = process.env.PRODUCT || 'ratlami-sev';

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

async function run() {
  const buyer = await auth(BUYER, BW);
  const op = await auth(OP, OPW);
  const sellerTok = await auth(SELLER, SPW);

  // register a fresh CUSTOMER with no purchase (non-buyer negative)
  const nbEmail = 'nbrev' + Date.now().toString(36) + '@example.com';
  const nbReg = await req('POST', '/auth/register', { body: { email: nbEmail, password: 'Reviewer123', fullName: 'NoBuyer User' } });
  ok('register a fresh non-buyer CUSTOMER', nbReg.status < 300, `http ${nbReg.status}`);
  const nb = body(nbReg.data).tokens.accessToken;

  // 1) verified buyer creates a PENDING review on a product they received
  const created = body((await req('POST', '/reviews', { token: buyer, body: { productId: PRODUCT, rating: 5, title: 'So crunchy', comment: 'Really fresh and tasty sev.' } })).data);
  ok('verified buyer created a PENDING review', created?.status === 'PENDING' && created?.verifiedBuyer === true, `status=${created?.status}`);
  const rev1 = created.id;

  // appears in "my reviews"
  const mine = body((await req('GET', '/reviews/me', { token: buyer })).data);
  ok('review shows in customer my-reviews', Array.isArray(mine) && mine.some((r) => r.id === rev1 && r.status === 'PENDING'));

  // NOT public yet
  const pubBefore = body((await req('GET', `/catalog/products/${PRODUCT}/reviews`)).data);
  ok('PENDING review is NOT public (0 published)', Array.isArray(pubBefore?.reviews) && pubBefore.reviews.length === 0);

  // 2) duplicate rejected
  const dup = await req('POST', '/reviews', { token: buyer, body: { productId: PRODUCT, rating: 4 } });
  ok('duplicate review rejected (409)', dup.status === 409, `http ${dup.status}`);

  // 3) non-buyer / seller cannot review
  const nbTry = await req('POST', '/reviews', { token: nb, body: { productId: PRODUCT, rating: 5 } });
  ok('non-buyer CUSTOMER cannot review (403)', nbTry.status === 403, `http ${nbTry.status}`);
  const selTry = await req('POST', '/reviews', { token: sellerTok, body: { productId: PRODUCT, rating: 5 } });
  ok('SELLER (non-CUSTOMER role) blocked from authoring (403)', selTry.status === 403, `http ${selTry.status}`);

  // 4) moderation queue
  const queue = body((await req('GET', '/product-reviews?status=PENDING', { token: op })).data);
  ok('OPERATOR sees the PENDING review in moderation queue', Array.isArray(queue) && queue.some((r) => r.id === rev1));

  // buyer cannot hit the moderation surface
  const custMod = await req('GET', '/product-reviews?status=PENDING', { token: buyer });
  ok('CUSTOMER denied staff moderation surface (403)', custMod.status === 403, `http ${custMod.status}`);

  // 5) approve -> PUBLISHED
  const apr = body((await req('POST', `/product-reviews/${rev1}/approve`, { token: op, body: { note: 'looks genuine' } })).data);
  ok('approve -> PUBLISHED with moderation note', apr?.status === 'PUBLISHED' && apr?.moderationNote === 'looks genuine' && !!apr?.moderatedAt, `status=${apr?.status}`);

  // now public + aggregate recomputed from published reviews
  const pubAfter = body((await req('GET', `/catalog/products/${PRODUCT}/reviews`)).data);
  ok('approved review is public', Array.isArray(pubAfter?.reviews) && pubAfter.reviews.length === 1 && pubAfter.reviews[0].id === rev1);
  ok('product rating summary recomputed from published review', pubAfter?.product?.ratingAvg === 5 && pubAfter?.product?.reviewCount === 1, `avg=${pubAfter?.product?.ratingAvg} count=${pubAfter?.product?.reviewCount}`);

  // 6) hide -> drops aggregate; unhide -> restores
  const hid = body((await req('POST', `/product-reviews/${rev1}/hide`, { token: op, body: { note: 'flagged' } })).data);
  ok('hide PUBLISHED -> HIDDEN', hid?.status === 'HIDDEN');
  const pubHidden = body((await req('GET', `/catalog/products/${PRODUCT}/reviews`)).data);
  ok('hidden review not public + aggregate reset to 0', pubHidden.reviews.length === 0 && pubHidden.product.reviewCount === 0, `count=${pubHidden.product.reviewCount}`);
  const unhid = body((await req('POST', `/product-reviews/${rev1}/unhide`, { token: op })).data);
  ok('unhide -> PUBLISHED restored', unhid?.status === 'PUBLISHED');

  // 7) reject path (second product review)
  const rev2 = body((await req('POST', '/reviews', { token: buyer, body: { productId: 'shahi-kaju-mixture', rating: 4, comment: 'second' } })).data);
  const rej = body((await req('POST', `/product-reviews/${rev2.id}/reject`, { token: op, body: { reason: 'duplicate content' } })).data);
  ok('reject -> REJECTED with surfaced reason', rej?.status === 'REJECTED' && rej?.moderationNote === 'duplicate content');

  // editing a REJECTED review reopens to PENDING
  const reopen = body((await req('PATCH', `/reviews/${rev2.id}`, { token: buyer, body: { rating: 4, comment: 'cleaned up' } })).data);
  ok('editing REJECTED review reopens to PENDING', reopen?.status === 'PENDING');

  console.log('\nE2E_REVIEW approve=' + rev1 + ' product=' + PRODUCT + ' rejectProduct=shahi-kaju-mixture rejectReview=' + rev2.id);
}
run().catch((e) => { console.error('\nE2E failed:', e.message); process.exit(process.exitCode || 1); });
