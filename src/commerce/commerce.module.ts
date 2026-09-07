import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { CheckoutController } from './checkout.controller';
import { OrderService } from './order.service';

@Module({
  imports: [AuthModule], // for JwtModule (guards sign/verify) + exported guards
  controllers: [CartController, CheckoutController],
  providers: [CartService, OrderService],
})
export class CommerceModule {}
