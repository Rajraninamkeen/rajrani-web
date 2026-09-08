// Small display helpers shared across views.

export const SPICE = {
  MILD: 'Mild',
  MEDIUM: 'Medium',
  SPICY: 'Spicy',
  FIERY: 'Fiery',
};
export const STOCK_STATUS = {
  IN_STOCK: 'In stock',
  LOW_STOCK: 'Low stock',
  OUT_OF_STOCK: 'Out of stock',
};

export const STATUS_LABEL = {
  DRAFT: 'Draft',
  PENDING_REVIEW: 'Pending review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  ARCHIVED: 'Archived',
};
export const VISIBILITY_LABEL = {
  LIVE: 'Live',
  HIDDEN: 'Hidden',
  SCHEDULED: 'Scheduled',
  OUT_OF_STOCK: 'Out of stock',
};

export const money = (n) =>
  (typeof n === 'number' ? n : Number(n || 0)).toLocaleString('en-IN', {
    style: 'currency', currency: 'INR',
  });

export const badge = (text, tone) =>
  `<span class="badge ${tone || ''}">${escapeHtml(String(text ?? ''))}</span>`;

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
