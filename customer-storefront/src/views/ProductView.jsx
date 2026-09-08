import { useEffect, useState } from 'react';
import { publicApi, customerApi } from '../api.js';
import ProductImage from '../components/ProductImage.jsx';
import { Stars, money, stockLabel, categoryGlyph, dateStr } from '../format.jsx';

function SpiceLevel({ level }) {
  const labels = { 1: 'Mild', 2: 'Medium', 3: 'Spicy', 4: 'Fiery' };
  const label = labels[level] || '';
  return label ? (
    <div className="fact">{'🌶️'.repeat(Math.max(1, Math.min(4, Number(level) || 1)))} <b>{label}</b></div>
  ) : null;
}

export default function ProductView({ identifier, user, notify, goHome, addToCart, goCart, wishIds = [], onWish }) {
  const [product, setProduct] = useState(null);
  const [revs, setRevs] = useState([]);
  const [revMeta, setRevMeta] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);

  const loadReviews = (page = 1) =>
    publicApi.reviews(product ? product.slug : identifier, page)
      .then((d) => { setRevs(d.reviews); setRevMeta({ total: d.total, page: d.page, totalPages: d.totalPages }); })
      .catch(() => {});

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(''); setProduct(null);
    publicApi.product(identifier)
      .then((p) => { if (alive) { setProduct(p); loadReviews(); } })
      .catch((e) => { if (alive) { setError(e.status === 404 ? 'Product not found.' : e.message); } })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identifier]);

  if (loading) return <div className="detail-load">Loading product…</div>;
  if (error || !product) return <div className="empty"><button className="btn ghost" onClick={goHome}>← Back to shop</button><p style={{ marginTop: 12 }}>{error}</p></div>;

  return (
    <div className="detail">
      <button className="backlink" onClick={goHome}>← Back to shop</button>

      <section className="detail-main">
        <div className="detail-media">
          <ProductImage src={product.image} name={product.name} slug={product.slug} />
        </div>
        <div className="detail-info">
          <div className="detail-cat">{categoryGlyph(product.category)} {String(product.category || '').toUpperCase()}</div>
          <h1>{product.name}</h1>
          {product.tagline && <p className="tagline">{product.tagline}</p>}
          <div className="detail-rating">
            <Stars value={product.rating} size={20} />
            <span className="rcount">{product.reviewCount} ratings</span>
          </div>
          <div className="price-row">
            <span className="price big">{money(product.price)}</span>
            {product.originalPrice > product.price && <span className="price-orig big">{money(product.originalPrice)}</span>}
            {product.discountPercent > 0 && <span className="pill pill-off">{product.discountPercent}% off</span>}
          </div>
          <p className="desc">{product.description}</p>
          <div className="facts">
            <div className="fact"><b>{product.regionOrigin}</b> · origin</div>
            {product.weight && <div className="fact">⚖️ <b>{product.weight}</b></div>}
            <SpiceLevel level={product.spiceLevel} />
            <div className={`fact ${product.inStock ? '' : 'oost'}`}>📦 <b>{stockLabel(product.inStock, product.stockLeft)}</b></div>
            {product.customerFavTag && <div className="fact">💛 <b>{product.customerFavTag}</b></div>}
          </div>
          <div className="addrow">
            <div className="qty lg">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
              <span>{qty}</span>
              <button onClick={() => setQty((q) => q + 1)}>+</button>
            </div>
            <button className="btn primary" disabled={!product.inStock || adding}
              onClick={async () => {
                if (!addToCart) return;
                setAdding(true);
                try { await addToCart(product.id, qty); if (goCart) goCart(); }
                catch (e) { notify(e.message); }
                finally { setAdding(false); }
              }}>
              {product.inStock ? (adding ? 'Adding…' : 'Add to cart') : 'Out of stock'}
            </button>
            {onWish && (
              <button className={'btn wish-btn' + (wishIds.includes(product.id) ? ' primary' : ' ghost')}
                onClick={() => onWish(product.id)}>
                {wishIds.includes(product.id) ? '♥ Saved' : '♡ Wishlist'}
              </button>
            )}
          </div>
          <div className="ingredients">
            <h4>What's inside</h4>
            <div className="tags">
              {(product.ingredients || []).map((i) => <span className="tag" key={i}>{i}</span>)}
            </div>
            {product.nutritionalInfo && (
              <div className="nutrition">
                {Object.entries(product.nutritionalInfo).map(([k, v]) => <span key={k}><b>{k}:</b> {v}</span>)}
              </div>
            )}
            {product.pairingSuggestion && <p className="pair">🍽️ <b>Pair it with:</b> {product.pairingSuggestion}</p>}
          </div>
        </div>
      </section>

      <ReviewSection
        product={product}
        user={user}
        notify={notify}
        reviews={revs}
        meta={revMeta}
        reload={loadReviews}
      />
    </div>
  );
}

