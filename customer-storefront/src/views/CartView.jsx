import { useEffect, useState } from 'react';
import { cartApi } from '../api.js';
import ProductImage from '../components/ProductImage.jsx';
import { money } from '../format.jsx';

export default function CartView({ user, onQty, onRemove, onClear, onCheckout, onGoProduct }) {
  const [cart, setCart] = useState(null);
  const [err, setErr] = useState('');

  const load = () => cartApi.get().then(setCart).catch((e) => setErr(e.message));

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function qty(lineId, q) {
    try { const c = await cartApi.update(lineId, q); setCart(c); onQty && onQty(c.itemCount); }
    catch (e) { setErr(e.message); }
  }
  async function remove(id) {
    try { const c = await cartApi.remove(id); setCart(c); onRemove && onRemove(c.itemCount); }
    catch (e) { setErr(e.message); }
  }
  async function clearAll() {
    try { const c = await cartApi.clear(); setCart(c); onClear && onClear(0); }
    catch (e) { setErr(e.message); }
  }

  if (!cart) return <div className="empty">{err || 'Loading your cart…'}</div>;

  const goShop = () => window.location.hash = '/';

  if (cart.items.length === 0) {
    return (
      <div className="cart-page">
        <h2>Your cart</h2>
        <div className="empty">Your cart is empty.</div>
        <button className="btn primary" onClick={goShop}>Start shopping</button>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <div className="page-head">
        <h2>Your cart</h2>
        <button className="btn ghost small" onClick={clearAll}>Clear cart</button>
      </div>
      {err && <div className="alert err">{err}</div>}
      <div className="cart-layout">
        <ul className="cart-list">
          {cart.items.map((it) => (
            <li key={it.productId} className="cart-line">
              <div className="cart-thumb" onClick={() => onGoProduct && onGoProduct(it)}>
                <ProductImage src={it.image} name={it.name} slug={it.productId} />
              </div>
              <div className="cart-info">
                <div className="cart-name" onClick={() => onGoProduct && onGoProduct(it)}>{it.name}</div>
                {it.weight && <div className="cart-weight">{it.weight}</div>}
                <div className="cart-unit">{money(it.price)} each</div>
                <div className="cart-actions">
                  <div className="qty">
                    <button onClick={() => qty(it.id, Math.max(1, it.quantity - 1))} disabled={it.quantity <= 1}>−</button>
                    <span>{it.quantity}</span>
                    <button onClick={() => qty(it.id, it.quantity + 1)}>+</button>
                  </div>
                  <button className="btnlink danger" onClick={() => remove(it.id)}>Remove</button>
                </div>
              </div>
              <div className="cart-line-total">{money(it.lineTotal)}</div>
            </li>
          ))}
        </ul>
        <aside className="summary">
          <h3>Summary</h3>
          <div className="sum-row"><span>Items</span><span>{cart.itemCount}</span></div>
          <div className="sum-row"><span>Subtotal</span><span>{money(cart.subtotal)}</span></div>
          <div className="sum-row total"><span>Total</span><span>{money(cart.subtotal)}</span></div>
          <button className="btn primary block" onClick={onCheckout}>
            {user ? 'Proceed to checkout' : 'Sign in & checkout'}
          </button>
        </aside>
      </div>
    </div>
  );
}
