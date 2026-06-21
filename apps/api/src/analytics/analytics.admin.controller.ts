import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AnalyticsService } from './analytics.service';
import { AdminAnalyticsQueryDto } from './dto/admin-analytics-query.dto';

@Controller({
  path: 'admin/analytics',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AnalyticsAdminController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  overview(@Query() query: AdminAnalyticsQueryDto) {
    return this.analyticsService.overview(query);
  }

  @Get('events')
  events(@Query() query: AdminAnalyticsQueryDto) {
    return this.analyticsService.events(query);
  }

  @Get('funnels')
  funnels(@Query() query: AdminAnalyticsQueryDto) {
    return this.analyticsService.funnels(query);
  }

  @Get('errors')
  errors(@Query() query: AdminAnalyticsQueryDto) {
    return this.analyticsService.errors(query);
  }
}
