import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  type ServiceUnavailableException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  type GatewayIntentInput,
  type GatewayIntentOutput,
  type GatewayPaymentEvent,
  type GatewayRefundInput,
  type GatewayRefundResult,
  type GatewayWebhookRequest,
  type PaymentGateway,
} from './payment-gateway.interface';

export interface RazorpayGatewayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  /** Overridable base URL so the provider can target a local Razorpay-protocol
   *  mock for E2E (defaults to real api.razorpay.com). */
  baseUrl: string;
}

interface RazorpayApiError {
  error?: { code?: string; description?: string; field?: string; source?: string };
}

const TO_RUPEE = (paise: number): number => Math.round((paise ?? 0) / 100 * 100) / 100;

/**
 * Real Razorpay payment gateway (Session 18) speaking the actual REST wire
 * protocol over Node's global fetch:
 *   - Orders : POST {base}/v1/orders            (Basic auth, amount in paise)
 *   - Webhook: x-razorpay-signature = HMAC-SHA256 hex over the RAW request body
 *   - Refund : POST {base}/v1/payments/:id/refund (amount in paise)
 * No SDK is used; env/base-url override points it at a local protocol mock for
 * live E2E, and later flips to api.razorpay.com with real test keys.
 */
@Injectable()
export class RazorpayGateway implements PaymentGateway {
  readonly provider = 'razorpay';
  private readonly baseUrl: string;
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;
  private readonly logger = new Logger('RazorpayGateway');

  constructor(config: RazorpayGatewayConfig) {
    this.baseUrl = (config.baseUrl ?? 'https://api.razorpay.com').replace(/\/+$/, '');
    this.keyId = config.keyId ?? '';
    this.keySecret = config.keySecret ?? '';
    this.webhookSecret = config.webhookSecret ?? '';
  }

