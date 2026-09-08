import { useEffect, useState } from 'react';
import { deliveryApi } from '../api.js';
import TrackPanel from './TrackPanel.jsx';

// DeliveryAssignmentStatus display.
const AS = {
  ASSIGNED: 'Assigned (awaiting you)', ACCEPTED: 'Accepted', PICKED_UP: 'Picked up',
  OUT_FOR_DELIVERY: 'Out for delivery', DELIVERED: 'Delivered', REJECTED: 'Rejected',
  FAILED: 'Failed', CANCELLED: 'Cancelled',
};
const PAY = { PREPAID: 'Prepaid', COD: 'COD' };

const dt = (iso) => (iso ? new Date(iso).toLocaleString() : '—');
const fmtAddr = (a) => {
  if (!a) return '—';
  return [a.line1, a.line2, [a.city, a.state].filter(Boolean).join(', '), a.pincode].filter(Boolean).join(', ');
};

// Actions the courier can take from each active status (deliver is the money/final leg).
const NEXT_ACTION = {
  ASSIGNED: ['accept', 'reject'],
  ACCEPTED: ['pickup', 'fail'],
  PICKED_UP: ['out', 'fail'],
  OUT_FOR_DELIVERY: ['deliver', 'fail'],
};

export default function CourierTasks({ notify }) {
  const [section, setSection] = useState('parcels'); // parcels | replacements
  const [parcels, setParcels] = useState([]);
  const [replacements, setReplacements] = useState([]);
  const [openId, setOpenId] = useState(null);       // expanded id (parcel detail fetch)
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [prompt, setPrompt] = useState(null);        // {kind:'reject'|'fail', id, source, task}
  const [track, setTrack] = useState(null);          // {id, source, loading, leg} live tracking for the expanded task

  const loadTrack = async (t, source) => {
    if (track && track.id === t.id) { setTrack(null); return; }
    setTrack({ id: t.id, source, loading: true, leg: null });
    try {
      const leg = source === 'parcels' ? await deliveryApi.taskTracking(t.id) : await deliveryApi.replacementTaskTracking(t.id);
      setTrack({ id: t.id, source, loading: false, leg });
    } catch (e) { setTrack({ id: t.id, source, loading: false, leg: null, err: e.message || 'Tracking failed' }); }
  };

  const load = async () => {
    setBusy(true); setErr('');
    try {
      const [p, r] = await Promise.all([deliveryApi.tasks(), deliveryApi.replacementTasks()]);
      setParcels(p ?? []); setReplacements(r ?? []);
    } catch (e) { setErr(e.message || 'Load failed'); }
    finally { setBusy(false); }
  };
  useEffect(() => { load(); /* eslint-disable-line */ }, []);

  const openTask = async (t, source) => {
    setOpenId(openId === t.id ? null : t.id);
    setPrompt(null); setDetail(null); setTrack(null);
    if (openId === t.id) return;
    try {
      const d = source === 'parcels' ? await deliveryApi.task(t.id) : await deliveryApi.replacementTask(t.id);
      setDetail(d);
    } catch (e) { notify(e.message || 'Could not load detail', 'err'); }
  };

  const doAction = async (source, id, kind, reason) => {
    setBusyId(id + ':' + kind);
    try {
      const fn = source === 'parcels'
        ? { accept: () => api.taskAccept(id), pickup: () => api.taskPickup(id), out: () => api.taskOutForDelivery(id), deliver: () => api.taskDeliver(id), reject: () => api.taskReject(id, reason), fail: () => api.taskFail(id, reason) }
        : { accept: () => api.replacementAccept(id), pickup: () => api.replacementPickup(id), out: () => api.replacementOutForDelivery(id), deliver: () => api.replacementDeliver(id), reject: () => api.replacementReject(id, reason), fail: () => api.replacementFail(id, reason) };
      await fn[kind]();
      notify(kind === 'accept' ? 'Task accepted.'
        : kind === 'pickup' ? 'Marked picked up.'
          : kind === 'out' ? 'Marked out for delivery.'
            : kind === 'deliver' ? 'Task delivered.' : `${kind} recorded.`);
      setPrompt(null); setOpenId(null); setDetail(null);
      await load();
    } catch (e) { notify(e.message || 'Action failed', 'err'); }
    finally { setBusyId(null); }
  };

  const ask = (source, task, kind) => {
    if (kind === 'deliver') {
      if (confirm(`Confirm delivery of ${task.assignmentNumber}? This completes the task.`)) doAction(source, task.id, 'deliver');
      return;
    }
    if (kind === 'accept') { doAction(source, task.id, 'accept'); return; }
    // reject / fail require a reason
    setPrompt({ source, id: task.id, kind, task });
  };
  const submitPrompt = () => {
    if (!prompt.reason || !prompt.reason.trim()) { notify('A reason is required', 'err'); return; }
    doAction(prompt.source, prompt.id, prompt.kind, prompt.reason.trim());
  };

  if (busy && parcels.length === 0 && replacements.length === 0) return <div className="center">Loading…</div>;

  const renderRows = (rows, source, label) => {
    if (rows.length === 0) return <div className="card empty">No {label} right now.</div>;
    return (
      <div className="cards">
        {rows.map((t) => {
          const actions = NEXT_ACTION[t.status] || [];
          const customer = t.customer;
          return (
            <div className="card product" key={t.id}>
              <div className="product-head" onClick={() => openTask(t, source)}>
                <div>
                  <div className="pname">
                    {source === 'parcels' ? t.assignmentNumber : t.assignmentNumber}
                    <span className="muted small"> · order {t.orderNumber}</span>
                  </div>
                  <div className="muted small">
                    {source === 'parcels'
                      ? `${t.itemCount ?? ''} item(s) · ${t.sellerOrder?.sellerOrderNumber ?? ''}${customer?.name ? ' · to ' + customer.name + (customer.city ? ', ' + customer.city : '') : ''}`
                      : `Replacement ${t.replacementReference} · ${t.quantityTotal ?? ''} unit(s)${customer?.name ? ' · to ' + customer.name : ''}`}
                  </div>
                </div>
                <div className="right"><span className={`badge st-${t.status}`}>{AS[t.status] || t.status}</span></div>
              </div>

              {openId === t.id && detail && (
                <div className="detail">
                  <div className="grid2">
                    <div><b>Assignment</b> {detail.assignmentNumber}</div>
                    <div><b>Status</b> {AS[detail.status] || detail.status}</div>
                    <div><b>Order</b> {detail.orderNumber} {detail.paymentMethod ? `(${PAY[detail.paymentMethod]})` : ''}</div>
                    <div><b>Assigned</b> {dt(detail.assignedAt)}</div>
                    {source === 'parcels' && <div><b>Seller slice</b> {detail.sellerName ? `${detail.sellerName} · ${detail.sellerOrder?.sellerOrderNumber ?? ''}` : (detail.sellerOrder?.sellerOrderNumber || '—')}</div>}
                    {source === 'parcels' && detail.items && detail.items.length > 0 && (
                      <div><b>Items</b></div>
                    )}
                  </div>
                  {source === 'parcels' && detail.items && detail.items.length > 0 && (
                    <ul className="timeline">
                      {detail.items.map((i) => (
                        <li key={i.id}>{i.productName} × {i.quantity}{i.weight ? <span className="muted"> ({i.weight})</span> : ''}</li>
                      ))}
                    </ul>
                  )}
                  {source === 'replacements' && (
                    <div className="muted small">Replacement {detail.replacementReference} · {detail.quantityTotal} unit(s) for return request {detail.returnRequestId?.slice(0, 8)}…</div>
                  )}
                  <div className="grid2">
                    {detail.customer && (
                      <>
                        <div><b>Customer</b> {detail.customer.name}</div>
                        <div><b>Phone</b> {detail.customer.phone}</div>
                        <div><b>Address</b> {fmtAddr(detail.customer.address)}</div>
                      </>
                    )}
                    {detail.acceptedAt && <div><b>Accepted</b> {dt(detail.acceptedAt)}</div>}
                    {detail.pickedUpAt && <div><b>Picked up</b> {dt(detail.pickedUpAt)}</div>}
                    {detail.outForDeliveryAt && <div><b>Out for delivery</b> {dt(detail.outForDeliveryAt)}</div>}
                    {detail.deliveredAt && <div><b>Delivered</b> {dt(detail.deliveredAt)}</div>}
                    {detail.failureReason && <div><b>Failure reason</b> {detail.failureReason}</div>}
                  </div>
                  {detail.events && detail.events.length > 0 && (
                    <div className="muted small" style={{ marginTop: 6 }}>Timeline: {detail.events.map((e) => e.eventType).join(' → ')}</div>
                  )}

                  <div className="product-actions">
                    <button className="btn ghost sm" onClick={() => loadTrack(t, source)}>
                      {track && track.id === t.id ? (track.loading ? '…' : 'Hide tracking') : 'Live tracking'}
                    </button>
                    {t.trackingNumber || detail.trackingNumber
                      ? <span className="muted small">waybill {t.trackingNumber || detail.trackingNumber}</span>
                      : <span className="muted small">no waybill yet — track once the task is picked up</span>}
                  </div>
                  {track && track.id === t.id && !track.loading && track.leg && <TrackPanel legs={[track.leg]} />}
                  {track && track.id === t.id && !track.loading && track.err && <div className="alert">{track.err}</div>}

                  {actions.length > 0 && (
                    <div className="product-actions">
                      {actions.includes('accept') && <button className="btn primary sm" disabled={busyId === t.id + ':accept'} onClick={() => ask(source, t, 'accept')}>{busyId === t.id + ':accept' ? '…' : 'Accept'}</button>}
                      {actions.includes('pickup') && <button className="btn primary sm" disabled={busyId === t.id + ':pickup'} onClick={() => ask(source, t, 'pickup')}>{busyId === t.id + ':pickup' ? '…' : 'Mark picked up'}</button>}
                      {actions.includes('out') && <button className="btn primary sm" disabled={busyId === t.id + ':out'} onClick={() => ask(source, t, 'out')}>{busyId === t.id + ':out' ? '…' : 'Out for delivery'}</button>}
                      {actions.includes('deliver') && <button className="btn ok sm" disabled={busyId === t.id + ':deliver'} onClick={() => ask(source, t, 'deliver')}>{busyId === t.id + ':deliver' ? '…' : 'Mark delivered'}</button>}
                      {actions.includes('reject') && <button className="btn danger sm" disabled={busyId === t.id + ':reject'} onClick={() => ask(source, t, 'reject')}>Reject</button>}
                      {actions.includes('fail') && <button className="btn danger sm" disabled={busyId === t.id + ':fail'} onClick={() => ask(source, t, 'fail')}>Report failed attempt</button>}
                      {t.status !== 'ASSIGNED' && <span className="muted small">Sliding status</span>}
                    </div>
                  )}
                </div>
              )}

              {/* reason prompt (reject / fail) */}
              {prompt && prompt.id === t.id && (
                <div className="detail" style={{ borderTop: 'none', paddingTop: 0 }}>
                  <div className="product-actions">
                    <input value={prompt.reason || ''} onChange={(e) => setPrompt((p) => ({ ...p, reason: e.target.value }))}
                      placeholder={prompt.kind === 'reject' ? 'Reason for rejecting this task (required)' : 'Reason for the failed attempt (required)'} style={{ minWidth: 280 }} autoFocus />
                    <button className="btn danger sm" onClick={submitPrompt}>Confirm {prompt.kind}</button>
                    <button className="btn ghost sm" onClick={() => setPrompt(null)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const activeParcels = parcels.filter((t) => !['DELIVERED', 'CANCELLED', 'REJECTED', 'FAILED'].includes(t.status));
  const activeReplacements = replacements.filter((t) => !['DELIVERED', 'CANCELLED', 'REJECTED', 'FAILED'].includes(t.status));

  return (
    <div className="seller-dash">
      <div className="kpis">
        <div className="kpi"><div className="kpi-v">{activeParcels.length}</div><div className="kpi-l">parcels active</div></div>
        <div className="kpi"><div className="kpi-v warn">{activeReplacements.length}</div><div className="kpi-l">replacements active</div></div>
        <div className="kpi"><div className="kpi-v">{parcels.length + replacements.length}</div><div className="kpi-l">total assigned</div></div>
      </div>
      {err && <div className="alert">{err}</div>}

      <div className="sub-nav">
        {[['parcels', `Parcels (${parcels.length})`], ['replacements', `Replacements (${replacements.length})`]].map(([id, label]) => (
          <button key={id} className={`seg ${section === id ? 'active' : ''}`} onClick={() => { setSection(id); setOpenId(null); setDetail(null); setPrompt(null); setTrack(null); }}>{label}</button>
        ))}
      </div>

      <div className="row-between" style={{ marginBottom: 10 }}>
        <span className="muted small">Deliveries assigned to you. Expand a task to see customer, address and take the next action.</span>
        <button className="btn ghost sm" onClick={load} disabled={busy}>Refresh</button>
      </div>

      {section === 'parcels' && (busy ? <div className="center">Loading…</div> : renderRows(parcels, 'parcels', 'parcel deliveries'))}
      {section === 'replacements' && (busy ? <div className="center">Loading…</div> : renderRows(replacements, 'replacements', 'replacement deliveries'))}
    </div>
  );
}
