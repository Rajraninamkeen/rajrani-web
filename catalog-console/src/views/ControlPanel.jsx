import { useEffect, useState } from 'react';
import { controlApi } from '../api.js';

// Session 43 — Platform Control Panel (OPERATOR/ADMIN).
// Governance read (users, sessions, sellers, audit) + audited break-glass actions
// (revoke a session / a user's all sessions). Every high-authority action asks for a
// mandatory reason and is recorded in the platform control-audit log. Access tokens
// are short-lived (15 min); revoking a session stops the user refreshing/extending it.

const ROLE_TONE = { OPERATOR: '', ADMIN: 'warn', SELLER: '', CUSTOMER: 'muted', DELIVERY: '', REVIEWER: 'warn' };
const SESS_SCOPE = [['active', 'Active'], ['revoked', 'Revoked'], ['all', 'All']];
const AUDIT_ACTIONS = [
  ['', 'All'], ['SESSION_REVOKE', 'Session revoke'], ['SESSION_REVOKE_ALL', 'Revoke all sessions'],
  ['SELLER_SUSPEND', 'Seller suspend'], ['SELLER_ACTIVATE', 'Seller activate'],
  ['USER_STATUS_CHANGE', 'User status'], ['CATALOG_OVERRIDE', 'Catalog override'],
  ['PAYMENT_OVERRIDE', 'Payment override'], ['OTHER', 'Other'],
];
const USER_ROLES = ['', 'CUSTOMER', 'SELLER', 'OPERATOR', 'ADMIN', 'DELIVERY', 'REVIEWER'];
const dt = (iso) => (iso ? new Date(iso).toLocaleString() : '—');
const short = (s, n = 46) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s || '—');

