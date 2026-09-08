import { useEffect, useState } from 'react';
import { notifyApi } from '../api.js';
import { dateStr } from '../format.jsx';

const CAT = { ORDER_STATUS: ['📦', 'Order'], RETURN_STATUS: ['↩️', 'Return / Refund'] };
const CATS = [
  { k: '', label: 'All' },
  { k: 'ORDER_STATUS', label: 'Orders' },
  { k: 'RETURN_STATUS', label: 'Returns' },
];

// Customer notification centre (#/notifications). Full read surface over the
// /customer/notifications API: category filter, read/unread, mark one/all read.
export default function NotificationsView({ user }) {
  const [cat, setCat] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const unread = items.filter((n) => !n.read).length;

  const load = (c = cat) => {
    setLoading(true); setErr('');
    notifyApi.list({ limit: 100, category: c || undefined })
      .then((d) => setItems(d?.notifications ?? []))
      .catch((e) => setErr(e.message || 'Could not load notifications.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  function switchCat(c) { setCat(c); load(c); }

  async function markOne(id) {
    try { await notifyApi.markRead(id); setItems((xs) => xs.map((x) => (x.id === id ? { ...x, read: true } : x))); }
    catch (e) { setErr(e.message); }
  }
  async function markAll() {
    try { await notifyApi.markAllRead(); setItems((xs) => xs.map((x) => ({ ...x, read: true }))); }
    catch (e) { setErr(e.message); }
  }

  if (!user) {
    return <div className="empty"><h2>Notifications</h2><p>Sign in to see order &amp; return updates.</p>
      <button className="btn primary" onClick={() => { window.location.hash = '/account'; }}>Sign in</button></div>;
  }

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>🔔 Notifications</h1><p className="muted">{unread ? `${unread} unread` : 'You’re all caught up'}</p></div>
        {unread > 0 && <button className="btn ghost small" onClick={markAll}>Mark all read</button>}
      </div>

      <div className="tabs">
        {CATS.map((c) => (
          <button key={c.k} className={`chip ${cat === c.k ? 'on' : ''}`} onClick={() => switchCat(c.k)}>{c.label}</button>
        ))}
      </div>

      {err && <p className="alert err">{err}</p>}
      {loading ? <p className="muted">Loading notifications…</p>
        : items.length === 0 ? (
          <div className="empty">
            <p>No {cat ? CAT[cat]?.[1].toLowerCase() + ' ' : ''}notifications yet. Order &amp; return updates will show up here.</p>
            <button className="btn primary" onClick={() => { window.location.hash = '/'; }}>Browse snacks</button>
          </div>
        ) : (
          <ul className="notif-list">
            {items.map((n) => {
              const [ico] = CAT[n.category] || ['🔔', ''];
              return (
                <li key={n.id} className={'notif' + (n.read ? '' : ' unread')} onClick={() => { if (!n.read) markOne(n.id); }}>
                  <span className="notif-ico">{ico}</span>
                  <div className="notif-body">
                    <div className="notif-title">{n.title} {!n.read && <span className="notif-dot" />}</div>
                    <div className="notif-msg">{n.message}</div>
                    <div className="notif-date">{dateStr(n.createdAt)} · {n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
    </div>
  );
}
