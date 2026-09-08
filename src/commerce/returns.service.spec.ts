import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ReturnsService } from './returns.service';
import { ReturnActorType } from '../generated/prisma/client';

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

const repl = (over: Record<string, any> = {}) => ({
  id: 'rpl1',
  returnRequestId: 'rr1',
  orderId: 'o1',
  sellerOrderId: null,
  replacementReference: 'RPL-X',
  status: 'PENDING_DISPATCH',
  quantityTotal: 2,
  issuedBy: 'op1',
  issuedAt: new Date(),
  dispatchedAt: null,
  dispatchReference: null,
  dispatchNote: null,
  dispatchBy: null,
  completedAt: null,
  cancelledAt: null,
  cancellationReason: null,
  ...over,
});

const issuedRR = (replacementOver: Record<string, any> = {}) =>
  rr({
    status: 'REPLACEMENT_ISSUED',
    resolution: 'REPLACEMENT',
    order: order(),
    replacement: repl(replacementOver),
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
      returnEvidence: { create: jest.fn() },
      replacement: { create: jest.fn(), update: jest.fn() },
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

  // ---- Session 16: replacement resolution & evidence ----

  it('request() stores a REPLACEMENT resolution + evidenceRequired + replacementRequested items + evidence', async () => {
    prisma.order.findUnique.mockResolvedValue(order());
    prisma.returnItem.findMany.mockResolvedValue([]);
    const created = rr({
      status: 'REQUESTED',
      resolution: 'REPLACEMENT',
      items: [line({ replacementRequested: true })],
      evidence: [
        { id: 'ev1', returnRequestId: 'rr1', storageObjectId: 'obj-1', fileName: 'photo.jpg', mimeType: 'image/jpeg', sizeBytes: 1024, kind: 'IMAGE', uploadedBy: 'u1', uploadedAt: new Date() },
      ],
    });
    tx.returnRequest.create.mockResolvedValue(created);
    const res = await service.request('u1', 'o1', {
      reasonCode: 'DEFECTIVE',
      resolution: 'REPLACEMENT' as any,
      evidence: [{ storageObjectId: 'obj-1', fileName: 'photo.jpg' }],
    } as any);
    const data = tx.returnRequest.create.mock.calls[0][0].data;
    expect(data.resolution).toBe('REPLACEMENT');
    expect(data.evidenceRequired).toBe(true);
    expect(data.items.create[0].replacementRequested).toBe(true);
    expect(data.evidence.create).toHaveLength(1);
    expect(res.resolution).toBe('REPLACEMENT');
    expect(res.evidence).toHaveLength(1);
  });

  it('request() defaults to REFUND resolution and does not require evidence', async () => {
    prisma.order.findUnique.mockResolvedValue(order());
    prisma.returnItem.findMany.mockResolvedValue([]);
    tx.returnRequest.create.mockResolvedValue(rr({ status: 'REQUESTED', items: [line()] }));
    await service.request('u1', 'o1', { reasonCode: 'DEFECTIVE' } as any);
    const data = tx.returnRequest.create.mock.calls[0][0].data;
    expect(data.resolution).toBe('REFUND');
    expect(data.evidenceRequired).toBe(false);
    expect(data.items.create[0].replacementRequested).toBe(false);
  });

  it('inspect() on a REPLACEMENT resolution issues a terminal Replacement (no refund, no seller debit)', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue(
      rr({ status: 'PICKED_UP', resolution: 'REPLACEMENT', order: order(), items: [line()] }),
    );
    const refreshed = rr({
      status: 'PICKED_UP',
      resolution: 'REPLACEMENT',
      order: order(),
      items: [line({ inspectionResult: 'PASS' })],
    });
    const finalised = rr({
      status: 'REPLACEMENT_ISSUED',
      resolution: 'REPLACEMENT',
      order: order(),
      items: [line({ inspectionResult: 'PASS' })],
      replacement: {
        id: 'rpl1', returnRequestId: 'rr1', orderId: 'o1', sellerOrderId: null,
        replacementReference: 'RPL-X', status: 'PENDING_DISPATCH', quantityTotal: 1,
        issuedBy: 'op1', issuedAt: new Date(), dispatchedAt: null, completedAt: null,
      },
    });
    tx.returnRequest.findUniqueOrThrow
      .mockResolvedValueOnce(refreshed)
      .mockResolvedValueOnce(finalised);
    const res = await service.inspect('op1', 'rr1', { items: [{ returnItemId: 'ri1', result: 'PASS' as any }] });
    expect(res.status).toBe('REPLACEMENT_ISSUED');
    expect(res.replacement?.quantityTotal).toBe(1);
    // Replacement row created, NOT a Refund; return items only record inspection,
    // never a refundAmount allocation.
    expect(tx.replacement.create).toHaveBeenCalled();
    expect(tx.refund.create).not.toHaveBeenCalled();
    for (const call of tx.returnItem.update.mock.calls) {
      expect(call[0].data).not.toHaveProperty('refundAmount');
    }
    expect(tx.returnRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'REPLACEMENT_ISSUED' }) }),
    );
    expect(settlement.debitReturnedGoodsForRefund).not.toHaveBeenCalled();
    const rplData = tx.replacement.create.mock.calls[0][0].data;
    expect(rplData.quantityTotal).toBe(1);
    expect(rplData.status).toBe('PENDING_DISPATCH');
  });

  it('inspect() throws when a REPLACEMENT request has no passing item', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue(
      rr({ status: 'PICKED_UP', resolution: 'REPLACEMENT', order: order(), items: [line()] }),
    );
    tx.returnRequest.findUniqueOrThrow.mockResolvedValueOnce(
      rr({ status: 'PICKED_UP', resolution: 'REPLACEMENT', order: order(), items: [line({ inspectionResult: 'FAIL' })] }),
    );
    await expect(service.inspect('op1', 'rr1', { items: [{ returnItemId: 'ri1', result: 'FAIL' as any }] })).rejects.toThrow(BadRequestException);
    expect(tx.replacement.create).not.toHaveBeenCalled();
    expect(tx.returnRequest.update).not.toHaveBeenCalled();
  });

  it('cannot initiate a refund for a REPLACEMENT_ISSUED request', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue(
      rr({ status: 'REPLACEMENT_ISSUED', resolution: 'REPLACEMENT', order: order(), items: [line()] }),
    );
    await expect(service.initiateRefund('op1', 'rr1')).rejects.toThrow(ConflictException);
    expect(tx.refund.create).not.toHaveBeenCalled();
  });

  it('customer uploads evidence to their own return request (CUSTOMER actor event)', async () => {
    prisma.order.findUnique.mockResolvedValue(order());
    prisma.returnRequest.findUnique.mockResolvedValue(rr({ status: 'PICKED_UP', items: [line()] }));
    tx.returnRequest.findUniqueOrThrow.mockResolvedValue(
      rr({ status: 'PICKED_UP', items: [line()], evidence: [{ id: 'ev1', storageObjectId: 'obj-9', fileName: 'p.jpg', mimeType: 'image/jpeg', sizeBytes: 10, kind: 'IMAGE', uploadedBy: 'u1', uploadedAt: new Date() }] }),
    );
    await service.uploadEvidenceCustomer('u1', 'o1', 'rr1', { storageObjectId: 'obj-9' });
    expect(tx.returnEvidence.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ returnRequestId: 'rr1', storageObjectId: 'obj-9', uploadedBy: 'u1' }) }),
    );
    const eventArgs = tx.returnEvent.create.mock.calls.at(-1)[0].data;
    expect(eventArgs.actorType).toBe(ReturnActorType.CUSTOMER);
    expect(eventArgs.actorId).toBe('u1');
  });

  it('operator uploads evidence on the customer behalf (OPERATOR actor event)', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue(rr({ status: 'APPROVED', items: [line()] }));
    tx.returnRequest.findUniqueOrThrow.mockResolvedValue(
      rr({ status: 'APPROVED', items: [line()], evidence: [] }),
    );
    await service.uploadEvidenceOperator('op1', 'rr1', { storageObjectId: 'obj-10', kind: 'VIDEO' });
    const data = tx.returnEvidence.create.mock.calls[0][0].data;
    expect(data.kind).toBe('VIDEO');
    const eventArgs = tx.returnEvent.create.mock.calls.at(-1)[0].data;
    expect(eventArgs.actorType).toBe(ReturnActorType.OPERATOR);
    expect(eventArgs.actorId).toBe('op1');
  });

  it('blocks evidence upload on a terminal (COMPLETED) request', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue(rr({ status: 'COMPLETED', items: [line()] }));
    await expect(service.uploadEvidenceOperator('op1', 'rr1', { storageObjectId: 'x' })).rejects.toThrow(ConflictException);
    expect(tx.returnEvidence.create).not.toHaveBeenCalled();
  });

  it('404 when customer uploads evidence to another user\'s order', async () => {
    prisma.order.findUnique.mockResolvedValue(order({ userId: 'else' }));
    await expect(service.uploadEvidenceCustomer('u1', 'o1', 'rr1', { storageObjectId: 'x' })).rejects.toThrow(NotFoundException);
  });

  // ---- Session 17: outbound replacement dispatch ----

  it('dispatches a PENDING_DISPATCH replacement -> DISPATCHED (audited, no money)', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue(issuedRR());
    const dispatched = issuedRR({ status: 'DISPATCHED', dispatchedAt: new Date(), dispatchReference: 'TRK-1', dispatchNote: 'courier', dispatchBy: 'op1' });
    tx.returnRequest.findUniqueOrThrow.mockResolvedValue(dispatched);
    const res = await service.dispatchReplacement('op1', 'rr1', { dispatchReference: 'TRK-1', dispatchNote: 'courier' });
    expect(tx.replacement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { returnRequestId: 'rr1' },
        data: expect.objectContaining({ status: 'DISPATCHED', dispatchReference: 'TRK-1', dispatchBy: 'op1' }),
      }),
    );
    const ev = tx.returnEvent.create.mock.calls.at(-1)[0].data;
    expect(ev.eventType).toBe('REPLACEMENT_DISPATCHED');
    expect(ev.actorId).toBe('op1');
    expect(res.replacement!.status).toBe('DISPATCHED');
    // replacement is a non-money outbound leg
    expect(tx.refund.create).not.toHaveBeenCalled();
    expect(settlement.debitReturnedGoodsForRefund).not.toHaveBeenCalled();
  });

  it('blocks dispatch unless the replacement is PENDING_DISPATCH', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue(issuedRR({ status: 'DISPATCHED' }));
    await expect(service.dispatchReplacement('op1', 'rr1', {})).rejects.toThrow(ConflictException);
    expect(tx.replacement.update).not.toHaveBeenCalled();
  });

  it('blocks dispatch unless the return request is REPLACEMENT_ISSUED with a replacement', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue(rr({ status: 'COMPLETED', resolution: 'REFUND' }));
    await expect(service.dispatchReplacement('op1', 'rr1', {})).rejects.toThrow(ConflictException);
  });

  it('completes a DISPATCHED replacement -> COMPLETED', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue(issuedRR({ status: 'DISPATCHED' }));
    tx.returnRequest.findUniqueOrThrow.mockResolvedValue(issuedRR({ status: 'COMPLETED', completedAt: new Date() }));
    const res = await service.completeReplacement('op1', 'rr1');
    expect(tx.replacement.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED' }) }));
    const ev = tx.returnEvent.create.mock.calls.at(-1)[0].data;
    expect(ev.eventType).toBe('REPLACEMENT_COMPLETED');
    expect(res.replacement!.status).toBe('COMPLETED');
  });

  it('blocks completing a replacement that is not yet DISPATCHED', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue(issuedRR({ status: 'PENDING_DISPATCH' }));
    await expect(service.completeReplacement('op1', 'rr1')).rejects.toThrow(ConflictException);
  });

  it('cancels a replacement with a required reason', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue(issuedRR());
    tx.returnRequest.findUniqueOrThrow.mockResolvedValue(issuedRR({ status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: 'out of stock' }));
    const res = await service.cancelReplacement('op1', 'rr1', { reason: 'out of stock' });
    expect(tx.replacement.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELLED', cancellationReason: 'out of stock' }) }),
    );
    const ev = tx.returnEvent.create.mock.calls.at(-1)[0].data;
    expect(ev.eventType).toBe('REPLACEMENT_CANCELLED');
    expect(res.replacement!.status).toBe('CANCELLED');
  });

  it('requires a reason to cancel a replacement', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue(issuedRR());
    await expect(service.cancelReplacement('op1', 'rr1', {} as any)).rejects.toThrow(BadRequestException);
    expect(tx.replacement.update).not.toHaveBeenCalled();
  });

  it('blocks cancelling an already-completed replacement', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue(issuedRR({ status: 'COMPLETED' }));
    await expect(service.cancelReplacement('op1', 'rr1', { reason: 'why' })).rejects.toThrow(ConflictException);
  });