export default function ControlPanel({ notify }) {
  const [section, setSection] = useState('overview');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const [overview, setOverview] = useState(null);

  // users
  const [users, setUsers] = useState(null);
  const [uRole, setURole] = useState('');
  const [uQ, setUQ] = useState('');
  const [openUser, setOpenUser] = useState(null); // user detail

  // sessions
  const [sessions, setSessions] = useState(null);
  const [sScope, setSScope] = useState('active');
  const [sQ, setSQ] = useState('');

  // sellers
  const [sellers, setSellers] = useState(null);
  const [selQ, setSelQ] = useState('');

  // audit
  const [audit, setAudit] = useState(null);
  const [aAction, setAAction] = useState('');

  // confirm overlay {kind, targetId, label}
  const [confirm, setConfirm] = useState(null);
  const [reason, setReason] = useState('');

  const loadOverview = async () => {
    try { setOverview(await controlApi.overview()); } catch (e) { setErr(e.message); }
  };
  const loadUsers = async () => {
    try { setUsers(await controlApi.users({ role: uRole || undefined, q: uQ || undefined, limit: 100 })); } catch (e) { setErr(e.message); }
  };
  const loadSessions = async () => {
    try { setSessions(await controlApi.sessions({ scope: sScope, q: sQ || undefined, limit: 100 })); } catch (e) { setErr(e.message); }
  };
  const loadSellers = async () => {
    try { setSellers(await controlApi.sellers({ q: selQ || undefined })); } catch (e) { setErr(e.message); }
  };
  const loadAudit = async () => {
    try { setAudit(await controlApi.audit({ action: aAction || undefined, limit: 200 })); } catch (e) { setErr(e.message); }
  };

  useEffect(() => {
    setBusy(true);
    Promise.all([loadOverview(), loadUsers(), loadSessions(), loadSellers(), loadAudit()])
      .catch(() => {}).finally(() => setBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doAction = async () => {
    if (!confirm) return;
    const r = (reason || '').trim();
    if (!r) return notify('A reason is required for a control action', 'err');
    setBusy(true); setErr('');
    try {
      if (confirm.kind === 'revokeSession') {
        const out = await controlApi.revokeSession(confirm.targetId, r);
        notify(`Session revoked (${out.targetEmail})`, 'ok');
      } else if (confirm.kind === 'revokeAll') {
        const out = await controlApi.revokeAllSessions(confirm.targetId, r);
        notify(`Revoked ${out.revoked} session(s) for ${out.targetEmail}`, 'ok');
      }
      setConfirm(null); setReason('');
      await Promise.all([loadOverview(), loadSessions(), loadUsers(), loadAudit()]);
    } catch (e) { setErr(e.message); notify(e.message, 'err'); }
    finally { setBusy(false); }
  };

  const arm = (kind, targetId, label) => { setReason(''); setConfirm({ kind, targetId, label }); };
  const openUserDetail = async (id) => {
    try { setOpenUser(await controlApi.user(id)); } catch (e) { notify(e.message, 'err'); }
  };

  const ov = overview || {};
  const roleTiles = Object.entries(ov.usersByRole || {});

  return (
    <div>
      <h2 style={{ margin: 0 }}>Platform Control Panel
        <span className="muted small"> · governance &amp; break-glass (OPERATOR/ADMIN)</span>
      </h2>

      {busy && <div className="center muted">Loading control data…</div>}
      {err && <div className="alert">{err}</div>}

      {!busy && (
        <>
          <div className="sub-nav" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '14px 0 12px' }}>
            {[['overview', 'Overview'], ['users', 'Users'], ['sessions', 'Sessions'], ['sellers', 'Sellers'], ['audit', 'Audit']]
              .map(([id, label]) => (
                <button key={id} className={`seg ${section === id ? 'active' : ''}`} onClick={() => setSection(id)}>{label}</button>
              ))}
          </div>

          {section === 'overview' && (
            <>
              <div className="kpis">
                {roleTiles.map(([role, n]) => (
                  <div className="kpi" key={role}><div className="kpi-v">{n}</div><div className="kpi-l">{role} users</div></div>
                ))}
                <div className="kpi"><div className="kpi-v accent">{ov.activeSessions ?? 0}</div><div className="kpi-l">Active sessions</div></div>
                <div className="kpi"><div className="kpi-v">{ov.totalSellers ?? 0}</div><div className="kpi-l">Sellers</div></div>
                <div className="kpi"><div className="kpi-v warn">{ov.auditEntries ?? 0}</div><div className="kpi-l">Control-audit entries</div></div>
              </div>
              <div className="cards" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                <div className="card" style={{ flex: '1 1 300px' }}>
                  <b>Users by role</b>
                  <div className="muted small" style={{ marginTop: 6 }}>{Object.entries(ov.usersByRole || {}).map(([r, n]) => `${r}: ${n}`).join(' · ') || '—'}</div>
                  <b style={{ display: 'block', marginTop: 12 }}>Sellers by status</b>
                  <div className="muted small" style={{ marginTop: 6 }}>{Object.entries(ov.sellersByStatus || {}).map(([s, n]) => `${s}: ${n}`).join(' · ') || '—'}</div>
                </div>
                <div className="card" style={{ flex: '1 1 300px' }}>
                  <div className="muted">
                    High-authority Control actions (session revoke / revoke-all) are mandatorily reasoned and
                    recorded in the <b>Audit</b> tab. The platform user directory, active-session registry and
                    seller governance roll are read-only here.
                  </div>
                </div>
              </div>
            </>
          )}

          {section === 'users' && (
            <UserPanel users={users} uRole={uRole} setURole={setURole} uQ={uQ} setUQ={setUQ}
              onSearch={loadUsers} open={openUserDetail} onRevokeAll={(u) => arm('revokeAll', u.id, u.email)} />
          )}

          {section === 'sessions' && (
            <SessionPanel sessions={sessions} scope={sScope} setScope={setSScope} q={sQ} setQ={setSQ}
              onSearch={loadSessions} onRevoke={(s) => arm('revokeSession', s.id, `${s.user?.email || '?'} (${s.id.slice(0, 8)})`)} />
          )}

          {section === 'sellers' && (
            <SellerPanel sellers={sellers} q={selQ} setQ={setSelQ} onSearch={loadSellers} />
          )}

          {section === 'audit' && (
            <AuditPanel audit={audit} action={aAction} setAction={setAAction} onSearch={loadAudit} />
          )}
        </>
      )}

      {confirm && (
        <div className="overlay" onClick={() => setConfirm(null)}>
          <div className="card" style={{ width: 420, margin: '10vh auto' }} onClick={(e) => e.stopPropagation()}>
            <b style={{ fontSize: 15 }}>
              {confirm.kind === 'revokeSession' ? 'Revoke session (break-glass)' : 'Revoke all active sessions'}
            </b>
            <div className="muted small" style={{ margin: '8px 0' }}>Target: <b>{confirm.label}</b></div>
            <label>Mandatory reason
              <textarea rows={3} value={reason} placeholder="Justify this high-authority action…"
                onChange={(e) => setReason(e.target.value)} />
            </label>
            <div className="actions" style={{ marginTop: 10 }}>
              <button className="btn ghost" onClick={() => setConfirm(null)}>Cancel</button>
              <button className="btn" disabled={!reason.trim()} onClick={doAction}>Confirm &amp; audit</button>
            </div>
          </div>
        </div>
      )}

      {openUser && (
        <div className="overlay" onClick={() => setOpenUser(null)}>
          <div className="card" style={{ width: 620, margin: '6vh auto', maxHeight: '80vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="row-between">
              <b style={{ fontSize: 16 }}>{openUser.fullName || openUser.email}</b>
              <button className="btn ghost sm" onClick={() => setOpenUser(null)}>Close</button>
            </div>
            <div className="muted small">{openUser.email} · <span className="badge">{openUser.role}</span> · {openUser.status}
              {openUser.seller ? ` · SELL ${openUser.seller.sellerCode}` : ''}{openUser.delivery ? ` · DLV ${openUser.delivery.partnerCode}` : ''}</div>
            <div className="grid2" style={{ marginTop: 10 }}>
              <div className="muted small">Orders: <b>{openUser.counts?.orders ?? 0}</b></div>
              <div className="muted small">Carts: <b>{openUser.counts?.carts ?? 0}</b></div>
              <div className="muted small">Reviews: <b>{openUser.counts?.reviews ?? 0}</b></div>
              <div className="muted small">Joined: <b>{dt(openUser.createdAt)}</b></div>
            </div>
            <div className="actions" style={{ marginTop: 8 }}>
              <button className="btn ghost sm warn" onClick={() => arm('revokeAll', openUser.id, openUser.email)}>Revoke all sessions</button>
            </div>
            <h4 style={{ margin: '14px 0 6px' }}>Recent sessions</h4>
            <div className="table-wrap"><table className="ptable"><thead><tr><th>Device</th><th>IP</th><th>Expires</th><th>Status</th></tr></thead>
              <tbody>
                {(openUser.sessions || []).map((s) => (
                  <tr key={s.id}><td className="small">{s.deviceName || short(s.userAgent, 24) || '—'}</td><td className="muted small">{s.ip || '—'}</td>
                    <td className="small">{dt(s.expiresAt)}</td>
                    <td>{s.active ? <span className="badge st-ACCEPTED">Active</span> : <span className="badge muted">Revoked</span>}</td></tr>
                ))}
                {!(openUser.sessions || []).length && <tr><td colSpan={4} className="muted">No sessions</td></tr>}
              </tbody>
            </table></div>
          </div>
        </div>
      )}
    </div>
  );
}

function UserPanel({ users, uRole, setURole, uQ, setUQ, onSearch, open, onRevokeAll }) {
  return (
    <>
      <div className="filters" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <select value={uRole} onChange={(e) => setURole(e.target.value)}>
          {USER_ROLES.map((r) => <option key={r} value={r}>{r === '' ? 'All roles' : r}</option>)}
        </select>
        <input style={{ maxWidth: 240 }} placeholder="Search email / name / phone" value={uQ} onChange={(e) => setUQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearch()} />
        <button className="btn" onClick={onSearch}>Apply</button>
      </div>
      <div className="table-wrap"><table className="ptable"><thead><tr>
        <th>User</th><th>Role</th><th>Status</th><th>Binding</th><th>Orders/Sess</th><th></th>
      </tr></thead>
        <tbody>
          {(users?.users || []).map((u) => (
            <tr key={u.id}>
              <td><b>{u.fullName || '—'}</b><div className="muted small">{u.email}</div>{u.phone && <div className="muted small">{u.phone}</div>}</td>
              <td><span className={`badge ${ROLE_TONE[u.role] || ''}`}>{u.role}</span></td>
              <td>{u.status}</td>
              <td className="small">{u.seller ? `SELL ${u.seller.code}` : u.delivery ? `DLV ${u.delivery.code}` : '—'}</td>
              <td className="muted small">{u.orderCount} / {u.sessionCount}</td>
              <td><button className="btn ghost sm" onClick={() => open(u.id)}>Detail</button>
                <button className="btn ghost sm warn" onClick={() => onRevokeAll(u)}>Revoke sessions</button></td>
            </tr>
          ))}
          {!(users?.users || []).length && <tr><td colSpan={6} className="muted">No users match</td></tr>}
        </tbody>
      </table></div>
      {users && <div className="muted small" style={{ marginTop: 8 }}>{users.total} matching users.</div>}
    </>
  );
}

function SessionPanel({ sessions, scope, setScope, q, setQ, onSearch, onRevoke }) {
  return (
    <>
      <div className="filters" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        {SESS_SCOPE.map(([v, l]) => (
          <button key={v} className={`seg ${scope === v ? 'active' : ''}`} onClick={() => setScope(v)}>{l}</button>
        ))}
        <input style={{ maxWidth: 240 }} placeholder="Search user email / name" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearch()} />
        <button className="btn" onClick={onSearch}>Apply</button>
      </div>
      <div className="table-wrap"><table className="ptable"><thead><tr>
        <th>User</th><th>Device</th><th>IP</th><th>Created</th><th>Expires</th><th>Status</th><th></th>
      </tr></thead>
        <tbody>
          {(sessions?.sessions || []).map((s) => (
            <tr key={s.id}>
              <td><b>{s.user?.fullName || '—'}</b><div className="muted small">{s.user?.email} · {s.user?.role}</div></td>
              <td className="small">{s.deviceName || '—'}<div className="muted small">{short(s.userAgent, 30)}</div></td>
              <td className="muted small">{s.ip || '—'}</td>
              <td className="small">{dt(s.createdAt)}</td>
              <td className="small">{dt(s.expiresAt)}</td>
              <td>{s.active ? <span className="badge st-ACCEPTED">Active</span> : <span className="badge muted">Revoked</span>}</td>
              <td>{s.active ? <button className="btn ghost sm warn" onClick={() => onRevoke(s)}>Revoke</button> : '—'}</td>
            </tr>
          ))}
          {!(sessions?.sessions || []).length && <tr><td colSpan={7} className="muted">No {scope} sessions</td></tr>}
        </tbody>
      </table></div>
    </>
  );
}

function SellerPanel({ sellers, q, setQ, onSearch }) {
  return (
    <>
      <div className="filters" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <input style={{ maxWidth: 240 }} placeholder="Search code / name" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearch()} />
        <button className="btn" onClick={onSearch}>Apply</button>
        <span className="muted small">Activation / suspension flows are driven from the Delivery &amp; Seller-onboarding staff surfaces (writes seller_status_history).</span>
      </div>
      <div className="table-wrap"><table className="ptable"><thead><tr>
        <th>Seller</th><th>Status</th><th>Commission</th><th>Org</th><th>Products</th><th>Operators</th><th>Slices</th><th>Payables</th><th>Activated</th>
      </tr></thead>
        <tbody>
          {(sellers || []).map((s) => (
            <tr key={s.id}>
              <td><b>{s.displayName}</b><div className="muted small">{s.sellerCode}</div></td>
              <td><span className="badge st-ACCEPTED">{s.status}</span></td>
              <td>{s.commissionRateBps / 100}%</td>
              <td className="small">{s.organization?.name || '—'}</td>
              <td>{s.counts.products}</td><td>{s.counts.operators}</td><td>{s.counts.slices}</td><td>{s.counts.payables}</td>
              <td className="small">{s.activatedAt ? dt(s.activatedAt) : '—'}</td>
            </tr>
          ))}
          {!(sellers || []).length && <tr><td colSpan={9} className="muted">No sellers match</td></tr>}
        </tbody>
      </table></div>
    </>
  );
}

function AuditPanel({ audit, action, setAction, onSearch }) {
  return (
    <>
      <div className="filters" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <select value={action} onChange={(e) => setAction(e.target.value)}>
          {AUDIT_ACTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button className="btn" onClick={onSearch}>Apply</button>
        <span className="muted small">Append-only platform control-audit trail (every high-authority action is recorded with actor + reason).</span>
      </div>
      <div className="table-wrap"><table className="ptable"><thead><tr>
        <th>When</th><th>Action</th><th>Actor</th><th>Target</th><th>Reason</th>
      </tr></thead>
        <tbody>
          {(audit?.rows || []).map((a) => (
            <tr key={a.id}>
              <td className="small">{dt(a.createdAt)}</td>
              <td><b>{a.action}</b><div className="muted small">{a.actionType}</div></td>
              <td className="small">{a.actorId.slice(0, 10)}… · {a.actorRole}</td>
              <td className="small">{a.targetType}{a.targetId ? `: ${a.targetId.slice(0, 10)}…` : ''}</td>
              <td className="small" style={{ maxWidth: 280, whiteSpace: 'normal' }}>{short(a.reason, 160)}</td>
            </tr>
          ))}
          {!(audit?.rows || []).length && <tr><td colSpan={5} className="muted">No audit entries yet</td></tr>}
        </tbody>
      </table></div>
    </>
  );
}
