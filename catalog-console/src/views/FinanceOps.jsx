import { useEffect, useMemo, useState } from 'react';
import { financeApi, payoutApi } from '../api.js';

// Session 34 — back-office Finance console (OPERATOR/ADMIN).
// Unifies courier-payout settlement (Session 32 /delivery/payouts) and the seller
// ledger (Sessions 12/13 /finance) in one screen. Backend routes already enforce RBAC.
// Session 37 — period (From/To) date filter scopes every list + summary KPI to the
// earned/created window: courier payouts & courier summary by earnedAt, seller
// payables by earnedAt, settlements by createdAt, and the overview report totals
// by earnedAt. Additive read filter — no money-model change.

const PAY_STATUS = { EARNED: 'Earned', IN_SETTLEMENT: 'In settlement', SETTLED: 'Settled' };
const SETTLE_STATUS = {
  PENDING: 'Pending', APPROVED: 'Approved', PROCESSING: 'Processing',
  PAID: 'Paid', RECONCILED: 'Reconciled', FAILED: 'Failed',
};
const COURIER_STATUS = { EARNED: 'Pending', SETTLED: 'Paid', CANCELLED: 'Cancelled' };
const KIND_LABEL = { parcel: 'Parcel', replacement: 'Replacement' };
// Legal next states per settlement status (mirrors SETTLEMENT_NEXT in the backend).
const SETTLE_NEXT = {
  PENDING: ['APPROVED'],
  APPROVED: ['PROCESSING'],
  PROCESSING: ['PAID', 'FAILED'],
  PAID: ['RECONCILED'],
  RECONCILED: [],
  FAILED: ['PROCESSING'],
};
const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dt = (iso) => (iso ? new Date(iso).toLocaleString() : '—');

const PAY_FILTERS = ['', 'EARNED', 'IN_SETTLEMENT', 'SETTLED'];
const COURIER_FILTERS = ['', 'EARNED', 'SETTLED', 'CANCELLED'];

