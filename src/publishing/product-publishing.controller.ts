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
import { ProductPublishingService } from './product-publishing.service';
import {
  ApproveProductDto,
  CreateProductDto,
  ProductListQuery,
  RejectProductDto,
  UpdateProductDto,
} from './dto/product-publishing.dto';

// SELLER product authoring + listing surface. Scoped to the caller's own seller
// organisation. Distinct from the read-only `/seller/products` list.
@Controller('seller/catalog')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SellerProductController {
  constructor(private readonly publishing: ProductPublishingService) {}

  @Get()
  @Roles('SELLER')
  list(@CurrentUserId() userId: string, @Query() query: ProductListQuery) {
    return this.publishing.listMyProducts(userId, query.status);
  }

  @Get(':productId')
  @Roles('SELLER')
  detail(@CurrentUserId() userId: string, @Param('productId') productId: string) {
    return this.publishing.getMyProduct(userId, productId);
  }

  @Post()
  @Roles('SELLER')
  create(@CurrentUserId() userId: string, @Body() dto: CreateProductDto) {
    return this.publishing.createDraft(userId, dto);
  }

  @Patch(':productId')
  @Roles('SELLER')
  update(@CurrentUserId() userId: string, @Param('productId') productId: string, @Body() dto: UpdateProductDto) {
    return this.publishing.updateDraft(userId, productId, dto);
  }

  @Post(':productId/submit')
  @Roles('SELLER')
  submit(@CurrentUserId() userId: string, @Param('productId') productId: string) {
    return this.publishing.submitForReview(userId, productId);
  }

  @Post(':productId/archive')
  @Roles('SELLER')
  archive(@CurrentUserId() userId: string, @Param('productId') productId: string) {
    return this.publishing.archiveMine(userId, productId);
  }
}

// Marketplace staff catalog-publishing review surface (OPERATOR/ADMIN only).
@Controller('catalog-publishing/products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CatalogPublishingController {
  constructor(private readonly publishing: ProductPublishingService) {}

  @Get()
  @Roles('OPERATOR', 'ADMIN')
  list(@Query() query: ProductListQuery) {
    return this.publishing.listForReview(query.status);
  }

  @Get(':productId')
  @Roles('OPERATOR', 'ADMIN')
  detail(@Param('productId') productId: string) {
    return this.publishing.reviewDetail(productId);
  }

  @Post(':productId/approve')
  @Roles('OPERATOR', 'ADMIN')
  approve(@CurrentUserId() userId: string, @Param('productId') productId: string, @Body() dto: ApproveProductDto) {
    return this.publishing.approve(userId, productId, dto.note);
  }

  @Post(':productId/reject')
  @Roles('OPERATOR', 'ADMIN')
  reject(@CurrentUserId() userId: string, @Param('productId') productId: string, @Body() dto: RejectProductDto) {
    return this.publishing.reject(userId, productId, dto.reason);
  }
}