function ReviewSection({ product, user, reviews, meta, reload, notify }) {
  return (
    <section className="reviews">
      <h2>Customer reviews</h2>
      <div className="reviews-head">
        <div className="agg">
          <div className="agg-num">{Number(product.rating || 0).toFixed(1)}</div>
          <Stars value={product.rating} size={18} />
          <div className="agg-count">{product.reviewCount} ratings · {meta?.total ?? reviews.length} written review{(meta?.total ?? reviews.length) === 1 ? '' : 's'}</div>
        </div>
      </div>

      <WriteReview product={product} user={user} notify={notify} onDone={reload} />

      {reviews.length === 0 ? (
        <p className="no-reviews">No published reviews yet. A verified buyer's review appears here once a moderator approves it.</p>
      ) : (
        <ul className="rev-list">
          {reviews.map((r) => (
            <li key={r.id} className="rev">
              <div className="rev-top">
                <div className="avatar">{initials(r.author.name)}</div>
                <div>
                  <div className="rev-name">{r.author.name} {r.verifiedBuyer && <span className="pill pill-vb">✓ Verified purchase</span>}</div>
                  <Stars value={r.rating} size={13} />
                </div>
                <div className="rev-date">{dateStr(r.createdAt)}</div>
              </div>
              {r.title && <h4>{r.title}</h4>}
              {r.comment && <p>{r.comment}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((s) => s.charAt(0).toUpperCase()).join('') || 'U';
}

function WriteReview({ product, user, notify, onDone }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const isCustomer = user && user.role === 'CUSTOMER';

  if (!isCustomer) {
    return (
      <div className="write-hint">
        Have you tried {product.name}? <a href="#/account">Sign in as a customer</a> to rate and review it.
      </div>
    );
  }

  async function submit(e) {
    e.preventDefault();
    if (!rating) return setMsg({ kind: 'err', text: 'Pick a star rating.' });
    setBusy(true); setMsg(null);
    try {
      const d = await customerApi.createReview({
        productId: product.id, rating,
        title: title.trim() || undefined,
        comment: comment.trim() || undefined,
      });
      setMsg({ kind: 'ok', text: 'Thanks! Your review is submitted and is now pending moderator approval before it goes public.' });
      setTitle(''); setComment(''); setRating(0);
      notify(`Review submitted (status ${d?.review?.status || 'PENDING'})`);
      onDone && onDone();
    } catch (e2) {
      const t = e2.code === 403 ? 'Only customers who received this product can review it (verified purchase).' : e2.message;
      setMsg({ kind: 'err', text: t });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="write" onSubmit={submit}>
      <h3>Write a review</h3>
      <div className="star-pick">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" className={(hover || rating) >= n ? 'on' : ''}
            onClick={() => setRating(n)} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}>★</button>
        ))}
        <span className="rating-label">{['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'][hover || rating]}</span>
      </div>
      <input className="input" placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
      <textarea className="input" rows={3} placeholder="Share your honest experience (optional)" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} />
      {msg && <div className={`alert ${msg.kind}`}>{msg.text}</div>}
      <button className="btn primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit for moderation'}</button>
    </form>
  );
}
