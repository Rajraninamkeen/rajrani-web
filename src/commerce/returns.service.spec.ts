import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ReturnsService } from './returns.service';

function dec(n: number) {
  return { toNumber: () => n };
}

function order(over: Record<string, any> = {}) {
  return {
    id: 'o1',
    userId: 'u1',
    orderNumber: 'ORD-1',
    status: 'DELIVERED',
    paymentMethod: 'PREPAID',
    paymentStatus: 'PAID',
    currency: 'INR',
    grandTotal: dec(1000),
    deliveredAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

function rr(over: Record<string, any> = {}) {
  return {
    id: 'rr1',
    orderId: 'o1',
    status: 'REQUESTED',
    reasonCode: 'DEFECTIVE',
    reasonNote: 'broken',
    requestedAt: new Date(),
    approvedAt: null,
    rejectedAt: null,
    decisionBy: null,
    decisionReason: null,
    refund: null,
    ...over,
  };
}

describe('ReturnsService', () => {
  let prisma: any;
  let tx: any;
  let service: ReturnsService;

  function setupTx() {
    tx = {
      order: {
        updateMany: jest.fn(async () => ({ count: 1 })),
        update: jest.fn(),
      },
      orderStatusHistory: { create: jest.fn() },
      returnRequest: {
        create: jest.fn(async ({ data }: any) => rr({ status: 'REQUESTED', ...data })),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn(async () => rr()),
      },
      refund: {
        create: jest.fn(async ({ data }: any) => ({ id: 'ref1', ...data, gatewayRef: null, completedAt: null })),
        update: jest.fn(),
      },
      paymentTransaction: { create: jest.fn() },
    };
  }

  beforeEach(() => {
    prisma = {
      order: { findUnique: jest.fn() },
      returnRequest: { findFirst: jest.fn(), findUnique: jest.fn() },
      payment: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    };
    setupTx();
    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));
    service = new ReturnsService(prisma);
  });

  // ---------- request ----------
  it('404 for an order that is not owned by the caller', async () => {
    prisma.order.findUnique.mockResolvedValue(order({ userId: 'someone-else' }));
    await expect(service.request('u1', 'o1', { reasonCode: 'DEFECTIVE' } as any)).rejects.toThrow(NotFoundException);
  });

  it('rejects a return on an order that is not DELIVERED', async () => {
    prisma.order.findUnique.mockResolvedValue(order({ status: 'SHIPPED' }));
    await expect(service.request('u1', 'o1', { reasonCode: 'DEFECTIVE' } as any)).rejects.toThrow(BadRequestException);
  });

  it('rejects a return after the delivery window has closed', async () => {
    const old = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    prisma.order.findUnique.mockResolvedValue(order({ deliveredAt: old }));
    await expect(service.request('u1', 'o1', { reasonCode: 'DEFECTIVE' } as any)).rejects.toThrow(BadRequestException);
  });

  it('creates a return + moves the order to RETURN_REQUESTED with an audited CUSTOMER row', async () => {
    prisma.order.findUnique.mockResolvedValue(order());
    prisma.returnRequest.findFirst.mockResolvedValue(null);
    const res = await service.request('u1', 'o1', { reasonCode: 'DEFECTIVE', note: 'broken seal' });
    expect(res.status).toBe('REQUESTED');
    expect(tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'o1', status: 'DELIVERED' }, data: { status: 'RETURN_REQUESTED' } }),
    );
    expect(tx.returnRequest.create).toHaveBeenCalled();
    const hist = tx.orderStatusHistory.create.mock.calls[0][0].data;
    expect(hist).toMatchObject({ fromStatus: 'DELIVERED', toStatus: 'RETURN_REQUESTED', actor: 'CUSTOMER', actorId: 'u1' });
  });

  it('conflicts when a non-rejected return already exists for the order', async () => {
    prisma.order.findUnique.mockResolvedValue(order());
    prisma.returnRequest.findFirst.mockResolvedValue(rr());
    await expect(service.request('u1', 'o1', { reasonCode: 'DEFECTIVE' } as any)).rejects.toThrow(ConflictException);
  });

  // ---------- decide ----------
  it('requires a reason to reject a return', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue({ ...rr(), order: order() });
    await expect(service.decide('op1', 'rr1', { approve: false } as any)).rejects.toThrow(BadRequestException);
  });

  it('approve moves the order RETURN_REQUESTED -> RETURNED (actor CONTROL)', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue({ ...rr(), order: order() });
    const out = { ...rr(), status: 'APPROVED', approvedAt: new Date() };
    tx.returnRequest.findUniqueOrThrow.mockResolvedValue(out);
    const res = await service.decide('op1', 'rr1', { approve: true, reason: 'ok' });
    expect(res.status).toBe('APPROVED');
    const hist = tx.orderStatusHistory.create.mock.calls[0][0].data;
    expect(hist).toMatchObject({ fromStatus: 'RETURN_REQUESTED', toStatus: 'RETURNED', actor: 'CONTROL', actorId: 'op1' });
  });

  it('reject returns the order to DELIVERED', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue({ ...rr(), order: order() });
    const out = { ...rr(), status: 'REJECTED', rejectedAt: new Date() };
    tx.returnRequest.findUniqueOrThrow.mockResolvedValue(out);
    const res = await service.decide('op1', 'rr1', { approve: false, reason: 'policy' });
    expect(res.status).toBe('REJECTED');
    const hist = tx.orderStatusHistory.create.mock.calls[0][0].data;
    expect(hist.toStatus).toBe('DELIVERED');
  });

  // ---------- refund ----------
  it('blocks refund initiation unless the return is approved', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue({ ...rr({ status: 'REQUESTED' }), order: order() });
    await expect(service.initiateRefund('op1', 'rr1', {})).rejects.toThrow(ConflictException);
  });

  it('rejects a refund amount that exceeds the grand total', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue({ ...rr({ status: 'APPROVED' }), order: order({ status: 'RETURNED' }) });
    await expect(service.initiateRefund('op1', 'rr1', { amount: 99999 } as any)).rejects.toThrow(BadRequestException);
  });

  it('defaults a full refund, uses GATEWAY method for PREPAID, and moves order to REFUND_PENDING', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue({ ...rr({ status: 'APPROVED' }), order: order({ status: 'RETURNED' }) });
    prisma.payment.findUnique.mockResolvedValue({ id: 'pay1' });
    tx.returnRequest.findUniqueOrThrow.mockResolvedValue({ ...rr({ status: 'APPROVED', refund: { id: 'ref1', amount: dec(1000), currency: 'INR', method: 'GATEWAY', status: 'PENDING', refundReference: 'RFD-x', initiatedAt: new Date() } }) });
    const res = await service.initiateRefund('op1', 'rr1', {});
    const refundData = tx.refund.create.mock.calls[0][0].data;
    expect(refundData).toMatchObject({ returnRequestId: 'rr1', method: 'GATEWAY', paymentId: 'pay1', status: 'PENDING' });
    expect(refundData.amount).toBe(1000);
    const hist = tx.orderStatusHistory.create.mock.calls[0][0].data;
    expect(hist).toMatchObject({ fromStatus: 'RETURNED', toStatus: 'REFUND_PENDING', actor: 'CONTROL' });
    expect(res.refund?.method).toBe('GATEWAY');
  });

  it('uses COD refund method for a cash order', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue({
      ...rr({ status: 'APPROVED' }),
      order: order({ status: 'RETURNED', paymentMethod: 'COD', paymentStatus: 'COD_PAID' }),
    });
    prisma.payment.findUnique.mockResolvedValue(null);
    await service.initiateRefund('op1', 'rr1', {});
    const refundData = tx.refund.create.mock.calls[0][0].data;
    expect(refundData.method).toBe('COD');
    expect(refundData.paymentId).toBeUndefined();
  });

  // ---------- complete ----------
  it('completes a pending refund: order REFUNDED + paymentStatus REFUNDED + ledger REFUND row', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue({
      ...rr({ status: 'APPROVED' }),
      order: order({ status: 'REFUND_PENDING' }),
      refund: { id: 'ref1', status: 'PENDING', paymentId: 'pay1', amount: dec(1000), currency: 'INR', gatewayRef: null, completedAt: null, initiatedAt: new Date(), refundReference: 'RFD-x', method: 'GATEWAY' },
    });
    const done = {
      ...rr({ status: 'COMPLETED', completedAt: new Date() }),
      refund: { id: 'ref1', status: 'COMPLETED', amount: dec(1000), currency: 'INR', method: 'GATEWAY', refundReference: 'RFD-x', gatewayRef: 'g1', completedAt: new Date(), initiatedAt: new Date() },
    };
    tx.returnRequest.findUniqueOrThrow.mockResolvedValue(done);
    const res = await service.completeRefund('op1', 'rr1');
    expect(res.status).toBe('COMPLETED');
    expect(res.refund?.status).toBe('COMPLETED');
    const moveCall = tx.order.updateMany.mock.calls[0][0];
    expect(moveCall.where).toEqual({ id: 'o1', status: 'REFUND_PENDING' });
    expect(moveCall.data.status).toBe('REFUNDED');
    expect(tx.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: { paymentStatus: 'REFUNDED' } }));
    const ledger = tx.paymentTransaction.create.mock.calls[0][0].data;
    expect(ledger).toMatchObject({ paymentId: 'pay1', transactionType: 'REFUND', status: 'SUCCESS' });
  });

  it('does not let a non-pending refund be completed twice', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue({
      ...rr(),
      order: order({ status: 'REFUND_PENDING' }),
      refund: { id: 'ref1', status: 'COMPLETED', paymentId: null },
    });
    await expect(service.completeRefund('op1', 'rr1')).rejects.toThrow(ConflictException);
  });
});
