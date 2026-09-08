import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUserId } from '../auth/decorators/current-user.decorator';
import { SellerOnboardingService } from './seller-onboarding.service';
import {
  AddSellerDocumentDto,
  AdminCreateSellerDto,
  AdminSellerStatusDto,
  ApplicationListQuery,
  ReviewSellerApplicationDto,
  UpdateSellerProfileDto,
  VerifyDocumentDto,
} from './dto/seller-onboarding.dto';

// Seller-owner (self-service) onboarding surface. Any SELLER-role user bound to a
// seller org can view/edit/submit their own onboarding.
@Controller('seller/onboarding')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SellerOnboardingOwnerController {
  constructor(private readonly onboarding: SellerOnboardingService) {}

  @Get('me')
  @Roles('SELLER')
  me(@CurrentUserId() userId: string) {
    return this.onboarding.me(userId);
  }

  @Patch('profile')
  @Roles('SELLER')
  profile(@CurrentUserId() userId: string, @Body() dto: UpdateSellerProfileDto) {
    return this.onboarding.updateProfile(userId, dto);
  }

  @Post('documents')
  @Roles('SELLER')
  documents(@CurrentUserId() userId: string, @Body() dto: AddSellerDocumentDto) {
    return this.onboarding.addDocument(userId, dto);
  }

  @Post('submit')
  @Roles('SELLER')
  submit(@CurrentUserId() userId: string) {
    return this.onboarding.submitApplication(userId);
  }
}

// Marketplace staff surface: reviewer (KYC) + operator/admin (create/control).
@Controller('seller-onboarding')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SellerOnboardingStaffController {
  constructor(private readonly onboarding: SellerOnboardingService) {}

  @Post('sellers')
  @Roles('OPERATOR', 'ADMIN')
  createSeller(@CurrentUserId() userId: string, @Body() dto: AdminCreateSellerDto) {
    return this.onboarding.adminCreateSeller(userId, dto);
  }

  @Get('applications')
  @Roles('REVIEWER', 'ADMIN')
  list(@Query() query: ApplicationListQuery) {
    return this.onboarding.listApplications(query);
  }

  @Get('applications/:applicationId')
  @Roles('REVIEWER', 'ADMIN')
  detail(@Param('applicationId') id: string) {
    return this.onboarding.getApplication(id);
  }

  @Post('applications/:applicationId/review')
  @Roles('REVIEWER', 'ADMIN')
  review(
    @CurrentUserId() userId: string,
    @Param('applicationId') id: string,
    @Body() dto: ReviewSellerApplicationDto,
  ) {
    return this.onboarding.reviewApplication(userId, id, dto);
  }

  @Post('documents/:documentId/verify')
  @Roles('REVIEWER', 'ADMIN')
  verify(
    @CurrentUserId() userId: string,
    @Param('documentId') id: string,
    @Body() dto: VerifyDocumentDto,
  ) {
    return this.onboarding.verifyDocument(userId, id, dto);
  }

  @Post('sellers/:sellerId/activate')
  @Roles('REVIEWER', 'ADMIN', 'OPERATOR')
  activate(@CurrentUserId() userId: string, @Param('sellerId') id: string) {
    return this.onboarding.activateSeller(userId, id);
  }

  @Post('sellers/:sellerId/status')
  @Roles('OPERATOR', 'ADMIN')
  setStatus(
    @CurrentUserId() userId: string,
    @Param('sellerId') id: string,
    @Body() dto: AdminSellerStatusDto,
  ) {
    return this.onboarding.adminSetSellerStatus(userId, id, dto);
  }
}
