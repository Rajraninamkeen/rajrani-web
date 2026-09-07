import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ReturnsService } from './returns.service';
import { CreateReturnDto } from './dto/returns.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUserId } from '../auth/decorators/current-user.decorator';

// Customer-facing returns. Order ownership is enforced in the service.
@Controller('orders/:orderId/returns')
@UseGuards(JwtAuthGuard)
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  /** Request a return on a delivered order. */
  @Post()
  request(
    @CurrentUserId() userId: string,
    @Param('orderId') orderId: string,
    @Body() dto: CreateReturnDto,
  ) {
    return this.returns.request(userId, orderId, dto);
  }

  /** Active/current return for this customer's order. */
  @Get()
  status(@CurrentUserId() userId: string, @Param('orderId') orderId: string) {
    return this.returns.getForOrder(userId, orderId);
  }
}
