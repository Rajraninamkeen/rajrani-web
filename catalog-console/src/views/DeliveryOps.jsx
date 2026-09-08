import { useEffect, useState } from 'react';
import { deliveryOpsApi, payoutApi } from '../api.js';

// Session 35 — back-office DELIVERY-partner management console (OPERATOR/ADMIN).
// Register partners (from DELIVERY-role candidates), toggle ACTIVE/SUSPENDED, and
// inspect each partner's assignments + courier payout ledger over the existing
// /delivery routes (Sessions 15/30/32). Backend already enforces RBAC.

const PARTNER_STATUS = { ACTIVE: 'Active', SUSPENDED: 'Suspended', REGISTERED: 'Registered', INACTIVE: 'Inactive' };
const ASSIGN_STATUS = {
  ASSIGNED: 'Assigned', ACCEPTED: 'Accepted', PICKED_UP: 'Picked up', OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered', REJECTED: 'Rejected', FAILED: 'Failed', CANCELLED: 'Cancelled',
};
const PAY_STATUS = { EARNED: 'Pending', SETTLED: 'Paid', CANCELLED: 'Cancelled' };
const ASSIGN_FILTERS = Object.keys(ASSIGN_STATUS);

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dt = (iso) => (iso ? new Date(iso).toLocaleString() : '—');

export default function DeliveryOps({ notify }) {
  const [section, setSection] = useState('partners');
  const [partners, setPartners] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState('');

  // assignments
  const [assignments, setAssignments] = useState([]);
  const [aTotal, setATotal] = useState(0);
  const [aStatus, setAStatus] = useState('');
  const [aPartner, setAPartner] = useState('');
  const [openAssign, setOpenAssign] = useState(null);

  // payouts
  const [pSum, setPSum] = useState(null);
  const [payouts, setPayouts] = useState([]);

  const loadPartners = async () => {
    try {
      const [p, c] = await Promise.all([deliveryOpsApi.partners(), deliveryOpsApi.partnerCandidates()]);
      setPartners(p ?? []); setCandidates(c ?? []);
    } catch (e) { setErr(e.message || 'Load failed'); }
  };

  useEffect(() => {
    (async () => {
      setBusy(true); setErr('');
      try {
        await loadPartners();
        const s = await payoutApi.summary(); setPSum(s);
        const l = await deliveryOpsApi.payoutsAll({ limit: 200 }); setPayouts(l?.payouts ?? []);
      } catch (e) { setErr(e.message || 'Load failed'); }
      finally { setBusy(false); }
    })();
    /* eslint-disable-line */
  }, []);

  const loadAssignments = async () => {
    try {
      // NB: /delivery/assignments does not coerce integer query params, so page/limit
      // are omitted and the server default (page 1 / limit 20) applies.
      const r = await deliveryOpsApi.assignments({
        status: aStatus || undefined, deliveryPartnerId: aPartner || undefined,
      });
      setAssignments(r?.assignments ?? []); setATotal(r?.total ?? 0);
    } catch (e) { setErr(e.message || 'Load failed'); }
  };
  useEffect(() => { if (section === 'assignments') loadAssignments(); /* eslint-disable-line */ }, [section, aStatus, aPartner]);

  const setPartnerStatus = async (p, status) => {
    if (!window.confirm(`Set ${p.partnerCode} to ${PARTNER_STATUS[status]}?`)) return;
    try {
      await deliveryOpsApi.partnerStatus(p.id, status);
      notify(`${p.partnerCode} → ${PARTNER_STATUS[status]}`);
      loadPartners();
    } catch (e) { notify(e.message || 'Status update failed', 'err'); }
  };

  const register = async ({ userId, partnerCode, vehicleType }) => {
    try {
      const p = await deliveryOpsApi.registerPartner(userId, partnerCode || undefined, vehicleType || undefined);
      notify(`Registered ${p.partnerCode}`);
      loadPartners();
      return p;
    } catch (e) { notify(e.message || 'Register failed', 'err'); return null; }
  };

  const openAssignment = async (a) => {
    if (openAssign?.id === a.id) { setOpenAssign(null); return; }
    try { const d = await deliveryOpsApi.assignment(a.id); setOpenAssign(d); }
    catch (e) { notify(e.message || 'Load assignment failed', 'err'); }
  };

  const viewPartnerAssignments = (pid) => { setAPartner(pid); setSection('assignments'); };

  if (busy && partners.length === 0) return <div className="center">Loading…</div>;

  return (
    <div>
      <div className="sub-nav">
        {[
          ['partners', `Partners (${partners.length})`],
          ['assignments', `Assignments (${aTotal})`],
          ['payouts', `Courier Payouts${pSum && pSum.pendingAmount ? ` (${inr(pSum.pendingAmount)} pending)` : ''}`],
        ].map(([id, label]) => (
          <button key={id} className={`seg ${section === id ? 'active' : ''}`} onClick={() => setSection(id)}>{label}</button>
        ))}
      </div>
      {err && <div className="alert">{err}</div>}

      {section === 'partners' && (
        <PartnersSection partners={partners} candidates={candidates} onRegister={register}
          onSetStatus={setPartnerStatus} onView={viewPartnerAssignments} />
      )}
      {section === 'assignments' && (
        <AssignmentsSection partners={partners} assignments={assignments} total={aTotal}
          status={aStatus} setStatus={setAStatus} partner={aPartner} setPartner={setAPartner}
          open={openAssign} onOpen={openAssignment} />
      )}
      {section === 'payouts' && <PayoutsSection summary={pSum} payouts={payouts} partners={partners} onPartner={setAPartner} gotoAssign={() => setSection('assignments')} />}
    </div>
  );
}

