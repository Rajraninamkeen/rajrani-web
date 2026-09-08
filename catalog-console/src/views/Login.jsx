import { useState } from 'react';

export default function Login({ onLogin, notify }) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const u = await onLogin(email.trim(), pw);
      notify(`Signed in as ${u.role} (${u.email})`);
    } catch (ex) {
      setErr(ex.message || 'Login failed');
    } finally { setBusy(false); }
  };

  return (
    <div className="center full">
      <form className="card login-card" onSubmit={submit}>
        <h1 className="brand big">Bilokat</h1>
        <p className="muted">Catalog Console — sign in to author products (SELLER) or review the publishing queue (OPERATOR/ADMIN).</p>
        <label>Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seller1@example.com" />
        </label>
        <label>Password
          <input type="password" required value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" />
        </label>
        {err && <div className="alert">{err}</div>}
        <button className="btn primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
