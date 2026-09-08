/**
 * Payment-gateway provider abstraction (Session 18).
 *
 * Sandbox is the DEFAULT provider and must behave exactly as before. A real
 * gateway (e.g. Razorpay) implements the same interface so the checkout intent
 * path, the confirm-from-webhook path and the LIVE refund-execution path all
 * route through a single seam. Selection is via PAYMENT_GATEWAY_PROVIDER.
 *
 * The gateway is intentionally narrow: it owns ONLY the provider-specific
 * external I/O + signature/normalisation concerns. The money ledger
 * (Payment / PaymentTransaction / PaymentWebhook idempotency, order payment
 * status, refund status + refund_transactions) stays in PaymentService /
 * ReturnsService which remain provider-agnostic.
 */

import type { Prisma } from '../../generated/prisma/client';

/** A provider intent (external gateway order/intent) reference to persist. */
export interface GatewayIntentInput {
  /** internal reference, also used as the external idempotency receipt */
  receipt: string;
  amount: number; // rupees (major units)
  currency: string;
  notes?: Record<string, string>;
}

export interface GatewayIntentOutput {
  /** gateway-side order/intent id, e.g. Razorpay order_id */
  gatewayOrderId?: string | null;
}

/** Normalised event emitted by the gateway to the confirm seam. */
export interface GatewayPaymentEvent {
  provider: string;
  providerEventId: string; // unique per gateway (used for idempotent claim)
  eventType: 'payment.captured' | 'payment.failed';
  /** which local payment this refers to (internal paymentReference or its id) */
  paymentKey: string;
  paymentKeyKind: 'paymentReference' | 'paymentId' | 'gatewayOrderId';
  amount: number; // rupees (major units), from the gateway
  currency?: string;
  gatewayPaymentId?: string | null; // provider captured-payment id
  gatewayOrderId?: string | null;
  raw: unknown;
}

/** A webhook request presented to the confirm endpoint. */
export interface GatewayWebhookRequest {
  /** raw request body BYTES — HMAC/signature must be computed over raw bytes */
  rawBody: Buffer;
  signature?: string | null;
  headers?: Record<string, string | string[] | undefined>;
}

/** Result of refunding a captured payment at the gateway. */
export interface GatewayRefundResult {
  /** real gateway refund reference, e.g. Razorpay rfnd_... id */
  gatewayRef: string;
  /** how the gateway reports the refund now */
  status: 'COMPLETED' | 'PROCESSING' | 'FAILED';
  failureReason?: string | null;
  gatewayRefundId?: string | null;
}

export interface GatewayRefundInput {
  /** the captured payment at the gateway (e.g. Razorpay pay_... id) */
  gatewayPaymentId: string;
  amount: number; // rupees major units
  currency: string;
  receipt: string; // idempotency / internal reference
  notes?: Record<string, string>;
}

export interface PaymentGateway {
  readonly provider: string;

  /**
   * Create an external intent/order. Called by the checkout path. MUST be
   * idempotent on the gateway for the same `receipt` (an external call can
   * never roll back with the surrounding DB transaction, so a retry with the
   * same receipt must not duplicate the external order).
   */
  createGatewayIntent(input: GatewayIntentInput): Promise<GatewayIntentOutput>;

  /**
   * Verify an inbound webhook and normalise it into a GatewayPaymentEvent.
   * Implementations verify authenticity over the raw body bytes, then throw /
   * reject if invalid. A signed event yields providerEventId + amount used by
   * the idempotent confirm seam.
   */
  parseWebhook(req: GatewayWebhookRequest): Promise<GatewayPaymentEvent>;

  /**
   * Actually execute a refund against the gateway. Replaces the historical
   * hardcoded sandbox refund reference. Returns the real gateway reference so
   * the Refund row + RefundTransaction can record it.
   */
  refund(input: GatewayRefundInput): Promise<GatewayRefundResult>;
}

/** Nest DI token for the active gateway provider. */
export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

/** Internal shorthand for the transaction shape used by provider methods. */
export type Tx = Prisma.TransactionClient;
