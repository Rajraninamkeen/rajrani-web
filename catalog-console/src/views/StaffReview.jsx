import { useEffect, useState } from 'react';
import { catalogApi } from '../api.js';
import { STATUS_LABEL, money } from '../format.js';

const FILTERS = ['PENDING_REVIEW', 'APPROVED', 'REJECTED'];

export default function StaffReview({ notify }) {
  const [status, setStatus] = useState('PENDING_REVIEW');
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState('');
  const [openId, setOpenId] = useState(null);
  const [pendingAction, setPendingAction] = useState(null); // {id, kind}

  const load = async (s = status) => {
    setBusy(true);
    try { setRows((await catalogApi.reviewQueue(s)) ?? []); setErr(''); }
    catch (ex) { setErr((ex.message) || 'Load failed'); }
    finally { setBusy(false); }
  };
  useEffect(() => { load(status); /* eslint-disable-line */ }, []);

  const onFilter = (s) => { setStatus(s); setOpenId(null); setPendingAction(null); load(s); };

  const submitDecision = async (dto) => {
    const p = rows.find((r) => r.id === dto.id);
    try {
      if (dto.kind === 'approve') await catalogApi.reviewApprove(p.id, dto.note);
      else await catalogApi.reviewReject(p.id, dto.reason);
      notify(dto.kind === 'approve' ? 'Approved & published to the live catalog.' : 'Rejected (surfaced to seller).');
      setPendingAction(null); setOpenId(null); load(status);
    } catch (ex) { notify((ex.message) || 'Decision failed', 'err'); }
  };

  return (
    <div>
      <div className="filters">
        {FILTERS.map((s) => (
          <button key={s} className={`seg ${status === s ? 'active' : ''}`} onClick={() => onFilter(s)}>{STATUS_LABEL[s]}</button>
        ))}
      </div>
      {err && <div className="alert">{err}</div>}
      {busy ? <div className="center">Loading…</div> : (
        <div className="cards">
          {rows.length === 0 && <div className="card empty">No products in “{STATUS_LABEL[status]}”.</div>}
          {rows.map((p) => (
            <div className="card product" key={p.id}>
              <div className="product-head" onClick={() => setOpenId(openId === p.id ? null : p.id)}>
                <div>
                  <div className="pname">{p.name} <span className="muted small">({p.slug})</span></div>
                  <div className="muted small">{p.category?.name} · seller {p.seller?.displayName || p.seller?.id}</div>
                </div>
                <div className="right">
                  <span className={`badge st-${p.status}`}>{STATUS_LABEL[p.status] || p.status}</span>
                  <span className="price">{money(p.basePrice)}</span>
                </div>
              </div>
              {openId === p.id && (
                <div className="detail">
                  <div className="grid2">
                    <div><b>Seller</b> {p.seller?.displayName || '—'}</div>
                    <div><b>Category</b> {p.category?.name || '—'}</div>
                    <div><b>Weight</b> {p.weightLabel || '—'}</div>
                    <div><b>Spice</b> {p.spiceLevel || '—'}</div>
                    <div><b>MRP</b> {p.originalPrice ? money(p.originalPrice) : '—'}</div>
                    <div><b>Stock</b> {p.stockOnHand} ({p.stockStatus || '—'})</div>
                  </div>
                  {p.tagline && <p><b>Tagline</b> {p.tagline}</p>}
                  {p.description && <p><b>Description</b><br/>{p.description}</p>}
                  {p.ingredients?.length > 0 && <p><b>Ingredients</b><br/>{p.ingredients.join(', ')}</p>}
                  {p.regionOrigin && <p><b>Origin</b> {p.regionOrigin}</p>}
                  <b>History</b>
                  {Array.isArray(p.history) && p.history.length > 0 && (
                    <ul className="timeline">{p.history.map((h, i) => (
                      <li key={i}>{h.fromStatus} → <b>{h.toStatus}</b> <span className="muted">by {h.actorRole}{h.reason ? `: ${h.reason}` : ''} · {new Date(h.createdAt).toLocaleString()}</span></li>))}
                    </ul>
                  )}
                  {p.status === 'PENDING_REVIEW' && (
                    <div className="decision">
                      <DecisionCard product={p} onApprove={(dto) => submitDecision({ ...dto, id: p.id, kind: 'approve' })}
                        onReject={(dto) => submitDecision({ ...dto, id: p.id, kind: 'reject' })} notify={notify} />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {pendingAction && <div className="overlay">…</div>}
    </div>
  );
}

function DecisionCard({ product, onApprove, onReject }) {
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="decision-row">
      <div className="decision-col">
        <label>Approve (note, optional)
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="looks good" />
        </label>
        <button className="btn primary sm" disabled={busy} onClick={async () => { setBusy(true); try { await onApprove({ note }); } finally { setBusy(false); } }}>Approve & publish</button>
      </div>
      <div className="decision-col">
        <label>Reject (reason — required, surfaced to seller)
          <input required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. price below floor" />
        </label>
        <button className="btn danger sm" disabled={busy || !reason.trim()} onClick={async () => { setBusy(true); try { await onReject({ reason }); } finally { setBusy(false); } }}>Reject</button>
      </div>
    </div>
  );
}
