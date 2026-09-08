import { useEffect, useState } from 'react';
import { publicApi } from '../api.js';
import ProductCard from '../components/ProductCard.jsx';

export default function HomeView({ onOpen, addToCart }) {
  const [filters, setFilters] = useState({ category: '', q: '', sort: 'relevance' });
  const [data, setData] = useState({ products: [], total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [cats, setCats] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    publicApi.categories().then((d) => setCats(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  async function load(page = 1) {
    setLoading(true); setErr('');
    try {
      const d = await publicApi.products({ ...filters, page, limit: 12 });
      setData({ products: d.products, total: d.total, page: d.page, totalPages: d.totalPages });
    } catch (e) { setErr(e.message || 'Could not load catalog.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(1); /* eslint-disable-next-line */ }, [JSON.stringify(filters)]);

  const setCat = (c) => setFilters((f) => ({ ...f, category: c }));
  const setQ = (q) => setFilters((f) => ({ ...f, q }));

  return (
    <div className="home">
      <div className="hero">
        <h1>Bilokat</h1>
        <p className="tagline">Handcrafted Indian namkeen, snack-time heroes. From the live Bilokat catalog.</p>
      </div>

      <div className="controls">
        <input className="search" placeholder="Search… (try 'sev', 'makhana')" value={filters.q}
          onChange={(e) => setQ(e.target.value)} />
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

      <div className="chips">
        <button className={'chip' + (!filters.category ? ' on' : '')} onClick={() => setCat('')}>All</button>
        {cats.map((c) => (
          <button key={c.id} className={'chip' + (filters.category === c.slug ? ' on' : '')}
            onClick={() => setCat(c.slug)}>{c.name}</button>
        ))}
      </div>

      {err && <p className="err">{err}</p>}

      {loading ? (
        <p className="muted">Loading catalog…</p>
      ) : (
        <>
          {data.total === 0 && !filters.q && !filters.category ? (
            <p className="err">No live products found — the catalog may be empty or the API isn't the Session 20 publishing one.</p>
          ) : (
            <p className="muted count">{data.total} product{data.total === 1 ? '' : 's'}</p>
          )}
          <div className="grid">
            {data.products.map((p) => <ProductCard key={p.id} p={p} onOpen={onOpen} onAdd={addToCart ? (pr) => { addToCart(pr.id, 1).catch(() => {}); } : undefined} />)}
          </div>
          {data.products.length === 0 && <p className="muted">Nothing matches those filters.</p>}
          <div className="pager">
            <button disabled={data.page <= 1} onClick={() => load(data.page - 1)}>‹ Prev</button>
            <span>Page {data.page} of {data.totalPages}</span>
            <button disabled={data.page >= data.totalPages} onClick={() => load(data.page + 1)}>Next ›</button>
          </div>
        </>
      )}
    </div>
  );
}
