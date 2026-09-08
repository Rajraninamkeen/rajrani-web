import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUserId } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { NotificationService } from './notification.service';

/**
 * Session 38 — finance/payout notification self-service + operator oversight.
 * DELIVERY partners and SELLER operators read/mark their own in-app notices; OPERATOR/
 * ADMIN oversee the ledger and can run the dispatch (outbox) sweep.
 */

// DELIVERY partner self-service notifications (base '/delivery/notifications').
@Controller('delivery/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DeliveryNotificationsController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  @Roles('DELIVERY')
  mine(@CurrentUserId() userId: string, @Query() query: any) {
    return this.notifications.forUser(userId, { page: query?.page, limit: query?.limit });
  }

  @Get('unread-count')
  @Roles('DELIVERY')
  unread(@CurrentUserId() userId: string) {
    return this.notifications.unreadCount(userId).then((unreadCount) => ({ unreadCount }));
  }

  @Post(':id/read')
  @Roles('DELIVERY')
  read(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.notifications.markRead(userId, id);
  }

  @Post('read-all')
  @Roles('DELIVERY')
  readAll(@CurrentUserId() userId: string) {
    return this.notifications.markAllRead(userId);
  }
}

// SELLER operator self-service notifications (base '/seller/notifications').
@Controller('seller/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SellerNotificationsController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  @Roles('SELLER')
  mine(@CurrentUserId() userId: string, @Query() query: any) {
    return this.notifications.forUser(userId, { page: query?.page, limit: query?.limit });
  }

  @Get('unread-count')
  @Roles('SELLER')
  unread(@CurrentUserId() userId: string) {
    return this.notifications.unreadCount(userId).then((unreadCount) => ({ unreadCount }));
  }

  @Post(':id/read')
  @Roles('SELLER')
  read(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.notifications.markRead(userId, id);
  }

  @Post('read-all')
  @Roles('SELLER')
  readAll(@CurrentUserId() userId: string) {
    return this.notifications.markAllRead(userId);
  }
}

// CUSTOMER self-service notifications (base '/customer/notifications'). Session 40:
// buyer-facing notices for their order/return lifecycle.
@Controller('customer/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomerNotificationsController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  @Roles('CUSTOMER')
  mine(@CurrentUserId() userId: string, @Query() query: any) {
    return this.notifications.forUser(userId, { page: query?.page, limit: query?.limit });
  }

  @Get('unread-count')
  @Roles('CUSTOMER')
  unread(@CurrentUserId() userId: string) {
    return this.notifications.unreadCount(userId).then((unreadCount) => ({ unreadCount }));
  }

  @Post(':id/read')
  @Roles('CUSTOMER')
  read(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.notifications.markRead(userId, id);
  }

  @Post('read-all')
  @Roles('CUSTOMER')
  readAll(@CurrentUserId() userId: string) {
    return this.notifications.markAllRead(userId);
  }
}

// Back-office oversight (base '/finance/notifications').
@Controller('finance/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsAdminController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  @Roles('OPERATOR', 'ADMIN')
  list(@Query() query: any) {
    return this.notifications.staffList({
      recipientUserId: query?.recipientUserId,
      category: query?.category,
      unread: query?.unread,
      page: query?.page,
      limit: query?.limit,
    });
  }

  @Get('outbox')
  @Roles('OPERATOR', 'ADMIN')
  outbox(@Query() query: any) {
    return this.notifications.outboxList({ status: query?.status, page: query?.page, limit: query?.limit });
  }

  @Post('dispatch')
  @Roles('OPERATOR', 'ADMIN')
  dispatch(@Body() body: any) {
    return this.notifications.dispatch(body?.limit);
  }
}
