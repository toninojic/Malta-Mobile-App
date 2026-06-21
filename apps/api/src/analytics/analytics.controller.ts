import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { AnalyticsService } from './analytics.service';
import { CreateAnalyticsEventDto, CreateAnalyticsEventsBatchDto } from './dto/create-analytics-event.dto';

@Controller({
  path: 'analytics',
  version: '1',
})
@UseGuards(OptionalJwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('events')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  create(@CurrentUser() user: AuthenticatedUser | null, @Body() dto: CreateAnalyticsEventDto) {
    return this.analyticsService.create(user, dto);
  }

  @Post('events/batch')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  createBatch(@CurrentUser() user: AuthenticatedUser | null, @Body() dto: CreateAnalyticsEventsBatchDto) {
    return this.analyticsService.createBatch(user, dto.events);
  }
}
