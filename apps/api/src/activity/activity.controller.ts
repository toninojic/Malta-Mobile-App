import { Controller, Get, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { ActivityService } from './activity.service';

@Controller({
  path: 'activity',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get('summary')
  @Roles(UserRole.EMPLOYER, UserRole.CONTRACTOR, UserRole.ADMIN)
  @Throttle({ default: { limit: 180, ttl: 60_000 } })
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.activityService.summary(user);
  }
}
