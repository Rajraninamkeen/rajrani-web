import { BadRequestException } from '@nestjs/common';
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

/**
 * Default provider (Session 18). Reproduces the historical local "sandbox"
 * behaviour exactly so the existing checkout, confirm and refund flows are
 * unchanged when PAYMENT_GATEWAY_PROVIDER is unset (= sandbox). It performs no
 * external I/O — it fabricates gateway references, as before.
 *
 * NOTE: the legacy sandbox webhook (a signed JSON body with a canonical-string
 * HMAC, i.e. PaymentService.confirmFromWebhook + SandboxWebhookDto) is a
 * different wire format from the gateway parseWebhook seam and is intentionally
 * kept on PaymentService so existing routes/tests stay green.
 */
export class SandboxGateway implements PaymentGateway {
  readonly provider = 'sandbox';

  private readonly secret =
    process.env.PAYMENT_WEBHOOK_SECRET ?? 'bilokat-sandbox-webhook-secret-do-not-use-in-prod';

  async createGatewayIntent(input: GatewayIntentInput): Promise<GatewayIntentOutput> {
    void input;
    // Sandbox creates no external order/intent.
    return { gatewayOrderId: null };
  }

  parseWebhook(req: GatewayWebhookRequest): Promise<GatewayPaymentEvent> {
    void req;
    // Sandbox webhooks use the legacy SandboxWebhookDto confirm path.
    throw new BadRequestException(
      'sandbox gateway does not expose parseWebhook; use the sandbox signed-body webhook instead',
    );
  }

  async refund(input: GatewayRefundInput): Promise<GatewayRefundResult> {
    void input;
    // Historical fabricated reference (same scheme as the old completeRefund).
    const gatewayRef = `sndbox-refund-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    return { gatewayRef, status: 'COMPLETED', gatewayRefundId: gatewayRef };
  }

  /** Legacy sandbox signed-body helpers (moved here for cohesion; PaymentService
   *  keeps thin delegates so the existing spec passes unchanged). */
  canonical(fields: { timestamp: string; eventType: string; paymentReference: string; providerEventId: string; amount: number }): string {
    return [fields.timestamp, fields.eventType, fields.paymentReference, fields.providerEventId, fields.amount].join('.');
  }

  sign(fields: { timestamp: string; eventType: string; paymentReference: string; providerEventId: string; amount: number }): string {
    return this.hmac(this.canonical(fields));
  }

  verify(fields: { timestamp: string; eventType: string; paymentReference: string; providerEventId: string; amount: number; signature: string }): boolean {
    const expected = this.hmac(this.canonical(fields));
    const actual = (fields.signature ?? '').toLowerCase();
    return expected.length === actual.length && this.safeEqual(expected, actual);
  }

  private hmac(input: string): string {
    return createHmac('sha256', this.secret).update(input).digest('hex');
  }

  private safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  }
}
