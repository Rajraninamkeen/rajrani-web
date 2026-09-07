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
import { ReturnOpsController } from './return-ops.controller';
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
  ],
  providers: [CartService, OrderService, PaymentService, CodService, FulfilmentService, ReturnsService],
  exports: [PaymentService, CodService],
})
export class CommerceModule {}
