import { useEffect, useState, useCallback } from 'react';
import { getToken, setToken, clearToken, authApi, cartApi, ensureGuestId } from './api.js';
import HomeView from './views/HomeView.jsx';
import ProductView from './views/ProductView.jsx';
import AccountView from './views/AccountView.jsx';
import CartView from './views/CartView.jsx';
import CheckoutView from './views/CheckoutView.jsx';
import OrdersView from './views/OrdersView.jsx';
import OrderView from './views/OrderView.jsx';
import NotificationsBell from './components/NotificationsBell.jsx';

function parseHash() {
  const h = window.location.hash.replace(/^#/, '');
  const parts = h.split('/').filter(Boolean);
  return { parts, view: parts[0] || 'home' };
}
function go(path) { window.location.hash = path; }

export default function App() {
  const [route, setRoute] = useState(() => parseHash());
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [flash, setFlash] = useState('');
  const [cartCount, setCartCount] = useState(0);

  const notify = useCallback((msg) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(''), 3500);
  }, []);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const refreshCart = useCallback(async () => {
    try { const c = await cartApi.get(); setCartCount(c.itemCount || 0); }
    catch { /* not signed in / no guest yet */ }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (getToken()) {
        try {
          const me = await authApi.me();
          if (alive) setUser(me);
        } catch { clearToken(); }
      }
      if (alive) setReady(true);
    })();
    return () => { alive = false; };
  }, []);

  // refresh the cart badge when the route changes (and after login settles)
  useEffect(() => { if (ready) refreshCart(); }, [ready, route.view]);

  const addToCart = async (productId, quantity = 1) => {
    ensureGuestId();
    const c = await cartApi.add(productId, quantity);
    setCartCount(c.itemCount || 0);
    notify('Added to cart');
  };

  const handleLogin = async (token, u) => { setToken(token); setUser(u); await refreshCart(); go('/'); };
  const handleLogout = () => { clearToken(); setUser(null); setCartCount(0); go('/'); };

  const openProduct = (slug) => go('/product/' + encodeURIComponent(slug));

  const openCartFrom = (item) => { if (item && item.productId) openProduct(item.productId); };

  const view =
    route.view === 'home' ? <HomeView onOpen={openProduct} addToCart={addToCart} />
    : route.view === 'product' ? <ProductView identifier={route.parts[1]} user={user} notify={notify} goHome={() => go('/')} addToCart={addToCart} goCart={() => go('/cart')} />
    : route.view === 'cart' ? <CartView user={user} onQty={setCartCount} onRemove={setCartCount} onClear={() => setCartCount(0)} onCheckout={() => go('/checkout')} onGoProduct={openCartFrom} />
    : route.view === 'checkout' ? <CheckoutView user={user} notify={notify} onPlaced={(id) => go('/order/' + id)} />
    : route.view === 'orders' ? <OrdersView user={user} />
    : route.view === 'order' ? <OrderView id={route.parts[1]} notify={notify} />
    : route.view === 'account' ? <AccountView user={user} onLogin={handleLogin} onLogout={handleLogout} />
    : <HomeView onOpen={openProduct} />;

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/">🍘 Bilokat</a>
        <nav>
          <a className={['home', 'product'].includes(route.view) ? 'on' : ''} href="#/">Shop</a>
          <a className={route.view === 'orders' ? 'on' : ''} href="#/orders">My orders</a>
          <a className={'cartbtn ' + (route.view === 'cart' ? 'on' : '')} href="#/cart">
            🛒 Cart{cartCount > 0 && <span className="cartcount">{cartCount}</span>}
          </a>
          <a className={route.view === 'account' ? 'on' : ''} href="#/account">
            {user ? (user.fullName || user.email) : 'Sign in'}
          </a>
          {user && <NotificationsBell />}
        </nav>
      </header>

      {flash && <div className="flash">{flash}</div>}

      <main>
        {!ready ? <p className="muted center">…</p> : view}
      </main>

      <footer className="footer">Bilokat customer storefront · live catalog, reviews &amp; checkout</footer>
    </div>
  );
}
