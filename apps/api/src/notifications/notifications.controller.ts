import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { NotificationsService } from './notifications.service';
import { PushNotificationService } from '../push/push-notification.service';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

@Controller({
  path: 'notifications',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.EMPLOYER, UserRole.CONTRACTOR, UserRole.ADMIN)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly pushNotifications: PushNotificationService,
  ) {}

  @Get()
  @Throttle({ default: { limit: 180, ttl: 60_000 } })
  findMine(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
    return this.notificationsService.findMine(user, query);
  }

  @Get('unread-count')
  @Throttle({ default: { limit: 180, ttl: 60_000 } })
  unreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.unreadCount(user);
  }

  @Get('preferences')
  preferences(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.getPreferences(user);
  }

  @Patch('preferences')
  updatePreferences(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateNotificationPreferencesDto) {
    return this.notificationsService.updatePreferences(user, dto);
  }

  @Get('debug/push-tokens')
  debugPushTokens(@CurrentUser() user: AuthenticatedUser) {
    return this.pushNotifications.debugMine(user);
  }

  @Post('debug/send-test')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  sendDebugTestPush(@CurrentUser() user: AuthenticatedUser) {
    return this.pushNotifications.sendDebugTest(user);
  }

  @Patch(':id/read')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  markRead(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.notificationsService.markRead(user, id);
  }

  @Patch('read-all')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  readAll(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllRead(user);
  }
}
