import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { PushNotificationService } from './push-notification.service';

@Controller({
  path: 'push-tokens',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.EMPLOYER, UserRole.CONTRACTOR, UserRole.ADMIN)
export class PushTokensController {
  constructor(private readonly pushNotifications: PushNotificationService) {}

  @Post()
  register(@CurrentUser() user: AuthenticatedUser, @Body() dto: RegisterPushTokenDto) {
    return this.pushNotifications.register(user, dto);
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.pushNotifications.mine(user);
  }

  @Delete(':id')
  deactivate(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.pushNotifications.deactivateMine(user, id);
  }
}

@Controller({
  path: 'admin/push-tokens',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminPushTokensController {
  constructor(private readonly pushNotifications: PushNotificationService) {}

  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.pushNotifications.adminFindAll(query);
  }
}
