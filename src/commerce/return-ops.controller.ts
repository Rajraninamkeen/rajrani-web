import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ReturnsService } from './returns.service';
import { InitiateRefundDto, ReturnDecisionDto } from './dto/returns.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUserId } from '../auth/decorators/current-user.decorator';

// Internal operator decision + refund handling (Master-Spec §47/48).
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReturnOpsController {
  constructor(private readonly returns: ReturnsService) {}

  /** Approve (→RETURNED) or reject (→back to DELIVERED) a return request. */
  @Post('return-requests/:returnRequestId/decision')
  @Roles('OPERATOR', 'ADMIN')
  decide(
    @CurrentUserId() operatorId: string,
    @Param('returnRequestId') id: string,
    @Body() dto: ReturnDecisionDto,
  ) {
    return this.returns.decide(operatorId, id, dto);
  }

  /** Initiate a refund for an approved return (order → REFUND_PENDING). */
  @Post('return-requests/:returnRequestId/refund')
  @Roles('OPERATOR', 'ADMIN')
  initiate(
    @CurrentUserId() operatorId: string,
    @Param('returnRequestId') id: string,
    @Body() dto: InitiateRefundDto,
  ) {
    return this.returns.initiateRefund(operatorId, id, dto);
  }

  /** Complete the (sandbox) refund → order REFUNDED. Backend-authoritative. */
  @Post('return-requests/:returnRequestId/refund/complete')
  @Roles('OPERATOR', 'ADMIN')
  complete(@CurrentUserId() operatorId: string, @Param('returnRequestId') id: string) {
    return this.returns.completeRefund(operatorId, id);
  }
}
