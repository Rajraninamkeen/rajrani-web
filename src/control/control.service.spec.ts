import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ControlService } from './control.service';

describe('ControlService (Session 43 — Platform Control Panel)', () => {
  let prisma: any;
  let service: ControlService;

  beforeEach(() => {
    prisma = {
      user: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn(), groupBy: jest.fn() },
      userSession: { findMany: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn(), count: jest.fn(), groupBy: jest.fn() },
      seller: { findMany: jest.fn(), groupBy: jest.fn() },
      controlAudit: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    };
    service = new ControlService(prisma as any);
  });

  describe('users directory', () => {
    it('lists users with seller/delivery binding + counts, respecting filters/page', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', email: 'a@x.com', fullName: 'A', phone: '1', role: 'CUSTOMER', status: 'ACTIVE', createdAt: new Date('2026-01-01'),
          seller: null, deliveryPartner: null, _count: { orders: 2, sessions: 1 } },
        { id: 'u2', email: 'b@x.com', fullName: 'B', phone: '2', role: 'SELLER', status: 'ACTIVE', createdAt: new Date('2026-01-02'),
          seller: { id: 's1', sellerCode: 'SC1', displayName: 'S1', status: 'ACTIVE' }, deliveryPartner: null, _count: { orders: 0, sessions: 3 } },
      ]);
      prisma.user.count.mockResolvedValue(2);
      const out: any = await service.users({ role: 'SELLER', page: 1, limit: 20 });
      expect(prisma.user.findMany).toHaveBeenCalled();
      expect(out.total).toBe(2);
      expect(out.users[1].seller.code).toBe('SC1');
      expect(out.users[0].sessionCount).toBe(1);
      expect(out.users[1].role).toBe('SELLER');
    });
  });

  describe('userDetail', () => {
    it('throws 404 for unknown user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.userDetail('nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('sessions registry', () => {
    it('filters active sessions and maps the owning user', async () => {
      prisma.userSession.findMany.mockResolvedValue([
        { id: 'se1', ip: '1.1.1.1', userAgent: 'UA', deviceName: null, expiresAt: new Date(Date.now() + 100000), revokedAt: null, createdAt: new Date(),
          user: { id: 'u1', email: 'a@x.com', fullName: 'A', role: 'CUSTOMER' } },
      ]);
      prisma.userSession.count.mockResolvedValue(1);
      const out: any = await service.sessions({ scope: 'active', page: 1, limit: 10 });
      expect(out.sessions[0].active).toBe(true);
      expect(out.sessions[0].user.email).toBe('a@x.com');
    });
  });

  describe('revokeSession (break-glass)', () => {
    it('requires a reason', async () => {
      await expect(service.revokeSession('op', 'OPERATOR', 'se1', { reason: '  ' }))
        .rejects.toBeInstanceOf(BadRequestException);
    });
    it('rejects a non-staff actor', async () => {
      prisma.userSession.findUnique.mockResolvedValue({ id: 'se1', userId: 'u1', user: { id: 'u1', email: 'a@x.com' }, ip: null, deviceName: null });
      await expect(service.revokeSession('cu', 'CUSTOMER', 'se1', { reason: 'test' }))
        .rejects.toBeInstanceOf(ForbiddenException);
    });
    it('revokes the session and appends an audit row with the reason', async () => {
      prisma.userSession.findUnique.mockResolvedValue({ id: 'se1', userId: 'u1', ip: '1.1.1.1', deviceName: 'Chrome', user: { id: 'u1', email: 'a@x.com', fullName: 'A' } });
      prisma.userSession.updateMany.mockResolvedValue({ count: 1 });
      prisma.controlAudit.create.mockResolvedValue({});
      const out: any = await service.revokeSession('op', 'OPERATOR', 'se1', { reason: 'compromised device' });
      expect(out.revoked).toBe(1);
      expect(out.targetEmail).toBe('a@x.com');
      const auditCall = prisma.controlAudit.create.mock.calls[0][0];
      expect(auditCall.data.actionType).toBe('SESSION_REVOKE');
      expect(auditCall.data.reason).toBe('compromised device');
      expect(auditCall.data.actorRole).toBe('OPERATOR');
    });
    it('returns 400 if the session was already revoked', async () => {
      prisma.userSession.findUnique.mockResolvedValue({ id: 'se1', userId: 'u1', user: { id: 'u1', email: 'a@x.com' }, ip: null, deviceName: null });
      prisma.userSession.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.revokeSession('op', 'OPERATOR', 'se1', { reason: 'x' }))
        .rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('revokeAllUserSessions', () => {
    it('revokes all active sessions of a user and audits', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@x.com' });
      prisma.userSession.updateMany.mockResolvedValue({ count: 4 });
      const out: any = await service.revokeAllUserSessions('op', 'OPERATOR', 'u1', 'security incident');
      expect(out.revoked).toBe(4);
      expect(prisma.controlAudit.create.mock.calls[0][0].data.actionType).toBe('SESSION_REVOKE_ALL');
    });
  });

  describe('sellers governance roll', () => {
    it('reads sellers with counts + org binding', async () => {
      prisma.seller.findMany.mockResolvedValue([
        { id: 's1', sellerCode: 'SC1', legalName: 'L', displayName: 'D', status: 'ACTIVE', commissionRateBps: 1000, activatedAt: null, createdAt: new Date(),
          organization: { id: 'o1', name: 'Org', slug: 'org' }, _count: { products: 5, operators: 2, sellerOrders: 9, payables: 3 } },
      ]);
      const out: any = await service.sellers({});
      expect(out[0].counts.products).toBe(5);
      expect(out[0].counts.operators).toBe(2);
      expect(out[0].organization.name).toBe('Org');
      expect(out[0].commissionRateBps).toBe(1000);
    });
  });

  describe('audit', () => {
    it('returns recent control-audit rows with filters', async () => {
      prisma.controlAudit.findMany.mockResolvedValue([
        { id: 'a1', actionType: 'SESSION_REVOKE', action: 'Revoked a session', actorId: 'op', actorRole: 'OPERATOR', targetType: 'userSession', targetId: 'se1', reason: 'r', detail: null, createdAt: new Date() },
      ]);
      prisma.controlAudit.count.mockResolvedValue(1);
      const out: any = await service.audit({ action: 'SESSION_REVOKE', page: 1, limit: 20 });
      expect(out.total).toBe(1);
      expect(out.rows[0].actionType).toBe('SESSION_REVOKE');
      expect(out.rows[0].actorRole).toBe('OPERATOR');
    });
  });

  describe('overview', () => {
    it('aggregates users-by-role, active sessions, sellers-by-status, audit count', async () => {
      prisma.user.groupBy.mockResolvedValue([{ role: 'CUSTOMER', _count: { _all: 3 } }, { role: 'OPERATOR', _count: { _all: 1 } }]);
      prisma.userSession.count.mockResolvedValue(5);
      prisma.seller.groupBy.mockResolvedValue([{ status: 'ACTIVE', _count: { _all: 2 } }]);
      prisma.controlAudit.count.mockResolvedValue(7);
      const out: any = await service.overview();
      expect(out.usersByRole.CUSTOMER).toBe(3);
      expect(out.totalUsers).toBe(4);
      expect(out.activeSessions).toBe(5);
      expect(out.sellersByStatus.ACTIVE).toBe(2);
      expect(out.auditEntries).toBe(7);
    });
  });
});
