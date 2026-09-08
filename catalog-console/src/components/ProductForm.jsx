import { useEffect, useState } from 'react';
import { catalogApi } from '../api.js';
import { EMPTY_PRODUCT, SPICE, STOCK } from '../productFields.js';

// Build the payload the Session 20 /seller/catalog endpoints expect. Prices are sent
// as numbers/strings; the backend (authoritative) validates and stores paise-safe Decimal.
function toPayload(f, categories) {
  const cat = categories.find((c) => c.id === f.categoryId);
  return {
    name: f.name,
    slug: f.slug || undefined,
    categoryId: f.categoryId,
    brand: f.brand || undefined,
    regionOrigin: f.regionOrigin || undefined,
    tagline: f.tagline || undefined,
    description: f.description || undefined,
    basePrice: Number(f.basePrice),
    originalPrice: f.originalPrice !== '' ? Number(f.originalPrice) : undefined,
    weightLabel: f.weightLabel || undefined,
    spiceLevel: f.spiceLevel,
    ingredients: f.ingredients,
    pairingSuggestion: f.pairingSuggestion || undefined,
    isBestseller: !!f.isBestseller,
    isNew: !!f.isNew,
    stockOnHand: Number(f.stockOnHand || 0),
    stockStatus: f.stockStatus,
    media: f.media,
  };
}

// Flatten a fetched product into the form state (prices Decimal -> number via toNumber not needed for JSON-safe numbers).
function toForm(p) {
  const num = (x) => (x == null ? '' : typeof x === 'number' ? x : Number(x));
  return {
    name: p.name || '',
    slug: p.slug || '',
    categoryId: p.category?.id || p.categoryId || '',
    brand: p.brand || '',
    regionOrigin: p.regionOrigin || '',
    tagline: p.tagline || '',
    description: p.description || '',
    basePrice: p.basePrice ?? '',
    originalPrice: p.originalPrice == null ? '' : num(p.originalPrice),
    weightLabel: p.weightLabel || '',
    spiceLevel: p.spiceLevel || 'MILD',
    ingredients: Array.isArray(p.ingredients) ? p.ingredients : (p.ingredients ? p.ingredients.split(',').map((s) => s.trim()) : []),
    pairingSuggestion: p.pairingSuggestion || '',
    isBestseller: !!p.isBestseller,
    isNew: !!p.isNew,
    stockOnHand: num(p.stockOnHand ?? 0),
    stockStatus: p.stockStatus || 'IN_STOCK',
    media: Array.isArray(p.media) ? p.media.map((m) => m.url) : [],
  };
}

export default function ProductForm({ mode, product, categories, onSaved, onCancel, notify }) {
  const [f, setF] = useState(() => (mode === 'edit' && product ? toForm(product) : { ...EMPTY_PRODUCT }));
  const [ingText, setIngText] = useState('');
  const [mediaText, setMediaText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (mode === 'edit' && product) { setF(toForm(product)); }
    else { setF({ ...EMPTY_PRODUCT }); }
  }, [mode, product]);

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setF((prev) => ({ ...prev, [k]: v }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    const payload = toPayload(f, categories);
    try {
      if (mode === 'edit') await catalogApi.sellerUpdate(product.id, payload);
      else await catalogApi.sellerCreate(payload);
      notify(mode === 'edit' ? 'Product updated (DRAFT/REJECTED editable only).' : 'Product created as a DRAFT.');
      onSaved();
    } catch (ex) {
      setErr((ex.details?.length ? ex.details.join('; ') : ex.message) || 'Save failed');
    } finally { setBusy(false); }
  };

  return (
    <form className="card form" onSubmit={submit}>
      <h3>{mode === 'edit' ? `Edit product — ${product.name}` : 'New product (DRAFT)'}</h3>
      {err && <div className="alert">{err}</div>}
      <div className="grid2">
        <label>Name *<input required value={f.name} onChange={set('name')} /></label>
        <label>Slug<input value={f.slug} onChange={set('slug')} placeholder="auto if blank" /></label>
        <label>Category *
          <select required value={f.categoryId} onChange={set('categoryId')}>
            <option value="">— select —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>Brand<input value={f.brand} onChange={set('brand')} /></label>
        <label>Region / origin<input value={f.regionOrigin} onChange={set('regionOrigin')} /></label>
        <label>Weight label<input value={f.weightLabel} onChange={set('weightLabel')} placeholder="400g Zip-Pouch" /></label>
        <label>Selling price (₹) *<input required type="number" step="0.01" min="0" value={f.basePrice} onChange={set('basePrice')} /></label>
        <label>MRP (₹)<input type="number" step="0.01" min="0" value={f.originalPrice} onChange={set('originalPrice')} /></label>
        <label>Spice level<select value={f.spiceLevel} onChange={set('spiceLevel')}>{SPICE.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
        <label>Stock status<select value={f.stockStatus} onChange={set('stockStatus')}>{STOCK.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}</select></label>
        <label>Stock on hand<input type="number" min="0" value={f.stockOnHand} onChange={set('stockOnHand')} /></label>
        <label className="check"><input type="checkbox" checked={f.isBestseller} onChange={set('isBestseller')} /> Best-seller flag</label>
        <label className="check"><input type="checkbox" checked={f.isNew} onChange={set('isNew')} /> New flag</label>
      </div>
      <label>Tagline<input value={f.tagline} onChange={set('tagline')} /></label>
      <label>Description<textarea rows="3" value={f.description} onChange={set('description')} /></label>
      <label>Pairing suggestion<input value={f.pairingSuggestion} onChange={set('pairingSuggestion')} /></label>
      <label>Ingredients (one per line)
        <textarea rows="3" value={ingText}
          onChange={(e) => { setIngText(e.target.value); const arr = e.target.value.split('\n').map((s) => s.trim()).filter(Boolean); setF((p) => ({ ...p, ingredients: arr })); }} />
      </label>
      {f.ingredients.length > 0 && <div className="chips">{f.ingredients.map((i, idx) => <span key={idx} className="chip">{i}</span>)}</div>}
      <label>Media URLs (one per line)
        <textarea rows="3" value={mediaText}
          onChange={(e) => { setMediaText(e.target.value); const arr = e.target.value.split('\n').map((s) => s.trim()).filter(Boolean); setF((p) => ({ ...p, media: arr.map((url) => ({ url })) })); }} />
      </label>
      <div className="actions">
        <button className="btn primary" disabled={busy || !f.categoryId || !f.name || !f.basePrice}>
          {busy ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Create DRAFT'}
        </button>
        <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
