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
