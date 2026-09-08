import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUserId } from '../auth/decorators/current-user.decorator';
import { CurrentUserRole } from '../auth/decorators/current-user-role.decorator';
import { ControlService } from './control.service';
import {
  ControlAuditQueryDto,
  ControlSellersQueryDto,
  ControlSessionsQueryDto,
  ControlUsersQueryDto,
  RevokeAllSessionsDto,
  RevokeSessionDto,
} from './dto/control.dto';

/**
 * Session 43 — Platform Control Panel (OPERATOR/ADMIN, governance + break-glass).
 * Read surface over users/sessions/sellers + a platform-control audit log, plus
 * high-authority actions that require a mandatory reason and are themselves audited.
 * These routes are deliberately separate from the existing per-domain staff surfaces
 * (/ops, /finance, /seller-onboarding, /delivery) — this is the cross-domain control
 * plane.
 */
@Controller('control')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ControlController {
  constructor(private readonly control: ControlService) {}

  @Get('overview')
  @Roles('OPERATOR', 'ADMIN')
  overview() {
    return this.control.overview();
  }

  @Get('users')
  @Roles('OPERATOR', 'ADMIN')
  users(@Query() q: ControlUsersQueryDto) {
    return this.control.users(q);
  }

  @Get('users/:userId')
  @Roles('OPERATOR', 'ADMIN')
  userDetail(@Param('userId') userId: string) {
    return this.control.userDetail(userId);
  }

  @Get('sessions')
  @Roles('OPERATOR', 'ADMIN')
  sessions(@Query() q: ControlSessionsQueryDto) {
    return this.control.sessions(q);
  }

  /** Break-glass: revoke one platform session (reason mandatory, audited). */
  @Post('sessions/:sessionId/revoke')
  @Roles('OPERATOR', 'ADMIN')
  revokeSession(
    @CurrentUserId() actorId: string,
    @CurrentUserRole() actorRole: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: RevokeSessionDto,
  ) {
    return this.control.revokeSession(actorId, actorRole, sessionId, dto);
  }

  /** Break-glass: revoke every active session of a platform user. */
  @Post('users/:userId/revoke-sessions')
  @Roles('OPERATOR', 'ADMIN')
  revokeAllUserSessions(
    @CurrentUserId() actorId: string,
    @CurrentUserRole() actorRole: string,
    @Param('userId') targetUserId: string,
    @Body() dto: RevokeAllSessionsDto,
  ) {
    return this.control.revokeAllUserSessions(actorId, actorRole, targetUserId, dto.reason);
  }

  @Get('sellers')
  @Roles('OPERATOR', 'ADMIN')
  sellers(@Query() q: ControlSellersQueryDto) {
    return this.control.sellers(q);
  }

  @Get('audit')
  @Roles('OPERATOR', 'ADMIN')
  audit(@Query() q: ControlAuditQueryDto) {
    return this.control.audit(q);
  }
}
