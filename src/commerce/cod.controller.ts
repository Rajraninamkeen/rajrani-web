import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CodService } from './cod.service';
import { CodOtpDto, CodVerifyDto } from './dto/payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUserId } from '../auth/decorators/current-user.decorator';
import { Throttle } from '../common/throttle/throttle.decorator';
import { ThrottleGuard } from '../common/throttle/throttle.guard';

@Controller('orders/:orderId/cod')
@UseGuards(JwtAuthGuard)
export class CodController {
  constructor(private readonly cod: CodService) {}

  @Get()
  status(@CurrentUserId() _userId: string, @Param('orderId') orderId: string) {
    return this.cod.getStatus(_userId, orderId);
  }

  @UseGuards(ThrottleGuard)
  @Throttle(5, 60) // avoid OTP SMS/email abuse
  @Post('otp')
  sendOtp(@CurrentUserId() userId: string, @Param('orderId') orderId: string, @Body() dto: CodOtpDto) {
    return this.cod.initiateOtp(userId, orderId, dto);
  }

  @UseGuards(ThrottleGuard)
  @Throttle(5, 60) // brute-force protection on OTP verification
  @Post('verify')
  verify(@CurrentUserId() userId: string, @Param('orderId') orderId: string, @Body() dto: CodVerifyDto) {
    return this.cod.verifyOtp(userId, orderId, dto);
  }
}
