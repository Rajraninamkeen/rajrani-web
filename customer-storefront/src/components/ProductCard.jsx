import ProductImage from './ProductImage.jsx';
import { Stars, money, stockLabel, categoryGlyph } from '../format.jsx';

export default function ProductCard({ p, onOpen, onAdd, wishSaved, onWish }) {
  const isNew = p.isNew;
  return (
    <article className="pcard" onClick={() => onOpen(p.slug)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(p.slug); }}>
      <div className="pcard-media">
        <ProductImage src={p.image} name={p.name} slug={p.slug} />
        {(p.isBestseller || p.isNew || p.discountPercent > 0) && (
          <div className="pcard-badges">
            {p.isBestseller && <span className="pill pill-best">★ Bestseller</span>}
            {p.isNew && <span className="pill pill-new">New</span>}
            {p.discountPercent > 0 && <span className="pill pill-off">{p.discountPercent}% off</span>}
          </div>
        )}
        {onWish && (
          <button className={'wish-heart' + (wishSaved ? ' filled' : '')}
            title={wishSaved ? 'Remove from wishlist' : 'Save to wishlist'}
            aria-label="Save to wishlist"
            onClick={(e) => { e.stopPropagation(); onWish(p.id); }}>♡</button>
        )}
      </div>
      <div className="pcard-body">
        <div className="pcard-cat">{categoryGlyph(p.category)} {String(p.category || '').toUpperCase()}</div>
        <h3 className="pcard-name">{p.name}</h3>
        <div className="pcard-rating">
          <Stars value={p.rating} size={14} />
          <span className="pcard-count">({p.reviewCount})</span>
        </div>
        <div className="pcard-price">
          <span className="price">{money(p.price)}</span>
          {p.originalPrice > p.price && <span className="price-orig">{money(p.originalPrice)}</span>}
        </div>
        <div className="pcard-bottom">
          <div className={`pcard-stock ${p.inStock ? '' : 'oost'}`}>{stockLabel(p.inStock, p.stockLeft)}</div>
          {onAdd && p.inStock && (
            <button className="miniadd" title="Add to cart" onClick={(e) => { e.stopPropagation(); onAdd(p); }}>+</button>
          )}
        </div>
      </div>
    </article>
  );
}
