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
