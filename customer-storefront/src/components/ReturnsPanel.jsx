import { useEffect, useState } from 'react';
import { returnApi } from '../api.js';
import {
  money, dateStr, returnReasonLabel, returnResolutionLabel, returnStatusLabel,
} from '../format.jsx';

const REASON_CODES = ['DAMAGED', 'DEFECTIVE', 'WRONG_ITEM', 'MISSING_ITEM', 'NOT_AS_DESCRIBED',
  'QUALITY_ISSUE', 'DELIVERY_LATE', 'NO_LONGER_NEEDED', 'OTHER'];

// Buyer-side returns/refunds. Drives the existing item-level return lifecycle:
// request a REFUND (default) or REPLACEMENT for a DELIVERED order, pick which items
// (and quantities) to return, and keep tabs on an in-flight request's status.
export default function ReturnsPanel({ order, notify }) {
  const [requests, setRequests] = useState([]); // existing returns on this order
  const [mode, setMode] = useState(null); // null | 'list' | 'form' | 'evidence'
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [active, setActive] = useState(null);

  const load = async () => {
    try {
      const list = await returnApi.listForOrder(order.id);
      setRequests(Array.isArray(list) ? list : []);
      const inflight = (Array.isArray(list) ? list : []).filter((r) =>
        !['REJECTED', 'COMPLETED', 'CANCELLED'].includes(r.status));
      setActive(inflight[0] || null);
    } catch (e) { setErr(e.message); }
  };

  useEffect(() => { setErr(''); load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [order.id]);

  const openForm = async () => { setErr(''); setMode('form'); };
  const canStart = order.status === 'DELIVERED' && !active;

  return (
    <section className="panel">
      <h3>Returns &amp; refunds</h3>
      {err && <div className="alert err">{err}</div>}

      {requests.length === 0 && !canStart && <p className="muted">This order has no returns.</p>}

      {/* Existing requests */}
      {requests.length > 0 && (
        <ul className="plain-list">
          {requests.map((r) => (
            <ReturnRequestRow key={r.id} r={r} order={order} notify={notify}
              onChanged={load} onOpenEvidence={() => { setActive(r); setMode('evidence'); }} />
          ))}
        </ul>
      )}

      {canStart && (
        <button className="btn primary" onClick={openForm}>Return / refund an item</button>
      )}

      {mode === 'form' && canStart && (
        <ReturnForm order={order} notify={notify}
          onDone={(rr) => { setActive(rr); setMode('evidence'); load(); }}
          onCancel={() => setMode(null)} setErr={setErr} />
      )}

      {mode === 'evidence' && active && (
        <EvidenceForm order={order} rr={active} notify={notify} onDone={load} onCancel={() => setMode(null)} />
      )}

      <p className="hint small">Delivered orders may be returned within the return window. Choose <b>Refund</b> for a money-back return or <b>Replacement</b> for an exchange (photo evidence required).</p>
    </section>
  );
}

function ReturnRequestRow({ r, order, notify, onChanged, onOpenEvidence }) {
  const [expanded, setExpanded] = useState(false);
  const label = returnStatusLabel(r.status);
  const needsEvidence = r.evidenceRequired && (!r.evidence || r.evidence.length === 0);
  const showEvidenceCta = (r.status === 'REQUESTED' || r.status === 'APPROVED' ||
    r.status === 'PICKUP_SCHEDULED' || r.status === 'PICKED_UP' || r.status === 'INSPECTION') && needsEvidence;
  return (
    <li className="plain-row col">
      <div className="row-between">
        <span>
          <span className="pill st">{label}</span>{' '}
          <b>{returnResolutionLabel(r.resolution)}</b>
          <span className="muted"> · {returnReasonLabel(r.reasonCode)}</span>
          {r.orderNumber && <span className="muted"> · {r.orderNumber}</span>}
        </span>
        <button className="btn ghost small" onClick={() => setExpanded(!expanded)}>{expanded ? 'Hide' : 'Details'}</button>
      </div>
      {showEvidenceCta && (
        <button className="btn primary small" onClick={onOpenEvidence}>Add photos / evidence</button>
      )}
      {expanded && (
        <div className="return-detail">
          <p className="muted small">Requested {dateStr(r.requestedAt)}{r.decisionReason ? ` · ${r.decisionReason}` : ''}</p>
          <ul className="plain-list">
            {(r.items || []).map((it) => (
              <li key={it.id || it.orderItemId} className="plain-row">
                <span>{it.productName || it.orderItemId} × {it.quantity}</span>
                <span className="muted small">
                  {it.refundAmount != null ? `refund ${money(it.refundAmount)}` : ''}
                  {it.result ? ` · ${String(it.result).replace(/_/g, ' ').toLowerCase()}` : ''}
                </span>
              </li>
            ))}
          </ul>
          {r.refund && <p className="muted small">Refund: {money(r.refund.amount)} ({r.refund.status})</p>}
          {r.replacement && (
            <p className="muted small">Replacement {r.replacement.replacementReference || ''} · {r.replacement.status.replace(/_/g, ' ')}</p>
          )}
        </div>
      )}
    </li>
  );
}

function ReturnForm({ order, notify, onDone, onCancel, setErr }) {
  const [picks, setPicks] = useState(() =>
    (order.items || []).map((it) => ({ orderItemId: it.orderItemId, quantity: it.quantity, qty: it.quantity })));
  const [resolution, setResolution] = useState('REFUND');
  const [reasonCode, setReasonCode] = useState(REASON_CODES[0]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const setQty = (id, v) => {
    const n = Math.max(0, Math.min((order.items.find((i) => i.orderItemId === id) || {}).quantity || 1, Number(v) || 0));
    setPicks((prev) => prev.map((p) => (p.orderItemId === id ? { ...p, qty: n } : p)));
  };

  async function submit(e) {
    e.preventDefault();
    const items = picks.filter((p) => p.qty > 0).map((p) => ({ orderItemId: p.orderItemId, quantity: p.qty }));
    if (items.length === 0) return setErr('Choose at least one item and a quantity to return.');
    setBusy(true); setErr('');
    try {
      const rr = await returnApi.request(order.id, { reasonCode, resolution, note: note.trim() || undefined, items });
      notify(`Return ${resolution.toLowerCase()} requested`);
      onDone(rr);
    } catch (e2) { setErr(e2.message); }
    finally { setBusy(false); }
  }

  return (
    <form className="return-form" onSubmit={submit}>
      <p className="muted small">Tell us what you'd like to return — you can select individual items and quantities.</p>

      <div className="rr-field">
        <label className="field-label">What would you like?</label>
        <div className="rr-resolution">
          {(['REFUND', 'REPLACEMENT']).map((m) => (
            <label key={m} className={`pay-opt ${resolution === m ? 'on' : ''}`}>
              <input type="radio" name="resolution" value={m} checked={resolution === m} onChange={() => setResolution(m)} />
              <span><b>{returnResolutionLabel(m)}</b></span>
            </label>
          ))}
        </div>
      </div>

      <div className="rr-field">
        <label className="field-label">Reason</label>
        <select className="input" value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
          {REASON_CODES.map((c) => <option key={c} value={c}>{returnReasonLabel(c)}</option>)}
        </select>
      </div>

      <div className="rr-field">
        <label className="field-label">Items to return</label>
        <ul className="plain-list">
          {(order.items || []).map((it) => {
            const p = picks.find((x) => x.orderItemId === it.orderItemId);
            return (
              <li key={it.orderItemId} className="plain-row">
                <span><b>{it.productName}</b> <span className="muted">× up to {it.quantity}</span></span>
                <input type="number" min="0" max={it.quantity} value={p?.qty ?? 0}
                  onChange={(e) => setQty(it.orderItemId, e.target.value)} className="input narrow rr-qty" />
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rr-field">
        <label className="field-label">Note (optional)</label>
        <textarea className="input" rows="2" maxLength="500" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything else we should know?" />
      </div>

      <div className="btn-row">
        <button className="btn primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit return request'}</button>
        <button type="button" className="btn ghost" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
      <p className="hint small">{resolution === 'REPLACEMENT' ? 'A replacement exchange needs a photo of the item — you can add it on the next step.' : 'A refund is issued after the returned item is inspected by our team.'}</p>
    </form>
  );
}

function EvidenceForm({ order, rr, notify, onDone, onCancel }) {
  const [objectId, setObjectId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function submit(e) {
    e.preventDefault();
    if (!objectId.trim()) return setErr('Provide a photo reference (object id) to attach as evidence.');
    setBusy(true); setErr('');
    try {
      await returnApi.uploadEvidence(order.id, rr.id, {
        storageObjectId: objectId.trim(),
        fileName: objectId.trim(),
        mimeType: 'image/jpeg', kind: 'IMAGE', sizeBytes: 0,
      });
      notify('Evidence attached'); onDone();
    } catch (e2) { setErr(e2.message); }
    finally { setBusy(false); }
  }
  return (
    <form className="return-form" onSubmit={submit}>
      <h4>Add evidence</h4>
      <p className="muted small">Attach a reference to your photo (this demo stores an object reference only — no raw file upload).</p>
      <input className="input" placeholder="Photo object id / url (e.g. ev-abc123)" value={objectId} onChange={(e) => setObjectId(e.target.value)} />
      {err && <div className="alert err">{err}</div>}
      <div className="btn-row">
        <button className="btn primary" disabled={busy}>{busy ? 'Uploading…' : 'Attach evidence'}</button>
        <button type="button" className="btn ghost" onClick={onCancel}>Back</button>
      </div>
    </form>
  );
}
