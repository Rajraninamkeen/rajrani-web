import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ReturnsService } from './returns.service';

const dec = (n: number) => ({ toNumber: () => n });

function order(over: Record<string, any> = {}) {
  const items = [
    { id: 'oiA', quantity: 1, lineTotal: dec(120), productNameSnapshot: 'Item A' },
    { id: 'oiB', quantity: 1, lineTotal: dec(80), productNameSnapshot: 'Item B' },
  ];
  return {
    id: 'o1',
    userId: 'u1',
    orderNumber: 'ORD-1',
    status: 'DELIVERED',
    paymentMethod: 'PREPAID',
    paymentStatus: 'PAID',
    currency: 'INR',
    grandTotal: dec(200),
    deliveredAt: new Date(),
    updatedAt: new Date(),
    items,
    ...over,
  };
}

// A return public object shaped for toPublic (single return line by default).
function rr(over: Record<string, any> = {}) {
  return {
    id: 'rr1',
    orderId: 'o1',
    status: 'REQUESTED',
    reasonCode: 'DEFECTIVE',
    reasonNote: null,
    requestedAt: new Date(),
    approvedAt: null,
    rejectedAt: null,
    decisionBy: null,
    decisionReason: null,
    pickupScheduledAt: null,
    pickedUpAt: null,
    inspectedAt: null,
    approvedForRefundAt: null,
    completedAt: null,
    cancelledAt: null,
    order: order(),
    items: [],
    refund: null,
    ...over,
  };
}

const line = (over: Record<string, any> = {}) => ({
  id: 'ri1',
  returnRequestId: 'rr1',
  orderItemId: 'oiA',
  orderItem: order().items[0],
  quantity: 1,
  conditionNotes: null,
  inspectionResult: null,
  refundAmount: null,
  replacementRequested: false,
  ...over,
});

