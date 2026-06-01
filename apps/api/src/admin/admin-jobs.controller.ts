import { Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { AdminService } from './admin.service';
import { AdminJobsQueryDto } from './dto/admin-jobs-query.dto';

@Controller({
  path: 'admin/jobs',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminJobsController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  jobs(@Query() query: AdminJobsQueryDto) {
    return this.adminService.jobs(query);
  }

  @Get(':jobId')
  job(@Param('jobId', ParseUUIDPipe) jobId: string) {
    return this.adminService.job(jobId);
  }

  @Patch(':jobId/close')
  close(@CurrentUser() user: AuthenticatedUser, @Param('jobId', ParseUUIDPipe) jobId: string) {
    return this.adminService.closeJob(user, jobId);
  }
}
