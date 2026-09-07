import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { FulfilmentService } from './fulfilment.service';

function baseOrder(over: Record<string, any> = {}) {
  return {
    id: 'o1',
    userId: 'u1',
    orderNumber: 'ORD-0001',
    paymentMethod: 'PREPAID',
    status: 'CONFIRMED',
    paymentStatus: 'PAID',
    deliveredAt: null,
    items: [{ id: 'i1' }],
    ...over,
  };
}

describe('FulfilmentService', () => {
  let prisma: any;
  let orders: any;
  let settlement: any;
  let service: FulfilmentService;

  function mockTx(order: any) {
    return {
      order: {
        updateMany: jest.fn(async ({ where }: any) => ({ count: where.status === order.status ? 1 : 0 })),
        findUniqueOrThrow: jest.fn(async () => order),
      },
      sellerOrder: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      orderStatusHistory: { create: jest.fn() },
    };
  }

  function sellerSlice(over: Record<string, any> = {}) {
    return { id: 'so1', status: 'ACCEPTED', seller: { displayName: 'Bilokat Kitchens' }, ...over };
  }

  beforeEach(() => {
    orders = { toPublicOrder: jest.fn((o: any) => ({ id: o.id, status: o.status })) };
    settlement = { earnDeliveredSlices: jest.fn().mockResolvedValue(0) };
    prisma = {
      order: { findUnique: jest.fn() },
      codVerification: { findUnique: jest.fn() },
      sellerOrder: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(),
    };
    service = new FulfilmentService(prisma, orders, settlement);
  });

  it('throws 404 for an unknown order', async () => {
    prisma.order.findUnique.mockResolvedValue(null);
    await expect(service.advance('op1', 'o1', 'PACKED')).rejects.toThrow(NotFoundException);
  });

  it('rejects an illegal (non-adjacent) transition', async () => {
    prisma.order.findUnique.mockResolvedValue(baseOrder()); // status CONFIRMED
    await expect(service.advance('op1', 'o1', 'DELIVERED')).rejects.toThrow(ConflictException);
  });

  it('rejects confirming a PREPAID order that is not yet PAID', async () => {
    prisma.order.findUnique.mockResolvedValue(baseOrder({ status: 'PLACED', paymentStatus: 'PENDING' }));
    await expect(service.advance('op1', 'o1', 'CONFIRMED')).rejects.toThrow(BadRequestException);
  });

  it('rejects confirming a COD order whose OTP verification has not passed', async () => {
    prisma.order.findUnique.mockResolvedValue(baseOrder({ status: 'PLACED', paymentMethod: 'COD', paymentStatus: 'COD_PENDING' }));
    prisma.codVerification.findUnique.mockResolvedValue({ status: 'PENDING_CUSTOMER_OTP' });
    await expect(service.advance('op1', 'o1', 'CONFIRMED')).rejects.toThrow(BadRequestException);
  });

  it('advances CONFIRMED -> PACKED and writes an audited history row', async () => {
    const order = baseOrder(); // CONFIRMED / PREPAID / PAID
    prisma.order.findUnique.mockResolvedValue(order);
    const tx = mockTx(order);
    tx.order.findUniqueOrThrow.mockResolvedValue({ ...order, status: 'PACKED' });
    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));
    const res = await service.advance('op1', 'o1', 'PACKED', 'packing started');
    expect(res.status).toBe('PACKED');
    expect(tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'o1', status: 'CONFIRMED' }, data: { status: 'PACKED' } }),
    );
    const hist = tx.orderStatusHistory.create.mock.calls[0][0].data;
    expect(hist).toMatchObject({
      orderId: 'o1',
      fromStatus: 'CONFIRMED',
      toStatus: 'PACKED',
      actor: 'CONTROL',
      actorId: 'op1',
      reason: 'packing started',
    });
    expect(orders.toPublicOrder).toHaveBeenCalled();
  });

  it('sets deliveredAt and flips COD_PENDING -> COD_PAID on DELIVERED for a COD order', async () => {
    const order = baseOrder({ paymentMethod: 'COD', paymentStatus: 'COD_PENDING', status: 'OUT_FOR_DELIVERY' });
    prisma.order.findUnique.mockResolvedValue(order);
    const tx = mockTx(order);
    tx.order.findUniqueOrThrow.mockResolvedValue({ ...order, status: 'DELIVERED', deliveredAt: new Date(), paymentStatus: 'COD_PAID' });
    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));
    const res = await service.advance('op1', 'o1', 'DELIVERED');
    expect(res.status).toBe('DELIVERED');
    const data = tx.order.updateMany.mock.calls[0][0].data;
    expect(data.paymentStatus).toBe('COD_PAID');
    expect(data.deliveredAt).toBeInstanceOf(Date);
  });

  it('does NOT touch payment status on DELIVERED for a PREPAID order', async () => {
    const order = baseOrder({ status: 'OUT_FOR_DELIVERY' }); // PREPAID / PAID
    prisma.order.findUnique.mockResolvedValue(order);
    const tx = mockTx(order);
    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));
    await service.advance('op1', 'o1', 'DELIVERED');
    const data = tx.order.updateMany.mock.calls[0][0].data;
    expect(data.paymentStatus).toBeUndefined();
  });

  it('records history even on the default reason when none is supplied', async () => {
    const order = baseOrder();
    prisma.order.findUnique.mockResolvedValue(order);
    const tx = mockTx(order);
    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));
    await service.advance('op1', 'o1', 'PACKED');
    const hist = tx.orderStatusHistory.create.mock.calls[0][0].data;
    expect(hist.reason).toBeTruthy();
    expect(hist.actorId).toBe('op1');
  });

  it('blocks SHIPPED when a seller slice is REJECTED (names the blocker)', async () => {
    prisma.order.findUnique.mockResolvedValue(baseOrder({ status: 'PACKED' }));
    prisma.sellerOrder.findMany.mockResolvedValue([sellerSlice({ status: 'REJECTED' })]);
    await expect(service.advance('op1', 'o1', 'SHIPPED')).rejects.toThrow(
      /Every seller must accept their slice before shipping/,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('blocks SHIPPED when a seller slice is still PLACED (not yet accepted)', async () => {
    prisma.order.findUnique.mockResolvedValue(baseOrder({ status: 'PACKED' }));
    prisma.sellerOrder.findMany.mockResolvedValue([sellerSlice({ status: 'PLACED' })]);
    await expect(service.advance('op1', 'o1', 'SHIPPED')).rejects.toThrow(
      /Not ready: Bilokat Kitchens \(PLACED\)/,
    );
  });

  it('allows SHIPPED when all non-cancelled slices are ACCEPTED and stamps shippedAt', async () => {
    const order = baseOrder({ status: 'PACKED' });
    prisma.order.findUnique.mockResolvedValue(order);
    prisma.sellerOrder.findMany.mockResolvedValue([
      sellerSlice({ id: 'so1' }),
      sellerSlice({ id: 'so2', status: 'ACCEPTED', seller: { displayName: 'Rajrani Select' } }),
    ]);
    const tx = mockTx(order);
    tx.order.findUniqueOrThrow.mockResolvedValue({ ...order, status: 'SHIPPED' });
    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));
    const res = await service.advance('op1', 'o1', 'SHIPPED');
    expect(res.status).toBe('SHIPPED');
    expect(tx.sellerOrder.updateMany).toHaveBeenCalledWith({
      where: { orderId: 'o1', status: 'ACCEPTED' },
      data: { shippedAt: expect.any(Date) },
    });
  });

  it('ignores CANCELLED slices in the shipping gate', async () => {
    const order = baseOrder({ status: 'PACKED' });
    prisma.order.findUnique.mockResolvedValue(order);
    // only a cancelled slice remains => nothing blocking (empty/ignored)
    prisma.sellerOrder.findMany.mockResolvedValue([sellerSlice({ status: 'CANCELLED' })]);
    const tx = mockTx(order);
    tx.order.findUniqueOrThrow.mockResolvedValue({ ...order, status: 'SHIPPED' });
    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));
    await expect(service.advance('op1', 'o1', 'SHIPPED')).resolves.toBeTruthy();
  });

  it('stamps deliveredAt on accepted slices at DELIVERED', async () => {
    const order = baseOrder({ status: 'OUT_FOR_DELIVERY' });
    prisma.order.findUnique.mockResolvedValue(order);
    prisma.sellerOrder.findMany.mockResolvedValue([sellerSlice()]);
    const tx = mockTx(order);
    tx.order.findUniqueOrThrow.mockResolvedValue({ ...order, status: 'DELIVERED', deliveredAt: new Date() });
    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));
    await service.advance('op1', 'o1', 'DELIVERED');
    expect(tx.sellerOrder.updateMany).toHaveBeenCalledWith({
      where: { orderId: 'o1', status: 'ACCEPTED' },
      data: { deliveredAt: expect.any(Date) },
    });
  });
});
