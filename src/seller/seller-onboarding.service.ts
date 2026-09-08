import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import {
  DocumentVerificationStatus,
  OrganizationMemberRole,
  Prisma,
  ReviewDecision,
  SellerApplicationStatus,
  SellerStatus,
} from '../generated/prisma/client';
import {
  AddSellerDocumentDto,
  AdminCreateSellerDto,
  AdminSellerStatusDto,
  ApplicationListQuery,
  ReviewSellerApplicationDto,
  UpdateSellerProfileDto,
  VerifyDocumentDto,
} from './dto/seller-onboarding.dto';

// Seller statuses in which the owner may still edit/submit their onboarding.
const OWNER_EDITABLE: SellerStatus[] = [
  SellerStatus.REGISTERED,
  SellerStatus.PENDING,
  SellerStatus.UNDER_REVIEW,
];
const CLOSED_APP_STATUSES: SellerApplicationStatus[] = [
  SellerApplicationStatus.APPROVED,
  SellerApplicationStatus.REJECTED,
];
const RESUBMIT_APP_STATUSES: SellerApplicationStatus[] = [
  SellerApplicationStatus.CORRECTION_REQUIRED,
  SellerApplicationStatus.ADDITIONAL_INFORMATION_REQUIRED,
  SellerApplicationStatus.RESUBMITTED,
];
const OPERATIONAL_SELLER_STATUSES: SellerStatus[] = [
  SellerStatus.ACTIVE,
  SellerStatus.SUSPENDED,
  SellerStatus.DEACTIVATED,
];

type Txn = Prisma.TransactionClient;

