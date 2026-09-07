import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PaymentMethod, PaymentState, PaymentTransactionType, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentIntentPublic } from './commerce.types';
import { SandboxWebhookDto } from './dto/payment.dto';

// Pluggable gateway providers. Only the sandbox provider is implemented (no keys);
// a real provider (e.g. razorpay) would implement the same interface.
export const GATEWAY_PROVIDER = 'sandbox';

const SANDBOX_SECRET =
  process.env.PAYMENT_WEBHOOK_SECRET ?? 'bilokat-sandbox-webhook-secret-do-not-use-in-prod';

export interface WebhookResult {
  idempotent: boolean;
  providerEventId: string;
  eventType: string;
  processingStatus: string;
  payment?: PaymentIntentPublic;
}

@Injectable()
export class PaymentService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- intent ----------

  /** Create a Payment intent for a freshly-placed PREPAID order (inside its tx). */
  async createIntentTx(
    tx: Prisma.TransactionClient,
    orderId: string,
    amount: number,
    idempotencyKey: string,
  ): Promise<PaymentIntentPublic> {
    const payment = await tx.payment.create({
      data: {
        orderId,
        paymentReference: `PAY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        provider: GATEWAY_PROVIDER,
        method: PaymentMethod.PREPAID,
        state: PaymentState.INITIATED,
        amount,
        currency: 'INR',
        idempotencyKey,
      },
    });
    return this.toPublic(payment);
  }

  async getOrderPayment(userId: string, orderId: string): Promise<PaymentIntentPublic> {
    const payment = await this.prisma.payment.findFirst({
      where: { order: { id: orderId, userId } },
    });
    if (!payment) throw new NotFoundException('No payment intent for this order');
    return this.toPublic(payment);
  }

  // ---------- webhook / confirm (sandbox gateway -> backend) ----------

  async confirmFromWebhook(dto: SandboxWebhookDto): Promise<WebhookResult> {
    if (!this.verifySignature(dto)) {
      // Record the rejected event for audit, then reject.
      await this.prisma.paymentWebhook.create({
        data: {
          provider: GATEWAY_PROVIDER,
          providerEventId: dto.providerEventId,
          eventType: dto.eventType,
          signatureVerified: false,
          processingStatus: 'FAILED',
          failureReason: 'signature_mismatch',
        },
      }).catch(() => undefined);
      throw new ForbiddenException('Invalid webhook signature');
    }

    // Idempotency: an event that was already processed must not reprocess.
    const prior = await this.prisma.paymentWebhook.findUnique({
      where: {
        provider_providerEventId: { provider: GATEWAY_PROVIDER, providerEventId: dto.providerEventId },
      },
    });
    if (prior && prior.processingStatus === 'PROCESSED') {
      return { idempotent: true, providerEventId: dto.providerEventId, eventType: dto.eventType, processingStatus: prior.processingStatus };
    }

    const payment = await this.prisma.payment.findUnique({
      where: { paymentReference: dto.paymentReference },
    });
    if (!payment) {
      await this.prisma.paymentWebhook.create({
        data: {
          provider: GATEWAY_PROVIDER,
          providerEventId: dto.providerEventId,
          eventType: dto.eventType,
          signatureVerified: true,
          processingStatus: 'FAILED',
          failureReason: 'payment_not_found',
        },
      }).catch(() => undefined);
      throw new NotFoundException('Payment intent not found');
    }

    if (Math.round(payment.amount.toNumber()) !== dto.amount) {
      throw new BadRequestException('Webhook amount does not match payment intent');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Record + claim the inbound event atomically (idempotency under concurrency).
      try {
        await tx.paymentWebhook.create({
          data: {
            paymentId: payment.id,
            provider: GATEWAY_PROVIDER,
            providerEventId: dto.providerEventId,
            eventType: dto.eventType,
            signatureVerified: true,
            payloadHash: this.hash(JSON.stringify(dto)),
            processingStatus: 'RECEIVED',
          },
        });
      } catch {
        // Unique (provider, providerEventId) race: another request won.
        return { idempotent: true, providerEventId: dto.providerEventId, eventType: dto.eventType, processingStatus: 'PROCESSED' };
      }

      if (dto.eventType === 'payment.captured') {
        // Already confirmed (duplicate) -> record but ignore.
        const already = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
        if (already.state === PaymentState.CONFIRMED) {
          await tx.paymentWebhook.update({
            where: {
              provider_providerEventId: { provider: GATEWAY_PROVIDER, providerEventId: dto.providerEventId },
            },
            data: { processingStatus: 'IGNORED' },
          });
          return { idempotent: true, providerEventId: dto.providerEventId, eventType: dto.eventType, processingStatus: 'IGNORED' };
        }

        const upd = await tx.payment.update({
          where: { id: payment.id },
          data: {
            state: PaymentState.CONFIRMED,
            confirmedAt: new Date(),
            providerCaptureId: dto.providerEventId,
          },
          include: { order: true },
        });
        await tx.order.update({
          where: { id: upd.orderId },
          data: { paymentStatus: 'PAID' },
        });
        await tx.paymentTransaction.create({
          data: {
            paymentId: payment.id,
            transactionType: PaymentTransactionType.CAPTURE,
            amount: payment.amount,
            currency: 'INR',
            providerReference: dto.providerEventId,
            status: 'SUCCESS',
          },
        });
        await tx.paymentWebhook.update({
          where: {
            provider_providerEventId: { provider: GATEWAY_PROVIDER, providerEventId: dto.providerEventId },
          },
          data: { processingStatus: 'PROCESSED', processedAt: new Date() },
        });
        return {
          idempotent: false,
          providerEventId: dto.providerEventId,
          eventType: dto.eventType,
          processingStatus: 'PROCESSED',
          payment: this.toPublic(upd),
        };
      }

      // payment.failed
      const upd = await tx.payment.update({
        where: { id: payment.id },
        data: { state: PaymentState.FAILED, failedAt: new Date(), errorCode: 'payment_failed' },
        include: { order: true },
      });
      await tx.order.update({ where: { id: upd.orderId }, data: { paymentStatus: 'FAILED' } });
      await tx.paymentTransaction.create({
        data: {
          paymentId: payment.id,
          transactionType: PaymentTransactionType.CHARGE,
          amount: payment.amount,
          currency: 'INR',
          providerReference: dto.providerEventId,
          status: 'FAILED',
        },
      });
      await tx.paymentWebhook.update({
        where: {
          provider_providerEventId: { provider: GATEWAY_PROVIDER, providerEventId: dto.providerEventId },
        },
        data: { processingStatus: 'PROCESSED', processedAt: new Date() },
      });
      return {
        idempotent: false,
        providerEventId: dto.providerEventId,
        eventType: dto.eventType,
        processingStatus: 'PROCESSED',
        payment: this.toPublic(upd),
      };
    });

    return result;
  }

  // ---------- helpers ----------

  private canonical(dto: SandboxWebhookDto): string {
    return [dto.timestamp, dto.eventType, dto.paymentReference, dto.providerEventId, dto.amount].join('.');
  }

  verifySignature(dto: SandboxWebhookDto): boolean {
    const expected = this.hmac(this.canonical(dto));
    const actual = (dto.signature ?? '').toLowerCase();
    return expected.length === actual.length && this.safeEqual(expected, actual);
  }

  private hmac(input: string): string {
    return createHmac('sha256', SANDBOX_SECRET).update(input).digest('hex');
  }

  private hash(input: string): string {
    return createHmac('sha256', SANDBOX_SECRET).update(input).digest('hex');
  }

  private safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  }

  /** For tests / dev tooling only: produce a valid signature for a sandbox payload. */
  signForTesting(dto: { timestamp: string; eventType: string; paymentReference: string; providerEventId: string; amount: number }): string {
    const canonical = [dto.timestamp, dto.eventType, dto.paymentReference, dto.providerEventId, dto.amount].join('.');
    return this.hmac(canonical);
  }

  toPublic(payment: {
    id: string;
    paymentReference: string;
    provider: string;
    method: string;
    amount: { toNumber(): number };
    currency: string;
    state: string;
    idempotencyKey?: string | null;
    confirmedAt?: Date | null;
  }): PaymentIntentPublic {
    return {
      id: payment.id,
      paymentReference: payment.paymentReference,
      provider: payment.provider,
      method: payment.method,
      amount: payment.amount.toNumber(),
      currency: payment.currency,
      state: payment.state,
      clientSecret: payment.state === 'INITIATED' ? payment.idempotencyKey : null,
      confirmedAt: payment.confirmedAt ? payment.confirmedAt.toISOString() : null,
    };
  }
}
