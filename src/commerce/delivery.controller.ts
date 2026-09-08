import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUserId } from '../auth/decorators/current-user.decorator';
import { DeliveryService } from './delivery.service';
import { CourierTrackingService } from './courier-tracking.service';
import {
  AssignSliceDto,
  DeliveryListQuery,
  FailAssignmentDto,
  RegisterDeliveryPartnerDto,
  RejectAssignmentDto,
  SetPartnerStatusDto,
} from './delivery.dto';

// Back-office delivery management (OPERATOR/ADMIN).
@Controller('delivery')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DeliveryAdminController {
  constructor(private readonly delivery: DeliveryService) {}

  @Post('partners')
  @Roles('OPERATOR', 'ADMIN')
  registerPartner(@Body() dto: RegisterDeliveryPartnerDto) {
    return this.delivery.registerPartner('', dto);
  }

  @Get('partners')
  @Roles('OPERATOR', 'ADMIN')
  partners() {
    return this.delivery.listPartners();
  }

  @Get('partner-candidates')
  @Roles('OPERATOR', 'ADMIN')
  partnerCandidates() {
    return this.delivery.listPartnerCandidates();
  }

  @Patch('partners/:partnerId/status')
  @Roles('OPERATOR', 'ADMIN')
  partnerStatus(
    @CurrentUserId() actorId: string,
    @Param('partnerId') id: string,
    @Body() dto: SetPartnerStatusDto,
  ) {
    return this.delivery.setPartnerStatus(actorId, id, dto.status);
  }

  @Post('slices/:sellerOrderId/assign')
  @Roles('OPERATOR', 'ADMIN')
  assign(@CurrentUserId() actorId: string, @Param('sellerOrderId') id: string, @Body() dto: AssignSliceDto) {
    return this.delivery.assignSlice(actorId, id, dto);
  }

  @Post('slices/:sellerOrderId/reassign')
  @Roles('OPERATOR', 'ADMIN')
  reassign(@CurrentUserId() actorId: string, @Param('sellerOrderId') id: string, @Body() dto: AssignSliceDto) {
    return this.delivery.reassignSlice(actorId, id, dto);
  }

  @Get('assignments')
  @Roles('OPERATOR', 'ADMIN')
  assignments(@Query() query: DeliveryListQuery) {
    return this.delivery.listAssignments(query);
  }

  @Get('assignments/:assignmentId')
  @Roles('OPERATOR', 'ADMIN')
  assignment(@Param('assignmentId') id: string) {
    return this.delivery.getAssignment(id);
  }

  @Post('assignments/:assignmentId/cancel')
  @Roles('OPERATOR', 'ADMIN')
  cancel(@CurrentUserId() actorId: string, @Param('assignmentId') id: string) {
    return this.delivery.cancelAssignment(actorId, id);
  }
}

// Delivery-partner (courier) task surface (DELIVERY role; bound to own partner profile).
@Controller('delivery/tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DeliveryPartnerController {
  constructor(
    private readonly delivery: DeliveryService,
    private readonly tracking: CourierTrackingService,
  ) {}

  @Get()
  @Roles('DELIVERY')
  tasks(@CurrentUserId() userId: string) {
    return this.delivery.partnerTasks(userId);
  }

  @Get(':assignmentId')
  @Roles('DELIVERY')
  task(@CurrentUserId() userId: string, @Param('assignmentId') id: string) {
    return this.delivery.partnerTask(userId, id);
  }

  // Session 36 — live courier tracking for a parcel task assigned to this DELIVERY partner.
  @Get(':assignmentId/tracking')
  @Roles('DELIVERY')
  taskTracking(@CurrentUserId() userId: string, @Param('assignmentId') id: string) {
    return this.tracking.trackTaskForDelivery(userId, id, 'parcel');
  }

  @Post(':assignmentId/accept')
  @Roles('DELIVERY')
  accept(@CurrentUserId() userId: string, @Param('assignmentId') id: string) {
    return this.delivery.acceptTask(userId, id);
  }

  @Post(':assignmentId/reject')
  @Roles('DELIVERY')
  reject(@CurrentUserId() userId: string, @Param('assignmentId') id: string, @Body() dto: RejectAssignmentDto) {
    return this.delivery.rejectTask(userId, id, dto);
  }

  @Post(':assignmentId/pickup')
  @Roles('DELIVERY')
  pickup(@CurrentUserId() userId: string, @Param('assignmentId') id: string) {
    return this.delivery.pickup(userId, id);
  }

  @Post(':assignmentId/out-for-delivery')
  @Roles('DELIVERY')
  outForDelivery(@CurrentUserId() userId: string, @Param('assignmentId') id: string) {
    return this.delivery.outForDelivery(userId, id);
  }

  @Post(':assignmentId/deliver')
  @Roles('DELIVERY')
  deliver(@CurrentUserId() userId: string, @Param('assignmentId') id: string) {
    return this.delivery.deliver(userId, id);
  }

  @Post(':assignmentId/fail')
  @Roles('DELIVERY')
  fail(@CurrentUserId() userId: string, @Param('assignmentId') id: string, @Body() dto: FailAssignmentDto) {
    return this.delivery.fail(userId, id, dto);
  }
}
