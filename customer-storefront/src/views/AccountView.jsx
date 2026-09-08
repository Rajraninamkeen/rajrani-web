import { useEffect, useState } from 'react';
import { customerApi, authApi } from '../api.js';
import { Stars, reviewStatusLabel, dateStr } from '../format.jsx';

const REVIEW_STATUS_TONE = { PUBLISHED: '', PENDING: 'warn', REJECTED: 'err', HIDDEN: 'muted' };

export default function AccountView({ user, onLogin, onLogout }) {
  if (!user) return <Login onLogin={onLogin} />;
  return <MyReviews user={user} onLogout={onLogout} />;
}

function Login({ onLogin }) {
  const [mode, setMode] = useState('signin'); // 'signin' | 'register'
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [demo, setDemo] = useState('');
  const [f, setF] = useState({ name: '', email: '', password: '', phone: '' });

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg('');
    try {
      const d = mode === 'signin'
        ? await authApi.login(f.email.trim(), f.password)
        : await authApi.register(f.name.trim(), f.email.trim(), f.password, f.phone.trim() || undefined);
      const user = d.user;
      if (user.role !== 'CUSTOMER') {
        setMsg('This storefront is for CUSTOMER accounts. Seller/staff accounts belong in the other consoles.');
        return;
      }
      onLogin(d.tokens.accessToken, user);
    } catch (err) {
      setMsg(err.message || (mode === 'signin' ? 'Login failed' : 'Registration failed'));
    } finally {
      setBusy(false);
    }
  }

  const pwHint = 'Min 8 chars with upper, lower, number & symbol.';
  const canGo = mode === 'signin'
    ? !!(f.email && f.password)
    : !!(f.name && f.email && f.password);

  return (
    <div className="auth-wrap">
      <div className="auth-switch" role="tablist">
        <button role="tab" className={mode === 'signin' ? 'on' : ''} onClick={() => { setMode('signin'); setMsg(''); }}>Sign in</button>
        <button role="tab" className={mode === 'register' ? 'on' : ''} onClick={() => { setMode('register'); setMsg(''); }}>Create account</button>
      </div>

      <form className="auth" onSubmit={submit}>
        {mode === 'signin' ? (
          <>
            <h2>Welcome back</h2>
            <p className="muted">Sign in to save your wishlist, address book, orders &amp; reviews.</p>
            {demo && <div className="alert ok">Use <b>{demo}</b></div>}
            <input className="input" type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
            <input className="input" type="password" placeholder="Password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />
            {msg && <div className="alert err">{msg}</div>}
            <button className="btn primary" disabled={busy || !canGo}>{busy ? 'Signing in…' : 'Sign in'}</button>
            <button type="button" className="btn ghost" onClick={() => { setF((x) => ({ ...x, email: 's12@example.com', password: 'Test@12345' })); setDemo('s12@example.com / Test@12345'); }}>
              Fill demo customer (has a delivered order)
            </button>
          </>
        ) : (
          <>
            <h2>Create your account</h2>
            <p className="muted">Join Bilokat to shop, save favourites &amp; track orders across India.</p>
            <input className="input" type="text" placeholder="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} minLength={2} required />
            <input className="input" type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
            <input className="input" type="tel" placeholder="Mobile (optional)" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/[^\d]/g, '').slice(0, 10) })} />
            <input className="input" type="password" placeholder="Create a strong password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />
            <p className="hint">{pwHint}</p>
            {msg && <div className="alert err">{msg}</div>}
            <button className="btn primary" disabled={busy || !canGo}>{busy ? 'Creating…' : 'Create account'}</button>
          </>
        )}
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

      <div className="acct-quick">
        <a className="btn ghost small" href="#/orders">📦 My orders</a>
        <a className="btn ghost small" href="#/wishlist">❤️ Wishlist</a>
        <a className="btn ghost small" href="#/addresses">📍 Address book</a>
        <a className="btn ghost small" href="#/notifications">🔔 Notifications</a>
        <a className="btn ghost small" href="#/">🛒 Shop</a>
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
