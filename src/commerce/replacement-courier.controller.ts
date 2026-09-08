import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUserId } from '../auth/decorators/current-user.decorator';
import { ReplacementCourierService } from './replacement-courier.service';
import { CourierTrackingService } from './courier-tracking.service';
import {
  AssignReplacementCourierDto,
  FailReplacementDto,
  RejectReplacementDto,
} from './dto/replacement-courier.dto';

// Session 22 — OPERATOR/ADMIN assignment of a DELIVERY partner to a dispatched
// replacement (outbound exchange last-mile). Non-money.
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReplacementCourierAdminController {
  constructor(private readonly courier: ReplacementCourierService) {}

  /** DISPATCHED replacement -> ASSIGNED courier (returns the new assignment). */
  @Post('return-requests/:returnRequestId/replacement/assign-courier')
  @Roles('OPERATOR', 'ADMIN')
  assign(
    @CurrentUserId() operatorId: string,
    @Param('returnRequestId') returnRequestId: string,
    @Body() dto: AssignReplacementCourierDto,
  ) {
    return this.courier.assignCourier(operatorId, returnRequestId, dto.deliveryPartnerId);
  }

  /** List this return's replacement courier assignments (operator view). */
  @Get('return-requests/:returnRequestId/replacement/assignments')
  @Roles('OPERATOR', 'ADMIN')
  assignments(@Param('returnRequestId') returnRequestId: string) {
    return this.courier.listForReturn(returnRequestId);
  }

  /** Cancel an active replacement courier assignment (back to DISPATCHED pool). */
  @Post('return-requests/:returnRequestId/replacement/assignments/:assignmentId/cancel')
  @Roles('OPERATOR', 'ADMIN')
  cancel(
    @CurrentUserId() operatorId: string,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.courier.cancelAssignment(operatorId, assignmentId);
  }
}

// Session 22 — DELIVERY partner replacement task surface (bound to own profile).
@Controller('delivery/replacement-tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReplacementCourierPartnerController {
  constructor(
    private readonly courier: ReplacementCourierService,
    private readonly tracking: CourierTrackingService,
  ) {}

  @Get()
  @Roles('DELIVERY')
  tasks(@CurrentUserId() userId: string) {
    return this.courier.partnerTasks(userId);
  }

  @Get(':assignmentId')
  @Roles('DELIVERY')
  task(@CurrentUserId() userId: string, @Param('assignmentId') id: string) {
    return this.courier.partnerTask(userId, id);
  }

  // Session 36 — live courier tracking for a replacement task assigned to this DELIVERY partner.
  @Get(':assignmentId/tracking')
  @Roles('DELIVERY')
  taskTracking(@CurrentUserId() userId: string, @Param('assignmentId') id: string) {
    return this.tracking.trackTaskForDelivery(userId, id, 'replacement');
  }

  @Post(':assignmentId/accept')
  @Roles('DELIVERY')
  accept(@CurrentUserId() userId: string, @Param('assignmentId') id: string) {
    return this.courier.accept(userId, id);
  }

  @Post(':assignmentId/reject')
  @Roles('DELIVERY')
  reject(@CurrentUserId() userId: string, @Param('assignmentId') id: string, @Body() dto: RejectReplacementDto) {
    return this.courier.reject(userId, id, dto.reason);
  }

  @Post(':assignmentId/pickup')
  @Roles('DELIVERY')
  pickup(@CurrentUserId() userId: string, @Param('assignmentId') id: string) {
    return this.courier.pickup(userId, id);
  }

  @Post(':assignmentId/out-for-delivery')
  @Roles('DELIVERY')
  outForDelivery(@CurrentUserId() userId: string, @Param('assignmentId') id: string) {
    return this.courier.outForDelivery(userId, id);
  }

  @Post(':assignmentId/deliver')
  @Roles('DELIVERY')
  deliver(@CurrentUserId() userId: string, @Param('assignmentId') id: string) {
    return this.courier.deliver(userId, id);
  }

  @Post(':assignmentId/fail')
  @Roles('DELIVERY')
  fail(@CurrentUserId() userId: string, @Param('assignmentId') id: string, @Body() dto: FailReplacementDto) {
    return this.courier.fail(userId, id, dto.reason);
  }
}
