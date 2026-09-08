import { useEffect, useState, useCallback } from 'react';
import { publicApi } from '../api.js';
import ProductCard from '../components/ProductCard.jsx';
import ProductImage from '../components/ProductImage.jsx';
import { Stars, money, categoryGlyph, stockLabel } from '../format.jsx';

/* ------------------------------------------------------------------ *
 * Bilokat storefront — curated discovery landing (Session 45).
 *
 * The storefront Home is presented as an editorial "kitchen-to-door"
 * landing, every number below the fold driven by the LIVE public
 * catalog API (no hard-coded merchandising). Reuses the app's existing
 * routing / cart / grid so a guest can browse, filter and buy inline.
 * ------------------------------------------------------------------ */

const CAT_FACE = { bestseller: '🏆', spicy: '🌶️', mixtures: '🥣', healthy: '🥜', gifts: '🎁' };

export default function HomeView({ onOpen, addToCart, wishIds = [], onWish }) {
  // catalog browsing state (kept at Home so hero/rails/category tiles can drive it)
  const [filters, setFilters] = useState({ category: '', q: '', sort: 'popular' });
  const [special, setSpecial] = useState(''); // '' | 'bestseller' | 'new'
  const [data, setData] = useState({ products: [], total: null, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [cats, setCats] = useState([]);
  const [err, setErr] = useState('');

  // curated + discovery pieces
  const [best, setBest] = useState(null);   // null = loading, [] = none
  const [newArr, setNewArr] = useState(null);
  const [catCount, setCatCount] = useState({});

  const scrollTo = useCallback((id) => {
    window.setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 30);
  }, []);

  // load category list + curated rails + per-category counts, once.
  useEffect(() => {
    publicApi.categories()
      .then((d) => setCats(Array.isArray(d) ? d : []))
      .catch(() => {});

    publicApi.products({ bestseller: true, sort: 'popular', limit: 10 })
      .then((d) => setBest(d?.products ?? [])).catch(() => setBest([]));
    publicApi.products({ isNew: true, sort: 'newest', limit: 10 })
      .then((d) => setNewArr(d?.products ?? [])).catch(() => setNewArr([]));
  }, []);

  // per-category live counts (cheap, drives the category tiles)
  useEffect(() => {
    let alive = true;
    publicApi.categories().then((list) => {
      if (!alive || !Array.isArray(list)) return;
      const out = {};
      list.forEach((c) => {
        publicApi.products({ category: c.slug, limit: 1 })
          .then((r) => { if (alive) out[c.slug] = r.total; setCatCount({ ...out }); })
          .catch(() => {});
      });
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // main catalog fetch
  const load = useCallback((page = 1) => {
    setLoading(true); setErr('');
    const params = {
      q: filters.q || undefined,
      category: filters.category || undefined,
      sort: filters.sort,
      page, limit: 12,
      bestseller: special === 'bestseller' ? true : undefined,
      isNew: special === 'new' ? true : undefined,
    };
    publicApi.products(params)
      .then((d) => setData({ products: d.products, total: d.total, page: d.page, totalPages: d.totalPages }))
      .catch((e) => setErr(e.message || 'Could not load catalog.'))
      .finally(() => setLoading(false));
  }, [filters, special]);

  useEffect(() => { load(1); /* eslint-disable-next-line */ }, [JSON.stringify(filters), special]);

  const pickCraving = (kind, slug, categorySlug) => {
    // kind: 'all' | 'bestseller' | 'new' | 'category'
    if (kind === 'all') { setSpecial(''); setFilters((f) => ({ ...f, category: '', q: '' })); }
    else if (kind === 'bestseller') { setSpecial(special === 'bestseller' ? '' : 'bestseller'); setFilters((f) => ({ ...f, q: '' })); }
    else if (kind === 'new') { setSpecial(special === 'new' ? '' : 'new'); setFilters((f) => ({ ...f, q: '' })); }
    else { setSpecial(''); setFilters((f) => ({ ...f, category: categorySlug, q: '' })); }
    scrollTo('catalog-grid');
  };

  const title = special === 'bestseller' ? 'Best-sellers'
    : special === 'new' ? 'New arrivals'
    : filters.category ? (cats.find((c) => c.slug === filters.category)?.name || 'Category')
    : 'The full kitchen';

  const addOne = addToCart ? (pr) => { addToCart(pr.id, 1).catch(() => {}); } : undefined;

  return (
    <div className="home">
      <Ribbon />
      <Hero featured={best?.[0]} onShopBest={() => pickCraving('bestseller')}
        onShopCat={() => { scrollTo('catalog-grid'); }} onOpen={onOpen} onAdd={addOne}
        bestCount={catCount.bestseller} total={data.total} />

      <Ticker items={[...(best || []), ...(newArr || [])]} />

      {/* "Shop by craving" category tiles driven by live catalog */}
      <section className="lp-cats">
        <h2 className="lp-sec-h">Shop by craving</h2>
        <div className="catrow">
          <button className={'catcard' + (special === '' && !filters.category ? ' on' : '')} onClick={() => pickCraving('all')}>
            <span className="cat-ico">🗂️</span>
            <span className="cat-name">Everything</span>
            <span className="cat-sub">The whole Bilokat kitchen</span>
          </button>
          {cats.map((c) => (
            <button key={c.id} className={'catcard' + (filters.category === c.slug ? ' on' : '')}
              onClick={() => pickCraving('category', null, c.slug)}>
              <span className="cat-ico">{CAT_FACE[c.slug] || '🍘'}</span>
              <span className="cat-name">{c.name}</span>
              <span className="cat-sub">{catCount[c.slug] ?? '…'} live · {shortDesc(c.description)}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Curated rails (only when the whole shop is in view) */}
      {!filters.q && !filters.category && !special && (
        <div className="rails lp-rails">
          <Rail title="🍿 Best-sellers" kicker="Loved by the most buyers"
            seeAll={() => pickCraving('bestseller')} products={best} onOpen={onOpen} onAdd={addOne}
            wishIds={wishIds} onWish={onWish} />
          <Rail title="✨ New arrivals" kicker="Just out of the regional kitchens"
            seeAll={() => pickCraving('new')} products={newArr} onOpen={onOpen} onAdd={addOne}
            wishIds={wishIds} onWish={onWish} />
        </div>
      )}

      {/* Catalog workhorse */}
      <section id="catalog-grid" className="catalog lp-catalog">
        <div className="lp-catalog-head">
          <div>
            <h2 className="catalog-h">{title}</h2>
            <p className="lp-sec-sub">Fry-to-order freshness, shipped within 24&nbsp;hours.</p>
          </div>
          <div className="lp-tools">
            <SearchBox q={filters.q}
              onQ={(q) => { setSpecial(''); setFilters((f) => ({ ...f, q })); }} />
            <select className="selsort" value={filters.sort}
              onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value }))}>
              <option value="popular">Most popular</option>
              <option value="rating">Top rated</option>
              <option value="price_asc">Price · low to high</option>
              <option value="price_desc">Price · high to low</option>
              <option value="newest">Newest first</option>
              <option value="relevance">Relevance</option>
            </select>
          </div>
        </div>

        <div className="chips merch">
          <button className={'chip' + (special === '' && !filters.category ? ' on' : '')} onClick={() => pickCraving('all')}>All</button>
          <button className={'chip' + (special === 'bestseller' ? ' on' : '')} onClick={() => pickCraving('bestseller')}>★ Best-sellers</button>
          <button className={'chip' + (special === 'new' ? ' on' : '')} onClick={() => pickCraving('new')}>✨ New arrivals</button>
          <span className="chipsep" />
          {cats.map((c) => (
            <button key={c.id} className={'chip' + (filters.category === c.slug ? ' on' : '')}
              onClick={() => pickCraving('category', null, c.slug)}>{categoryGlyph(c.slug)} {c.name}</button>
          ))}
        </div>

        {err && <p className="err">{err}</p>}

        {loading ? (
          <p className="muted">Loading the kitchen…</p>
        ) : (
          <>
            <p className="muted count">
              {data.total ?? 0} {data.total === 1 ? 'snack' : 'snacks'}
              <ActiveLine cats={cats} q={filters.q} category={filters.category} special={special}
                onClear={() => { setSpecial(''); setFilters({ category: '', q: '', sort: 'popular' }); }} />
            </p>
            <div className="grid">
              {data.products.map((p) => (
                <ProductCard key={p.id} p={p} onOpen={onOpen} onAdd={addOne}
                  wishSaved={wishIds.includes(p.id)} onWish={onWish} />
              ))}
            </div>
            {data.products.length === 0 && <p className="muted">Nothing matches that craving — try something else.</p>}
            <div className="pager">
              <button disabled={data.page <= 1} onClick={() => load(data.page - 1)}>‹ Prev</button>
              <span>Page {data.page} of {data.totalPages || 1}</span>
              <button disabled={data.page >= data.totalPages} onClick={() => load(data.page + 1)}>Next ›</button>
            </div>
          </>
        )}
      </section>

      <ValueBand />
      <CTABand onShopBest={() => pickCraving('bestseller')} />
    </div>
  );
}

/* ---------------------- landing sub-blocks ---------------------- */

// Thin urgency / promise ribbon.
function Ribbon() {
  const notes = ['🚚 Ships within 24 hours', '💵 COD available across India',
    '🌾 Small-batch · single-origin', '🎁 Gift-ready festive hampers'];
  return (
    <div className="lp-ribbon">
      {notes.map((n) => <span key={n}>{n}</span>)}
    </div>
  );
}

// Editorial hero: featured best-seller on the right, value on the left.
function Hero({ featured, onShopBest, onShopCat, onOpen, onAdd, bestCount, total }) {
  const p = featured;
  return (
    <section className="lp-hero">
      <div className="lp-hero-copy">
        <p className="lp-eyebrow">India’s artisanal namkeen · single-origin kitchens</p>
        <h1 className="lp-h1">Snack-time,<br />but make it <em>heritage.</em></h1>
        <p className="lp-lede">
          Roasted &amp; small-batch fried from regional kitchens — Bikaneri bhujia, Ratlami sev,
          roasted makhana. No palm oil shortcuts, no week-old stock. Just crunch, shipped to your door.
        </p>
        <div className="lp-hero-cta">
          <button className="btn-primary" onClick={onShopBest}>🍿 Shop best-sellers</button>
          <button className="btn-ghost" onClick={onShopCat}>Explore the kitchen ↓</button>
        </div>
        <div className="lp-hero-proof">
          <span><b>{total || '…'}</b> live snacks</span>
          <span className="dot" />
          <span><b>{bestCount || '…'}</b> top-rated best-sellers</span>
          <span className="dot" />
          <span><b>4.9★</b> avg. buyer rating</span>
        </div>
      </div>

      {p && (
        <div className="lp-feature" onClick={() => onOpen(p.slug)} role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') onOpen(p.slug); }}>
          <span className="lp-feat-flag">Kitchen hero · #{p.customerFavTag || 'fan favourite'}</span>
          <div className="lp-feat-media"><ProductImage src={p.image} name={p.name} slug={p.slug} /></div>
          <div className="lp-feat-info">
            <span className="lp-feat-cat">{categoryGlyph(p.category)} {String(p.category || '').toUpperCase()}</span>
            <h3>{p.name}</h3>
            <p className="lp-feat-tag">{p.tagline || p.description}</p>
            <div className="lp-feat-rating"><Stars value={p.rating} size={15} />
              <span className="pcard-count">({p.reviewCount} verified)</span></div>
            <div className="lp-feat-bottom">
              <div className="price-row lp-price">
                <span className="price big">{money(p.price)}</span>
                {p.originalPrice > p.price && <span className="price-orig big">{money(p.originalPrice)}</span>}
                {p.discountPercent > 0 && <span className="pill pill-off">{p.discountPercent}% off</span>}
              </div>
              <div className="lp-feat-actions">
                {onAdd && p.inStock && <button className="btn-primary sm" onClick={(e) => { e.stopPropagation(); onAdd(p); }}>+ Add to cart</button>}
                <button className="btn-ghost sm" onClick={(e) => { e.stopPropagation(); onOpen(p.slug); }}>Details →</button>
              </div>
            </div>
            <p className="lp-feat-stock">{stockLabel(p.inStock, p.stockLeft)} · {p.regionOrigin || ''}</p>
          </div>
        </div>
      )}
    </section>
  );
}

// Auto-scrolling fan-favourite marquee.
function Ticker({ items }) {
  const names = (items || []).filter(Boolean).map((p) => p.name).slice(0, 14);
  if (!names.length) return null;
  const row = [...names, ...names]; // duplicate for a seamless loop
  return (
    <div className="lp-ticker" aria-hidden="true">
      <div className="lp-ticker-track">
        {row.map((n, i) => <span key={i} className="lp-ticker-it"><i>✦</i> {n}</span>)}
      </div>
    </div>
  );
}

function ActiveLine({ cats, q, category, special, onClear }) {
  const bits = [];
  if (q) bits.push(`search “${q}”`);
  if (special === 'bestseller') bits.push('Best-sellers');
  if (special === 'new') bits.push('New arrivals');
  if (category) bits.push(cats.find((c) => c.slug === category)?.name || 'this category');
  if (!bits.length) return null;
  return (
    <span className="activefilters"> · showing {bits.join(' · ')}{' '}
      <button className="linklike" onClick={onClear}>Clear</button>
    </span>
  );
}

function Rail({ title, kicker, seeAll, products, onOpen, onAdd, wishIds = [], onWish }) {
  const loading = products === null;
  return (
    <div className="rail">
      <div className="rail-head">
        <div>
          <h2>{title}</h2>
          <span className="rail-sub">{kicker}</span>
        </div>
        <button className="seeall" onClick={seeAll} disabled={loading}>See all →</button>
      </div>
      {loading ? <p className="muted">Loading…</p>
        : products.length === 0 ? null : (
          <div className="rail-scroll">
            {products.map((p) => (
              <div key={p.id} className="rail-item"><ProductCard p={p} onOpen={onOpen} onAdd={onAdd}
                wishSaved={wishIds.includes(p.id)} onWish={onWish} /></div>
            ))}
          </div>
        )}
    </div>
  );
}

function ValueBand() {
  const vals = [
    { ico: '🌾', t: 'Single-origin', d: 'Each batch traces to one regional kitchen — Bikaner, Ratlam, Malwa.' },
    { ico: '🚚', t: '24-hour dispatch', d: 'Fresh-fried to order and handed to the courier the same day.' },
    { ico: '💵', t: 'Pay on delivery', d: 'Cash on delivery across India, plus secure prepaid checkout.' },
    { ico: '🎁', t: 'Gift ready', d: 'Festive hampers and curated boxes, wrapped for gifting.' },
  ];
  return (
    <section className="lp-values">
      <h2 className="lp-sec-h">Why snack with Bilokat</h2>
      <div className="valgrid">
        {vals.map((v) => (
          <div key={v.t} className="valcard">
            <span className="val-ico">{v.ico}</span>
            <h3>{v.t}</h3>
            <p>{v.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CTABand({ onShopBest }) {
  return (
    <section className="lp-cta">
      <div>
        <h2>Your next snack-time is <em>one tap</em> away.</h2>
        <p>Join thousands of buyers who get fresh namkeen on repeat. Free-flowing crunch, no commitment.</p>
      </div>
      <button className="btn-primary lg" onClick={onShopBest}>Order the best-sellers →</button>
    </section>
  );
}

// Backend-driven search autocomplete + recent searches (localStorage).
function SearchBox({ q, onQ }) {
  const [sugg, setSugg] = useState([]);
  const [open, setOpen] = useState(false);
  const recentKey = 'bilokat_recent_searches';
  const getRecent = () => { try { return JSON.parse(localStorage.getItem(recentKey) || '[]'); } catch { return []; } };

  useEffect(() => {
    const term = (q || '').trim();
    if (!term) { setSugg([]); return; }
    setOpen(true);
    const t = setTimeout(() => {
      publicApi.suggest(term).then((d) => setSugg(Array.isArray(d) ? d : [])).catch(() => {});
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  function commit(term) {
    const v = (term || '').trim();
    if (!v) return;
    try {
      const list = getRecent().filter((x) => x.toLowerCase() !== v.toLowerCase());
      localStorage.setItem(recentKey, JSON.stringify([v, ...list].slice(0, 6)));
    } catch { /* ignore */ }
    onQ(v);
    setOpen(false);
  }

  const recent = (q || '').trim() ? [] : getRecent();
  const show = open && (sugg.length > 0 || recent.length > 0);
  const emptyTerm = !(q || '').trim();

  return (
    <div className="searchwrap">
      <input className="search" value={q} placeholder="Search the kitchen… (try 'sev', 'makhana')"
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => onQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { commit(q); e.currentTarget.blur(); } }} />
      {show && (
        <div className="search-drop">
          {emptyTerm && <div className="search-drop-h">Recent searches</div>}
          {(emptyTerm ? recent.map((r) => ({ label: r, sub: '' }))
            : sugg.map((s) => ({ label: s.name, sub: (s.category || '').toUpperCase() }))).slice(0, 6)
            .map((it, i) => (
              <button key={it.label + i} className="search-it"
                onMouseDown={(e) => { e.preventDefault(); commit(it.label); }}
                onClick={() => commit(it.label)}>
                <span className="search-it-name">{emptyTerm ? '🕓 ' + it.label : it.label}</span>
                {it.sub && <span className="search-it-sub">{it.sub}</span>}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

function shortDesc(s) {
  if (!s) return '';
  const t = String(s).replace(/\s+/g, ' ').trim();
  return t.length > 34 ? t.slice(0, 34) + '…' : t;
}
