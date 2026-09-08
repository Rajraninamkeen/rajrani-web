import { NotificationService } from './notification.service';
import { NotificationCategory, NotificationChannel, OutboxStatus } from '../generated/prisma/client';

describe('NotificationService (Session 38 — finance/payout notification ledger + outbox)', () => {
  let prisma: any;
  let service: NotificationService;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      notification: {
        create: jest.fn().mockImplementation((a: any) => Promise.resolve({ id: 'n1', ...a.data })),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      notificationOutbox: {
        create: jest.fn().mockImplementation((a: any) => Promise.resolve({ id: 'o1', ...a.data })),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
    };
    service = new NotificationService(prisma as any);
  });

  it('enqueue writes a notification + EMAIL/SMS outbox rows from the user contact', async () => {
    prisma.user.findUnique.mockResolvedValue({ email: 'rider@x.co', phone: '9900000099' });
    await service.enqueue({
      recipientUserId: 'u1',
      category: NotificationCategory.COURIER_FEE_SETTLED,
      amount: 70,
      refKind: 'deliveryPartner',
      refId: 'p1',
    });
    expect(prisma.notification.create).toHaveBeenCalled();
    const nData = prisma.notification.create.mock.calls[0][0].data;
    expect(nData.category).toBe('COURIER_FEE_SETTLED');
    expect(nData.message).toContain('₹70.00');
    // two channels: EMAIL + SMS
    const channels = prisma.notificationOutbox.create.mock.calls.map((c: any) => c[0].data.channel);
    expect(channels).toContain(NotificationChannel.EMAIL);
    expect(channels).toContain(NotificationChannel.SMS);
  });

  it('enqueueSellerTx notifies every SELLER operator of the seller', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'sop1', email: 'op@a.com', phone: null },
      { id: 'sop2', email: 'op2@a.com', phone: null },
    ]);
    await (service as any).enqueueSellerTx(
      prisma,
      'seller1',
      { category: NotificationCategory.PAYABLE_EARNED, amount: 120, refKind: 'sellerPayable', refId: 'pay1' },
    );
    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    const recipients = prisma.notification.create.mock.calls.map((c: any) => c[0].data.recipientUserId);
    expect(recipients).toEqual(['sop1', 'sop2']);
  });

  it('forUser returns rows + unreadCount', async () => {
    const now = new Date();
    prisma.notification.findMany.mockResolvedValue([{ id: 'n1', createdAt: now, category: 'PAYABLE_EARNED', title: 't', message: 'm' }]);
    prisma.notification.count.mockResolvedValueOnce(1).mockResolvedValueOnce(3);
    const out = await service.forUser('u1', { limit: 10 });
    expect(out.notifications).toHaveLength(1);
    expect(out.unreadCount).toBe(3);
    expect(out.total).toBe(1);
    const w = prisma.notification.findMany.mock.calls[0][0].where;
    expect(w.recipientUserId).toBe('u1');
  });

  it('markRead only acts on the caller’s own notification', async () => {
    prisma.notification.findUnique.mockResolvedValue({ id: 'n1', recipientUserId: 'other', readAt: null });
    const a = await service.markRead('me', 'n1');
    expect(a.ok).toBe(false);
    expect(prisma.notification.update).not.toHaveBeenCalled();
    prisma.notification.findUnique.mockResolvedValue({ id: 'n2', recipientUserId: 'me', readAt: null });
    const b = await service.markRead('me', 'n2');
    expect(b.ok).toBe(true);
    expect(prisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ readAt: expect.any(Date) }) }),
    );
  });

  it('markAllRead updates only unread rows for the user', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 2 });
    const r = await service.markAllRead('u1');
    expect(r.updated).toBe(2);
    const w = prisma.notification.updateMany.mock.calls[0][0].where;
    expect(w.recipientUserId).toBe('u1');
    expect(w.readAt).toBeNull();
  });

  it('dispatch resolves PENDING rows to SKIPPED when no gateway is configured', async () => {
    prisma.notificationOutbox.findMany.mockResolvedValue([
      { id: 'o1', attempt: 0, channel: 'EMAIL', destination: 'a@b.co', createdAt: new Date() },
    ]);
    prisma.notificationOutbox.update.mockResolvedValue({});
    const r = await service.dispatch();
    expect(r).toEqual({ processed: 1, sent: 0, skipped: 1, failed: 0 });
    const upd = prisma.notificationOutbox.update.mock.calls[0][0];
    expect(upd.data.status).toBe(OutboxStatus.SKIPPED);
  });

  it('staffList surfaces rows with recipient user context', async () => {
    prisma.notification.findMany.mockResolvedValue([{ id: 'n1', createdAt: new Date() }]);
    prisma.notification.count.mockResolvedValue(1);
    const out = await service.staffList({});
    expect(out.notifications).toHaveLength(1);
    expect(out.total).toBe(1);
  });
});
