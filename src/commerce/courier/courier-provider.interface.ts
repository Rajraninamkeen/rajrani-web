/**
 * External courier-provider abstraction (Session 30 — tracking + POD).
 *
 * Mirrors the PaymentGateway seam from Session 18. The provider owns ONLY the
 * courier-company external I/O: booking a shipment (returns a tracking/waybill
 * number), querying live tracking, and capturing a proof-of-delivery (POD) on
 * the final leg. The local courier state machine (DeliveryAssignment /
 * ReplacementAssignment statuses, timestamps, DeliveryEvent audit) stays in
 * DeliveryService / ReplacementCourierService which remain provider-agnostic.
 *
 * Sandbox is the DEFAULT provider and performs no network I/O (deterministic,
 * safe for tests/E2E). A real courier protocol is reached by setting
 * COURIER_PROVIDER=http + COURIER_BASE_URL (+ COURIER_API_KEY, env-only — never
 * committed) so it can be pointed at a local courier-protocol mock or a real
 * courier API. This seam does not touch money: seller earn stays at order
 * level (earlier owner decision), per-slice payout remains future work.
 */

export const COURIER_PROVIDER = Symbol('COURIER_PROVIDER');

export type CourierKind = 'parcel' | 'replacement';

export type CourierTrackingStatus =
  | 'CREATED'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'FAILED';

/** Local details handed to the courier so it can book a shipment. */
export interface CourierShipmentInput {
  /** local assignmentNumber (e.g. DLVA-… / RDLA-…) — also the idempotency ref */
  ref: string;
  kind: CourierKind;
  description?: string | null;
  recipientName?: string | null;
  phone?: string | null;
  line1?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
}

export interface CourierShipmentOutput {
  carrier: string;
  trackingNumber: string; // courier waybill / tracking number
  trackingUrl?: string | null;
  status: CourierTrackingStatus;
}

export interface CourierTrackingEvent {
  status: CourierTrackingStatus;
  at: string; // ISO
  note?: string | null;
}

export interface CourierTracking {
  trackingNumber: string;
  carrier: string;
  status: CourierTrackingStatus;
  events: CourierTrackingEvent[];
}

export interface CourierPOD {
  podRef: string; // courier proof-of-delivery reference
  signedBy?: string | null;
  at: string; // ISO delivery timestamp
}

export interface CourierProvider {
  /** human/provider carrier name, persisted on the assignment */
  readonly name: string;
  createShipment(input: CourierShipmentInput): Promise<CourierShipmentOutput>;
  track(trackingNumber: string): Promise<CourierTracking>;
  confirmDelivery(trackingNumber: string): Promise<CourierPOD>;
}
