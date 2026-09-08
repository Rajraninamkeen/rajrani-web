/* Session 42 — Analytics demo fixture.
 *
 * Creates a small but internally-consistent set of HISTORICAL orders over the last
 * ~35 days across the two seeded sellers so the read-only Analytics surface
 * (GMV / trend / top products / categories / seller payouts / returns+refund) has
 * realistic data to aggregate. Runs over the canonical schema (db push) with the
 * existing sellers/products/users from prisma seed + bootstrap-roles.
 *
 * Money invariants honoured:
 *   slice.grandTotal = subtotal + tax + delivery - discount
 *   order.grandTotal = sum(sellerOrders.grandTotal)  (single-seller orders here)
 *   goodsValue = subtotal - discount
 *   commission = round(goodsValue * rateBps / 10000); netPayable = goodsValue - commission
 * A SellerPayable is earned on DELIVERED slices (matches the delivered-earn rule).
 * A few slices are marked SETTLED so the per-seller table shows settled value.
 * Idempotent guard: exits early if demo orders already exist.
 */
import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString:
      process.env.DATABASE_URL ??
      'postgresql://bilokat:bilokat_dev@localhost:5432/bilokat',
  }),
});

const R = (n: number, m = 100) => Math.round(n * m) / m;
const DAY = 86400000;
const now = Date.now();
// offset days ago -> [sellerId, productId, qty, status, delivered?]
// (product ids resolved at runtime by product name)
const PLAN: any[] = [
  // recent delivered sales (trend tail)
  ['Rajrani Select', 'Bilokat Shahi Rajwadi Kaju Blend', 2, 'DELIVERED', 1],
  ['Rajrani Select', 'Bilokat Roasted Peri-Peri Foxnut (Makhana)', 3, 'DELIVERED', 1],
  ['Bilokat Kitchens', 'Bilokat Royal Ratlami Sev', 2, 'DELIVERED', 2],
  ['Bilokat Kitchens', 'Bilokat Malwa Khatta Meetha Mixture', 4, 'DELIVERED', 2],
  ['Bilokat Kitchens', 'Bilokat Bikaneri Royal Aloo Bhujia', 2, 'DELIVERED', 3],
  ['Bilokat Kitchens', 'Bilokat Silk Nylon Sev (Chaat Special)', 3, 'DELIVERED', 4],
  ['Rajrani Select', 'Bilokat Grand All-India Festive Gift Hamper', 1, 'DELIVERED', 5],
  ['Bilokat Kitchens', 'Bilokat Hing Jeera Slow-Roasted Chana', 5, 'DELIVERED', 6],
  ['Rajrani Select', 'Bilokat Shahi Rajwadi Kaju Blend', 2, 'DELIVERED', 7],
  ['Bilokat Kitchens', 'Bilokat Royal Ratlami Sev', 3, 'DELIVERED', 8],
  ['Bilokat Kitchens', 'Bilokat Silk Nylon Sev (Chaat Special)', 2, 'DELIVERED', 9],
  ['Rajrani Select', 'Bilokat Roasted Peri-Peri Foxnut (Makhana)', 2, 'DELIVERED', 10],
  ['Bilokat Kitchens', 'Bilokat Malwa Khatta Meetha Mixture', 3, 'DELIVERED', 11],
  ['Bilokat Kitchens', 'Bilokat Bikaneri Royal Aloo Bhujia', 4, 'DELIVERED', 12],
  ['Rajrani Select', 'Bilokat Shahi Rajwadi Kaju Blend', 1, 'DELIVERED', 13],
  ['Bilokat Kitchens', 'Bilokat Royal Ratlami Sev', 2, 'DELIVERED', 15],
  ['Rajrani Select', 'Bilokat Grand All-India Festive Gift Hamper', 2, 'DELIVERED', 16],
  ['Bilokat Kitchens', 'Bilokat Silk Nylon Sev (Chaat Special)', 6, 'DELIVERED', 18],
  ['Bilokat Kitchens', 'Bilokat Hing Jeera Slow-Roasted Chana', 3, 'DELIVERED', 20],
  ['Rajrani Select', 'Bilokat Roasted Peri-Peri Foxnut (Makhana)', 4, 'DELIVERED', 22],
  ['Bilokat Kitchens', 'Bilokat Bikaneri Royal Aloo Bhujia', 2, 'DELIVERED', 25],
  // a few in-flight / non-delivered (status breakdown)
  ['Bilokat Kitchens', 'Bilokat Royal Ratlami Sev', 1, 'PLACED', 0],
  ['Bilokat Kitchens', 'Bilokat Silk Nylon Sev (Chaat Special)', 2, 'PACKED', 0],
  ['Rajrani Select', 'Bilokat Shahi Rajwadi Kaju Blend', 2, 'SHIPPED', 0],
  ['Bilokat Kitchens', 'Bilokat Malwa Khatta Meetha Mixture', 2, 'CONFIRMED', 0],
  ['Rajrani Select', 'Bilokat Grand All-India Festive Gift Hamper', 1, 'CANCELLED', 0],
  // two RETURN/REFUND cases (delivered then returned -> refund completed)
  ['Bilokat Kitchens', 'Bilokat Malwa Khatta Meetha Mixture', 2, 'RETURNED', 6],
  ['Rajrani Select', 'Bilokat Shahi Rajwadi Kaju Blend', 1, 'REFUNDED', 9],
];

