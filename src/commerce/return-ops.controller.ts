import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ReturnsService } from './returns.service';
import { InspectionDto, ReturnDecisionDto } from './dto/returns.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUserId } from '../auth/decorators/current-user.decorator';

// Internal operator return + refund handling (DB-Design §§85-92).
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReturnOpsController {
  constructor(private readonly returns: ReturnsService) {}

  /** Eligibility decision on a REQUESTED return (approve / reject). */
  @Post('return-requests/:returnRequestId/decision')
  @Roles('OPERATOR', 'ADMIN')
  decide(
    @CurrentUserId() operatorId: string,
    @Param('returnRequestId') id: string,
    @Body() dto: ReturnDecisionDto,
  ) {
    return this.returns.decide(operatorId, id, dto);
  }

  /** APPROVED -> PICKUP_SCHEDULED. */
  @Post('return-requests/:returnRequestId/pickup')
  @Roles('OPERATOR', 'ADMIN')
  schedulePickup(@CurrentUserId() operatorId: string, @Param('returnRequestId') id: string) {
    return this.returns.schedulePickup(operatorId, id);
  }

  /** PICKUP_SCHEDULED -> PICKED_UP. */
  @Post('return-requests/:returnRequestId/picked-up')
  @Roles('OPERATOR', 'ADMIN')
  pickedUp(@CurrentUserId() operatorId: string, @Param('returnRequestId') id: string) {
    return this.returns.pickedUp(operatorId, id);
  }

  /** Record inspection results per return item; auto-finalises to
   *  APPROVED_FOR_REFUND when every item has a result. */
  @Post('return-requests/:returnRequestId/inspection')
  @Roles('OPERATOR', 'ADMIN')
  inspect(
    @CurrentUserId() operatorId: string,
    @Param('returnRequestId') id: string,
    @Body() dto: InspectionDto,
  ) {
    return this.returns.inspect(operatorId, id, dto);
  }

  /** Create the (server-amounted) refund for an APPROVED_FOR_REFUND return. */
  @Post('return-requests/:returnRequestId/refund')
  @Roles('OPERATOR', 'ADMIN')
  initiate(@CurrentUserId() operatorId: string, @Param('returnRequestId') id: string) {
    return this.returns.initiateRefund(operatorId, id);
  }

  /** Complete the (sandbox) refund -> return COMPLETED; ledger + terminal update. */
  @Post('return-requests/:returnRequestId/refund/complete')
  @Roles('OPERATOR', 'ADMIN')
  complete(@CurrentUserId() operatorId: string, @Param('returnRequestId') id: string) {
    return this.returns.completeRefund(operatorId, id);
  }
}
