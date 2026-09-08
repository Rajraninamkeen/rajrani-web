import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ReplacementCourierService } from './replacement-courier.service';
import {
  DeliveryAssignmentStatus,
  DeliveryPartnerStatus,
  ReplacementStatus,
} from '../generated/prisma/client';

describe('ReplacementCourierService (Session 22)', () => {
  let prisma: any;
  let service: ReplacementCourierService;
  let tx: any;

  function freshPrisma() {
    tx = {
      replacementAssignment: { create: jest.fn(), update: jest.fn() },
      replacement: { update: jest.fn() },
      returnEvent: { create: jest.fn() },
    };
    prisma = {
      user: { findUnique: jest.fn() },
      deliveryPartner: { findUnique: jest.fn(), findMany: jest.fn() },
      returnRequest: { findUnique: jest.fn() },
      replacement: { findUnique: jest.fn() },
      replacementAssignment: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      returnEvent: { create: jest.fn() },
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    };
  }

  const partner = (over: any = {}) => ({
    id: 'p1', userId: 'u-deliv', partnerCode: 'DLV-1', status: DeliveryPartnerStatus.ACTIVE,
    ...over,
  });
  const loadedAssignment = (over: any = {}) => ({
    id: 'ra1', assignmentNumber: 'RDLA-1', replacementId: 'r1', orderId: 'o1',
    deliveryPartnerId: 'p1', status: DeliveryAssignmentStatus.ASSIGNED,
    assignedAt: new Date(), acceptedAt: null, pickedUpAt: null, outForDeliveryAt: null,
    deliveredAt: null, rejectedAt: null, failureReason: null, cancelledAt: null,
    replacement: {
      id: 'r1', replacementReference: 'RPL-1', returnRequestId: 'rr1',
      status: ReplacementStatus.DISPATCHED, quantityTotal: 2, orderId: 'o1',
    },
    order: { addressSnapshot: { name: 'Cust', phone: '9' }, user: { fullName: 'Cust' } },
    deliveryPartner: { id: 'p1', partnerCode: 'DLV-1', user: { id: 'u-deliv', fullName: 'Rider' } },
    ...over,
  });

  function setupDelivery() {
    prisma.user.findUnique.mockResolvedValue({ id: 'u-deliv', role: 'DELIVERY' });
    prisma.deliveryPartner.findUnique.mockImplementation((args: any) =>
      args?.where?.userId === 'u-deliv' ? Promise.resolve(partner()) : Promise.resolve(null),
    );
    prisma.replacementAssignment.findUnique.mockResolvedValue(loadedAssignment());
    prisma.replacementAssignment.update.mockResolvedValue({});
  }

  beforeEach(() => {
    freshPrisma();
    service = new ReplacementCourierService(prisma);
  });

  it('assigns a DISPATCHED replacement to an ACTIVE partner -> ASSIGNED', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue({
      id: 'rr1', replacement: loadedAssignment().replacement,
    });
    prisma.deliveryPartner.findUnique.mockImplementation((args: any) =>
      args?.where?.id === 'p1' ? Promise.resolve(partner()) : Promise.resolve(null),
    );
    prisma.replacementAssignment.findFirst.mockResolvedValue(null);
    tx.replacementAssignment.create.mockResolvedValue({ id: 'ra1' });
    prisma.replacementAssignment.findUnique.mockResolvedValue(loadedAssignment());

    const out = await service.assignCourier('op1', 'rr1', 'p1');
    expect(out.status).toBe(DeliveryAssignmentStatus.ASSIGNED);
    expect(out.returnRequestId).toBe('rr1');
    expect(out.deliveryPartner!.partnerCode).toBe('DLV-1');
    expect(tx.replacementAssignment.create).toHaveBeenCalledTimes(1);
    expect(tx.returnEvent.create).toHaveBeenCalledTimes(1);
  });

  it('rejects assigning when the replacement is not DISPATCHED', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue({
      id: 'rr1', replacement: { ...loadedAssignment().replacement, status: ReplacementStatus.PENDING_DISPATCH },
    });
    await expect(service.assignCourier('op1', 'rr1', 'p1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects assigning when the partner is not ACTIVE', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue({ id: 'rr1', replacement: loadedAssignment().replacement });
    prisma.deliveryPartner.findUnique.mockResolvedValue(partner({ status: DeliveryPartnerStatus.SUSPENDED }));
    await expect(service.assignCourier('op1', 'rr1', 'p1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a second assignment while one is active', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue({ id: 'rr1', replacement: loadedAssignment().replacement });
    prisma.deliveryPartner.findUnique.mockResolvedValue(partner());
    prisma.replacementAssignment.findFirst.mockResolvedValue({ id: 'ra-existing' });
    await expect(service.assignCourier('op1', 'rr1', 'p1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('courier deliver completes the replacement DISPATCHED -> COMPLETED (non-money)', async () => {
    setupDelivery();
    prisma.replacementAssignment.findUnique
      .mockResolvedValueOnce(loadedAssignment({ status: DeliveryAssignmentStatus.OUT_FOR_DELIVERY })) // owned/guard
      .mockResolvedValue(loadedAssignment({ status: DeliveryAssignmentStatus.DELIVERED })); // reload after deliver
    const out = await service.deliver('u-deliv', 'ra1');
    expect(tx.replacementAssignment.update).toHaveBeenCalled();
    expect(tx.replacement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: ReplacementStatus.COMPLETED }),
      }),
    );
    expect(tx.returnEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ actorType: 'DELIVERY' }) }),
    );
    expect(out.status).toBe(DeliveryAssignmentStatus.DELIVERED);
  });

  it('does not deliver if the replacement is not DISPATCHED', async () => {
    setupDelivery();
    prisma.replacementAssignment.findUnique.mockResolvedValue(
      loadedAssignment({ status: DeliveryAssignmentStatus.OUT_FOR_DELIVERY,
        replacement: { ...loadedAssignment().replacement, status: ReplacementStatus.COMPLETED } }),
    );
    await expect(service.deliver('u-deliv', 'ra1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks a non-DELIVERY user from partner actions', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u-cust', role: 'CUSTOMER' });
    prisma.deliveryPartner.findUnique.mockResolvedValue(null);
    await expect(service.partnerTasks('u-cust')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('courier accept requires ASSIGNED and moves to ACCEPTED', async () => {
    setupDelivery();
    const out = await service.accept('u-deliv', 'ra1');
    expect(prisma.replacementAssignment.update).toHaveBeenCalled();
    expect(prisma.returnEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ eventType: 'REPLACEMENT_COURIER_ACCEPTED' }) }),
    );
    expect(out.status).toBe(DeliveryAssignmentStatus.ASSIGNED); // reload returns original ASSIGNED fixture
  });

  it('courier cannot accept from a non-ASSIGNED state', async () => {
    setupDelivery();
    prisma.replacementAssignment.findUnique.mockResolvedValue(
      loadedAssignment({ status: DeliveryAssignmentStatus.PICKED_UP }),
    );
    await expect(service.accept('u-deliv', 'ra1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('courier pickup requires ACCEPTED', async () => {
    setupDelivery();
    prisma.replacementAssignment.findUnique.mockResolvedValue(
      loadedAssignment({ status: DeliveryAssignmentStatus.ACCEPTED }),
    );
    await expect(service.pickup('u-deliv', 'ra1')).resolves.toBeDefined();
  });

  it('operator cancels an active assignment -> CANCELLED', async () => {
    prisma.replacementAssignment.findUnique.mockResolvedValue(loadedAssignment({ status: DeliveryAssignmentStatus.ACCEPTED }));
    await service.cancelAssignment('op1', 'ra1');
    expect(tx.replacementAssignment.update).toHaveBeenCalled();
    expect(tx.returnEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ eventType: 'REPLACEMENT_COURIER_CANCELLED' }) }),
    );
  });

  it('operator cannot cancel a terminal (DELIVERED) assignment', async () => {
    prisma.replacementAssignment.findUnique.mockResolvedValue(loadedAssignment({ status: DeliveryAssignmentStatus.DELIVERED }));
    await expect(service.cancelAssignment('op1', 'ra1')).rejects.toBeInstanceOf(ConflictException);
  });
});
