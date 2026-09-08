// Minimal fetch wrapper against the Bilokat backend (proxied at /api).
// Backend envelope: { success, data, error:{code,message}, meta }.
const BASE = '/api/v1';

let token = typeof localStorage !== 'undefined' ? localStorage.getItem('bilokat_customer_token') : null;
export const getToken = () => token;
export function setToken(t) {
  token = t;
  if (t) localStorage.setItem('bilokat_customer_token', t);
  else localStorage.removeItem('bilokat_customer_token');
}
export function clearToken() { setToken(null); }

// Guest cart identity. A persistent opaque id lets a signed-out shopper build a
// cart; when they later sign in the backend merges that guest cart into their
// user cart on the next authenticated cart call (see CartService.resolveCart).
let guestSessionId = (typeof localStorage !== 'undefined' && localStorage.getItem('bilokat_guest_id')) || null;
export function getGuestId() { return guestSessionId; }
export function ensureGuestId() {
  if (!guestSessionId) {
    try { guestSessionId = crypto.randomUUID(); } catch {
      guestSessionId = 'g-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
    localStorage.setItem('bilokat_guest_id', guestSessionId);
  }
  return guestSessionId;
}
export function clearGuestId() {
  guestSessionId = null;
  localStorage.removeItem('bilokat_guest_id');
}

export async function api(method, path, { body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (guestSessionId) headers['X-Guest-Session-Id'] = guestSessionId;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch (e) {
    throw new Error('Network error — is the backend running? ' + e.message);
  }
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (res.status === 401) {
    const err = Object.assign(new Error('Session expired — please sign in'), { code: 401 });
    err.status = 401;
    throw err;
  }
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

function qs(params) {
  const p = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  });
  const s = p.toString();
  return s ? '?' + s : '';
}

// Public (no auth) catalog + reviews reads.
export const publicApi = {
  categories: () => api('GET', '/catalog/categories'),
  products: (params) => api('GET', '/catalog/products' + qs(params)),
  product: (identifier) => api('GET', `/catalog/products/${encodeURIComponent(identifier)}`),
  reviews: (identifier, page = 1, limit = 10) =>
    api('GET', `/catalog/products/${encodeURIComponent(identifier)}/reviews` + qs({ page, limit })),
};

// Auth + CUSTOMER-only review authoring.
export const authApi = {
  login: (email, password) => api('POST', '/auth/login', { body: { email, password } }),
  me: () => api('GET', '/auth/me'),
};

export const customerApi = {
  createReview: (payload) => api('POST', '/reviews', { body: payload }),
  mine: (status) => api('GET', '/reviews/me' + qs({ status })),
  updateReview: (id, payload) => api('PATCH', `/reviews/${id}`, { body: payload }),
  removeReview: (id) => api('DELETE', `/reviews/${id}`),
};

// Cart — supports guest (x-guest-session-id header, appended automatically) and auth.
export const cartApi = {
  get: () => api('GET', '/cart'),
  add: (productId, quantity) => api('POST', '/cart/items', { body: { productId, quantity } }),
  update: (lineId, quantity) => api('PATCH', `/cart/items/${lineId}`, { body: { quantity } }),
  remove: (lineId) => api('DELETE', `/cart/items/${lineId}`),
  clear: () => api('DELETE', '/cart'),
};

export const checkoutApi = {
  preview: (cartId, couponCode) =>
    api('GET', '/checkout/preview' + qs({ cartId, couponCode })),
  place: (payload) => api('POST', '/checkout', { body: payload }),
};

export const orderApi = {
  list: (params) => api('GET', '/orders' + qs(params)),
  get: (id) => api('GET', `/orders/${id}`),
  history: (id) => api('GET', `/orders/${id}/history`),
  cancel: (id, reason) => api('POST', `/orders/${id}/cancel`, { body: reason ? { reason } : {} }),
  payment: (id) => api('GET', `/orders/${id}/payment`),
  codStatus: (id) => api('GET', `/orders/${id}/cod`),
  codSendOtp: (id, secondaryContact) => api('POST', `/orders/${id}/cod/otp`, { body: { secondaryContact } }),
  codVerify: (id, code) => api('POST', `/orders/${id}/cod/verify`, { body: { code } }),
  tracking: (id) => api('GET', `/orders/${id}/tracking`),
};

// Buyer returns/refunds — drives the existing item-level return lifecycle
// (ReturnsController/ReturnsService). GET lists the order's active/prior returns,
// request() opens a new item-level return (REFUND default | REPLACEMENT), and the
// customer may attach evidence to a request that requires it (Session 16).
export const returnApi = {
  listForOrder: (orderId) => api('GET', `/orders/${orderId}/returns`),
  request: (orderId, payload) => api('POST', `/orders/${orderId}/returns`, { body: payload }),
  uploadEvidence: (orderId, returnRequestId, payload) =>
    api('POST', `/orders/${orderId}/returns/${returnRequestId}/evidence`, { body: payload }),
};

// Customer notifications (Session 38/39 in-app ledger, CUSTOMER read surface).
export const notifyApi = {
  list: (params) => api('GET', '/customer/notifications' + qs(params)),
  unreadCount: () => api('GET', '/customer/notifications/unread-count'),
  markRead: (id) => api('POST', `/customer/notifications/${id}/read`, { body: {} }),
  markAllRead: () => api('POST', '/customer/notifications/read-all', { body: {} }),
};

// DEV-ONLY: simulate the sandbox gateway capture for a PREPAID order. Backend
// refuses this in production; here it is only surfaced in the preview.
export const devApi = {
  sandboxCapture: (orderId) => api('POST', `/dev/orders/${orderId}/sandbox-capture`, { body: {} }),
};
