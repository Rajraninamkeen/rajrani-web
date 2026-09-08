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
      <header className="sitehead">
        <div className="sitehead-in">
          <a className="brand" href="#/" aria-label="Bilokat home">
            <span className="brand-tile">B</span>
            <span className="brand-word">
              <span className="brand-name">BILOKAT</span>
              <span className="brand-tag">Swaad · India ka</span>
            </span>
          </a>

          <nav className="sitehead-nav" aria-label="Primary">
            <a className={route.view === 'home' || route.view === 'product' ? 'on' : ''} href="#/">Shop</a>
            <a className={route.view === 'cart' ? 'on' : ''} href="#/cart">Cart</a>
            <a className={route.view === 'orders' ? 'on' : ''} href="#/orders">Orders</a>
            <a className={route.view === 'account' ? 'on' : ''} href="#/account">
              {user ? (user.fullName || user.email) : 'Sign in'}
            </a>
          </nav>

          <div className="sitehead-actions">
            {user && <NotificationsBell />}
            <a className={'cartpill' + (route.view === 'cart' ? ' on' : '')} href="#/cart" aria-label="Cart">
              <span className="cartpill-ico">🛒</span>
              <span className="cartpill-txt">{cartCount > 0 ? `Cart · ${cartCount}` : 'Cart'}</span>
              {cartCount > 0 && <span className="cartcount">{cartCount}</span>}
            </a>
          </div>
        </div>
      </header>

      {flash && <div className="flash" role="status">{flash}</div>}

      <main>
        {!ready ? <p className="muted center">…</p> : view}
      </main>

      <footer className="sitefoot">
        <div className="sitefoot-in">
          <div className="sf-col sf-brand">
            <div className="brand">
              <span className="brand-tile">B</span>
              <span className="brand-word">
                <span className="brand-name">BILOKAT</span>
                <span className="brand-tag">Swaad · India ka</span>
              </span>
            </div>
            <p>Single-origin Indian namkeen, roasted &amp; small-batch fried and shipped within 24 hours. No palm-oil shortcuts.</p>
            <p className="sf-fine">100% Peanut Oil · FSSAI Certified</p>
          </div>
          <div className="sf-col">
            <h4>Shop</h4>
            <a href="#/">All snacks</a>
            <a href="#/">Best-sellers</a>
            <a href="#/">New arrivals</a>
            <a href="#/cart">Cart</a>
          </div>
          <div className="sf-col">
            <h4>Account</h4>
            <a href="#/orders">My orders</a>
            <a href="#/account">Sign in / profile</a>
          </div>
          <div className="sf-col">
            <h4>We promise</h4>
            <span>🚚 24-hour dispatch</span>
            <span>💵 Pay on delivery</span>
            <span>🌾 Single-origin batches</span>
            <span>🎁 Festive hampers</span>
          </div>
        </div>
        <div className="sitefoot-bar">© {new Date().getFullYear()} Bilokat · live catalog, reviews &amp; checkout</div>
      </footer>
    </div>
  );
}
