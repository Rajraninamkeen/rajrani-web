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

function productRow(p: { id: string; name: string; price: number; stock: number }, seller = 's1') {
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
    sellerId: seller,
    seller: { id: seller, displayName: seller === 's1' ? 'Seller One' : 'Seller Two' },
  };
}

const sellersByName: Record<string, { id: string; displayName: string }> = {
  s1: { id: 's1', displayName: 'Seller One' },
  s2: { id: 's2', displayName: 'Seller Two' },
};

function addr() {
  return { name: 'A', phone: '9876543210', line1: 'x', city: 'y', state: 'z', pincode: '110001' };
}

describe('OrderService', () => {
  let tx: any;
  let prisma: any;
  let service: OrderService;

  function buildTx(rows: any[], stockSucceeds = true, cartClaimable = true) {
    const items: any[] = [];
    const sellerOrders: any[] = [];
    let created: any = null;
    const orderFrom = (args: any) => ({
      id: 'o1',
      orderNumber: args.data.orderNumber ?? 'BK-TEST',
      userId: args.data.userId,
      status: args.data.status,
      paymentMethod: args.data.paymentMethod,
      paymentStatus: args.data.paymentStatus,
      placedAt: new Date(),
      subtotal: dec(args.data.subtotal),
      discountTotal: dec(args.data.discountTotal),
      taxTotal: dec(args.data.taxTotal),
      deliveryTotal: dec(args.data.deliveryTotal),
      grandTotal: dec(args.data.grandTotal),
      couponDiscount: dec(args.data.couponDiscount),
      couponCode: args.data.couponCode,
      addressSnapshot: {},
    });
    tx = {
      cartItem: { findMany: jest.fn().mockResolvedValue(rows) },
      product: { updateMany: jest.fn().mockResolvedValue({ count: stockSucceeds ? 1 : 0 }) },
      coupon: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
      orderStatusHistory: { create: jest.fn() },
      cart: { updateMany: jest.fn().mockResolvedValue({ count: cartClaimable ? 1 : 0 }) },
      order: {
        create: jest.fn(async (args: any) => {
          created = orderFrom(args);
          return created;
        }),
        findUniqueOrThrow: jest.fn(async () => ({
          ...created,
          items,
          sellerOrders: sellerOrders.map((so) => ({
            ...so,
            seller: sellersByName[so.sellerId] ?? { id: so.sellerId, displayName: 'Seller' },
          })),
        })),
      },
      sellerOrder: {
        create: jest.fn(async (args: any) => {
          const so = {
            id: `so${sellerOrders.length + 1}`,
            orderId: args.data.orderId,
            sellerId: args.data.sellerId,
            sellerOrderNumber: args.data.sellerOrderNumber,
            status: args.data.status,
            subtotal: dec(args.data.subtotal),
            discountTotal: dec(args.data.discountTotal),
            taxTotal: dec(args.data.taxTotal),
            deliveryTotal: dec(args.data.deliveryTotal),
            grandTotal: dec(args.data.grandTotal),
            sellerAmount: dec(args.data.sellerAmount),
          };
          sellerOrders.push(so);
          return so;
        }),
      },
      orderItem: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(async (args: any) => {
          const d = args.data;
          const row = {
            id: `oi${items.length + 1}`,
            orderId: d.orderId,
            sellerOrderId: d.sellerOrderId,
            productId: d.productId,
            productNameSnapshot: d.productNameSnapshot,
            sellerNameSnapshot: d.sellerNameSnapshot,
            skuSnapshot: d.skuSnapshot,
            weightSnapshot: d.weightSnapshot,
            unitPrice: dec(d.unitPrice),
            quantity: d.quantity,
            lineTotal: dec(d.lineTotal),
          };
          items.push(row);
          return row;
        }),
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
    service = new OrderService(prisma, {
      createIntentTx: jest.fn().mockResolvedValue({ id: 'pay1' }),
      getOrderPayment: jest.fn(),
      confirmFromWebhook: jest.fn(),
      toPublic: jest.fn(),
      signForTesting: jest.fn(),
    } as never);
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

  it('splits a multi-seller checkout into one seller_order per seller and reconciles totals', async () => {
    const rows = [
      { id: 'i1', quantity: 2, product: productRow({ id: 'p1', name: 'Sev', price: 100, stock: 50 }, 's1') },
      { id: 'i2', quantity: 3, product: productRow({ id: 'p2', name: 'Mixture', price: 50, stock: 50 }, 's2') },
    ];
    const t = buildTx(rows, true);
    prisma.$transaction.mockImplementation(async (fn: any) => fn(t));
    const result = await service.checkout('u1', {
      cartId: 'c1',
      paymentMethod: 'COD',
      address: addr(),
    } as never);
    // subtotal 350 (<499) -> delivery 49, tax 17.50 => grand 416.50 across two sellers
    expect(result.price.subtotal).toBe(350);
    expect(result.price.grandTotal).toBe(416.5);
    expect(t.sellerOrder.create).toHaveBeenCalledTimes(2);
    // per-item seller attribution
    expect(result.items.map((i) => i.sellerName)).toEqual(['Seller One', 'Seller Two']);
    // two seller orders, money reconciles exactly to the order grand total
    expect(result.sellerOrders!.length).toBe(2);
    const soSum = result.sellerOrders!.reduce((a, s) => a + s.grandTotal, 0);
    expect(Math.round(soSum * 100) / 100).toBe(result.price.grandTotal);
    // each line routed to its own seller order
    expect(result.sellerOrders![0].itemCount).toBe(1);
    expect(result.sellerOrders![1].itemCount).toBe(1);
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

  describe('resolveRejectedSlice (partial fulfilment)', () => {
    function sliceOrder(over: Record<string, any> = {}) {
      return {
        id: 'o1',
        orderNumber: 'BK-1',
        userId: 'u1',
        status: 'CONFIRMED',
        paymentMethod: 'PREPAID',
        paymentStatus: 'PAID',
        subtotal: dec(500),
        discountTotal: dec(0),
        taxTotal: dec(25),
        deliveryTotal: dec(0),
        grandTotal: dec(525),
        couponDiscount: dec(0),
        couponCode: null,
        addressSnapshot: {},
        placedAt: new Date('2026-09-07T10:00:00Z'),
        sellerOrders: [
          {
            id: 'so-a',
            sellerId: 's1',
            sellerOrderNumber: 'SO-A',
            status: 'REJECTED',
            subtotal: dec(200),
            grandTotal: dec(210),
            sellerAmount: dec(210),
            seller: { displayName: 'Seller A' },
          },
          {
            id: 'so-b',
            sellerId: 's2',
            status: 'ACCEPTED',
            subtotal: dec(300),
            grandTotal: dec(315),
            seller: { displayName: 'Seller B' },
          },
        ],
        items: [
          {
            id: 'i1',
            productId: 'p1',
            productNameSnapshot: 'Sev',
            sellerNameSnapshot: 'Seller A',
            skuSnapshot: null,
            weightSnapshot: null,
            sellerOrderId: 'so-a',
            unitPrice: dec(100),
            quantity: 2,
            lineTotal: dec(200),
          },
        ],
        ...over,
      };
    }
    function buildResolveTx(order: any, refundExists = false) {
      return {
        sellerOrder: { update: jest.fn().mockResolvedValue({}) },
        product: { update: jest.fn() },
        refund: {
          aggregate: jest.fn().mockResolvedValue({
            _sum: { amount: refundExists ? dec(0) : null },
          }),
          create: jest.fn(async (args: any) => ({
            id: 'rfx1',
            ...(args.data.transactions ? { transactions: [] } : {}),
          })),
        },
        payment: { findUnique: jest.fn().mockResolvedValue({ id: 'pay1' }) },
        orderStatusHistory: { create: jest.fn() },
        order: {
          findUniqueOrThrow: jest.fn(async () => ({
            ...order,
            sellerOrders: order.sellerOrders.map((s: any) => ({
              ...s,
              seller: s.seller ?? { displayName: 'X' },
            })),
          })),
        },
      };
    }
    beforeEach(() => {
      prisma.order.findUnique = jest.fn();
    });

    it('cancels a REJECTED slice, releases stock and records a partial refund for PREPAID', async () => {
      const order = sliceOrder();
      prisma.order.findUnique.mockResolvedValue(order);
      const tx = buildResolveTx(order);
      prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));
      const res = await service.resolveRejectedSlice('op1', 'o1', 'so-a');
      // slice transitioned to CANCELLED
      expect(tx.sellerOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'so-a' },
          data: expect.objectContaining({ status: 'CANCELLED', cancelledAt: expect.any(Date) }),
        }),
      );
      // stock released for the cancelled slice's items only
      expect(tx.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'p1' }, data: { stockOnHand: { increment: 2 } } }),
      );
      // a completed refund for the slice amount is recorded
      expect(tx.refund.create).toHaveBeenCalledTimes(1);
      const refData = tx.refund.create.mock.calls[0][0].data;
      expect(refData.sellerOrderId).toBe('so-a');
      expect(refData.amount).toBe(210);
      expect(refData.status).toBe('COMPLETED');
      expect(refData.method).toBe('GATEWAY');
      expect(refData.transactions.create.status).toBe('SUCCESS');
      expect(refData.transactions.create.amount).toBe(210);
      // order still present with sellerOrders mapped
      expect(res.sellerOrders!.map((s) => s.id)).toEqual(['so-a', 'so-b']);
    });

    it('refuses to resolve a slice that is not REJECTED', async () => {
      const order = sliceOrder({
        sellerOrders: [{ id: 'so-a', status: 'ACCEPTED', seller: { displayName: 'A' } }],
      });
      prisma.order.findUnique.mockResolvedValue(order);
      await expect(service.resolveRejectedSlice('op1', 'o1', 'so-a')).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses to resolve once the order has shipped', async () => {
      prisma.order.findUnique.mockResolvedValue(sliceOrder({ status: 'SHIPPED' }));
      await expect(service.resolveRejectedSlice('op1', 'o1', 'so-a')).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses a PREPAID partial-cancel refund before payment is captured', async () => {
      prisma.order.findUnique.mockResolvedValue(sliceOrder({ paymentStatus: 'PENDING' }));
      await expect(service.resolveRejectedSlice('op1', 'o1', 'so-a')).rejects.toThrow(
        /must be PAID before resolving/,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws NotFound for an unknown order or slice', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(service.resolveRejectedSlice('op1', 'o1', 'so-a')).rejects.toThrow(NotFoundException);
      prisma.order.findUnique.mockResolvedValue(sliceOrder());
      await expect(service.resolveRejectedSlice('op1', 'o1', 'so-zzz')).rejects.toThrow(NotFoundException);
    });
  });
});
