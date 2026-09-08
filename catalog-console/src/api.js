// Minimal fetch wrapper against the Bilokat backend (proxied at /api).
// Backend envelope: { success, data, error:{code,message}, meta }.
const BASE = '/api/v1';

let token = null;
export const setToken = (t) => (token = t);
export const getToken = () => token;

export async function api(method, path, { body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch (e) {
    throw new Error('Network error — is the backend running? ' + e.message);
  }
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (res.status === 401) throw Object.assign(new Error('Unauthorized'), { code: 401 });
  if (!res.ok) {
    const msg = data?.error?.message || data?.error?.code || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.code = data?.error?.code;
    err.details = data?.error?.details;
    throw err;
  }
  return data?.data;
}

export const authApi = {
  login: (email, password) => api('POST', '/auth/login', { body: { email, password } }),
  me: () => api('GET', '/auth/me'),
};

export const catalogApi = {
  categories: () => api('GET', '/catalog/categories'),
  sellerList: (status) => api('GET', '/seller/catalog' + (status ? `?status=${status}` : '')),
  sellerGet: (id) => api('GET', `/seller/catalog/${id}`),
  sellerCreate: (payload) => api('POST', '/seller/catalog', { body: payload }),
  sellerUpdate: (id, payload) => api('PATCH', `/seller/catalog/${id}`, { body: payload }),
  sellerSubmit: (id) => api('POST', `/seller/catalog/${id}/submit`, { body: {} }),
  sellerArchive: (id) => api('POST', `/seller/catalog/${id}/archive`, { body: {} }),
  reviewQueue: (status) => api('GET', '/catalog-publishing/products' + (status ? `?status=${status}` : '')),
  reviewGet: (id) => api('GET', `/catalog-publishing/products/${id}`),
  reviewApprove: (id, note) => api('POST', `/catalog-publishing/products/${id}/approve`, { body: note ? { note } : {} }),
  reviewReject: (id, reason) => api('POST', `/catalog-publishing/products/${id}/reject`, { body: { reason } }),
};

// Session 21 product-review moderation (OPERATOR/ADMIN only). Same staff surface as
// the publishing queue above, but for customer-written reviews.
export const reviewModerationApi = {
  list: (status) => api('GET', '/product-reviews' + (status ? `?status=${status}` : '')),
  detail: (id) => api('GET', `/product-reviews/${id}`),
  approve: (id, note) => api('POST', `/product-reviews/${id}/approve`, { body: note ? { note } : {} }),
  reject: (id, reason) => api('POST', `/product-reviews/${id}/reject`, { body: { reason } }),
  hide: (id, note) => api('POST', `/product-reviews/${id}/hide`, { body: note ? { note } : {} }),
  unhide: (id, note) => api('POST', `/product-reviews/${id}/unhide`, { body: note ? { note } : {} }),
};

// Session 27 — seller operations/dashboard (SELLER role): own slices + money.
export const sellerOpsApi = {
  me: () => api('GET', '/seller/me'),
  orders: (status) => api('GET', '/seller/orders' + (status ? `?status=${status}` : '')),
  order: (id) => api('GET', `/seller/orders/${id}`),
  accept: (id) => api('POST', `/seller/orders/${id}/accept`, { body: {} }),
  reject: (id, reason) => api('POST', `/seller/orders/${id}/reject`, { body: { reason } }),
  payables: (status) => api('GET', '/seller/payables' + (status ? `?status=${status}` : '')),
  settlements: (status) => api('GET', '/seller/settlements' + (status ? `?status=${status}` : '')),
  settlement: (id) => api('GET', `/seller/settlements/${id}`),
};

// Session 28 — OPERATOR ops queues (/ops) + the per-id action routes they drive.
export const opsApi = {
  orders: (status) => api('GET', '/ops/orders' + (status ? `?status=${status}` : '')),
  order: (id) => api('GET', `/ops/orders/${id}`),
  // Session 36 — live courier tracking for an order (OPERATOR/ADMIN read).
  orderTracking: (id) => api('GET', `/orders/${id}/tracking`),
  returns: (status) => api('GET', '/ops/returns' + (status ? `?status=${status}` : '')),
  returnDetail: (id) => api('GET', `/ops/returns/${id}`),
  // fulfilment
  advance: (orderId, toStatus, reason) => api('POST', `/orders/${orderId}/fulfilment/advance`, { body: reason ? { toStatus, reason } : { toStatus } }),
  // return lifecycle (decision / pickup / inspection)
  returnDecision: (id, approve, reason) => api('POST', `/return-requests/${id}/decision`, { body: { approve, reason } }),
  returnPickup: (id) => api('POST', `/return-requests/${id}/pickup`, { body: {} }),
  returnPickedUp: (id) => api('POST', `/return-requests/${id}/picked-up`, { body: {} }),
  returnInspect: (id, items) => api('POST', `/return-requests/${id}/inspection`, { body: { items } }),
  // refund
  refundInitiate: (id) => api('POST', `/return-requests/${id}/refund`, { body: {} }),
  refundComplete: (id) => api('POST', `/return-requests/${id}/refund/complete`, { body: {} }),
  // replacement
  replacementDispatch: (id, dispatchReference, dispatchNote) => api('POST', `/return-requests/${id}/replacement/dispatch`, { body: { dispatchReference, dispatchNote } }),
  replacementComplete: (id) => api('POST', `/return-requests/${id}/replacement/complete`, { body: {} }),
  replacementCancel: (id, reason) => api('POST', `/return-requests/${id}/replacement/cancel`, { body: { reason } }),
};

// Session 34 — back-office Finance (OPERATOR/ADMIN): courier payouts + seller ledger
// over the existing /delivery/payouts and /finance routes (Sessions 12/13/32).
export const payoutApi = {
  all: (params) => api('GET', '/delivery/payouts/all' + qs(params)),
  summary: (params) => api('GET', '/delivery/payouts/summary' + qs(params || {})),
  settle: (deliveryPartnerId) => api('POST', '/delivery/payouts/settle', { body: { deliveryPartnerId } }),
};
export const financeApi = {
  payables: (params) => api('GET', '/finance/payables' + qs(params)),
  payable: (id) => api('GET', `/finance/payables/${id}`),
  adjust: (id, amount, reason) => api('POST', `/finance/payables/${id}/adjustments`, { body: { amount, reason } }),
  settlements: (params) => api('GET', '/finance/settlements' + qs(params)),
  settlement: (id) => api('GET', `/finance/settlements/${id}`),
  createSettlement: (sellerId, payableIds, reason) => api('POST', '/finance/settlements', { body: { sellerId, payableIds, reason } }),
  advance: (id, toStatus, reason) => api('POST', `/finance/settlements/${id}/advance`, { body: { toStatus, reason } }),
  reconciliation: () => api('GET', '/finance/reconciliation/summary'),
  report: (params) => api('GET', '/finance/report/totals' + qs(params)),
};

function qs(params = {}) {
  const p = Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null);
  return p.length ? '?' + p.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&') : '';
}

