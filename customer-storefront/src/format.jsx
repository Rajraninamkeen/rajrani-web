// Small display helpers for the storefront.

export const money = (n) =>
  (typeof n === 'number' ? n : Number(n || 0)).toLocaleString('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  });

export const money2 = (n) =>
  (typeof n === 'number' ? n : Number(n || 0)).toLocaleString('en-IN', {
    style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2,
  });

// Render a numeric rating as a row of stars (full/half/empty) using unicode glyphs.
export function Stars({ value, size = 16, showValue = true }) {
  const v = Number(value || 0);
  const full = Math.floor(v);
  const half = v - full >= 0.25 && v - full < 0.75 ? 1 : v - full >= 0.75 ? 0 : 0;
  const filled = v - full >= 0.5 ? full + 1 : full;
  const row = [];
  for (let i = 0; i < 5; i++) {
    row.push(
      <span key={i} style={{ color: i < filled ? '#e8a13a' : '#ddd', fontSize: size }}>
        ★
      </span>
    );
  }
  return (
    <span className="stars" title={`${v.toFixed(1)} out of 5`}>
      {row}
      {showValue && v > 0 && <span className="stars-val">{v.toFixed(1)}</span>}
    </span>
  );
}

// A safe inline-SVG data-URI "product tile" used as an image placeholder when the
// remote image cannot load (e.g. inside the sandboxed offline preview iframe).
export function fallbackImage(name = '', seed = '') {
  const glyph = categoryGlyph(seed) || (name ? name.trim().charAt(0).toUpperCase() : '🍘');
  const g = 'linear-gradient(135deg,#fff3e6,#ffd9a8)';
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
    `<stop offset='0' stop-color='#fff6ea'/><stop offset='1' stop-color='#f7c879'/></linearGradient></defs>` +
    `<rect width='600' height='600' fill='url(#g)'/>` +
    `<rect width='600' height='600' fill='#f3d19b' opacity='.25'/>` +
    `<text x='300' y='340' font-size='200' text-anchor='middle' dominant-baseline='middle'>${glyph}</text>` +
    `</svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

const CATEGORY_GLYPH = {
  bestseller: '🏆', spicy: '🌶️', mixtures: '🥣', healthy: '🥜', gifts: '🎁',
};

export function categoryGlyph(slug) {
  if (!slug) return '';
  const s = String(slug).toLowerCase();
  for (const [k, v] of Object.entries(CATEGORY_GLYPH)) if (s.includes(k)) return v;
  return '🍘';
}

export function stockLabel(inStock, stockLeft) {
  if (!inStock) return 'Out of stock';
  if (typeof stockLeft === 'number' && stockLeft > 0 && stockLeft <= 10) return 'Only ' + stockLeft + ' left';
  return 'In stock';
}

export function reviewStatusLabel(s) {
  return ({ PENDING: 'Pending moderation', PUBLISHED: 'Published', REJECTED: 'Rejected', HIDDEN: 'Hidden' })[s] || s;
}

export function dateStr(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

export const ORDER_STATUS_LABEL = {
  PLACED: 'Placed', CONFIRMED: 'Confirmed', PACKED: 'Packed', SHIPPED: 'Shipped',
  OUT_FOR_DELIVERY: 'Out for delivery', DELIVERED: 'Delivered', CANCELLED: 'Cancelled',
  RETURN_REQUESTED: 'Return requested', RETURNED: 'Returned', REFUNDED: 'Refunded',
};

export const PAYMENT_METHOD_LABEL = { COD: 'Cash on delivery', PREPAID: 'Prepaid online' };

export const PAYMENT_STATUS_LABEL = {
  PENDING: 'Pending', PAID: 'Paid', FAILED: 'Failed', COD_PENDING: 'Collect at delivery', REFUNDED: 'Refunded',
};

export const PAYMENT_STATE_LABEL = {
  INITIATED: 'Initiated', PENDING: 'Pending', AUTHORIZED: 'Authorized', CONFIRMED: 'Confirmed',
  FAILED: 'Failed', CANCELLED: 'Cancelled', EXPIRED: 'Expired',
};

export function orderStatusLabel(s) { return ORDER_STATUS_LABEL[s] || s; }

export const RETURN_REASON_LABEL = {
  DAMAGED: 'Damaged on arrival', DEFECTIVE: 'Defective / not working', WRONG_ITEM: 'Wrong item received',
  MISSING_ITEM: 'Missing item(s)', NOT_AS_DESCRIBED: 'Not as described', QUALITY_ISSUE: 'Quality not satisfactory',
  DELIVERY_LATE: 'Delivered too late', NO_LONGER_NEEDED: 'No longer needed', OTHER: 'Other reason',
};
export function returnReasonLabel(s) { return RETURN_REASON_LABEL[s] || s; }

export const RETURN_RESOLUTION_LABEL = { REFUND: 'Refund', REPLACEMENT: 'Replacement (exchange)' };
export function returnResolutionLabel(s) { return RETURN_RESOLUTION_LABEL[s] || s; }

export const RETURN_STATUS_LABEL = {
  REQUESTED: 'Return requested', APPROVED: 'Approved — pickup to be scheduled', REJECTED: 'Return rejected',
  PICKUP_SCHEDULED: 'Pickup scheduled', PICKED_UP: 'Item picked up', INSPECTION: 'Being inspected',
  APPROVED_FOR_REFUND: 'Refund approved', COMPLETED: 'Return completed',
  CANCELLED: 'Return cancelled', REPLACEMENT_ISSUED: 'Replacement issued',
};
export function returnStatusLabel(s) { return RETURN_STATUS_LABEL[s] || s; }
