import { useEffect, useState } from 'react';
import { wishlistApi, cartApi } from '../api.js';
import ProductImage from '../components/ProductImage.jsx';
import { Stars, money, stockLabel, categoryGlyph } from '../format.jsx';

// Signed-in customer wishlist (#/wishlist). Lists saved products with the live
// catalog projection; supports remove and add-to-cart straight from the row.
export default function WishlistView({ user, onOpen, notify, onCartChange }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    let alive = true;
    wishlistApi.list()
      .then((d) => { if (alive) setItems(Array.isArray(d) ? d : []); })
      .catch((e) => { if (alive) setErr(e.message || 'Could not load wishlist.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  async function remove(productId) {
    setBusy(productId);
    try { await wishlistApi.remove(productId); setItems((s) => s.filter((i) => i.productId !== productId)); }
    catch (e) { setErr(e.message || 'Could not remove.'); }
    finally { setBusy(''); }
  }

  async function addToCart(productId) {
    setBusy(productId);
    try {
      await cartApi.add(productId, 1);
      notify?.('Added to cart');
      if (onCartChange) { try { const c = await cartApi.get(); onCartChange(c.itemCount || 0); } catch {} }
    } catch (e) { setErr(e.message || 'Could not add to cart.'); }
    finally { setBusy(''); }
  }

  if (!user) {
    return <div className="empty"><h2>Wishlist</h2><p>Sign in to save snacks you love and find them here.</p>
      <button className="btn primary" onClick={() => { window.location.hash = '/account'; }}>Sign in / create account</button></div>;
  }

  return (
    <div className="page">
      <div className="page-head"><h1>❤️ Wishlist</h1>
        <p className="muted">{items.length} saved snack{items.length === 1 ? '' : 's'} · synced to your account</p></div>

      {err && <p className="alert err">{err}</p>}

      {loading ? <p className="muted">Loading your wishlist…</p>
        : items.length === 0 ? (
          <div className="empty">
            <p>Your wishlist is empty — tap the ♡ on any snack to save it for later.</p>
            <button className="btn primary" onClick={() => { window.location.hash = '/'; }}>Browse snacks</button>
          </div>
        ) : (
          <div className="wish-grid">
            {items.map((it) => {
              const p = it.product;
              if (!p) return null;
              return (
                <div className="pcard wish-card" key={it.productId}>
                  <div className="pcard-media" onClick={() => onOpen(p.slug)} role="button">
                    <ProductImage src={p.image} name={p.name} slug={p.slug} />
                    {(p.isBestseller || p.isNew) && (
                      <div className="pcard-badges">
                        {p.isBestseller && <span className="pill pill-best">★ Best</span>}
                        {p.isNew && <span className="pill pill-new">New</span>}
                      </div>
                    )}
                    <button className="wish-heart filled" title="Remove from wishlist"
                      onClick={(e) => { e.stopPropagation(); remove(it.productId); }}>♡</button>
                  </div>
                  <div className="pcard-body">
                    <div className="pcard-cat">{categoryGlyph(p.category)} {String(p.category || '').toUpperCase()}</div>
                    <h3 className="pcard-name" onClick={() => onOpen(p.slug)}>{p.name}</h3>
                    <div className="pcard-rating"><Stars value={p.rating} size={14} />
                      <span className="pcard-count">({p.reviewCount})</span></div>
                    <div className="pcard-price">
                      <span className="price">{money(p.price)}</span>
                      {p.originalPrice > p.price && <span className="price-orig">{money(p.originalPrice)}</span>}
                    </div>
                    <div className="pcard-bottom">
                      <div className={`pcard-stock ${p.inStock ? '' : 'oost'}`}>{stockLabel(p.inStock, p.stockLeft)}</div>
                    </div>
                    <div className="wish-actions">
                      <button className="btn primary small" disabled={!p.inStock || busy === it.productId}
                        onClick={() => addToCart(it.productId)}>+ Add to cart</button>
                      <button className="btn ghost small" onClick={() => remove(it.productId)}>Remove</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}
