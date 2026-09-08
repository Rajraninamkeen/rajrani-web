import { Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { SandboxWebhookDto } from './dto/payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUserId } from '../auth/decorators/current-user.decorator';
import type { Request } from 'express';

@Controller()
export class PaymentController {
  constructor(private readonly payments: PaymentService) {}

  // Gateway callback: intentionally NOT JWT-protected — authenticity is the HMAC signature.
  @Post('payments/webhook/sandbox')
  sandboxWebhook(@Body() dto: SandboxWebhookDto) {
    return this.payments.confirmFromWebhook(dto);
  }

  // Real-gateway (Razorpay) callback. NOT JWT-protected: authenticity is the
  // x-razorpay-signature HMAC over the RAW request body. The raw bytes are
  // required (rawBody capture is enabled in bootstrap).
  @Post('payments/webhook/razorpay')
  razorpayWebhook(@Req() req: Request, @Headers() headers: Record<string, string | undefined>) {
    return this.payments.parseGatewayWebhook({
      rawBody: (req as any).rawBody as Buffer,
      signature: headers['x-razorpay-signature'] ?? null,
      headers,
    }).then((event) => this.payments.confirmFromGatewayEvent(event));
  }

  @Get('orders/:orderId/payment')
  @UseGuards(JwtAuthGuard)
  orderPayment(@CurrentUserId() userId: string, @Param('orderId') orderId: string) {
    return this.payments.getOrderPayment(userId, orderId);
  }
}
