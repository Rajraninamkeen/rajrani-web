import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { SandboxWebhookDto } from './dto/payment.dto';

function makeDto(overrides: Partial<SandboxWebhookDto> = {}): SandboxWebhookDto {
  return {
    providerEventId: 'evt-1',
    paymentReference: 'PAY-ABC123',
    eventType: 'payment.captured',
    amount: 100,
    timestamp: '2026-09-07T13:00:00Z',
    signature: '',
    ...overrides,
  };
}

describe('PaymentService', () => {
  let prisma: any;
  let service: PaymentService;

  beforeEach(() => {
    prisma = {
      paymentWebhook: {
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn(),
      },
      payment: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    };
    service = new PaymentService(prisma);
  });

  it('accepts a payload it signed (round-trip) and rejects a tampered one', () => {
    const dto = makeDto();
    const sig = service.signForTesting({
      timestamp: dto.timestamp,
      eventType: dto.eventType,
      paymentReference: dto.paymentReference,
      providerEventId: dto.providerEventId,
      amount: dto.amount,
    });
    expect(service.verifySignature({ ...dto, signature: sig })).toBe(true);
    expect(service.verifySignature({ ...dto, signature: 'deadbeef' })).toBe(false);
    // changing an amount invalidates the signature
    expect(service.verifySignature({ ...dto, signature: sig, amount: 999 })).toBe(false);
  });

  it('rejects a webhook with a bad signature (403) and does not process', async () => {
    prisma.paymentWebhook.create.mockResolvedValue({});
    await expect(service.confirmFromWebhook(makeDto({ signature: 'bad' }))).rejects.toThrow(ForbiddenException);
  });

  it('rejects an event whose amount does not match the payment intent', async () => {
    const dto = makeDto({ amount: 999 });
    const sig = service.signForTesting({
      timestamp: dto.timestamp,
      eventType: dto.eventType,
      paymentReference: dto.paymentReference,
      providerEventId: dto.providerEventId,
      amount: dto.amount,
    });
    prisma.paymentWebhook.findUnique.mockResolvedValue(null);
    prisma.payment.findUnique.mockResolvedValue({ id: 'p1', amount: { toNumber: () => 100 } });
    await expect(
      service.confirmFromWebhook({ ...dto, signature: sig }),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns 404 when the payment reference is unknown (and records a failed webhook)', async () => {
    const dto = makeDto();
    const sig = service.signForTesting({
      timestamp: dto.timestamp, eventType: dto.eventType, paymentReference: dto.paymentReference,
      providerEventId: dto.providerEventId, amount: dto.amount,
    });
    prisma.paymentWebhook.findUnique.mockResolvedValue(null);
    prisma.payment.findUnique.mockResolvedValue(null);
    await expect(service.confirmFromWebhook({ ...dto, signature: sig })).rejects.toThrow(NotFoundException);
  });

  it('is idempotent: returns already-processed without reprocessing', async () => {
    const dto = makeDto();
    const sig = service.signForTesting({
      timestamp: dto.timestamp, eventType: dto.eventType, paymentReference: dto.paymentReference,
      providerEventId: dto.providerEventId, amount: dto.amount,
    });
    prisma.paymentWebhook.findUnique.mockResolvedValue({ processingStatus: 'PROCESSED' });
    const res = await service.confirmFromWebhook({ ...dto, signature: sig });
    expect(res.idempotent).toBe(true);
  });
});
