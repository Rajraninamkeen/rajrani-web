import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SellerOpsService } from './seller-ops.service';

function dec(n: number) {
  return { toNumber: () => n };
}

describe('SellerOpsService', () => {
  let prisma: any;
  let service: SellerOpsService;

  const sellerUser = { id: 'u1', role: 'SELLER', sellerId: 's1' };
  const customerUser = { id: 'u1', role: 'CUSTOMER', sellerId: null };
  const unboundSeller = { id: 'u1', role: 'SELLER', sellerId: null };

  function sellerOrderRow(status = 'PLACED') {
    return {
      id: 'so1',
      sellerOrderNumber: 'SO-1',
      status,
      orderId: 'o1',
      subtotal: dec(100),
      grandTotal: dec(109),
      sellerAmount: dec(109),
      acceptedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      order: { orderNumber: 'BK-1', placedAt: new Date(), status: 'PLACED' },
      items: [{ id: 'oi1', productNameSnapshot: 'Sev', quantity: 1, lineTotal: dec(100) }],
    };
  }

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn() },
      seller: { findFirst: jest.fn(), findUniqueOrThrow: jest.fn() },
      product: { findMany: jest.fn().mockResolvedValue([]) },
      sellerOrder: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    service = new SellerOpsService(prisma);
  });

  it('forbids non-seller users', async () => {
    prisma.user.findUnique.mockResolvedValue(customerUser);
    await expect(service.listSellerOrders('u1')).rejects.toThrow(ForbiddenException);
  });

  it('forbids a SELLER user that is not bound to a seller org', async () => {
    prisma.user.findUnique.mockResolvedValue(unboundSeller);
    await expect(service.listSellerOrders('u1')).rejects.toThrow(ForbiddenException);
  });

  it('forbids an inactive seller org', async () => {
    prisma.user.findUnique.mockResolvedValue(sellerUser);
    prisma.seller.findFirst.mockResolvedValue(null);
    await expect(service.listSellerOrders('u1')).rejects.toThrow(ForbiddenException);
  });

  it('lists only the seller\'s own seller_orders scoped by sellerId', async () => {
    prisma.user.findUnique.mockResolvedValue(sellerUser);
    prisma.seller.findFirst.mockResolvedValue({ id: 's1', status: 'ACTIVE' });
    prisma.sellerOrder.findMany.mockResolvedValue([sellerOrderRow()]);
    prisma.sellerOrder.count.mockResolvedValue(1);
    const res = await service.listSellerOrders('u1');
    expect(prisma.sellerOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sellerId: 's1' } }),
    );
    expect(res.items.length).toBe(1);
  });

  it('accept moves a PLACED seller order to ACCEPTED', async () => {
    prisma.user.findUnique.mockResolvedValue(sellerUser);
    prisma.seller.findFirst.mockResolvedValue({ id: 's1', status: 'ACTIVE' });
    prisma.sellerOrder.findFirst.mockResolvedValue(sellerOrderRow('ACCEPTED'));
    const res = await service.accept('u1', 'so1');
    expect(prisma.sellerOrder.updateMany).toHaveBeenCalledWith({
      where: { id: 'so1', sellerId: 's1', status: 'PLACED' },
      data: { status: 'ACCEPTED', acceptedAt: expect.any(Date) },
    });
    expect(res.status).toBe('ACCEPTED');
  });

  it('reject requires a reason', async () => {
    prisma.user.findUnique.mockResolvedValue(sellerUser);
    prisma.seller.findFirst.mockResolvedValue({ id: 's1', status: 'ACTIVE' });
    await expect(service.reject('u1', 'so1', '')).rejects.toThrow(BadRequestException);
  });

  it('reject moves a PLACED seller order to REJECTED with reason', async () => {
    prisma.user.findUnique.mockResolvedValue(sellerUser);
    prisma.seller.findFirst.mockResolvedValue({ id: 's1', status: 'ACTIVE' });
    prisma.sellerOrder.findFirst.mockResolvedValue(sellerOrderRow('REJECTED'));
    const res = await service.reject('u1', 'so1', 'Out of stock');
    expect(prisma.sellerOrder.updateMany).toHaveBeenCalledWith({
      where: { id: 'so1', sellerId: 's1', status: 'PLACED' },
      data: { status: 'REJECTED', rejectedAt: expect.any(Date), rejectionReason: 'Out of stock' },
    });
    expect(res.status).toBe('REJECTED');
  });

  it('accepting a non-PLACED seller order throws BadRequest', async () => {
    prisma.user.findUnique.mockResolvedValue(sellerUser);
    prisma.seller.findFirst.mockResolvedValue({ id: 's1', status: 'ACTIVE' });
    prisma.sellerOrder.updateMany.mockResolvedValue({ count: 0 }); // transition lost
    prisma.sellerOrder.findFirst.mockResolvedValue(sellerOrderRow('REJECTED'));
    await expect(service.accept('u1', 'so1')).rejects.toThrow(BadRequestException);
  });

  it('404 when the seller order is not the caller\'s own', async () => {
    prisma.user.findUnique.mockResolvedValue(sellerUser);
    prisma.seller.findFirst.mockResolvedValue({ id: 's1', status: 'ACTIVE' });
    prisma.sellerOrder.updateMany.mockResolvedValue({ count: 0 });
    prisma.sellerOrder.findFirst.mockResolvedValue(null);
    await expect(service.accept('u1', 'so1')).rejects.toThrow(NotFoundException);
  });
});
