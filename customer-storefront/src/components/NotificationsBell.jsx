import { useEffect, useRef, useState } from 'react';
import { notifyApi } from '../api.js';

const CAT_ICON = { RETURN_STATUS: '↩️', ORDER_STATUS: '📦', RETURN_REQUESTED: '↩️' };

// Session 40 — in-app notifications bell for a signed-in CUSTOMER. Reads the
// buyer's own notices (/customer/notifications), shows an unread badge, and lets
// them mark one/all read. Self-contained inline styles so it renders anywhere.
export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState([]);
  const rootRef = useRef(null);

  const refresh = async (silent) => {
    try {
      const mine = await notifyApi.list({ limit: 15 });
      setItems(mine?.notifications ?? []);
      setUnread(mine?.unreadCount ?? 0);
    } catch { /* ignore transient */ }
  };

  useEffect(() => {
    refresh(true);
    const t = setInterval(() => refresh(true), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onDoc = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const markOne = async (id) => {
    await notifyApi.markRead(id);
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, read: true } : x)));
    setUnread((u) => Math.max(0, u - 1));
  };
  const markAll = async () => {
    await notifyApi.markAllRead();
    setItems((xs) => xs.map((x) => ({ ...x, read: true })));
    setUnread(0);
  };

  return (
    <div ref={rootRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => { const n = !open; setOpen(n); if (n) refresh(); }}
        title="Notifications" aria-label="Notifications"
        style={{
          background: open ? '#222' : '#fff', color: open ? '#fff' : '#333', cursor: 'pointer',
          border: '1px solid #ddd', borderRadius: 999, width: 38, height: 38, fontSize: 17,
          position: 'relative', verticalAlign: 'middle',
        }}>
        🔔
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4, background: '#d0342c', color: '#fff',
            borderRadius: 999, minWidth: 17, height: 17, fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
          }}>{unread > 99 ? '99+' : unread}</span>
        )}
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 46, right: 0, width: 330, maxHeight: 420, overflowY: 'auto',
          background: '#fff', border: '1px solid #e3e3e3', borderRadius: 12, boxShadow: '0 8px 28px rgba(0,0,0,0.16)', padding: 8, zIndex: 70,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px' }}>
            <b style={{ fontSize: 13 }}>Notifications</b>
            {unread > 0 && <button style={{ fontSize: 11, padding: '2px 8px', cursor: 'pointer' }} onClick={markAll}>Mark all read</button>}
          </div>
          {items.length === 0 ? (
            <div style={{ color: '#888', fontSize: 13, padding: '18px 8px' }}>No notifications yet.</div>
          ) : items.map((n) => (
            <div key={n.id} onClick={() => { if (!n.read) markOne(n.id); }}
              style={{
                display: 'flex', gap: 10, padding: '8px', borderRadius: 8, cursor: n.read ? 'default' : 'pointer',
                background: n.read ? 'transparent' : '#f4f7ff', marginBottom: 2,
              }}>
              <div style={{ fontSize: 17 }}>{CAT_ICON[n.category] || '🔔'}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.2 }}>{n.title}</div>
                <div style={{ color: '#555', fontSize: 12, marginTop: 2 }}>{n.message}</div>
                <div style={{ color: '#999', fontSize: 11, marginTop: 3 }}>
                  {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
                </div>
              </div>
              {!n.read && <span style={{ background: '#d0342c', width: 8, height: 8, borderRadius: 99, marginTop: 4, flexShrink: 0 }} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
