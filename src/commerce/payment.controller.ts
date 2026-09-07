import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { SandboxWebhookDto } from './dto/payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUserId } from '../auth/decorators/current-user.decorator';

@Controller()
export class PaymentController {
  constructor(private readonly payments: PaymentService) {}

  // Gateway callback: intentionally NOT JWT-protected — authenticity is the HMAC signature.
  @Post('payments/webhook/sandbox')
  sandboxWebhook(@Body() dto: SandboxWebhookDto) {
    return this.payments.confirmFromWebhook(dto);
  }

  @Get('orders/:orderId/payment')
  @UseGuards(JwtAuthGuard)
  orderPayment(@CurrentUserId() userId: string, @Param('orderId') orderId: string) {
    return this.payments.getOrderPayment(userId, orderId);
  }
}
