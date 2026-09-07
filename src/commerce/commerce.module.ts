import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BuyNowController } from './buynow.controller';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { CheckoutController } from './checkout.controller';
import { CodController } from './cod.controller';
import { CodService } from './cod.service';
import { OrderService } from './order.service';
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
  ],
  providers: [CartService, OrderService, PaymentService, CodService],
  exports: [PaymentService, CodService],
})
export class CommerceModule {}
