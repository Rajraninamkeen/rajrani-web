import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Notification,
  NotificationCategory,
  NotificationChannel,
  NotificationOutbox,
  OutboxStatus,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NOTIFICATION_GATEWAY_TOKEN, NotificationGateway } from './notification.gateway';

type Tx = Prisma.TransactionClient;

/** Minimal structural slice of a prisma write client (tx or this.prisma). */
interface NotifWrite {
  notification: { create: (a: any) => any };
  notificationOutbox: { create: (a: any) => any };
}

/**
 * Session 38 — finance/payout notifications.
 *
 * Writes an in-app `Notification` row to the money-owner's user (a DELIVERY partner
 * or a SELLER operator) whenever a money event lands on the ledger, and enqueues
 * `NotificationOutbox` dispatch rows (EMAIL + SMS when a contact exists) for a
 * pluggable gateway. Without a configured provider the outbox rows resolve to
 * SKIPPED (terminal) — this ledger is informational and never affects the money flow.
 *
 * `enqueueTx`/`enqueue` are intentionally best-effort and never throw into a money
 * transaction. All money seams call them inside try/catch so a notification failure
 * can never roll back or block a delivery/settlement.
 */
const INRT = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const KIND_LABEL: Record<string, string> = { parcel: 'parcel delivery', replacement: 'replacement delivery' };
const SETTLE_LABEL: Record<string, string> = {
  PENDING: 'Pending', APPROVED: 'Approved', PROCESSING: 'Processing',
  PAID: 'Paid', RECONCILED: 'Reconciled', FAILED: 'Failed',
};

export interface NotifySpec {
  recipientUserId: string;
  category: NotificationCategory;
  // template data
  amount?: number;
  kind?: string; // courier leg kind (parcel/replacement)
  kindLabel?: string;
  orderNumber?: string;
  settlementRef?: string;
  toLabel?: string;
  fromLabel?: string;
  refKind?: string;
  refId?: string;
}

