import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BuyNowController } from './buynow.controller';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { CheckoutController } from './checkout.controller';
import { CodController } from './cod.controller';
import { CodService } from './cod.service';
import { FulfilmentController } from './fulfilment.controller';
import { FulfilmentService } from './fulfilment.service';
import { OrderService } from './order.service';
import { OrderResolutionController } from './order-resolution.controller';
import { ReturnOpsController } from './return-ops.controller';
import { SellerOpsController } from './seller-ops.controller';
import { SellerOpsService } from './seller-ops.service';
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

@Module({
  imports: [AuthModule], // for JwtModule (guards sign/verify) + exported guards
  controllers: [
    CartController,
    CheckoutController,
    BuyNowController,
    PaymentController,
    CodController,
    FulfilmentController,
    ReturnsController,
    ReturnOpsController,
    SellerOpsController,
    OrderResolutionController,
  ],
  providers: [
    CartService,
    OrderService,
    PaymentService,
    CodService,
    FulfilmentService,
    ReturnsService,
    SellerOpsService,
  ],
  exports: [PaymentService, CodService, OrderService],
})
export class CommerceModule {}
