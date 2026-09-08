import { useEffect, useState } from 'react';
import { customerApi, authApi } from '../api.js';
import { Stars, reviewStatusLabel, dateStr } from '../format.jsx';

const REVIEW_STATUS_TONE = { PUBLISHED: '', PENDING: 'warn', REJECTED: 'err', HIDDEN: 'muted' };

export default function AccountView({ user, onLogin, onLogout }) {
  if (!user) return <Login onLogin={onLogin} />;
  return <MyReviews user={user} onLogout={onLogout} />;
}

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [demo, setDemo] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg('');
    try {
      const d = await authApi.login(email.trim(), password);
      const user = d.user;
      if (user.role !== 'CUSTOMER') {
        setMsg('This storefront is for CUSTOMER accounts. Seller/staff accounts belong in the other consoles.');
        return;
      }
      onLogin(d.tokens.accessToken, user);
    } catch (err) {
      setMsg(err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="auth" onSubmit={submit}>
        <h2>Sign in</h2>
        <p className="muted">A customer login lets you rate & review products you've actually received.</p>
        {demo && <div className="alert ok">Use <b>{demo}</b></div>}
        <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {msg && <div className="alert err">{msg}</div>}
        <button className="btn primary" disabled={busy || !email || !password}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <button type="button" className="btn ghost" onClick={() => { setEmail('s12@example.com'); setPassword('Test@12345'); setDemo('s12@example.com / Test@12345'); }}>
          Fill demo customer (has a delivered order)
        </button>
      </form>
    </div>
  );
}

function MyReviews({ user, onLogout }) {
  const [list, setList] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // {review, rating, title, comment}

  const load = (s = status) => customerApi.mine(s).then(setList).catch((e) => setError(e.message));

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  useEffect(() => { load(status); /* eslint-disable-next-line */ }, [status]);

  async function remove(id) {
    try { await customerApi.removeReview(id); load(); } catch (e) { setError(e.message); }
  }
  async function saveEdit(e) {
    e.preventDefault();
    try {
      await customerApi.updateReview(editing.review.id, { rating: editing.rating, title: editing.title, comment: editing.comment });
      setEditing(null); load();
    } catch (e2) { setError(e2.message); }
  }

  return (
    <div className="account">
      <div className="acct-head">
        <div className="avatar lg">{initials(user.fullName)}</div>
        <div>
          <h2>{user.fullName || user.email}</h2>
          <p className="muted">{user.email} · Customer</p>
        </div>
        <button className="btn ghost" onClick={onLogout}>Sign out</button>
      </div>

      <div className="tabs">
        {['', 'PENDING', 'PUBLISHED', 'REJECTED', 'HIDDEN'].map((s) => (
          <button key={s || 'all'} className={`chip ${status === s ? 'on' : ''}`} onClick={() => setStatus(s)}>
            {s === '' ? 'All' : reviewStatusLabel(s)}
          </button>
        ))}
      </div>

      {error && <div className="alert err">{error}</div>}

      {!list ? <div className="empty">Loading your reviews…</div>
        : list.length === 0 ? <div className="empty">You haven't reviewed anything yet. Browse the shop and write one from a product page.</div>
        : (
          <ul className="rev-list mine">
            {list.map((r) => (
              <li key={r.id} className="rev">
                <div className="rev-top">
                  <div>
                    <div className="rev-name">{r.product?.name}</div>
                    <Stars value={r.rating} size={13} />
                  </div>
                  <div className="rev-right">
                    <span className={`pill st ${REVIEW_STATUS_TONE[r.status] || ''}`}>{reviewStatusLabel(r.status)}</span>
                    <span className="rev-date">{dateStr(r.createdAt)}</span>
                  </div>
                </div>
                {r.title && <h4>{r.title}</h4>}
                {r.comment && <p>{r.comment}</p>}
                {r.status === 'REJECTED' && r.moderationNote && <div className="alert err slim">Reason: {r.moderationNote}</div>}
                {editing?.review.id === r.id ? (
                  <form className="write" onSubmit={saveEdit}>
                    <input className="input" value={editing.title} placeholder="Title" onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
                    <textarea className="input" rows={2} value={editing.comment} placeholder="Comment" onChange={(e) => setEditing({ ...editing, comment: e.target.value })} />
                    <div>
                      <button className="btn primary small">Save</button>
                      <button type="button" className="btn ghost small" onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <div className="rev-actions">
                    {(r.status === 'PENDING' || r.status === 'REJECTED') && (
                      <button className="btnlink" onClick={() => setEditing({ review: r, rating: r.rating, title: r.title || '', comment: r.comment || '' })}>Edit</button>
                    )}
                    {(r.status === 'PENDING' || r.status === 'REJECTED') && (
                      <button className="btnlink danger" onClick={() => remove(r.id)}>Delete</button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}

function initials(name = '') {
  return String(name).trim().split(/\s+/).slice(0, 2).map((s) => s.charAt(0).toUpperCase()).join('') || 'U';
}
