import { useEffect, useState } from 'react';
import { platformAnalyticsApi, sellerAnalyticsApi } from '../api.js';

// Session 42 — Analytics dashboard (read-only, live over the transactional OLTP store).
// `mode` picks the surface:
//   'platform' — OPERATOR/ADMIN global business metrics (/analytics).
//   'seller'   — the signed-in SELLER's own slice (/seller/analytics).
// No actions here: every tile is an aggregation the backend computes on request.

const INR = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const isoDay = (d) => d.toISOString().slice(0, 10);
const today = new Date();
const DEF_FROM = isoDay(new Date(Date.now() - 29 * 86400000));
const DEF_TO = isoDay(today);

const ORD_STATUS = {
  PLACED: 'Placed', CONFIRMED: 'Confirmed', PACKED: 'Packed', SHIPPED: 'Shipped',
  OUT_FOR_DELIVERY: 'Out for delivery', DELIVERED: 'Delivered', CANCELLED: 'Cancelled',
  RETURN_REQUESTED: 'Return requested', RETURNED: 'Returned', REFUND_PENDING: 'Refund pending', REFUNDED: 'Refunded',
};

export default function Analytics({ notify, mode = 'platform' }) {
  const api = mode === 'seller' ? sellerAnalyticsApi : platformAnalyticsApi;
  const [section, setSection] = useState('overview');
  const [fromI, setFromI] = useState(DEF_FROM);
  const [toI, setToI] = useState(DEF_TO);
  const [range, setRange] = useState({ from: DEF_FROM, to: DEF_TO });
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState('');
  const [overview, setOverview] = useState(null);
  const [products, setProducts] = useState(null);
  const [categories, setCategories] = useState(null);
  const [sellers, setSellers] = useState(null);

  const windowLabel = overview?.window
    ? `${new Date(overview.window.from).toLocaleDateString()} → ${new Date(overview.window.to).toLocaleDateString()}`
    : `${range.from} → ${range.to}`;

  const load = async (r = range) => {
    setBusy(true); setErr('');
    const w = { from: r?.from || undefined, to: r?.to || undefined };
    try {
      const [ov, pr, cat] = await Promise.all([
        api.overview(w), api.products({ ...w, limit: 10 }), api.categories(w),
      ]);
      setOverview(ov); setProducts(pr); setCategories(cat);
      if (mode !== 'seller') {
        try { setSellers(await api.sellers(w)); } catch { /* optional */ }
      }
    } catch (e) { setErr(e.message || 'Load failed'); notify?.(e.message || 'Load failed', 'bad'); }
    finally { setBusy(false); }
  };
  useEffect(() => { load(range); /* eslint-disable-line */ }, [range, mode]);

  const applyRange = () => {
    const next = { from: fromI, to: toI };
    setRange(next);
  };
  const preset = (days) => {
    const to = isoDay(new Date());
    const f = isoDay(new Date(Date.now() - (days - 1) * 86400000));
    setFromI(f); setToI(to); setRange({ from: f, to: to });
  };

  const kpi = (label, value, cls = '') => (
    <div className="kpi" key={label}><div className={`kpi-v ${cls}`}>{value}</div><div className="kpi-l">{label}</div></div>
  );

  const com = overview?.commerce || {};
  const ord = overview?.orders || {};
  const ret = overview?.returns || {};

  return (
    <div>
      <div className="row-between" style={{ alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>
          {mode === 'seller' ? 'My Performance' : 'Business Analytics'}
          <span className="muted small"> · read-only, derived from live orders/payments · {windowLabel}</span>
        </h2>
      </div>

      <div className="filters" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end', margin: '14px 0' }}>
        <label style={{ flexDirection: 'row', gap: 6 }}>From
          <input type="date" value={fromI} max={toI} onChange={(e) => setFromI(e.target.value)} />
        </label>
        <label style={{ flexDirection: 'row', gap: 6 }}>To
          <input type="date" value={toI} min={fromI} onChange={(e) => setToI(e.target.value)} />
        </label>
        <button className="btn" onClick={applyRange} disabled={busy}>Apply</button>
        <span className="small muted" style={{ alignSelf: 'center' }}>
          <button className="btn ghost small" onClick={() => preset(7)}>7d</button>{' '}
          <button className="btn ghost small" onClick={() => preset(30)}>30d</button>{' '}
          <button className="btn ghost small" onClick={() => preset(90)}>90d</button>
        </span>
      </div>

      {busy && <div className="center muted">Loading analytics…</div>}
      {err && <div className="alert">{err}</div>}
      {!busy && !err && overview && (
        <>
          <div className="sub-nav" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {[['overview', 'Overview'], ['products', 'Top products'], ['categories', 'Categories'], ...(mode !== 'seller' ? [['sellers', 'Seller payouts']] : [])]
              .map(([id, label]) => (
                <button key={id} className={`seg ${section === id ? 'active' : ''}`} onClick={() => setSection(id)}>{label}</button>
              ))}
          </div>

          {section === 'overview' && (
            <>
              <div className="kpis">
                {kpi('GMV', INR(com.gmv), 'accent')}
                {kpi('Orders', ord.total ?? 0)}
                {kpi('Avg order value', INR(com.aov))}
                {kpi('Units sold', com.unitsSold ?? 0)}
                {kpi('Unique buyers', com.uniqueBuyers ?? 0)}
                {kpi('Delivered', ord.delivered ?? 0)}
                {kpi('Cancelled', ord.cancelled ?? 0)}
                {kpi('Returns requested', ret.requested ?? 0)}
                {kpi('Refunded amount', INR(ret.refundedAmount))}
              </div>

              <TrendCard series={overview.series || []} />
              <div className="cards" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                <StatusCard breakdown={ord.statusBreakdown || {}} />
                <ReturnsCard returns={ret} />
              </div>
            </>
          )}

          {section === 'products' && products && (
            <ProductsTable rows={products.rows || []} total={products.totalGmv} />
          )}

          {section === 'categories' && categories && (
            <CategoryBars rows={categories.rows || []} total={categories.rows?.reduce((s, r) => s + (r.gmv || 0), 0) || 0} />
          )}

          {section === 'sellers' && mode !== 'seller' && <SellerPayoutTable rows={sellers?.rows || []} />}
        </>
      )}
    </div>
  );
}

function TrendCard({ series }) {
  if (!series?.length) return null;
  const max = Math.max(1, ...series.map((s) => s.gmv));
  const scale = (gmv) => Math.max(2, Math.round((gmv / max) * 100));
  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="row-between"><b>Daily orders &amp; GMV</b><span className="muted small">{series.length} days</span></div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120, marginTop: 10, overflowX: 'auto' }}>
        {series.map((s) => (
          <div key={s.date} style={{ flex: '0 0 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, justifyContent: 'flex-end' }} title={`${s.date}: ${s.orders} orders, ${INR(s.gmv)}`}>
            <span className="small muted" style={{ fontSize: 9 }}>{s.gmv ? INR(s.gmv).replace('₹', '') : ''}</span>
            <div style={{ height: `${scale(s.gmv)}px`, width: 10, background: s.gmv ? '#b3412a' : '#e8e0d2', borderRadius: 3 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusCard({ breakdown }) {
  const entries = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, c]) => s + c, 0);
  return (
    <div className="card" style={{ flex: '1 1 280px', minWidth: 260 }}>
      <b>Order status breakdown</b>
      <div className="table-wrap" style={{ marginTop: 10 }}>
        <table className="ptable"><thead><tr><th>Status</th><th>Orders</th><th>%</th></tr></thead>
          <tbody>
            {entries.length === 0 && <tr><td colSpan={3} className="muted">No orders in window</td></tr>}
            {entries.map(([s, c]) => (
              <tr key={s}><td>{ORD_STATUS[s] || s}</td><td>{c}</td><td className="muted">{total ? Math.round((c / total) * 100) : 0}%</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReturnsCard({ returns }) {
  return (
    <div className="card" style={{ flex: '1 1 280px', minWidth: 260 }}>
      <b>Returns &amp; refunds</b>
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(2,1fr)', marginTop: 10 }}>
        {kpiTile('Requested', returns.requested ?? 0)}
        {kpiTile('Completed', returns.completed ?? 0)}
        {kpiTile('Rejected', returns.rejected ?? 0)}
        {kpiTile('Replacements', returns.replacements ?? 0)}
      </div>
      <div className="muted small" style={{ marginTop: 8 }}>Refunded amount: <b>{INR(returns.refundedAmount)}</b></div>
    </div>
  );
}
const kpiTile = (label, value) => (
  <div key={label}><div className="kpi-v" style={{ fontSize: 18 }}>{value}</div><div className="kpi-l">{label}</div></div>
);

function ProductsTable({ rows, total }) {
  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="muted">Top products by GMV in the selected window — {rows.length} shown, {INR(total || 0)} combined GMV.</div>
      </div>
      <div className="table-wrap"><table className="ptable"><thead><tr><th>#</th><th>Product</th><th>Units</th><th>GMV</th><th>Share</th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={5} className="muted">No sales in window</td></tr>}
          {rows.map((r, i) => (
            <tr key={r.productId}><td>{i + 1}</td><td><b>{r.productName}</b></td><td>{r.units}</td><td>{INR(r.gmv)}</td>
              <td className="muted">{total ? Math.round((r.gmv / total) * 100) : 0}%</td></tr>
          ))}
        </tbody>
      </table></div>
    </>
  );
}

function CategoryBars({ rows, total }) {
  const max = Math.max(1, ...rows.map((r) => r.gmv));
  return (
    <div className="card">
      <b>GMV by category</b>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
        {rows.length === 0 && <div className="muted">No category sales in window</div>}
        {rows.map((r) => (
          <div key={r.categoryId}>
            <div className="row-between small"><span><b>{r.categoryName}</b> · {r.units} units</span><span>{INR(r.gmv)} · {total ? Math.round((r.gmv / total) * 100) : 0}%</span></div>
            <div style={{ background: '#efe8da', borderRadius: 6, height: 10, marginTop: 3 }}>
              <div style={{ width: `${Math.round((r.gmv / max) * 100)}%`, background: '#b3412a', height: 10, borderRadius: 6 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SellerPayoutTable({ rows }) {
  return (
    <>
      <div className="table-wrap"><table className="ptable"><thead><tr>
        <th>Seller</th><th>Slices</th><th>Goods value</th><th>Commission</th><th>Refunds</th><th>Adjust.</th><th>Net payable</th><th>Net settled</th>
      </tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={8} className="muted">No seller payables earned in window</td></tr>}
          {rows.map((r) => (
            <tr key={r.sellerId}>
              <td><b>{r.sellerName}</b><div className="muted small">{r.sellerCode} · {r.commissionRateBps / 100}%</div></td>
              <td>{r.paidSlices}</td><td>{INR(r.goodsValue)}</td><td>{INR(r.commissionAmount)}</td>
              <td>{INR(r.refundAmount)}</td><td>{INR(r.adjustmentAmount)}</td>
              <td><b>{INR(r.netPayable)}</b></td><td>{INR(r.netSettled)}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      <div className="muted small" style={{ marginTop: 8 }}>From the seller-payable ledger (earned within the selected window). Bilokat-retained tax &amp; delivery are reconciled separately.</div>
    </>
  );
}
