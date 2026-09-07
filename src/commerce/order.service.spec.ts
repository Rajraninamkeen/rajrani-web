import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { OrderService } from './order.service';

function orderRow(id = 'o1') {
  return {
    id,
    orderNumber: 'BK-X',
    userId: 'u1',
    status: 'PLACED',
    paymentMethod: 'COD',
    paymentStatus: 'COD_PENDING',
    placedAt: new Date('2026-09-07T10:00:00Z'),
    subtotal: dec(437),
    discountTotal: dec(0),
    taxTotal: dec(21.85),
    deliveryTotal: dec(49),
    grandTotal: dec(507.85),
    couponDiscount: dec(0),
    couponCode: null,
    addressSnapshot: {},
    items: [],
  };
}

function dec(n: number) {
  const minus = (b: { toNumber(): number }) => dec(n - b.toNumber());
  const div = (b: { toNumber(): number }) => dec(n / b.toNumber());
  const mul = (f: number) => dec(n * f);
  return { toNumber: () => n, gt: (b: { toNumber(): number }) => n > b.toNumber(), minus, div, mul };
}

function productRow(p: { id: string; name: string; price: number; stock: number }) {
  return {
    id: p.id,
    name: p.name,
    slug: p.id,
    status: 'APPROVED',
    visibility: 'LIVE',
    deletedAt: null,
    basePrice: dec(p.price),
    stockOnHand: p.stock,
    weightLabel: '400g',
  };
}

function addr() {
  return { name: 'A', phone: '9876543210', line1: 'x', city: 'y', state: 'z', pincode: '110001' };
}

