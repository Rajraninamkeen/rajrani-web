import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CourierTrackingService } from './courier-tracking.service';
import { DeliveryAssignmentStatus } from '../generated/prisma/client';

describe('CourierTrackingService (Session 31)', () => {
  let prisma: any;
  let courier: any;
  let service: CourierTrackingService;

  function fresh() {
    prisma = {
      user: { findUnique: jest.fn() },
      order: { findUnique: jest.fn() },
      deliveryPartner: { findUnique: jest.fn() },
      deliveryAssignment: { findMany: jest.fn(), findUnique: jest.fn() },
      replacementAssignment: { findMany: jest.fn(), findUnique: jest.fn() },
    };
    courier = {
      name: 'Mock Courier',
      track: jest.fn(async (tn: string) => ({
        trackingNumber: tn,
        carrier: 'Mock Courier',
        status: 'IN_TRANSIT',
        events: [
          { status: 'CREATED', at: new Date('2026-09-08T05:00:00Z').toISOString(), note: null },
          { status: 'OUT_FOR_DELIVERY', at: new Date('2026-09-08T06:00:00Z').toISOString(), note: 'On rider' },
        ],
      })),
      createShipment: jest.fn(),
      confirmDelivery: jest.fn(),
    };
    service = new CourierTrackingService(prisma, courier);
  }

  function sliceAssignment(over: any = {}) {
    return {
      id: 'da1', orderId: 'o1', sellerOrderId: 'so1', deliveryPartnerId: 'p1',
      assignmentNumber: 'DLVA-1', status: DeliveryAssignmentStatus.OUT_FOR_DELIVERY,
      carrier: 'Mock Courier', trackingNumber: 'MCK-111', trackingUrl: null,
      assignedAt: new Date(), acceptedAt: new Date(), pickedUpAt: new Date(),
      outForDeliveryAt: new Date(), deliveredAt: null,
      failureReason: null, podRef: null, podSignedBy: null, podAt: null,
      sellerOrder: { id: 'so1', sellerOrderNumber: 'SO-1', seller: { displayName: 'Shop' } },
      ...over,
    };
  }
  function replacementAssignment(over: any = {}) {
    return {
      id: 'ra1', orderId: 'o1', replacementId: 'rpl1',
      assignmentNumber: 'RDLA-2', status: DeliveryAssignmentStatus.DELIVERED,
      carrier: 'Mock Courier', trackingNumber: 'MCK-222', trackingUrl: null,
      assignedAt: new Date(), acceptedAt: new Date(), pickedUpAt: new Date(),
      outForDeliveryAt: new Date(), deliveredAt: new Date(),
      failureReason: null, podRef: 'POD-MCK-222', podSignedBy: 'Mock Courier', podAt: new Date(),
      replacement: { id: 'rpl1', replacementReference: 'RPL-1' },
      ...over,
    };
  }

  beforeEach(() => fresh());

  it('forbids non CUSTOMER/OPERATOR/ADMIN roles', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u', role: 'SELLER' });
    await expect(service.trackOrder('u', 'o1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('customer may only read their own order (else 404)', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'cust2', role: 'CUSTOMER' });
    prisma.order.findUnique.mockResolvedValue({ id: 'o1', orderNumber: 'BK-1', userId: 'cust1', status: 'SHIPPED' });
    await expect(service.trackOrder('cust2', 'o1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('customer owner reads legs with live provider tracking merged', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'cust1', role: 'CUSTOMER' });
    prisma.order.findUnique.mockResolvedValue({ id: 'o1', orderNumber: 'BK-1', userId: 'cust1', status: 'SHIPPED' });
    prisma.deliveryAssignment.findMany.mockResolvedValue([sliceAssignment()]);
    prisma.replacementAssignment.findMany.mockResolvedValue([replacementAssignment()]);

    const out = await service.trackOrder('cust1', 'o1');
    expect(out.orderNumber).toBe('BK-1');
    expect(out.legs).toHaveLength(2);

    const parcel: any = out.legs.find((l: any) => l.legType === 'parcel');
    expect(parcel.reference).toBe('SO-1');
    expect(parcel.trackingNumber).toBe('MCK-111');
    expect(parcel.provider.status).toBe('IN_TRANSIT');
    expect(parcel.provider.events).toHaveLength(2);
    expect(courier.track).toHaveBeenCalledWith('MCK-111');

    const repl: any = out.legs.find((l: any) => l.legType === 'replacement');
    expect(repl.podRef).toBe('POD-MCK-222');
    expect(repl.provider.status).toBe('IN_TRANSIT');
    expect(courier.track).toHaveBeenCalledWith('MCK-222');
  });

  it('operator/admin may read any order', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'op', role: 'OPERATOR' });
    prisma.order.findUnique.mockResolvedValue({ id: 'o1', orderNumber: 'BK-1', userId: 'cust1', status: 'SHIPPED' });
    prisma.deliveryAssignment.findMany.mockResolvedValue([sliceAssignment()]);
    prisma.replacementAssignment.findMany.mockResolvedValue([]);
    const out = await service.trackOrder('op', 'o1');
    expect(out.legs).toHaveLength(1);
    expect(out.legs[0].legType).toBe('parcel');
  });

  it('omits terminal (cancelled/rejected) and duplicate historical assignments per slice', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'op', role: 'ADMIN' });
    prisma.order.findUnique.mockResolvedValue({ id: 'o1', orderNumber: 'BK-1', userId: 'cust1', status: 'SHIPPED' });
    prisma.deliveryAssignment.findMany.mockResolvedValue([
      // latest (createdAt desc) is DELIVERED for so1 -> included
      sliceAssignment({ status: DeliveryAssignmentStatus.DELIVERED }),
      sliceAssignment({ id: 'da-old', status: DeliveryAssignmentStatus.CANCELLED, cancelledAt: new Date() }),
      // a different slice whose ONLY assignment was rejected -> excluded
      sliceAssignment({ id: 'daX', sellerOrderId: 'soX', status: DeliveryAssignmentStatus.REJECTED,
        sellerOrder: { id: 'soX', sellerOrderNumber: 'SO-9', seller: { displayName: 'X' } } }),
    ]);
    prisma.replacementAssignment.findMany.mockResolvedValue([]);
    const out = await service.trackOrder('op', 'o1');
    expect(out.legs).toHaveLength(1);
    expect(out.legs[0].reference).toBe('SO-1');
  });

  it('a waybill-less leg (not yet picked up) surfaces local state with provider null and no live call', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'cust1', role: 'CUSTOMER' });
    prisma.order.findUnique.mockResolvedValue({ id: 'o1', orderNumber: 'BK-1', userId: 'cust1', status: 'SHIPPED' });
    prisma.deliveryAssignment.findMany.mockResolvedValue([
      sliceAssignment({ status: DeliveryAssignmentStatus.ACCEPTED, trackingNumber: null, carrier: null }),
    ]);
    prisma.replacementAssignment.findMany.mockResolvedValue([]);
    const out = await service.trackOrder('cust1', 'o1');
    expect(out.legs[0].provider).toBeNull();
    expect(courier.track).not.toHaveBeenCalled();
  });

  it('legs still resolve locally when no provider is configured (provider null)', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'cust1', role: 'CUSTOMER' });
    prisma.order.findUnique.mockResolvedValue({ id: 'o1', orderNumber: 'BK-1', userId: 'cust1', status: 'SHIPPED' });
    prisma.deliveryAssignment.findMany.mockResolvedValue([sliceAssignment()]);
    prisma.replacementAssignment.findMany.mockResolvedValue([]);
    const bare = new CourierTrackingService(prisma, null);
    const out = await bare.trackOrder('cust1', 'o1');
    expect(out.legs[0].trackingNumber).toBe('MCK-111');
    expect(out.legs[0].provider).toBeNull();
  });

  it('surfaces a 404 when the order does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'op', role: 'ADMIN' });
    prisma.order.findUnique.mockResolvedValue(null);
    await expect(service.trackOrder('op', 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  // ---- Session 36 — DELIVERY-role per-task tracking ----

  it('forbids a DELIVERY user with no partner profile from task tracking', async () => {
    prisma.deliveryPartner.findUnique.mockResolvedValue(null);
    await expect(service.trackTaskForDelivery('u-no-partner', 'da1', 'parcel')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns 404 when the task does not belong to this partner (parcel)', async () => {
    prisma.deliveryPartner.findUnique.mockResolvedValue({ id: 'p1' });
    prisma.deliveryAssignment.findUnique.mockResolvedValue(sliceAssignment({ deliveryPartnerId: 'p-OTHER' }));
    await expect(service.trackTaskForDelivery('u1', 'da1', 'parcel')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('DELIVERY partner reads live tracking for their own parcel task', async () => {
    prisma.deliveryPartner.findUnique.mockResolvedValue({ id: 'p1' });
    prisma.deliveryAssignment.findUnique.mockResolvedValue(sliceAssignment());
    const out: any = await service.trackTaskForDelivery('u1', 'da1', 'parcel');
    expect(out.assignmentNumber).toBe('DLVA-1');
    expect(out.legType).toBe('parcel');
    expect(out.reference).toBe('SO-1');
    expect(out.provider.status).toBe('IN_TRANSIT');
    expect(out.provider.events).toHaveLength(2);
    expect(courier.track).toHaveBeenCalledWith('MCK-111');
  });

  it('DELIVERY partner reads tracking for their own replacement task', async () => {
    prisma.deliveryPartner.findUnique.mockResolvedValue({ id: 'p1' });
    prisma.replacementAssignment.findUnique.mockResolvedValue(replacementAssignment({ deliveryPartnerId: 'p1' }));
    const out: any = await service.trackTaskForDelivery('u1', 'ra1', 'replacement');
    expect(out.legType).toBe('replacement');
    expect(out.reference).toBe('RPL-1');
    expect(out.podRef).toBe('POD-MCK-222');
    expect(out.provider.status).toBe('IN_TRANSIT');
  });
});
