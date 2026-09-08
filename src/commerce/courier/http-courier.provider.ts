import {
  CourierPOD,
  CourierProvider,
  CourierShipmentInput,
  CourierShipmentOutput,
  CourierTracking,
} from './courier-provider.interface';

/**
 * Real courier protocol provider (Session 30). Speaks a small REST courier
 * contract over COURIER_BASE_URL:
 *
 *   POST {base}/v1/shipments               -> 201 { carrier, trackingNumber, trackingUrl?, status }
 *        body { ref, kind, description?, recipient:{ name?, phone?, line1?, city?, state?, pincode? } }
 *        header Authorization: Bearer {apiKey}
 *   GET  {base}/v1/shipments/:tn/track     -> 200 { trackingNumber, carrier, status, events:[{status,at,note?}] }
 *   POST {base}/v1/shipments/:tn/pod       -> 200 { podRef, signedBy?, at }
 *
 * The base URL is overridable so it can point at a local courier-protocol mock
 * (for E2E) or a real courier API. The apiKey is env-only and never committed.
 */
export interface HttpCourierProviderConfig {
  carrier: string;
  baseUrl: string;
  apiKey: string;
}

export class HttpCourierProvider implements CourierProvider {
  readonly name: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: HttpCourierProviderConfig) {
    this.name = config.carrier || 'External Courier';
    this.baseUrl = (config.baseUrl || '').replace(/\/+$/, '');
    this.apiKey = config.apiKey || '';
  }

  private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!this.baseUrl) throw new Error('COURIER_BASE_URL is not configured');
    const res = await fetch(this.baseUrl + path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        ...(init.headers ?? {}),
      },
    });
    const text = await res.text();
    let body: unknown = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    if (!res.ok) {
      throw new Error(`courier ${init.method ?? 'GET'} ${path} -> ${res.status} ${text.slice(0, 200)}`);
    }
    return body as T;
  }

  async createShipment(input: CourierShipmentInput): Promise<CourierShipmentOutput> {
    const payload = {
      ref: input.ref,
      kind: input.kind,
      description: input.description ?? null,
      recipient: {
        name: input.recipientName ?? null,
        phone: input.phone ?? null,
        line1: input.line1 ?? null,
        city: input.city ?? null,
        state: input.state ?? null,
        pincode: input.pincode ?? null,
      },
    };
    const out = await this.call<CourierShipmentOutput>('/v1/shipments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return {
      carrier: out.carrier ?? this.name,
      trackingNumber: out.trackingNumber,
      trackingUrl: out.trackingUrl ?? null,
      status: out.status ?? 'CREATED',
    };
  }

  async track(trackingNumber: string): Promise<CourierTracking> {
    return this.call<CourierTracking>(`/v1/shipments/${encodeURIComponent(trackingNumber)}/track`);
  }

  async confirmDelivery(trackingNumber: string): Promise<CourierPOD> {
    return this.call<CourierPOD>(`/v1/shipments/${encodeURIComponent(trackingNumber)}/pod`, {
      method: 'POST',
    });
  }
}
