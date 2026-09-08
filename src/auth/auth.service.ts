import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User, UserStatus } from '../generated/prisma/client';
import { compare, hash } from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RefreshDto, RegisterDto, SellerRegisterDto } from './dto/auth.dto';
import {
  AccessTokenPayload,
  PublicUser,
  TokenPair,
} from './auth.types';

const ACCESS_BCRYPT_ROUNDS = 12;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ---------- registration ----------
  async register(dto: RegisterDto): Promise<{ user: PublicUser; tokens: TokenPair }> {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email.toLowerCase() }, ...(dto.phone ? [{ phone: dto.phone }] : [])] },
      select: { email: true, phone: true },
    });
    if (existing) {
      if (existing.email === dto.email.toLowerCase()) {
        throw new ConflictException('An account with this email already exists');
      }
      throw new ConflictException('An account with this mobile number already exists');
    }

    const passwordHash = await hash(dto.password, ACCESS_BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        phone: dto.phone ?? null,
        fullName: dto.fullName ?? null,
        passwordHash,
        status: 'ACTIVE',
        role: 'CUSTOMER',
      },
    });

    const tokens = await this.issueTokens(user, 'register');
    return { user: this.toPublic(user), tokens };
  }

  /**
   * Public seller self-registration (Session 14). Registration ≠ approval: creates a
   * PENDING seller under a SELLER-type Organization, a draft SellerApplication, the
   * applicant as a SELLER-role user + an OWNER OrganizationMember, and returns tokens.
   * The seller cannot operate until a REVIEWER approves and an operator ACTIVATES it.
   */
  async sellerRegister(dto: SellerRegisterDto): Promise<{ user: PublicUser; tokens: TokenPair; seller: any }> {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email.toLowerCase() }, ...(dto.phone ? [{ phone: dto.phone }] : [])] },
      select: { email: true, phone: true },
    });
    if (existing) {
      if (existing.email === dto.email.toLowerCase()) {
        throw new ConflictException('An account with this email already exists');
      }
      throw new ConflictException('An account with this mobile number already exists');
    }
    const passwordHash = await hash(dto.password, ACCESS_BCRYPT_ROUNDS);
    const sellerCode = `SELL-${randomBytes(4).toString('hex').toUpperCase()}`;
    const orgSlug = `org-${slugify(dto.businessName)}-${randomBytes(2).toString('hex')}`;

    const out = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: dto.businessName, slug: orgSlug, type: 'SELLER', status: 'ACTIVE' },
      });
      const seller = await tx.seller.create({
        data: {
          sellerCode,
          legalName: dto.legalName,
          displayName: dto.businessName,
          status: 'PENDING',
          commissionRateBps: dto.commissionRateBps ?? 0,
          organizationId: org.id,
        },
      });
      await tx.sellerApplication.create({
        data: {
          sellerId: seller.id,
          applicationNumber: `SAPP-${randomBytes(4).toString('hex').toUpperCase()}`,
          status: 'DRAFT',
          gstin: dto.gstin ?? null,
          pan: dto.pan ?? null,
          agreedToTerms: false,
        },
      });
      const user = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          phone: dto.phone ?? null,
          fullName: dto.fullName ?? dto.legalName,
          passwordHash,
          status: 'ACTIVE',
          role: 'SELLER',
          sellerId: seller.id,
        },
      });
      await tx.organizationMember.create({
        data: { organizationId: org.id, userId: user.id, role: 'OWNER', status: 'ACTIVE' },
      });
      return { org, seller, user };
    });

    const tokens = await this.issueTokens(out.user, 'seller-register');
    return {
      user: this.toPublic(out.user),
      tokens,
      seller: {
        id: out.seller.id,
        sellerCode: out.seller.sellerCode,
        legalName: out.seller.legalName,
        displayName: out.seller.displayName,
        status: out.seller.status,
        organizationId: out.org.id,
      },
    };
  }

  // ---------- login ----------
  async login(dto: LoginDto): Promise<{ user: PublicUser; tokens: TokenPair }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const ok = await compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid email or password');
    }
    this.assertActive(user);
    const tokens = await this.issueTokens(user, 'login');
    return { user: this.toPublic(user), tokens };
  }

  // ---------- refresh (rotation + reuse detection) ----------
  async refresh(dto: RefreshDto): Promise<{ user: PublicUser; tokens: TokenPair }> {
    const presentedHash = this.hashRefresh(dto.refreshToken);
    const session = await this.prisma.userSession.findUnique({
      where: { refreshTokenHash: presentedHash },
      include: { user: true },
    });

    // Unknown token: nothing to detect.
    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Token reuse: an already-revoked session received a valid token again =>
    // assume compromise and revoke all of the user's sessions.
    if (session.revokedAt) {
      await this.prisma.userSession.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Session revoked; please sign in again');
    }

    if (session.expiresAt < new Date()) {
      await this.prisma.userSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token expired; please sign in again');
    }

    this.assertActive(session.user);

    // Rotate: revoke this session, open a new one with a fresh opaque token.
    const newTokens = await this.issueTokens(session.user, 'refresh', session.id);
    return { user: this.toPublic(session.user), tokens: newTokens };
  }

  // ---------- logout / revoke ----------
  async logout(refreshToken: string, userId?: string): Promise<{ ok: boolean }> {
    const presentedHash = this.hashRefresh(refreshToken);
    if (userId) {
      await this.prisma.userSession.updateMany({
        where: { userId, refreshTokenHash: presentedHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else {
      await this.prisma.userSession.updateMany({
        where: { refreshTokenHash: presentedHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return { ok: true };
  }

  async revokeAllSessions(userId: string): Promise<{ ok: boolean }> {
    await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  // ---------- current user ----------
  async me(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');
    this.assertActive(user);
    return this.toPublic(user);
  }

  // ---------- token issuance ----------
  private async issueTokens(
    user: User,
    kind: string,
    replacedTokenId?: string,
  ): Promise<TokenPair> {
    const accessTtl = this.config.get<number>('jwt.accessTtl') ?? 900;
    const accessSecret = this.config.get<string>('jwt.accessSecret') ?? '';
    const jti = randomBytes(12).toString('hex');

    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: 'access',
      jti,
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: accessSecret,
      expiresIn: accessTtl,
    });

    // Opaque refresh token (never a JWT, never stored raw).
    const refreshToken = randomBytes(48).toString('hex');
    const refreshHash = this.hashRefresh(refreshToken);
    const refreshTtl = this.config.get<number>('jwt.refreshTtl') ?? 1209600;

    // If rotating, mark the previous session as superseded.
    if (replacedTokenId) {
      await this.prisma.userSession.update({
        where: { id: replacedTokenId },
        data: { revokedAt: new Date(), replacedByTokenId: refreshHash },
      });
    }

    await this.prisma.userSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: refreshHash,
        expiresAt: new Date(Date.now() + refreshTtl * 1000),
      },
    });

    // Keep housekeeping note in logs only (no secrets).
    void kind;
    return { accessToken, refreshToken, expiresIn: accessTtl };
  }

  // ---------- helpers ----------
  private hashRefresh(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private assertActive(user: User): void {
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }
  }

  private toPublic(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
    };
  }
}
