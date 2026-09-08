import { useEffect, useState } from 'react';
import { catalogApi } from '../api.js';
import ProductForm from '../components/ProductForm.jsx';
import { STATUS_LABEL, VISIBILITY_LABEL, money } from '../format.js';

const FILTERS = ['', 'DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED'];

export default function SellerCatalog({ notify }) {
  const [cats, setCats] = useState([]);
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | product
  const [openId, setOpenId] = useState(null);

  const load = async (status = filter) => {
    setBusy(true);
    try {
      const list = await catalogApi.sellerList(status || undefined);
      setRows(list ?? []);
      setErr('');
    } catch (ex) {
      setErr((ex.details?.length ? ex.details.join('; ') : ex.message) || 'Load failed');
    } finally { setBusy(false); }
  };

  useEffect(() => {
    (async () => {
      try { const c = await catalogApi.categories(); setCats(c ?? []); } catch { /* ignore */ }
      load('');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFilter = (s) => { setFilter(s); load(s); };

  const act = async (label, fn, id) => {
    try { await fn(); notify(label); load(filter); setEditing(null); setOpenId(id || openId); }
    catch (ex) { notify((ex.message || label) + ' — failed', 'err'); }
  };

  return (
    <div>
      <div className="row-between">
        <div className="filters">
          {FILTERS.map((s) => (
            <button key={s || 'all'} className={`seg ${filter === s ? 'active' : ''}`} onClick={() => onFilter(s)}>
              {s || 'All'}
            </button>
          ))}
        </div>
        <button className="btn primary" onClick={() => { setEditing('new'); setOpenId(null); }}>+ New product</button>
      </div>
      {err && <div className="alert">{err}</div>}

      {editing ? (
        <ProductForm
          mode={editing === 'new' ? 'new' : 'edit'}
          product={editing === 'new' ? null : editing}
          categories={cats}
          onSaved={() => { load(filter); setEditing(null); }}
          onCancel={() => setEditing(null)}
          notify={notify}
        />
      ) : busy ? (
        <div className="center">Loading…</div>
      ) : (
        <div className="cards">
          {rows.length === 0 && <div className="card empty">No products for this status.</div>}
          {rows.map((p) => (
            <div className="card product" key={p.id}>
              <div className="product-head" onClick={() => setOpenId(openId === p.id ? null : p.id)}>
                <div>
                  <div className="pname">{p.name}</div>
                  <div className="muted small">{p.category?.name} · {p.brand || '—'} {p.regionOrigin ? '· ' + p.regionOrigin : ''}</div>
                </div>
                <div className="right">
                  <span className={`badge st-${p.status}`}>{STATUS_LABEL[p.status] || p.status}</span>
                  <span className="badge">{VISIBILITY_LABEL[p.visibility] || p.visibility}</span>
                  <span className="price">{money(p.basePrice)}</span>
                </div>
              </div>
              {p.reviewNote && (p.status === 'REJECTED') && (
                <div className="alert">Rejection: {p.reviewNote}</div>
              )}
              <div className="product-actions">
                {(p.status === 'DRAFT' || p.status === 'REJECTED') && (
                  <>
                    <button className="btn sm" onClick={() => setEditing(p)}>Edit</button>
                    <button className="btn sm" onClick={() => act('Submitted for review', () => catalogApi.sellerSubmit(p.id))}>Submit for review</button>
                  </>
                )}
                {p.status === 'PENDING_REVIEW' && <span className="muted small">Awaiting staff approval.</span>}
                {(p.status === 'DRAFT' || p.status === 'REJECTED' || p.status === 'PENDING_REVIEW') && (
                  <button className="btn sm ghost" onClick={() => act('Archived', () => catalogApi.sellerArchive(p.id))}>Archive</button>
                )}
              </div>
              {openId === p.id && <ProductDetail p={p} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductDetail({ p }) {
  const numeric = (x) => (x == null ? '—' : Number(x));
  return (
    <div className="detail">
      <div className="grid2">
        <div><b>Slug</b> {p.slug}</div>
        <div><b>Weight</b> {p.weightLabel || '—'}</div>
        <div><b>Spice</b> {p.spiceLevel || '—'}</div>
        <div><b>MRP</b> {p.originalPrice ? money(p.originalPrice) : '—'}</div>
        <div><b>Stock</b> {p.stockOnHand} ({p.stockStatus || '—'})</div>
        <div><b>Flags</b> {p.isBestseller ? 'Bestseller ' : ''}{p.isNew ? 'New' : ''}</div>
      </div>
      {p.tagline && <p><b>Tagline</b> {p.tagline}</p>}
      {p.description && <p><b>Description</b><br/>{p.description}</p>}
      {p.ingredients?.length > 0 && <p><b>Ingredients</b><br/>{p.ingredients.join(', ')}</p>}
      {p.pairingSuggestion && <p><b>Pairs with</b> {p.pairingSuggestion}</p>}
      {p.media?.length > 0 && (
        <p><b>Media</b><br/>
          {p.media.map((m) => <span key={m.id || m.url} className="chip">{m.altText || m.url}</span>)}
        </p>
      )}
      {p.ratingAvg != null && <p><b>rating</b> {numeric(p.ratingAvg).toFixed(1)} ★ ({p.reviewCount || 0})</p>}
      {Array.isArray(p.history) && p.history.length > 0 && (
        <>
          <b>History</b>
          <ul className="timeline">
            {p.history.map((h, i) => (
              <li key={i}>{h.fromStatus} → <b>{h.toStatus}</b> <span className="muted">by {h.actorRole}{h.reason ? `: ${h.reason}` : ''} · {new Date(h.createdAt).toLocaleString()}</span></li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
