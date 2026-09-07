import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { CodVerificationStatus, OrderActor, OrderStatus, PaymentMethod, PaymentStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CodVerificationPublic } from './commerce.types';
import { CodOtpDto, CodVerifyDto } from './dto/payment.dto';

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

@Injectable()
export class CodService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(userId: string, orderId: string): Promise<CodVerificationPublic> {
    await this.ownCodOrder(userId, orderId);
    const v = await this.prisma.codVerification.findUnique({ where: { orderId } });
    if (!v || v.userId !== userId) throw new NotFoundException('No COD verification found for this order');
    return this.toPublic(v);
  }

  /** (Re)send a COD OTP to the secondary mobile for a COD order. */
  async initiateOtp(userId: string, orderId: string, dto: CodOtpDto): Promise<CodVerificationPublic> {
    const order = await this.ownCodOrder(userId, orderId);
    const existing = await this.prisma.codVerification.findUnique({ where: { orderId } });
    if (existing?.status === CodVerificationStatus.CONFIRMED) {
      throw new ConflictException('This COD order is already verified');
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const phone = dto.secondaryContact ?? (order.addressSnapshot as { phone?: string } | null)?.phone;
    if (!phone) throw new BadRequestException('A secondary mobile number is required for COD verification');

    const primary =
      (order.addressSnapshot as { phone?: string } | null)?.phone ?? null;

    const data = {
      userId,
      primaryContact: primary,
      secondaryContact: phone,
      status: CodVerificationStatus.PENDING_CUSTOMER_OTP,
      otpHash: this.hashOtp(otp),
      otpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
      otpAttempts: 0,
      decision: null,
      decisionReason: null,
      completedAt: null,
    };

    const verification = existing
      ? await this.prisma.codVerification.update({ where: { orderId }, data })
      : await this.prisma.codVerification.create({ data: { orderId, ...data } });

    return this.toPublic(verification, otp); // dev/sandbox returns the simulated OTP
  }

  /** Verify the OTP; success confirms the COD order, repeated failure rejects it. */
  async verifyOtp(userId: string, orderId: string, dto: CodVerifyDto): Promise<CodVerificationPublic> {
    await this.ownCodOrder(userId, orderId);
    const verification = await this.prisma.codVerification.findUnique({ where: { orderId } });
    if (!verification || verification.userId !== userId) {
      throw new NotFoundException('COD verification not found for this order');
    }
    if (verification.status === CodVerificationStatus.CONFIRMED) {
      throw new ConflictException('This COD order is already verified');
    }
    if (verification.status === CodVerificationStatus.REJECTED || verification.status === CodVerificationStatus.EXPIRED) {
      throw new ConflictException(`COD verification already ${verification.status.toLowerCase()}`);
    }
    if (verification.otpAttempts >= MAX_ATTEMPTS) {
      await this.reject(orderId, 'too_many_attempts', userId);
      throw new BadRequestException('Too many incorrect attempts. COD verification rejected.');
    }
    if (!verification.otpHash || (verification.otpExpiresAt && verification.otpExpiresAt < new Date())) {
      await this.prisma.codVerification.update({
        where: { orderId },
        data: { status: CodVerificationStatus.EXPIRED, completedAt: new Date(), decisionReason: 'otp_expired' },
      });
      throw new BadRequestException('OTP has expired. Request a new one.');
    }

    if (this.hashOtp(dto.code) !== verification.otpHash) {
      const attempts = verification.otpAttempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await this.reject(orderId, 'too_many_attempts', userId);
        throw new BadRequestException('Too many incorrect attempts. COD verification rejected.');
      }
      const upd = await this.prisma.codVerification.update({
        where: { orderId },
        data: { otpAttempts: attempts },
      });
      return this.toPublic(upd);
    }

    return this.prisma.$transaction(async (tx) => {
      const v = await tx.codVerification.update({
        where: { orderId },
        data: {
          status: CodVerificationStatus.CONFIRMED,
          otpAttempts: { increment: 1 },
          decision: 'CONFIRMED',
          decisionReason: 'otp_verified',
          completedAt: new Date(),
        },
      });
      // Order becomes confirmed once COD OTP verification passes (still COD_PENDING until delivery).
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CONFIRMED, paymentStatus: PaymentStatus.COD_PENDING },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: OrderStatus.PLACED,
          toStatus: OrderStatus.CONFIRMED,
          actor: OrderActor.SYSTEM,
          actorId: userId,
          reason: 'COD secondary-mobile OTP verified',
          metadata: { verificationId: v.id },
        },
      });
      return this.toPublic(v);
    });
  }

  private async reject(orderId: string, reason: string, userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.codVerification.update({
        where: { orderId },
        data: { status: CodVerificationStatus.REJECTED, decision: 'REJECTED', decisionReason: reason, completedAt: new Date() },
      });
      await tx.order.update({
        where: { id: orderId },
        data: { paymentStatus: PaymentStatus.COD_FAILED },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: OrderStatus.PLACED,
          toStatus: OrderStatus.PLACED,
          actor: OrderActor.SYSTEM,
          actorId: userId,
          reason: `COD verification rejected: ${reason}`,
          metadata: { paymentStatus: PaymentStatus.COD_FAILED },
        },
      });
    });
  }

  private async ownCodOrder(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.paymentMethod !== PaymentMethod.COD) {
      throw new BadRequestException('This order is not a COD order');
    }
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('This order is cancelled');
    }
    return order;
  }

  private hashOtp(code: string): string {
    return createHmac('sha256', 'bilokat-cod-otp').update(code).digest('hex');
  }

  private toPublic(v: {
    id: string;
    orderId: string;
    status: string;
    secondaryContact?: string | null;
    otpAttempts: number;
    otpExpiresAt?: Date | null;
    completedAt?: Date | null;
  }, devOtp?: string): CodVerificationPublic {
    return {
      id: v.id,
      orderId: v.orderId,
      status: v.status,
      secondaryContact: v.secondaryContact,
      attemptsUsed: v.otpAttempts,
      attemptsAllowed: MAX_ATTEMPTS,
      otpExpiresAt: v.otpExpiresAt ? v.otpExpiresAt.toISOString() : null,
      devOtp: devOtp ?? null,
      completedAt: v.completedAt ? v.completedAt.toISOString() : null,
    };
  }
}