export default function FinanceOps({ notify }) {
  const [section, setSection] = useState('overview');
  // overview
  const [rec, setRec] = useState(null);
  const [report, setReport] = useState(null);
  // courier payouts
  const [cSummary, setCSummary] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [pFilter, setPFilter] = useState('');
  // payables
  const [payFilter, setPayFilter] = useState('');
  const [payables, setPayables] = useState([]);
  const [openPay, setOpenPay] = useState(null);
  // settlements
  const [settlements, setSettlements] = useState([]);
  const [openSt, setOpenSt] = useState(null);
  const [earned, setEarned] = useState([]); // EARNED payables for creating a settlement
  // Session 37 — period range. `range` is the APPLIED (submitted) window; the date
  // inputs are held separately and only take effect on "Apply", so queries stay stable
  // while typing. {from,to} undefined means "all time".
  const [range, setRange] = useState({});
  const [fromInput, setFromInput] = useState('');
  const [toInput, setToInput] = useState('');
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState('');

  const load = async (r = range) => {
    const w = { from: r?.from || undefined, to: r?.to || undefined };
    setBusy(true); setErr('');
    try {
      const [rpt, cs, pay, st, ea] = await Promise.all([
        financeApi.report(w),
        payoutApi.summary(w),
        financeApi.payables({ ...w, status: payFilter || undefined, limit: 100 }),
        financeApi.settlements({ ...w, limit: 100 }),
        financeApi.payables({ ...w, status: 'EARNED', limit: 100 }),
      ]);
      setReport(rpt); setCSummary(cs);
      setPayables(pay?.payables ?? []); setSettlements(st?.settlements ?? []);
      setEarned(ea?.payables ?? []);
    } catch (e) { setErr(e.message || 'Load failed'); }
    finally { setBusy(false); }
  };
  // Reconciliation is time-independent (scans the whole delivered ledger), so it is
  // fetched once on mount rather than scoped by the period.
  useEffect(() => {
    financeApi.reconciliation().then(setRec).catch(() => {});
    load(range); // eslint-disable-line
  }, [range]);

  const loadPayouts = async (status, r = range) => {
    try {
      const res = await payoutApi.all({ status: status || undefined, from: r?.from || undefined, to: r?.to || undefined, limit: 100 });
      setPayouts(res?.payouts ?? []);
    } catch (e) { setErr(e.message || 'Load failed'); }
  };
  useEffect(() => { if (section === 'courier') loadPayouts(pFilter, range); /* eslint-disable-line */ }, [section, pFilter, range]);

  const settleCourier = async (partnerId, name) => {
    if (!window.confirm(`Pay out all pending courier fees for ${name}?`)) return;
    try {
      const r = await payoutApi.settle(partnerId);
      notify(`Settled ${r.settled} courier payout(s) · ${inr(r.totalAmount)}`);
      const s = await payoutApi.summary(range); setCSummary(s);
      loadPayouts(pFilter, range);
    } catch (e) { notify(e.message || 'Settle failed', 'err'); }
  };

  const adjust = async (payableId, amount, reason) => {
    try { await financeApi.adjust(payableId, Number(amount), reason); notify('Adjustment recorded'); }
    catch (e) { notify(e.message || 'Adjustment failed', 'err'); return false; }
    const d = await financeApi.payable(payableId); setOpenPay(d);
    load();
    return true;
  };

  const advance = async (id, toStatus, reason) => {
    try {
      if (toStatus === 'FAILED' && !reason?.trim()) { notify('A reason is required to mark a settlement FAILED', 'err'); return; }
      await financeApi.advance(id, toStatus, reason || undefined);
      notify(`Settlement moved to ${SETTLE_STATUS[toStatus]}`);
      load();
    } catch (e) { notify(e.message || 'Advance failed', 'err'); }
  };

  const applyPeriod = () => {
    const next = { from: fromInput || undefined, to: toInput || undefined };
    setRange(next);           // triggers the [range] effects to refetch
    if (section === 'courier') loadPayouts(pFilter, next);
  };
  const clearPeriod = () => { setFromInput(''); setToInput(''); setRange({}); };
  const ranged = !!(range.from || range.to);

  if (!report && busy && !ranged) return <div className="center">Loading…</div>;

  return (
    <div>
      <div className="sub-nav">
        {[
          ['overview', 'Overview & Reconciliation'],
          ['courier', `Courier Payouts${cSummary ? ` (${inr(cSummary.pendingAmount)} pending)` : ''}`],
          ['payables', `Seller Payables (${payables.length})`],
          ['settlements', `Seller Settlements (${settlements.length})`],
        ].map(([id, label]) => (
          <button key={id} className={`seg ${section === id ? 'active' : ''}`} onClick={() => setSection(id)}>{label}</button>
        ))}
      </div>
      {err && <div className="alert">{err}</div>}

      <PeriodBar from={fromInput} to={toInput} setFrom={setFromInput} setTo={setToInput}
        apply={applyPeriod} clear={clearPeriod} active={ranged} />

      {section === 'overview' && <Overview rec={rec} report={report} ranged={ranged} />}
      {section === 'courier' && (
        <CourierSection summary={cSummary} payouts={payouts} filter={pFilter} setFilter={setPFilter}
          onSettle={settleCourier} load={loadPayouts} />
      )}
      {section === 'payables' && (
        <PayablesSection filter={payFilter} setFilter={setPayFilter} payables={payables}
          open={openPay} setOpen={setOpenPay} onAdjust={adjust} reload={load} />
      )}
      {section === 'settlements' && (
        <SettlementsSection settlements={settlements} earned={earned} open={openSt}
          setOpen={setOpenSt} onAdvance={advance} reload={load} notify={notify} />
      )}
    </div>
  );
}

