import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SellerOnboardingService } from './seller-onboarding.service';
import {
  SellerOnboardingOwnerController,
  SellerOnboardingStaffController,
} from './seller-onboarding.controller';

@Module({
  imports: [AuthModule],
  controllers: [SellerOnboardingOwnerController, SellerOnboardingStaffController],
  providers: [SellerOnboardingService],
  exports: [SellerOnboardingService],
})
export class SellerModule {}
