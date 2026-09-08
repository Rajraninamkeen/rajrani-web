import { useEffect, useState } from 'react';
import { orderApi, devApi } from '../api.js';
import {
  money, orderStatusLabel, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL, PAYMENT_STATE_LABEL, dateStr,
} from '../format.jsx';

export default function OrderView({ id, notify }) {
  const [order, setOrder] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [payment, setPayment] = useState(null);
  const [cod, setCod] = useState(null);

  const load = async () => {
    const o = await orderApi.get(id);
    setOrder(o);
    if (o.paymentMethod === 'PREPAID') {
      orderApi.payment(id).then(setPayment).catch(() => {});
    } else {
      orderApi.codStatus(id).then(setCod).catch(() => {});
    }
  };
  useEffect(() => {
    setErr('');
    load().catch((e) => setErr(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (err && !order) return <div className="empty">{err}</div>;
  if (!order) return <div className="empty">Loading order…</div>;

  return (
    <div className="order-page">
      <button className="backlink" onClick={() => window.location.hash = '/orders'}>← My orders</button>
      <div className="order-hero">
        <div>
          <h1>{orderStatusLabel(order.status)}</h1>
          <p className="muted">Order {order.orderNumber} · placed {dateStr(order.placedAt)}</p>
        </div>
        <div className="order-badges">
          <span className="pill st">{PAYMENT_METHOD_LABEL[order.paymentMethod]}</span>
          <span className="pill st">{PAYMENT_STATUS_LABEL[order.paymentStatus]}</span>
        </div>
      </div>

      {order.paymentMethod === 'PREPAID' && payment && payment.state !== 'CONFIRMED' && (
        <PrepaidPending order={order} payment={payment} notify={notify} onDone={load} setBusy={setBusy} />
      )}
      {order.paymentMethod === 'PREPAID' && payment && payment.state === 'CONFIRMED' && (
        <div className="alert ok">Payment confirmed — your prepaid order is captured ({money(payment.amount)}).</div>
      )}
      {order.paymentMethod === 'COD' && <CodSection order={order} cod={cod} notify={notify} onStatus={setCod} />}

      <section className="panel">
        <h3>Items</h3>
        <ul className="plain-list">
          {(order.items || []).map((it) => (
            <li key={it.productId} className="plain-row">
              <span><b>{it.productName}</b> × {it.quantity}</span>
              <span>{money(it.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <div className="sum-row"><span>Subtotal</span><span>{money(order.price.subtotal)}</span></div>
        {order.price.couponDiscount > 0 && <div className="sum-row pos"><span>Coupon</span><span>−{money(order.price.couponDiscount)}</span></div>}
        <div className="sum-row"><span>Delivery</span><span>{order.price.deliveryCharge ? money(order.price.deliveryCharge) : 'Free'}</span></div>
        <div className="sum-row"><span>Tax</span><span>{money(order.price.tax)}</span></div>
        <div className="sum-row total"><span>Total</span><span>{money(order.price.grandTotal)}</span></div>
        {(['PLACED', 'CONFIRMED', 'PACKED'].includes(order.status)) && (
          <button className="btn ghost small danger-ghost" onClick={async () => {
            try { await orderApi.cancel(order.id, 'Customer initiated cancel'); notify('Order cancelled'); load(); }
            catch (e) { setErr(e.message); }
          }}>Cancel order</button>
        )}
      </section>
    </div>
  );
}

function PrepaidPending({ order, payment, notify, onDone }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const isSandboxDev = true; // preview runs the local sandbox provider
  return (
    <section className="panel pay-step">
      <h3>Awaiting payment capture</h3>
      <p className="muted">
        Your prepaid order is {PAYMENT_STATE_LABEL[payment.state]} for <b>{money(payment.amount)}</b>
        {' '}(reference {payment.paymentReference}). In production the payment provider confirms this
        via a signed server-to-server callback — a browser cannot (and must not) trigger it.
      </p>
      {isSandboxDev && (
        <div className="dev-harness">
          <p className="hint">Local sandbox demo: simulate the gateway’s capture callback so you can see the order move to Paid.</p>
          <button className="btn primary" disabled={busy} onClick={async () => {
            setBusy(true); setMsg('');
            try { await devApi.sandboxCapture(order.id); notify('Payment captured (order is now PAID)'); await onDone(); }
            catch (e) { setMsg(e.message); }
            finally { setBusy(false); }
          }}>{busy ? 'Capturing…' : 'Simulate gateway capture (dev)'}</button>
          {msg && <div className="alert err">{msg}</div>}
        </div>
      )}
    </section>
  );
}

function CodSection({ order, cod, notify, onStatus }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const devOtp = cod?.devOtp;

  async function sendOtp(e) {
    e.preventDefault();
    setBusy(true); setMsg('');
    try {
      const st = await orderApi.codSendOtp(order.id, phone);
      onStatus(st); setSent(true); notify('OTP generated (see sandbox OTP below)');
      if (st?.devOtp) setCode(st.devOtp);
    } catch (err2) { setMsg(err2.message); }
    finally { setBusy(false); }
  }
  async function verify() {
    setBusy(true); setMsg('');
    try { const st = await orderApi.codVerify(order.id, code); onStatus(st); notify('Order authorized for delivery (COD)'); }
    catch (err2) { setMsg(err2.message); }
    finally { setBusy(false); }
  }
  const verified = cod && (cod.status === 'VERIFIED' || cod.status === 'COMPLETED');

  return (
    <section className="panel pay-step">
      <h3>Cash on delivery</h3>
      {verified ? (
        <div className="alert ok">Delivery confirmed on payment-on-delivery — our team will call before arrival.</div>
      ) : (
        <>
          <p className="muted">Authorize this order so it can move into fulfilment. A one-time code is sent to your secondary mobile.</p>
          <form className="cod-form" onSubmit={sendOtp}>
            <input className="input narrow" placeholder="Secondary mobile (10 digits)" value={phone} onChange={(e) => setPhone(e.target.value)} pattern="[6-9][0-9]{9}" required />
            <button className="btn primary" disabled={busy || sent}>{sent ? 'OTP sent' : 'Send OTP'}</button>
          </form>
          {devOtp && sent && <div className="alert ok">Sandbox OTP: <b>{devOtp}</b></div>}
          {sent && (
            <div className="cod-verify">
              <input className="input narrow" placeholder="Enter 6-digit OTP" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} maxLength={6} />
              <button className="btn primary" disabled={busy} onClick={verify}>Verify</button>
            </div>
          )}
          {msg && <div className="alert err">{msg}</div>}
        </>
      )}
    </section>
  );
}
