import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CodService } from './cod.service';
import { CodOtpDto, CodVerifyDto } from './dto/payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUserId } from '../auth/decorators/current-user.decorator';

@Controller('orders/:orderId/cod')
@UseGuards(JwtAuthGuard)
export class CodController {
  constructor(private readonly cod: CodService) {}

  @Get()
  status(@CurrentUserId() _userId: string, @Param('orderId') orderId: string) {
    return this.cod.getStatus(_userId, orderId);
  }

  @Post('otp')
  sendOtp(@CurrentUserId() userId: string, @Param('orderId') orderId: string, @Body() dto: CodOtpDto) {
    return this.cod.initiateOtp(userId, orderId, dto);
  }

  @Post('verify')
  verify(@CurrentUserId() userId: string, @Param('orderId') orderId: string, @Body() dto: CodVerifyDto) {
    return this.cod.verifyOtp(userId, orderId, dto);
  }
}
