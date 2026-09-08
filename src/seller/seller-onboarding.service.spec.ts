import { BadRequestException, ConflictException } from '@nestjs/common';
import { SellerOnboardingService } from './seller-onboarding.service';

describe('SellerOnboardingService (Session 14)', () => {
  let prisma: any;
  let service: SellerOnboardingService;
  let tx: any;

  function freshPrisma() {
    tx = {
      seller: { update: jest.fn(), create: jest.fn() },
      sellerApplication: { update: jest.fn() },
      sellerReview: { create: jest.fn() },
      sellerStatusHistory: { create: jest.fn() },
      user: { upsert: jest.fn() },
      organization: { create: jest.fn() },
      organizationMember: { upsert: jest.fn() },
    };
    prisma = {
      user: { findUnique: jest.fn() },
      seller: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      sellerApplication: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
      sellerDocument: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
      sellerReview: { create: jest.fn() },
      sellerStatusHistory: { create: jest.fn() },
      organization: { create: jest.fn() },
      organizationMember: { upsert: jest.fn() },
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    };
  }

  function owner() {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'SELLER', sellerId: 'sel1' });
  }
  function sellerObj(over: any = {}) {
    return {
      id: 'sel1',
      sellerCode: 'SELL-X',
      legalName: 'X Pvt Ltd',
      displayName: 'X',
      status: 'PENDING',
      commissionRateBps: 0,
      activatedAt: null,
      organization: { id: 'org1', name: 'X', slug: 'org-x', type: 'SELLER' },
      ...over,
    };
  }
  function appObj(over: any = {}) {
    return {
      id: 'app1',
      sellerId: 'sel1',
      applicationNumber: 'SAPP-1',
      status: 'DRAFT',
      gstin: null,
      agreedToTerms: true,
      submittedAt: null,
      reviewedAt: null,
      correctionReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      documents: [],
      ...over,
    };
  }

  beforeEach(() => {
    freshPrisma();
    service = new SellerOnboardingService(prisma);
  });

  it('me returns the seller org + current application', async () => {
    owner();
    prisma.seller.findUnique.mockResolvedValue(sellerObj());
    prisma.sellerApplication.findFirst.mockResolvedValue(appObj());
    const res = await service.me('u1');
    expect(res.seller.id).toBe('sel1');
    expect(res.application!.applicationNumber).toBe('SAPP-1');
  });

  it('submitApplication throws when terms not accepted', async () => {
    owner();
    prisma.seller.findUnique.mockResolvedValue(sellerObj());
    prisma.sellerApplication.findFirst.mockResolvedValue(appObj({ agreedToTerms: false }));
    await expect(service.submitApplication('u1')).rejects.toThrow(BadRequestException);
  });

  it('submitApplication transitions seller to UNDER_REVIEW and logs history', async () => {
    owner();
    prisma.seller.findUnique.mockResolvedValue(sellerObj({ status: 'PENDING' }));
    prisma.sellerApplication.findFirst.mockResolvedValue(appObj());
    prisma.sellerApplication.update.mockResolvedValue(appObj({ status: 'SUBMITTED', submittedAt: new Date() }));
    prisma.seller.update.mockResolvedValue({ id: 'sel1', status: 'UNDER_REVIEW' });
    prisma.sellerStatusHistory.create.mockResolvedValue({ id: 'h1' });
    const res = await service.submitApplication('u1');
    expect(prisma.sellerApplication.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SUBMITTED' }) }),
    );
    expect(prisma.seller.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'UNDER_REVIEW' }) }),
    );
    expect(prisma.sellerStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ toStatus: 'UNDER_REVIEW', fromStatus: 'PENDING' }) }),
    );
    expect(res.status).toBe('SUBMITTED');
  });

  it('review APPROVE closes the application and moves seller to APPROVED', async () => {
    prisma.sellerApplication.findUnique.mockResolvedValue({
      id: 'app1',
      sellerId: 'sel1',
      status: 'SUBMITTED',
      seller: sellerObj({ status: 'UNDER_REVIEW' }),
    });
    tx.sellerApplication.update.mockImplementation(async (args: any) => ({ id: 'app1', ...args.data }));
    tx.seller.update.mockResolvedValue({ id: 'sel1', status: 'APPROVED' });
    tx.sellerStatusHistory.create.mockResolvedValue({ id: 'h' });
    const res = await service.reviewApplication('rev1', 'app1', { decision: 'APPROVE', reason: 'looks good' } as any);
    expect(tx.sellerReview.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ reviewerId: 'rev1', decision: 'APPROVE' }) }),
    );
    expect(tx.seller.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'APPROVED' }) }),
    );
    expect(res.status).toBe('APPROVED');
  });

  it('review CORRECTION_REQUIRED moves seller back to PENDING for resubmission', async () => {
    prisma.sellerApplication.findUnique.mockResolvedValue({
      id: 'app1',
      sellerId: 'sel1',
      status: 'UNDER_REVIEW',
      seller: sellerObj({ status: 'UNDER_REVIEW' }),
    });
    tx.sellerApplication.update.mockImplementation(async (args: any) => ({ id: 'app1', ...args.data }));
    tx.seller.update.mockResolvedValue({ id: 'sel1', status: 'PENDING' });
    tx.sellerStatusHistory.create.mockResolvedValue({ id: 'h' });
    const res = await service.reviewApplication('rev1', 'app1', { decision: 'CORRECTION_REQUIRED', reason: 'gstin wrong' } as any);
    expect(tx.seller.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING' }) }));
    expect(res.status).toBe('CORRECTION_REQUIRED');
    expect(res.correctionReason).toBe('gstin wrong');
  });

  it('review is rejected once the application is closed', async () => {
    prisma.sellerApplication.findUnique.mockResolvedValue({
      id: 'app1', sellerId: 'sel1', status: 'APPROVED', seller: sellerObj({ status: 'APPROVED' }),
    });
    await expect(service.reviewApplication('rev1', 'app1', { decision: 'APPROVE' } as any)).rejects.toThrow(ConflictException);
  });

  it('activateSeller only allows APPROVED -> ACTIVE', async () => {
    prisma.seller.findUnique.mockResolvedValue(sellerObj({ status: 'APPROVED' }));
    tx.seller.update.mockResolvedValue({ id: 'sel1', status: 'ACTIVE' });
    tx.sellerStatusHistory.create.mockResolvedValue({ id: 'h' });
    await service.activateSeller('rev1', 'sel1');
    expect(tx.seller.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'ACTIVE' }) }));

    // Not APPROVED => conflict.
    prisma.seller.findUnique.mockResolvedValue(sellerObj({ status: 'PENDING' }));
    await expect(service.activateSeller('rev1', 'sel1')).rejects.toThrow(ConflictException);
  });

  it('addDocument uploads a PENDING KYC document and blocks editing once ACTIVE', async () => {
    owner();
    prisma.seller.findUnique.mockResolvedValue(sellerObj({ status: 'PENDING' }));
    prisma.sellerApplication.findFirst.mockResolvedValue(appObj());
    prisma.sellerDocument.create.mockResolvedValue({
      id: 'doc1', sellerId: 'sel1', documentType: 'GST_CERTIFICATE', fileName: 'gst.pdf', status: 'PENDING', uploadedAt: new Date(),
    });
    const doc = await service.addDocument('u1', { documentType: 'GST_CERTIFICATE', storageObjectId: 'obj1', fileName: 'gst.pdf' } as any);
    expect(doc.status).toBe('PENDING');
    expect(prisma.sellerDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ documentType: 'GST_CERTIFICATE' }) }),
    );

    prisma.seller.findUnique.mockResolvedValue(sellerObj({ status: 'ACTIVE' }));
    await expect(service.addDocument('u1', { documentType: 'PAN_CARD', storageObjectId: 'o', fileName: 'p.png' } as any)).rejects.toThrow(ConflictException);
  });

  it('verifyDocument marks a document VERIFIED or REJECTED', async () => {
    prisma.sellerDocument.findUnique.mockResolvedValue({ id: 'doc1', status: 'PENDING' });
    prisma.sellerDocument.update.mockResolvedValue({ id: 'doc1', status: 'VERIFIED' });
    await service.verifyDocument('rev1', 'doc1', { approved: true });
    expect(prisma.sellerDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'VERIFIED', verifiedBy: 'rev1' }) }),
    );
  });

  it('adminCreateSeller writes the status history on the transaction client (not this.prisma)', async () => {
    // Regression: status history must go through `tx` inside the transaction,
    // otherwise the uncommitted seller is invisible -> FK violation.
    prisma.seller.findUnique.mockResolvedValue(null);
    tx.organization.create.mockResolvedValue({ id: 'org1', type: 'SELLER', status: 'ACTIVE', name: 'X', slug: 'org-x' });
    tx.seller.create.mockResolvedValue({ id: 'sel1', status: 'ACTIVE', organizationId: 'org1', commissionRateBps: 0 });
    tx.sellerStatusHistory.create.mockResolvedValue({ id: 'h' });
    const result = await service.adminCreateSeller('op1', {
      legalName: 'X Ltd', businessName: 'X Market', commissionRateBps: 250,
    } as any);
    // Must have been called on tx, not on the outer prisma.sellerStatusHistory.
    expect(tx.sellerStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ toStatus: 'ACTIVE', sellerId: 'sel1' }) }),
    );
    expect(result.seller.status).toBe('ACTIVE');
  });

  it('adminCreateSeller binds an OWNER operator member when operatorEmail provided', async () => {
    prisma.seller.findUnique.mockResolvedValue(null);
    tx.organization.create.mockResolvedValue({ id: 'org1', type: 'SELLER', status: 'ACTIVE', name: 'X', slug: 'org-x' });
    tx.seller.create.mockResolvedValue({ id: 'sel1', status: 'ACTIVE', organizationId: 'org1' });
    tx.user.upsert.mockResolvedValue({ id: 'u9', email: 'op@x.com', role: 'SELLER' });
    tx.organizationMember.upsert.mockResolvedValue({ id: 'm9' });
    tx.sellerStatusHistory.create.mockResolvedValue({ id: 'h' });
    const result = await service.adminCreateSeller('op1', {
      legalName: 'X Ltd', businessName: 'X Market', operatorEmail: 'op@x.com', operatorPassword: 'Op@123', operatorFullName: 'Op',
    } as any);
    expect(result.operatorCreated).toBe(true);
    expect(tx.organizationMember.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ role: 'OWNER' }) }),
    );
  });

  it('adminSetSellerStatus suspends an ACTIVE seller with history', async () => {
    prisma.seller.findUnique.mockResolvedValue(sellerObj({ status: 'ACTIVE' }));
    tx.seller.update.mockResolvedValue({ id: 'sel1', status: 'SUSPENDED' });
    tx.sellerStatusHistory.create.mockResolvedValue({ id: 'h' });
    const res = await service.adminSetSellerStatus('op1', 'sel1', { status: 'SUSPENDED', reason: 'policy' } as any);
    expect(tx.seller.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'SUSPENDED' }) }));
    expect(tx.sellerStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ toStatus: 'SUSPENDED', fromStatus: 'ACTIVE' }) }),
    );
    expect(res.status).toBe('SUSPENDED');
  });
});