@Injectable()
export class SellerOnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================= Owner (seller) self-service =============================

  /** Resolve the caller's bound seller and confirm they own it. */
  private async requireOwnSeller(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== 'SELLER' || !user.sellerId) {
      throw new ForbiddenException('Seller account required');
    }
    const seller = await this.prisma.seller.findUnique({
      where: { id: user.sellerId },
      include: { organization: { select: { id: true, name: true, slug: true, type: true } } },
    });
    if (!seller) throw new ForbiddenException('Seller not found for this account');
    return { user, seller };
  }

  private async latestApplication(sellerId: string) {
    return this.prisma.sellerApplication.findFirst({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
      include: { documents: { orderBy: { uploadedAt: 'asc' } } },
    });
  }

  /** Owner view: seller org + current application + documents. */
  async me(userId: string) {
    const { seller } = await this.requireOwnSeller(userId);
    const application = await this.latestApplication(seller.id);
    return { seller: this.sellerPublic(seller), application: application ? this.applicationPublic(application) : null };
  }

  /** Fill business / KYC profile on the current draft application. */
  async updateProfile(userId: string, dto: UpdateSellerProfileDto) {
    const { seller } = await this.requireOwnSeller(userId);
    this.assertOwnerEditable(seller.status);
    let app: any = await this.latestApplication(seller.id);
    if (!app) {
      app = await this.prisma.sellerApplication.create({
        data: {
          sellerId: seller.id,
          applicationNumber: `SAPP-${randomBytes(4).toString('hex').toUpperCase()}`,
          status: SellerApplicationStatus.DRAFT,
        },
      });
    }
    if (dto.businessName && dto.businessName !== seller.displayName) {
      await this.prisma.seller.update({
        where: { id: seller.id },
        data: { displayName: dto.businessName },
      });
    }
    const agreedToTermsAt = dto.agreedToTerms ? app.agreedToTermsAt ?? new Date() : app.agreedToTermsAt;
    const updated = await this.prisma.sellerApplication.update({
      where: { id: app.id },
      data: {
        gstin: dto.gstin,
        pan: dto.pan,
        businessAddress: dto.businessAddress,
        city: dto.city,
        state: dto.state,
        bankAccountHolder: dto.bankAccountHolder,
        bankAccountLast4: dto.bankAccountLast4,
        bankIfsc: dto.bankIfsc,
        payoutPreference: dto.payoutPreference,
        ...(dto.agreedToTerms !== undefined ? { agreedToTerms: dto.agreedToTerms, agreedToTermsAt } : {}),
      },
    });
    return this.applicationPublic(updated);
  }

  /** Upload a KYC document against the owner's seller. */
  async addDocument(userId: string, dto: AddSellerDocumentDto) {
    const { seller, user } = await this.requireOwnSeller(userId);
    this.assertOwnerEditable(seller.status);
    const app = await this.latestApplication(seller.id);
    const doc = await this.prisma.sellerDocument.create({
      data: {
        sellerId: seller.id,
        applicationId: app?.id ?? null,
        documentType: dto.documentType,
        storageObjectId: dto.storageObjectId,
        fileName: dto.fileName,
        mimeType: dto.mimeType ?? null,
        sizeBytes: dto.sizeBytes ?? null,
        status: DocumentVerificationStatus.PENDING,
        uploadedBy: user.id,
      },
    });
    return this.documentPublic(doc);
  }

  /** Submit the application for review (first time or resubmit after a correction). */
  async submitApplication(userId: string) {
    const { seller } = await this.requireOwnSeller(userId);
    this.assertOwnerEditable(seller.status);
    let app: any = await this.latestApplication(seller.id);
    if (!app) {
      app = await this.prisma.sellerApplication.create({
        data: {
          sellerId: seller.id,
          applicationNumber: `SAPP-${randomBytes(4).toString('hex').toUpperCase()}`,
          status: SellerApplicationStatus.DRAFT,
        },
      });
    }
    if (CLOSED_APP_STATUSES.includes(app.status)) {
      throw new ConflictException('This application is already closed');
    }
    if (!app.agreedToTerms) {
      throw new BadRequestException('You must accept the marketplace terms before submitting');
    }
    const resubmitting = RESUBMIT_APP_STATUSES.includes(app.status);
    const newAppStatus = resubmitting ? SellerApplicationStatus.RESUBMITTED : SellerApplicationStatus.SUBMITTED;
    const fromSeller = seller.status;
    await this.logStatus(seller.id, fromSeller, SellerStatus.UNDER_REVIEW, userId, 'Application submitted for review');
    const updated = await this.prisma.sellerApplication.update({
      where: { id: app.id },
      data: { status: newAppStatus, submittedAt: new Date() },
    });
    await this.prisma.seller.update({ where: { id: seller.id }, data: { status: SellerStatus.UNDER_REVIEW } });
    return this.applicationPublic(updated);
  }

  // ============================= Operator-managed sellers =============================

  /** Create an already-ACTIVE seller org (operator path). Optionally binds an operator. */
  async adminCreateSeller(actorId: string, dto: AdminCreateSellerDto) {
    const sellerCode = dto.sellerCode ?? `SELL-${randomBytes(4).toString('hex').toUpperCase()}`;
    const exists = await this.prisma.seller.findUnique({ where: { sellerCode } });
    if (exists) throw new ConflictException('That sellerCode is already in use');
    const orgSlug = `org-${slugify(dto.businessName)}-${randomBytes(2).toString('hex')}`;

    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: dto.businessName, slug: orgSlug, type: 'SELLER', status: 'ACTIVE' },
      });
      const seller = await tx.seller.create({
        data: {
          sellerCode,
          legalName: dto.legalName,
          displayName: dto.businessName,
          status: SellerStatus.ACTIVE,
          commissionRateBps: dto.commissionRateBps ?? 0,
          organizationId: org.id,
          activatedAt: new Date(),
        },
      });
      await this.logStatusTx(tx, seller.id, null, SellerStatus.ACTIVE, actorId, 'Seller org created (operator)');
      let operatorCreated = false;
      if (dto.operatorEmail) {
        const passwordHash = await hash(dto.operatorPassword ?? 'Seller@123', 12);
        const operator = await tx.user.upsert({
          where: { email: dto.operatorEmail.toLowerCase() },
          update: { role: 'SELLER', sellerId: seller.id, status: 'ACTIVE' },
          create: {
            email: dto.operatorEmail.toLowerCase(),
            fullName: dto.operatorFullName ?? dto.businessName,
            passwordHash,
            role: 'SELLER',
            sellerId: seller.id,
            status: 'ACTIVE',
          },
        });
        await tx.organizationMember.upsert({
          where: { organizationId_userId: { organizationId: org.id, userId: operator.id } },
          update: { role: OrganizationMemberRole.OWNER, status: 'ACTIVE' },
          create: { organizationId: org.id, userId: operator.id, role: OrganizationMemberRole.OWNER, status: 'ACTIVE' },
        });
        operatorCreated = true;
      }
      return { seller: this.sellerPublic(seller), organization: org, operatorCreated };
    });
  }

  // ============================= Review (REVIEWER/ADMIN) =============================

  async listApplications(query: ApplicationListQuery) {
    const page = Math.max(1, Math.floor(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Math.floor(query.limit ?? 20)));
    const where: Prisma.SellerApplicationWhereInput = {};
    if (query.status) {
      const st = (SellerApplicationStatus as Record<string, SellerApplicationStatus>)[query.status];
      if (!st) throw new BadRequestException(`Unknown application status "${query.status}"`);
      where.status = st;
    }
    if (query.sellerId) where.sellerId = query.sellerId;
    const [rows, total] = await Promise.all([
      this.prisma.sellerApplication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          seller: { select: { id: true, sellerCode: true, legalName: true, displayName: true, status: true } },
        },
      }),
      this.prisma.sellerApplication.count({ where }),
    ]);
    return {
      applications: rows.map((r) => this.applicationPublic(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getApplication(applicationId: string) {
    const app = await this.prisma.sellerApplication.findUnique({
      where: { id: applicationId },
      include: {
        seller: { include: { organization: true, operators: { select: { id: true, email: true, fullName: true } } } },
        documents: { orderBy: { uploadedAt: 'asc' } },
        reviews: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!app) throw new NotFoundException('Application not found');
    return {
      ...this.applicationPublic(app),
      seller: this.sellerPublic(app.seller),
      documents: app.documents.map((d) => this.documentPublic(d)),
      reviews: app.reviews.map((r) => ({
        reviewerId: r.reviewerId,
        decision: r.decision,
        reason: r.reason,
        notes: r.notes,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  async reviewApplication(reviewerId: string, applicationId: string, dto: ReviewSellerApplicationDto) {
    const app = await this.prisma.sellerApplication.findUnique({
      where: { id: applicationId },
      include: { seller: true },
    });
    if (!app) throw new NotFoundException('Application not found');
    if (CLOSED_APP_STATUSES.includes(app.status)) {
      throw new ConflictException('This application is already closed');
    }
    const now = new Date();
    const reason = dto.reason ?? null;

    return this.prisma.$transaction(async (tx) => {
      await tx.sellerReview.create({
        data: {
          sellerApplicationId: applicationId,
          reviewerId,
          decision: dto.decision,
          reason,
          notes: dto.notes ?? null,
        },
      });
      const fromSeller = app.seller.status;
      let newAppStatus: SellerApplicationStatus;
      let toSellerStatus: SellerStatus;
      switch (dto.decision) {
        case ReviewDecision.APPROVE:
          newAppStatus = SellerApplicationStatus.APPROVED;
          toSellerStatus = SellerStatus.APPROVED;
          break;
        case ReviewDecision.REJECT:
          newAppStatus = SellerApplicationStatus.REJECTED;
          toSellerStatus = SellerStatus.REJECTED;
          break;
        case ReviewDecision.CORRECTION_REQUIRED:
          newAppStatus = SellerApplicationStatus.CORRECTION_REQUIRED;
          toSellerStatus = SellerStatus.PENDING;
          break;
        case ReviewDecision.ADDITIONAL_INFORMATION_REQUIRED:
          newAppStatus = SellerApplicationStatus.ADDITIONAL_INFORMATION_REQUIRED;
          toSellerStatus = SellerStatus.PENDING;
          break;
      }
      await this.logStatusTx(tx, app.sellerId, fromSeller, toSellerStatus, reviewerId, reason ?? `Review: ${dto.decision}`);
      await tx.seller.update({
        where: { id: app.sellerId },
        data: { status: toSellerStatus },
      });
      const data: Prisma.SellerApplicationUpdateInput = {
        status: newAppStatus,
        reviewedAt: now,
        reviewedBy: reviewerId,
        rejectionReason: dto.decision === ReviewDecision.REJECT ? reason : null,
        correctionReason:
          dto.decision === ReviewDecision.CORRECTION_REQUIRED ||
          dto.decision === ReviewDecision.ADDITIONAL_INFORMATION_REQUIRED
            ? reason
            : null,
      };
      return tx.sellerApplication.update({ where: { id: applicationId }, data });
    });
  }

  /** Mark a KYC document verified or rejected. */
  async verifyDocument(reviewerId: string, documentId: string, dto: VerifyDocumentDto) {
    const doc = await this.prisma.sellerDocument.findUnique({ where: { id: documentId } });
    if (!doc) throw new NotFoundException('Document not found');
    return this.prisma.sellerDocument.update({
      where: { id: documentId },
      data: {
        status: dto.approved ? DocumentVerificationStatus.VERIFIED : DocumentVerificationStatus.REJECTED,
        verifiedAt: new Date(),
        verifiedBy: reviewerId,
        rejectionReason: dto.approved ? null : (dto.reason ?? 'Document rejected'),
      },
    });
  }

  /** Activation: only an APPROVED seller can be activated to ACTIVE. */
  async activateSeller(actorId: string, sellerId: string) {
    const seller = await this.prisma.seller.findUnique({ where: { id: sellerId } });
    if (!seller) throw new NotFoundException('Seller not found');
    if (seller.status !== SellerStatus.APPROVED) {
      throw new ConflictException('Only an APPROVED seller can be activated');
    }
    return this.prisma.$transaction(async (tx) => {
      await this.logStatusTx(tx, sellerId, SellerStatus.APPROVED, SellerStatus.ACTIVE, actorId, 'Seller activated');
      return tx.seller.update({
        where: { id: sellerId },
        data: { status: SellerStatus.ACTIVE, activatedAt: new Date() },
      });
    });
  }

  /** Operational control (suspend / deactivate / reactivate) by OPERATOR/ADMIN. */
  async adminSetSellerStatus(actorId: string, sellerId: string, dto: AdminSellerStatusDto) {
    if (!OPERATIONAL_SELLER_STATUSES.includes(dto.status)) {
      throw new BadRequestException('Operational status must be ACTIVE, SUSPENDED or DEACTIVATED');
    }
    const seller = await this.prisma.seller.findUnique({ where: { id: sellerId } });
    if (!seller) throw new NotFoundException('Seller not found');
    if (seller.status === dto.status) throw new ConflictException('Seller is already in that status');
    return this.prisma.$transaction(async (tx) => {
      await this.logStatusTx(tx, sellerId, seller.status, dto.status, actorId, dto.reason ?? 'Operational status change');
      return tx.seller.update({
        where: { id: sellerId },
        data: {
          status: dto.status,
          activatedAt: dto.status === SellerStatus.ACTIVE ? seller.activatedAt ?? new Date() : seller.activatedAt,
        },
      });
    });
  }

  // ============================= helpers =============================

  private assertOwnerEditable(status: SellerStatus) {
    if (!OWNER_EDITABLE.includes(status)) {
      throw new ConflictException(`Onboarding is not editable in status "${status}"`);
    }
  }

  private async logStatus(
    sellerId: string,
    fromStatus: SellerStatus | null,
    toStatus: SellerStatus,
    changedBy: string,
    reason?: string | null,
  ) {
    await this.logStatusTx(this.prisma, sellerId, fromStatus, toStatus, changedBy, reason);
  }

  private async logStatusTx(
    tx: Txn | PrismaService,
    sellerId: string,
    fromStatus: SellerStatus | null,
    toStatus: SellerStatus,
    changedBy: string,
    reason?: string | null,
  ) {
    await tx.sellerStatusHistory.create({
      data: { sellerId, fromStatus, toStatus, changedBy, reason: reason ?? null },
    });
  }

  // projections
  private sellerPublic(s: any) {
    return {
      id: s.id,
      sellerCode: s.sellerCode,
      legalName: s.legalName,
      displayName: s.displayName,
      status: s.status,
      commissionRateBps: s.commissionRateBps,
      activatedAt: s.activatedAt?.toISOString?.() ?? null,
      organization: s.organization
        ? { id: s.organization.id, name: s.organization.name, slug: s.organization.slug, type: s.organization.type }
        : null,
    };
  }

  private applicationPublic(a: any) {
    const seller = a.seller
      ? { id: a.seller.id, sellerCode: a.seller.sellerCode, legalName: a.seller.legalName, displayName: a.seller.displayName, status: a.seller.status }
      : null;
    return {
      id: a.id,
      sellerId: a.sellerId,
      applicationNumber: a.applicationNumber,
      status: a.status,
      seller,
      gstin: a.gstin,
      businessAddress: a.businessAddress,
      city: a.city,
      state: a.state,
      bankAccountLast4: a.bankAccountLast4,
      bankIfsc: a.bankIfsc,
      agreedToTerms: a.agreedToTerms,
      submittedAt: a.submittedAt?.toISOString?.() ?? null,
      reviewedAt: a.reviewedAt?.toISOString?.() ?? null,
      reviewedBy: a.reviewedBy,
      rejectionReason: a.rejectionReason,
      correctionReason: a.correctionReason,
      createdAt: a.createdAt?.toISOString?.() ?? null,
      documents: Array.isArray(a.documents) ? a.documents.map((d: any) => this.documentPublic(d)) : undefined,
    };
  }

  private documentPublic(d: any) {
    return {
      id: d.id,
      sellerId: d.sellerId,
      documentType: d.documentType,
      fileName: d.fileName,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      status: d.status,
      uploadedAt: d.uploadedAt.toISOString(),
      verifiedAt: d.verifiedAt?.toISOString?.() ?? null,
      rejectionReason: d.rejectionReason,
    };
  }
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}
