import { useEffect, useRef, useState } from 'react';

// Session 38 — a lightweight in-app notifications bell for the DELIVERY and SELLER
// consoles. Reads the recipient's own finance/payout notifications, shows an unread
// badge, and lets them mark individual notices read or all read. Self-contained
// (inline styles) so it renders in any of the console pages.
export default function NotificationsBell({ api, role }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef(null);

  const refresh = async (silent) => {
    if (!silent) setBusy(true);
    try {
      const mine = await api.mine({ limit: 12 });
      setItems(mine?.notifications ?? []);
      setUnread(mine?.unreadCount ?? 0);
    } catch { /* ignore transient */ }
    finally { if (!silent) setBusy(false); }
  };

  useEffect(() => {
    refresh(true);
    const t = setInterval(() => refresh(true), 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onDoc = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const markOne = async (id) => {
    await api.markRead(id);
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, read: true } : x)));
    setUnread((u) => Math.max(0, u - 1));
  };
  const markAll = async () => {
    const r = await api.readAll();
    setItems((xs) => xs.map((x) => ({ ...x, read: true })));
    setUnread(0);
    return r;
  };

  const catIcon = (c) => ({ COURIER_FEE_EARNED: '🚚', COURIER_FEE_SETTLED: '💵', PAYABLE_EARNED: '📦', SETTLEMENT_ADVANCED: '🏦' }[c] || '🔔');

  return (
    <div ref={rootRef} style={{ position: 'fixed', top: 14, right: 18, zIndex: 60 }}>
      <button onClick={() => { setOpen(!open); if (!open) refresh(true); }}
        title="Notifications" aria-label="Notifications"
        style={{
          background: open ? '#222' : '#fff', color: open ? '#fff' : '#333', cursor: 'pointer',
          border: '1px solid #ddd', borderRadius: 999, width: 40, height: 40, fontSize: 18,
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)', position: 'relative',
        }}>
        🔔
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4, background: '#d0342c', color: '#fff',
            borderRadius: 999, minWidth: 18, height: 18, fontSize: 11, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
          }}>{unread > 99 ? '99+' : unread}</span>
        )}
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 48, right: 0, width: 340, maxHeight: 420, overflowY: 'auto',
          background: '#fff', border: '1px solid #e3e3e3', borderRadius: 12, boxShadow: '0 8px 28px rgba(0,0,0,0.16)', padding: 8,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px' }}>
            <b style={{ fontSize: 13 }}>Notifications · {role}</b>
            <div style={{ display: 'flex', gap: 6 }}>
              {busy && <span className="muted small">…</span>}
              {unread > 0 && <button className="btn sm" style={{ fontSize: 11, padding: '2px 8px' }} onClick={markAll}>Mark all read</button>}
            </div>
          </div>
          {items.length === 0 ? (
            <div style={{ color: '#888', fontSize: 13, padding: '18px 8px' }}>No notifications yet.</div>
          ) : items.map((n) => (
            <div key={n.id} onClick={() => { if (!n.read) markOne(n.id); }}
              style={{
                display: 'flex', gap: 10, padding: '8px', borderRadius: 8, cursor: n.read ? 'default' : 'pointer',
                background: n.read ? 'transparent' : '#f4f7ff', marginBottom: 2,
              }}>
              <div style={{ fontSize: 18 }}>{catIcon(n.category)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: n.read ? 500 : 700, fontSize: 13 }}>{n.title}</div>
                <div style={{ color: '#555', fontSize: 12 }}>{n.message}</div>
                <div style={{ color: '#999', fontSize: 11, marginTop: 2 }}>{new Date(n.createdAt).toLocaleString()}</div>
              </div>
              {n.read && <span style={{ color: '#999', fontSize: 11 }}>✓</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