function uid(p: string) {
  return `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

async function main() {
  const existing = await prisma.order.count({ where: { orderNumber: { startsWith: 'DM-ORD-' } } });
  if (existing > 0) {
    console.log(`Analytics demo already present (${existing} demo orders) — skipping.`);
    return;
  }
  const sellers = await prisma.seller.findMany({ select: { id: true, displayName: true, commissionRateBps: true } });
  const byName = new Map(sellers.map((s) => [s.displayName, s]));
  const products = await prisma.product.findMany({ select: { id: true, name: true, sellerId: true, basePrice: true } });
  const prod = new Map(products.map((p) => [p.name, p]));
  const customer = await prisma.user.findUnique({ where: { email: 's12@example.com' } });
  if (!customer) throw new Error('customer fixture missing — run bootstrap-roles');

  // Fixture-only buyers so uniqueBuyers is non-trivial (login-less accounts; analytics only needs the FK).
  const customerA = await prisma.user.upsert({
    where: { email: 'analytics.demo.a@example.com' },
    update: {}, create: { email: 'analytics.demo.a@example.com', fullName: 'Demo Buyer A', role: 'CUSTOMER', passwordHash: 'fixture-no-login', status: 'ACTIVE' },
  });
  const customerB = await prisma.user.upsert({
    where: { email: 'analytics.demo.b@example.com' },
    update: {}, create: { email: 'analytics.demo.b@example.com', fullName: 'Demo Buyer B', role: 'CUSTOMER', passwordHash: 'fixture-no-login', status: 'ACTIVE' },
  });
  const buyers = [customer, customerA, customerB];

  let orderIdx = 0;
  const TAX_RATE = 0.05;
  const DELIVERY = 40;

  for (const [sellerName, productName, qty, status, daysAgo] of PLAN) {
    const seller = byName.get(sellerName)!;
    const product = prod.get(productName)!;
    if (!seller || !product) continue;
    const buyer = buyers[orderIdx % buyers.length];
    orderIdx += 1;
    const placed = new Date(now - daysAgo * DAY);
    const unit = Number(product.basePrice);
    const subtotal = unit * qty;
    const tax = R(subtotal * TAX_RATE);
    const grand = R(subtotal + tax + DELIVERY);
    const goodsValue = subtotal; // no discount
    const commission = R((goodsValue * seller.commissionRateBps) / 10000);
    const netPayable = R(goodsValue - commission);
    const delivered = status === 'DELIVERED' || status === 'RETURNED' || status === 'REFUNDED';

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber: `DM-ORD-${String(orderIdx).padStart(3, '0')}`,
          userId: buyer.id,
          status: status as any,
          subtotal, discountTotal: 0, taxTotal: tax, deliveryTotal: DELIVERY,
          grandTotal: grand, paymentMethod: daysAgo % 3 === 0 ? 'COD' : 'PREPAID',
          paymentStatus: delivered ? (status === 'CANCELLED' ? 'PENDING' : 'PAID') : 'PENDING',
          addressSnapshot: { line1: 'Demo 1', city: 'Indore', pincode: '452001' },
          placedAt: placed,
          deliveredAt: delivered ? new Date(now - Math.max(0, daysAgo - 1) * DAY) : null,
        },
      });
      const so = await tx.sellerOrder.create({
        data: {
          orderId: order.id, sellerId: seller.id,
          sellerOrderNumber: `DM-SO-${String(orderIdx).padStart(3, '0')}`,
          status: status === 'CANCELLED' ? 'CANCELLED' : 'ACCEPTED',
          subtotal, discountTotal: 0, taxTotal: tax, deliveryTotal: DELIVERY,
          grandTotal: grand, sellerAmount: goodsValue,
          deliveredAt: delivered ? new Date(now - Math.max(0, daysAgo - 1) * DAY) : null,
        },
      });
      await tx.orderItem.create({
        data: {
          orderId: order.id, sellerOrderId: so.id, productId: product.id,
          productNameSnapshot: productName, sellerNameSnapshot: sellerName,
          skuSnapshot: `${productName}-${qty}`, unitPrice: unit, quantity: qty, lineTotal: subtotal,
        },
      });
      await tx.orderStatusHistory.create({
        data: { orderId: order.id, fromStatus: null, toStatus: status as any, actor: 'SYSTEM', reason: 'analytics demo' },
      });
      if (delivered) {
        await tx.sellerPayable.create({
          data: {
            sellerId: seller.id, orderId: order.id, sellerOrderId: so.id,
            grossAmount: subtotal, discountAmount: 0, goodsValue,
            commissionRateBps: seller.commissionRateBps, commissionAmount: commission,
            taxAmount: tax, deliveryAmount: DELIVERY, refundAmount: 0, adjustmentAmount: 0,
            netPayable,
            status: orderIdx % 5 === 0 ? 'SETTLED' : 'EARNED',
            earnedAt: placed,
          },
        });
      }
    });

    // RETURN/REFUND cases: create a completed return request + refund
    if (status === 'RETURNED' || status === 'REFUNDED') {
      const order = await prisma.order.findUnique({ where: { orderNumber: `DM-ORD-${String(orderIdx).padStart(3, '0')}` } })!;
      const so = await prisma.sellerOrder.findUnique({ where: { sellerOrderNumber: `DM-SO-${String(orderIdx).padStart(3, '0')}` } })!;
      const item = await prisma.orderItem.findFirst({ where: { orderId: order!.id } })!;
      const refundAmt = R(grand * 0.6);
      await prisma.$transaction(async (tx) => {
        const rr = await tx.returnRequest.create({
          data: {
            orderId: order!.id, status: 'COMPLETED', resolution: 'REFUND',
            reasonCode: 'QUALITY_ISSUE', reasonNote: 'analytics demo return',
            requestedAt: new Date(now - (daysAgo - 1) * DAY), completedAt: new Date(now - (daysAgo - 2) * DAY),
          },
        });
        await tx.returnItem.create({
          data: { returnRequestId: rr.id, orderItemId: item!.id, quantity: qty, refundAmount: refundAmt },
        });
        const refund = await tx.refund.create({
          data: {
            orderId: order!.id, returnRequestId: rr.id, sellerOrderId: so!.id,
            refundReference: `DM-RFD-${String(orderIdx).padStart(3, '0')}`,
            amount: refundAmt, method: order!.paymentMethod === 'COD' ? 'COD' : 'GATEWAY',
            status: 'COMPLETED', completedAt: new Date(now - (daysAgo - 2) * DAY),
          },
        });
        // reduce the payable's refundAmount for the returned slice
        const payable = await tx.sellerPayable.findUnique({ where: { sellerOrderId: so!.id } });
        if (payable) {
          await tx.sellerPayable.update({
            where: { id: payable.id },
            data: { refundAmount: refundAmt, netPayable: R(Number(payable.netPayable) - refundAmt) },
          });
        }
        void refund;
      });
    }
  }

  // ensure buyer variety
  if (!customerA) {
    const hash = 'x'; // fixture-only users with unusable login; analytics only needs the FK
    await prisma.user.upsert({
      where: { email: 'analytics.demo.a@example.com' },
      update: {}, create: { email: 'analytics.demo.a@example.com', fullName: 'Demo Buyer A', role: 'CUSTOMER', passwordHash: hash, status: 'ACTIVE' },
    });
    await prisma.user.upsert({
      where: { email: 'analytics.demo.b@example.com' },
      update: {}, create: { email: 'analytics.demo.b@example.com', fullName: 'Demo Buyer B', role: 'CUSTOMER', passwordHash: hash, status: 'ACTIVE' },
    });
  }

  const summary = await prisma.order.count({ where: { orderNumber: { startsWith: 'DM-ORD-' } } });
  console.log(`Analytics demo seeded: ${summary} orders.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
