import { useEffect, useState } from 'react';
import { reviewModerationApi } from '../api.js';

const FILTERS = ['PENDING', 'PUBLISHED', 'REJECTED', 'HIDDEN'];
const LABEL = { PENDING: 'Pending', PUBLISHED: 'Published', REJECTED: 'Rejected', HIDDEN: 'Hidden' };
const stars = (r) => '★'.repeat(Math.max(0, Math.min(5, r || 0))) + '☆'.repeat(Math.max(0, 5 - (r || 0)));

export default function StaffReviews({ notify }) {
  const [status, setStatus] = useState('PENDING');
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState('');
  const [openId, setOpenId] = useState(null);

  const load = async (s = status) => {
    setBusy(true);
    try { setRows((await reviewModerationApi.list(s)) ?? []); setErr(''); }
    catch (ex) { setErr(ex.message || 'Load failed'); }
    finally { setBusy(false); }
  };
  useEffect(() => { load(); /* eslint-disable-line */ }, []);

  const onFilter = (s) => { setStatus(s); setOpenId(null); load(s); };

  const run = async (fn, okMsg) => {
    try { await fn(); notify(okMsg); setOpenId(null); load(status); }
    catch (ex) { notify(ex.message || 'Action failed', 'err'); }
  };

  return (
    <div>
      <div className="filters">
        {FILTERS.map((s) => (
          <button key={s} className={`seg ${status === s ? 'active' : ''}`} onClick={() => onFilter(s)}>{LABEL[s]}</button>
        ))}
      </div>
      {err && <div className="alert">{err}</div>}
      {busy ? <div className="center">Loading…</div> : (
        <div className="cards">
          {rows.length === 0 && <div className="card empty">No {LABEL[status].toLowerCase()} reviews.</div>}
          {rows.map((r) => (
            <div className="card product review-card" key={r.id}>
              <div className="product-head" onClick={() => setOpenId(openId === r.id ? null : r.id)}>
                <div>
                  <div className="pname">
                    <span className="revstars">{stars(r.rating)}</span>
                    {r.title ? ` “${r.title}”` : ' (untitled)'}
                  </div>
                  <div className="muted small">
                    {r.product?.name} · by {r.author?.name}{' '}
                    {r.verifiedBuyer && <span className="badge ok">verified buyer</span>}
                  </div>
                </div>
                <div className="right">
                  <span className={`badge st-${r.status}`}>{LABEL[r.status] || r.status}</span>
                  <span className="muted small">{new Date(r.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              {openId === r.id && (
                <div className="detail">
                  <div className="grid2">
                    <div><b>Product</b> {r.product?.name} ({r.product?.slug})</div>
                    <div><b>Author</b> {r.author?.name} {r.verifiedBuyer ? '· verified purchase' : ''}</div>
                    <div><b>Rating</b> {r.rating}/5</div>
                    <div><b>Created</b> {new Date(r.createdAt).toLocaleString()}</div>
                  </div>
                  {r.title && <p><b>Title</b> {r.title}</p>}
                  {r.comment && <p><b>Comment</b><br />{r.comment}</p>}
                  {r.moderationNote && <p className="muted"><b>Moderator note</b> {r.moderationNote} {r.moderatedAt ? `· ${new Date(r.moderatedAt).toLocaleString()}` : ''}</p>}
                  {!r.verifiedBuyer && <p className="muted small">⚠ not a verified purchase</p>}

                  {r.status === 'PENDING' && (
                    <div className="decision-row">
                      <Decision
                        kind="approve" title="Approve" placeholder="note (optional)"
                        onSubmit={(note) => run(() => reviewModerationApi.approve(r.id, note || undefined), 'Approved — review is now public & part of the rating.')} />
                      <Decision
                        kind="reject" title="Reject" required placeholder="reason (required — surfaced to the author)"
                        onSubmit={(note) => run(() => reviewModerationApi.reject(r.id, note), 'Rejected — review hidden from public.')} />
                    </div>
                  )}
                  {r.status === 'PUBLISHED' && (
                    <div className="decision-row">
                      <Decision
                        kind="hide" title="Hide" placeholder="note (optional)"
                        onSubmit={(note) => run(() => reviewModerationApi.hide(r.id, note || undefined), 'Hidden — removed from public & rating.')} />
                    </div>
                  )}
                  {r.status === 'HIDDEN' && (
                    <div className="decision-row">
                      <Decision
                        kind="unhide" title="Unhide" placeholder="note (optional)"
                        onSubmit={(note) => run(() => reviewModerationApi.unhide(r.id, note || undefined), 'Unhidden — back to Published & rating.')} />
                    </div>
                  )}
                  {r.status === 'REJECTED' && (
                    <p className="muted small">Rejected review — the author may edit it to re-submit for moderation. It is not public and does not affect the rating.</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Decision({ kind, title, placeholder, required, onSubmit }) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const danger = kind === 'reject';
  return (
    <div className="decision-col">
      <label>{title} {required && <span className="muted">(required)</span>}
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} />
      </label>
      <button
        className={`btn ${danger ? 'danger' : 'primary'} sm`}
        disabled={busy || (required && !value.trim())}
        onClick={async () => { setBusy(true); try { await onSubmit(value); } finally { setBusy(false); setValue(''); } }}>
        {title}
      </button>
    </div>
  );
}
