import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentService } from './payment.service';
import type { PaymentGateway, GatewayPaymentEvent } from './gateway/payment-gateway.interface';

function makeEvent(overrides: Partial<GatewayPaymentEvent> = {}): GatewayPaymentEvent {
  return {
    category: 'payment',
    provider: 'razorpay',
    providerEventId: 'pay_1.payment.captured',
    eventType: 'payment.captured',
    paymentKey: 'order_ABC',
    paymentKeyKind: 'gatewayOrderId',
    amount: 100,
    currency: 'INR',
    gatewayPaymentId: 'pay_1',
    gatewayOrderId: 'order_ABC',
    raw: { event: 'payment.captured' },
    ...overrides,
  };
}

describe('PaymentService gateway (razorpay) confirm', () => {
  let prisma: any;
  let tx: any;
  let service: PaymentService;

  function freshTx() {
    tx = {
      paymentWebhook: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
      payment: { findUniqueOrThrow: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
      order: { update: jest.fn() },
      paymentTransaction: { create: jest.fn() },
    };
  }

  beforeEach(() => {
    freshTx();
    prisma = {
      paymentWebhook: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn(),
      },
      payment: { findFirst: jest.fn(), findUnique: jest.fn() },
      order: { update: jest.fn() },
      $transaction: jest.fn((fn: any) => fn(tx)),
    };
    service = new PaymentService(prisma);
  });

  it('is sandbox by default when no gateway injected', () => {
    expect(service.provider).toBe('sandbox');
  });

  it('is razorpay when a razorpay gateway is injected', () => {
    const gateway: PaymentGateway = {
      provider: 'razorpay',
      createGatewayIntent: jest.fn() as any,
      parseWebhook: jest.fn() as any,
      refund: jest.fn() as any,
    };
    const s = new PaymentService(prisma, gateway);
    expect(s.provider).toBe('razorpay');
  });

  it('locates the payment by gateway order id and marks the order PAID (capture)', async () => {
    prisma.payment.findFirst.mockResolvedValue({
      id: 'pay-local',
      amount: { toNumber: () => 100 },
      providerPaymentId: 'order_ABC',
      state: 'INITIATED',
      orderId: 'o1',
    });
    tx.payment.update.mockResolvedValue({
      id: 'pay-local', paymentReference: 'PAY-X', provider: 'razorpay', method: 'PREPAID',
      amount: { toNumber: () => 100 }, currency: 'INR', state: 'CONFIRMED', confirmedAt: new Date(),
    });
    tx.payment.findUniqueOrThrow.mockResolvedValue({ state: 'INITIATED', id: 'pay-local' });
    tx.order.update.mockResolvedValue({});
    const res = await service.confirmFromGatewayEvent(makeEvent());
    expect(res.idempotent).toBe(false);
    expect(tx.payment.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ state: 'CONFIRMED', providerCaptureId: 'pay_1' }),
    }));
    expect(tx.order.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { paymentStatus: 'PAID' },
    }));
  });

  it('rejects an amount that does not match the intent', async () => {
    prisma.payment.findFirst.mockResolvedValue({
      id: 'pay-local', amount: { toNumber: () => 100 }, state: 'INITIATED',
    });
    await expect(service.confirmFromGatewayEvent(makeEvent({ amount: 999 }))).rejects.toThrow(BadRequestException);
  });

  it('returns 404 (records failed webhook) when the payment cannot be found', async () => {
    prisma.payment.findFirst.mockResolvedValue(null);
    prisma.paymentWebhook.create.mockResolvedValue({});
    await expect(service.confirmFromGatewayEvent(makeEvent())).rejects.toThrow(NotFoundException);
    expect(prisma.paymentWebhook.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ failureReason: 'payment_not_found' }),
    }));
  });

  it('is idempotent when the event was already processed', async () => {
    prisma.paymentWebhook.findUnique.mockResolvedValue({ processingStatus: 'PROCESSED' });
    const res = await service.confirmFromGatewayEvent(makeEvent());
    expect(res.idempotent).toBe(true);
    expect(prisma.payment.findFirst).not.toHaveBeenCalled();
  });
});
