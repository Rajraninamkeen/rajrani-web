import { useEffect, useState } from 'react';
import { orderApi } from '../api.js';
import { money, orderStatusLabel, PAYMENT_METHOD_LABEL, dateStr } from '../format.jsx';

export default function OrdersView({ user }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    orderApi.list({ page: 1, limit: 50 })
      .then(setData).catch((e) => setErr(e.message));
  }, []);

  if (!user) {
    return <div className="auth-wrap"><div className="auth">
      <h2>Your orders</h2><p className="muted">Sign in to view your orders.</p>
      <a className="btn primary" href="#/account">Sign in</a>
    </div></div>;
  }

  if (!data) return <div className="empty">{err || 'Loading orders…'}</div>;

  if (data.orders.length === 0) {
    return <div className="order-page"><h2>My orders</h2><div className="empty">No orders yet. <a href="#/">Browse the shop.</a></div></div>;
  }

  return (
    <div className="order-page">
      <h2>My orders</h2>
      {err && <div className="alert err">{err}</div>}
      <ul className="plain-list orders">
        {data.orders.map((o) => (
          <li key={o.id} className="order-card">
            <a href={`#/order/${o.id}`} className="order-main">
              <div>
                <div className="order-no">#{o.orderNumber}</div>
                <div className="muted">{dateStr(o.placedAt)} · {o.items?.length} item{o.items?.length === 1 ? '' : 's'}</div>
              </div>
              <div className="order-right">
                <span className="pill st order-status">{orderStatusLabel(o.status)}</span>
                <span className="muted">{PAYMENT_METHOD_LABEL[o.paymentMethod]}</span>
                <b>{money(o.price.grandTotal)}</b>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