describe('ReturnsService live gateway refund (Session 18)', () => {
  let prisma: any;
  let tx: any;
  let settlement: any;
  let gateway: any;
  let service: ReturnsService;

  beforeEach(() => {
    tx = {
      order: { update: jest.fn() },
      orderStatusHistory: { create: jest.fn() },
      returnRequest: { update: jest.fn(), findUniqueOrThrow: jest.fn(async () => rr({ status: 'COMPLETED', items: [line()] })) },
      refund: { update: jest.fn(), aggregate: jest.fn().mockResolvedValue({ _sum: { amount: dec(200) } }) },
      refundTransaction: { create: jest.fn() },
      returnEvent: { create: jest.fn() },
    };
    prisma = {
      returnRequest: { findUnique: jest.fn() },
      payment: { findUnique: jest.fn() },
      $transaction: jest.fn((fn: any) => fn(tx)),
    };
    settlement = { debitReturnedGoodsForRefund: jest.fn().mockResolvedValue({ applied: 0, debits: [] }) };
    gateway = {
      provider: 'razorpay',
      refund: jest.fn().mockResolvedValue({ gatewayRef: 'rfnd_REAL123', status: 'COMPLETED' }),
      createGatewayIntent: jest.fn(),
      parseWebhook: jest.fn(),
    };
    service = new ReturnsService(prisma, settlement, gateway);
  });

  it('executes a live gateway refund and records the real gatewayRef + provider', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue(
      rr({ status: 'APPROVED_FOR_REFUND', order: order(),
        items: [line({ refundAmount: dec(200), orderItem: { id: 'oiA', sellerOrderId: 'soX', unitPrice: dec(200), quantity: 1 } })],
        refund: { id: 'ref1', status: 'PENDING', paymentId: 'pay9', orderId: 'o1', returnRequestId: 'rr1', refundReference: 'RFD-x', amount: dec(200), currency: 'INR', method: 'GATEWAY', gatewayRef: null, initiatedAt: new Date(), completedAt: null, gatewayProvider: 'sandbox' } }),
    );
    prisma.payment.findUnique.mockResolvedValue({ id: 'pay9', providerCaptureId: 'pay_LIVE', providerPaymentId: 'order_ABC' });
    tx.returnRequest.findUniqueOrThrow.mockResolvedValue(rr({ status: 'COMPLETED', completedAt: new Date(), items: [line()] }));
    const res = await service.completeRefund('op1', 'rr1');
    expect(gateway.refund).toHaveBeenCalledWith(expect.objectContaining({
      gatewayPaymentId: 'pay_LIVE',
      amount: 200,
      receipt: 'RFD-x',
    }));
    expect(tx.refund.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ gatewayRef: 'rfnd_REAL123', gatewayProvider: 'razorpay', status: 'COMPLETED' }),
    }));
    const txRow = tx.refundTransaction.create.mock.calls[0][0].data;
    expect(txRow).toMatchObject({ provider: 'razorpay', providerReference: 'rfnd_REAL123', status: 'SUCCESS' });
    expect(res.status).toBe('COMPLETED');
  });

  it('throws and does not settle when the gateway has no captured payment reference', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue(
      rr({ status: 'APPROVED_FOR_REFUND', order: order(), items: [line({ refundAmount: dec(200) })],
        refund: { id: 'ref1', status: 'PENDING', paymentId: 'pay9', orderId: 'o1', returnRequestId: 'rr1', refundReference: 'RFD-x', amount: dec(200), currency: 'INR', method: 'GATEWAY', gatewayRef: null, initiatedAt: new Date(), completedAt: null, gatewayProvider: 'sandbox' } }),
    );
    prisma.payment.findUnique.mockResolvedValue({ id: 'pay9', providerCaptureId: null, providerPaymentId: null });
    await expect(service.completeRefund('op1', 'rr1')).rejects.toThrow(ConflictException);
    expect(gateway.refund).not.toHaveBeenCalled();
  });
});


});

