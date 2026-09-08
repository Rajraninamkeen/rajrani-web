import { useEffect, useState } from 'react';
import { addressesApi } from '../api.js';

const TYPE_LABEL = { HOME: 'Home', WORK: 'Work', OTHER: 'Other' };
const empty = () => ({ type: 'HOME', label: '', line1: '', line2: '', city: '', state: '', pincode: '', isDefault: false });

// Customer address book (#/addresses). Full CRUD over the Address API (Session 47).
export default function AddressesView({ user, notify }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | address object
  const [form, setForm] = useState(empty());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    addressesApi.list()
      .then((d) => { if (alive) setList(Array.isArray(d) ? d : []); })
      .catch((e) => { if (alive) setErr(e.message || 'Could not load addresses.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  function openNew() { setEditing('new'); setForm(empty()); setErr(''); }
  function openEdit(a) { setEditing(a); setForm({ ...a, label: a.label || '', line2: a.line2 || '' }); setErr(''); }

  async function save() {
    if (!form.line1.trim() || !form.city.trim() || !form.state.trim() || !/^[1-9][0-9]{5}$/.test(form.pincode)) {
      setErr('Please fill address, city, state and a valid 6-digit pincode.');
      return;
    }
    setSaving(true); setErr('');
    const payload = {
      type: form.type, label: form.label || undefined, line1: form.line1,
      line2: form.line2 || undefined, city: form.city, state: form.state,
      pincode: form.pincode, isDefault: form.isDefault,
    };
    try {
      if (editing === 'new') { await addressesApi.create(payload); notify?.('Address added'); }
      else { await addressesApi.update(editing.id, payload); notify?.('Address updated'); }
      setEditing(null);
      setList(await addressesApi.list());
    } catch (e) { setErr(e.message || 'Could not save address.'); }
    finally { setSaving(false); }
  }

  async function setDefault(a) {
    try { await addressesApi.update(a.id, { isDefault: true }); setList(await addressesApi.list()); }
    catch (e) { setErr(e.message || 'Could not update.'); }
  }

  async function remove(a) {
    if (!window.confirm(`Delete address "${a.line1}, ${a.city}"?`)) return;
    try { await addressesApi.remove(a.id); notify?.('Address deleted'); setList(await addressesApi.list()); }
    catch (e) { setErr(e.message || 'Could not delete.'); }
  }

  if (!user) {
    return <div className="empty"><h2>Address book</h2><p>Sign in to save delivery addresses.</p>
      <button className="btn primary" onClick={() => { window.location.hash = '/account'; }}>Sign in / create account</button></div>;
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="page">
      <div className="page-head addr-head">
        <div><h1>📍 Address book</h1><p className="muted">Save home, work &amp; gift addresses for faster checkout.</p></div>
        {!editing && <button className="btn primary" onClick={openNew}>+ Add address</button>}
      </div>

      {err && <p className="alert err">{err}</p>}
      {saving && <p className="muted">Saving…</p>}

      {editing && (
        <div className="panel addr-form">
          <h3>{editing === 'new' ? 'Add address' : 'Edit address'}</h3>
          <div className="two">
            <label>Type
              <select className="input" value={form.type} onChange={(e) => set('type', e.target.value)}>
                <option value="HOME">Home</option><option value="WORK">Work</option><option value="OTHER">Other</option>
              </select>
            </label>
            <label>Label <span className="hint">(optional, e.g. “Gift”</span>
              <input className="input" value={form.label} maxLength={40} placeholder="Home / Office"
                onChange={(e) => set('label', e.target.value)} />
            </label>
          </div>
          <label>Flat / House / Street *
            <input className="input" value={form.line1} maxLength={180} placeholder="12, MG Road"
              onChange={(e) => set('line1', e.target.value)} />
          </label>
          <label>Area / Landmark
            <input className="input" value={form.line2} maxLength={180} placeholder="Near Central Market"
              onChange={(e) => set('line2', e.target.value)} />
          </label>
          <div className="three">
            <label>City *
              <input className="input" value={form.city} maxLength={80} placeholder="Indore"
                onChange={(e) => set('city', e.target.value)} />
            </label>
            <label>State *
              <input className="input" value={form.state} maxLength={80} placeholder="Madhya Pradesh"
                onChange={(e) => set('state', e.target.value)} />
            </label>
            <label>Pincode *
              <input className="input" value={form.pincode} maxLength={6} placeholder="452001"
                onChange={(e) => set('pincode', e.target.value.replace(/\D/g, ''))} />
            </label>
          </div>
          <label className="checkline">
            <input type="checkbox" checked={form.isDefault} onChange={(e) => set('isDefault', e.target.checked)} />
            Set as default delivery address
          </label>
          <div className="addr-form-actions">
            <button className="btn primary" disabled={saving} onClick={save}>Save address</button>
            <button className="btn ghost" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}

      {!editing && (loading ? <p className="muted">Loading addresses…</p>
        : list.length === 0 ? (
          <div className="empty"><p>No saved addresses yet.</p>
            <button className="btn primary" onClick={openNew}>+ Add your first address</button></div>
        ) : (
          <div className="addr-list">
            {list.map((a) => (
              <div className={'panel addr-card' + (a.isDefault ? ' isdefault' : '')} key={a.id}>
                <div className="addr-badge">{a.isDefault ? '✓ Default' : TYPE_LABEL[a.type] || a.type}</div>
                {a.label && <h3 className="addr-label">{a.label}</h3>}
                <p>{a.line1}{a.line2 ? ', ' + a.line2 : ''}</p>
                <p>{a.city}, {a.state} — {a.pincode}</p>
                <p className="addr-country">{a.country}</p>
                <div className="addr-actions">
                  {!a.isDefault && <button className="btnlink" onClick={() => setDefault(a)}>Set default</button>}
                  <button className="btnlink" onClick={() => openEdit(a)}>Edit</button>
                  <button className="btnlink danger" onClick={() => remove(a)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}
