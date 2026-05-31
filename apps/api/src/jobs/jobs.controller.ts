import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { BrowseJobsQueryDto } from './dto/browse-jobs-query.dto';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { JobsService } from './jobs.service';

@Controller({
  path: 'jobs',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  @Roles(UserRole.CONTRACTOR)
  browse(@CurrentUser() user: AuthenticatedUser, @Query() query: BrowseJobsQueryDto) {
    return this.jobsService.browse(user, query);
  }

  @Post()
  @Roles(UserRole.EMPLOYER)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateJobDto) {
    return this.jobsService.create(user, dto);
  }

  @Get('mine')
  @Roles(UserRole.EMPLOYER)
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.jobsService.findMine(user);
  }

  @Get(':id')
  @Roles(UserRole.EMPLOYER, UserRole.CONTRACTOR)
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.jobsService.findOne(user, id);
  }

  @Patch(':id')
  @Roles(UserRole.EMPLOYER)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateJobDto,
  ) {
    return this.jobsService.update(user, id, dto);
  }

  @Post(':id/renew')
  @Roles(UserRole.EMPLOYER)
  renew(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.jobsService.renew(user, id);
  }

  @Delete(':id')
  @Roles(UserRole.EMPLOYER)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.jobsService.remove(user, id);
  }
}
