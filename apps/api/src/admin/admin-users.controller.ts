import { Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { AdminService } from './admin.service';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';

@Controller({
  path: 'admin/users',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminUsersController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  users(@Query() query: AdminUsersQueryDto) {
    return this.adminService.users(query);
  }

  @Get(':userId')
  user(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.adminService.user(userId);
  }

  @Patch(':userId/suspend')
  suspend(@CurrentUser() user: AuthenticatedUser, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.adminService.suspendUser(user, userId);
  }

  @Patch(':userId/activate')
  activate(@CurrentUser() user: AuthenticatedUser, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.adminService.activateUser(user, userId);
  }
}