describe('ReturnsService (item-level)', () => {
  let prisma: any;
  let tx: any;
  let settlement: any;
  let service: ReturnsService;

  function freshTx() {
    tx = {
      order: { update: jest.fn(), updateMany: jest.fn(async () => ({ count: 1 })) },
      orderStatusHistory: { create: jest.fn() },
      returnRequest: {
        create: jest.fn(async ({ include }: any) => rr({})),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn(async () => rr({})),
      },
      returnItem: { update: jest.fn() },
      returnInspection: { upsert: jest.fn() },
      returnEvent: { create: jest.fn() },
      refund: { create: jest.fn(), update: jest.fn(), aggregate: jest.fn() },
      refundTransaction: { create: jest.fn() },
    };
    prisma = {
      order: { findUnique: jest.fn() },
      returnRequest: { findUnique: jest.fn(), findMany: jest.fn() },
      returnItem: { findMany: jest.fn() },
      refund: { aggregate: jest.fn() },
      payment: { findUnique: jest.fn() },
      $transaction: jest.fn((fn: any) => fn(tx)),
    };
  }

  beforeEach(() => {
    freshTx();
    settlement = { debitReturnedGoodsForRefund: jest.fn().mockResolvedValue({ applied: 0, debits: [] }) };
    service = new ReturnsService(prisma, settlement);
  });

  // ---- request ----
  it('404 when order is not owned by caller', async () => {
    prisma.order.findUnique.mockResolvedValue(order({ userId: 'else' }));
    await expect(service.request('u1', 'o1', { reasonCode: 'DEFECTIVE', items: [{ orderItemId: 'oiA', quantity: 1 }] } as any)).rejects.toThrow(NotFoundException);
  });
  it('rejects a return on a non-delivered order', async () => {
    prisma.order.findUnique.mockResolvedValue(order({ status: 'SHIPPED' }));
    await expect(service.request('u1', 'o1', { reasonCode: 'DEFECTIVE' } as any)).rejects.toThrow(BadRequestException);
  });
  it('rejects a return outside the delivery window', async () => {
    prisma.order.findUnique.mockResolvedValue(order({ deliveredAt: new Date(Date.now() - 20 * 86400000) }));
    await expect(service.request('u1', 'o1', { reasonCode: 'DEFECTIVE' } as any)).rejects.toThrow(BadRequestException);
  });
  it('rejects an item that is not part of the order', async () => {
    prisma.order.findUnique.mockResolvedValue(order());
    prisma.returnItem.findMany.mockResolvedValue([]);
    await expect(service.request('u1', 'o1', { reasonCode: 'DEFECTIVE', items: [{ orderItemId: 'zzz', quantity: 1 }] } as any)).rejects.toThrow(BadRequestException);
  });
  it('rejects quantity exceeding the remaining returnable units', async () => {
    prisma.order.findUnique.mockResolvedValue(order());
    prisma.returnItem.findMany.mockResolvedValue([{ orderItemId: 'oiA', quantity: 1 }]); // 1 already returned of 1
    await expect(service.request('u1', 'o1', { reasonCode: 'DEFECTIVE', items: [{ orderItemId: 'oiA', quantity: 1 }] } as any)).rejects.toThrow(BadRequestException);
  });
  it('creates a REQUESTED return with return items + event when items omitted (full return)', async () => {
    prisma.order.findUnique.mockResolvedValue(order());
    prisma.returnItem.findMany.mockResolvedValue([]);
    tx.returnRequest.create.mockResolvedValue(rr({ status: 'REQUESTED', items: [line()] }));
    const res = await service.request('u1', 'o1', { reasonCode: 'QUALITY_ISSUE' } as any);
    expect(res.status).toBe('REQUESTED');
    const createData = tx.returnRequest.create.mock.calls[0][0].data;
    expect(createData.items.create).toHaveLength(2); // oiA + oiB returned fully
    expect(createData.reasonCode).toBe('QUALITY_ISSUE');
    expect(tx.returnEvent.create).toHaveBeenCalled();
    expect(tx.order.updateMany).not.toHaveBeenCalled(); // order stays DELIVERED
  });

  // ---- decide ----
  it('requires a reason to reject', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue(rr({ status: 'REQUESTED' }));
    await expect(service.decide('op1', 'rr1', { approve: false } as any)).rejects.toThrow(BadRequestException);
  });
  it('approves a REQUESTED return', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue(rr({ status: 'REQUESTED' }));
    tx.returnRequest.findUniqueOrThrow.mockResolvedValue(rr({ status: 'APPROVED', approvedAt: new Date() }));
    const res = await service.decide('op1', 'rr1', { approve: true, reason: 'ok' });
    expect(res.status).toBe('APPROVED');
    expect(tx.returnRequest.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'rr1' }, data: expect.objectContaining({ status: 'APPROVED' }) }));
  });
  it('rejects when a reason is provided', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue(rr({ status: 'REQUESTED' }));
    tx.returnRequest.findUniqueOrThrow.mockResolvedValue(rr({ status: 'REJECTED', rejectedAt: new Date() }));
    const res = await service.decide('op1', 'rr1', { approve: false, reason: 'policy' });
    expect(res.status).toBe('REJECTED');
  });

  // ---- pickup ----
  it('walks APPROVED -> PICKUP_SCHEDULED -> PICKED_UP', async () => {
    prisma.returnRequest.findUnique.mockResolvedValueOnce(rr({ status: 'APPROVED' }))
      .mockResolvedValueOnce(rr({ status: 'PICKUP_SCHEDULED' }));
    tx.returnRequest.findUniqueOrThrow.mockResolvedValueOnce(rr({ status: 'PICKUP_SCHEDULED', pickupScheduledAt: new Date() }));
    const sched = await service.schedulePickup('op1', 'rr1');
    expect(sched.status).toBe('PICKUP_SCHEDULED');

    prisma.returnRequest.findUnique.mockResolvedValueOnce(rr({ status: 'PICKUP_SCHEDULED' }));
    tx.returnRequest.findUniqueOrThrow.mockResolvedValueOnce(rr({ status: 'PICKED_UP', pickedUpAt: new Date() }));
    const up = await service.pickedUp('op1', 'rr1');
    expect(up.status).toBe('PICKED_UP');
  });

  // ---- inspect ----
  it('records inspection; partial results leave the request in INSPECTION', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue(rr({ status: 'PICKED_UP', items: [line()] }));
    // refreshed (after updates): still missing B -> not all inspected
    tx.returnRequest.findUniqueOrThrow
      .mockResolvedValueOnce(rr({ status: 'PICKED_UP', items: [line({ inspectionResult: 'PASS' })] }))
      .mockResolvedValueOnce(rr({ status: 'INSPECTION', items: [line({ inspectionResult: 'PASS' })] }));
    const res = await service.inspect('op1', 'rr1', { items: [{ returnItemId: 'ri1', result: 'PASS' as any, notes: 'ok' }] });
    expect(tx.returnInspection.upsert).toHaveBeenCalled();
    expect(res.status).toBe('INSPECTION');
  });

  it('finalises to APPROVED_FOR_REFUND and sets refund amounts when every item is inspected PASS', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue(rr({ status: 'PICKED_UP', items: [line(), line({ id: 'ri2', orderItemId: 'oiB', orderItem: order().items[1] })] }));
    const both = [
      line({ inspectionResult: 'PASS' }),
      line({ id: 'ri2', orderItemId: 'oiB', orderItem: order().items[1], inspectionResult: 'PASS' }),
    ];
    tx.returnRequest.findUniqueOrThrow
      .mockResolvedValueOnce(rr({ status: 'PICKED_UP', items: both, order: order() })) // refreshed
      .mockResolvedValueOnce(rr({ status: 'APPROVED_FOR_REFUND', approvedForRefundAt: new Date(), items: both })); // final
    const res = await service.inspect('op1', 'rr1', {
      items: [
        { returnItemId: 'ri1', result: 'PASS' as any },
        { returnItemId: 'ri2', result: 'PASS' as any },
      ],
    });
    expect(res.status).toBe('APPROVED_FOR_REFUND');
    expect(tx.returnItem.update).toHaveBeenCalled();
    expect(tx.returnRequest.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'APPROVED_FOR_REFUND' }) }));
  });

  it('blocks inspection unless the request is PICKED_UP', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue(rr({ status: 'REQUESTED', items: [] }));
    await expect(service.inspect('op1', 'rr1', { items: [] })).rejects.toThrow(ConflictException);
  });

  // ---- refund ----
  it('initiates a GATEWAY refund summing approved item amounts', async () => {
    const its = [
      line({ inspectionResult: 'PASS', refundAmount: dec(120) }),
      line({ id: 'ri2', orderItemId: 'oiB', orderItem: order().items[1], inspectionResult: 'PASS', refundAmount: dec(80) }),
    ];
    prisma.returnRequest.findUnique.mockResolvedValue(rr({ status: 'APPROVED_FOR_REFUND', order: order(), items: its }));
    prisma.refund.aggregate.mockResolvedValue({ _sum: { amount: null } });
    prisma.payment.findUnique.mockResolvedValue({ id: 'pay1' });
    tx.returnRequest.findUniqueOrThrow.mockResolvedValue(rr({ status: 'APPROVED_FOR_REFUND', order: order(), items: its }));
    const res = await service.initiateRefund('op1', 'rr1');
    const data = tx.refund.create.mock.calls[0][0].data;
    expect(data.method).toBe('GATEWAY');
    expect(data.paymentId).toBe('pay1');
    expect(data.amount).toBe(200);
    expect(res.refund).toBeNull(); // mock did not return refund on final read
  });

  it('rejects refund initiation when every item failed inspection (amount 0)', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue(rr({ status: 'APPROVED_FOR_REFUND', order: order(), items: [line({ inspectionResult: 'FAIL', refundAmount: dec(0) })] }));
    await expect(service.initiateRefund('op1', 'rr1')).rejects.toThrow(BadRequestException);
  });

  it('completes a refund: COMPLETED + refund_transactions SUCCESS + full order -> REFUNDED', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue(
      rr({ status: 'APPROVED_FOR_REFUND', order: order(),
        items: [line({ refundAmount: dec(200) })],
        refund: { id: 'ref1', status: 'PENDING', paymentId: null, orderId: 'o1', returnRequestId: 'rr1', refundReference: 'RFD-x', amount: dec(200), currency: 'INR', method: 'GATEWAY', gatewayRef: null, initiatedAt: new Date(), completedAt: null, gatewayProvider: 'sandbox' } }),
    );
    tx.refund.aggregate.mockResolvedValue({ _sum: { amount: dec(200) } }); // cumulative full
    tx.returnRequest.findUniqueOrThrow.mockResolvedValue(rr({ status: 'COMPLETED', completedAt: new Date(), items: [line()] }));
    const res = await service.completeRefund('op1', 'rr1');
    expect(res.status).toBe('COMPLETED');
    const txRow = tx.refundTransaction.create.mock.calls[0][0].data;
    expect(txRow).toMatchObject({ refundId: 'ref1', status: 'SUCCESS' });
    expect(txRow.amount.toNumber()).toBe(200);
    expect(tx.order.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'o1' }, data: { status: 'REFUNDED', paymentStatus: 'REFUNDED' } }));
  });

  it('auto-debits the delivered seller slice payable for refunded goods on completeRefund', async () => {
    const refundedLine = line({
      refundAmount: dec(200),
      orderItem: {
        id: 'oiA',
        sellerOrderId: 'soX',
        unitPrice: dec(200),
        quantity: 1,
        lineTotal: dec(200),
        productNameSnapshot: 'Item A',
      },
    });
    prisma.returnRequest.findUnique.mockResolvedValue(
      rr({
        status: 'APPROVED_FOR_REFUND',
        order: order(),
        items: [refundedLine],
        refund: { id: 'ref1', status: 'PENDING', paymentId: null, orderId: 'o1', returnRequestId: 'rr1', refundReference: 'RFD-x', amount: dec(200), currency: 'INR', method: 'GATEWAY', gatewayRef: null, initiatedAt: new Date(), completedAt: null, gatewayProvider: 'sandbox' },
      }),
    );
    tx.refund.aggregate.mockResolvedValue({ _sum: { amount: dec(0) } }); // partial -> stays DELIVERED
    tx.returnRequest.findUniqueOrThrow.mockResolvedValue(rr({ status: 'COMPLETED', completedAt: new Date(), items: [refundedLine] }));
    await service.completeRefund('op1', 'rr1');
    // 200 goods * qty1 returned, grouped under seller slice soX.
    expect(settlement.debitReturnedGoodsForRefund).toHaveBeenCalledWith(
      expect.anything(),
      [{ sellerOrderId: 'soX', returnedGoodsValue: 200 }],
      { refundReference: 'RFD-x', returnRequestId: 'rr1' },
    );
  });

  it('does not complete a non-pending refund twice', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue(
      rr({ status: 'APPROVED_FOR_REFUND', order: order(),
        items: [line()],
        refund: { id: 'ref1', status: 'COMPLETED', paymentId: null, orderId: 'o1', returnRequestId: 'rr1', refundReference: 'RFD-x', amount: dec(10), currency: 'INR', method: 'GATEWAY', gatewayRef: 'g', initiatedAt: new Date(), completedAt: new Date(), gatewayProvider: 'sandbox' } }),
    );
    await expect(service.completeRefund('op1', 'rr1')).rejects.toThrow(ConflictException);
  });
});
