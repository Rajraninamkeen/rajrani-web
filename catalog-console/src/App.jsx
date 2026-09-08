import { useEffect, useMemo, useState } from 'react';
import { api, authApi, getToken, setToken } from './api.js';
import Login from './views/Login.jsx';
import SellerCatalog from './views/SellerCatalog.jsx';
import StaffReview from './views/StaffReview.jsx';

// Role-based access: which console sections a signed-in role may open.
const STAFF = new Set(['OPERATOR', 'ADMIN']);

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('catalog'); // 'catalog' (seller) | 'review' (staff)
  const [toast, setToast] = useState(null);

  const notify = (msg, tone = 'ok') => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    // Restore an existing session from a previous reload.
    const t = getToken() || localStorage.getItem('bilokat_token');
    if (!t) { setLoading(false); return; }
    setToken(t);
    authApi.me()
      .then((me) => { setUser(me?.user ?? me ?? null); setLoading(false); })
      .catch(() => { setToken(null); localStorage.removeItem('bilokat_token'); setLoading(false); });
  }, []);

  const allowed = useMemo(() => {
    if (!user) return {};
    return {
      seller: user.role === 'SELLER',
      staff: STAFF.has(user.role),
    };
  }, [user]);

  const handleLogin = async (email, password) => {
    const res = await authApi.login(email, password);
    const t = res.tokens?.accessToken;
    if (!t) throw new Error('No access token returned');
    setToken(t);
    localStorage.setItem('bilokat_token', t);
    const me = await authApi.me();
    setUser(me?.user ?? me ?? null);
    return me?.user ?? me;
  };
  const handleLogout = () => {
    api('POST', '/auth/logout', { body: {} }).catch(() => {});
    setToken(null); localStorage.removeItem('bilokat_token'); setUser(null);
  };

  if (loading) return <div className="center">Loading…</div>;
  if (!user) return <Login onLogin={handleLogin} notify={notify} />;

  // Pick a sensible default tab for the signed-in role.
  const effectiveTab = !allowed.seller && allowed.staff ? 'review' : tab;
  const tabs = [
    ...(allowed.seller ? [{ id: 'catalog', label: 'My Catalog' }] : []),
    ...(allowed.staff ? [{ id: 'review', label: 'Publishing Review' }] : []),
  ];

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="logo">Bilokat</span>
          <span className="brand-sub">Catalog Console</span>
        </div>
        <div className="topbar-right">
          <span className="who">{user.fullName || user.email} · <b>{user.role}</b></span>
          <button className="btn ghost" onClick={handleLogout}>Sign out</button>
        </div>
      </header>
      <nav className="tabs">
        {tabs.map((t) => (
          <button key={t.id} className={`tab ${effectiveTab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </nav>
      <main className="content">
        {allowed.seller && effectiveTab === 'catalog' && <SellerCatalog notify={notify} />}
        {allowed.staff && effectiveTab === 'review' && <StaffReview notify={notify} />}
        {(!allowed.seller && !allowed.staff) && (
          <div className="card empty">Your role ({user.role}) has no catalog-console access. Please sign in as a SELLER or an OPERATOR/ADMIN.</div>
        )}
      </main>
      {toast && <div className={`toast ${toast.tone}`}>{toast.msg}</div>}
    </div>
  );
}
