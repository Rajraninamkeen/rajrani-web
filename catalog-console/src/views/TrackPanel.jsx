import { useState } from 'react';

// Session 36 — shared live-courier-tracking read panel for the staff consoles.
// Renders the legs returned by a tracking read (/orders/:id/tracking for OPERATOR,
// /delivery/tasks|replacement-tasks/:id/tracking for DELIVERY). Each leg merges the
// locally-persisted assignment state with the live provider events when a waybill
// exists (best-effort; provider may be null).
const AS = {
  ASSIGNED: 'Assigned', ACCEPTED: 'Accepted', PICKED_UP: 'Picked up', OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered', REJECTED: 'Rejected', FAILED: 'Failed', CANCELLED: 'Cancelled',
};
const dt = (iso) => (iso ? new Date(iso).toLocaleString() : '—');
const human = (s) => (s ? String(s).replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : s);

export default function TrackPanel({ legs }) {
  const [openLeg, setOpenLeg] = useState(0);
  const list = legs || [];
  if (list.length === 0) {
    return <div className="card empty">No courier legs to track for this task/order yet.</div>;
  }
  const leg = list[openLeg] || list[0];
  const milestones = [
    leg.assignedAt && { at: leg.assignedAt, label: 'Assigned to courier' },
    leg.acceptedAt && { at: leg.acceptedAt, label: 'Accepted by courier' },
    leg.pickedUpAt && { at: leg.pickedUpAt, label: 'Picked up' },
    leg.outForDeliveryAt && { at: leg.outForDeliveryAt, label: 'Out for delivery' },
    leg.deliveredAt && { at: leg.deliveredAt, label: 'Delivered' },
  ].filter(Boolean);
  const events = (leg.provider?.events || []).map((e) => ({ at: e.at, label: human(e.status), note: e.note }));

  return (
    <div className="card">
      {list.length > 1 && (
        <div className="filters" style={{ marginBottom: 8 }}>
          {list.map((l, i) => (
            <button key={i} className={`seg ${i === openLeg ? 'active' : ''}`} onClick={() => setOpenLeg(i)}>
              {l.legType === 'parcel' ? 'Parcel' : 'Replacement'}{l.reference ? ` · ${l.reference}` : ''}
            </button>
          ))}
        </div>
      )}
      <div className="row-between">
        <div>
          <div className="pname">{leg.title} <span className="muted small">({leg.assignmentNumber})</span></div>
          <div className="muted small">Carrier: {leg.carrier || 'internal'}
            {leg.trackingNumber ? ` · waybill ${leg.trackingNumber}` : ' · no waybill yet (not picked up)'}
            {leg.trackingUrl ? ` · ${leg.trackingUrl}` : ''}
          </div>
        </div>
        <div className="right">
          <span className={`badge st-${leg.status}`}>{AS[leg.status] || leg.status}</span>
          {leg.provider?.status && <span className="badge st-PICKED_UP">{human(leg.provider.status)}</span>}
        </div>
      </div>
      {leg.provider?.carrier && <div className="muted small" style={{ marginTop: 4 }}>Live provider status: <b>{leg.provider.carrier}</b> — {human(leg.provider.status)}</div>}

      <div className="grid2" style={{ marginTop: 8 }}>
        {leg.failureReason && <div><b>Failure</b> {leg.failureReason}</div>}
        {leg.podSignedBy && <div><b>POD</b> signed {leg.podSignedBy} @ {dt(leg.podAt)}</div>}
      </div>

      <h4>{leg.provider?.events?.length ? 'Live courier timeline' : 'Assignment timeline'}</h4>
      <ul className="timeline">
        {(events.length ? events : milestones).map((e, i) => (
          <li key={i}>
            <b>{e.label}</b>{e.note ? <span className="muted"> — {e.note}</span> : ''}
            <span className="muted"> · {dt(e.at)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
