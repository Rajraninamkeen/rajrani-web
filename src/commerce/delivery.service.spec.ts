import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import { DeliveryAssignmentStatus, DeliveryPartnerStatus, OrderStatus, SellerOrderStatus } from '../generated/prisma/client';

describe('DeliveryService (Session 15)', () => {
  let prisma: any;
  let settlement: any;
  let service: DeliveryService;
  let tx: any;

  function freshPrisma() {
    tx = {
      sellerOrder: { update: jest.fn(), findMany: jest.fn() },
      deliveryAssignment: { update: jest.fn(), create: jest.fn() },
      deliveryEvent: { create: jest.fn() },
      order: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      orderStatusHistory: { create: jest.fn() },
    };
    prisma = {
      user: { findUnique: jest.fn() },
      deliveryPartner: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
      deliveryAssignment: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
      deliveryEvent: { findMany: jest.fn(), create: jest.fn() },
      sellerOrder: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), findMany: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
      order: { updateMany: jest.fn() },
      orderStatusHistory: { create: jest.fn() },
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    };
  }

  function partner(id = 'p1') {
    return { id, userId: 'u-deliv', partnerCode: 'DLV-X', status: 'ACTIVE', vehicleType: 'bike' };
  }
  function sellerOrder(over: any = {}) {
    return {
      id: 'so1', orderId: 'o1', sellerId: 's1', sellerOrderNumber: 'SO-1',
      status: SellerOrderStatus.ACCEPTED, deliveredAt: null,
      order: { id: 'o1', status: OrderStatus.SHIPPED, paymentMethod: 'PREPAID' },
      seller: { id: 's1', displayName: 'Shop' },
      ...over,
    };
  }
  function assignment(over: any = {}) {
    return {
      id: 'a1', orderId: 'o1', sellerOrderId: 'so1', deliveryPartnerId: 'p1',
      status: DeliveryAssignmentStatus.ASSIGNED, deliveredAt: null,
      sellerOrder: { id: 'so1', sellerOrderNumber: 'SO-1', status: 'ACCEPTED', shippedAt: new Date(), deliveredAt: null },
      deliveryPartner: { id: 'p1', partnerCode: 'DLV-X', user: { fullName: 'Rider', id: 'u-deliv', email: 'x@y.z' } },
      ...over,
    };
  }

  beforeEach(() => {
    freshPrisma();
    settlement = { earnDeliveredSlices: jest.fn().mockResolvedValue(1) };
    service = new DeliveryService(prisma, settlement);
    // default requirePartner path for DELIVERY users
    prisma.user.findUnique.mockResolvedValue({ id: 'u-deliv', role: 'DELIVERY', status: 'ACTIVE', email: 'r@e.co' });
    prisma.deliveryPartner.findUnique.mockImplementation((args: any) => {
      if (args && args.where && args.where.userId === 'u-deliv') return Promise.resolve(partner());
      return Promise.resolve(partner());
    });
  });

  it('registerPartner requires a DELIVERY-role user', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'CUSTOMER' });
    prisma.deliveryPartner.findUnique.mockResolvedValue(null);
    await expect(service.registerPartner('op1', { userId: 'u1' } as any)).rejects.toThrow(BadRequestException);
  });

  it('registerPartner creates an ACTIVE partner profile with a generated code', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u2', role: 'DELIVERY', email: 'r2@e.co' });
    prisma.deliveryPartner.findUnique.mockResolvedValue(null);
    prisma.deliveryPartner.create.mockResolvedValue({ id: 'p9', userId: 'u2', partnerCode: 'DLV-ABC', status: 'ACTIVE' });
    const p = await service.registerPartner('op1', { userId: 'u2' } as any);
    expect(prisma.deliveryPartner.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'ACTIVE' }) }));
    expect(p.id).toBe('p9');
  });

  it('assignSlice rejects a slice that is not ACCEPTED', async () => {
    prisma.sellerOrder.findUnique.mockResolvedValue(sellerOrder({ status: SellerOrderStatus.PLACED }));
    await expect(service.assignSlice('op1', 'so1', { deliveryPartnerId: 'p1' } as any)).rejects.toThrow(ConflictException);
  });

  it('assignSlice rejects when the order is not in a courier stage', async () => {
    prisma.sellerOrder.findUnique.mockResolvedValue(sellerOrder({ order: { id: 'o1', status: OrderStatus.PACKED } }));
    prisma.deliveryAssignment.findFirst.mockResolvedValue(null);
    await expect(service.assignSlice('op1', 'so1', { deliveryPartnerId: 'p1' } as any)).rejects.toThrow(ConflictException);
  });

  it('assignSlice creates an ASSIGNED assignment', async () => {
    prisma.sellerOrder.findUnique.mockResolvedValue(sellerOrder());
    prisma.deliveryAssignment.findFirst.mockResolvedValue(null);
    tx.deliveryAssignment.create.mockResolvedValue({ id: 'a1', status: 'ASSIGNED', orderId: 'o1', sellerOrderId: 'so1' });
    tx.deliveryEvent.create.mockResolvedValue({ id: 'e' });
    prisma.deliveryAssignment.findUnique.mockResolvedValue(assignment());
    const out = await service.assignSlice('op1', 'so1', { deliveryPartnerId: 'p1' } as any);
    expect(tx.deliveryAssignment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'ASSIGNED' }) }));
    expect(out.status).toBe('ASSIGNED');
  });

  it('assignSlice refuses while an active assignment occupies the slice', async () => {
    prisma.sellerOrder.findUnique.mockResolvedValue(sellerOrder());
    prisma.deliveryAssignment.findFirst.mockResolvedValue({ id: 'a1', status: 'ACCEPTED' });
    await expect(service.assignSlice('op1', 'so1', { deliveryPartnerId: 'p1' } as any)).rejects.toThrow(ConflictException);
  });

  it('rejectTask moves ASSIGNED -> REJECTED with reason', async () => {
    prisma.deliveryAssignment.findUnique.mockResolvedValue(assignment());
    prisma.deliveryAssignment.update.mockResolvedValue(assignment({ status: 'REJECTED' }));
    await service.rejectTask('u-deliv', 'a1', { reason: 'too far' } as any);
    expect(prisma.deliveryAssignment.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'REJECTED', failureReason: 'too far' }),
    }));
    expect(prisma.deliveryEvent.create).toHaveBeenCalled();
  });

  it('forbids a partner acting on an assignment that is not theirs', async () => {
    prisma.deliveryAssignment.findUnique.mockResolvedValue(assignment({ deliveryPartnerId: 'OTHER' }));
    await expect(service.acceptTask('u-deliv', 'a1')).rejects.toThrow(ForbiddenException);
  });

  it('enforces the courier step order (cannot pickup before accept)', async () => {
    prisma.deliveryAssignment.findUnique.mockResolvedValue(assignment());
    await expect(service.pickup('u-deliv', 'a1')).rejects.toThrow(ConflictException);
  });

  it('deliver of a NON-last slice does not finalize the order', async () => {
    prisma.deliveryAssignment.findUnique.mockResolvedValue(assignment({ status: 'OUT_FOR_DELIVERY' }));
    prisma.sellerOrder.findUniqueOrThrow.mockResolvedValue(sellerOrder()); // order SHIPPED
    tx.sellerOrder.update.mockResolvedValue({});
    tx.deliveryAssignment.update.mockResolvedValue({});
    tx.order.updateMany.mockResolvedValue({ count: 1 });
    tx.deliveryEvent.create.mockResolvedValue({});
    // outstanding slices remain (one still not delivered)
    tx.sellerOrder.findMany.mockResolvedValue([{ id: 'so2' }]);
    await service.deliver('u-deliv', 'a1');
    expect(settlement.earnDeliveredSlices).not.toHaveBeenCalled();
  });

  it('deliver of the LAST slice finalizes the order to DELIVERED and earns payables', async () => {
    prisma.deliveryAssignment.findUnique.mockResolvedValue(assignment({ status: 'OUT_FOR_DELIVERY' }));
    prisma.sellerOrder.findUniqueOrThrow.mockResolvedValue(sellerOrder());
    tx.sellerOrder.findMany.mockResolvedValue([]); // no outstanding slices
    tx.sellerOrder.update.mockResolvedValue({});
    tx.deliveryAssignment.update.mockResolvedValue({});
    tx.order.updateMany.mockResolvedValue({ count: 1 });
    tx.orderStatusHistory.create.mockResolvedValue({});
    tx.deliveryEvent.create.mockResolvedValue({});
    await service.deliver('u-deliv', 'a1');
    expect(tx.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'DELIVERED' }),
    }));
    expect(settlement.earnDeliveredSlices).toHaveBeenCalledWith(tx, 'o1');
  });

  it('fail requires a reason and a partner-active stage', async () => {
    prisma.deliveryAssignment.findUnique.mockResolvedValue(assignment({ status: 'OUT_FOR_DELIVERY' }));
    prisma.deliveryAssignment.update.mockResolvedValue(assignment({ status: 'FAILED' }));
    await service.fail('u-deliv', 'a1', { reason: 'customer unavailable' } as any);
    expect(prisma.deliveryAssignment.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'FAILED' }),
    }));
  });
});
