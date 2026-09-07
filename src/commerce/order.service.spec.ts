import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrderService } from './order.service';

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

  function buildTx(rows: any[], stockSucceeds = true) {
    tx = {
      cartItem: { findMany: jest.fn().mockResolvedValue(rows) },
      product: { updateMany: jest.fn().mockResolvedValue({ count: stockSucceeds ? 1 : 0 }) },
      coupon: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
      orderItem: { findMany: jest.fn().mockResolvedValue([]) },
      orderStatusHistory: { create: jest.fn() },
      cart: { update: jest.fn() },
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
      order: { findMany: jest.fn(), findFirst: jest.fn() },
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
});