describe('ReturnsService async gateway refund reconciliation (Session 19)', () => {
  let prisma: any;
  let tx: any;
  let settlement: any;
  let service: ReturnsService;

  beforeEach(() => {
    tx = {
      order: { update: jest.fn(), updateMany: jest.fn() },
      orderStatusHistory: { create: jest.fn() },
      returnRequest: {
        update: jest.fn(),
        findUniqueOrThrow: jest.fn(async () => rr({ status: 'COMPLETED', items: [line()] })),
      },
      refund: {
        update: jest.fn(),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: dec(200) } }),
      },
      refundTransaction: { create: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      returnEvent: { create: jest.fn() },
    };
    prisma = {
      returnRequest: { findUnique: jest.fn() },
      payment: { findUnique: jest.fn() },
      refund: { findFirst: jest.fn(), aggregate: jest.fn() },
      $transaction: jest.fn((fn: any) => fn(tx)),
    };
    settlement = { debitReturnedGoodsForRefund: jest.fn().mockResolvedValue({ applied: 0, debits: [] }) };
    service = new ReturnsService(prisma, settlement);
  });

  const processingRefund = (status = 'PROCESSING') => ({
    id: 'ref1',
    status,
    gatewayProvider: 'razorpay',
    gatewayRef: 'rfnd_PROC1',
    amount: dec(200),
    currency: 'INR',
    orderId: 'o1',
    refundReference: 'RFD-x',
    returnRequestId: 'rr1',
    returnRequest: rr({
      status: 'APPROVED_FOR_REFUND',
      order: order(),
      items: [line({ refundAmount: dec(200), orderItem: { id: 'oiA', sellerOrderId: 'soX', unitPrice: dec(200), quantity: 1 } })],
    }),
  });

  it('refund.processed finalises a PROCESSING refund to COMPLETED + nets the seller payable + marks order REFUNDED', async () => {
    prisma.refund.findFirst.mockResolvedValue(processingRefund());
    tx.returnRequest.findUniqueOrThrow.mockResolvedValue(rr({ status: 'COMPLETED', completedAt: new Date(), items: [line()] }));
    const res = await service.reconcileRefundFromEvent({ provider: 'razorpay', eventType: 'refund.processed', gatewayRefundId: 'rfnd_PROC1', terminalStatus: 'COMPLETED' });
    expect(res).toMatchObject({ idempotent: false, status: 'COMPLETED', gatewayRef: 'rfnd_PROC1' });
    expect(tx.refund.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED' }) }));
    // in-flight transaction row PENDING -> SUCCESS
    expect(tx.refundTransaction.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'SUCCESS' }) }));
    expect(tx.returnRequest.update).toHaveBeenCalled(); // request COMPLETED
    expect(settlement.debitReturnedGoodsForRefund).toHaveBeenCalledWith(tx, expect.arrayContaining([expect.objectContaining({ sellerOrderId: 'soX', returnedGoodsValue: 200 })]), expect.objectContaining({ returnRequestId: 'rr1' }));
    expect(tx.refund.aggregate).toHaveBeenCalled(); // order aggregate REFUNDED path
    expect(tx.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'REFUNDED' }) }));
    expect(tx.returnEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventType: 'REFUND_COMPLETED', actorType: ReturnActorType.SYSTEM }) }));
  });

  it('is idempotent when the refund is already COMPLETED (replay no-op)', async () => {
    prisma.refund.findFirst.mockResolvedValue(processingRefund('COMPLETED'));
    const res = await service.reconcileRefundFromEvent({ provider: 'razorpay', eventType: 'refund.processed', gatewayRefundId: 'rfnd_PROC1', terminalStatus: 'COMPLETED' });
    expect(res).toMatchObject({ idempotent: true, status: 'COMPLETED' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(settlement.debitReturnedGoodsForRefund).not.toHaveBeenCalled();
  });

  it('refund.failed marks the PROCESSING refund FAILED + FAILED txn + audit, leaves request open, no settle', async () => {
    prisma.refund.findFirst.mockResolvedValue(processingRefund());
    const res = await service.reconcileRefundFromEvent({ provider: 'razorpay', eventType: 'refund.failed', gatewayRefundId: 'rfnd_PROC1', terminalStatus: 'FAILED', failureReason: 'insufficient funds' });
    expect(res).toMatchObject({ status: 'FAILED', gatewayRef: 'rfnd_PROC1' });
    expect(tx.refund.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED', failedReason: 'insufficient funds' }) }));
    expect(tx.refundTransaction.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }));
    expect(tx.returnEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventType: 'REFUND_FAILED', actorType: ReturnActorType.SYSTEM }) }));
    expect(tx.returnRequest.update).not.toHaveBeenCalled(); // stays APPROVED_FOR_REFUND
    expect(settlement.debitReturnedGoodsForRefund).not.toHaveBeenCalled();
  });

  it('returns unmatched when the gateway refund id is unknown locally', async () => {
    prisma.refund.findFirst.mockResolvedValue(null);
    const res = await service.reconcileRefundFromEvent({ provider: 'razorpay', eventType: 'refund.processed', gatewayRefundId: 'rfnd_GHOST', terminalStatus: 'COMPLETED' });
    expect(res).toMatchObject({ matched: false, reason: 'refund_not_found' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
