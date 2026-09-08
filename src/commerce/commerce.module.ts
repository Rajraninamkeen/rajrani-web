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
import { OpsController } from './ops.controller';
import { ReturnOpsController } from './return-ops.controller';
import { SellerOpsController } from './seller-ops.controller';
import { SellerOpsService } from './seller-ops.service';
import { SettlementService } from './settlement.service';
import { DeliveryService } from './delivery.service';
import { DeliveryAdminController, DeliveryPartnerController } from './delivery.controller';
import { FinanceOpsController, SellerSettlementController } from './settlement-ops.controller';
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PAYMENT_GATEWAY_PROVIDER } from './gateway/gateway.provider';
import { COURIER_PROVIDER_TOKEN } from './courier/courier.provider';
import { ReplacementCourierAdminController, ReplacementCourierPartnerController } from './replacement-courier.controller';
import { ReplacementCourierService } from './replacement-courier.service';
import { CourierTrackingService } from './courier-tracking.service';
import { OrderCourierTrackingController } from './courier-tracking.controller';
import { CourierPayoutService } from './courier-payout.service';
import { CourierPartnerPayoutController, CourierPayoutAdminController } from './courier-payout.controller';
import { NotificationService } from './notification.service';
import { NotificationGateway, NOTIFICATION_GATEWAY_TOKEN } from './notification.gateway';
import {
  DeliveryNotificationsController,
  SellerNotificationsController,
  NotificationsAdminController,
} from './notification.controller';

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
    OpsController,
    FinanceOpsController,
    SellerSettlementController,
    DeliveryAdminController,
    DeliveryPartnerController,
    ReplacementCourierAdminController,
    ReplacementCourierPartnerController,
    OrderCourierTrackingController,
    CourierPartnerPayoutController,
    CourierPayoutAdminController,
    DeliveryNotificationsController,
    SellerNotificationsController,
    NotificationsAdminController,
  ],
  providers: [
    CartService,
    OrderService,
    PaymentService,
    CodService,
    FulfilmentService,
    ReturnsService,
    SellerOpsService,
    SettlementService,
    DeliveryService,
    ReplacementCourierService,
    CourierTrackingService,
    CourierPayoutService,
    NotificationService,
    { provide: NOTIFICATION_GATEWAY_TOKEN, useClass: NotificationGateway },
    PAYMENT_GATEWAY_PROVIDER,
    COURIER_PROVIDER_TOKEN,
  ],
  exports: [PaymentService, CodService, OrderService, DeliveryService, ReplacementCourierService, CourierTrackingService, CourierPayoutService, NotificationService, PAYMENT_GATEWAY_PROVIDER, COURIER_PROVIDER_TOKEN],
})
export class CommerceModule {}
