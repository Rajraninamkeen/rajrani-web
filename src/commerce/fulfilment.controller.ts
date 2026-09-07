import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { FulfilmentService } from './fulfilment.service';
import { AdvanceOrderDto } from './dto/fulfilment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUserId } from '../auth/decorators/current-user.decorator';

// Internal order fulfilment/delivery transitions (Master-Spec §39).
// Restricted to internal operator roles so customers cannot self-set delivery.
@Controller('orders/:orderId/fulfilment')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FulfilmentController {
  constructor(private readonly fulfilment: FulfilmentService) {}

  @Post('advance')
  @Roles('OPERATOR', 'ADMIN')
  advance(
    @CurrentUserId() operatorId: string,
    @Param('orderId') orderId: string,
    @Body() dto: AdvanceOrderDto,
  ) {
    return this.fulfilment.advance(operatorId, orderId, dto.toStatus, dto.reason);
  }
}
