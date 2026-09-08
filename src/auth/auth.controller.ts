import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto, RegisterDto, SellerRegisterDto } from './dto/auth.dto';
import { LogoutDto } from './dto/logout.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUserId } from './decorators/current-user.decorator';
import { Throttle } from '../common/throttle/throttle.decorator';
import { ThrottleGuard } from '../common/throttle/throttle.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @UseGuards(ThrottleGuard)
  @Throttle(10, 3600) // account creation: 10/hour per IP
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @UseGuards(ThrottleGuard)
  @Throttle(10, 3600) // account creation: 10/hour per IP
  @Post('seller-register')
  sellerRegister(@Body() dto: SellerRegisterDto) {
    return this.auth.sellerRegister(dto);
  }

  @UseGuards(ThrottleGuard)
  @Throttle(8, 60) // brute-force protection on login
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @UseGuards(ThrottleGuard)
  @Throttle(60, 60) // token refresh is legitimate but still bounded
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@Body() dto: LogoutDto, @CurrentUserId() userId: string) {
    if (dto.refreshToken) {
      return this.auth.logout(dto.refreshToken, userId);
    }
    return this.auth.revokeAllSessions(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUserId() userId: string) {
    return this.auth.me(userId);
  }
}
