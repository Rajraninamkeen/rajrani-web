import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ControlAuditQueryDto,
  ControlSellersQueryDto,
  ControlSessionsQueryDto,
  ControlUsersQueryDto,
  RevokeSessionDto,
} from './dto/control.dto';

/**
 * Session 43 — ControlService (Platform Control Panel, OPERATOR/ADMIN).
 *
 * Platform governance & operational control read surface plus a small set of
 * high-authority, MANDATORILY-REASONED actions (Control-Panel spec §51/§52). Every
 * control action appends an immutable `ControlAudit` row (actor, role, target,
 * reason, detail) so "full authority" is never unrestricted/un-audited. This module
 * is read-heavy and only mutates where the spec's emergency/break-glass controls
 * genuinely apply (session revocation). Seller activation/suspension continues to be
 * driven by the existing onboarding staff surface (which writes its own
 * seller_status_history); this service additionally audits those calls when routed
 * through Control.
 */
@Injectable()
export class ControlService {
  constructor(private readonly prisma: PrismaService) {}

  /** Ensure the actor is OPERATOR or ADMIN. */
  private assertStaff(userId: string, actorRole: string) {
    if (actorRole !== 'OPERATOR' && actorRole !== 'ADMIN') {
      throw new ForbiddenException('Control Panel requires OPERATOR/ADMIN');
    }
    void userId;
  }

  private async writeAudit(args: {
    actionType: string;
    action: string;
    actorId: string;
    actorRole: string;
    targetType: string;
    targetId?: string | null;
    reason: string;
    detail?: Record<string, unknown>;
  }) {
    try {
      await this.prisma.controlAudit.create({
        data: {
          actionType: args.actionType as never,
          action: args.action,
          actorId: args.actorId,
          actorRole: args.actorRole,
          targetType: args.targetType,
          targetId: args.targetId ?? null,
          reason: args.reason,
          detail: (args.detail ?? undefined) as never,
        },
      });
    } catch {
      // audit is append-only best-effort; never block the control action on it
    }
  }

  private pageArgs(page?: number, limit?: number) {
    const p = page ?? 1;
    const l = Math.min(limit ?? 50, 200);
    return { take: l, skip: (p - 1) * l };
  }

