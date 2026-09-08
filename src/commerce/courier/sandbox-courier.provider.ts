import { createHash } from 'crypto';
import {
  CourierPOD,
  CourierProvider,
  CourierShipmentInput,
  CourierShipmentOutput,
  CourierTracking,
  CourierTrackingStatus,
} from './courier-provider.interface';

/**
 * Default courier provider — a deterministic in-process "sandbox" carrier with
 * no network I/O (safe default, used in tests/E2E and in development until a
 * real courier is configured via COURIER_PROVIDER=http).
 *
 * It issues a stable waybill derived from the local assignment ref, so booking
 * the same shipment twice is idempotent, and returns a canned tracking
 * timeline ending in DELIVERED. POD is a deterministic reference.
 */
export class SandboxCourierProvider implements CourierProvider {
  readonly name: string;

  constructor(carrier = 'Sandbox Courier') {
    this.name = carrier;
  }

  private waybill(ref: string): string {
    const h = createHash('sha1').update(ref).digest('hex').slice(0, 8).toUpperCase();
    return `SWB-${h}`;
  }

  async createShipment(input: CourierShipmentInput): Promise<CourierShipmentOutput> {
    return {
      carrier: this.name,
      trackingNumber: this.waybill(input.ref),
      trackingUrl: null,
      status: 'CREATED',
    };
  }

  async track(trackingNumber: string): Promise<CourierTracking> {
    const statuses: CourierTrackingStatus[] = [
      'CREATED',
      'IN_TRANSIT',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
    ];
    const now = Date.now();
    const events = statuses.map((status, i) => ({
      status,
      at: new Date(now + i * 3_600_000).toISOString(),
      note: i === statuses.length - 1 ? 'Delivered — Sandbox Courier' : null,
    }));
    return {
      trackingNumber,
      carrier: this.name,
      status: 'DELIVERED',
      events,
    };
  }

  async confirmDelivery(trackingNumber: string): Promise<CourierPOD> {
    return {
      podRef: `POD-${trackingNumber}`,
      signedBy: this.name,
      at: new Date().toISOString(),
    };
  }
}
