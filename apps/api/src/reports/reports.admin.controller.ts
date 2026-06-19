import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { ReportsQueryDto } from './dto/reports-query.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { ReportsService } from './reports.service';

@Controller({
  path: 'admin/reports',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  reports(@Query() query: ReportsQueryDto) {
    return this.reportsService.findAdminAll(query);
  }

  @Get(':reportId')
  report(@Param('reportId', ParseUUIDPipe) reportId: string) {
    return this.reportsService.findAdminOne(reportId);
  }

  @Patch(':reportId/status')
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reportId', ParseUUIDPipe) reportId: string,
    @Body() dto: UpdateReportStatusDto,
  ) {
    return this.reportsService.updateStatus(user, reportId, dto);
  }

  @Post(':reportId/actions/suspend-user')
  suspendUser(@CurrentUser() user: AuthenticatedUser, @Param('reportId', ParseUUIDPipe) reportId: string) {
    return this.reportsService.suspendUserFromReport(user, reportId);
  }

  @Post(':reportId/actions/activate-user')
  activateUser(@CurrentUser() user: AuthenticatedUser, @Param('reportId', ParseUUIDPipe) reportId: string) {
    return this.reportsService.activateUserFromReport(user, reportId);
  }

  @Post(':reportId/actions/close-job')
  closeJob(@CurrentUser() user: AuthenticatedUser, @Param('reportId', ParseUUIDPipe) reportId: string) {
    return this.reportsService.closeJobFromReport(user, reportId);
  }

  @Post(':reportId/actions/remove-review')
  removeReview(@CurrentUser() user: AuthenticatedUser, @Param('reportId', ParseUUIDPipe) reportId: string) {
    return this.reportsService.removeReviewFromReport(user, reportId);
  }

  @Post(':reportId/actions/hide-message')
  hideMessage(@CurrentUser() user: AuthenticatedUser, @Param('reportId', ParseUUIDPipe) reportId: string) {
    return this.reportsService.hideMessageFromReport(user, reportId);
  }
}
