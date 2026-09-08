import { useEffect, useState } from 'react';
import { opsApi } from '../api.js';
import TrackPanel from './TrackPanel.jsx';

// Display maps + colours (kept in sync with backend enums).
const OS = {
  PLACED: 'Placed', CONFIRMED: 'Confirmed', PACKED: 'Packed', SHIPPED: 'Shipped',
  OUT_FOR_DELIVERY: 'Out for delivery', DELIVERED: 'Delivered', CANCELLED: 'Cancelled',
  RETURN_REQUESTED: 'Return requested', RETURNED: 'Returned', REFUND_PENDING: 'Refund pending', REFUNDED: 'Refunded',
};
const RS = {
  REQUESTED: 'Requested', APPROVED: 'Approved', REJECTED: 'Rejected', PICKUP_SCHEDULED: 'Pickup scheduled',
  PICKED_UP: 'Picked up', INSPECTION: 'Inspection', APPROVED_FOR_REFUND: 'Approved for refund',
  COMPLETED: 'Completed', CANCELLED: 'Cancelled', REPLACEMENT_ISSUED: 'Replacement issued',
};
const RESOLUTION = { REFUND: 'Refund', REPLACEMENT: 'Replacement' };
const RCODE = { DEFECTIVE: 'Defective', WRONG_ITEM: 'Wrong item', NOT_AS_DESCRIBED: 'Not as described', DAMAGED: 'Damaged', OTHER: 'Other' };
const REPL_STATUS = { PENDING_DISPATCH: 'Pending dispatch', DISPATCHED: 'Dispatched', COMPLETED: 'Completed', CANCELLED: 'Cancelled' };
const PAY = { PREPAID: 'Prepaid', COD: 'COD' };
const PS = { PENDING: 'Pending', PAID: 'Paid', FAILED: 'Failed', REFUNDED: 'Refunded', COD_PENDING: 'COD pending', COD_PAID: 'COD paid', COD_FAILED: 'COD failed' };

// Legal fulfilment advances the OPERATOR can make from each order state.
const NEXT = {
  PLACED: ['CONFIRMED'], CONFIRMED: ['PACKED'], PACKED: ['SHIPPED'],
  SHIPPED: ['OUT_FOR_DELIVERY', 'DELIVERED'], OUT_FOR_DELIVERY: ['DELIVERED'],
};

