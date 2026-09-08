import { useEffect, useMemo, useState } from 'react';
import { api, authApi, getToken, setToken } from './api.js';
import Login from './views/Login.jsx';
import SellerCatalog from './views/SellerCatalog.jsx';
import SellerDashboard from './views/SellerDashboard.jsx';
import StaffReview from './views/StaffReview.jsx';
import StaffReviews from './views/StaffReviews.jsx';
import OperatorDashboard from './views/OperatorDashboard.jsx';
import CourierTasks from './views/CourierTasks.jsx';
import FinanceOps from './views/FinanceOps.jsx';
import DeliveryOps from './views/DeliveryOps.jsx';
import Analytics from './views/Analytics.jsx';

// Role-based access: which console sections a signed-in role may open.
const STAFF = new Set(['OPERATOR', 'ADMIN']);

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('catalog'); // 'catalog' (seller) | 'ops'/'review' (staff) | 'courier'
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
      courier: user.role === 'DELIVERY',
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
  const effectiveTab =
    (!allowed.seller && !allowed.staff && allowed.courier) ? 'courier'
      : (!allowed.seller && allowed.staff) ? 'ops'
        : tab;
  const tabs = [
    ...(allowed.seller ? [{ id: 'catalog', label: 'My Catalog' }, { id: 'dashboard', label: 'Sales & Payouts' }, { id: 'analytics', label: 'Analytics' }] : []),
    ...(allowed.staff ? [{ id: 'ops', label: 'Operations' }, { id: 'delivery', label: 'Delivery Partners' }, { id: 'finance', label: 'Finance' }, { id: 'analytics', label: 'Analytics' }, { id: 'review', label: 'Publishing Review' }, { id: 'reviews', label: 'Review Moderation' }] : []),
    ...(allowed.courier ? [{ id: 'courier', label: 'My Deliveries' }] : []),
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
        {allowed.seller && effectiveTab === 'dashboard' && <SellerDashboard notify={notify} />}
        {allowed.seller && effectiveTab === 'analytics' && <Analytics mode="seller" notify={notify} />}
        {allowed.staff && effectiveTab === 'ops' && <OperatorDashboard notify={notify} />}
        {allowed.staff && effectiveTab === 'analytics' && <Analytics mode="platform" notify={notify} />}
        {allowed.staff && effectiveTab === 'delivery' && <DeliveryOps notify={notify} />}
        {allowed.staff && effectiveTab === 'finance' && <FinanceOps notify={notify} />}
        {allowed.staff && effectiveTab === 'review' && <StaffReview notify={notify} />}
        {allowed.staff && effectiveTab === 'reviews' && <StaffReviews notify={notify} />}
        {allowed.courier && effectiveTab === 'courier' && <CourierTasks notify={notify} />}
        {(!allowed.seller && !allowed.staff && !allowed.courier) && (
          <div className="card empty">Your role ({user.role}) has no catalog-console access. Please sign in as a SELLER, an OPERATOR/ADMIN, or a DELIVERY partner.</div>
        )}
      </main>
      {toast && <div className={`toast ${toast.tone}`}>{toast.msg}</div>}
    </div>
  );
}