  private authHeader(): string {
    const token = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    return `Basic ${token}`;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: this.authHeader(),
      'Content-Type': 'application/json',
    };
    const res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!res.ok) {
      const err = (json ?? {}) as RazorpayApiError;
      const code = err.error?.code ?? err.error?.description ?? `HTTP ${res.status}`;
      throw new BadRequestException(`Razorpay ${method} ${path} failed: ${code}`);
    }
    return json as T;
  }

  /** POST /v1/orders — create a checkout order; idempotent on `receipt`. */
  async createGatewayIntent(input: GatewayIntentInput): Promise<GatewayIntentOutput> {
    const paise = Math.round(input.amount * 100);
    const data = await this.request<{ id?: string; order_id?: string; amount?: number; currency?: string }>('POST', '/v1/orders', {
      amount: paise,
      currency: input.currency ?? 'INR',
      receipt: input.receipt, // unique idempotency receipt
      payment_capture: 1,
      notes: input.notes,
    });
    const orderId = data.id ?? data.order_id ?? null;
    this.logger.log(`created razorpay order ${orderId} for ₹${input.amount} (receipt ${input.receipt})`);
    return { gatewayOrderId: orderId };
  }

  /** Verify x-razorpay-signature = HMAC-SHA256(hex) over the RAW body with the
   *  WEBHOOK secret (distinct from the API key secret). Constant-time compare. */
  private verifyRawBody(rawBody: Buffer, signature: string): boolean {
    if (!rawBody || !signature) return false;
    const expected = createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    const ea = Buffer.from(expected, 'hex');
    const aa = Buffer.from(signature.toLowerCase(), 'hex');
    if (ea.length !== aa.length) return false;
    return timingSafeEqual(ea, aa);
  }

  /**
   * Verify + normalise a Razorpay webhook into a GatewayPaymentEvent.
   * The provided body may be either the exact raw bytes (preferred, verifies the
   * HMAC) or already-decoded JSON (in which case the raw-body signature must be
   * supplied via headers and cannot be reproduced — we require raw bytes for
   * authenticity). To keep the mock / controller ergonomic we accept:
   *   req.rawBody  = Buffer of the raw request body   (authenticated path)
   * or a pre-parsed body object whose authenticity is judged by signature
   * headers only in test contexts; production always sends raw bytes.
   */
  async parseWebhook(req: GatewayWebhookRequest): Promise<GatewayPaymentEvent> {
    const signature = (req.signature ?? this.header(req.headers, 'x-razorpay-signature')) ?? '';
    if (!req.rawBody || req.rawBody.length === 0) {
      throw new ForbiddenException('Razorpay webhook requires the raw request body to verify HMAC');
    }
    if (!this.verifyRawBody(req.rawBody, signature)) {
      this.logger.warn('razorpay webhook signature verification failed');
      throw new ForbiddenException('Invalid razorpay webhook signature');
    }

    let payload: any;
    try {
      payload = JSON.parse(req.rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException('Razorpay webhook body is not valid JSON');
    }

    const event = payload?.event as string;
    const entity = payload?.payload?.payment?.entity
      ?? payload?.payload?.order?.entity;
    const amountPaise = Number(entity?.amount ?? payload?.payload?.payment?.entity?.amount);
    const eventType = event === 'payment.captured' || event === 'order.paid' ? 'payment.captured'
      : event === 'payment.failed' ? 'payment.failed'
      : null;

    if (!eventType) {
      throw new BadRequestException(`Unsupported razorpay event "${event}"`);
    }

    const gatewayOrderId = entity?.order_id ?? entity?.id ?? null;
    const gatewayPaymentId = payload?.payload?.payment?.entity?.id
      ?? (eventType === 'payment.captured' ? entity?.id : null)
      ?? null;

    return {
      provider: this.provider,
      providerEventId: this.deriveEventId(event, gatewayPaymentId, payload),
      eventType,
      paymentKey: gatewayOrderId ?? gatewayPaymentId ?? '',
      paymentKeyKind: 'gatewayOrderId',
      amount: TO_RUPEE(amountPaise),
      currency: entity?.currency ?? 'INR',
      gatewayPaymentId,
      gatewayOrderId,
      raw: payload,
    };
  }

  private deriveEventId(event: string, gatewayPaymentId: string | null, payload: any): string {
    // Razorpay does not send an event id; build a deterministic unique one from
    // the payment id + event so (provider, providerEventId) dedup is stable.
    const entityId = gatewayPaymentId ?? payload?.payload?.payment?.entity?.id
      ?? payload?.payload?.order?.entity?.id ?? 'unknown';
    return `${entityId}.${event}`;
  }

  private header(headers: Record<string, string | string[] | undefined> | undefined, name: string): string | undefined {
    if (!headers) return undefined;
    const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
    if (!key) return undefined;
    const v = headers[key];
    return Array.isArray(v) ? v[0] : v;
  }

  /** POST /v1/payments/{payment_id}/refund — actually push the money back. */
  async refund(input: GatewayRefundInput): Promise<GatewayRefundResult> {
    const paise = Math.round(input.amount * 100);
    const data = await this.request<{
      id?: string; refund_id?: string; status?: string; error_description?: string;
    }>('POST', `/v1/payments/${input.gatewayPaymentId}/refund`, {
      amount: paise,
      speed: 'normal',
      receipt: input.receipt,
      notes: input.notes,
    });
    const gatewayRef = data.id ?? data.refund_id ?? null;
    if (!gatewayRef) {
      throw new BadRequestException('Razorpay refund succeeded but returned no refund id');
    }
    const rawStatus = (data.status ?? '').toLowerCase();
    const status = rawStatus === 'processed' || rawStatus === 'captured' ? 'COMPLETED'
      : rawStatus === 'pending' ? 'PROCESSING'
      : rawStatus === 'failed' ? 'FAILED'
      : 'PROCESSING';
    this.logger.log(`razorpay refund ${gatewayRef} for payment ${input.gatewayPaymentId} status=${status}`);
    return { gatewayRef, status, gatewayRefundId: gatewayRef };
  }

  /** For tests / tooling: sign a raw body with the webhook secret. */
  signForTesting(rawBody: string): string {
    return createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
  }
}

export type { ServiceUnavailableException };