function PartnersSection({ partners, candidates, onRegister, onSetStatus, onView }) {
  return (
    <div>
      <RegisterForm candidates={candidates} onRegister={onRegister} />
      <h4>Registered delivery partners</h4>
      {partners.length === 0 ? <div className="card empty">No delivery partners yet.</div> : (
        <div className="cards">
          {partners.map((p) => (
            <div className="card product" key={p.id}>
              <div className="product-head">
                <div>
                  <div className="pname">{p.user?.fullName || p.partnerCode} <span className="muted small">({p.partnerCode})</span></div>
                  <div className="muted small">{p.user?.email} · {p.vehicleType || 'vehicle not set'}</div>
                </div>
                <div className="right">
                  <span className={`badge st-${p.status}`}>{PARTNER_STATUS[p.status] || p.status}</span>
                  <button className="btn ghost sm" onClick={() => onView(p.id)}>Assignments</button>
                  {p.status === 'ACTIVE'
                    ? <button className="btn warn sm" onClick={() => onSetStatus(p, 'SUSPENDED')}>Suspend</button>
                    : <button className="btn primary sm" onClick={() => onSetStatus(p, 'ACTIVE')}>Activate</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RegisterForm({ candidates, onRegister }) {
  const [userId, setUserId] = useState('');
  const [code, setCode] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [msg, setMsg] = useState(null);
  const [tone, setTone] = useState('ok');
  if (candidates.length === 0) {
    return (
      <div className="card">
        <h4>Register a delivery partner</h4>
        <div className="muted">No un-partnered DELIVERY-role users are available to onboard right now. Invite a DELIVERY-role account first.</div>
      </div>
    );
  }
  return (
    <div className="card">
      <h4>Register a delivery partner</h4>
      {msg && <div className={`alert ${tone === 'err' ? 'alert-err' : ''}`}>{msg}</div>}
      <div className="grid2">
        <label>Candidate (DELIVERY-role user)
          <select value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">Select…</option>
            {candidates.map((c) => (
              <option key={c.userId} value={c.userId}>{c.fullName || c.email} ({c.email})</option>
            ))}
          </select>
        </label>
        <label>Partner code (optional)
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="auto DLV-xxxx" />
        </label>
        <label>Vehicle type (optional)
          <input value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="e.g. motorcycle" />
        </label>
      </div>
      <button className="btn primary" disabled={!userId} onClick={async () => {
        const p = await onRegister({ userId, partnerCode: code.trim(), vehicleType: vehicle.trim() });
        if (p) { setMsg(`Registered ${p.partnerCode} as ${PARTNER_STATUS[p.status] || ''}`); setTone('ok'); setUserId(''); setCode(''); setVehicle(''); }
        else { setMsg('Registration failed'); setTone('err'); }
      }}>Register partner</button>
    </div>
  );
}

function AssignmentsSection({ partners, assignments, total, status, setStatus, partner, setPartner, open, onOpen }) {
  return (
    <div>
      <div className="filters">
        <select value={partner} onChange={(e) => setPartner(e.target.value)} style={{ borderRadius: 999, border: '1px solid var(--line)', background: 'var(--panel)', padding: '6px 12px', fontWeight: 600 }}>
          <option value="">All partners</option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>{p.user?.fullName || p.partnerCode} ({p.partnerCode})</option>
          ))}
        </select>
        <button className={`seg ${status === '' ? 'active' : ''}`} onClick={() => setStatus('')}>All</button>
        {ASSIGN_FILTERS.map((s) => (
          <button key={s} className={`seg ${status === s ? 'active' : ''}`} onClick={() => setStatus(s)}>{ASSIGN_STATUS[s]}</button>
        ))}
      </div>
      <div className="muted small">Showing {assignments.length} of {total} assignment(s).</div>
      {assignments.length === 0 ? <div className="card empty">No assignments match these filters.</div> : (
        <div className="cards">
          {assignments.map((a) => (
            <div className="card product" key={a.id}>
              <div className="product-head" onClick={() => onOpen(a)}>
                <div>
                  <div className="pname">{a.assignmentNumber}</div>
                  <div className="muted small">slice {a.sellerOrder?.sellerOrderNumber} · {a.deliveryPartner?.name || (partner ? partners.find((p) => p.id === partner)?.user?.fullName || '—' : '—')}</div>
                </div>
                <div className="right">
                  <span className={`badge st-${a.status}`}>{ASSIGN_STATUS[a.status] || a.status}</span>
                  <span className="muted small">{dt(a.assignedAt)}</span>
                </div>
              </div>
              {open?.id === a.id && <AssignmentDetail a={open} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AssignmentDetail({ a }) {
  return (
    <div className="detail">
      <div className="grid2">
        <div><b>Order ref</b> {a.orderId}</div>
        <div><b>Slice</b> {a.sellerOrder?.sellerOrderNumber} ({a.sellerOrder?.status})</div>
        <div><b>Partner</b> {a.deliveryPartner?.name || '—'} <span className="muted">({a.deliveryPartner?.partnerCode || '—'})</span></div>
        <div><b>Carrier</b> {a.carrier || 'internal'} {a.trackingNumber ? `· ${a.trackingNumber}` : ''}</div>
        <div><b>Assigned</b> {dt(a.assignedAt)}</div>
        <div><b>Accepted</b> {dt(a.acceptedAt)}</div>
        {a.pickedUpAt && <div><b>Picked up</b> {dt(a.pickedUpAt)}</div>}
        {a.deliveredAt && <div><b>Delivered</b> {dt(a.deliveredAt)}</div>}
        {a.podSignedBy && <div><b>POD</b> {a.podSignedBy} @ {dt(a.podAt)}</div>}
        {a.failureReason && <div><b>Failure</b> {a.failureReason}</div>}
      </div>
      {a.events?.length > 0 && (
        <>
          <h4>Assignment events</h4>
          <ul className="timeline">{a.events.map((e, i) => (
            <li key={i}><b>{e.eventType}</b> — {e.note || ''} <span className="muted">· {e.actorType} · {dt(e.createdAt)}</span></li>
          ))}</ul>
        </>
      )}
    </div>
  );
}

function PayoutsSection({ summary, payouts, partners, onPartner, gotoAssign }) {
  const { partners: due = [], pendingAmount = 0, paidAmount = 0, cancelledAmount = 0 } = summary || {};
  return (
    <div>
      <div className="kpis">
        <div className="kpi"><div className="kpi-v warn">{inr(pendingAmount)}</div><div className="kpi-l">pending courier fees</div></div>
        <div className="kpi"><div className="kpi-v accent">{inr(paidAmount)}</div><div className="kpi-l">paid out</div></div>
        <div className="kpi"><div className="kpi-v">{due.length}</div><div className="kpi-l">partners with pending fees</div></div>
        <div className="kpi"><div className="kpi-v">{inr(cancelledAmount)}</div><div className="kpi-l">cancelled</div></div>
      </div>

      {due.length > 0 && (
        <>
          <h4>Partners with pending fees</h4>
          <div className="cards">
            {due.map((p) => (
              <div className="card product" key={p.deliveryPartnerId}>
                <div className="product-head">
                  <div>
                    <div className="pname">{p.name} <span className="muted small">({p.partnerCode})</span></div>
                    <div className="muted small">{p.pendingCount} pending · {inr(p.pendingAmount)}</div>
                  </div>
                  <div className="right">
                    <button className="btn primary sm" onClick={() => { onPartner(p.deliveryPartnerId); gotoAssign(); }}>View partner</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <h4>Courier payout ledger</h4>
      {payouts.length === 0 ? <div className="card empty">No courier payouts have been recorded yet. Fees accrue once slices are delivered.</div> : (
        <div className="table-wrap">
          <table className="ptable">
            <thead><tr><th>Partner</th><th>Kind</th><th>Fee</th><th>Earned</th><th>Status</th></tr></thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id}>
                  <td>{p.partnerName} <span className="muted">({p.partnerCode})</span></td>
                  <td>{p.kind}</td>
                  <td><b>{inr(p.feeAmount)}</b></td>
                  <td>{dt(p.earnedAt)}</td>
                  <td><span className={`badge st-${p.status}`}>{PAY_STATUS[p.status] || p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small">Settlement payouts are executed from the <b>Finance → Courier Payouts</b> screen.</p>
    </div>
  );
}
