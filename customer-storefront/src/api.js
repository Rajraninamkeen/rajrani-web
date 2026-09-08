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
