import { useEffect, useState } from 'react';
import { cartApi, checkoutApi } from '../api.js';
import { money, PAYMENT_METHOD_LABEL } from '../format.jsx';

const DEMO_ADDR = { name: '', phone: '9876543210', line1: '12 Model Town', city: 'Kanpur', state: 'UP', pincode: '208001' };

export default function CheckoutView({ user, notify, onPlaced }) {
  const [cart, setCart] = useState(null);
  const [preview, setPreview] = useState(null);
  const [address, setAddress] = useState({ ...DEMO_ADDR });
  const [coupon, setCoupon] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    cartApi.get().then((c) => { setCart(c); }).catch((e) => setErr(e.message));
  }, []);

  const cartId = cart?.cartId;

  async function fetchPreview(code) {
    if (!cartId) return;
    try {
      const p = await checkoutApi.preview(cartId, code || undefined);
      setPreview(p);
      setErr('');
    } catch (e) { setErr(e.message); }
  }
  useEffect(() => { if (cartId) fetchPreview(coupon); /* eslint-disable-next-line */ }, [cartId]);

  const setA = (k) => (e) => setAddress((a) => ({ ...a, [k]: e.target.value }));

  if (!user) {
    return (
      <div className="auth-wrap"><div className="auth">
        <h2>Sign in to checkout</h2>
        <p className="muted">Orders are saved to your account. <a href="#/account">Sign in here</a>, then return to your cart.</p>
        <button className="btn ghost" onClick={() => window.location.hash = '/cart'}>Back to cart</button>
      </div></div>
    );
  }

  if (!cart) return <div className="empty">{err || 'Loading…'}</div>;

  if (cart.items.length === 0) {
    return <div className="empty">Your cart is empty — nothing to check out. <a href="#/">Browse the shop.</a></div>;
  }

  async function place(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const order = await checkoutApi.place({
        cartId,
        address,
        couponCode: coupon.trim() || undefined,
        paymentMethod,
      });
      notify(`Order ${order.orderNumber} placed`);
      onPlaced(order.id);
    } catch (err2) { setErr(err2.message); }
    finally { setBusy(false); }
  }

  const p = preview?.price;

  return (
    <div className="checkout">
      <button className="backlink" onClick={() => window.location.hash = '/cart'}>← Back to cart</button>
      <h2>Checkout</h2>
      {err && <div className="alert err">{err}</div>}

      <form className="checkout-layout" onSubmit={place}>
        <div className="checkout-left">
          <section className="panel">
            <h3>Delivery address</h3>
            <div className="two"><input className="input" placeholder="Full name" value={address.name} onChange={setA('name')} minLength={2} required />
              <input className="input" placeholder="Phone (10 digits)" value={address.phone} onChange={setA('phone')} pattern="[6-9][0-9]{9}" title="10-digit Indian mobile" required /></div>
            <input className="input" placeholder="Address line 1" value={address.line1} onChange={setA('line1')} minLength={3} required />
            <div className="two">
              <input className="input" placeholder="City" value={address.city} onChange={setA('city')} minLength={2} required />
              <input className="input" placeholder="State" value={address.state} onChange={setA('state')} minLength={2} required />
            </div>
            <input className="input narrow" placeholder="Pincode" value={address.pincode} onChange={setA('pincode')} pattern="[0-9]{6}" required />
          </section>

          <section className="panel">
            <h3>Payment method</h3>
            {(['COD', 'PREPAID']).map((m) => (
              <label key={m} className={`pay-opt ${paymentMethod === m ? 'on' : ''}`}>
                <input type="radio" name="pay" value={m} checked={paymentMethod === m} onChange={() => setPaymentMethod(m)} />
                <span><b>{PAYMENT_METHOD_LABEL[m]}</b>
                  {m === 'COD' ? ' — pay the delivery partner when your order arrives.' : ' — pay now online (sandbox demo supports a simulated capture).'}</span>
              </label>
            ))}
            <p className="hint">Checkout computes all prices server-side; totals below are just a preview.</p>
          </section>

          <button className="btn primary big-cta" disabled={busy || !preview}>
            {busy ? 'Placing order…' : `Place order · ${p ? money(p.grandTotal) : ''}`}
          </button>
        </div>

        <aside className="summary">
          <h3>Order summary</h3>
          <div className="coupon">
            <input className="input" placeholder="Coupon code" value={coupon} onChange={(e) => setCoupon(e.target.value)} />
            <button type="button" className="btn ghost small" onClick={() => fetchPreview(coupon)}>Apply</button>
          </div>
          {preview?.items?.map((it) => (
            <div className="sum-row" key={it.productId}><span>{it.productName} × {it.quantity}</span><span>{money(it.lineTotal)}</span></div>
          ))}
          <hr />
          {p && (<>
            <div className="sum-row"><span>Subtotal</span><span>{money(p.subtotal)}</span></div>
            {p.discount > 0 && <div className="sum-row pos"><span>Savings</span><span>−{money(p.discount)}</span></div>}
            {p.couponDiscount > 0 && <div className="sum-row pos"><span>Coupon {p.couponCode || ''}</span><span>−{money(p.couponDiscount)}</span></div>}
            <div className="sum-row"><span>Delivery</span><span>{p.deliveryCharge ? money(p.deliveryCharge) : 'Free'}</span></div>
            <div className="sum-row"><span>Tax</span><span>{money(p.tax)}</span></div>
            <div className="sum-row total"><span>Total</span><span>{money(p.grandTotal)}</span></div>
          </>)}
        </aside>
      </form>
    </div>
  );
}