@Injectable()
export class NotificationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationService.name);
  private worker?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly config?: ConfigService,
    @Optional() @Inject(NOTIFICATION_GATEWAY_TOKEN) private readonly gateway?: NotificationGateway,
  ) {}

  /** Optional in-process dispatch worker (enabled via NOTIFY_DISPATCH_INTERVAL_MS > 0). */
  onModuleInit(): void {
    const interval = Number(this.config?.get<number>('notify.dispatchIntervalMs') ?? 0);
    if (Number.isFinite(interval) && interval > 0) {
      this.worker = setInterval(() => {
        this.dispatch(Number(this.config?.get<number>('notify.dispatchBatch') ?? 50))
          .then((r) => { if (r.processed > 0) this.logger.log(`notification worker dispatched ${r.processed} (sent=${r.sent}, failed=${r.failed})`); })
          .catch((e) => this.logger.error(`notification worker dispatch failed: ${e?.message}`));
      }, interval);
      this.worker.unref?.();
      this.logger.log(`notification dispatch worker enabled (every ${interval}ms)`);
    }
  }

  onModuleDestroy(): void {
    if (this.worker) clearInterval(this.worker);
  }

  private compose(s: NotifySpec): { title: string; message: string } {
    const amt = INRT(Math.round((s.amount ?? 0) * 100) / 100);
    switch (s.category) {
      case NotificationCategory.COURIER_FEE_EARNED:
        return {
          title: 'Delivery fee earned',
          message: `${amt} delivery fee earned for a ${KIND_LABEL[s.kind ?? ''] ?? 'courier'} leg.`,
        };
      case NotificationCategory.COURIER_FEE_SETTLED:
        return {
          title: 'Payout received',
          message: `${amt} paid out to your account for completed deliveries.`,
        };
      case NotificationCategory.PAYABLE_EARNED:
        return {
          title: 'Sale payable earned',
          message: `${amt} payable earned${s.orderNumber ? ` on order ${s.orderNumber}` : ''}. It is ready to be settled.`,
        };
      case NotificationCategory.SETTLEMENT_ADVANCED:
        return {
          title: `Settlement ${s.toLabel ?? ''}`.trim(),
          message: `Settlement ${s.settlementRef ?? ''} ${s.fromLabel ? `moved from ${s.fromLabel} to` : 'is now'} ${s.toLabel ?? ''}${amt ? ` · ${amt}` : ''}.`,
        };
      default:
        return { title: 'Bilokat update', message: 'You have a new update.' };
    }
  }

  /** Create a notification for a courier partner's user via the generic spec. */
  async enqueueTx(tx: Tx, s: NotifySpec): Promise<void> {
    if (!s.recipientUserId) return;
    const user = await tx.user.findUnique({ where: { id: s.recipientUserId }, select: { email: true, phone: true } });
    await this.write(tx, s, user?.email ?? null, user?.phone ?? null);
  }

  /** Notify a seller's SELLER-role operator user(s), inside an existing transaction. */
  async enqueueSellerTx(tx: Tx, sellerId: string, s: Omit<NotifySpec, 'recipientUserId'>): Promise<void> {
    const users = await tx.user.findMany({
      where: { sellerId, role: 'SELLER' },
      select: { id: true, email: true, phone: true },
    });
    for (const u of users) {
      await this.write(tx, { ...s, recipientUserId: u.id }, u.email, u.phone);
    }
  }

  /** Notify a seller's SELLER-role operator user(s), outside a transaction. */
  async enqueueSeller(sellerId: string, s: Omit<NotifySpec, 'recipientUserId'>): Promise<void> {
    const users = await this.prisma.user.findMany({
      where: { sellerId, role: 'SELLER' },
      select: { id: true, email: true, phone: true },
    });
    for (const u of users) {
      await this.write(this.prisma, { ...s, recipientUserId: u.id }, u.email, u.phone);
    }
  }

  /** Create a notification + outbox rows outside a transaction (post-commit seam). */
  async enqueue(s: NotifySpec): Promise<void> {
    if (!s.recipientUserId) return;
    const user = await this.prisma.user.findUnique({ where: { id: s.recipientUserId }, select: { email: true, phone: true } });
    await this.write(this.prisma, s, user?.email ?? null, user?.phone ?? null);
  }

  private async write(
    db: NotifWrite,
    s: NotifySpec,
    email: string | null,
    phone: string | null,
  ): Promise<void> {
    const { title, message } = this.compose(s);
    const notification = await db.notification.create({
      data: {
        recipientUserId: s.recipientUserId,
        category: s.category,
        title,
        message,
        refKind: s.refKind ?? null,
        refId: s.refId ?? null,
      },
    });
    const rows: Array<{ channel: NotificationChannel; destination: string }> = [];
    if (email) rows.push({ channel: NotificationChannel.EMAIL, destination: email });
    if (phone) rows.push({ channel: NotificationChannel.SMS, destination: phone });
    for (const r of rows) {
      await db.notificationOutbox.create({
        data: {
          notificationId: notification.id,
          channel: r.channel,
          destination: r.destination,
          status: OutboxStatus.PENDING,
        },
      });
    }
  }

  /**
   * Process the outbox through the gateway (Session 39): sweep PENDING (and FAILED rows below the
   * retry ceiling), attempt a real send on the configured transport (console dev-sink by default),
   * and mark each row SENT on success / FAILED (retryable) on error. Never throws.
   */
  async dispatch(limit = 100): Promise<{ processed: number; sent: number; skipped: number; failed: number }> {
    const MAX_ATTEMPTS = 5;
    const rows = await this.prisma.notificationOutbox.findMany({
      where: { status: { in: [OutboxStatus.PENDING, OutboxStatus.FAILED] }, attempt: { lt: MAX_ATTEMPTS } },
      orderBy: { createdAt: 'asc' },
      take: Math.min(500, Math.max(1, limit)),
      include: { notification: { select: { title: true, message: true } } },
    });
    let sent = 0; let skipped = 0; let failed = 0;
    for (const row of rows) {
      const attempt = row.attempt + 1;
      let result: { ok: boolean; transport: 'console' | 'http'; error?: string };
      try {
        if (this.gateway) {
          result = await this.gateway.send({
            channel: row.channel,
            to: row.destination,
            title: row.notification?.title ?? '',
            message: row.notification?.message ?? '',
          });
        } else {
          // No gateway injected (e.g. unit test / degraded) — dev-sink equivalent.
          // eslint-disable-next-line no-console
          console.log(`[bilokat-notify:dev] ${row.channel} → ${row.destination} :: ${row.notification?.title ?? ''}`);
          result = { ok: true, transport: 'console' };
        }
      } catch (e: any) {
        result = { ok: false, transport: 'console', error: e?.message ?? 'dispatch error' };
      }
      if (result.ok) {
        await this.prisma.notificationOutbox.update({
          where: { id: row.id },
          data: { status: OutboxStatus.SENT, attempt, sentAt: new Date(), lastError: null },
        });
        sent++;
      } else {
        await this.markOutbox(row, attempt, OutboxStatus.FAILED, result.error ?? 'send failed');
        failed++;
      }
    }
    return { processed: rows.length, sent, skipped, failed };
  }

  private async markOutbox(row: NotificationOutbox, attempt: number, status: OutboxStatus, error?: string) {
    await this.prisma.notificationOutbox.update({
      where: { id: row.id },
      data: { status, attempt, lastError: error ?? null },
    });
  }

  // ---------------- Recipient reads (self-service) ----------------

  async forUser(userId: string, q: { page?: number; limit?: number } = {}) {
    const page = Math.max(1, Math.floor(q.page ?? 1));
    const limit = Math.min(100, Math.max(1, Math.floor(q.limit ?? 20)));
    const where: Prisma.NotificationWhereInput = { recipientUserId: userId };
    const [rows, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { ...where, readAt: null } }),
    ]);
    return { notifications: rows.map((n) => this.public(n)), unreadCount, total, page, limit };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { recipientUserId: userId, readAt: null } });
  }

  async markRead(userId: string, notificationId: string) {
    const n = await this.prisma.notification.findUnique({ where: { id: notificationId } });
    if (!n || n.recipientUserId !== userId) return { ok: false };
    if (!n.readAt) {
      await this.prisma.notification.update({ where: { id: notificationId }, data: { readAt: new Date() } });
    }
    return { ok: true };
  }

  async markAllRead(userId: string) {
    const res = await this.prisma.notification.updateMany({
      where: { recipientUserId: userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: res.count };
  }

  // ---------------- Operator oversight ----------------

  async staffList(q: { recipientUserId?: string; category?: string; unread?: string; page?: number; limit?: number } = {}) {
    const page = Math.max(1, Math.floor(q.page ?? 1));
    const limit = Math.min(100, Math.max(1, Math.floor(q.limit ?? 20)));
    const where: Prisma.NotificationWhereInput = {};
    if (q.recipientUserId) where.recipientUserId = q.recipientUserId;
    if (q.category) where.category = q.category as NotificationCategory;
    if (q.unread === 'true') where.readAt = null;
    const [rows, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { recipientUser: { select: { fullName: true, email: true, role: true } } },
      }),
      this.prisma.notification.count({ where }),
    ]);
    return {
      notifications: rows.map((n) => ({ ...this.public(n), recipient: n.recipientUser })),
      total,
      page,
      limit,
    };
  }

  async outboxList(q: { status?: string; page?: number; limit?: number } = {}) {
    const page = Math.max(1, Math.floor(q.page ?? 1));
    const limit = Math.min(100, Math.max(1, Math.floor(q.limit ?? 20)));
    const where: Prisma.NotificationOutboxWhereInput = {};
    if (q.status) where.status = q.status as OutboxStatus;
    const [rows, total] = await Promise.all([
      this.prisma.notificationOutbox.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notificationOutbox.count({ where }),
    ]);
    return { rows, total, page, limit };
  }

  private public(n: Notification) {
    return {
      id: n.id,
      category: n.category,
      title: n.title,
      message: n.message,
      refKind: n.refKind,
      refId: n.refId,
      read: !!n.readAt,
      readAt: n.readAt?.toISOString?.() ?? null,
      createdAt: n.createdAt.toISOString(),
    };
  }
}