const ORDER_FILTERS = ['', 'PLACED', 'CONFIRMED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURN_REQUESTED', 'REFUND_PENDING', 'REFUNDED', 'CANCELLED'];
const RETURN_FILTERS = ['', 'REQUESTED', 'APPROVED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'INSPECTION', 'APPROVED_FOR_REFUND', 'COMPLETED', 'REJECTED', 'REPLACEMENT_ISSUED'];

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dt = (iso) => (iso ? new Date(iso).toLocaleString() : '—');

export default function OperatorDashboard({ notify }) {
  const [section, setSection] = useState('orders');
  const [ofilter, setOfilter] = useState('');
  const [orders, setOrders] = useState([]);
  const [openOrder, setOpenOrder] = useState(null);
  const [rfilter, setRfilter] = useState('');
  const [returns, setReturns] = useState([]);
  const [openRet, setOpenRet] = useState(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState('');

  // pending-action prompts
  const [inspecting, setInspecting] = useState(null);   // returnId being inspected
  const [inspSel, setInspSel] = useState({});
  const [inspNotes, setInspNotes] = useState({});
  const [dispatching, setDispatching] = useState(null);
  const [dispRef, setDispRef] = useState('');
  const [rejecting, setRejecting] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [advancing, setAdvancing] = useState(null);
  const [track, setTrack] = useState(null);          // {orderId, loading, data} live tracking

  const loadTrack = async (o) => {
    if (track && track.orderId === o.id) { setTrack(null); return; }
    setTrack({ orderId: o.id, loading: true, data: null, err: '' });
    try {
      const data = await opsApi.orderTracking(o.id);
      setTrack({ orderId: o.id, loading: false, data, err: '' });
    } catch (e) { setTrack({ orderId: o.id, loading: false, data: null, err: e.message || 'Tracking failed' }); }
  };

  const loadOrders = (status) => opsApi.orders(status).then((o) => setOrders(o?.orders ?? o?.items ?? []));
  const loadReturns = (status) => opsApi.returns(status).then((r) => setReturns(r?.returns ?? r?.items ?? []));

  const loadAll = async () => {
    setBusy(true); setErr('');
    try {
      const [o, r] = await Promise.all([opsApi.orders(ofilter), opsApi.returns(rfilter)]);
      setOrders(o?.orders ?? o?.items ?? []); setReturns(r?.returns ?? r?.items ?? []);
    } catch (e) { setErr(e.message || 'Load failed'); }
    finally { setBusy(false); }
  };
  useEffect(() => { loadAll(); /* eslint-disable-line */ }, []);

  const refreshAfter = (fn) => Promise.all([loadOrders(ofilter), loadReturns(rfilter)]).then(fn);

  // ---------- ORDER actions ----------
  const advance = async (order, to) => {
    setAdvancing(order.id + ':' + to); setErr('');
    try {
      await opsApi.advance(order.id, to);
      notify(`Order advanced to ${OS[to]}.`);
      setOpenOrder(null);
      await refreshAfter();
    } catch (e) { notify(e.message || 'Advance failed', 'err'); }
    finally { setAdvancing(null); }
  };

  // ---------- RETURN actions ----------
  const decideReturn = async (r, approve) => {
    if (!approve) { setRejecting(r.id); setRejectReason(''); return; }
    try { await opsApi.returnDecision(r.id, true); notify('Return approved — schedule a pickup.'); await refreshAfter(); }
    catch (e) { notify(e.message || 'Decision failed', 'err'); }
  };
  const submitReject = async () => {
    if (!rejectReason.trim()) { notify('A reason is required to reject', 'err'); return; }
    try { await opsApi.returnDecision(rejecting, false, rejectReason.trim()); notify('Return rejected.'); setRejecting(null); await refreshAfter(); }
    catch (e) { notify(e.message || 'Reject failed', 'err'); }
  };
  const pickup = async (r) => {
    try { await opsApi.returnPickup(r.id); notify('Pickup scheduled.'); await refreshAfter(); }
    catch (e) { notify(e.message || 'Action failed', 'err'); }
  };
  const pickedUp = async (r) => {
    try { await opsApi.returnPickedUp(r.id); notify('Marked picked up — ready for inspection.'); await refreshAfter(); }
    catch (e) { notify(e.message || 'Action failed', 'err'); }
  };

  const startInspect = (r) => {
    setInspecting(r.id);
    const sel = {}; r.items?.forEach((i) => { sel[i.id] = 'PASS'; });
    setInspSel(sel); setInspNotes({});
  };
  const submitInspection = async (r) => {
    const items = r.items.map((i) => ({ returnItemId: i.id, result: inspSel[i.id] || 'PASS', notes: inspNotes[i.id] || undefined }));
    try {
      await opsApi.returnInspect(r.id, items);
      notify('Inspection recorded.');
      setInspecting(null); setOpenRet(null); await refreshAfter();
    } catch (e) { notify(e.message || 'Inspection failed', 'err'); }
  };

  const initiateRefund = async (r) => {
    try { await opsApi.refundInitiate(r.id); notify('Refund initiated.'); await refreshAfter(); }
    catch (e) { notify(e.message || 'Action failed', 'err'); }
  };
  const completeRefund = async (r) => {
    if (!confirm('Execute the refund for this return now?')) return;
    try { await opsApi.refundComplete(r.id); notify('Refund completed.'); await refreshAfter(); }
    catch (e) { notify(e.message || 'Action failed', 'err'); }
  };

  const startDispatch = (r) => { setDispatching(r.id); setDispRef(''); };
  const submitDispatch = async (r) => {
    try {
      await opsApi.replacementDispatch(r.id, dispRef.trim() || undefined, undefined);
      notify('Replacement dispatched.'); setDispatching(null); await refreshAfter();
    } catch (e) { notify(e.message || 'Dispatch failed', 'err'); }
  };
  const completeReplacement = async (r) => {
    if (!confirm('Mark the replacement as delivered/completed?')) return;
    try { await opsApi.replacementComplete(r.id); notify('Replacement completed.'); await refreshAfter(); }
    catch (e) { notify(e.message || 'Action failed', 'err'); }
  };

  if (busy && orders.length === 0 && returns.length === 0) return <div className="center">Loading…</div>;

  const activeOrders = orders.filter((o) => NEXT[o.status]);
  const actionableReturns = returns.filter((r) => r.status !== 'COMPLETED' && r.status !== 'REJECTED' && r.status !== 'CANCELLED');

  return (
    <div className="seller-dash">
      <div className="kpis">
        <div className="kpi"><div className="kpi-v">{orders.length}</div><div className="kpi-l">orders in queue</div></div>
        <div className="kpi"><div className="kpi-v warn">{activeOrders.length}</div><div className="kpi-l">advanceable</div></div>
        <div className="kpi"><div className="kpi-v">{returns.length}</div><div className="kpi-l">returns in queue</div></div>
        <div className="kpi"><div className="kpi-v warn">{actionableReturns.length}</div><div className="kpi-l">returns to action</div></div>
      </div>
      {err && <div className="alert">{err}</div>}

      <div className="sub-nav">
        {[['orders', `Orders (${orders.length})`], ['returns', `Returns (${returns.length})`]].map(([id, label]) => (
          <button key={id} className={`seg ${section === id ? 'active' : ''}`} onClick={() => { setSection(id); setErr(''); }}>{label}</button>
        ))}
      </div>

      {section === 'orders' && (
        <div>
          <div className="filters">
            {ORDER_FILTERS.map((s) => (
              <button key={s || 'all'} className={`seg ${ofilter === s ? 'active' : ''}`}
                onClick={() => { setOfilter(s); setOpenOrder(null); setBusy(true); setErr(''); loadOrders(s).finally(() => setBusy(false)); }}>
                {s === '' ? 'All' : OS[s]}
              </button>
            ))}
          </div>
          {busy ? <div className="center">Loading…</div> : orders.length === 0 ? (
            <div className="card empty">No orders in this state.</div>
          ) : (
            <div className="cards">
              {orders.map((o) => (
                <div className="card product" key={o.id}>
                  <div className="product-head" onClick={() => { setTrack(track && track.orderId === o.id ? track : null); setOpenOrder(openOrder === o.id ? null : o.id); }}>
                    <div>
                      <div className="pname">{o.orderNumber} <span className="muted small">· {PAY[o.paymentMethod]} · {PS[o.paymentStatus]}</span></div>
                      <div className="muted small">{o.items?.length} item{o.items?.length === 1 ? '' : 's'} · placed {dt(o.placedAt)} · total {inr(o.price?.grandTotal)}</div>
                    </div>
                    <div className="right">
                      <span className={`badge st-${o.status}`}>{OS[o.status]}</span>
                    </div>
                  </div>
                  {openOrder === o.id && (
                    <div className="detail">
                      <div className="grid2">
                        <div><b>Payment</b> {PAY[o.paymentMethod]} · {PS[o.paymentStatus]}</div>
                        <div><b>Placed</b> {dt(o.placedAt)}</div>
                        <div><b>Grand total</b> {inr(o.price?.grandTotal)}</div>
                        <div><b>Sellers</b> {o.sellerOrders?.length} slice{o.sellerOrders?.length === 1 ? '' : 's'}</div>
                      </div>
                      <ul className="timeline">
                        {(o.items || []).map((i) => (
                          <li key={i.orderItemId}>{i.productName} × {i.quantity} <span className="muted">({i.sellerName})</span> <span className="muted">= {inr(i.lineTotal)}</span></li>
                        ))}
                      </ul>
                      {(o.sellerOrders || []).map((so) => (
                        <div key={so.id} className="muted small">Slice {so.sellerOrderNumber} · {so.sellerName} · <span className={`badge st-${so.status}`}>{so.status}</span></div>
                      ))}
                      <div className="product-actions">
                        <button className="btn ghost sm" onClick={() => loadTrack(o)}>
                          {track && track.orderId === o.id ? (track.loading ? '…' : 'Hide tracking') : 'Track delivery'}
                        </button>
                        <span className="muted small">live courier tracking for this order</span>
                      </div>
                      {track && track.orderId === o.id && !track.loading && track.data && (
                        <TrackPanel legs={track.data.legs} />
                      )}
                      {track && track.orderId === o.id && !track.loading && track.err && <div className="alert">{track.err}</div>}
                      {NEXT[o.status] && (
                        <div className="product-actions">
                          {NEXT[o.status].map((to) => (
                            <button key={to} className="btn primary sm" disabled={advancing === o.id + ':' + to}
                              onClick={() => advance(o, to)}>
                              {advancing === o.id + ':' + to ? '…' : `Advance to ${OS[to]}`}
                            </button>
                          ))}
                          <span className="muted small">prepaid must be PAID · shipment needs accepted slices</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {section === 'returns' && (
        <div>
          <div className="filters">
            {RETURN_FILTERS.map((s) => (
              <button key={s || 'all'} className={`seg ${rfilter === s ? 'active' : ''}`}
                onClick={() => { setRfilter(s); setOpenRet(null); setBusy(true); setErr(''); loadReturns(s).finally(() => setBusy(false)); }}>
                {s === '' ? 'All' : RS[s]}
              </button>
            ))}
          </div>
          {busy ? <div className="center">Loading…</div> : returns.length === 0 ? (
            <div className="card empty">No returns in this state.</div>
          ) : (
            <div className="cards">
              {returns.map((r) => (
                <div className="card product" key={r.id}>
                  <div className="product-head" onClick={() => { setOpenRet(openRet === r.id ? null : r.id); setRejecting(null); setInspecting(null); setDispatching(null); }}>
                    <div>
                      <div className="pname">Return on {r.orderNumber} <span className="muted small">· {RESOLUTION[r.resolution]}</span></div>
                      <div className="muted small">{RCODE[r.reasonCode] || r.reasonCode} · requested {dt(r.requestedAt)}</div>
                    </div>
                    <div className="right"><span className={`badge st-${r.status}`}>{RS[r.status]}</span></div>
                  </div>

                  {openRet === r.id && (
                    <div className="detail">
                      <div className="grid2">
                        <div><b>Status</b> {RS[r.status]}</div>
                        <div><b>Resolution</b> {RESOLUTION[r.resolution]}</div>
                        <div><b>Reason</b> {RCODE[r.reasonCode] || r.reasonCode}{r.reasonNote ? ` — ${r.reasonNote}` : ''}</div>
                        <div><b>Decision note</b> {r.decisionReason || '—'}</div>
                        <div><b>Approved</b> {dt(r.approvedAt)}</div>
                        <div><b>Picked up</b> {dt(r.pickedUpAt)}</div>
                      </div>
                      <ul className="timeline">
                        {(r.items || []).map((i) => (
                          <li key={i.id}>{i.productName} × {i.quantity}
                            {i.inspectionResult ? <span className="chip"> {i.inspectionResult}</span> : <span className="chip">not inspected</span>}
                            {i.refundAmount != null ? <span className="muted"> · refund {inr(i.refundAmount)}</span> : ''}
                          </li>
                        ))}
                      </ul>
                      {r.refund && (
                        <div className="grid2">
                          <div><b>Refund</b> {r.refund.refundReference}</div>
                          <div><b>Amount</b> {inr(r.refund.amount)} · {r.refund.method} · <span className={`badge st-${r.refund.status}`}>{r.refund.status}</span></div>
                        </div>
                      )}
                      {r.replacement && (
                        <div className="grid2">
                          <div><b>Replacement</b> {r.replacement.replacementReference}</div>
                          <div><b>Status</b> <span className={`badge st-${r.replacement.status}`}>{REPL_STATUS[r.replacement.status]}</span>{r.replacement.dispatchReference ? ` · ref ${r.replacement.dispatchReference}` : ''}</div>
                        </div>
                      )}

                      {/* ----- contextual action blocks ----- */}
                      {r.status === 'REQUESTED' && (
                        <div className="product-actions">
                          <button className="btn primary sm" onClick={() => decideReturn(r, true)}>Approve</button>
                          <button className="btn danger sm" onClick={() => decideReturn(r, false)}>Reject</button>
                        </div>
                      )}
                      {rejecting === r.id && (
                        <div className="product-actions">
                          <input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection (required)" style={{ minWidth: 260 }} />
                          <button className="btn danger sm" onClick={submitReject}>Confirm reject</button>
                          <button className="btn ghost sm" onClick={() => setRejecting(null)}>Cancel</button>
                        </div>
                      )}
                      {r.status === 'APPROVED' && (
                        <div className="product-actions"><button className="btn primary sm" onClick={() => pickup(r)}>Schedule pickup</button></div>
                      )}
                      {r.status === 'PICKUP_SCHEDULED' && (
                        <div className="product-actions"><button className="btn primary sm" onClick={() => pickedUp(r)}>Mark picked up</button></div>
                      )}
                      {r.status === 'PICKED_UP' && !inspecting && (
                        <div className="product-actions"><button className="btn primary sm" onClick={() => startInspect(r)}>Record inspection</button></div>
                      )}
                      {inspecting === r.id && (
                        <div className="detail" style={{ borderTop: 'none', paddingTop: 0 }}>
                          <div className="muted small" style={{ marginBottom: 8 }}>Set a result for each returned item, then submit. When every item is inspected the return finalises.</div>
                          {r.items.map((i) => (
                            <div key={i.id} className="row-between" style={{ marginBottom: 8 }}>
                              <span style={{ flex: 1 }}>{i.productName} × {i.quantity}</span>
                              <select value={inspSel[i.id] || 'PASS'} onChange={(e) => setInspSel((s) => ({ ...s, [i.id]: e.target.value }))}>
                                <option value="PASS">PASS</option>
                                <option value="PARTIAL_PASS">PARTIAL_PASS</option>
                                <option value="FAIL">FAIL</option>
                              </select>
                              <input value={inspNotes[i.id] || ''} onChange={(e) => setInspNotes((n) => ({ ...n, [i.id]: e.target.value }))} placeholder="notes (optional)" style={{ flex: 1.2, marginLeft: 8 }} />
                            </div>
                          ))}
                          <div className="product-actions">
                            <button className="btn primary sm" onClick={() => submitInspection(r)}>Submit inspection</button>
                            <button className="btn ghost sm" onClick={() => setInspecting(null)}>Cancel</button>
                          </div>
                        </div>
                      )}
                      {r.status === 'APPROVED_FOR_REFUND' && !r.refund && (
                        <div className="product-actions"><button className="btn primary sm" onClick={() => initiateRefund(r)}>Initiate refund</button></div>
                      )}
                      {r.status === 'APPROVED_FOR_REFUND' && r.refund && r.refund.status === 'PENDING' && (
                        <div className="product-actions"><button className="btn primary sm" onClick={() => completeRefund(r)}>Complete refund</button></div>
                      )}
                      {r.resolution === 'REPLACEMENT' && r.replacement?.status === 'PENDING_DISPATCH' && !dispatching && (
                        <div className="product-actions"><button className="btn primary sm" onClick={() => startDispatch(r)}>Dispatch replacement</button></div>
                      )}
                      {dispatching === r.id && (
                        <div className="product-actions">
                          <input value={dispRef} onChange={(e) => setDispRef(e.target.value)} placeholder="Dispatch reference (optional)" style={{ minWidth: 260 }} />
                          <button className="btn primary sm" onClick={() => submitDispatch(r)}>Confirm dispatch</button>
                          <button className="btn ghost sm" onClick={() => setDispatching(null)}>Cancel</button>
                        </div>
                      )}
                      {r.replacement?.status === 'DISPATCHED' && (
                        <div className="product-actions"><button className="btn primary sm" onClick={() => completeReplacement(r)}>Complete replacement</button></div>
                      )}

                      {['COMPLETED', 'REJECTED', 'CANCELLED'].includes(r.status) && (
                        <div className="muted small">Terminal state — no further action.</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