describe('OrderService', () => {
  let tx: any;
  let prisma: any;
  let service: OrderService;

  function buildTx(rows: any[], stockSucceeds = true, cartClaimable = true) {
    tx = {
      cartItem: { findMany: jest.fn().mockResolvedValue(rows) },
      product: { updateMany: jest.fn().mockResolvedValue({ count: stockSucceeds ? 1 : 0 }) },
      coupon: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
      orderItem: { findMany: jest.fn().mockResolvedValue([]) },
      orderStatusHistory: { create: jest.fn() },
      cart: { updateMany: jest.fn().mockResolvedValue({ count: cartClaimable ? 1 : 0 }) },
      order: {
        create: jest.fn(async (args: any) => ({
          id: 'o1',
          orderNumber: args.data.orderNumber ?? 'BK-TEST',
          status: args.data.status,
          paymentMethod: args.data.paymentMethod,
          paymentStatus: args.data.paymentStatus,
          subtotal: dec(args.data.subtotal),
          discountTotal: dec(args.data.discountTotal),
          taxTotal: dec(args.data.taxTotal),
          deliveryTotal: dec(args.data.deliveryTotal),
          grandTotal: dec(args.data.grandTotal),
          couponDiscount: dec(args.data.couponDiscount),
          couponCode: args.data.couponCode,
          placedAt: new Date(),
          items: [],
        })),
      },
    };
    return tx;
  }

  beforeEach(() => {
    // Ensure tx built per call inside $transaction
    prisma = {
      cart: { findFirst: jest.fn().mockResolvedValue({ id: 'c1', status: 'ACTIVE' }) },
      coupon: { findUnique: jest.fn() },
      order: { findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn() },
      orderItem: { findMany: jest.fn() },
      product: { update: jest.fn() },
      orderStatusHistory: { create: jest.fn() },
      $transaction: jest.fn(),
    };
    service = new OrderService(prisma);
  });

  function runCheckout(rows: any[], stockSucceeds = true) {
    const t = buildTx(rows, stockSucceeds);
    prisma.$transaction.mockImplementation(async (fn: any) => fn(t));
    return service.checkout('u1', {
      cartId: 'c1',
      paymentMethod: 'COD',
      address: addr(),
    } as never);
  }

  it('rejects an empty cart', async () => {
    await expect(runCheckout([])).rejects.toThrow(BadRequestException);
  });

  it('rejects when the cart is not found for the user', async () => {
    prisma.cart.findFirst.mockResolvedValue(null);
    const t = buildTx([], true);
    prisma.$transaction.mockImplementation(async (fn: any) => fn(t));
    await expect(
      service.checkout('u1', { cartId: 'c1', paymentMethod: 'COD', address: addr() } as never),
    ).rejects.toThrow(NotFoundException);
  });

  it('rolls back (throws) when stock reservation fails', async () => {
    const rows = [
      { id: 'i1', quantity: 2, product: productRow({ id: 'p1', name: 'Sev', price: 100, stock: 1 }) },
    ];
    await expect(runCheckout(rows, false)).rejects.toThrow(BadRequestException);
  });

  it('sets COD payment status and free delivery on orders >= threshold', async () => {
    const rows = [
      { id: 'i1', quantity: 6, product: productRow({ id: 'p1', name: 'Sev', price: 100, stock: 100 }) },
    ];
    const result = await runCheckout(rows, true);
    expect(result.price.subtotal).toBe(600);
    expect(result.price.deliveryCharge).toBe(0); // free above 499
    expect(result.paymentStatus).toBe('COD_PENDING');
    expect(result.status).toBe('PLACED');
  });

  it('charges a delivery fee on orders below the threshold', async () => {
    const rows = [
      { id: 'i1', quantity: 1, product: productRow({ id: 'p1', name: 'Sev', price: 100, stock: 100 }) },
    ];
    const result = await runCheckout(rows, true);
    expect(result.price.subtotal).toBe(100);
    expect(result.price.deliveryCharge).toBe(49);
  });

  it('applies a fixed coupon discount into the payable grand total', async () => {
    const rows = [
      { id: 'i1', quantity: 3, product: productRow({ id: 'p1', name: 'Sev', price: 100, stock: 100 }) },
    ];
    prisma.coupon.findUnique.mockResolvedValue({
      id: 'c1',
      code: 'FLAT50',
      type: 'FIXED_AMOUNT',
      value: dec(50),
      minOrderValue: dec(0),
      maxDiscount: null,
      status: 'ACTIVE',
      validFrom: new Date(Date.now() - 1000),
      validTo: new Date(Date.now() + 86400000),
      usageCount: 0,
    });
    const t = buildTx(rows, true);
    prisma.$transaction.mockImplementation(async (fn: any) => fn(t));
    const result = await service.checkout('u1', {
      cartId: 'c1',
      paymentMethod: 'COD',
      address: addr(),
      couponCode: 'FLAT50',
    } as never);
    // subtotal 300 + tax 15 + delivery 49 - coupon 50 = 314
    expect(result.price.couponDiscount).toBe(50);
    expect(result.price.grandTotal).toBe(314);
    expect(t.coupon.update).toHaveBeenCalled(); // usage increment
  });

  it('conflicts when the cart is not active (e.g. already converted)', async () => {
    prisma.cart.findFirst.mockResolvedValue({ id: 'c1', status: 'CONVERTED' });
    const t = buildTx([], true);
    prisma.$transaction.mockImplementation(async (fn: any) => fn(t));
    await expect(
      service.checkout('u1', { cartId: 'c1', paymentMethod: 'COD', address: addr() } as never),
    ).rejects.toThrow(ConflictException);
  });

  it('conflicts when the cart was already claimed inside the transaction (double-checkout race)', async () => {
    const rows = [
      { id: 'i1', quantity: 1, product: productRow({ id: 'p1', name: 'Sev', price: 100, stock: 50 }) },
    ];
    // Cart is ACTIVE up front but the in-transaction claim fails => another checkout won.
    const t = buildTx(rows, true, false);
    prisma.$transaction.mockImplementation(async (fn: any) => fn(t));
    await expect(
      service.checkout('u1', { cartId: 'c1', paymentMethod: 'COD', address: addr() } as never),
    ).rejects.toThrow(ConflictException);
    expect(t.cart.updateMany).toHaveBeenCalled();
  });

  it('lists user orders with pagination and total', async () => {
    prisma.order.findMany.mockResolvedValue([orderRow('o1'), orderRow('o2')]);
    prisma.order.count.mockResolvedValue(2);
    const result = await service.listUserOrders('u1', { page: 1, limit: 1 });
    expect(result.orders.length).toBe(2);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(1);
    expect(result.totalPages).toBe(2);
    // status filter is forwarded to the query
    await service.listUserOrders('u1', { status: 'CANCELLED' as never });
    expect(prisma.order.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { userId: 'u1', status: 'CANCELLED' } }),
    );
  });

  it('rejects cancelling an order that is no longer cancellable', async () => {
    prisma.order.findFirst.mockResolvedValue({ ...orderRow(), status: 'DELIVERED' });
    await expect(service.cancelOrder('u1', 'o1')).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not double-restore stock when a concurrent cancel already won', async () => {
    prisma.order.findFirst.mockResolvedValue(orderRow());
    const items = [
      { productId: 'p1', quantity: 2 },
      { productId: 'p2', quantity: 1 },
    ];
    const t = {
      order: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }), // guarded transition lost
        findUniqueOrThrow: jest.fn(),
      },
      orderItem: { findMany: jest.fn().mockResolvedValue(items) },
      product: { update: jest.fn() },
      orderStatusHistory: { create: jest.fn() },
    };
    prisma.$transaction.mockImplementation(async (fn: any) => fn(t));
    await expect(service.cancelOrder('u1', 'o1')).rejects.toThrow(ConflictException);
    expect(t.product.update).not.toHaveBeenCalled(); // stock untouched on lost race
  });
});
