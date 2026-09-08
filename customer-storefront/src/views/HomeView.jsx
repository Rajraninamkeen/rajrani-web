import { useEffect, useState } from 'react';
import { publicApi } from '../api.js';
import ProductCard from '../components/ProductCard.jsx';

// Session 44 — Buyer discovery & merchandising. Curated landing rails (Bestsellers /
// New arrivals) driven by the live discovery API (isBestseller/isNew filters) are shown
// on a default browse, then a full searchable, sortable, filterable catalog grid below.

export default function HomeView({ onOpen, addToCart }) {
  // main catalog filters
  const [filters, setFilters] = useState({ category: '', q: '', sort: 'relevance' });
  const [special, setSpecial] = useState(''); // '' | 'bestseller' | 'new'
  const [data, setData] = useState({ products: [], total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [cats, setCats] = useState([]);
  const [err, setErr] = useState('');
  // curated rails
  const [best, setBest] = useState(null); // null=loading, [] = none
  const [newArr, setNewArr] = useState(null);

  useEffect(() => {
    publicApi.categories().then((d) => setCats(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  // load curated rails once (only meaningful when browsing the whole shop)
  useEffect(() => {
    publicApi.products({ bestseller: true, sort: 'popular', limit: 8 })
      .then((d) => setBest(d?.products ?? [])).catch(() => setBest([]));
    publicApi.products({ isNew: true, sort: 'newest', limit: 8 })
      .then((d) => setNewArr(d?.products ?? [])).catch(() => setNewArr([]));
  }, []);

  const showRails = !filters.q && !filters.category && !special;

  function load(page = 1) {
    setLoading(true); setErr('');
    const params = {
      q: filters.q || undefined,
      category: filters.category || undefined,
      sort: filters.sort,
      page,
      limit: 12,
      bestseller: special === 'bestseller' ? true : undefined,
      isNew: special === 'new' ? true : undefined,
    };
    publicApi.products(params)
      .then((d) => setData({ products: d.products, total: d.total, page: d.page, totalPages: d.totalPages }))
      .catch((e) => setErr(e.message || 'Could not load catalog.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(1); /* eslint-disable-next-line */ }, [JSON.stringify(filters), special]);

  const setSpecialAnd = (s) => {
    setSpecial(s);
    setFilters((f) => ({ ...f, q: '' }));
    setTimeout(() => { const el = document.getElementById('catalog-grid'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30);
  };
  const clearAll = () => { setSpecial(''); setFilters({ category: '', q: '', sort: 'relevance' }); };
  const activeLine = () => {
    const bits = [];
    if (filters.q) bits.push(`search "${filters.q}"`);
    if (filters.category) bits.push(cats.find((c) => c.slug === filters.category)?.name || 'category');
    if (special === 'bestseller') bits.push('Bestsellers');
    if (special === 'new') bits.push('New arrivals');
    return bits.length ? bits.join(' · ') : null;
  };

  return (
    <div className="home">
      <div className="hero">
        <h1>Bilokat</h1>
        <p className="tagline">Handcrafted Indian namkeen, snack-time heroes. From the live Bilokat catalog.</p>
      </div>

      {showRails && (
        <div className="rails">
          <Rail title="🍿 Bestsellers" sub="Loved by the most" seeAll={() => setSpecialAnd('bestseller')}
            products={best} onOpen={onOpen} addToCart={addToCart} />
          <Rail title="✨ New arrivals" sub="Just landed in the kitchen" seeAll={() => setSpecialAnd('new')}
            products={newArr} onOpen={onOpen} addToCart={addToCart} />
        </div>
      )}

      <section id="catalog-grid" className="catalog">
        <h2 className="catalog-h">{special === 'bestseller' ? 'Bestsellers' : special === 'new' ? 'New arrivals' : 'Shop all'}</h2>

        <div className="controls">
          <input className="search" placeholder="Search… (try 'sev', 'makhana')" value={filters.q}
            onChange={(e) => { setSpecial(''); setFilters((f) => ({ ...f, q: e.target.value })); }} />
          <div className="sortrow">
            <span>Sort</span>
            <select value={filters.sort} onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value }))}>
              <option value="relevance">Relevance</option>
              <option value="rating">Top rated</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="newest">Newest</option>
              <option value="popular">Popular</option>
            </select>
          </div>
        </div>

        <div className="chips merch">
          <button className={'chip' + (special === '' ? ' on' : '')} onClick={() => clearAll()}>All</button>
          <button className={'chip' + (special === 'bestseller' ? ' on' : '')} onClick={() => setSpecialAnd(special === 'bestseller' ? '' : 'bestseller')}>★ Bestsellers</button>
          <button className={'chip' + (special === 'new' ? ' on' : '')} onClick={() => setSpecialAnd(special === 'new' ? '' : 'new')}>✨ New arrivals</button>
        </div>
        <div className="chips">
          <button className={'chip' + (!filters.category ? ' on' : '')} onClick={() => setFilters((f) => ({ ...f, category: '' }))}>All categories</button>
          {cats.map((c) => (
            <button key={c.id} className={'chip' + (filters.category === c.slug ? ' on' : '')}
              onClick={() => setFilters((f) => ({ ...f, category: c.slug }))}>{c.name}</button>
          ))}
        </div>

        {err && <p className="err">{err}</p>}

        {loading ? (
          <p className="muted">Loading catalog…</p>
        ) : (
          <>
            <p className="muted count">
              {data.total} product{data.total === 1 ? '' : 's'}
              {activeLine() && <> <span className="activefilters">· {activeLine()}</span>{' '}
                <button className="linklike" onClick={() => clearAll()}>Clear</button></>}
            </p>
            <div className="grid">
              {data.products.map((p) => <ProductCard key={p.id} p={p} onOpen={onOpen} onAdd={addToCart ? (pr) => { addToCart(pr.id, 1).catch(() => {}); } : undefined} />)}
            </div>
            {data.products.length === 0 && <p className="muted">Nothing matches those filters.</p>}
            <div className="pager">
              <button disabled={data.page <= 1} onClick={() => load(data.page - 1)}>‹ Prev</button>
              <span>Page {data.page} of {data.totalPages || 1}</span>
              <button disabled={data.page >= data.totalPages} onClick={() => load(data.page + 1)}>Next ›</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

// Horizontally scrollable curated rail; hidden until loaded and non-empty.
function Rail({ title, sub, seeAll, products, onOpen, addToCart }) {
  const loading = products === null;
  return (
    <div className="rail">
      <div className="rail-head">
        <div>
          <h2>{title}</h2>
          {sub && <span className="rail-sub">{sub}</span>}
        </div>
        <button className="seeall" onClick={seeAll} disabled={loading}>See all →</button>
      </div>
      {loading ? (
        <p className="muted">Loading…</p>
      ) : products.length === 0 ? null : (
        <div className="rail-scroll">
          {products.map((p) => (
            <div key={p.id} className="rail-item">
              <ProductCard p={p} onOpen={onOpen} onAdd={addToCart ? (pr) => { addToCart(pr.id, 1).catch(() => {}); } : undefined} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
