import { useEffect, useState, useCallback } from 'react';
import { getToken, setToken, clearToken, authApi } from './api.js';
import HomeView from './views/HomeView.jsx';
import ProductView from './views/ProductView.jsx';
import AccountView from './views/AccountView.jsx';

function parseHash() {
  const h = window.location.hash.replace(/^#/, '');
  const parts = h.split('/').filter(Boolean); // e.g. ['product','slug'] | ['account'] | []
  return { parts, view: parts[0] || 'home' };
}

function go(path) { window.location.hash = path; }

export default function App() {
  const [route, setRoute] = useState(() => parseHash());
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [flash, setFlash] = useState('');

  const notify = useCallback((msg) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(''), 3500);
  }, []);

  // hash navigation
  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // restore session if a token exists
  useEffect(() => {
    let alive = true;
    (async () => {
      if (getToken()) {
        try {
          const me = await authApi.me();
          if (alive) setUser(me);
        } catch {
          clearToken();
        }
      }
      if (alive) setReady(true);
    })();
    return () => { alive = false; };
  }, []);

  const handleLogin = (token, u) => { setToken(token); setUser(u); go('/'); };
  const handleLogout = () => { clearToken(); setUser(null); go('/'); };

  const openProduct = (slug) => go('/product/' + encodeURIComponent(slug));

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/">🍘 Bilokat</a>
        <nav>
          <a className={route.view === 'home' ? 'on' : ''} href="#/">Shop</a>
          <a className={route.view === 'account' ? 'on' : ''} href="#/account">
            {user ? (user.fullName || user.email) : 'Sign in'}
          </a>
        </nav>
      </header>

      {flash && <div className="flash">{flash}</div>}

      <main>
        {!ready ? <p className="muted center">…</p>
          : route.view === 'home' ? <HomeView onOpen={openProduct} />
          : route.view === 'product' ? (
              <ProductView identifier={route.parts[1]} user={user} notify={notify} goHome={() => go('/')} />
            )
          : route.view === 'account' ? (
              <AccountView user={user} onLogin={handleLogin} onLogout={handleLogout} />
            )
          : <HomeView onOpen={openProduct} />}
      </main>

      <footer className="footer">Bilokat customer storefront · reads the live public catalog &amp; published reviews</footer>
    </div>
  );
}
