import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { ReturnsService } from './returns.service';
import { SandboxWebhookDto } from './dto/payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUserId } from '../auth/decorators/current-user.decorator';
import type { Request } from 'express';

@Controller()
export class PaymentController {
  constructor(
    private readonly payments: PaymentService,
    private readonly returns: ReturnsService,
  ) {}

  // Gateway callback: intentionally NOT JWT-protected — authenticity is the HMAC signature.
  @Post('payments/webhook/sandbox')
  sandboxWebhook(@Body() dto: SandboxWebhookDto) {
    return this.payments.confirmFromWebhook(dto);
  }

  // Real-gateway (Razorpay) callback. NOT JWT-protected: authenticity is the
  // x-razorpay-signature HMAC over the RAW request body. The raw bytes are
  // required (rawBody capture is enabled in bootstrap).
  @Post('payments/webhook/razorpay')
  async razorpayWebhook(@Req() req: Request, @Headers() headers: Record<string, string | undefined>) {
    const event = await this.payments.parseGatewayWebhook({
      rawBody: (req as any).rawBody as Buffer,
      signature: headers['x-razorpay-signature'] ?? null,
      headers,
    });
    // Payment events drive the payment confirm seam; refund.processed/.failed
    // events (Session 19) drive the async refund reconciliation in ReturnsService.
    if (this.payments.isPaymentEvent(event)) {
      return this.payments.confirmFromGatewayEvent(event);
    }
    return this.returns.reconcileRefundFromEvent(event);
  }

  @Get('orders/:orderId/payment')
  @UseGuards(JwtAuthGuard)
  orderPayment(@CurrentUserId() userId: string, @Param('orderId') orderId: string) {
    return this.payments.getOrderPayment(userId, orderId);
  }

  /**
   * DEV ONLY — simulate a successful sandbox-gateway capture for a PREPAID order.
   *
   * The sandbox provider confirms payments via a server-to-server HMAC-signed
   * webhook that a browser cannot invoke. This guarded helper lets the customer
   * commerce UI demo the full PREPAID lifecycle against the local sandbox
   * provider. The webhook secret never leaves the server: the signature is
   * produced server-side via PaymentService.signForTesting and then the normal
   * confirmFromWebhook (idempotency + amount checks) runs unchanged.
   *
   * Never available in production (NODE_ENV=production → 503). Only the owning
   * customer can capture their own order's payment (ownership via getOrderPayment).
   */
  @Post('dev/orders/:orderId/sandbox-capture')
  @UseGuards(JwtAuthGuard)
  async sandboxCaptureDev(@CurrentUserId() userId: string, @Param('orderId') orderId: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException('Sandbox capture is disabled in production');
    }
    const payment = await this.payments.getOrderPayment(userId, orderId);
    // Only PREPAID orders carry a Payment intent; COD orders have none, so if a
    // payment exists the order is necessarily PREPAID.
    if (!payment) throw new NotFoundException('No payment intent for this order');
    if (payment.state === 'CONFIRMED') throw new BadRequestException('Payment already captured');
    const dto: SandboxWebhookDto = {
      providerEventId: `devcap-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
      paymentReference: payment.paymentReference,
      eventType: 'payment.captured',
      amount: Math.round(payment.amount),
      timestamp: new Date().toISOString(),
      signature: '',
    };
    dto.signature = this.payments.signForTesting(dto);
    return this.payments.confirmFromWebhook(dto);
  }
}
