import { useEffect, useState } from 'react';
import { sellerOpsApi, sellerNotificationsApi } from '../api.js';
import NotificationsBell from './NotificationsBell.jsx';

const SO_STATUS = { PLACED: 'Awaiting confirm', ACCEPTED: 'Accepted', REJECTED: 'Rejected', CANCELLED: 'Cancelled' };
const PAY_STATUS = { EARNED: 'Earned', IN_SETTLEMENT: 'In settlement', SETTLED: 'Settled' };
const SETTLE_STATUS = {
  PENDING: 'Pending', APPROVED: 'Approved', PROCESSING: 'Processing', PAID: 'Paid', RECONCILED: 'Reconciled', FAILED: 'Failed',
};
const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dt = (iso) => (iso ? new Date(iso).toLocaleString() : '—');

const ORDER_FILTERS = ['', 'PLACED', 'ACCEPTED', 'REJECTED', 'CANCELLED'];
const PAY_FILTERS = ['', 'EARNED', 'IN_SETTLEMENT', 'SETTLED'];

export default function SellerDashboard({ notify }) {
  const [me, setMe] = useState(null);
  const [section, setSection] = useState('orders');
  const [ofilter, setOfilter] = useState('PLACED');
  const [orders, setOrders] = useState([]);
  const [openOrder, setOpenOrder] = useState(null);
  const [payFilter, setPayFilter] = useState('');
  const [payables, setPayables] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [openSettle, setOpenSettle] = useState(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState('');

  const loadAll = async () => {
    setBusy(true); setErr('');
    try {
      const [m, o, p, s] = await Promise.all([
        sellerOpsApi.me(),
        sellerOpsApi.orders(ofilter),
        sellerOpsApi.payables(),
        sellerOpsApi.settlements(),
      ]);
      setMe(m); setOrders(o?.items ?? o ?? []); setPayables(p?.payables ?? p?.items ?? p ?? []); setSettlements(s?.settlements ?? s?.items ?? s ?? []);
    } catch (e) { setErr(e.message || 'Load failed'); }
    finally { setBusy(false); }
  };
  useEffect(() => { loadAll(); /* eslint-disable-line */ }, []);

  const onOrderFilter = (s) => {
    setOfilter(s); setOpenOrder(null); setBusy(true); setErr('');
    sellerOpsApi.orders(s).then((o) => setOrders(o?.items ?? o ?? [])).catch((e) => setErr(e.message)).finally(() => setBusy(false));
  };

  const act = async (kind, id, reason) => {
    try {
      if (kind === 'accept') await sellerOpsApi.accept(id);
      else await sellerOpsApi.reject(id, reason);
      notify(kind === 'accept' ? 'Slice accepted — it can now be fulfilled & delivered.' : 'Slice rejected.');
      setOpenOrder(null); onOrderFilter(ofilter);
    } catch (e) { notify(e.message || 'Action failed', 'err'); }
  };

  if (!me && busy) return <div className="center">Loading…</div>;

  const pendingCount = orders.filter((o) => o.status === 'PLACED').length;
  const earned = payables.filter((p) => p.status === 'EARNED');
  const netEarned = earned.reduce((a, p) => a + (p.netPayable ?? 0), 0);

  return (
    <div className="seller-dash">
      <NotificationsBell api={sellerNotificationsApi} role="Seller" />
      {me && (
        <div className="kpis">
          <div className="kpi"><div className="kpi-v">{me.sellerCode}</div><div className="kpi-l">{me.displayName}</div></div>
          <div className="kpi"><div className="kpi-v">{payables.length}</div><div className="kpi-l">payables</div></div>
          <div className="kpi"><div className="kpi-v accent">{inr(netEarned)}</div><div className="kpi-l">net earned</div></div>
          <div className="kpi"><div className="kpi-v warn">{pendingCount}</div><div className="kpi-l">slices to confirm</div></div>
        </div>
      )}
      {err && <div className="alert">{err}</div>}

      <div className="sub-nav">
        {[['orders', `Slices (${orders.length})`], ['money', 'Payables & Settlements']].map(([id, label]) => (
          <button key={id} className={`seg ${section === id ? 'active' : ''}`} onClick={() => setSection(id)}>{label}</button>
        ))}
      </div>

      {section === 'orders' && (
        <div>
          <div className="filters">
            {ORDER_FILTERS.map((s) => (
              <button key={s || 'all'} className={`seg ${ofilter === s ? 'active' : ''}`} onClick={() => onOrderFilter(s)}>{s === '' ? 'All' : SO_STATUS[s]}</button>
            ))}
          </div>
          {busy ? <div className="center">Loading…</div> : orders.length === 0 ? (
            <div className="card empty">No seller slices in this state.</div>
          ) : (
            <div className="cards">
              {orders.map((so) => (
                <div className="card product" key={so.id}>
                  <div className="product-head" onClick={() => setOpenOrder(openOrder === so.id ? null : so.id)}>
                    <div>
                      <div className="pname">{so.sellerOrderNumber} <span className="muted small">for order {so.orderNumber}</span></div>
                      <div className="muted small">{so.items?.length} item{so.items?.length === 1 ? '' : 's'} · subtotal {inr(so.subtotal)} · you get {inr(so.sellerAmount)}</div>
                    </div>
                    <div className="right"><span className={`badge st-${so.status}`}>{SO_STATUS[so.status]}</span></div>
                  </div>
                  {openOrder === so.id && (
                    <div className="detail">
                      <div className="grid2">
                        <div><b>Order #</b> {so.orderNumber} ({so.orderStatus})</div>
                        <div><b>Placed</b> {dt(so.orderPlacedAt)}</div>
                        <div><b>Your amount</b> {inr(so.sellerAmount)}</div>
                        <div><b>Status</b> {SO_STATUS[so.status]}{so.rejectionReason ? ` · reason: ${so.rejectionReason}` : ''}</div>
                      </div>
                      {so.items?.length > 0 && (
                        <ul className="timeline">
                          {so.items.map((i) => (
                            <li key={i.orderItemId}>{i.productName} × {i.quantity} <span className="muted">= {inr(i.lineTotal)}</span></li>
                          ))}
                        </ul>
                      )}
                      {so.status === 'PLACED' && (
                        <div className="decision-row">
                          <div className="decision-col">
                            <button className="btn primary sm" onClick={() => act('accept', so.id)}>Accept slice</button>
                          </div>
                          <div className="decision-col">
                            <label>Reject (reason required)
                              <input id={'rej-' + so.id} placeholder="e.g. cannot fulfil" />
                            </label>
                            <button className="btn danger sm" onClick={() => {
                              const v = document.getElementById('rej-' + so.id).value.trim();
                              if (!v) return notify('A reason is required to reject', 'err');
                              act('reject', so.id, v);
                            }}>Reject slice</button>
                          </div>
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

      {section === 'money' && (
        <div>
          <h4>Payables</h4>
          <div className="filters">
            {PAY_FILTERS.map((s) => (
              <button key={s || 'all'} className={`seg ${payFilter === s ? 'active' : ''}`} onClick={() => { setPayFilter(s); }}>{s === '' ? 'All' : PAY_STATUS[s]}</button>
            ))}
          </div>
          <PayablesTable rows={payables.filter((p) => !payFilter || p.status === payFilter)} />

          <h4>Settlements</h4>
          {settlements.length === 0 ? (
            <div className="card empty">No settlements yet — settlements are created by Bilokat finance once payables are due.</div>
          ) : (
            <div className="cards">
              {settlements.map((s) => (
                <div className="card product" key={s.id}>
                  <div className="product-head" onClick={() => setOpenSettle(openSettle === s.id ? null : s.id)}>
                    <div>
                      <div className="pname">{s.settlementReference}</div>
                      <div className="muted small">{s.items?.length} payable(s)</div>
                    </div>
                    <div className="right"><span className={`badge st-${s.status}`}>{SETTLE_STATUS[s.status]}</span><span>{inr(s.netPayable)}</span></div>
                  </div>
                  {openSettle === s.id && (
                    <div className="detail">
                      <div className="grid2">
                        <div><b>Gross</b> {inr(s.grossAmount)}</div>
                        <div><b>Commission</b> {inr(s.commissionAmount)}</div>
                        <div><b>Refunds</b> {inr(s.refundAmount)}</div>
                        <div><b>Net payable</b> {inr(s.netPayable)}</div>
                      </div>
                      {s.events?.length > 0 && (
                        <ul className="timeline">{s.events.map((e, i) => (
                          <li key={i}>{e.eventType} <span className="muted">· {dt(e.createdAt)}</span></li>
                        ))}</ul>
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

function PayablesTable({ rows }) {
  if (rows.length === 0) return <div className="card empty">No payables in this state.</div>;
  return (
    <div className="table-wrap">
      <table className="ptable">
        <thead><tr><th>Order</th><th>Slice</th><th>Goods</th><th>Commission</th><th>Refund</th><th>Net</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td>{p.orderNumber}</td>
              <td className="muted">{p.sellerOrderNumber}</td>
              <td>{inr(p.goodsValue)}</td>
              <td>{inr(p.commissionAmount)}</td>
              <td>{inr(p.refundAmount)}</td>
              <td><b>{inr(p.netPayable)}</b></td>
              <td><span className={`badge st-${p.status}`}>{PAY_STATUS[p.status] || p.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