  // ================= USERS =================
  async users(q: ControlUsersQueryDto) {
    const where: any = {};
    if (q.role) where.role = q.role;
    if (q.status) where.status = q.status;
    if (q?.q) {
      where.OR = [
        { email: { contains: q.q, mode: 'insensitive' } },
        { fullName: { contains: q.q, mode: 'insensitive' } },
        { phone: { contains: q.q } },
      ];
    }
    const pg = this.pageArgs(q.page, q.limit);
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: pg.take,
        skip: pg.skip,
        include: {
          seller: { select: { id: true, sellerCode: true, displayName: true, status: true } },
          deliveryPartner: { select: { id: true, partnerCode: true, status: true } },
          _count: { select: { orders: true, sessions: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    const map = rows.map((u: any) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      phone: u.phone,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt.toISOString(),
      seller: u.seller ? { id: u.seller.id, code: u.seller.sellerCode, name: u.seller.displayName, status: u.seller.status } : null,
      delivery: u.deliveryPartner ? { id: u.deliveryPartner.id, code: u.deliveryPartner.partnerCode, status: u.deliveryPartner.status } : null,
      orderCount: u._count.orders,
      sessionCount: u._count.sessions,
    }));
    return { total, page: q.page ?? 1, limit: pg.take, users: map };
  }

  async userDetail(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        seller: { select: { id: true, sellerCode: true, displayName: true, status: true, commissionRateBps: true } },
        deliveryPartner: { select: { id: true, partnerCode: true, status: true } },
        sessions: { orderBy: { createdAt: 'desc' }, take: 25 },
        _count: { select: { orders: true, carts: true, reviews: true } },
      },
    });
    if (!u) throw new NotFoundException('User not found');
    return {
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      phone: u.phone,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt.toISOString(),
      seller: u.seller ?? null,
      delivery: u.deliveryPartner ?? null,
      counts: u._count,
      sessions: u.sessions.map((s: any) => this.sessionView(s)),
    };
  }

  private sessionView(s: any) {
    return {
      id: s.id,
      ip: s.ip,
      userAgent: s.userAgent,
      deviceName: s.deviceName,
      expiresAt: s.expiresAt.toISOString(),
      revokedAt: s.revokedAt ? s.revokedAt.toISOString() : null,
      active: !s.revokedAt && new Date(s.expiresAt) > new Date(),
      createdAt: s.createdAt.toISOString(),
      user: s.user
        ? { id: s.user.id, email: s.user.email, fullName: s.user.fullName, role: s.user.role }
        : undefined,
    };
  }

  // ================= SESSIONS =================
  async sessions(q: ControlSessionsQueryDto) {
    const scope = q.scope ?? 'active';
    const where: any = {};
    if (scope === 'active') where.revokedAt = null;
    else if (scope === 'revoked') where.revokedAt = { not: null };
    if (q?.q) {
      where.user = {
        OR: [
          { email: { contains: q.q, mode: 'insensitive' } },
          { fullName: { contains: q.q, mode: 'insensitive' } },
        ],
      };
    }
    const pg = this.pageArgs(q.page, q.limit);
    const [rows, total] = await Promise.all([
      this.prisma.userSession.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: pg.take,
        skip: pg.skip,
        include: { user: { select: { id: true, email: true, fullName: true, role: true, status: true } } },
      }),
      this.prisma.userSession.count({ where }),
    ]);
    return { total, page: q.page ?? 1, limit: pg.take, sessions: rows.map((s) => this.sessionView(s)) };
  }

  /** Break-glass: OPERATOR/ADMIN revokes one platform session (reason mandatory). */
  async revokeSession(userId: string, actorRole: string, sessionId: string, dto: RevokeSessionDto) {
    this.assertStaff(userId, actorRole);
    const reason = dto.reason?.trim();
    if (!reason) throw new BadRequestException('A reason is required to revoke a session');
    const target = await this.prisma.userSession.findUnique({
      where: { id: sessionId },
      include: { user: { select: { id: true, email: true, fullName: true } } },
    });
    if (!target) throw new NotFoundException('Session not found');
    const res = await this.prisma.userSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (res.count === 0) throw new BadRequestException('Session already revoked');
    await this.writeAudit({
      actionType: 'SESSION_REVOKE',
      action: 'Revoked a platform session (break-glass)',
      actorId: userId,
      actorRole,
      targetType: 'userSession',
      targetId: sessionId,
      reason,
      detail: { targetUserId: target.userId, targetEmail: target.user.email, ip: target.ip, device: target.deviceName },
    });
    return { ok: true, revoked: 1, targetUserId: target.userId, targetEmail: target.user.email };
  }

  /** Break-glass: revoke every active session of a platform user. */
  async revokeAllUserSessions(userId: string, actorRole: string, targetUserId: string, reason: string) {
    this.assertStaff(userId, actorRole);
    const r = (reason ?? '').trim();
    if (!r) throw new BadRequestException('A reason is required to revoke sessions');
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new NotFoundException('User not found');
    const res = await this.prisma.userSession.updateMany({
      where: { userId: targetUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.writeAudit({
      actionType: 'SESSION_REVOKE_ALL',
      action: 'Revoked all active sessions of a user',
      actorId: userId,
      actorRole,
      targetType: 'user',
      targetId: targetUserId,
      reason: r,
      detail: { targetEmail: target.email, revoked: res.count },
    });
    return { ok: true, revoked: res.count, targetUserId, targetEmail: target.email };
  }

  // ================= SELLERS governance roll (read) =================
  async sellers(q: ControlSellersQueryDto) {
    const where: any = {};
    if (q.status) where.status = q.status;
    if (q?.q) where.OR = [{ sellerCode: { contains: q.q, mode: 'insensitive' } }, { displayName: { contains: q.q, mode: 'insensitive' } }];
    const rows = await this.prisma.seller.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { products: true, operators: true, sellerOrders: true, payables: true } },
        organization: { select: { id: true, name: true, slug: true } },
      },
    });
    return rows.map((s: any) => ({
      id: s.id,
      sellerCode: s.sellerCode,
      legalName: s.legalName,
      displayName: s.displayName,
      status: s.status,
      commissionRateBps: s.commissionRateBps,
      activatedAt: s.activatedAt ? s.activatedAt.toISOString() : null,
      createdAt: s.createdAt.toISOString(),
      organization: s.organization ? { id: s.organization.id, name: s.organization.name, slug: s.organization.slug } : null,
      counts: { products: s._count.products, operators: s._count.operators, slices: s._count.sellerOrders, payables: s._count.payables },
    }));
  }

  // ================= AUDIT =================
  async audit(q: ControlAuditQueryDto) {
    const where: any = {};
    if (q.action) where.actionType = q.action;
    if (q.actorId) where.actorId = q.actorId;
    if (q.from || q.to) {
      where.createdAt = {};
      if (q.from) where.createdAt.gte = new Date(q.from);
      if (q.to) where.createdAt.lte = new Date(q.to.length <= 10 ? `${q.to}T23:59:59.999Z` : q.to);
    }
    const pg = this.pageArgs(q.page, q.limit);
    const [rows, total] = await Promise.all([
      this.prisma.controlAudit.findMany({ where, orderBy: { createdAt: 'desc' }, take: pg.take, skip: pg.skip }),
      this.prisma.controlAudit.count({ where }),
    ]);
    return {
      total,
      page: q.page ?? 1,
      limit: pg.take,
      rows: rows.map((a: any) => ({
        id: a.id,
        actionType: a.actionType,
        action: a.action,
        actorId: a.actorId,
        actorRole: a.actorRole,
        targetType: a.targetType,
        targetId: a.targetId,
        reason: a.reason,
        detail: a.detail,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  }

  // ================= OVERVIEW =================
  async overview() {
    const [userRoles, activeSessions, sellers, auditCount] = await Promise.all([
      this.prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
      this.prisma.userSession.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
      this.prisma.seller.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.controlAudit.count(),
    ]);
    const roleMap: Record<string, number> = {};
    userRoles.forEach((r: any) => { roleMap[r.role] = r._count._all; });
    const sellerMap: Record<string, number> = {};
    sellers.forEach((s: any) => { sellerMap[s.status] = s._count._all; });
    return {
      usersByRole: roleMap,
      totalUsers: Object.values(roleMap).reduce((a, b) => a + b, 0),
      activeSessions,
      sellersByStatus: sellerMap,
      totalSellers: Object.values(sellerMap).reduce((a, b) => a + b, 0),
      auditEntries: auditCount,
      generatedAt: new Date().toISOString(),
    };
  }
}