// Session 29 — DELIVERY courier task surface (DELIVERY role): slice parcels + replacements.
export const deliveryApi = {
  tasks: () => api('GET', '/delivery/tasks'),
  task: (id) => api('GET', `/delivery/tasks/${id}`),
  // Session 36 — live courier tracking for a parcel task assigned to this DELIVERY partner.
  taskTracking: (id) => api('GET', `/delivery/tasks/${id}/tracking`),
  // slice-task actions
  taskAccept: (id) => api('POST', `/delivery/tasks/${id}/accept`, { body: {} }),
  taskReject: (id, reason) => api('POST', `/delivery/tasks/${id}/reject`, { body: { reason } }),
  taskPickup: (id) => api('POST', `/delivery/tasks/${id}/pickup`, { body: {} }),
  taskOutForDelivery: (id) => api('POST', `/delivery/tasks/${id}/out-for-delivery`, { body: {} }),
  taskDeliver: (id) => api('POST', `/delivery/tasks/${id}/deliver`, { body: {} }),
  taskFail: (id, reason) => api('POST', `/delivery/tasks/${id}/fail`, { body: { reason } }),
  // replacement-task surface
  replacementTasks: () => api('GET', '/delivery/replacement-tasks'),
  replacementTask: (id) => api('GET', `/delivery/replacement-tasks/${id}`),
  // Session 36 — live courier tracking for a replacement task assigned to this DELIVERY partner.
  replacementTaskTracking: (id) => api('GET', `/delivery/replacement-tasks/${id}/tracking`),
  replacementAccept: (id) => api('POST', `/delivery/replacement-tasks/${id}/accept`, { body: {} }),
  replacementReject: (id, reason) => api('POST', `/delivery/replacement-tasks/${id}/reject`, { body: { reason } }),
  replacementPickup: (id) => api('POST', `/delivery/replacement-tasks/${id}/pickup`, { body: {} }),
  replacementOutForDelivery: (id) => api('POST', `/delivery/replacement-tasks/${id}/out-for-delivery`, { body: {} }),
  replacementDeliver: (id) => api('POST', `/delivery/replacement-tasks/${id}/deliver`, { body: {} }),
  replacementFail: (id, reason) => api('POST', `/delivery/replacement-tasks/${id}/fail`, { body: { reason } }),
};

// Session 35 — back-office DELIVERY-partner management (OPERATOR/ADMIN): register
// partners, toggle partner status, and inspect partner assignments over the existing
// /delivery partner/assignment routes (Sessions 15/30).
export const deliveryOpsApi = {
  partners: () => api('GET', '/delivery/partners'),
  partnerCandidates: () => api('GET', '/delivery/partner-candidates'),
  registerPartner: (userId, partnerCode, vehicleType) =>
    api('POST', '/delivery/partners', { body: { userId, partnerCode, vehicleType } }),
  partnerStatus: (partnerId, status) => api('PATCH', `/delivery/partners/${partnerId}/status`, { body: { status } }),
  assignments: (params) => api('GET', '/delivery/assignments' + qs(params)),
  assignment: (id) => api('GET', `/delivery/assignments/${id}`),
  assignmentCancel: (id) => api('POST', `/delivery/assignments/${id}/cancel`, { body: {} }),
  // payout ledger read (shared with the Session-34 Finance console).
  payoutsAll: (params) => api('GET', '/delivery/payouts/all' + qs(params)),
};