function PeriodBar({ from, to, setFrom, setTo, apply, clear, active }) {
  return (
    <div className="card filters" style={{ marginBottom: 12, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <label className="small">From (earned/created on or after)
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
      </label>
      <label className="small">To (inclusive)
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn primary sm" onClick={apply}>Apply period</button>
        {active && <button className="btn sm" onClick={clear}>Clear (all time)</button>}
      </div>
      {active && <span className="muted small">Scoping every list &amp; KPI to {from || 'start'} → {to || 'now'}</span>}
    </div>
  );
}

function Overview({ rec, report, ranged }) {
  const t = report?.totals;
  return (
    <div>
      <div className="kpis">
        <div className="kpi"><div className={`kpi-v ${rec?.ok ? 'accent' : 'warn'}`}>{rec?.ok ? 'OK' : `${rec?.discrepancyCount} disc.`}</div><div className="kpi-l">reconciliation</div></div>
        <div className="kpi"><div className="kpi-v">{rec?.checked?.deliveredOrders ?? 0}</div><div className="kpi-l">delivered orders checked</div></div>
        <div className="kpi"><div className="kpi-v">{t?.payables ?? 0}</div><div className="kpi-l">seller payables {ranged ? '(period)' : '(all time)'}</div></div>
        <div className="kpi"><div className="kpi-v accent">{inr(t?.netPayable)}</div><div className="kpi-l">net payable {ranged ? '(period)' : '(all time)'}</div></div>
      </div>

      {rec?.discrepancies?.length > 0 && (
        <div className="card">
          <h4>Discrepancies</h4>
          <ul className="timeline">
            {rec.discrepancies.map((d, i) => (
              <li key={i}><b>{d.kind}</b> — {d.detail}</li>
            ))}
          </ul>
        </div>
      )}

      <h4>Per-seller finance report (net earned / commission / refunds)</h4>
      {!report?.perSeller?.length ? <div className="card empty">No seller payables yet.</div> : (
        <div className="table-wrap">
          <table className="ptable">
            <thead><tr><th>Seller</th><th>Payables</th><th>Goods</th><th>Commission</th><th>Refunds</th><th>Adjustments</th><th>Net payable</th></tr></thead>
            <tbody>
              {report.perSeller.map((s) => (
                <tr key={s.sellerId}>
                  <td>{s.sellerName} <span className="muted">({s.sellerCode})</span></td>
                  <td>{s.payables}</td>
                  <td>{inr(s.goodsValue)}</td>
                  <td>{inr(s.commissionAmount)}</td>
                  <td>{inr(s.refundAmount)}</td>
                  <td>{inr(s.adjustmentAmount)}</td>
                  <td><b>{inr(s.netPayable)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CourierSection({ summary, payouts, filter, setFilter, onSettle }) {
  return (
    <div>
      <div className="kpis">
        <div className="kpi"><div className="kpi-v warn">{inr(summary?.pendingAmount)}</div><div className="kpi-l">pending courier fees</div></div>
        <div className="kpi"><div className="kpi-v accent">{inr(summary?.paidAmount)}</div><div className="kpi-l">paid out</div></div>
        <div className="kpi"><div className="kpi-v">{summary?.partners?.length ?? 0}</div><div className="kpi-l">partners with pending fees</div></div>
      </div>

      <h4>Pay out a partner's pending courier fees</h4>
      {!summary?.partners?.length ? <div className="card empty">No pending courier fees to settle.</div> : (
        <div className="cards">
          {summary.partners.map((p) => (
            <div className="card product" key={p.deliveryPartnerId}>
              <div className="product-head">
                <div>
                  <div className="pname">{p.name} <span className="muted small">({p.partnerCode})</span></div>
                  <div className="muted small">{p.pendingCount} pending · {inr(p.pendingAmount)}</div>
                </div>
                <div className="right">
                  <span className="badge st-EARNED">{p.pendingCount} pending</span>
                  <button className="btn primary sm" onClick={() => onSettle(p.deliveryPartnerId, p.name || p.partnerCode)}>Settle {inr(p.pendingAmount)}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <h4>Courier payout ledger</h4>
      <div className="filters">
        {COURIER_FILTERS.map((s) => (
          <button key={s || 'all'} className={`seg ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>{s === '' ? 'All' : COURIER_STATUS[s]}</button>
        ))}
      </div>
      {payouts.length === 0 ? <div className="card empty">No courier payouts in this state.</div> : (
        <div className="table-wrap">
          <table className="ptable">
            <thead><tr><th>Partner</th><th>Kind</th><th>Fee</th><th>Earned</th><th>Status</th></tr></thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id}>
                  <td>{p.partnerName} <span className="muted">({p.partnerCode})</span></td>
                  <td>{KIND_LABEL[p.kind] || p.kind}</td>
                  <td><b>{inr(p.feeAmount)}</b></td>
                  <td>{dt(p.earnedAt)}</td>
                  <td><span className={`badge st-${p.status}`}>{COURIER_STATUS[p.status] || p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PayablesSection({ filter, setFilter, payables, open, setOpen, onAdjust, reload }) {
  return (
    <div>
      <div className="filters">
        {PAY_FILTERS.map((s) => (
          <button key={s || 'all'} className={`seg ${filter === s ? 'active' : ''}`} onClick={() => { setFilter(s); reload(); }}>{s === '' ? 'All' : PAY_STATUS[s]}</button>
        ))}
      </div>
      {payables.length === 0 ? <div className="card empty">No seller payables in this state.</div> : (
        <div className="cards">
          {payables.map((p) => (
            <div className="card product" key={p.id}>
              <div className="product-head" onClick={() => setOpen(open?.id === p.id ? null : p)}>
                <div>
                  <div className="pname">{p.sellerName} <span className="muted small">({p.sellerCode})</span></div>
                  <div className="muted small">order {p.orderNumber} · {p.sellerOrderNumber} · earned {dt(p.earnedAt)}</div>
                </div>
                <div className="right"><span className={`badge st-${p.status}`}>{PAY_STATUS[p.status] || p.status}</span><b>{inr(p.netPayable)}</b></div>
              </div>
              {open?.id === p.id && (
                <div className="detail">
                  <div className="grid2">
                    <div><b>Gross</b> {inr(p.grossAmount)}</div>
                    <div><b>Goods</b> {inr(p.goodsValue)}</div>
                    <div><b>Commission</b> {inr(p.commissionAmount)} ({p.commissionRateBps} bps)</div>
                    <div><b>Refund</b> {inr(p.refundAmount)}</div>
                    <div><b>Adjustments</b> {inr(p.adjustmentAmount)}</div>
                    <div><b>Net payable</b> {inr(p.netPayable)}</div>
                  </div>
                  {open.adjustments?.length > 0 && (
                    <>
                      <h4>Adjustment ledger</h4>
                      <ul className="timeline">{open.adjustments.map((a, i) => (
                        <li key={i}>{a.actorType} {inr(a.amount)} — {a.reason} <span className="muted">· {dt(a.createdAt)}</span></li>
                      ))}</ul>
                    </>
                  )}
                  {p.status === 'EARNED' && (
                    <AdjustForm payable={p} onAdjust={onAdjust} />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdjustForm({ payable, onAdjust }) {
  const [amt, setAmt] = useState('');
  const [reason, setReason] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    const n = Number(amt);
    if (!reason.trim()) return alert('A reason is required');
    if (!Number.isFinite(n) || n === 0) return alert('Amount must be a non-zero number (use - for a debit)');
    const ok = await onAdjust(payable.id, n, reason);
    if (ok) { setAmt(''); setReason(''); }
  };
  return (
    <form className="decision-row" onSubmit={submit}>
      <div className="decision-col"><label>Amount (₹; negative debits)
        <input value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="e.g. -50" />
      </label></div>
      <div className="decision-col"><label>Reason
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="why?" />
      </label>
        <button className="btn primary sm" type="submit">Record adjustment</button>
      </div>
    </form>
  );
}

function SettlementsSection({ settlements, earned, open, setOpen, onAdvance, reload }) {
  const bySeller = useMemo(() => {
    const m = new Map();
    for (const p of earned) {
      if (!m.has(p.sellerId)) m.set(p.sellerId, { sellerId: p.sellerId, sellerName: p.sellerName, sellerCode: p.sellerCode, payables: [] });
      m.get(p.sellerId).payables.push(p);
    }
    return [...m.values()].map((s) => ({ ...s, total: s.payables.reduce((a, p) => a + p.netPayable, 0) }));
  }, [earned]);

  return (
    <div>
      <h4>Create a new settlement</h4>
      <CreateSettlement bySeller={bySeller} reload={reload} />

      <h4>Settlement ledger</h4>
      {settlements.length === 0 ? <div className="card empty">No settlements yet.</div> : (
        <div className="cards">
          {settlements.map((s) => (
            <div className="card product" key={s.id}>
              <div className="product-head" onClick={() => setOpen(open === s.id ? null : s.id)}>
                <div>
                  <div className="pname">{s.settlementReference}</div>
                  <div className="muted small">{s.sellerName} ({s.sellerCode}) · {s.itemCount} payable(s)</div>
                </div>
                <div className="right"><span className={`badge st-${s.status}`}>{SETTLE_STATUS[s.status]}</span><b>{inr(s.netPayable)}</b></div>
              </div>
              {open === s.id && (
                <div className="detail">
                  <div className="grid2">
                    <div><b>Gross</b> {inr(s.grossAmount)}</div>
                    <div><b>Commission</b> {inr(s.commissionAmount)}</div>
                    <div><b>Refunds</b> {inr(s.refundAmount)}</div>
                    <div><b>Net payable</b> {inr(s.netPayable)}</div>
                    {s.approvedAt && <div><b>Approved</b> {dt(s.approvedAt)}</div>}
                    {s.paidAt && <div><b>Paid</b> {dt(s.paidAt)}</div>}
                    {s.failedReason && <div><b>Failure</b> {s.failedReason}</div>}
                  </div>
                  {s.events?.length > 0 && (
                    <ul className="timeline">{s.events.map((e, i) => (
                      <li key={i}><b>{e.eventType}</b> — {e.reason} <span className="muted">· {dt(e.createdAt)}</span></li>
                    ))}</ul>
                  )}
                  {(SETTLE_NEXT[s.status] || []).length > 0 && (
                    <div className="decision-row" style={{ gridTemplateColumns: '1fr' }}>
                      <div className="decision-col">
                        <label>Advance to
                          <select id={'adv-' + s.id} defaultValue={SETTLE_NEXT[s.status][0]}>
                            {(SETTLE_NEXT[s.status] || []).map((t) => (
                              <option key={t} value={t}>{SETTLE_STATUS[t]}</option>
                            ))}
                          </select>
                        </label>
                        <label>Reason (required for FAILED)
                          <input id={'rs-' + s.id} placeholder="optional" />
                        </label>
                        <button className="btn primary sm" onClick={() => {
                          const to = document.getElementById('adv-' + s.id).value;
                          const rs = document.getElementById('rs-' + s.id).value.trim();
                          onAdvance(s.id, to, rs);
                        }}>Advance</button>
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
  );
}

function CreateSettlement({ bySeller, reload }) {
  const [sellerId, setSellerId] = useState('');
  const [sel, setSel] = useState({});
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState(null);
  const [tone, setTone] = useState('ok');
  const chosen = bySeller.find((s) => s.sellerId === sellerId);

  if (bySeller.length === 0) return <div className="card empty">No EARNED payables available to settle.</div>;

  return (
    <div className="card">
      {msg && <div className={`alert ${tone === 'err' ? 'alert-err' : ''}`}>{msg}</div>}
      <div className="grid2">
        <label>Seller with EARNED payables
          <select value={sellerId} onChange={(e) => { setSellerId(e.target.value); setSel({}); }}>
            <option value="">Select…</option>
            {bySeller.map((s) => (
              <option key={s.sellerId} value={s.sellerId}>{s.sellerName} ({s.sellerCode}) — {inr(s.total)}</option>
            ))}
          </select>
        </label>
        <label>Reason
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="optional" />
        </label>
      </div>
      {chosen && (
        <div className="grid2">
          {chosen.payables.map((p) => (
            <label key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={!!sel[p.id]}
                onChange={(e) => setSel((s) => ({ ...s, [p.id]: e.target.checked }))} />
              order {p.orderNumber} · {p.sellerOrderNumber} — {inr(p.netPayable)}
            </label>
          ))}
        </div>
      )}
      <button className="btn primary" disabled={!sellerId}
        onClick={async () => {
          const ids = Object.keys(sel).filter((k) => sel[k]);
          if (ids.length === 0) { setMsg('Select at least one earned payable'); setTone('err'); return; }
          try {
            const r = await financeApi.createSettlement(sellerId, ids, reason || undefined);
            setMsg(`Created ${r.settlementReference} · ${inr(r.netPayable)}`); setTone('ok');
            setSel({}); setReason(''); reload();
          } catch (e) { setMsg(e.message || 'Create failed'); setTone('err'); }
        }}>Create settlement</button>
    </div>
  );
}
