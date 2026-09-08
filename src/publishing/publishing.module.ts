import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProductPublishingService } from './product-publishing.service';
import {
  CatalogPublishingController,
  SellerProductController,
} from './product-publishing.controller';

@Module({
  imports: [AuthModule],
  controllers: [SellerProductController, CatalogPublishingController],
  providers: [ProductPublishingService],
  exports: [ProductPublishingService],
})
export class PublishingModule {}
